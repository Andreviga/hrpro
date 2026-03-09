import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  private normalizeAuditValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeAuditValue(item));
    }

    if (typeof value === 'object') {
      const candidate = value as { toJSON?: () => unknown };
      if (typeof candidate.toJSON === 'function') {
        const serialized = candidate.toJSON();
        if (serialized !== value) {
          return this.normalizeAuditValue(serialized);
        }
      }

      const objectValue: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (item === undefined) continue;
        objectValue[key] = this.normalizeAuditValue(item);
      }
      return objectValue;
    }

    return value;
  }

  async log(params: {
    companyId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
  }) {
    const before =
      params.before == null
        ? Prisma.JsonNull
        : (this.normalizeAuditValue(params.before) as Prisma.InputJsonValue);

    const after =
      params.after == null
        ? Prisma.JsonNull
        : (this.normalizeAuditValue(params.after) as Prisma.InputJsonValue);

    try {
      return await this.prisma.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          reason: params.reason,
          before,
          after
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit log skipped: ${params.entity}/${params.action} (${message})`);
      return null;
    }
  }
}
