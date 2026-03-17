import { request } from './http';
import { API_BASE, getAuthToken } from './http';

export type DocumentType =
  | 'trct'
  | 'termo_quitacao'
  | 'aviso_previo'
  | 'recibo_ferias'
  | 'aviso_ferias'
  | 'holerite'
  | 'recibo_13'
  | 'recibo_plr'
  | 'outros';

export type DocumentStatus = 'draft' | 'review' | 'approved' | 'signed' | 'finalized' | 'reopened';

export interface DocumentTemplate {
  id: string;
  type: DocumentType;
  name: string;
  description?: string | null;
  content: string;
  version: number;
  status: DocumentStatus;
  placeholders?: string[] | null;
  requiredPlaceholders?: string[] | null;
  deletedAt?: string | null;
}

export interface DocumentPayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'draft' | 'calculated' | 'closed';
  closedAt?: string | null;
}

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  content: string;
  filePath?: string | null;
  month?: number | null;
  year?: number | null;
  templateId?: string | null;
  placeholders?: Record<string, any> | null;
  payrollRun?: DocumentPayrollRun | null;
  createdAt?: string;
  updatedAt?: string;
}

export type UploadDocumentCategory = 'cartao_ponto' | 'rg' | 'cpf' | 'cnh' | 'outros';

export interface DocumentVersion {
  id: string;
  action: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
  createdBy?: string | null;
}

export interface BootstrapIncomeTemplateResponse {
  created: boolean;
  template: DocumentTemplate;
}

export interface GenerateIncomeStatementsResponse {
  templateCreated: boolean;
  createdCount: number;
  skippedCount: number;
  sourceRunStatus?: 'closed' | 'calculated';
  documents: Document[];
  skipped?: Array<{ employeeId: string; reason: string }>;
  noDataReason?: 'no_closed_payroll_results' | 'no_payroll_results_for_year' | 'no_payroll_results_for_selected_employees';
  closedRunsCount?: number;
  calculatedRunsCount?: number;
  existingCount?: number;
}

export const documentsApi = {
  async listDocuments(filters?: {
    employeeId?: string;
    month?: number;
    year?: number;
    type?: DocumentType;
    status?: DocumentStatus;
  }): Promise<Document[]> {
    const params = new URLSearchParams();
    if (filters?.employeeId) params.set('employeeId', filters.employeeId);
    if (filters?.month) params.set('month', String(filters.month));
    if (filters?.year) params.set('year', String(filters.year));
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    return request<Document[]>(`/documents?${params.toString()}`);
  },

  async getDocument(id: string): Promise<Document> {
    return request<Document>(`/documents/${id}`);
  },

  async listDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return request<DocumentVersion[]>(`/documents/${documentId}/versions`);
  },

  async listTemplates(filters?: { type?: DocumentType; status?: DocumentStatus; includeDeleted?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.includeDeleted) params.set('includeDeleted', 'true');
    return request<DocumentTemplate[]>(`/documents/templates?${params.toString()}`);
  },

  async createTemplate(payload: {
    type: DocumentType;
    name: string;
    description?: string;
    content: string;
    status?: DocumentStatus;
    requiredPlaceholders?: string[];
    reason?: string;
  }) {
    return request<DocumentTemplate>('/documents/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateTemplate(id: string, payload: Record<string, unknown> & { reason?: string }) {
    return request<DocumentTemplate>(`/documents/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async deleteTemplate(id: string, reason?: string) {
    return request<DocumentTemplate>(`/documents/templates/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
  },

  async restoreTemplate(id: string, reason?: string) {
    return request<DocumentTemplate>(`/documents/templates/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async listTemplateVersions(templateId: string) {
    return request<DocumentVersion[]>(`/documents/templates/${templateId}/versions`);
  },

  async bootstrapIncomeStatementTemplate(reason?: string) {
    return request<BootstrapIncomeTemplateResponse>('/documents/templates/bootstrap/informe-rendimentos', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async createDocument(payload: {
    templateId: string;
    employeeId: string;
    title?: string;
    placeholders: Record<string, string>;
    month?: number;
    year?: number;
    eventDate?: string;
    reason?: string;
  }) {
    return request<Document>('/documents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateDocument(id: string, payload: { content?: string; placeholders?: Record<string, string>; reason?: string }) {
    return request<Document>(`/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async changeStatus(id: string, status: DocumentStatus, reason?: string) {
    return request<Document>(`/documents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    });
  },

  async reopenDocument(id: string, reason?: string) {
    return request<Document>(`/documents/${id}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async signDocument(id: string, payload: { signatureType: 'digital' | 'token' | 'biometric'; reason?: string }) {
    return request<Document>(`/documents/${id}/sign`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async exportPayload(id: string) {
    return request(`/documents/${id}/export`);
  },

  async generateFromPayroll(payload: {
    payrollRunId: string;
    documentType: 'trct' | 'recibo_ferias' | 'holerite';
    templateId?: string;
    employeeIds?: string[];
    reason?: string;
  }) {
    return request(`/payroll-runs/${payload.payrollRunId}/documents`, {
      method: 'POST',
      body: JSON.stringify({
        documentType: payload.documentType,
        templateId: payload.templateId,
        employeeIds: payload.employeeIds,
        reason: payload.reason
      })
    });
  },

  async generateIncomeStatementsForYear(payload: {
    year: number;
    employeeIds?: string[];
    reason?: string;
    idempotent?: boolean;
  }) {
    return request<GenerateIncomeStatementsResponse>('/payroll/income-statements/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async uploadEmployeeDocument(
    employeeId: string,
    payload: {
      file: File;
      category: UploadDocumentCategory;
      title?: string;
      month?: number;
      year?: number;
      reason?: string;
    }
  ) {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('category', payload.category);
    if (payload.title) formData.append('title', payload.title);
    if (payload.month) formData.append('month', String(payload.month));
    if (payload.year) formData.append('year', String(payload.year));
    if (payload.reason) formData.append('reason', payload.reason);

    return request<Document>(`/documents/employee/${employeeId}/upload`, {
      method: 'POST',
      body: formData
    });
  },

  async importEmployeeDocumentsFromFolder(
    employeeId: string,
    payload?: {
      folderPath?: string;
      category?: UploadDocumentCategory;
      reason?: string;
    }
  ) {
    return request<{
      folderPath: string;
      processedCount: number;
      skippedCount: number;
      documents: Document[];
      skipped: Array<{ fileName: string; reason: string }>;
    }>(`/documents/employee/${employeeId}/import-folder`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {})
    });
  },

  async downloadOriginalDocumentFile(documentId: string) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/documents/${documentId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Falha ao baixar arquivo original');
    }

    const disposition = response.headers.get('Content-Disposition') ?? '';
    const contentType = response.headers.get('Content-Type') ?? 'application/octet-stream';
    const match = disposition.match(/filename=([^;]+)/i);
    const filename = match ? match[1].replace(/"/g, '').trim() : `documento-${documentId}`;
    const blob = await response.blob();

    return {
      blob,
      filename,
      contentType
    };
  }
};

