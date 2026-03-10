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
    // Idempotent open endpoint avoids duplicate run errors for the same competency.
    return request<PayrollRun>('/payroll/runs/open', {
      method: 'POST',
      body: JSON.stringify({ month, year })
    });
  },

  async calculatePayrollRun(payrollRunId: string): Promise<PayrollRun> {
    return request<PayrollRun>(`/payroll/runs/${payrollRunId}/calculate-sync`, {
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

  async generateDocumentsFromRun(
    payrollRunId: string,
    payload: {
      documentType: 'trct' | 'recibo_ferias' | 'holerite';
      templateId?: string;
      employeeIds?: string[];
      reason?: string;
      forceRegenerate?: boolean;
    },
    reprocess = false
  ) {
    const endpoint = reprocess
      ? `/payroll/runs/${payrollRunId}/documents/reprocess`
      : `/payroll/runs/${payrollRunId}/documents`;

    return request<{ createdCount: number; skippedCount: number; regeneratedFromPreviousCount?: number }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async removeEmployeeFromRun(payrollRunId: string, employeeId: string, reason?: string) {
    return request<{ removed: boolean; message?: string }>(
      `/payroll/runs/${payrollRunId}/employees/${employeeId}/remove`,
      {
        method: 'POST',
        body: JSON.stringify({ reason })
      }
    );
  },

  async getSummary(month: number, year: number) {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    return request<PayrollRunSummary>(`/payroll/runs/summary?${params.toString()}`);
  }
};
