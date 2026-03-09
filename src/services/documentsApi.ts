import { request } from './http';

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
  month?: number | null;
  year?: number | null;
  templateId?: string | null;
  placeholders?: Record<string, string> | null;
  payrollRun?: DocumentPayrollRun | null;
  createdAt?: string;
  updatedAt?: string;
}

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
  documents: Document[];
  skipped?: Array<{ employeeId: string; reason: string }>;
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
  }
};

