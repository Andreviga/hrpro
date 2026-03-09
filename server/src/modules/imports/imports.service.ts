import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as XLSX from 'xlsx';

const normalize = (value: string) => value.toLowerCase().trim();

const normalizeText = (value: unknown) =>
  normalize(
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

const headerAliases: Record<string, string[]> = {
  fullName: ['nome', 'funcionario', 'colaborador', 'professor'],
  cpf: ['cpf'],
  rg: ['rg'],
  email: ['email', 'e-mail'],
  position: ['cargo', 'funcao', 'disciplina'],
  department: ['departamento', 'setor', 'unidade'],
  admissionDate: ['admissao', 'data admissao', 'data de admissao'],
  baseSalary: ['salario', 'salario base', 'salario mensal', 'salario bruto', 'salario antes das faltas', 'valor'],
  hourlyRate: ['valor hora', 'hora aula'],
  weeklyHours: ['horas semanais', 'carga horaria', 'n aulas', 'n. aulas'],
  grossSalary: ['salario bruto', 'salario base', 'salario antes das faltas', 'valor', 'total bruto'],
  netSalary: ['salario liquido', 'liquido'],
  minValue: ['min', 'minimo', 'faixa inicial', 'de'],
  maxValue: ['max', 'maximo', 'faixa final', 'ate'],
  rate: ['aliquota', 'percentual', 'taxa'],
  deduction: ['deducao', 'parcela a deduzir'],
  dependentDeduction: ['dependente', 'deducao dependente']
};

const rubricAliases: Record<string, { code: string; type: 'earning' | 'deduction' }> = {
  'salario base': { code: 'BASE', type: 'earning' },
  'salario bruto': { code: 'BASE', type: 'earning' },
  valor2: { code: 'DECIMO_13', type: 'earning' },
  '13o': { code: 'DECIMO_13', type: 'earning' },
  decimo: { code: 'DECIMO_13', type: 'earning' },
  '1/3': { code: 'FERIAS_UM_TERCO', type: 'earning' },
  ferias: { code: 'FERIAS', type: 'earning' },
  plr: { code: 'PLR', type: 'earning' },
  'sal.fam': { code: 'SAL_FAM', type: 'earning' },
  'salario familia': { code: 'SAL_FAM', type: 'earning' },
  dsr: { code: 'DSR', type: 'earning' },
  'descanso remunerado': { code: 'DSR', type: 'earning' },
  'adicional hora atividade': { code: 'HORA_ATV', type: 'earning' },
  'hora atividade': { code: 'HORA_ATV', type: 'earning' },
  'hora-atividade': { code: 'HORA_ATV', type: 'earning' },
  'hora extra': { code: 'EXTRA', type: 'earning' },
  'horas extras': { code: 'EXTRA', type: 'earning' },
  'adicional noturno': { code: 'NOTURNO', type: 'earning' },
  gratificacao: { code: 'OUTROS', type: 'earning' },
  bonus: { code: 'OUTROS', type: 'earning' },
  salario: { code: 'BASE', type: 'earning' },
  valor: { code: 'BASE', type: 'earning' },

  'irrf 13': { code: 'IRRF13', type: 'deduction' },
  'inss 13': { code: 'INSS13', type: 'deduction' },
  irfonte: { code: 'IRRF', type: 'deduction' },
  irrf: { code: 'IRRF', type: 'deduction' },
  inss: { code: 'INSS', type: 'deduction' },
  emprestimo: { code: 'EMPRESTIMO', type: 'deduction' },
  'credito do trabalhador': { code: 'EMPRESTIMO', type: 'deduction' },
  consignado: { code: 'EMPRESTIMO', type: 'deduction' },
  'emprestimo consignado': { code: 'EMPRESTIMO', type: 'deduction' },
  'vale transporte': { code: 'VT', type: 'deduction' },
  vt: { code: 'VT', type: 'deduction' },
  'vale alimentacao': { code: 'VA', type: 'deduction' },
  va: { code: 'VA', type: 'deduction' },
  sindicato: { code: 'SIND', type: 'deduction' },
  faltas: { code: 'FALTA', type: 'deduction' },
  falta: { code: 'FALTA', type: 'deduction' },
  descontos: { code: 'OUTROS', type: 'deduction' }
};

const rubricAliasEntries = Object.entries(rubricAliases).sort((a, b) => b[0].length - a[0].length);

const findHeader = (headers: string[], field: keyof typeof headerAliases) => {
  const aliases = headerAliases[field].map((alias) => normalizeText(alias));
  return headers.find((header) => {
    const normalizedHeader = normalizeText(header);
    const tokens = normalizedHeader.split(/[^a-z0-9]+/).filter(Boolean);

    return aliases.some((alias) => {
      if (normalizedHeader === alias) return true;
      if (!normalizedHeader.includes(alias)) return false;

      if (alias.length <= 3) {
        return tokens.includes(alias);
      }

      return true;
    });
  });
};

const parseNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value).trim();
  const isPercent = text.includes('%');
  const raw = text.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  if (isPercent) {
    return parsed / 100;
  }

  return parsed;
};

type SheetProfile = 'cadastro' | 'tab_auxilio' | 'quantidade_aula' | 'folha' | 'generic';

const getSheetProfile = (sheetLower: string): SheetProfile => {
  if (sheetLower.includes('cadastro')) return 'cadastro';
  if (sheetLower.includes('tab auxilio')) return 'tab_auxilio';
  if (sheetLower.includes('quantidade de aula')) return 'quantidade_aula';
  if (sheetLower.includes('folha de pagto') || sheetLower.includes('folha de pagamento')) return 'folha';
  return 'generic';
};

const profileKeywords: Record<SheetProfile, string[]> = {
  cadastro: ['funcionario', 'cpf'],
  tab_auxilio: ['aliquota', 'parcela', 'deduzir'],
  quantidade_aula: ['professor', 'disciplina'],
  folha: ['funcionario', 'valor'],
  generic: []
};

const hasSheetProfileHeaders = (headers: string[], profile: SheetProfile) => {
  const normalizedHeaders = headers.map((header) => normalizeText(header));

  if (profile === 'tab_auxilio') {
    const hasRange = normalizedHeaders.some((header) =>
      headerAliases.minValue.some((alias) => normalizeText(header).includes(normalizeText(alias)))
    );
    const hasRate = normalizedHeaders.some((header) =>
      headerAliases.rate.some((alias) => normalizeText(header).includes(normalizeText(alias)))
    );
    return hasRange && hasRate;
  }

  const required = profileKeywords[profile];
  if (required.length === 0) return true;

  return required.every((keyword) => normalizedHeaders.some((header) => header.includes(normalizeText(keyword))));
};

const dedupeHeaders = (headers: string[]) => {
  const used: Record<string, number> = {};
  return headers.map((header, index) => {
    const base = (String(header || '').trim() || `col_${index + 1}`).replace(/\s+/g, ' ');
    const normalizedBase = normalizeText(base);
    if (!used[normalizedBase]) {
      used[normalizedBase] = 1;
      return base;
    }
    used[normalizedBase] += 1;
    return `${base}_${used[normalizedBase]}`;
  });
};

const buildObjectRowsFromMatrix = (matrix: unknown[][], headerRowIndex: number) => {
  const rawHeaders = (matrix[headerRowIndex] ?? []).map((item) => String(item ?? '').trim());
  const headers = dedupeHeaders(rawHeaders);

  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const objectRow: Record<string, any> = {};
      headers.forEach((header, index) => {
        objectRow[header] = (row as any[])[index] ?? '';
      });
      return objectRow;
    });

  return { rows, headers };
};

const detectHeaderRowIndex = (matrix: unknown[][], profile: SheetProfile) => {
  const scanLimit = Math.min(matrix.length, 35);
  for (let index = 0; index < scanLimit; index += 1) {
    const rowCandidate = matrix[index];
    const candidateValues = Array.isArray(rowCandidate)
      ? rowCandidate
      : rowCandidate && typeof rowCandidate === 'object'
        ? Object.values(rowCandidate as Record<string, unknown>)
        : [];
    const headerCandidate = candidateValues.map((item) => String(item ?? '').trim());
    if (!headerCandidate.some((value) => value)) continue;

    if (hasSheetProfileHeaders(headerCandidate, profile)) {
      return index;
    }
  }
  return -1;
};

const readSheetRows = (sheet: XLSX.WorkSheet, profile: SheetProfile) => {
  const directRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  if (directRows.length > 0) {
    const directHeaders = Object.keys(directRows[0]);
    if (hasSheetProfileHeaders(directHeaders, profile)) {
      return { rows: directRows, headers: directHeaders, rowOffset: 2 };
    }
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false
  }) as unknown[][];

  if (matrix.length === 0) {
    return { rows: [] as Record<string, any>[], headers: [] as string[], rowOffset: 2 };
  }

  const headerRowIndex = detectHeaderRowIndex(matrix, profile);
  if (headerRowIndex >= 0) {
    const { rows, headers } = buildObjectRowsFromMatrix(matrix, headerRowIndex);
    return { rows, headers, rowOffset: headerRowIndex + 2 };
  }

  return {
    rows: directRows,
    headers: directRows.length > 0 ? Object.keys(directRows[0]) : [],
    rowOffset: 2
  };
};

const matchesRubricAlias = (normalizedHeader: string, alias: string) => {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;

  if (normalizedHeader === normalizedAlias) return true;

  if (!normalizedHeader.includes(normalizedAlias)) return false;

  if (normalizedAlias.length <= 3) {
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokenRegex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    return tokenRegex.test(normalizedHeader);
  }

  return true;
};

const findRubricMapping = (header: string) => {
  const normalizedHeader = normalizeText(header);
  return rubricAliasEntries.find(([alias]) => matchesRubricAlias(normalizedHeader, alias));
};

const parseDate = (value: any) => {
  if (value === null || value === undefined || value === '') return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};
const inferCompetency = (sheetName: string, fileName?: string) => {
  const source = `${sheetName} ${fileName ?? ''}`;
  const lower = normalizeText(source);
  const yearMatch = source.match(/(20\d{2})/);
  let year = yearMatch ? Number(yearMatch[1]) : null;
  let month: number | null = null;

  const compactMatch = source.match(/\b(0[1-9]|1[0-2])([0-9]{2})\b/);
  if (compactMatch) {
    month = Number(compactMatch[1]);
    if (!year) {
      year = Number(`20${compactMatch[2]}`);
    }
  }

  if (!month) {
    const monthNames: Record<string, number> = {
      janeiro: 1,
      fevereiro: 2,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      agosto: 8,
      setembro: 9,
      outubro: 10,
      novembro: 11,
      dezembro: 12
    };
    for (const [name, value] of Object.entries(monthNames)) {
      if (lower.includes(name)) {
        month = value;
        break;
      }
    }
  }

  return {
    month: month ?? new Date().getMonth() + 1,
    year: year ?? new Date().getFullYear()
  };
};

@Injectable()
export class ImportsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async importWorkbook(params: {
    buffer: Buffer;
    fileName: string;
    companyId: string;
    userId?: string;
  }) {
    const batch = await this.prisma.importBatch.create({
      data: {
        companyId: params.companyId,
        fileName: params.fileName,
        status: 'processing'
      }
    });

    const workbook = XLSX.read(params.buffer, { type: 'buffer' });
    const errors: string[] = [];
    let processedRows = 0;
    let failedRows = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetLower = normalizeText(sheetName);
      const profile = getSheetProfile(sheetLower);
      const { rows, headers, rowOffset } = readSheetRows(sheet, profile);
      if (!rows.length) continue;

      const nameHeader = findHeader(headers, 'fullName');
      const cpfHeader = findHeader(headers, 'cpf');
      const rgHeader = findHeader(headers, 'rg');
      const competency = inferCompetency(sheetName, params.fileName);
      let payrollSheetChecked = false;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = rowOffset + index;

        if (Object.values(row).some((value) => String(value).includes('#REF!'))) {
          failedRows += 1;
          errors.push(`Planilha ${sheetName} linha ${rowNumber}: formula quebrada (#REF!)`);
          await this.prisma.importItem.create({
            data: {
              batchId: batch.id,
              sheet: sheetName,
              rowNumber,
              status: 'error',
              message: 'Formula quebrada (#REF!)'
            }
          });
          continue;
        }

        if (sheetLower.includes('cadastro')) {
          const fullName = nameHeader ? row[nameHeader] : undefined;
          const cpfRaw = cpfHeader ? row[cpfHeader] : undefined;
          const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';

          if (!fullName || !cpf) {
            failedRows += 1;
            errors.push(`Planilha ${sheetName} linha ${rowNumber}: nome ou CPF ausente`);
            await this.prisma.importItem.create({
              data: {
                batchId: batch.id,
                sheet: sheetName,
                rowNumber,
                status: 'error',
                message: 'Nome ou CPF ausente'
              }
            });
            continue;
          }
          const emailHeader = findHeader(headers, 'email');
          const positionHeader = findHeader(headers, 'position');
          const departmentHeader = findHeader(headers, 'department');
          const admissionDateHeader = findHeader(headers, 'admissionDate');
          const baseSalaryHeader = findHeader(headers, 'baseSalary');
          const hourlyRateHeader = findHeader(headers, 'hourlyRate');
          const weeklyHoursHeader = findHeader(headers, 'weeklyHours');

          const data: any = {
            companyId: params.companyId,
            fullName,
            cpf,
            rg: rgHeader ? row[rgHeader] : undefined,
            email: emailHeader ? row[emailHeader] : undefined,
            position: positionHeader ? row[positionHeader] : 'Colaborador',
            department: departmentHeader ? row[departmentHeader] : 'geral',
            admissionDate: admissionDateHeader ? parseDate(row[admissionDateHeader]) : undefined,
            salaryType: hourlyRateHeader ? 'hourly' : 'monthly',
            baseSalary: baseSalaryHeader ? parseNumber(row[baseSalaryHeader]) : undefined,
            hourlyRate: hourlyRateHeader ? parseNumber(row[hourlyRateHeader]) : undefined,
            weeklyHours: weeklyHoursHeader ? parseNumber(row[weeklyHoursHeader]) : undefined,
            status: 'active'
          };

          await this.prisma.employee.upsert({
            where: { cpf },
            update: data,
            create: data
          });

          processedRows += 1;
          await this.prisma.importItem.create({
            data: {
              batchId: batch.id,
              sheet: sheetName,
              rowNumber,
              status: 'ok',
              message: 'Funcionario importado'
            }
          });

          continue;
        }
        if (sheetLower.includes('tab auxilio')) {
          const dependentHeader = findHeader(headers, 'dependentDeduction');

          const inssMinHeader = headers.find((header) => normalizeText(header) === 'de');
          const inssMaxHeader = headers.find((header) => normalizeText(header) === 'ate');
          const inssRateHeader = headers.find((header) => normalizeText(header) === 'aliquota');
          const inssDeductionHeader = headers.find((header) => normalizeText(header) === 'deduzir');

          const irrfMinHeader = headers.find((header) => normalizeText(header) === 'de_2');
          const irrfMaxHeader = headers.find((header) => normalizeText(header) === 'ate_2');
          const irrfRateHeader = headers.find((header) => normalizeText(header) === 'aliquota_2');
          const irrfDeductionHeader = headers.find((header) => normalizeText(header) === 'deduzir_2');

          const dependentDeduction = dependentHeader ? parseNumber(row[dependentHeader]) : null;

          let inserted = false;

          const inssMinValue = inssMinHeader ? parseNumber(row[inssMinHeader]) : null;
          const inssMaxValue = inssMaxHeader ? parseNumber(row[inssMaxHeader]) : null;
          const inssRate = inssRateHeader ? parseNumber(row[inssRateHeader]) : null;
          const inssDeduction = inssDeductionHeader ? parseNumber(row[inssDeductionHeader]) : null;

          if (inssMinValue !== null && inssMaxValue !== null && inssRate !== null && inssDeduction !== null) {
            await this.prisma.taxTableInss.upsert({
              where: {
                companyId_month_year_minValue: {
                  companyId: params.companyId,
                  month: competency.month,
                  year: competency.year,
                  minValue: inssMinValue
                }
              },
              update: {
                maxValue: inssMaxValue,
                rate: inssRate,
                deduction: inssDeduction
              },
              create: {
                companyId: params.companyId,
                month: competency.month,
                year: competency.year,
                minValue: inssMinValue,
                maxValue: inssMaxValue,
                rate: inssRate,
                deduction: inssDeduction
              }
            });
            inserted = true;
          }

          const irrfMinValue = irrfMinHeader ? parseNumber(row[irrfMinHeader]) : null;
          const irrfMaxValue = irrfMaxHeader ? parseNumber(row[irrfMaxHeader]) : null;
          const irrfRate = irrfRateHeader ? parseNumber(row[irrfRateHeader]) : null;
          const irrfDeduction = irrfDeductionHeader ? parseNumber(row[irrfDeductionHeader]) : null;

          if (irrfMinValue !== null && irrfMaxValue !== null && irrfRate !== null && irrfDeduction !== null) {
            await this.prisma.taxTableIrrf.upsert({
              where: {
                companyId_month_year_minValue: {
                  companyId: params.companyId,
                  month: competency.month,
                  year: competency.year,
                  minValue: irrfMinValue
                }
              },
              update: {
                maxValue: irrfMaxValue,
                rate: irrfRate,
                deduction: irrfDeduction,
                dependentDeduction: dependentDeduction ?? 0
              },
              create: {
                companyId: params.companyId,
                month: competency.month,
                year: competency.year,
                minValue: irrfMinValue,
                maxValue: irrfMaxValue,
                rate: irrfRate,
                deduction: irrfDeduction,
                dependentDeduction: dependentDeduction ?? 0
              }
            });
            inserted = true;
          }

          if (inserted) {
            processedRows += 1;
          }

          continue;
        }

        if (sheetLower.includes('quantidade de aula')) {
          const cpfRaw = cpfHeader ? row[cpfHeader] : undefined;
          const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';
          const fullNameRaw = nameHeader ? row[nameHeader] : undefined;
          const fullName = fullNameRaw ? String(fullNameRaw).trim() : '';
          const weeklyHoursHeader = findHeader(headers, 'weeklyHours');
          const hourlyRateHeader = findHeader(headers, 'hourlyRate');
          const grossHeader = findHeader(headers, 'grossSalary');

          const weeklyHours = weeklyHoursHeader ? parseNumber(row[weeklyHoursHeader]) : null;
          const hourlyRate = hourlyRateHeader ? parseNumber(row[hourlyRateHeader]) : null;
          const grossSalary = grossHeader ? parseNumber(row[grossHeader]) : null;

          if (!cpf && !fullName) continue;

          const employee = cpf
            ? await this.prisma.employee.findUnique({ where: { cpf } })
            : await this.prisma.employee.findFirst({
                where: { companyId: params.companyId, fullName }
              });

          if (!employee) {
            failedRows += 1;
            const lookupText = cpf ? `CPF ${cpf}` : `nome ${fullName}`;
            errors.push(`Planilha ${sheetName} linha ${rowNumber}: funcionario nao encontrado para ${lookupText}`);
            await this.prisma.importItem.create({
              data: {
                batchId: batch.id,
                sheet: sheetName,
                rowNumber,
                status: 'error',
                message: 'Funcionario nao encontrado'
              }
            });
            continue;
          }

          await this.prisma.employee.update({
            where: { id: employee.id },
            data: {
              weeklyHours: weeklyHours ?? employee.weeklyHours,
              hourlyRate: hourlyRate ?? employee.hourlyRate,
              baseSalary: grossSalary ?? employee.baseSalary
            }
          });

          processedRows += 1;
          continue;
        }

        if (sheetLower.includes('folha de pagto') || sheetLower.includes('folha de pagamento')) {
          if (!payrollSheetChecked) {
            payrollSheetChecked = true;
            const closedRun = await this.prisma.payrollRun.findFirst({
              where: {
                companyId: params.companyId,
                month: competency.month,
                year: competency.year,
                status: 'closed'
              }
            });

            if (closedRun) {
              failedRows += 1;
              const message = `Competencia ${competency.month}/${competency.year} ja fechada`;
              errors.push(`Planilha ${sheetName}: ${message}`);
              await this.prisma.importItem.create({
                data: {
                  batchId: batch.id,
                  sheet: sheetName,
                  rowNumber: 0,
                  status: 'error',
                  message
                }
              });
              await this.prisma.importBatch.update({
                where: { id: batch.id },
                data: {
                  status: 'failed',
                  processedRows,
                  failedRows
                }
              });
              throw new ConflictException({
                statusCode: 409,
                error: 'Conflict',
                message: 'Competencia fechada. Importacao de folha bloqueada.',
                code: 'PAYROLL_COMPETENCE_CLOSED',
                details: { payrollRunId: closedRun.id, month: competency.month, year: competency.year }
              });
            }
          }

          const cpfRaw = cpfHeader ? row[cpfHeader] : undefined;
          const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, '') : '';
          const fullName = nameHeader ? row[nameHeader] : undefined;

          if (!cpf && !fullName) {
            continue;
          }

          const employee = cpf
            ? await this.prisma.employee.findUnique({ where: { cpf } })
            : await this.prisma.employee.findFirst({
                where: { companyId: params.companyId, fullName: String(fullName) }
              });

          if (!employee) {
            failedRows += 1;
            errors.push(`Planilha ${sheetName} linha ${rowNumber}: funcionario nao encontrado`);
            await this.prisma.importItem.create({
              data: {
                batchId: batch.id,
                sheet: sheetName,
                rowNumber,
                status: 'error',
                message: 'Funcionario nao encontrado'
              }
            });
            continue;
          }

          const payrollRun = await this.prisma.payrollRun.upsert({
            where: {
              companyId_month_year_version: {
                companyId: params.companyId,
                month: competency.month,
                year: competency.year,
                version: 1
              }
            },
            update: {},
            create: {
              companyId: params.companyId,
              month: competency.month,
              year: competency.year
            }
          });

          const earnings: { code: string; description: string; amount: number }[] = [];
          const deductions: { code: string; description: string; amount: number }[] = [];

          for (const header of headers) {
            const mapping = findRubricMapping(header);
            if (!mapping) continue;
            const info = mapping[1];
            const amount = parseNumber(row[header]);
            if (amount === null || amount === 0) continue;

            const normalizedAmount = info.type === 'deduction' ? Math.abs(amount) : amount;
            const entry = {
              code: info.code,
              description: header,
              amount: normalizedAmount
            };

            if (info.type === 'earning') {
              earnings.push(entry);
            } else {
              deductions.push(entry);
            }
          }

          const grossHeader = findHeader(headers, 'grossSalary');
          const netHeader = findHeader(headers, 'netSalary');
          const deductionsHeader = headers.find((header) => {
            const normalized = normalizeText(header);
            return normalized.includes('desconto') || normalized.includes('deducao');
          });

          const grossSalary = grossHeader ? parseNumber(row[grossHeader]) : null;
          const totalDeductions = deductionsHeader ? parseNumber(row[deductionsHeader]) : null;
          const netSalary = netHeader ? parseNumber(row[netHeader]) : null;

          const gross = grossSalary ?? earnings.reduce((acc, item) => acc + item.amount, 0);
          const deductionsSum = totalDeductions !== null ? Math.abs(totalDeductions) : deductions.reduce((acc, item) => acc + Math.abs(item.amount), 0);
          const net = netSalary ?? gross - deductionsSum;
          const fgts = gross * 0.08;

          const payrollResult = await this.prisma.payrollResult.upsert({
            where: {
              payrollRunId_employeeId: {
                payrollRunId: payrollRun.id,
                employeeId: employee.id
              }
            },
            update: {
              grossSalary: gross,
              totalDeductions: deductionsSum,
              netSalary: net,
              fgts
            },
            create: {
              payrollRunId: payrollRun.id,
              employeeId: employee.id,
              grossSalary: gross,
              totalDeductions: deductionsSum,
              netSalary: net,
              fgts
            }
          });

          await this.prisma.payrollEvent.deleteMany({
            where: { payrollResultId: payrollResult.id }
          });

          for (const item of earnings) {
            await this.prisma.payrollEvent.create({
              data: {
                payrollResultId: payrollResult.id,
                code: item.code,
                description: item.description,
                type: 'earning',
                amount: item.amount
              }
            });
          }

          for (const item of deductions) {
            await this.prisma.payrollEvent.create({
              data: {
                payrollResultId: payrollResult.id,
                code: item.code,
                description: item.description,
                type: 'deduction',
                amount: item.amount
              }
            });
          }

          processedRows += 1;
          continue;
        }

        processedRows += 1;
      }
    }

    const updatedBatch = await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        processedRows,
        failedRows
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'import',
      entity: 'excel',
      entityId: batch.id,
      after: { processedRows, failedRows }
    });

    return {
      batchId: updatedBatch.id,
      success: failedRows === 0,
      message: failedRows === 0 ? 'Importacao concluida' : 'Importacao concluida com erros',
      processedRows,
      failedRows,
      errors
    };
  }
}




















