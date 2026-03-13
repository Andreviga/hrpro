import { access } from 'node:fs/promises';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { resolveCompanyRegistry } from '../payroll/payslip-excel/company-registry';
import {
  buildPayslipFromExcel,
  defaultExampleWorkbookPath,
  loadWorkbook
} from '../payroll/payslip-excel';
import type {
  LoadedWorkbook,
  Payslip as LegacyPayslip,
  PayslipWarning as LegacyPayslipWarning
} from '../payroll/payslip-excel/types';

export interface PayslipClassCompositionLine {
  code: string;
  description: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
}

export interface PayslipRubric {
  code: string;
  description: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface Payslip {
  companyId: string;
  companyName: string;
  companyCnpj: string;
  companyAddress: string;
  companyLogoUrl?: string;
  employeeId: string;
  employeeName: string;
  employeeCpf: string;
  employeeCode: string;
  employeeRole: string;
  admissionDate: string;
  employeeEmail: string;
  bank: string;
  agency: string;
  account: string;
  paymentMethod: string;
  competenceMonth: number;
  competenceYear: number;
  classComposition: PayslipClassCompositionLine[];
  earnings: PayslipRubric[];
  deductions: PayslipRubric[];
  grossSalary: number;
  totalDiscounts: number;
  netSalary: number;
  fgts: number;
  inssBase: number;
  fgtsBase: number;
  irrfBase: number;
  foodAllowance: number;
  alimony: number;
  thirteenthSecondInstallment: number;
  thirteenthInss: number;
  thirteenthIrrf: number;
  calculationBase: number;
  title?: string;
  referenceMonth?: string;
  totalClassQuantity?: number | null;
  classUnitValue?: number | null;
  pix?: string;
  sourceWarnings?: LegacyPayslipWarning[];
  createdAt: string;
}

export interface BuildPayslipCompetenceInput {
  companyId: string;
  month: number;
  year: number;
  payrollRunId?: string;
}

const REQUIRED_FIELDS: Array<keyof Pick<Payslip,
  'employeeName' | 'employeeCpf' | 'companyName' | 'companyCnpj' | 'grossSalary' | 'netSalary'
>> = ['employeeName', 'employeeCpf', 'companyName', 'companyCnpj', 'grossSalary', 'netSalary'];

const REQUIRED_CLASS_LINES: Array<{ code: string; description: string }> = [
  { code: '1', description: 'ENSINO INFANTIL' },
  { code: '2', description: 'ENSINO FUNDAMENTAL I' },
  { code: '3', description: 'ENSINO FUNDAMENTAL II' },
  { code: '4', description: 'ENSINO MEDIO' },
  { code: '5', description: 'RO' },
  { code: '6', description: 'AD FUNCAO / TURNO' }
];

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const normalizeText = (value: unknown, fallback = '-') => {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : fallback;
};

const normalizeOptionalText = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : null;
};

const formatDate = (value: Date | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
};

const isLikelyFakeCompanyName = (companyName: string) => {
  const normalized = companyName.toLowerCase();
  return /demo|fake|fict|empresa\s+n[aã]o|teste/.test(normalized);
};

const onlyDigits = (value: string) => value.replace(/\D+/g, '');

const isValidCnpj = (cnpj: string) => {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    const total = base
      .split('')
      .reduce((sum, char, idx) => sum + Number(char) * weights[idx], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const d1 = calcDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${d1}${d2}`);
};

const sumByMatcher = (
  items: Array<{ code: string; description: string; amount: unknown }>,
  matcher: (code: string, description: string) => boolean
) => {
  return items.reduce((sum, item) => {
    const code = String(item.code ?? '').toUpperCase();
    const description = String(item.description ?? '').toUpperCase();
    if (!matcher(code, description)) return sum;
    return sum + toNumber(item.amount);
  }, 0);
};

const existsByMatcher = (
  items: Array<{ code: string; description: string; amount: unknown }>,
  matcher: (code: string, description: string) => boolean
) => {
  return items.some((item) => {
    const code = String(item.code ?? '').toUpperCase();
    const description = String(item.description ?? '').toUpperCase();
    return matcher(code, description) && toNumber(item.amount) > 0;
  });
};

const firstFiniteNumber = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number(value.toFixed(2));
    }
  }

  return null;
};

const firstNonEmptyText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const sumRubricAmounts = (items: Array<{ amount: number }> | undefined) => {
  return Number(
    (items ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0).toFixed(2)
  );
};

const competenceLabel = (month: number, year: number) => `${String(month).padStart(2, '0')}/${year}`;

const LEGACY_CLASS_LINE_MAP: Record<string, { code: string; description: string }> = {
  INFANTIL: { code: '1', description: 'ENSINO INFANTIL' },
  EFI: { code: '2', description: 'ENSINO FUNDAMENTAL I' },
  EFII: { code: '3', description: 'ENSINO FUNDAMENTAL II' },
  EM: { code: '4', description: 'ENSINO MEDIO' },
  RO: { code: '5', description: 'RO' },
  AD_FUNCAO: { code: '6', description: 'AD FUNCAO / TURNO' }
};

@Injectable()
export class PayslipDataBuilder {
  private readonly logger = new Logger(PayslipDataBuilder.name);
  private legacyWorkbookPromise: Promise<LoadedWorkbook | null> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async buildPayslip(employeeId: string, competence: BuildPayslipCompetenceInput): Promise<Payslip> {
    const payrollResult = await this.prisma.payrollResult.findFirst({
      where: {
        employeeId,
        payrollRunId: competence.payrollRunId,
        payrollRun: {
          companyId: competence.companyId,
          month: competence.month,
          year: competence.year
        }
      },
      include: {
        employee: true,
        payrollRun: true,
        events: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!payrollResult) {
      throw new NotFoundException('Payroll result not found for payslip generation');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: competence.companyId }
    });

    if (!company) {
      throw new NotFoundException('Company not found for payslip generation');
    }

    const irrfBaseRow = await this.prisma.taxTableIrrf.findFirst({
      where: {
        companyId: competence.companyId,
        month: competence.month,
        year: competence.year
      },
      orderBy: { minValue: 'asc' }
    });

    const dependentDeduction = toNumber(irrfBaseRow?.dependentDeduction ?? 0);
    const events = payrollResult.events.map((event) => ({
      code: String(event.code ?? ''),
      description: String(event.description ?? ''),
      amount: toNumber(event.amount),
      type: event.type as 'earning' | 'deduction'
    }));

    const earningsEvents = events.filter((event) => event.type === 'earning');
    const deductionEvents = events.filter((event) => event.type === 'deduction');

    const companyRegistry = resolveCompanyRegistry(company.name);
    const companyAddress = normalizeText(companyRegistry?.address, 'Endereço não informado');
    const companyCnpj = normalizeText(company.cnpj || companyRegistry?.cnpj, '');

    const inssAmount = sumByMatcher(
      deductionEvents,
      (code, description) => code === 'INSS' || description.includes('INSS')
    );

    const irrfBase = Math.max(
      0,
      toNumber(payrollResult.grossSalary) - inssAmount - toNumber(payrollResult.employee.dependents) * dependentDeduction
    );

    const fixedClassComposition: PayslipClassCompositionLine[] = REQUIRED_CLASS_LINES.map((line) => ({
      code: line.code,
      description: line.description,
      quantity: 0,
      unitValue: 0,
      totalValue:
        line.code === '6'
          ? sumByMatcher(
              earningsEvents,
              (code, description) =>
                code.includes('AD') || description.includes('AD FUNCAO') || description.includes('ADICIONAL TURNO')
            )
          : 0
    }));

    const earnings: PayslipRubric[] = [
      {
        code: '1500',
        description: 'SALÁRIO BASE',
        amount: sumByMatcher(earningsEvents, (code, description) => {
          return (
            code === 'BASE' ||
            code === 'SAL_BASE' ||
            code === '1500' ||
            description.includes('SALARIO BASE') ||
            description.includes('SALÁRIO BASE')
          );
        }),
        type: 'earning'
      },
      {
        code: '1013',
        description: 'HORA ATIVIDADE',
        amount: sumByMatcher(earningsEvents, (code, description) => {
          return code === 'HORA_ATV' || code === '1013' || description.includes('HORA ATIVIDADE');
        }),
        type: 'earning'
      },
      {
        code: '1012',
        description: 'DRS (1/6)',
        amount: sumByMatcher(earningsEvents, (code, description) => {
          return code === 'DSR' || code === 'DRS' || code === '1012' || description.includes('DRS');
        }),
        type: 'earning'
      }
    ];

    const deductions: PayslipRubric[] = [
      {
        code: '2080',
        description: 'INSS',
        amount: inssAmount,
        type: 'deduction'
      },
      {
        code: '2090',
        description: 'IRRF/IRFF',
        amount: sumByMatcher(deductionEvents, (code, description) => {
          return code === 'IRRF' || code === 'IRFF' || description.includes('IRRF') || description.includes('IRFF');
        }),
        type: 'deduction'
      },
      {
        code: '2060',
        description: 'VALE TRANSPORTE',
        amount: sumByMatcher(deductionEvents, (code, description) => {
          return code === 'VT' || code === '2060' || description.includes('VALE TRANSPORTE');
        }),
        type: 'deduction'
      },
      {
        code: '2070',
        description: 'FALTAS',
        amount: sumByMatcher(deductionEvents, (code, description) => {
          return code === 'FALTAS' || code === '2070' || description.includes('FALTA');
        }),
        type: 'deduction'
      }
    ];

    if (
      existsByMatcher(deductionEvents, (code, description) => {
        return code === 'EMPRESTIMO' || description.includes('EMPRESTIMO GOVERNO') || description.includes('EMPRESTIMO');
      })
    ) {
      deductions.push({
        code: '2999',
        description: 'EMPRESTIMO GOVERNO',
        amount: sumByMatcher(deductionEvents, (code, description) => {
          return code === 'EMPRESTIMO' || description.includes('EMPRESTIMO GOVERNO') || description.includes('EMPRESTIMO');
        }),
        type: 'deduction'
      });
    }

    const payslip: Payslip = {
      companyId: competence.companyId,
      companyName: normalizeText(company.name, ''),
      companyCnpj,
      companyAddress,
      employeeId: payrollResult.employeeId,
      employeeName: normalizeText(payrollResult.employee.fullName, ''),
      employeeCpf: normalizeText(payrollResult.employee.cpf, ''),
      employeeCode: normalizeText(payrollResult.employee.employeeCode, '-'),
      employeeRole: normalizeText(payrollResult.employee.position, '-'),
      admissionDate: formatDate(payrollResult.employee.admissionDate),
      employeeEmail: normalizeText(payrollResult.employee.email, '-'),
      bank: normalizeText(payrollResult.employee.bankName, '-'),
      agency: normalizeText(payrollResult.employee.bankAgency, '-'),
      account: normalizeText(payrollResult.employee.bankAccount, '-'),
      paymentMethod: normalizeText(payrollResult.employee.paymentMethod, '-'),
      competenceMonth: competence.month,
      competenceYear: competence.year,
      classComposition: fixedClassComposition,
      earnings,
      deductions,
      grossSalary: toNumber(payrollResult.grossSalary),
      totalDiscounts: toNumber(payrollResult.totalDeductions),
      netSalary: toNumber(payrollResult.netSalary),
      fgts: toNumber(payrollResult.fgts),
      inssBase: toNumber(payrollResult.grossSalary),
      fgtsBase: toNumber(payrollResult.grossSalary),
      irrfBase: toNumber(irrfBase),
      foodAllowance: sumByMatcher(earningsEvents, (code, description) => {
        return code === 'VA' || description.includes('VALE ALIMENTACAO') || description.includes('VALE ALIMENTAÇÃO');
      }),
      alimony: sumByMatcher(deductionEvents, (code, description) => {
        return code === 'PENSAO' || description.includes('PENSAO') || description.includes('PENSÃO');
      }),
      thirteenthSecondInstallment: sumByMatcher(earningsEvents, (code, description) => {
        return code.includes('13') || description.includes('13') || description.includes('2A PARCELA');
      }),
      thirteenthInss: sumByMatcher(deductionEvents, (code, description) => {
        return (code.includes('13') && description.includes('INSS')) || description.includes('INSS 13');
      }),
      thirteenthIrrf: sumByMatcher(deductionEvents, (code, description) => {
        return (code.includes('13') && description.includes('IRRF')) || description.includes('IRRF 13');
      }),
      calculationBase: toNumber(payrollResult.grossSalary),
      title: 'DEMONSTRATIVO DE PAGAMENTO',
      referenceMonth: competenceLabel(competence.month, competence.year),
      totalClassQuantity: 0,
      classUnitValue: 0,
      pix: normalizeOptionalText(payrollResult.employee.bankAccount) ?? undefined,
      createdAt: new Date().toISOString()
    };

    const enrichedPayslip = await this.enrichWithLegacyWorkbook(payslip, payrollResult.employee, competence);

    this.validatePayslip(enrichedPayslip);
    return enrichedPayslip;
  }

  private async enrichWithLegacyWorkbook(
    basePayslip: Payslip,
    employee: { cpf?: string | null; fullName?: string | null },
    competence: BuildPayslipCompetenceInput
  ) {
    const workbook = await this.getLegacyWorkbook();
    if (!workbook) {
      return basePayslip;
    }

    try {
      const legacyPayslip = buildPayslipFromExcel({
        workbook,
        employeeKey: {
          cpf: employee.cpf,
          name: employee.fullName
        },
        competence: competenceLabel(competence.month, competence.year)
      });

      const requestedCompetence = competenceLabel(competence.month, competence.year);
      const shouldMergeFinancialData = this.matchesCompetence(requestedCompetence, legacyPayslip.referenceMonth);

      if (!shouldMergeFinancialData) {
        this.logger.warn(
          `Workbook competence mismatch for ${employee.cpf ?? employee.fullName ?? 'unknown'}: requested ${requestedCompetence}, workbook returned ${legacyPayslip.referenceMonth}`
        );

        legacyPayslip.warnings = [
          ...legacyPayslip.warnings,
          {
            code: 'WORKBOOK_COMPETENCE_MISMATCH',
            message: `A planilha carregada retornou a competência ${legacyPayslip.referenceMonth ?? 'desconhecida'} para este colaborador, diferente da competência solicitada ${requestedCompetence}. Os valores do banco foram mantidos para evitar mistura de meses.`,
            fillLocation: 'Folha de pagamento de fevereiro 2026.xlsm',
            sourceSheet: 'Folha de pagamento janeiro2026'
          }
        ];
      }

      return this.mergeWithLegacyPayslip(basePayslip, legacyPayslip, shouldMergeFinancialData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        `Unable to enrich payslip from workbook for employee ${employee.cpf ?? employee.fullName ?? 'unknown'}: ${message}`
      );
      return basePayslip;
    }
  }

  private async getLegacyWorkbook() {
    if (!this.legacyWorkbookPromise) {
      this.legacyWorkbookPromise = this.loadLegacyWorkbook();
    }

    return this.legacyWorkbookPromise;
  }

  private async loadLegacyWorkbook() {
    const workbookPath = process.env.HRPRO_PAYSLIP_WORKBOOK_PATH || defaultExampleWorkbookPath;

    try {
      await access(workbookPath);
    } catch (_error) {
      return null;
    }

    try {
      return await loadWorkbook(workbookPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(`Unable to load legacy payslip workbook ${workbookPath}: ${message}`);
      return null;
    }
  }

  private mergeWithLegacyPayslip(
    basePayslip: Payslip,
    legacyPayslip: LegacyPayslip,
    includeFinancialData: boolean
  ): Payslip {
    const legacyClassComposition = this.mapLegacyClassComposition(legacyPayslip);
    const legacyEarnings = legacyPayslip.earnings.map((item) => ({
      code: normalizeText(item.payrollCode, 'EARNING'),
      description: normalizeText(item.description, 'PROVENTO'),
      amount: toNumber(item.amount),
      type: 'earning' as const
    }));
    const legacyDeductions = legacyPayslip.deductions.map((item) => ({
      code: normalizeText(item.payrollCode, 'DEDUCTION'),
      description: normalizeText(item.description, 'DESCONTO'),
      amount: toNumber(item.amount),
      type: 'deduction' as const
    }));

    return {
      ...basePayslip,
      companyName: firstNonEmptyText(legacyPayslip.companyName, basePayslip.companyName) ?? basePayslip.companyName,
      companyCnpj: firstNonEmptyText(legacyPayslip.companyCnpj, basePayslip.companyCnpj) ?? basePayslip.companyCnpj,
      companyAddress:
        firstNonEmptyText(legacyPayslip.companyAddress, basePayslip.companyAddress) ?? basePayslip.companyAddress,
      employeeName: firstNonEmptyText(legacyPayslip.employeeName, basePayslip.employeeName) ?? basePayslip.employeeName,
      employeeCpf: firstNonEmptyText(legacyPayslip.employeeCpf, basePayslip.employeeCpf) ?? basePayslip.employeeCpf,
      employeeCode: firstNonEmptyText(legacyPayslip.employeeCode, basePayslip.employeeCode) ?? basePayslip.employeeCode,
      employeeRole: firstNonEmptyText(legacyPayslip.employeeRole, basePayslip.employeeRole) ?? basePayslip.employeeRole,
      admissionDate:
        firstNonEmptyText(legacyPayslip.admissionDate, basePayslip.admissionDate) ?? basePayslip.admissionDate,
      employeeEmail:
        firstNonEmptyText(legacyPayslip.email, basePayslip.employeeEmail) ?? basePayslip.employeeEmail,
      bank: firstNonEmptyText(legacyPayslip.bank, basePayslip.bank) ?? basePayslip.bank,
      agency: firstNonEmptyText(legacyPayslip.agency, basePayslip.agency) ?? basePayslip.agency,
      account: firstNonEmptyText(legacyPayslip.account, basePayslip.account) ?? basePayslip.account,
      paymentMethod: firstNonEmptyText(basePayslip.paymentMethod, legacyPayslip.pix ? 'PIX' : null) ?? basePayslip.paymentMethod,
      classComposition:
        includeFinancialData && legacyClassComposition.length > 0 ? legacyClassComposition : basePayslip.classComposition,
      earnings: includeFinancialData && legacyEarnings.length > 0 ? legacyEarnings : basePayslip.earnings,
      deductions: includeFinancialData && legacyDeductions.length > 0 ? legacyDeductions : basePayslip.deductions,
      grossSalary:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.grossSalary, basePayslip.grossSalary) ?? basePayslip.grossSalary
          : basePayslip.grossSalary,
      totalDiscounts:
        includeFinancialData && legacyDeductions.length > 0
          ? sumRubricAmounts(legacyDeductions)
          : basePayslip.totalDiscounts,
      netSalary:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.netSalary, basePayslip.netSalary) ?? basePayslip.netSalary
          : basePayslip.netSalary,
      fgts:
        includeFinancialData ? firstFiniteNumber(legacyPayslip.fgts, basePayslip.fgts) ?? basePayslip.fgts : basePayslip.fgts,
      inssBase:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.grossSalary, basePayslip.inssBase) ?? basePayslip.inssBase
          : basePayslip.inssBase,
      fgtsBase:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.grossSalary, basePayslip.fgtsBase) ?? basePayslip.fgtsBase
          : basePayslip.fgtsBase,
      irrfBase:
        includeFinancialData
          ? firstFiniteNumber(basePayslip.irrfBase, legacyPayslip.calculationBase) ?? basePayslip.irrfBase
          : basePayslip.irrfBase,
      foodAllowance:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.foodAllowance, basePayslip.foodAllowance) ?? basePayslip.foodAllowance
          : basePayslip.foodAllowance,
      alimony:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.pensionAlimony, basePayslip.alimony) ?? basePayslip.alimony
          : basePayslip.alimony,
      thirteenthSecondInstallment:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.thirteenthSecondInstallment, basePayslip.thirteenthSecondInstallment)
            ?? basePayslip.thirteenthSecondInstallment
          : basePayslip.thirteenthSecondInstallment,
      thirteenthInss:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.thirteenthInss, basePayslip.thirteenthInss) ?? basePayslip.thirteenthInss
          : basePayslip.thirteenthInss,
      thirteenthIrrf:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.thirteenthIrrf, basePayslip.thirteenthIrrf) ?? basePayslip.thirteenthIrrf
          : basePayslip.thirteenthIrrf,
      calculationBase:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.calculationBase, basePayslip.calculationBase) ?? basePayslip.calculationBase
          : basePayslip.calculationBase,
      title: firstNonEmptyText(legacyPayslip.title, basePayslip.title) ?? basePayslip.title,
      referenceMonth:
        includeFinancialData
          ? firstNonEmptyText(legacyPayslip.referenceMonth, basePayslip.referenceMonth) ?? basePayslip.referenceMonth
          : basePayslip.referenceMonth,
      totalClassQuantity:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.totalClassQuantity, basePayslip.totalClassQuantity) ?? basePayslip.totalClassQuantity
          : basePayslip.totalClassQuantity,
      classUnitValue:
        includeFinancialData
          ? firstFiniteNumber(legacyPayslip.classUnitValue, basePayslip.classUnitValue) ?? basePayslip.classUnitValue
          : basePayslip.classUnitValue,
      pix: firstNonEmptyText(legacyPayslip.pix, basePayslip.pix) ?? basePayslip.pix,
      sourceWarnings: legacyPayslip.warnings,
      createdAt: basePayslip.createdAt
    };
  }

  private matchesCompetence(requestedCompetence: string, workbookCompetence?: string | null) {
    const left = String(requestedCompetence ?? '').trim();
    const right = String(workbookCompetence ?? '').trim();
    if (!left || !right) {
      return false;
    }

    return left === right;
  }

  private mapLegacyClassComposition(legacyPayslip: LegacyPayslip): PayslipClassCompositionLine[] {
    const mapped = new Map<string, PayslipClassCompositionLine>();

    for (const line of legacyPayslip.classComposition) {
      const descriptor = LEGACY_CLASS_LINE_MAP[String(line.lineCode ?? '').toUpperCase()];
      if (!descriptor) {
        continue;
      }

      mapped.set(descriptor.code, {
        code: descriptor.code,
        description: descriptor.description,
        quantity: toNumber(line.quantity),
        unitValue: toNumber(line.unitValue),
        totalValue: toNumber(line.totalValue)
      });
    }

    return REQUIRED_CLASS_LINES.map((line) => {
      return mapped.get(line.code) ?? {
        code: line.code,
        description: line.description,
        quantity: 0,
        unitValue: 0,
        totalValue: 0
      };
    });
  }

  private validatePayslip(payslip: Payslip) {
    const missingFields: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      const value = payslip[field];
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          missingFields.push(field);
        }
        continue;
      }

      if (!String(value ?? '').trim()) {
        missingFields.push(field);
      }
    }

    if (isLikelyFakeCompanyName(payslip.companyName)) {
      missingFields.push('companyName');
    }

    if (!isValidCnpj(payslip.companyCnpj)) {
      missingFields.push('companyCnpj');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'Não foi possível gerar holerite. Campos obrigatórios ausentes ou inválidos.',
        missingFields: Array.from(new Set(missingFields))
      });
    }
  }
}

