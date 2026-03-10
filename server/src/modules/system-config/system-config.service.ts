import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

const CONFIG_KEY = 'system_config';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(companyId: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { companyId_key: { companyId, key: CONFIG_KEY } }
    });
    return row ? (row.value as Record<string, unknown>) : null;
  }

  async upsertConfig(companyId: string, value: Record<string, unknown>): Promise<Record<string, unknown>> {
    const jsonValue = value as unknown as Prisma.InputJsonValue;
    const row = await this.prisma.systemConfig.upsert({
      where: { companyId_key: { companyId, key: CONFIG_KEY } },
      create: { companyId, key: CONFIG_KEY, value: jsonValue },
      update: { value: jsonValue }
    });
    return row.value as Record<string, unknown>;
  }

  async patchConfig(companyId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const existing = (await this.getConfig(companyId)) ?? {};
    const merged = { ...existing, ...patch };
    return this.upsertConfig(companyId, merged);
  }
}
