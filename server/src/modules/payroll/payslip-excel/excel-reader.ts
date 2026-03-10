import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';
import { LoadedWorkbook, NamedTableData, WorkbookCellValue, WorkbookNamedTable } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false
});

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const resolveZipPath = (baseFile: string, relativeTarget: string) => {
  const baseDir = path.posix.dirname(baseFile);
  return path.posix.normalize(path.posix.join(baseDir, relativeTarget)).replace(/^\//, '');
};

const buildWorkbookNamedTables = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  const workbookRelsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');

  if (!workbookXml || !workbookRelsXml) {
    return [] as WorkbookNamedTable[];
  }

  const workbookDoc = xmlParser.parse(workbookXml);
  const workbookRelsDoc = xmlParser.parse(workbookRelsXml);

  const workbookRels = new Map<string, string>();
  for (const relation of toArray(workbookRelsDoc.Relationships?.Relationship)) {
    if (relation?.Id && relation?.Target) {
      workbookRels.set(String(relation.Id), resolveZipPath('xl/workbook.xml', String(relation.Target)));
    }
  }

  const namedTables: WorkbookNamedTable[] = [];
  for (const sheet of toArray(workbookDoc.workbook?.sheets?.sheet)) {
    const relationId = String(sheet.id ?? sheet['r:id'] ?? '');
    const sheetName = String(sheet.name ?? '');
    const sheetPath = workbookRels.get(relationId);
    if (!sheetName || !sheetPath) {
      continue;
    }

    const sheetRelPath = `xl/worksheets/_rels/${path.posix.basename(sheetPath)}.rels`;
    const sheetRelsXml = await zip.file(sheetRelPath)?.async('string');
    if (!sheetRelsXml) {
      continue;
    }

    const sheetRelsDoc = xmlParser.parse(sheetRelsXml);
    for (const relation of toArray(sheetRelsDoc.Relationships?.Relationship)) {
      const relationType = String(relation?.Type ?? '');
      if (!relationType.includes('/table')) {
        continue;
      }

      const tablePath = resolveZipPath(sheetPath, String(relation.Target ?? ''));
      const tableXml = await zip.file(tablePath)?.async('string');
      if (!tableXml) {
        continue;
      }

      const tableDoc = xmlParser.parse(tableXml);
      const tableNode = tableDoc.table;
      if (!tableNode?.ref) {
        continue;
      }

      namedTables.push({
        sheetName,
        tableName: String(tableNode.name ?? tableNode.displayName ?? ''),
        displayName: String(tableNode.displayName ?? tableNode.name ?? ''),
        ref: String(tableNode.ref),
        path: tablePath
      });
    }
  }

  return namedTables;
};

const extractCellValue = (params: {
  workbook: LoadedWorkbook;
  sheetName: string;
  cellAddress: string;
  sourceTable?: string;
  sourceColumn?: string;
}): WorkbookCellValue | undefined => {
  const sheet = params.workbook.workbook.Sheets[params.sheetName];
  if (!sheet) {
    return undefined;
  }

  const cell = sheet[params.cellAddress] as XLSX.CellObject | undefined;
  return {
    value: cell?.v,
    formattedValue: cell?.w ?? null,
    formula: cell?.f ?? null,
    sourceSheet: params.sheetName,
    sourceTable: params.sourceTable,
    sourceColumn: params.sourceColumn,
    sourceCell: params.cellAddress
  };
};

export const loadWorkbook = async (filePath: string): Promise<LoadedWorkbook> => {
  const buffer = await fs.readFile(filePath);
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: true,
    cellDates: true,
    cellNF: true
  });

  const namedTables = await buildWorkbookNamedTables(buffer);

  return {
    filePath,
    workbook,
    namedTables
  };
};

export const getWorksheetCell = (
  workbook: LoadedWorkbook,
  sheetName: string,
  cellAddress: string,
  sourceTable?: string,
  sourceColumn?: string
) => {
  return extractCellValue({ workbook, sheetName, cellAddress, sourceTable, sourceColumn });
};

export const readNamedTable = (
  workbook: LoadedWorkbook,
  sheetName: string,
  tableName: string
): NamedTableData => {
  const table = workbook.namedTables.find(
    (item) => item.sheetName === sheetName && (item.tableName === tableName || item.displayName === tableName)
  );

  if (!table) {
    throw new Error(`Named table not found: ${sheetName}.${tableName}`);
  }

  const sheet = workbook.workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const decodedRange = XLSX.utils.decode_range(table.ref);
  const headerRowIndex = decodedRange.s.r;
  const headers: string[] = [];
  for (let col = decodedRange.s.c; col <= decodedRange.e.c; col += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
    const cell = sheet[address] as XLSX.CellObject | undefined;
    headers.push(String(cell?.v ?? cell?.w ?? `column_${col + 1}`).trim());
  }

  const rows = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex <= decodedRange.e.r; rowIndex += 1) {
    const row: Record<string, WorkbookCellValue | undefined> = {};
    let hasData = false;
    for (let col = decodedRange.s.c; col <= decodedRange.e.c; col += 1) {
      const header = headers[col - decodedRange.s.c];
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: col });
      const cellValue = extractCellValue({
        workbook,
        sheetName,
        cellAddress: address,
        sourceTable: table.tableName,
        sourceColumn: header
      });

      if (cellValue && cellValue.value !== undefined && cellValue.value !== null && String(cellValue.value).trim() !== '') {
        hasData = true;
      }
      row[header] = cellValue;
    }

    if (hasData) {
      rows.push(row);
    }
  }

  return {
    sheetName,
    tableName: table.tableName,
    ref: table.ref,
    headers,
    rows
  };
};