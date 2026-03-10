import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../audit/audit.service';
import { EsocialDocumentType } from '../../domain/enums/esocial-document-type.enum';
import { EsocialProcessingResult } from '../../domain/enums/esocial-processing-result.enum';
import { ParseEsocialXmlService } from '../../infrastructure/parsers/parse-esocial-xml';
import { NormalizeEsocialDocumentService } from '../../infrastructure/parsers/normalize-esocial-document';
import { ValidateEsocialXsdService } from '../../infrastructure/parsers/validate-esocial-xsd';
import { EsocialRepository } from '../../infrastructure/repositories/esocial.repository';
import { EsocialMessageCatalogService } from './esocial-message-catalog.service';
import { ImportEsocialXmlDto } from '../../presentation/dtos/import-esocial-xml.dto';
import { QueryEsocialDocumentsDto } from '../../presentation/dtos/query-esocial-documents.dto';
import { QueryEsocialOccurrencesDto } from '../../presentation/dtos/query-esocial-occurrences.dto';

@Injectable()
export class EsocialService {
  private readonly logger = new Logger(EsocialService.name);

  constructor(
    private readonly parser: ParseEsocialXmlService,
    private readonly normalizer: NormalizeEsocialDocumentService,
    private readonly xsdValidator: ValidateEsocialXsdService,
    private readonly repository: EsocialRepository,
    private readonly messageCatalogService: EsocialMessageCatalogService,
    private readonly audit: AuditService
  ) {}

  private resolveXmlPayload(dto: ImportEsocialXmlDto, file?: Express.Multer.File): string {
    if (file?.buffer) {
      return file.buffer.toString('utf-8');
    }

    if (dto.xml && dto.xml.trim()) {
      return dto.xml.trim();
    }

    if (dto.xmlBase64 && dto.xmlBase64.trim()) {
      try {
        return Buffer.from(dto.xmlBase64, 'base64').toString('utf-8');
      } catch {
        throw new BadRequestException('Invalid xmlBase64 payload.');
      }
    }

    throw new BadRequestException('XML payload is required. Send xml, xmlBase64, or file.');
  }

  private hashXml(xml: string) {
    return createHash('sha256').update(xml).digest('hex');
  }

  async importXml(params: {
    dto: ImportEsocialXmlDto;
    file?: Express.Multer.File;
    companyId: string;
    userId?: string;
  }) {
    const xml = this.resolveXmlPayload(params.dto, params.file);
    const xmlHash = this.hashXml(xml);

    const existing = await this.repository.findDocumentByHash(params.companyId, xmlHash);
    if (existing) {
      return {
        duplicated: true,
        document: existing
      };
    }

    try {
      const parsedResult = this.parser.execute(xml);
      const normalized = this.normalizer.execute({
        rawXml: xml,
        parsed: parsedResult.parsed,
        detection: parsedResult.detection
      });

      const xsdValidation = await this.xsdValidator.execute({
        xml,
        enabled: params.dto.validateXsd === true,
        documentType: normalized.documentType,
        eventType: normalized.eventType,
        layoutVersion: normalized.layoutVersion
      });

      const enrichedOccurrences = await this.messageCatalogService.enrichOccurrences(normalized.occurrences);

      const created = await this.repository.createDocument({
        companyId: params.companyId,
        externalEventId: normalized.eventId,
        documentType: normalized.documentType,
        eventType: normalized.eventType,
        employerRegistrationType: normalized.employerRegistrationType,
        employerRegistrationNumber: normalized.employerRegistrationNumber,
        workerCpf: normalized.workerCpf,
        protocolNumber: normalized.protocolNumber,
        receiptNumber: normalized.receiptNumber,
        statusCode: normalized.statusCode,
        statusDescription: normalized.statusDescription,
        processingResult: normalized.processingResult,
        layoutVersion: normalized.layoutVersion,
        namespaceUri: normalized.namespaceUri,
        xmlHash,
        rawXml: normalized.rawXml,
        parsedJson: normalized.parsedJson as Prisma.InputJsonValue,
        xsdValidationStatus: xsdValidation.status,
        xsdValidationErrors: xsdValidation.errors as Prisma.InputJsonValue,
        occurrences: enrichedOccurrences
      });

      await this.audit.log({
        companyId: params.companyId,
        userId: params.userId,
        action: 'import',
        entity: 'esocial_document',
        entityId: created.id,
        reason: params.dto.sourceLabel,
        after: {
          documentType: created.documentType,
          eventType: created.eventType,
          processingResult: created.processingResult,
          occurrences: created.occurrences.length
        }
      });

      return {
        duplicated: false,
        document: created
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`XML parsing import error: ${message}`);

      const created = await this.repository.createDocument({
        companyId: params.companyId,
        documentType: EsocialDocumentType.DESCONHECIDO,
        processingResult: EsocialProcessingResult.FAILED,
        xmlHash,
        rawXml: xml,
        parsedJson: {} as Prisma.InputJsonValue,
        parsingError: message,
        xsdValidationStatus: 'skipped',
        xsdValidationErrors: ['Parsing failed before XSD validation.'] as unknown as Prisma.InputJsonValue,
        occurrences: []
      });

      await this.audit.log({
        companyId: params.companyId,
        userId: params.userId,
        action: 'import_error',
        entity: 'esocial_document',
        entityId: created.id,
        reason: params.dto.sourceLabel,
        after: { parsingError: message }
      });

      return {
        duplicated: false,
        document: created
      };
    }
  }

  async listDocuments(companyId: string, query: QueryEsocialDocumentsDto) {
    return this.repository.listDocuments(companyId, {
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25
    });
  }

  async getDocument(companyId: string, documentId: string) {
    const document = await this.repository.getDocument(companyId, documentId);
    if (!document) {
      throw new NotFoundException('eSocial document not found.');
    }

    return document;
  }

  async listDocumentOccurrences(companyId: string, documentId: string) {
    await this.getDocument(companyId, documentId);
    return this.repository.listDocumentOccurrences(companyId, documentId);
  }

  async listOccurrences(companyId: string, query: QueryEsocialOccurrencesDto) {
    return this.repository.listOccurrences(companyId, {
      ...query,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 50
    });
  }

  async syncCatalog(messages?: Array<{
    code: string;
    officialDescription: string;
    humanExplanation?: string;
    probableCause?: string;
    suggestedAction?: string;
    category?: string;
  }>) {
    if (!messages || messages.length === 0) {
      const synced = await this.messageCatalogService.syncDefaultCatalog();
      return {
        syncedCount: synced.length,
        source: 'default'
      };
    }

    const synced = await this.messageCatalogService.syncCatalog(messages);
    return {
      syncedCount: synced.length,
      source: 'custom'
    };
  }
}
