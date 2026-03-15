import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

const CONFIG_KEY = 'system_config';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  private isMissingTableError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const maybeCode = (error as { code?: string }).code;
    const message = String((error as { message?: string }).message ?? '');
    return maybeCode === 'P2021' || message.includes('does not exist');
  }

  async getConfig(companyId: string): Promise<Record<string, unknown> | null> {
    try {
      const row = await this.prisma.systemConfig.findUnique({
        where: { companyId_key: { companyId, key: CONFIG_KEY } }
      });
      return row ? (row.value as Record<string, unknown>) : null;
    } catch (error) {
      if (this.isMissingTableError(error)) {
        return null;
      }
      throw error;
    }
  }

  async upsertConfig(companyId: string, value: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const jsonValue = value as unknown as Prisma.InputJsonValue;
      const row = await this.prisma.systemConfig.upsert({
        where: { companyId_key: { companyId, key: CONFIG_KEY } },
        create: { companyId, key: CONFIG_KEY, value: jsonValue },
        update: { value: jsonValue }
      });
      return row.value as Record<string, unknown>;
    } catch (error) {
      if (this.isMissingTableError(error)) {
        return value;
      }
      throw error;
    }
  }

  async patchConfig(companyId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = (await this.getConfig(companyId)) ?? {};
    const merged = { ...existing, ...patch };
    return this.upsertConfig(companyId, merged);
  }
}
