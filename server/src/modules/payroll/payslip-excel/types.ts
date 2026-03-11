import type { WorkBook } from 'xlsx';

export type PayrollItemType = 'earning' | 'deduction';

export interface PayslipWarning {
  code: string;
  message: string;
  fillLocation?: string;
  sourceSheet?: string;
  sourceTable?: string;
  sourceCell?: string;
}

export interface WorkbookCellValue {
  value: unknown;
  formattedValue?: string | null;
  formula?: string | null;
  sourceSheet: string;
  sourceTable?: string;
  sourceColumn?: string;
  sourceCell: string;
}

export interface NamedTableRow {
  [header: string]: WorkbookCellValue | undefined;
}

export interface NamedTableData {
  sheetName: string;
  tableName: string;
  ref: string;
  headers: string[];
  rows: NamedTableRow[];
}

export interface WorkbookNamedTable {
  sheetName: string;
  tableName: string;
  displayName: string;
  ref: string;
  path: string;
}

export interface LoadedWorkbook {
  filePath: string;
  workbook: WorkBook;
  namedTables: WorkbookNamedTable[];
}

export interface EmployeeLookupKey {
  cpf?: string | null;
  name?: string | null;
}

export interface CompositionLine {
  lineCode: string;
  description: string;
  quantity: number | null;
  unitValue: number | null;
  totalValue: number | null;
  sourceSheet: string;
  sourceTable?: string;
  sourceColumn?: string;
  note?: string | null;
}

export interface PayrollItem {
  payrollCode: string;
  description: string;
  amount: number;
  type: PayrollItemType;
  sourceSheet: string;
  sourceTable?: string;
  sourceColumn?: string;
  order: number;
}

export interface PayslipRawSources {
  registration?: Record<string, WorkbookCellValue | undefined>;
  classComposition?: Record<string, WorkbookCellValue | undefined>;
  monthlyPayroll?: Record<string, WorkbookCellValue | undefined>;
  thirteenthPayroll?: Record<string, WorkbookCellValue | undefined>;
  templateCells?: Record<string, WorkbookCellValue | undefined>;
  auxiliaryCells?: Record<string, WorkbookCellValue | undefined>;
}

export interface Payslip {
  title: string;
  employeeCode: string | null;
  employeeName: string;
  employeeCpf: string;
  employeeRole: string;
  admissionDate: string | null;
  companyName: string;
  companyCnpj: string | null;
  companyAddress: string | null;
  referenceMonth: string;
  /** total quantity of classes from composition (sum of all types) */
  totalClassQuantity: number | null;
  /** unit class value (from Tab auxílio, most common rate) */
  classUnitValue: number | null;
  classComposition: CompositionLine[];
  earnings: PayrollItem[];
  deductions: PayrollItem[];
  grossSalary: number | null;
  netSalary: number | null;
  pensionAlimony: number | null;
  fgts: number | null;
  foodAllowance: number | null;
  thirteenthSecondInstallment: number | null;
  thirteenthInss: number | null;
  thirteenthIrrf: number | null;
  calculationBase: number | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  pix: string | null;
  email: string | null;
  rawSources: PayslipRawSources;
  warnings: PayslipWarning[];
}

export interface CompanyRegistryEntry {
  name: string;
  cnpj: string;
  address: string;
}

export interface MappedPayrollSources {
  employeeLookup: EmployeeLookupKey;
  competenceLabel: string;
  monthlySheetName: string;
  registrationRow: NamedTableRow;
  classRow: NamedTableRow;
  monthlyRow: NamedTableRow;
  thirteenthRow?: NamedTableRow;
  templateCells: Record<string, WorkbookCellValue | undefined>;
  auxiliaryCells: Record<string, WorkbookCellValue | undefined>;
  warnings: PayslipWarning[];
}