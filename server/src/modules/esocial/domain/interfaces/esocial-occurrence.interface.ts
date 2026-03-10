import { EsocialOccurrenceSeverity } from '../enums/esocial-occurrence-severity.enum';
import { EsocialOccurrenceTypeLabel } from '../enums/esocial-occurrence-type-label.enum';

export interface EsocialOccurrence {
  sourceType: string;
  occurrenceTypeCode?: string;
  occurrenceTypeLabel: EsocialOccurrenceTypeLabel;
  severity: EsocialOccurrenceSeverity;
  code?: string;
  description: string;
  location?: string;
  logicalXpath?: string;
  isBlocking: boolean;
  isSuccessCompatible: boolean;
  rawFragment?: string;
}
