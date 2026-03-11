import { COMPANY_REGISTRY_FILL_LOCATION, resolveCompanyRegistry } from './company-registry';
import { mapPayrollData, payrollAliases, rowCell } from './payroll-mapper';
import {
  CompositionLine,
  EmployeeLookupKey,
  LoadedWorkbook,
  MappedPayrollSources,
  PayrollItem,
  Payslip,
  PayslipWarning,
  WorkbookCellValue
} from './types';

const formatDate = (value: unknown) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString('pt-BR');
};

const asString = (cell?: WorkbookCellValue, fallback?: string | null) => {
  if (!cell) return fallback ?? null;
  if (cell.value === undefined || cell.value === null || String(cell.value).trim() === '') {
    return fallback ?? null;
  }
  return String(cell.value).trim();
};

const asNumber = (cell?: WorkbookCellValue) => {
  if (!cell) return null;
  const value = cell.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]+/g, '');
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const absNumber = (cell?: WorkbookCellValue) => {
  const value = asNumber(cell);
  return value === null ? null : Math.abs(value);
};

const pushWarningIfMissing = (warnings: PayslipWarning[], params: {
  code: string;
  value: string | null;
  message: string;
  fillLocation: string;
  sourceSheet?: string;
  sourceTable?: string;
  sourceCell?: string;
}) => {
  if (params.value) {
    return;
  }

  warnings.push({
    code: params.code,
    message: params.message,
    fillLocation: params.fillLocation,
    sourceSheet: params.sourceSheet,
    sourceTable: params.sourceTable,
    sourceCell: params.sourceCell
  });
};

const buildCompositionLines = (mapped: MappedPayrollSources) => {
  const classRow = mapped.classRow;
  const aux = mapped.auxiliaryCells;
  const roParts = [
    { label: 'RO EFI', value: asNumber(rowCell(classRow, payrollAliases.classRoEfi)) },
    { label: 'RO EFII', value: asNumber(rowCell(classRow, payrollAliases.classRoEfii)) },
    { label: 'RO EM', value: asNumber(rowCell(classRow, payrollAliases.classRoEm)) }
  ].filter((item) => item.value !== null && item.value !== 0);

  const lines: CompositionLine[] = [
    {
      lineCode: 'INFANTIL',
      description: 'Ensino Infantil',
      quantity: asNumber(rowCell(classRow, payrollAliases.classInfant)),
      unitValue: asNumber(aux.E14) ?? asNumber(aux.E15),
      totalValue: (() => {
        const quantity = asNumber(rowCell(classRow, payrollAliases.classInfant));
        const unitValue = asNumber(aux.E14) ?? asNumber(aux.E15);
        return quantity !== null && unitValue !== null ? quantity * unitValue : null;
      })(),
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Aula no Ensino Infantil',
      note: null
    },
    {
      lineCode: 'EFI',
      description: 'Ensino Fundamental I',
      quantity: asNumber(rowCell(classRow, payrollAliases.classEfiCount)) ?? asNumber(rowCell(classRow, payrollAliases.classEfi)),
      unitValue: asNumber(rowCell(classRow, payrollAliases.classEfiCount)) !== null ? asNumber(aux.I14) : asNumber(aux.F14),
      totalValue: (() => {
        const quantity = asNumber(rowCell(classRow, payrollAliases.classEfiCount)) ?? asNumber(rowCell(classRow, payrollAliases.classEfi));
        const unitValue = asNumber(rowCell(classRow, payrollAliases.classEfiCount)) !== null ? asNumber(aux.I14) : asNumber(aux.F14);
        return quantity !== null && unitValue !== null ? quantity * unitValue : null;
      })(),
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Aula no EFI / Nº aula EFI',
      note: null
    },
    {
      lineCode: 'EFII',
      description: 'Ensino Fundamental II',
      quantity: asNumber(rowCell(classRow, payrollAliases.classEfii)),
      unitValue: asNumber(aux.G14),
      totalValue: (() => {
        const quantity = asNumber(rowCell(classRow, payrollAliases.classEfii));
        const unitValue = asNumber(aux.G14);
        return quantity !== null && unitValue !== null ? quantity * unitValue : null;
      })(),
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Nº aulas no EFII',
      note: null
    },
    {
      lineCode: 'EM',
      description: 'Ensino Médio',
      quantity: asNumber(rowCell(classRow, payrollAliases.classEm)),
      unitValue: asNumber(aux.H14),
      totalValue: (() => {
        const quantity = asNumber(rowCell(classRow, payrollAliases.classEm));
        const unitValue = asNumber(aux.H14);
        return quantity !== null && unitValue !== null ? quantity * unitValue : null;
      })(),
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Nº aulas no EM',
      note: null
    },
    {
      lineCode: 'RO',
      description: 'RO',
      quantity: roParts.reduce((sum, item) => sum + Number(item.value), 0) || null,
      unitValue: null,
      totalValue: null,
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'RO EFI / RO EFII / RO EM',
      note: roParts.length > 0 ? roParts.map((item) => `${item.label}: ${item.value}`).join(' | ') : null
    },
    {
      lineCode: 'AD_FUNCAO',
      description: 'AD Função / Turno',
      quantity: null,
      unitValue: null,
      totalValue: asNumber(rowCell(classRow, payrollAliases.classFunctionAllowance)),
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'AD função ou turno',
      note: null
    }
  ];

  return lines.filter((line) => line.quantity !== null || line.totalValue !== null || line.note);
};

const buildEarnings = (mapped: MappedPayrollSources) => {
  const classRow = mapped.classRow;
  const salaryBase = asNumber(rowCell(classRow, payrollAliases.classSalaryBase)) ?? 0;
  const functionAllowance = asNumber(rowCell(classRow, payrollAliases.classFunctionAllowance)) ?? 0;

  return [
    {
      payrollCode: 'SAL_BASE',
      description: 'Salário Base',
      amount: salaryBase + functionAllowance,
      type: 'earning',
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Sálario base + AD função ou turno',
      order: 1
    },
    {
      payrollCode: 'HORA_ATV',
      description: 'Hora Atividade',
      amount: asNumber(rowCell(classRow, payrollAliases.classHourActivity)) ?? 0,
      type: 'earning',
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Adicional hora atividade',
      order: 2
    },
    {
      payrollCode: 'DSR',
      description: 'DRS (1/6)',
      amount: asNumber(rowCell(classRow, payrollAliases.classDsr)) ?? 0,
      type: 'earning',
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Descanso remunerado',
      order: 3
    }
  ].filter((item) => item.amount > 0) as PayrollItem[];
};

const buildDeductions = (mapped: MappedPayrollSources) => {
  const classRow = mapped.classRow;
  const monthlyRow = mapped.monthlyRow;

  return [
    {
      payrollCode: 'INSS',
      description: 'INSS',
      amount: absNumber(rowCell(monthlyRow, payrollAliases.monthlyInss)) ?? 0,
      type: 'deduction',
      sourceSheet: mapped.monthlySheetName,
      sourceTable: 'Tabela35',
      sourceColumn: 'INSS',
      order: 1
    },
    {
      payrollCode: 'IRRF',
      description: 'IRRF',
      amount: absNumber(rowCell(monthlyRow, payrollAliases.monthlyIrrf)) ?? 0,
      type: 'deduction',
      sourceSheet: mapped.monthlySheetName,
      sourceTable: 'Tabela35',
      sourceColumn: 'IRFONTE',
      order: 2
    },
    {
      payrollCode: 'EMPRESTIMO',
      description: 'Empréstimo Governo',
      amount: absNumber(rowCell(monthlyRow, payrollAliases.monthlyLoan)) ?? 0,
      type: 'deduction',
      sourceSheet: mapped.monthlySheetName,
      sourceTable: 'Tabela35',
      sourceColumn: 'Empréstimo',
      order: 3
    },
    {
      payrollCode: 'VT',
      description: 'Vale Transporte',
      amount: absNumber(rowCell(monthlyRow, payrollAliases.monthlyTransport)) ?? 0,
      type: 'deduction',
      sourceSheet: mapped.monthlySheetName,
      sourceTable: 'Tabela35',
      sourceColumn: 'Vale transporte',
      order: 4
    },
    {
      payrollCode: 'FALTAS',
      description: 'Faltas',
      amount: absNumber(rowCell(classRow, payrollAliases.classTotalAbsence)) ?? 0,
      type: 'deduction',
      sourceSheet: 'Quantidade de aula 0125',
      sourceTable: 'Tabela2',
      sourceColumn: 'Total falta',
      order: 5
    }
  ].filter((item) => item.amount > 0) as PayrollItem[];
};

export const buildPayslip = (params: {
  workbook: LoadedWorkbook;
  employeeKey: string | EmployeeLookupKey;
  competence?: string | null;
}): Payslip => {
  const mapped = mapPayrollData(params);
  const warnings = [...mapped.warnings];

  const employeeName = asString(rowCell(mapped.registrationRow, payrollAliases.registrationName), 'FUNCIONARIO_NAO_IDENTIFICADO') ?? 'FUNCIONARIO_NAO_IDENTIFICADO';
  const employeeCpf = asString(rowCell(mapped.registrationRow, payrollAliases.registrationCpf), 'CPF_NAO_INFORMADO') ?? 'CPF_NAO_INFORMADO';
  const employeeRole = asString(rowCell(mapped.classRow, payrollAliases.classRole), 'CARGO_NAO_INFORMADO') ?? 'CARGO_NAO_INFORMADO';
  const companyName = asString(rowCell(mapped.monthlyRow, payrollAliases.monthlyCompany), 'EMPRESA_NAO_INFORMADA') ?? 'EMPRESA_NAO_INFORMADA';
  const companyRegistry = resolveCompanyRegistry(companyName);
  const companyCnpj = companyRegistry?.cnpj ?? null;
  const companyAddress = companyRegistry?.address ?? null;

  pushWarningIfMissing(warnings, {
    code: 'EMPLOYEE_EMAIL_MISSING',
    value: asString(rowCell(mapped.registrationRow, payrollAliases.registrationEmail)),
    message: `E-mail do colaborador ${employeeName} nao encontrado. Preencha em Cadastro Funcionários > Tabela1 > email.`,
    fillLocation: 'Cadastro Funcionários -> Tabela1 -> email',
    sourceSheet: 'Cadastro Funcionários',
    sourceTable: 'Tabela1'
  });

  const grossSalary = asNumber(rowCell(mapped.monthlyRow, payrollAliases.monthlyGrossSalary))
    ?? asNumber(rowCell(mapped.classRow, payrollAliases.classGrossSalary));
  const netSalary = asNumber(rowCell(mapped.monthlyRow, payrollAliases.monthlyNetSalary));
  const foodAllowance = asNumber(rowCell(mapped.monthlyRow, payrollAliases.monthlyVa));

  // pensionAlimony: sum of PENSAO deductions from monthly table, or 0
  const pensionAlimony = absNumber(rowCell(mapped.monthlyRow, ['PENSAO'] as const)) ?? 0;

  // totalClassQuantity: sum of all composition line quantities
  const compositionLines = buildCompositionLines(mapped);
  const totalClassQuantity = compositionLines.reduce((sum, line) => sum + (line.quantity ?? 0), 0) || null;

  // classUnitValue: value from auxílio cell E14 (most common) or E15
  const classUnitValue = asNumber(mapped.auxiliaryCells.E14) ?? asNumber(mapped.auxiliaryCells.E15) ?? null;

  const payslip: Payslip = {
    title: asString(mapped.templateCells.C5, 'DEMONSTRATIVO DE PAGAMENTO') ?? 'DEMONSTRATIVO DE PAGAMENTO',
    employeeCode: null,
    employeeName,
    employeeCpf,
    employeeRole,
    totalClassQuantity,
    classUnitValue,
    admissionDate: formatDate(rowCell(mapped.registrationRow, payrollAliases.registrationAdmission)?.value),
    companyName,
    companyCnpj,
    companyAddress,
    referenceMonth: mapped.competenceLabel,
    classComposition: compositionLines,
    earnings: buildEarnings(mapped),
    deductions: buildDeductions(mapped),
    grossSalary,
    netSalary,
    pensionAlimony,
    fgts: grossSalary === null ? null : Number((grossSalary * 0.08).toFixed(2)),
    foodAllowance,
    thirteenthSecondInstallment: absNumber(mapped.thirteenthRow ? rowCell(mapped.thirteenthRow, payrollAliases.thirteenthSecond) : undefined),
    thirteenthInss: absNumber(mapped.thirteenthRow ? rowCell(mapped.thirteenthRow, payrollAliases.thirteenthInss) : undefined),
    thirteenthIrrf: absNumber(mapped.thirteenthRow ? rowCell(mapped.thirteenthRow, payrollAliases.thirteenthIrrf) : undefined),
    calculationBase: grossSalary,
    bank: asString(rowCell(mapped.registrationRow, payrollAliases.registrationBank))
      ?? asString(rowCell(mapped.monthlyRow, payrollAliases.monthlyBank)),
    agency: asString(rowCell(mapped.registrationRow, payrollAliases.registrationAgency)),
    account: asString(rowCell(mapped.registrationRow, payrollAliases.registrationAccount))
      ?? asString(rowCell(mapped.monthlyRow, payrollAliases.monthlyAccount)),
    pix: asString(rowCell(mapped.registrationRow, payrollAliases.registrationPix))
      ?? asString(rowCell(mapped.monthlyRow, payrollAliases.monthlyPix)),
    email: asString(rowCell(mapped.registrationRow, payrollAliases.registrationEmail)),
    rawSources: {
      registration: mapped.registrationRow,
      classComposition: mapped.classRow,
      monthlyPayroll: mapped.monthlyRow,
      thirteenthPayroll: mapped.thirteenthRow,
      templateCells: mapped.templateCells,
      auxiliaryCells: mapped.auxiliaryCells
    },
    warnings
  };

  return payslip;
};

export const buildPayslipFromExcel = (params: {
  workbook: LoadedWorkbook;
  employeeKey: string | EmployeeLookupKey;
  competence?: string | null;
}) => buildPayslip(params);