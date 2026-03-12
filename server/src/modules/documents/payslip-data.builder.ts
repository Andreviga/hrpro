import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { resolveCompanyRegistry } from '../payroll/payslip-excel/company-registry';

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

const formatDate = (value: Date | null | undefined) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
};

const isLikelyFakeCompanyName = (companyName: string) => {
  const normalized = companyName.toLowerCase();
  return /demo|fake|fict|empresa\s+nao|teste/.test(normalized);
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

@Injectable()
export class PayslipDataBuilder {
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
    const companyAddress = normalizeText(companyRegistry?.address, 'Endereco nao informado');
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
        description: 'SALARIO BASE',
        amount: sumByMatcher(earningsEvents, (code, description) => {
          return code === 'BASE' || code === 'SAL_BASE' || code === '1500' || description.includes('SALARIO BASE');
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
        return code === 'VA' || description.includes('VALE ALIMENTACAO');
      }),
      alimony: sumByMatcher(deductionEvents, (code, description) => {
        return code === 'PENSAO' || description.includes('PENSAO');
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
      createdAt: new Date().toISOString()
    };

    this.validatePayslip(payslip);
    return payslip;
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
        message: 'Nao foi possivel gerar holerite. Campos obrigatorios ausentes ou invalidos.',
        missingFields: Array.from(new Set(missingFields))
      });
    }
  }
}
