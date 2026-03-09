import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TaxTablesService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listInss(companyId: string, month: number, year: number) {
    return this.prisma.taxTableInss.findMany({
      where: { companyId, month, year },
      orderBy: { minValue: 'asc' },
    });
  }

  async listIrrf(companyId: string, month: number, year: number) {
    return this.prisma.taxTableIrrf.findMany({
      where: { companyId, month, year },
      orderBy: { minValue: 'asc' },
    });
  }

  async upsertInss(
    companyId: string,
    data: {
      month: number;
      year: number;
      brackets: { minValue: number; maxValue: number; rate: number; deduction: number }[];
    },
    userId?: string,
  ) {
    const { month, year, brackets } = data;

    // Delete existing brackets for this period
    await this.prisma.taxTableInss.deleteMany({
      where: { companyId, month, year },
    });

    const created = [];
    for (const b of brackets) {
      const row = await this.prisma.taxTableInss.create({
        data: {
          companyId,
          month,
          year,
          minValue: b.minValue,
          maxValue: b.maxValue,
          rate: b.rate,
          deduction: b.deduction,
        },
      });
      created.push(row);
    }

    await this.audit.log({
      companyId,
      userId,
      action: 'tax_table_inss.upsert',
      entity: 'TaxTableInss',
      after: { month, year, brackets: created.length },
    });

    return created;
  }

  async upsertIrrf(
    companyId: string,
    data: {
      month: number;
      year: number;
      brackets: {
        minValue: number;
        maxValue: number;
        rate: number;
        deduction: number;
        dependentDeduction: number;
      }[];
    },
    userId?: string,
  ) {
    const { month, year, brackets } = data;

    await this.prisma.taxTableIrrf.deleteMany({
      where: { companyId, month, year },
    });

    const created = [];
    for (const b of brackets) {
      const row = await this.prisma.taxTableIrrf.create({
        data: {
          companyId,
          month,
          year,
          minValue: b.minValue,
          maxValue: b.maxValue,
          rate: b.rate,
          deduction: b.deduction,
          dependentDeduction: b.dependentDeduction,
        },
      });
      created.push(row);
    }

    await this.audit.log({
      companyId,
      userId,
      action: 'tax_table_irrf.upsert',
      entity: 'TaxTableIrrf',
      after: { month, year, brackets: created.length },
    });

    return created;
  }
}
