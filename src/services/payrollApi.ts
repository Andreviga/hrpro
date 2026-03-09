import { request } from './http';

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'calculated' | 'closed';
  version: number;
  createdAt?: string;
  closedAt?: string | null;
}

export interface PayrollRunSummary {
  payrollRunId: string;
  month: number;
  year: number;
  status: 'draft' | 'calculated' | 'closed';
  closedAt?: string | null;
  employeesCount: number;
  totals: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    fgts: number;
  };
}

export const payrollApi = {
  async createPayrollRun(month: number, year: number): Promise<PayrollRun> {
    return request<PayrollRun>('/payroll-runs', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    });
  },

  async calculatePayrollRun(payrollRunId: string): Promise<PayrollRun> {
    return request<PayrollRun>(`/payroll-runs/${payrollRunId}/calculate-sync`, {
      method: 'POST'
    });
  },

  async closePayrollRun(payrollRunId: string) {
    return request(`/payroll-runs/${payrollRunId}/close`, {
      method: 'POST'
    });
  },

  async listRuns(filters?: { month?: number; year?: number; status?: 'draft' | 'calculated' | 'closed' }) {
    const params = new URLSearchParams();
    if (filters?.month) params.set('month', String(filters.month));
    if (filters?.year) params.set('year', String(filters.year));
    if (filters?.status) params.set('status', filters.status);
    return request<PayrollRun[]>(`/payroll/runs?${params.toString()}`);
  },

  async openRun(month: number, year: number) {
    return request<PayrollRun>('/payroll/runs/open', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    });
  },

  async closeRun(payrollRunId: string) {
    return request(`/payroll/runs/${payrollRunId}/close`, {
      method: 'POST'
    });
  },

  async reopenRun(payrollRunId: string) {
    return request<PayrollRun>(`/payroll/runs/${payrollRunId}/reopen`, {
      method: 'POST'
    });
  },

  async getSummary(month: number, year: number) {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    return request<PayrollRunSummary>(`/payroll/runs/summary?${params.toString()}`);
  }
};
