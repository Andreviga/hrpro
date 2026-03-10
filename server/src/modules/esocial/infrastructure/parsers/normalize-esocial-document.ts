import { Injectable } from '@nestjs/common';
import { EsocialDocument } from '../../domain/interfaces/esocial-document.interface';
import { EsocialProcessingResult } from '../../domain/enums/esocial-processing-result.enum';
import { extractMetadata } from './extract-esocial-metadata';
import { extractOccurrences } from './extract-esocial-occurrences';
import { EsocialDocumentDetectionResult } from './detect-esocial-document-type';

const isFailureStatus = (statusCode?: string): boolean => {
  if (!statusCode) return false;
  const code = String(statusCode).trim();
  if (!code) return false;
  return !/^(0|1|2|3)/.test(code);
};

export const deriveProcessingResult = (params: {
  statusCode?: string;
  occurrencesCount: number;
  blockingOccurrencesCount: number;
}): EsocialProcessingResult => {
  if (params.blockingOccurrencesCount > 0) return EsocialProcessingResult.FAILED;
  if (isFailureStatus(params.statusCode)) return EsocialProcessingResult.FAILED;
  if (params.occurrencesCount > 0) return EsocialProcessingResult.PARTIAL;
  return EsocialProcessingResult.SUCCESS;
};

@Injectable()
export class NormalizeEsocialDocumentService {
  execute(params: {
    rawXml: string;
    parsed: unknown;
    detection: EsocialDocumentDetectionResult;
  }): EsocialDocument & { processingResult: EsocialProcessingResult } {
    const metadata = extractMetadata(params.parsed);
    const hasFailureStatus = isFailureStatus(metadata.statusCode);

    const occurrences = extractOccurrences({
      parsed: params.parsed,
      documentType: params.detection.documentType,
      statusCode: metadata.statusCode,
      hasFailureStatus
    });

    const blockingOccurrencesCount = occurrences.filter((item) => item.isBlocking).length;
    const processingResult = deriveProcessingResult({
      statusCode: metadata.statusCode,
      occurrencesCount: occurrences.length,
      blockingOccurrencesCount
    });

    const totals = [
      { key: 'occurrences_total', value: String(occurrences.length) },
      { key: 'occurrences_blocking', value: String(blockingOccurrencesCount) }
    ];

    return {
      documentType: params.detection.documentType,
      eventType: metadata.eventType,
      eventId: metadata.eventId,
      employerRegistrationType: metadata.employerRegistrationType,
      employerRegistrationNumber: metadata.employerRegistrationNumber,
      workerCpf: metadata.workerCpf,
      receiptNumber: metadata.receiptNumber,
      protocolNumber: metadata.protocolNumber,
      statusCode: metadata.statusCode,
      statusDescription: metadata.statusDescription,
      occurrences,
      totals,
      rawXml: params.rawXml,
      parsedJson: params.parsed,
      layoutVersion: params.detection.layoutVersion,
      namespaceUri: params.detection.namespaceUri,
      createdAt: new Date(),
      processingResult
    };
  }
}

export const normalizeEsocialDocument = (
  params: {
    rawXml: string;
    parsed: unknown;
    detection: EsocialDocumentDetectionResult;
  },
  service?: NormalizeEsocialDocumentService
) => {
  const normalizer = service ?? new NormalizeEsocialDocumentService();
  return normalizer.execute(params);
};
