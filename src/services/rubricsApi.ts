import { request } from './http';

export interface Rubric {
  id: string;
  companyId: string;
  code: string;
  name: string;
  description?: string | null;
  type: 'earning' | 'deduction';
  formula?: string | null;
  percentage?: number | null;
  fixedValue?: number | null;
  baseRubric?: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaxBracketInss {
  id: string;
  minValue: number;
  maxValue: number;
  rate: number;
  deduction: number;
}

export interface TaxBracketIrrf {
  id: string;
  minValue: number;
  maxValue: number;
  rate: number;
  deduction: number;
  dependentDeduction: number;
}

export interface PayrollGridData {
  payrollRunId: string | null;
  status: string | null;
  month: number;
  year: number;
  rubricColumns: string[];
  employees: {
    employeeId: string;
    fullName: string;
    cpf: string;
    position: string;
    department: string;
    salaryType: string;
    baseSalary: number;
    hourlyRate: number;
    weeklyHours: number;
    events: Record<string, number>;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    fgts: number;
  }[];
}

export const rubricsApi = {
  list(includeInactive = false): Promise<Rubric[]> {
    const qs = includeInactive ? '?includeInactive=true' : '';
    return request(`/rubrics${qs}`);
  },

  getById(id: string): Promise<Rubric> {
    return request(`/rubrics/${encodeURIComponent(id)}`);
  },

  create(data: Partial<Rubric>): Promise<Rubric> {
    return request('/rubrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<Rubric>): Promise<Rubric> {
    return request(`/rubrics/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<void> {
    return request(`/rubrics/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  seedDefaults(): Promise<Rubric[]> {
    return request('/rubrics/seed-defaults', { method: 'POST' });
  },
};

export const taxTablesApi = {
  listInss(month: number, year: number): Promise<TaxBracketInss[]> {
    return request(`/tax/inss?month=${month}&year=${year}`);
  },

  listIrrf(month: number, year: number): Promise<TaxBracketIrrf[]> {
    return request(`/tax/irrf?month=${month}&year=${year}`);
  },

  upsertInss(data: {
    month: number;
    year: number;
    brackets: { minValue: number; maxValue: number; rate: number; deduction: number }[];
  }): Promise<TaxBracketInss[]> {
    return request('/tax/inss', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  upsertIrrf(data: {
    month: number;
    year: number;
    brackets: {
      minValue: number;
      maxValue: number;
      rate: number;
      deduction: number;
      dependentDeduction: number;
    }[];
  }): Promise<TaxBracketIrrf[]> {
    return request('/tax/irrf', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const payrollGridApi = {
  getGrid(month: number, year: number): Promise<PayrollGridData> {
    return request(`/payroll/grid?month=${month}&year=${year}`);
  },
};
