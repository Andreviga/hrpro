import { request } from './http';

export interface EsocialOccurrence {
  id: string;
  documentId: string;
  sourceType: string;
  occurrenceTypeCode?: string;
  occurrenceTypeLabel?: string;
  severity: 'ERROR' | 'WARNING' | 'INFO' | 'UNKNOWN';
  code?: string;
  description: string;
  location?: string;
  logicalXpath?: string;
  officialCatalogDescription?: string;
  probableCause?: string;
  suggestedAction?: string;
  category?: string;
  isBlocking: boolean;
  rawFragment?: string;
  createdAt: string;
}

export interface EsocialDocument {
  id: string;
  documentType: string;
  eventType?: string;
  externalEventId?: string;
  employerRegistrationType?: string;
  employerRegistrationNumber?: string;
  workerCpf?: string;
  protocolNumber?: string;
  receiptNumber?: string;
  statusCode?: string;
  statusDescription?: string;
  processingResult: 'success' | 'partial' | 'failed' | 'pending' | 'unknown';
  layoutVersion?: string;
  namespaceUri?: string;
  xmlHash: string;
  rawXml: string;
  parsedJson: unknown;
  parsingError?: string;
  xsdValidationStatus?: string;
  xsdValidationErrors?: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { occurrences: number };
  occurrences?: EsocialOccurrence[];
}

const uploadXml = async (payload: {
  xml?: string;
  validateXsd?: boolean;
  sourceLabel?: string;
  file?: File | null;
}) => {
  if (payload.file) {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.sourceLabel) formData.append('sourceLabel', payload.sourceLabel);
    if (payload.validateXsd !== undefined) formData.append('validateXsd', String(payload.validateXsd));

    return request<{ duplicated: boolean; document: EsocialDocument }>('/esocial/xml/import', {
      method: 'POST',
      body: formData
    });
  }

  return request<{ duplicated: boolean; document: EsocialDocument }>('/esocial/xml/import', {
    method: 'POST',
    body: JSON.stringify({
      xml: payload.xml,
      validateXsd: payload.validateXsd,
      sourceLabel: payload.sourceLabel
    })
  });
};

export const esocialApi = {
  importXml: uploadXml,

  getDocuments(filters?: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });

    return request<{
      total: number;
      page: number;
      pageSize: number;
      items: EsocialDocument[];
    }>(`/esocial/documents?${query.toString()}`);
  },

  getDocument(id: string) {
    return request<EsocialDocument>(`/esocial/documents/${id}`);
  },

  getDocumentOccurrences(id: string) {
    return request<EsocialOccurrence[]>(`/esocial/documents/${id}/occurrences`);
  },

  getOccurrences(filters?: Record<string, string | number | undefined>) {
    const query = new URLSearchParams();
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.set(key, String(value));
    });

    return request<{
      total: number;
      page: number;
      pageSize: number;
      items: EsocialOccurrence[];
    }>(`/esocial/occurrences?${query.toString()}`);
  },

  syncCatalog(messages?: Array<{
    code: string;
    officialDescription: string;
    humanExplanation?: string;
    probableCause?: string;
    suggestedAction?: string;
    category?: string;
  }>) {
    return request<{ syncedCount: number; source: string }>('/esocial/catalog/sync', {
      method: 'POST',
      body: JSON.stringify({ messages })
    });
  }
};
