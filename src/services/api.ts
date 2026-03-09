/**
 * API services for backend communication.
 */
import { request, getAuthToken, API_BASE } from './http';

export interface PaystubSummary {
  id: string;
  employeeId?: string;
  employeeName?: string;
  month: number;
  year: number;
  netSalary: number;
  filePath?: string;
}

export interface PaystubDetail {
  id: string;
  month: number;
  year: number;
  company?: {
    name: string;
    cnpj: string;
  };
  employee?: {
    fullName?: string;
    cpf?: string;
    position?: string;
    department?: string;
    admissionDate?: string;
    employeeCode?: string;
    pis?: string;
    dependents?: number;
  };
  earnings: {
    baseSalary: number;
    overtimeValue: number;
    nightShiftBonus: number;
    holidaysBonus: number;
    otherBonuses: number;
  };
  deductions: {
    inssDeduction: number;
    irrfDeduction: number;
    transportVoucherDeduction: number;
    mealVoucherDeduction: number;
    syndicateFee: number;
    otherDeductions: number;
  };
  summary: {
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    fgtsDeposit: number;
  };
  events?: Array<{
    id: string;
    code: string;
    description: string;
    type: 'earning' | 'deduction';
    amount: number;
  }>;
  bases?: {
    inssBase: number;
    fgtsBase: number;
    irrfBase: number;
    dependentDeduction?: number;
  };
}

export interface UpdatePaystubEventPayload {
  amount?: number;
  description?: string;
  reason?: string;
}

export const apiService = {
  async getPaystubs(): Promise<PaystubSummary[]> {
    return request<PaystubSummary[]>('/paystubs');
  },

  async getPaystubDetail(id: string): Promise<PaystubDetail | null> {
    return request<PaystubDetail>(`/paystubs/${id}`);
  },

  async updatePaystubEvent(paystubId: string, eventId: string, payload: UpdatePaystubEventPayload) {
    return request<{
      paystubId: string;
      event: {
        id: string;
        code: string;
        type: 'earning' | 'deduction';
        description: string;
        amount: number;
      };
      summary: {
        grossSalary: number;
        totalDeductions: number;
        netSalary: number;
        fgtsDeposit: number;
      };
    }>(`/paystubs/${paystubId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async uploadPayroll(file: File): Promise<{
    success: boolean;
    message: string;
    processedRows: number;
    failedRows: number;
    errors: string[];
    warnings?: string[];
    guideSummaries?: Array<{
      payrollRunId: string;
      month: number;
      year: number;
      employeesCount: number;
      totals: {
        grossSalary: number;
        totalDeductions: number;
        netSalary: number;
        fgts: number;
      };
      guides: {
        inss: number;
        irrf: number;
        fgts: number;
        transportVoucher: number;
        mealVoucher: number;
        loanConsigned: number;
        salaryFamily: number;
      };
    }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/imports/xlsx`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha no upload');
    }

    return response.json();
  }
};