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
  document?: {
    id: string;
    title: string;
    status: string;
    filePath: string;
    storedFilePath?: string | null;
    updatedAt?: string;
  } | null;
  company?: {
    name: string;
    cnpj: string;
  };
  payslip?: {
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
    classComposition: Array<{
      code: string;
      description: string;
      quantity: number;
      unitValue: number;
      totalValue: number;
    }>;
    earnings: Array<{
      code: string;
      description: string;
      amount: number;
      type: 'earning';
    }>;
    deductions: Array<{
      code: string;
      description: string;
      amount: number;
      type: 'deduction';
    }>;
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
    sourceWarnings?: Array<{
      code: string;
      message: string;
      fillLocation?: string;
      sourceSheet?: string;
      sourceTable?: string;
      sourceCell?: string;
    }>;
    createdAt: string;
  };
  employee?: {
    fullName?: string;
    cpf?: string;
    position?: string;
    department?: string;
    admissionDate?: string;
    employeeCode?: string;
    pis?: string;
    email?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    paymentMethod?: string;
    dependents?: number;
    salaryType?: string;
    baseSalary?: number | null;
    hourlyRate?: number | null;
    weeklyHours?: number | null;
    transportVoucherValue?: number | null;
    mealVoucherValue?: number | null;
  };
  earnings: {
    baseSalary: number;
    overtimeValue: number;
    nightShiftBonus: number;
    holidaysBonus: number;
    mealVoucherCredit?: number;
    otherBonuses: number;
  };
  deductions: {
    inssDeduction: number;
    irrfDeduction: number;
    transportVoucherDeduction: number;
    mealVoucherDeduction: number;
    pensionAlimony?: number;
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

export interface UpdatePaystubContentPayload {
  employee?: {
    fullName?: string;
    cpf?: string;
    position?: string;
    admissionDate?: string;
    email?: string;
    bankName?: string;
    bankAgency?: string;
    bankAccount?: string;
    paymentMethod?: string;
    employeeCode?: string;
    pis?: string;
    weeklyHours?: number;
    transportVoucherValue?: number;
    mealVoucherValue?: number;
  };
  companyProfile?: {
    name?: string;
    cnpj?: string;
    address?: string;
    logoUrl?: string;
  };
  payslipOverride?: Record<string, unknown>;
  reason?: string;
}

export interface SendPaystubEmailPayload {
  email?: string;
  subject?: string;
  message?: string;
}

const buildAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export const apiService = {
  async getPaystubs(): Promise<PaystubSummary[]> {
    return request<PaystubSummary[]>('/paystubs');
  },

  async getPaystubsAdmin(params?: {
    month?: number;
    year?: number;
    employeeName?: string;
  }): Promise<PaystubSummary[]> {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.employeeName) query.set('employeeName', params.employeeName);
    const qs = query.toString();
    return request<PaystubSummary[]>(`/paystubs/admin${qs ? `?${qs}` : ''}`);
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

  async updatePaystubContent(paystubId: string, payload: UpdatePaystubContentPayload) {
    return request<PaystubDetail>(`/paystubs/${paystubId}/content`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async fetchPaystubPdf(paystubId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/paystubs/${paystubId}/pdf`, {
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      if (response.status === 422) {
        let body: { message?: string; missingFields?: string[]; sourceHints?: Record<string, string> } = {};
        try {
          body = await response.json();
        } catch {
          // ignore parse error
        }
        const err = new Error(body.message || 'Holerite incompleto') as Error & {
          isValidationError: true;
          missingFields: string[];
          sourceHints: Record<string, string>;
        };
        (err as any).isValidationError = true;
        (err as any).missingFields = body.missingFields ?? [];
        (err as any).sourceHints = body.sourceHints ?? {};
        throw err;
      }
      const message = await response.text();
      throw new Error(message || 'Falha ao carregar PDF do holerite');
    }

    return response.blob();
  },

  async openPaystubPdf(paystubId: string): Promise<void> {
    const blob = await apiService.fetchPaystubPdf(paystubId);
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `holerite-${paystubId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
  },

  async sendPaystubByEmail(paystubId: string, payload?: SendPaystubEmailPayload) {
    return request<{
      sent: boolean;
      to: string;
      subject: string;
      filename: string;
      messageId?: string;
    }>(`/paystubs/${paystubId}/send-email`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {})
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

    const response = await fetch(`${API_BASE}/imports/xlsx`, {
      method: 'POST',
      body: formData,
      headers: buildAuthHeaders()
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha no upload');
    }

    return response.json();
  }
};
