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

export function calculatePayrollForEmployee(params: {
  employee: Employee;
  inssTable: TaxTableInss[];
  irrfTable: TaxTableIrrf[];
  month?: number;
  year?: number;
}) {
  const { employee, inssTable, irrfTable, year } = params;

  let baseSalary = 0;
  let dsr = 0;
  let hourActivity = 0;

  if (employee.salaryType === 'hourly') {
    const weeklyHours = Number(employee.weeklyHours ?? 0);
    const hourlyRate = Number(employee.hourlyRate ?? 0);

    // Professor horista: base proporcional + 5% hora-atividade + DSR (1/6 de base+hora-atividade).
    const importedBase = Number(employee.baseSalary ?? 0);
    baseSalary = importedBase > 0 ? importedBase : weeklyHours * hourlyRate * 4.5;
    hourActivity = baseSalary * 0.05;
    dsr = (baseSalary + hourActivity) / 6;
  } else {
    baseSalary = Number(employee.baseSalary ?? 0);
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
  const fgts = round(grossSalary * 0.08);

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
