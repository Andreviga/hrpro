import { COMPANY_REGISTRY_FILL_LOCATION, resolveCompanyRegistry } from './company-registry';
import { getWorksheetCell, readNamedTable } from './excel-reader';
import {
  EmployeeLookupKey,
  LoadedWorkbook,
  MappedPayrollSources,
  NamedTableData,
  NamedTableRow,
  PayslipWarning,
  WorkbookCellValue
} from './types';

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const normalizeCpf = (value: unknown) => String(value ?? '').replace(/\D+/g, '');

const aliasMap = {
  registrationName: ['Nome', 'Nome '],
  registrationCpf: ['CPF', 'CPF '],
  registrationBank: ['BANCO'],
  registrationAgency: ['Agência'],
  registrationAccount: ['Conta'],
  registrationPix: ['PIX'],
  registrationAdmission: ['Admissão'],
  registrationEmail: ['email'],
  classProfessor: ['Professor'],
  classRole: ['Disciplina'],
  classInfant: ['Aula no Ensino Infantil'],
  classEfi: ['Aula no EFI'],
  classEfiCount: ['Nº aula EFI'],
  classEfii: ['Nº aulas no EFII'],
  classEm: ['Nº aulas no EM'],
  classRoEfi: ['RO EFI'],
  classRoEfii: ['RO EFII'],
  classRoEm: ['RO EM'],
  classSalaryBase: ['Sálario base'],
  classHourActivity: ['Adicional hora atividade'],
  classDsr: ['Descanso remunerado'],
  classTotalAbsence: ['Total falta'],
  classFunctionAllowance: ['AD função ou turno'],
  classGrossSalary: ['Salário Bruto'],
  monthlyEmployee: ['FUNCIONÁRIO'],
  monthlyGrossSalary: ['VALOR'],
  monthlyInss: ['INSS'],
  monthlyIrrf: ['IRFONTE'],
  monthlyTransport: ['Vale transporte'],
  monthlyLoan: ['Empréstimo'],
  monthlyNetSalary: ['Salário Liquído'],
  monthlyVa: ['VA'],
  monthlyPix: ['PIX'],
  monthlyAccount: ['Conta bancária'],
  monthlyBank: ['Banco'],
  monthlyCompany: ['Empresa'],
  thirteenthEmployee: ['FUNCIONÁRIO'],
  thirteenthSecond: ['Segunda parcela'],
  thirteenthInss: ['INSS'],
  thirteenthIrrf: ['IRFONTE']
} as const;

const findCellByAliases = (row: NamedTableRow, aliases: readonly string[]) => {
  const normalizedAliases = aliases.map((item) => normalizeText(item));
  return Object.entries(row).find(([header]) => normalizedAliases.includes(normalizeText(header)))?.[1];
};

const findEmployeeBy = (table: NamedTableData, employeeKey: EmployeeLookupKey, aliases: readonly string[]) => {
  const targetCpf = normalizeCpf(employeeKey.cpf);
  const targetName = normalizeText(employeeKey.name);

  return table.rows.find((row) => {
    const nameCell = findCellByAliases(row, aliases);
    const cpfCell = findCellByAliases(row, aliasMap.registrationCpf);

    if (targetCpf && normalizeCpf(cpfCell?.value) === targetCpf) {
      return true;
    }

    if (targetName && normalizeText(nameCell?.value) === targetName) {
      return true;
    }

    return false;
  });
};

const buildCompetenceLabel = (sheetName: string, templateDateCell?: WorkbookCellValue) => {
  if (templateDateCell?.value instanceof Date) {
    const date = templateDateCell.value;
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  const normalizedSheet = normalizeText(sheetName).toLowerCase();
  const yearMatch = normalizedSheet.match(/(20\d{2})/);
  const monthIndex = MONTH_NAMES.findIndex((monthName) => normalizedSheet.includes(monthName));
  if (yearMatch && monthIndex >= 0) {
    return `${String(monthIndex + 1).padStart(2, '0')}/${yearMatch[1]}`;
  }

  return 'COMPETENCIA_NAO_IDENTIFICADA';
};

const matchMonthlySheet = (workbook: LoadedWorkbook, competence?: string | null) => {
  const monthlyTables = workbook.namedTables.filter((table) => table.tableName === 'Tabela35');
  if (monthlyTables.length === 0) {
    throw new Error('Monthly payroll table Tabela35 not found in workbook');
  }

  if (!competence || monthlyTables.length === 1) {
    return monthlyTables[0].sheetName;
  }

  const normalizedCompetence = normalizeText(competence).toLowerCase();
  return monthlyTables.find((item) => normalizeText(item.sheetName).toLowerCase().includes(normalizedCompetence))?.sheetName
    ?? monthlyTables[0].sheetName;
};

export const findEmployeeByName = (table: NamedTableData, name: string) =>
  findEmployeeBy(table, { name }, aliasMap.registrationName);

export const findEmployeeByCpf = (table: NamedTableData, cpf: string) =>
  findEmployeeBy(table, { cpf }, aliasMap.registrationName);

export const mapPayrollData = (params: {
  workbook: LoadedWorkbook;
  employeeKey: string | EmployeeLookupKey;
  competence?: string | null;
}): MappedPayrollSources => {
  const employeeLookup: EmployeeLookupKey =
    typeof params.employeeKey === 'string'
      ? params.employeeKey.replace(/\D+/g, '').length === 11
        ? { cpf: params.employeeKey }
        : { name: params.employeeKey }
      : params.employeeKey;

  const registrationTable = readNamedTable(params.workbook, 'Cadastro Funcionários', 'Tabela1');
  const classTable = readNamedTable(params.workbook, 'Quantidade de aula 0125', 'Tabela2');
  const monthlySheetName = matchMonthlySheet(params.workbook, params.competence);
  const monthlyTable = readNamedTable(params.workbook, monthlySheetName, 'Tabela35');
  const thirteenthTable = readNamedTable(params.workbook, 'Folha de pagto 13 2025', 'Tabela354');

  const registrationRow =
    findEmployeeBy(registrationTable, employeeLookup, aliasMap.registrationName) ??
    findEmployeeBy(classTable, employeeLookup, aliasMap.classProfessor);
  if (!registrationRow) {
    throw new Error('Employee not found in Cadastro Funcionários');
  }

  const classRow = findEmployeeBy(classTable, employeeLookup, aliasMap.classProfessor);
  if (!classRow) {
    throw new Error('Employee not found in Quantidade de aula 0125');
  }

  const monthlyRow = findEmployeeBy(monthlyTable, employeeLookup, aliasMap.monthlyEmployee);
  if (!monthlyRow) {
    throw new Error(`Employee not found in ${monthlySheetName}.Tabela35`);
  }

  const thirteenthRow = findEmployeeBy(thirteenthTable, employeeLookup, aliasMap.thirteenthEmployee);

  const templateCells = {
    C5: getWorksheetCell(params.workbook, 'Holerite', 'C5'),
    D6: getWorksheetCell(params.workbook, 'Holerite', 'D6'),
    E7: getWorksheetCell(params.workbook, 'Holerite', 'E7'),
    C8: getWorksheetCell(params.workbook, 'Holerite', 'C8'),
    D8: getWorksheetCell(params.workbook, 'Holerite', 'D8'),
    F8: getWorksheetCell(params.workbook, 'Holerite', 'F8')
  };

  const auxiliaryCells = {
    E14: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'E14'),
    F14: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'F14'),
    G14: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'G14'),
    H14: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'H14'),
    I14: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'I14'),
    E15: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'E15'),
    I15: getWorksheetCell(params.workbook, 'Tab auxílio 0125', 'I15')
  };

  const warnings: PayslipWarning[] = [];
  const companyName = String(findCellByAliases(monthlyRow, aliasMap.monthlyCompany)?.value ?? '').trim();
  const companyRegistry = resolveCompanyRegistry(companyName);

  if (!companyRegistry) {
    warnings.push({
      code: 'COMPANY_REGISTRY_MISSING',
      message: `Empresa ${companyName || 'NAO_INFORMADA'} nao encontrada no registry. Preencha CNPJ e endereco manualmente.`,
      fillLocation: COMPANY_REGISTRY_FILL_LOCATION,
      sourceSheet: monthlySheetName,
      sourceTable: 'Tabela35'
    });
  } else if (companyRegistry.needsAddressFill) {
    warnings.push({
      code: 'COMPANY_ADDRESS_FILL_REQUIRED',
      message: `Endereco da empresa ${companyRegistry.name} precisa ser preenchido manualmente no registry antes do uso final do PDF.`,
      fillLocation: COMPANY_REGISTRY_FILL_LOCATION,
      sourceSheet: monthlySheetName,
      sourceTable: 'Tabela35'
    });
  }

  if (!thirteenthRow) {
    warnings.push({
      code: 'THIRTEENTH_ROW_NOT_FOUND',
      message: 'Linha do 13o salario nao encontrada para este funcionario; os campos da 2a parcela ficarao vazios.',
      sourceSheet: 'Folha de pagto 13 2025',
      sourceTable: 'Tabela354'
    });
  }

  return {
    employeeLookup,
    competenceLabel: buildCompetenceLabel(monthlySheetName, templateCells.F8),
    monthlySheetName,
    registrationRow,
    classRow,
    monthlyRow,
    thirteenthRow: thirteenthRow ?? undefined,
    templateCells,
    auxiliaryCells,
    warnings
  };
};

export const rowCell = (row: NamedTableRow, aliases: readonly string[]) => findCellByAliases(row, aliases);

export const payrollAliases = aliasMap;

export const helpers = {
  normalizeText,
  normalizeCpf
};