import { Employee, TaxTableInss, TaxTableIrrf } from '@prisma/client';

export interface PayrollCalculationResult {
  earnings: { code: string; description: string; amount: number }[];
  deductions: { code: string; description: string; amount: number }[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  fgts: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

const findBracketByRange = <T extends { minValue: any; maxValue: any }>(table: T[], amount: number) => {
  if (!table.length) return null;

  const sorted = [...table].sort((left, right) => Number(left.minValue) - Number(right.minValue));

  const byRange = sorted.find((row) => {
    const min = Number(row.minValue ?? 0);
    const max = Number(row.maxValue ?? Number.POSITIVE_INFINITY);
    return amount >= min && amount <= max;
  });

  if (byRange) return byRange;

  const byFloor = [...sorted].reverse().find((row) => amount >= Number(row.minValue ?? 0));
  return byFloor ?? sorted[sorted.length - 1];
};

const applyIrrfReduction2026 = (params: {
  year?: number;
  grossTaxableIncome: number;
  irrfBeforeReduction: number;
}) => {
  const { year, grossTaxableIncome, irrfBeforeReduction } = params;

  // Lei 15.270/2025: redutor mensal do IR a partir de janeiro/2026.
  if (!year || year < 2026) {
    return irrfBeforeReduction;
  }

  if (grossTaxableIncome <= 5000) {
    return 0;
  }

  if (grossTaxableIncome <= 7350) {
    const reduction = 978.62 - (0.133145 * grossTaxableIncome);
    return Math.max(0, round(irrfBeforeReduction - Math.max(0, reduction)));
  }

  return irrfBeforeReduction;
};

export const hasFgtsContributionByCategory = (employee: Employee) => {
  const code = String(employee.esocialCategoryCode ?? '').trim();

  // eSocial categories in 7xx (contribuinte individual/TSVE) generally do not calculate FGTS,
  // except category 721 (diretor nao empregado, com FGTS).
  if (/^7\d\d$/.test(code)) {
    return code === '721';
  }

  return true;
};
const getWorkedDaysFactor = (params: { employee: Employee; month?: number; year?: number }) => {
  const { employee, month, year } = params;
  if (!month || !year) return 1;

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const totalDays = lastDay.getDate();

  const normalize = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

  let start = normalize(firstDay);
  let end = normalize(lastDay);

  if (employee.admissionDate) {
    const admission = normalize(new Date(employee.admissionDate));
    if (admission > start) start = admission;
  }

  if (employee.esocialContractEndDate) {
    const contractEnd = normalize(new Date(employee.esocialContractEndDate));
    if (contractEnd < end) end = contractEnd;
  }

  if (end < start) {
    return 0;
  }

  const millisPerDay = 24 * 60 * 60 * 1000;
  const workedDays = Math.floor((end.getTime() - start.getTime()) / millisPerDay) + 1;

  return Math.min(1, Math.max(0, workedDays / totalDays));
};

export function calculatePayrollForEmployee(params: {
  employee: Employee;
  inssTable: TaxTableInss[];
  irrfTable: TaxTableIrrf[];
  month?: number;
  year?: number;
}) {
  const { employee, inssTable, irrfTable, month, year } = params;

  let baseSalary = 0;
  let dsr = 0;
  let hourActivity = 0;

  const workedDaysFactor = getWorkedDaysFactor({ employee, month, year });

  if (employee.salaryType === 'hourly') {
    const weeklyHours = Number(employee.weeklyHours ?? 0);
    const hourlyRate = Number(employee.hourlyRate ?? 0);

    // Professor horista: base proporcional + 5% hora-atividade + DSR (1/6 de base+hora-atividade).
    const importedBase = Number(employee.baseSalary ?? 0);
    baseSalary = importedBase > 0 ? importedBase : weeklyHours * hourlyRate * 4.5;
    baseSalary = baseSalary * workedDaysFactor;
    hourActivity = baseSalary * 0.05;
    dsr = (baseSalary + hourActivity) / 6;
  } else {
    baseSalary = Number(employee.baseSalary ?? 0) * workedDaysFactor;
  }

  const grossSalary = round(baseSalary + dsr + hourActivity);

  const inssRow = findBracketByRange(inssTable, grossSalary);
  const inssValue = inssRow
    ? Math.max(0, round(grossSalary * Number(inssRow.rate) - Number(inssRow.deduction)))
    : 0;

  const dependentDeduction = irrfTable[0] ? Number(irrfTable[0].dependentDeduction ?? 0) : 0;
  const irrfBase = grossSalary - inssValue - (employee.dependents * dependentDeduction);
  const irrfRow = findBracketByRange(irrfTable, irrfBase);
  const irrfBeforeReduction = irrfRow
    ? Math.max(0, round(irrfBase * Number(irrfRow.rate) - Number(irrfRow.deduction)))
    : 0;

  const irrfValue = applyIrrfReduction2026({
    year,
    grossTaxableIncome: grossSalary,
    irrfBeforeReduction
  });

  const transportVoucherBase = Number(employee.transportVoucherValue ?? 0);
  const transportVoucher = round(Math.min(transportVoucherBase, grossSalary * 0.06));
  const mealVoucher = Number(employee.mealVoucherValue ?? 0);
  const unionFee = employee.unionFee ? 25 : 0;

  const totalDeductions = round(inssValue + irrfValue + transportVoucher + mealVoucher + unionFee);
  const netSalary = round(grossSalary - totalDeductions);
  const fgts = hasFgtsContributionByCategory(employee) ? round(grossSalary * 0.08) : 0;

  return {
    earnings: [
      { code: 'BASE', description: 'Salario Base', amount: round(baseSalary) },
      { code: 'DSR', description: 'DSR', amount: round(dsr) },
      { code: 'HORA_ATV', description: 'Hora Atividade', amount: round(hourActivity) }
    ].filter((item) => item.amount > 0),
    deductions: [
      { code: 'INSS', description: 'INSS', amount: inssValue },
      { code: 'IRRF', description: 'IRRF', amount: irrfValue },
      { code: 'VT', description: 'Vale Transporte', amount: transportVoucher },
      { code: 'VA', description: 'Vale Alimentacao', amount: mealVoucher },
      { code: 'SIND', description: 'Taxa Sindical', amount: unionFee }
    ].filter((item) => item.amount > 0),
    grossSalary,
    totalDeductions,
    netSalary,
    fgts
  } as PayrollCalculationResult;
}
