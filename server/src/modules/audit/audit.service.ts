import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

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
    return this.prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        reason: params.reason,
        before: params.before ?? Prisma.JsonNull,
        after: params.after ?? Prisma.JsonNull
      }
    });
  }
}
