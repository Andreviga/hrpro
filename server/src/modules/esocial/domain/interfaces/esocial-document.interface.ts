import { EsocialDocumentType } from '../enums/esocial-document-type.enum';
import { EsocialOccurrence } from './esocial-occurrence.interface';

export interface EsocialDocument {
  documentType: EsocialDocumentType;
  eventType?: string;
  eventId?: string;
  employerRegistrationType?: string;
  employerRegistrationNumber?: string;
  workerCpf?: string;
  receiptNumber?: string;
  protocolNumber?: string;
  statusCode?: string;
  statusDescription?: string;
  occurrences: EsocialOccurrence[];
  totals: Array<{ key: string; value: string }>;
  rawXml: string;
  parsedJson: unknown;
  layoutVersion?: string;
  namespaceUri?: string;
  createdAt: Date;
}
