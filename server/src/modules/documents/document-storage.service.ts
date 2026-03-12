import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import type { EmployeeDocument } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getUserDocumentPath, UserDocumentType } from './user-document-path.util';

interface StorageMetadata {
  userId: string;
  filePath: string;
  savedAt: string;
}

export interface SaveDocumentRecordInput {
  companyId: string;
  userId: string;
  employeeId: string;
  payrollRunId?: string;
  documentType: UserDocumentType;
  title: string;
  competenceMonth: number;
  competenceYear: number;
  status?: 'draft' | 'review' | 'approved' | 'signed' | 'finalized' | 'reopened';
  filename: string;
  pdfBuffer: Buffer;
  htmlContent: string;
  createdBy?: string;
  reason?: string;
  documentId?: string;
}

const getStorageMetadata = (placeholders: unknown): StorageMetadata | null => {
  if (!placeholders || typeof placeholders !== 'object') return null;

  const metadata = (placeholders as Record<string, unknown>).__storage;
  if (!metadata || typeof metadata !== 'object') return null;

  const filePath = String((metadata as Record<string, unknown>).filePath ?? '').trim();
  const userId = String((metadata as Record<string, unknown>).userId ?? '').trim();

  if (!filePath || !userId) return null;

  return {
    filePath,
    userId,
    savedAt: String((metadata as Record<string, unknown>).savedAt ?? '')
  };
};

const withStorageMetadata = (placeholders: unknown, metadata: StorageMetadata) => {
  const base = placeholders && typeof placeholders === 'object' ? (placeholders as Record<string, unknown>) : {};
  return {
    ...base,
    __storage: {
      userId: metadata.userId,
      filePath: metadata.filePath,
      savedAt: metadata.savedAt
    }
  };
};

@Injectable()
export class DocumentStorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async ensureUserDocumentFolders(companyId: string, userId: string) {
    const base = getUserDocumentPath(companyId, userId, 'documentos', new Date().getFullYear(), 1, 'tmp.txt');
    const userBaseFolder = dirname(base.folderAbsolutePath);
    const folders = ['holerites', 'informes', 'rescisoes', 'documentos'].map((folder) => {
      return join(userBaseFolder, folder);
    });

    await Promise.all(folders.map((folderPath) => mkdir(folderPath, { recursive: true })));

    return {
      baseFolder: userBaseFolder,
      folders
    };
  }

  getUserDocumentPath(
    companyId: string,
    userId: string,
    type: UserDocumentType,
    year: number,
    month: number,
    filename: string
  ) {
    return getUserDocumentPath(companyId, userId, type, year, month, filename);
  }

  async saveDocumentRecord(input: SaveDocumentRecordInput) {
    const pathInfo = this.getUserDocumentPath(
      input.companyId,
      input.userId,
      input.documentType,
      input.competenceYear,
      input.competenceMonth,
      input.filename
    );

    await this.ensureUserDocumentFolders(input.companyId, input.userId);
    await mkdir(pathInfo.folderAbsolutePath, { recursive: true });
    await writeFile(pathInfo.absolutePath, input.pdfBuffer);

    const storageMetadata: StorageMetadata = {
      userId: input.userId,
      filePath: pathInfo.relativePath,
      savedAt: new Date().toISOString()
    };

    const existing = input.documentId
      ? await this.prisma.employeeDocument.findUnique({ where: { id: input.documentId } })
      : await this.prisma.employeeDocument.findFirst({
          where: {
            companyId: input.companyId,
            userId: input.userId,
            employeeId: input.employeeId,
            payrollRunId: input.payrollRunId,
            type: input.documentType as any,
            month: input.competenceMonth,
            year: input.competenceYear,
            deletedAt: null
          },
          orderBy: { updatedAt: 'desc' }
        });

    const action = existing ? 'update_document' : 'create_document';
    const commonData = {
      companyId: input.companyId,
      employeeId: input.employeeId,
      payrollRunId: input.payrollRunId,
      type: input.documentType as any,
      title: input.title,
      status: (input.status ?? 'finalized') as any,
      content: input.htmlContent,
      userId: input.userId,
      filePath: pathInfo.relativePath,
      placeholders: withStorageMetadata(existing?.placeholders, storageMetadata),
      requiredPlaceholders: [],
      month: input.competenceMonth,
      year: input.competenceYear,
      createdBy: input.createdBy ?? input.userId
    };

    const document = existing
      ? await this.prisma.employeeDocument.update({
          where: { id: existing.id },
          data: {
            title: commonData.title,
            status: commonData.status,
            content: commonData.content,
            userId: commonData.userId,
            filePath: commonData.filePath,
            placeholders: commonData.placeholders,
            requiredPlaceholders: commonData.requiredPlaceholders,
            month: commonData.month,
            year: commonData.year
          }
        })
      : await this.prisma.employeeDocument.create({
          data: commonData
        });

    await this.prisma.documentVersion.create({
      data: {
        companyId: input.companyId,
        documentId: document.id,
        action,
        reason: input.reason,
        after: {
          filePath: pathInfo.relativePath,
          filename: basename(pathInfo.relativePath),
          status: document.status,
          month: document.month,
          year: document.year
        },
        createdBy: input.createdBy ?? input.userId
      }
    });

    await this.audit.log({
      companyId: input.companyId,
      userId: input.createdBy ?? input.userId,
      action: existing ? 'update' : 'create',
      entity: 'employee_document',
      entityId: document.id,
      reason: input.reason,
      after: {
        filePath: pathInfo.relativePath,
        type: input.documentType,
        status: document.status,
        competenceMonth: input.competenceMonth,
        competenceYear: input.competenceYear
      }
    });

    return {
      document,
      filePath: pathInfo.relativePath,
      absolutePath: pathInfo.absolutePath
    };
  }

  async listUserDocuments(userId: string, type?: UserDocumentType) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, employeeId: true }
    });

    if (!user || !user.employeeId) {
      return [];
    }

    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        companyId: user.companyId,
        OR: [{ userId }, { userId: null, employeeId: user.employeeId }],
        type: type ? (type as any) : undefined,
        deletedAt: null
      },
      orderBy: { updatedAt: 'desc' }
    });

    return documents
      .filter((document) => {
        const metadata = getStorageMetadata(document.placeholders);
        return !metadata || metadata.userId === userId;
      })
      .map((document) => {
        const metadata = getStorageMetadata(document.placeholders);
        return {
          id: document.id,
          companyId: document.companyId,
          userId: document.userId ?? metadata?.userId ?? userId,
          employeeId: document.employeeId,
          documentType: document.type,
          title: document.title,
          competenceMonth: document.month,
          competenceYear: document.year,
          status: document.status,
          filePath: document.filePath ?? metadata?.filePath ?? null,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        };
      });
  }

  getStoredFilePath(document: Pick<EmployeeDocument, 'filePath' | 'placeholders'>) {
    if (document.filePath && String(document.filePath).trim().length > 0) {
      return document.filePath;
    }

    const metadata = getStorageMetadata(document.placeholders);
    return metadata?.filePath ?? null;
  }

  getStoredOwnerUserId(document: Pick<EmployeeDocument, 'userId' | 'placeholders'>) {
    if (document.userId && String(document.userId).trim().length > 0) {
      return document.userId;
    }

    const metadata = getStorageMetadata(document.placeholders);
    return metadata?.userId ?? null;
  }

  async readStoredPdf(relativePath: string) {
    const pathInfo = getUserDocumentPath('company', 'user', 'documentos', 2000, 1, 'tmp.pdf');
    const rootFolder = resolve(pathInfo.rootFolder);
    const normalized = String(relativePath || '').replace(/^\/+/, '');
    const absolute = resolve(join(rootFolder, normalized));

    if (!absolute.startsWith(rootFolder)) {
      throw new NotFoundException('Stored document file not found');
    }

    try {
      return await readFile(absolute);
    } catch (_error) {
      throw new NotFoundException('Stored document file not found');
    }
  }
}
