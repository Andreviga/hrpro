import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialOccurrenceSeverity } from '../../domain/enums/esocial-occurrence-severity.enum';
import { EsocialOccurrenceTypeLabel } from '../../domain/enums/esocial-occurrence-type-label.enum';

export interface ClassificationInput {
  occurrenceTypeCode?: string;
  statusCode?: string;
  documentType: EsocialDocumentType;
  hasFailureStatus?: boolean;
}

export interface ClassificationOutput {
  severity: EsocialOccurrenceSeverity;
  occurrenceTypeLabel: EsocialOccurrenceTypeLabel;
  isBlocking: boolean;
  isSuccessCompatible: boolean;
}

const isFailureStatus = (statusCode?: string): boolean => {
  if (!statusCode) return false;
  const code = String(statusCode).trim();
  if (!code) return false;

  // eSocial success-like statuses usually start with 1/2/3 or are zero-like.
  if (/^(0|1|2|3)/.test(code)) return false;
  return true;
};

export const classifyEsocialOccurrence = (input: ClassificationInput): ClassificationOutput => {
  const normalizedType = String(input.occurrenceTypeCode ?? '').trim();

  if (normalizedType === '1') {
    return {
      severity: EsocialOccurrenceSeverity.ERROR,
      occurrenceTypeLabel: EsocialOccurrenceTypeLabel.ERROR,
      isBlocking: true,
      isSuccessCompatible: false
    };
  }

  if (normalizedType === '2') {
    return {
      severity: EsocialOccurrenceSeverity.WARNING,
      occurrenceTypeLabel: EsocialOccurrenceTypeLabel.WARNING,
      isBlocking: false,
      isSuccessCompatible: true
    };
  }

  if (normalizedType === '3') {
    return {
      severity: EsocialOccurrenceSeverity.INFO,
      occurrenceTypeLabel: EsocialOccurrenceTypeLabel.VALIDATION_HISTORY,
      isBlocking: false,
      isSuccessCompatible: true
    };
  }

  const fallbackAsError = input.hasFailureStatus || isFailureStatus(input.statusCode);
  return {
    severity: fallbackAsError ? EsocialOccurrenceSeverity.ERROR : EsocialOccurrenceSeverity.WARNING,
    occurrenceTypeLabel: EsocialOccurrenceTypeLabel.UNKNOWN,
    isBlocking: fallbackAsError,
    isSuccessCompatible: !fallbackAsError && input.documentType !== EsocialDocumentType.RETORNO_PROCESSAMENTO_LOTE
  };
};
