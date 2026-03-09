import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';

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
  pis: ['pis'],
  ctps: ['ctps', 'carteira de trabalho'],
  ctpsNumber: ['ctps numero', 'numero ctps', 'ctps n', 'carteira trabalho numero'],
  ctpsSeries: ['ctps serie', 'serie ctps', 'carteira trabalho serie'],
  ctpsState: ['ctps uf', 'uf ctps'],
  rgIssuer: ['orgao emissor', 'rg orgao emissor', 'emissor rg'],
  rgIssuerState: ['rg uf', 'uf rg'],
  rgIssueDate: ['data emissao rg', 'rg emissao', 'emissao rg'],
  socialName: ['nome social'],
  gender: ['sexo', 'genero'],
  raceColor: ['raca cor', 'raca/cor', 'cor'],
  maritalStatus: ['estado civil'],
  educationLevel: ['grau instrucao', 'escolaridade', 'instrucao'],
  nationalityCode: ['pais nacionalidade', 'nacionalidade', 'cod pais nacionalidade'],
  birthCountryCode: ['pais nascimento', 'cod pais nascimento'],
  birthState: ['uf nascimento', 'estado nascimento'],
  birthCityCode: ['municipio nascimento ibge', 'cod municipio nascimento'],
  cityCode: ['municipio ibge', 'cod municipio', 'codigo municipio ibge'],
  esocialCategoryCode: ['cod categoria esocial', 'categoria esocial', 'cod categ'],
  esocialRegistrationType: ['tipo regime trabalhista', 'tp reg trab', 'tipo regime trab'],
  esocialRegimeType: ['tipo regime previdenciario', 'tp reg prev', 'regime previdenciario'],
  esocialAdmissionType: ['tipo admissao esocial', 'tp admissao', 'tipo admissao'],
  esocialAdmissionIndicator: ['indicativo admissao', 'ind admissao'],
  esocialActivityNature: ['natureza atividade', 'nat atividade'],
  esocialUnionCnpj: ['cnpj sindicato', 'sindicato categoria'],
  esocialSalaryUnit: ['unidade salario fixo', 'und salario fixo', 'und sal fixo'],
  esocialContractType: ['tipo contrato esocial', 'tp contrato', 'tipo contrato'],
  esocialContractEndDate: ['data termino contrato', 'dt termino contrato', 'fim contrato'],
  esocialWeeklyHours: ['horas semanais esocial', 'qtd hrs sem', 'qtd horas semanais'],
  esocialWorkSchedule: ['descricao jornada', 'jornada descricao', 'horario contratual'],
  esocialHasDisability: ['pcd', 'possui deficiencia'],
  esocialDisabilityType: ['tipo deficiencia'],
  email: ['email', 'e-mail'],
  phone: ['telefone', 'celular'],
  birthDate: ['nascimento', 'data de nascimento'],
  motherName: ['nome da mae', 'mae', 'nome da mae'],
  addressLine: ['endereco', 'logradouro'],
  neighborhood: ['bairro'],
  cityState: ['cidade/uf', 'cidade', 'cidade uf'],
  zipCode: ['cep'],
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
const strictRubricAliases = new Set(['salario', 'valor']);

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

export const parseNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value).trim();
  if (!text || text === '-' || normalizeText(text) === 'r$ -') return null;

  const isPercent = text.includes('%');
  const isNegative = /\(.*\)/.test(text) || /^-/.test(text) || /-\s*\d/.test(text);

  let numericText = text
    .replace(/[^\d,.\-()]/g, '')
    .replace(/[()]/g, '')
    .replace(/-/g, '');

  if (!numericText || !/\d/.test(numericText)) return null;

  const dotCount = (numericText.match(/\./g) ?? []).length;
  const commaCount = (numericText.match(/,/g) ?? []).length;
  let decimalSeparator: '.' | ',' | null = null;

  if (dotCount > 0 && commaCount > 0) {
    decimalSeparator = numericText.lastIndexOf('.') > numericText.lastIndexOf(',') ? '.' : ',';
  } else if (dotCount > 0 || commaCount > 0) {
    const separator = dotCount > 0 ? '.' : ',';
    const separatorCount = separator === '.' ? dotCount : commaCount;
    if (separatorCount === 1) {
      const lastIndex = numericText.lastIndexOf(separator);
      const digitsAfter = numericText.length - lastIndex - 1;
      if (digitsAfter > 0 && digitsAfter <= 2) {
        decimalSeparator = separator;
      } else if (isPercent && digitsAfter > 0 && digitsAfter <= 4) {
        decimalSeparator = separator;
      }
    }
  }

  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';
    numericText = numericText.split(thousandsSeparator).join('');

    if (decimalSeparator === ',') {
      const lastComma = numericText.lastIndexOf(',');
      numericText =
        numericText.slice(0, lastComma).replace(/,/g, '') +
        '.' +
        numericText.slice(lastComma + 1);
    }
  } else {
    numericText = numericText.replace(/[.,]/g, '');
  }

  const parsed = Number(numericText.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed)) return null;

  const withSignal = isNegative ? -Math.abs(parsed) : parsed;

  if (isPercent) {
    return withSignal / 100;
  }

  return withSignal;
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

  if (strictRubricAliases.has(normalizedAlias)) {
    return normalizedHeader === normalizedAlias;
  }

  if (normalizedHeader === normalizedAlias) return true;

  if (!normalizedHeader.includes(normalizedAlias)) return false;

  if (normalizedAlias.length <= 3) {
    const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tokenRegex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    return tokenRegex.test(normalizedHeader);
  }

  return true;
};

export const findRubricMapping = (header: string) => {
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

const parseBoolean = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = normalizeText(value);
  if (['1', 'sim', 's', 'true', 't', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'nao', 'n', 'false', 'f', 'no'].includes(normalized)) return false;
  return null;
};

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
    for (const [name, value] of Object.entries(monthNames)) {
      if (lower.includes(name)) {
        month = value;
        break;
      }
    }
  }

  if (!month && /\b13\b/.test(lower)) {
    month = 12;
  }

  return {
    month: month ?? new Date().getMonth() + 1,
    year: year ?? new Date().getFullYear()
  };
};

const splitCityState = (value: any) => {
  const raw = String(value ?? '').trim();
  if (!raw) return { city: undefined, state: undefined };

  const bySlash = raw.split('/').map((item) => item.trim()).filter(Boolean);
  if (bySlash.length >= 2) {
    return { city: bySlash[0], state: bySlash[1].toUpperCase() };
  }

  const byDash = raw.split('-').map((item) => item.trim()).filter(Boolean);
  if (byDash.length >= 2) {
    return { city: byDash[0], state: byDash[1].toUpperCase() };
  }

  return { city: raw, state: undefined };
};

const inferDepartmentFromCompanyLabel = (value: any) => {
  const label = normalizeText(value);
  if (!label) return 'geral';
  if (label.includes('recreacao')) return 'recreacao';
  if (label.includes('centro educacional')) return 'centro_educacional';
  return 'geral';
};

const getProfilePriority = (profile: SheetProfile) => {
  if (profile === 'cadastro') return 0;
  if (profile === 'tab_auxilio') return 1;
  if (profile === 'quantidade_aula') return 2;
  if (profile === 'folha') return 3;
  return 4;
};

const isNonEmployeeRowLabel = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return true;

  const blockedKeywords = [
    'total',
    'totalizador',
    'total (',
    'salario bruto total',
    'salario brutos totais',
    'salario liquido total',
    'salario liquidos totais',
    'inss centro',
    'inss recreacao',
    'irpf centro',
    'irpf recreacao',
    'vale transporte',
    'vale alimentacao',
    'folha de pagamento'
  ];

  return blockedKeywords.some((keyword) => normalized.includes(keyword));
};

const isTemporaryEmployeeCode = (value: any) => String(value ?? '').startsWith('TMP-AUTO-');

const buildTemporaryCpf = (params: {
  companyId: string;
  fullName: string;
  usedCpfs: Set<string>;
}) => {
  const normalizedName = normalizeText(params.fullName);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const hash = createHash('sha1')
      .update(`${params.companyId}:${normalizedName}:${attempt}`)
      .digest('hex');

    const digits = hash
      .split('')
      .map((char) => String(Number.parseInt(char, 16) % 10))
      .join('');

    const cpf = `9${digits.slice(0, 10)}`;
    if (!params.usedCpfs.has(cpf)) {
      return cpf;
    }
  }

  throw new Error(`Nao foi possivel gerar CPF temporario para ${params.fullName}`);
};

const getTargetMonthTokens = (month: number) => {
  const monthTokenMap: Record<number, string[]> = {
    1: ['janeiro', 'jan'],
    2: ['fevereiro', 'fev'],
    3: ['marco', 'mar'],
    4: ['abril', 'abr'],
    5: ['maio', 'mai'],
    6: ['junho', 'jun'],
    7: ['julho', 'jul'],
    8: ['agosto', 'ago'],
    9: ['setembro', 'set'],
    10: ['outubro', 'out'],
    11: ['novembro', 'nov'],
    12: ['dezembro', 'dez']
  };

  return monthTokenMap[month] ?? [];
};

const isTargetPayrollSheet = (sheetName: string, target: { month: number; year: number }) => {
  const lower = normalizeText(sheetName);
  const monthTokens = getTargetMonthTokens(target.month);
  const monthNumber = String(target.month).padStart(2, '0');
  const yearShort = String(target.year).slice(-2);

  const hasYear = lower.includes(String(target.year)) || lower.includes(yearShort);
  const hasMonthToken = monthTokens.some((token) => lower.includes(token));
  const hasCompactToken = lower.includes(`${monthNumber}${yearShort}`) || lower.includes(`${monthNumber}/${yearShort}`);

  return hasMonthToken || (hasYear && hasCompactToken);
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
    const warnings: string[] = [];
    const importedRunIds = new Set<string>();
    let processedRows = 0;
    let failedRows = 0;

    const sanitizeCpf = (value: any) => String(value ?? '').replace(/\D/g, '');
    const normalizeEmployeeName = (value: any) => String(value ?? '').trim().replace(/\s+/g, ' ');

    const targetCompetency = inferCompetency('', params.fileName);
    const existingEmployees = await this.prisma.employee.findMany({
      where: { companyId: params.companyId },
      select: {
        id: true,
        companyId: true,
        fullName: true,
        cpf: true,
        rg: true,
        email: true,
        phone: true,
        birthDate: true,
        motherName: true,
        addressLine: true,
        city: true,
        state: true,
        zipCode: true,
        admissionDate: true,
        pis: true,
        ctps: true,
        position: true,
        department: true,
        salaryType: true,
        baseSalary: true,
        hourlyRate: true,
        weeklyHours: true,
        status: true
      }
    });

    type CachedEmployee = (typeof existingEmployees)[number];
    const employeesByCpf = new Map<string, CachedEmployee>();
    const employeesByName = new Map<string, CachedEmployee>();
    const usedCpfs = new Set<string>();

    const upsertCache = (employee: CachedEmployee) => {
      employeesByCpf.set(employee.cpf, employee);
      employeesByName.set(normalizeText(employee.fullName), employee);
      usedCpfs.add(employee.cpf);
    };

    existingEmployees.forEach(upsertCache);

    const findEmployeeInCache = (input: { cpf?: string; fullName?: string }) => {
      const cpf = sanitizeCpf(input.cpf);
      if (cpf) {
        const byCpf = employeesByCpf.get(cpf);
        if (byCpf) return byCpf;
      }

      const normalizedName = normalizeText(normalizeEmployeeName(input.fullName));
      if (!normalizedName) return undefined;
      return employeesByName.get(normalizedName);
    };

    const deactivateTemporaryNonEmployee = async (fullName: string, sheetName: string, rowNumber: number) => {
      const normalizedName = normalizeText(fullName);
      const cached = employeesByName.get(normalizedName);
      if (!cached || !isTemporaryEmployeeCode(cached.cpf)) return;

      const updated = await this.prisma.employee.update({
        where: { id: cached.id },
        data: { status: 'inactive' }
      });

      upsertCache(updated);
      warnings.push(`Aba ${sheetName} linha ${rowNumber}: registro nao-funcionario "${fullName}" foi desativado automaticamente.`);
    };

    const orderedSheetNames = [...workbook.SheetNames].sort((left, right) => {
      const leftProfile = getSheetProfile(normalizeText(left));
      const rightProfile = getSheetProfile(normalizeText(right));
      const profileOrder = getProfilePriority(leftProfile) - getProfilePriority(rightProfile);
      if (profileOrder !== 0) return profileOrder;

      if (leftProfile === 'folha') {
        const leftIsTarget = isTargetPayrollSheet(left, targetCompetency);
        const rightIsTarget = isTargetPayrollSheet(right, targetCompetency);
        if (leftIsTarget !== rightIsTarget) {
          return leftIsTarget ? -1 : 1;
        }
      }

      return left.localeCompare(right);
    });

    for (const sheetName of orderedSheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const sheetLower = normalizeText(sheetName);
      const profile = getSheetProfile(sheetLower);
      if (profile === 'generic') continue;

      if (profile === 'folha' && !isTargetPayrollSheet(sheetName, targetCompetency)) {
        warnings.push(`Aba "${sheetName}" ignorada por nao corresponder a competencia alvo ${targetCompetency.month}/${targetCompetency.year}.`);
        continue;
      }

      const { rows, headers, rowOffset } = readSheetRows(sheet, profile);
      if (!rows.length || !headers.length) continue;

      const competency = profile === 'folha' || profile === 'tab_auxilio'
        ? targetCompetency
        : inferCompetency(sheetName, params.fileName);

      const nameHeader = findHeader(headers, 'fullName');
      const cpfHeader = findHeader(headers, 'cpf');
      const rgHeader = findHeader(headers, 'rg');

      const emailHeader = findHeader(headers, 'email');
      const phoneHeader = findHeader(headers, 'phone');
      const birthDateHeader = findHeader(headers, 'birthDate');
      const motherNameHeader = findHeader(headers, 'motherName');
      const socialNameHeader = findHeader(headers, 'socialName');
      const genderHeader = findHeader(headers, 'gender');
      const raceColorHeader = findHeader(headers, 'raceColor');
      const maritalStatusHeader = findHeader(headers, 'maritalStatus');
      const educationLevelHeader = findHeader(headers, 'educationLevel');
      const nationalityCodeHeader = findHeader(headers, 'nationalityCode');
      const birthCountryCodeHeader = findHeader(headers, 'birthCountryCode');
      const birthStateHeader = findHeader(headers, 'birthState');
      const birthCityCodeHeader = findHeader(headers, 'birthCityCode');
      const addressLineHeader = findHeader(headers, 'addressLine');
      const cityStateHeader = findHeader(headers, 'cityState');
      const zipCodeHeader = findHeader(headers, 'zipCode');
      const cityCodeHeader = findHeader(headers, 'cityCode');
      const pisHeader = findHeader(headers, 'pis');
      const ctpsHeader = findHeader(headers, 'ctps');
      const ctpsNumberHeader = findHeader(headers, 'ctpsNumber');
      const ctpsSeriesHeader = findHeader(headers, 'ctpsSeries');
      const ctpsStateHeader = findHeader(headers, 'ctpsState');
      const rgIssuerHeader = findHeader(headers, 'rgIssuer');
      const rgIssuerStateHeader = findHeader(headers, 'rgIssuerState');
      const rgIssueDateHeader = findHeader(headers, 'rgIssueDate');
      const positionHeader = findHeader(headers, 'position');
      const departmentHeader = findHeader(headers, 'department');
      const admissionDateHeader = findHeader(headers, 'admissionDate');
      const esocialCategoryCodeHeader = findHeader(headers, 'esocialCategoryCode');
      const esocialRegistrationTypeHeader = findHeader(headers, 'esocialRegistrationType');
      const esocialRegimeTypeHeader = findHeader(headers, 'esocialRegimeType');
      const esocialAdmissionTypeHeader = findHeader(headers, 'esocialAdmissionType');
      const esocialAdmissionIndicatorHeader = findHeader(headers, 'esocialAdmissionIndicator');
      const esocialActivityNatureHeader = findHeader(headers, 'esocialActivityNature');
      const esocialUnionCnpjHeader = findHeader(headers, 'esocialUnionCnpj');
      const esocialSalaryUnitHeader = findHeader(headers, 'esocialSalaryUnit');
      const esocialContractTypeHeader = findHeader(headers, 'esocialContractType');
      const esocialContractEndDateHeader = findHeader(headers, 'esocialContractEndDate');
      const esocialWeeklyHoursHeader = findHeader(headers, 'esocialWeeklyHours');
      const esocialWorkScheduleHeader = findHeader(headers, 'esocialWorkSchedule');
      const esocialHasDisabilityHeader = findHeader(headers, 'esocialHasDisability');
      const esocialDisabilityTypeHeader = findHeader(headers, 'esocialDisabilityType');
      const baseSalaryHeader = findHeader(headers, 'baseSalary');
      const hourlyRateHeader = findHeader(headers, 'hourlyRate');
      const weeklyHoursHeader = findHeader(headers, 'weeklyHours');

      const grossHeader = findHeader(headers, 'grossSalary');
      const netHeader = findHeader(headers, 'netSalary');
      const deductionsHeader = headers.find((header) => {
        const normalized = normalizeText(header);
        return normalized.includes('desconto') || normalized.includes('deducao');
      });
      const companyHeader = headers.find((header) => normalizeText(header).includes('empresa'));

      const inssMinHeader = headers.find((header) => normalizeText(header) === 'de');
      const inssMaxHeader = headers.find((header) => normalizeText(header) === 'ate');
      const inssRateHeader = headers.find((header) => normalizeText(header) === 'aliquota');
      const inssDeductionHeader = headers.find((header) => normalizeText(header) === 'deduzir');
      const irrfMinHeader = headers.find((header) => normalizeText(header) === 'de_2');
      const irrfMaxHeader = headers.find((header) => normalizeText(header) === 'ate_2');
      const irrfRateHeader = headers.find((header) => normalizeText(header) === 'aliquota_2');
      const irrfDeductionHeader = headers.find((header) => normalizeText(header) === 'deduzir_2');
      const dependentHeader = findHeader(headers, 'dependentDeduction');

      let payrollRunId: string | undefined;
      if (profile === 'folha') {
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

        payrollRunId = payrollRun.id;
        importedRunIds.add(payrollRun.id);

        const existingRunResults = await this.prisma.payrollResult.findMany({
          where: { payrollRunId: payrollRun.id },
          select: { id: true }
        });

        if (existingRunResults.length > 0) {
          await this.prisma.$transaction([
            this.prisma.payrollEvent.deleteMany({
              where: {
                payrollResultId: { in: existingRunResults.map((item) => item.id) }
              }
            }),
            this.prisma.payrollResult.deleteMany({
              where: { payrollRunId: payrollRun.id }
            })
          ]);

          warnings.push(`Competencia ${competency.month}/${competency.year}: resultados anteriores removidos para reimportacao completa.`);
        }
      }

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

        if (profile === 'cadastro') {
          const fullName = nameHeader ? normalizeEmployeeName(row[nameHeader]) : '';
          if (!fullName) continue;

          const rawCpf = cpfHeader ? sanitizeCpf(row[cpfHeader]) : '';
          let cpf = rawCpf.length === 11 ? rawCpf : '';
          if (!cpf) {
            cpf = buildTemporaryCpf({
              companyId: params.companyId,
              fullName,
              usedCpfs
            });
            warnings.push(`Cadastro ${sheetName} linha ${rowNumber}: CPF ausente/invalido para "${fullName}". CPF temporario gerado.`);
          }

          const { city, state } = splitCityState(cityStateHeader ? row[cityStateHeader] : undefined);
          const hourlyRate = hourlyRateHeader ? parseNumber(row[hourlyRateHeader]) : null;
          const baseSalary = baseSalaryHeader ? parseNumber(row[baseSalaryHeader]) : null;
          const weeklyHours = weeklyHoursHeader ? parseNumber(row[weeklyHoursHeader]) : null;
          const existingByCpf = employeesByCpf.get(cpf);
          const existingByName = employeesByName.get(normalizeText(fullName));
          const shouldReuseByName = !!existingByName && (!rawCpf || isTemporaryEmployeeCode(existingByName.cpf));
          const existingEmployee = existingByCpf ?? (shouldReuseByName ? existingByName : undefined);

          const employeeData: any = {
            fullName,
            cpf,
            rg: rgHeader ? String(row[rgHeader] || '').trim() || null : null,
            rgIssuer: rgIssuerHeader ? String(row[rgIssuerHeader] || '').trim() || null : null,
            rgIssuerState: rgIssuerStateHeader ? String(row[rgIssuerStateHeader] || '').trim() || null : null,
            rgIssueDate: rgIssueDateHeader ? parseDate(row[rgIssueDateHeader]) ?? null : null,
            email: emailHeader ? String(row[emailHeader] || '').trim() || null : null,
            phone: phoneHeader ? String(row[phoneHeader] || '').trim() || null : null,
            birthDate: birthDateHeader ? parseDate(row[birthDateHeader]) ?? null : null,
            motherName: motherNameHeader ? String(row[motherNameHeader] || '').trim() || null : null,
            socialName: socialNameHeader ? String(row[socialNameHeader] || '').trim() || null : null,
            gender: genderHeader ? String(row[genderHeader] || '').trim() || null : null,
            raceColor: raceColorHeader ? String(row[raceColorHeader] || '').trim() || null : null,
            maritalStatus: maritalStatusHeader ? String(row[maritalStatusHeader] || '').trim() || null : null,
            educationLevel: educationLevelHeader ? String(row[educationLevelHeader] || '').trim() || null : null,
            nationalityCode: nationalityCodeHeader ? String(row[nationalityCodeHeader] || '').trim() || null : null,
            birthCountryCode: birthCountryCodeHeader ? String(row[birthCountryCodeHeader] || '').trim() || null : null,
            birthState: birthStateHeader ? String(row[birthStateHeader] || '').trim() || null : null,
            birthCityCode: birthCityCodeHeader ? String(row[birthCityCodeHeader] || '').trim() || null : null,
            addressLine: addressLineHeader ? String(row[addressLineHeader] || '').trim() || null : null,
            city: city ?? null,
            state: state ?? null,
            zipCode: zipCodeHeader ? String(row[zipCodeHeader] || '').trim() || null : null,
            cityCode: cityCodeHeader ? String(row[cityCodeHeader] || '').trim() || null : null,
            admissionDate: admissionDateHeader ? parseDate(row[admissionDateHeader]) ?? null : null,
            pis: pisHeader ? String(row[pisHeader] || '').trim() || null : null,
            ctps: ctpsHeader ? String(row[ctpsHeader] || '').trim() || null : null,
            ctpsNumber: ctpsNumberHeader ? String(row[ctpsNumberHeader] || '').trim() || null : null,
            ctpsSeries: ctpsSeriesHeader ? String(row[ctpsSeriesHeader] || '').trim() || null : null,
            ctpsState: ctpsStateHeader ? String(row[ctpsStateHeader] || '').trim() || null : null,
            esocialCategoryCode: esocialCategoryCodeHeader ? String(row[esocialCategoryCodeHeader] || '').trim() || null : null,
            esocialRegistrationType: esocialRegistrationTypeHeader ? String(row[esocialRegistrationTypeHeader] || '').trim() || null : null,
            esocialRegimeType: esocialRegimeTypeHeader ? String(row[esocialRegimeTypeHeader] || '').trim() || null : null,
            esocialAdmissionType: esocialAdmissionTypeHeader ? String(row[esocialAdmissionTypeHeader] || '').trim() || null : null,
            esocialAdmissionIndicator: esocialAdmissionIndicatorHeader ? String(row[esocialAdmissionIndicatorHeader] || '').trim() || null : null,
            esocialActivityNature: esocialActivityNatureHeader ? String(row[esocialActivityNatureHeader] || '').trim() || null : null,
            esocialUnionCnpj: esocialUnionCnpjHeader ? String(row[esocialUnionCnpjHeader] || '').trim() || null : null,
            esocialSalaryUnit: esocialSalaryUnitHeader ? String(row[esocialSalaryUnitHeader] || '').trim() || null : null,
            esocialContractType: esocialContractTypeHeader ? String(row[esocialContractTypeHeader] || '').trim() || null : null,
            esocialContractEndDate: esocialContractEndDateHeader ? parseDate(row[esocialContractEndDateHeader]) ?? null : null,
            esocialWeeklyHours: esocialWeeklyHoursHeader ? parseNumber(row[esocialWeeklyHoursHeader]) : null,
            esocialWorkSchedule: esocialWorkScheduleHeader ? String(row[esocialWorkScheduleHeader] || '').trim() || null : null,
            esocialHasDisability: esocialHasDisabilityHeader ? parseBoolean(row[esocialHasDisabilityHeader]) : null,
            esocialDisabilityType: esocialDisabilityTypeHeader ? String(row[esocialDisabilityTypeHeader] || '').trim() || null : null,
            position: positionHeader ? String(row[positionHeader] || '').trim() || 'Colaborador' : 'Colaborador',
            department: departmentHeader ? String(row[departmentHeader] || '').trim() || 'geral' : 'geral',
            salaryType: hourlyRate ? 'hourly' : 'monthly',
            baseSalary,
            hourlyRate,
            weeklyHours,
            status: 'active'
          };

          try {
            const saved = existingEmployee
              ? await this.prisma.employee.update({
                  where: { id: existingEmployee.id },
                  data: employeeData
                })
              : await this.prisma.employee.create({
                  data: {
                    companyId: params.companyId,
                    ...employeeData
                  }
                });

            upsertCache(saved);
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
          } catch {
            failedRows += 1;
            errors.push(`Planilha ${sheetName} linha ${rowNumber}: falha ao importar funcionario "${fullName}"`);
            await this.prisma.importItem.create({
              data: {
                batchId: batch.id,
                sheet: sheetName,
                rowNumber,
                status: 'error',
                message: 'Falha ao importar funcionario'
              }
            });
          }

          continue;
        }

        if (profile === 'tab_auxilio') {
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

        if (profile === 'quantidade_aula') {
          const fullName = nameHeader ? normalizeEmployeeName(row[nameHeader]) : '';
          const cpf = cpfHeader ? sanitizeCpf(row[cpfHeader]) : '';
          if (!fullName && !cpf) continue;
          if (fullName && isNonEmployeeRowLabel(fullName)) {
            await deactivateTemporaryNonEmployee(fullName, sheetName, rowNumber);
            continue;
          }

          let employee = findEmployeeInCache({ cpf, fullName });
          if (!employee && fullName) {
            const temporaryCpf = buildTemporaryCpf({
              companyId: params.companyId,
              fullName,
              usedCpfs
            });

            const created = await this.prisma.employee.create({
              data: {
                companyId: params.companyId,
                fullName,
                cpf: temporaryCpf,
                position: 'Professor',
                department: 'pedagogico',
                salaryType: 'monthly',
                status: 'active'
              }
            });

            upsertCache(created);
            employee = created;
            warnings.push(`Aba ${sheetName} linha ${rowNumber}: funcionario "${fullName}" criado automaticamente com CPF temporario.`);
          }

          if (!employee) continue;

          const weeklyHours = weeklyHoursHeader ? parseNumber(row[weeklyHoursHeader]) : null;
          const hourlyRate = hourlyRateHeader ? parseNumber(row[hourlyRateHeader]) : null;
          const grossSalary = grossHeader ? parseNumber(row[grossHeader]) : null;
          const position = positionHeader ? String(row[positionHeader] || '').trim() : '';
          const hasProfessorLabel = normalizeText(position).includes('professor');

          const updated = await this.prisma.employee.update({
            where: { id: employee.id },
            data: {
              position: position || employee.position,
              department: hasProfessorLabel ? 'pedagogico' : employee.department,
              salaryType: hourlyRate ? 'hourly' : employee.salaryType,
              weeklyHours: weeklyHours ?? employee.weeklyHours,
              hourlyRate: hourlyRate ?? employee.hourlyRate,
              baseSalary: grossSalary ?? employee.baseSalary,
              status: 'active'
            }
          });

          upsertCache(updated);
          processedRows += 1;
          continue;
        }

        if (profile === 'folha') {
          const fullName = nameHeader ? normalizeEmployeeName(row[nameHeader]) : '';
          const cpf = cpfHeader ? sanitizeCpf(row[cpfHeader]) : '';
          if (!fullName && !cpf) continue;
          if (fullName && isNonEmployeeRowLabel(fullName)) {
            await deactivateTemporaryNonEmployee(fullName, sheetName, rowNumber);
            continue;
          }

          let employee = findEmployeeInCache({ cpf, fullName });
          if (!employee && fullName) {
            const temporaryCpf = buildTemporaryCpf({
              companyId: params.companyId,
              fullName,
              usedCpfs
            });
            const departmentFromCompany = companyHeader
              ? inferDepartmentFromCompanyLabel(row[companyHeader])
              : 'geral';

            const created = await this.prisma.employee.create({
              data: {
                companyId: params.companyId,
                fullName,
                cpf: temporaryCpf,
                rg: rgHeader ? String(row[rgHeader] || '').trim() || null : null,
                position: 'Colaborador',
                department: departmentFromCompany,
                salaryType: 'monthly',
                baseSalary: grossHeader ? parseNumber(row[grossHeader]) : null,
                status: 'active'
              }
            });

            upsertCache(created);
            employee = created;
            warnings.push(`Folha ${sheetName} linha ${rowNumber}: funcionario "${fullName}" criado automaticamente com CPF temporario.`);
          }

          if (!employee || !payrollRunId) continue;

          const earnings: { code: string; description: string; amount: number }[] = [];
          const deductions: { code: string; description: string; amount: number }[] = [];

          for (const header of headers) {
            const mapping = findRubricMapping(header);
            if (!mapping) continue;

            const info = mapping[1];
            const amount = parseNumber(row[header]);
            if (amount === null || amount === 0) continue;

            // In this model VA can be informational credit, not payroll deduction.
            const isMealVoucherCredit = info.code === 'VA' && !String(row[header] ?? '').includes('(');
            const normalizedAmount = Math.abs(amount);
            const entry = {
              code: info.code,
              description: header,
              amount: normalizedAmount
            };

            if (info.type === 'earning' || isMealVoucherCredit) {
              earnings.push(entry);
            } else {
              deductions.push(entry);
            }
          }

          const grossSalary = grossHeader ? parseNumber(row[grossHeader]) : null;
          const netSalary = netHeader ? parseNumber(row[netHeader]) : null;
          const explicitDeductions = deductionsHeader ? parseNumber(row[deductionsHeader]) : null;

          const gross = grossSalary ?? earnings.reduce((acc, item) => acc + item.amount, 0);
          const eventDeductions = deductions.reduce((acc, item) => acc + Math.abs(item.amount), 0);
          const deductionsFromNet =
            grossSalary !== null && netSalary !== null
              ? Math.max(grossSalary - netSalary, 0)
              : null;

          const deductionsSum =
            explicitDeductions !== null
              ? Math.abs(explicitDeductions)
              : deductionsFromNet ?? eventDeductions;

          const net = netSalary ?? gross - deductionsSum;
          const hasValues = gross > 0 || net > 0 || earnings.length > 0 || deductions.length > 0;
          if (!hasValues) continue;

          const payrollResult = await this.prisma.payrollResult.upsert({
            where: {
              payrollRunId_employeeId: {
                payrollRunId,
                employeeId: employee.id
              }
            },
            update: {
              grossSalary: gross,
              totalDeductions: deductionsSum,
              netSalary: net,
              fgts: gross * 0.08
            },
            create: {
              payrollRunId,
              employeeId: employee.id,
              grossSalary: gross,
              totalDeductions: deductionsSum,
              netSalary: net,
              fgts: gross * 0.08
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
        }
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

    const guideSummaries = importedRunIds.size
      ? (await Promise.all(Array.from(importedRunIds).map((runId) => this.buildGuideSummaryByRunId(runId)))).filter(Boolean)
      : [];

    return {
      batchId: updatedBatch.id,
      success: failedRows === 0,
      message: failedRows === 0 ? 'Importacao concluida' : 'Importacao concluida com erros',
      processedRows,
      failedRows,
      errors,
      warnings,
      guideSummaries
    };
  }

  private async buildGuideSummaryByRunId(payrollRunId: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({
      where: { id: payrollRunId }
    });

    if (!payrollRun) return null;

    const results = await this.prisma.payrollResult.findMany({
      where: { payrollRunId },
      include: { events: true }
    });

    const sumByCode = (codes: string[]) =>
      results.reduce(
        (total, result) =>
          total +
          result.events
            .filter((event) => codes.includes(event.code))
            .reduce((acc, event) => acc + Math.abs(Number(event.amount)), 0),
        0
      );

    const grossSalary = results.reduce((total, result) => total + Number(result.grossSalary), 0);
    const totalDeductions = results.reduce((total, result) => total + Number(result.totalDeductions), 0);
    const netSalary = results.reduce((total, result) => total + Number(result.netSalary), 0);
    const fgts = results.reduce((total, result) => total + Number(result.fgts), 0);

    return {
      payrollRunId,
      month: payrollRun.month,
      year: payrollRun.year,
      employeesCount: results.length,
      totals: {
        grossSalary,
        totalDeductions,
        netSalary,
        fgts
      },
      guides: {
        inss: sumByCode(['INSS', 'INSS13']),
        irrf: sumByCode(['IRRF', 'IRRF13']),
        fgts,
        transportVoucher: sumByCode(['VT']),
        mealVoucher: sumByCode(['VA']),
        loanConsigned: sumByCode(['EMPRESTIMO']),
        salaryFamily: sumByCode(['SAL_FAM'])
      }
    };
  }
}





