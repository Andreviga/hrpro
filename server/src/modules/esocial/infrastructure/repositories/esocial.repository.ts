import { Injectable } from '@nestjs/common';
import { Prisma, EsocialOccurrenceSeverity } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma.service';

interface CreateDocumentInput {
  companyId: string;
  externalEventId?: string;
  documentType: string;
  eventType?: string;
  employerRegistrationType?: string;
  employerRegistrationNumber?: string;
  workerCpf?: string;
  protocolNumber?: string;
  receiptNumber?: string;
  statusCode?: string;
  statusDescription?: string;
  processingResult: string;
  layoutVersion?: string;
  namespaceUri?: string;
  xmlHash: string;
  rawXml: string;
  parsedJson: Prisma.InputJsonValue;
  parsingError?: string;
  xsdValidationStatus?: string;
  xsdValidationErrors?: Prisma.InputJsonValue;
  occurrences: Array<{
    sourceType: string;
    occurrenceTypeCode?: string;
    occurrenceTypeLabel?: string;
    severity: string;
    code?: string;
    description: string;
    location?: string;
    logicalXpath?: string;
    officialCatalogDescription?: string | null;
    probableCause?: string | null;
    suggestedAction?: string | null;
    category?: string | null;
    isBlocking: boolean;
    isSuccessCompatible: boolean;
    rawFragment?: string;
  }>;
}

@Injectable()
export class EsocialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDocumentByHash(companyId: string, xmlHash: string) {
    return this.prisma.esocialDocument.findUnique({
      where: {
        companyId_xmlHash: {
          companyId,
          xmlHash
        }
      },
      include: {
        occurrences: true
      }
    });
  }

  async createDocument(input: CreateDocumentInput) {
    return this.prisma.$transaction(async (tx) => {
      const createdDocument = await tx.esocialDocument.create({
        data: {
          companyId: input.companyId,
          externalEventId: input.externalEventId,
          documentType: input.documentType as any,
          eventType: input.eventType,
          employerRegistrationType: input.employerRegistrationType,
          employerRegistrationNumber: input.employerRegistrationNumber,
          workerCpf: input.workerCpf,
          protocolNumber: input.protocolNumber,
          receiptNumber: input.receiptNumber,
          statusCode: input.statusCode,
          statusDescription: input.statusDescription,
          processingResult: input.processingResult as any,
          layoutVersion: input.layoutVersion,
          namespaceUri: input.namespaceUri,
          xmlHash: input.xmlHash,
          rawXml: input.rawXml,
          parsedJson: input.parsedJson,
          parsingError: input.parsingError,
          xsdValidationStatus: input.xsdValidationStatus,
          xsdValidationErrors: input.xsdValidationErrors
        }
      });

      if (input.occurrences.length > 0) {
        await tx.esocialOccurrence.createMany({
          data: input.occurrences.map((occurrence) => ({
            documentId: createdDocument.id,
            sourceType: occurrence.sourceType,
            occurrenceTypeCode: occurrence.occurrenceTypeCode,
            occurrenceTypeLabel: occurrence.occurrenceTypeLabel,
            severity: occurrence.severity as EsocialOccurrenceSeverity,
            code: occurrence.code,
            description: occurrence.description,
            location: occurrence.location,
            logicalXpath: occurrence.logicalXpath,
            officialCatalogDescription: occurrence.officialCatalogDescription,
            probableCause: occurrence.probableCause,
            suggestedAction: occurrence.suggestedAction,
            category: occurrence.category,
            isBlocking: occurrence.isBlocking,
            isSuccessCompatible: occurrence.isSuccessCompatible,
            rawFragment: occurrence.rawFragment
          }))
        });
      }

      return tx.esocialDocument.findUniqueOrThrow({
        where: { id: createdDocument.id },
        include: {
          occurrences: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    });
  }

  async listDocuments(companyId: string, filters: {
    documentType?: string;
    eventType?: string;
    processingResult?: string;
    statusCode?: string;
    receiptNumber?: string;
    protocolNumber?: string;
    workerCpf?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.EsocialDocumentWhereInput = {
      companyId,
      documentType: filters.documentType ? (filters.documentType as any) : undefined,
      eventType: filters.eventType ? { equals: filters.eventType, mode: 'insensitive' } : undefined,
      processingResult: filters.processingResult ? (filters.processingResult as any) : undefined,
      statusCode: filters.statusCode ? { equals: filters.statusCode, mode: 'insensitive' } : undefined,
      receiptNumber: filters.receiptNumber ? { contains: filters.receiptNumber, mode: 'insensitive' } : undefined,
      protocolNumber: filters.protocolNumber ? { contains: filters.protocolNumber, mode: 'insensitive' } : undefined,
      workerCpf: filters.workerCpf ? filters.workerCpf.replace(/\D/g, '') : undefined
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.esocialDocument.count({ where }),
      this.prisma.esocialDocument.findMany({
        where,
        include: {
          _count: {
            select: { occurrences: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize
      })
    ]);

    return {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items
    };
  }

  async getDocument(companyId: string, documentId: string) {
    return this.prisma.esocialDocument.findFirst({
      where: {
        id: documentId,
        companyId
      },
      include: {
        occurrences: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async listDocumentOccurrences(companyId: string, documentId: string) {
    return this.prisma.esocialOccurrence.findMany({
      where: {
        documentId,
        document: {
          companyId
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async listOccurrences(companyId: string, filters: {
    severity?: string;
    code?: string;
    sourceType?: string;
    documentId?: string;
    workerCpf?: string;
    receiptNumber?: string;
    protocolNumber?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.EsocialOccurrenceWhereInput = {
      severity: filters.severity ? (filters.severity as any) : undefined,
      code: filters.code ? { equals: filters.code, mode: 'insensitive' } : undefined,
      sourceType: filters.sourceType ? { equals: filters.sourceType, mode: 'insensitive' } : undefined,
      documentId: filters.documentId,
      document: {
        companyId,
        workerCpf: filters.workerCpf ? filters.workerCpf.replace(/\D/g, '') : undefined,
        receiptNumber: filters.receiptNumber
          ? { contains: filters.receiptNumber, mode: 'insensitive' }
          : undefined,
        protocolNumber: filters.protocolNumber
          ? { contains: filters.protocolNumber, mode: 'insensitive' }
          : undefined
      }
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.esocialOccurrence.count({ where }),
      this.prisma.esocialOccurrence.findMany({
        where,
        include: {
          document: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize
      })
    ]);

    return {
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      items
    };
  }

  async findCatalogByCodes(codes: string[]) {
    if (codes.length === 0) return [];
    return this.prisma.esocialMessageCatalog.findMany({
      where: {
        code: { in: codes }
      }
    });
  }

  async syncCatalog(entries: Array<{
    code: string;
    officialDescription: string;
    humanExplanation?: string;
    probableCause?: string;
    suggestedAction?: string;
    category?: string;
  }>) {
    return this.prisma.$transaction(
      entries.map((entry) =>
        this.prisma.esocialMessageCatalog.upsert({
          where: { code: entry.code },
          update: {
            officialDescription: entry.officialDescription,
            humanExplanation: entry.humanExplanation,
            probableCause: entry.probableCause,
            suggestedAction: entry.suggestedAction,
            category: entry.category
          },
          create: {
            code: entry.code,
            officialDescription: entry.officialDescription,
            humanExplanation: entry.humanExplanation,
            probableCause: entry.probableCause,
            suggestedAction: entry.suggestedAction,
            category: entry.category
          }
        })
      )
    );
  }
}
