import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TimeBankService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(employeeId: string) {
    return this.prisma.timeBankEntry.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' }
    });
  }

  async createEntry(params: {
    companyId: string;
    userId?: string;
    employeeId: string;
    date: string;
    minutes: number;
    type: 'credit' | 'debit';
    note?: string;
  }) {
    const entry = await this.prisma.timeBankEntry.create({
      data: {
        employeeId: params.employeeId,
        date: new Date(params.date),
        minutes: params.minutes,
        type: params.type,
        note: params.note
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'create',
      entity: 'timebank_entry',
      entityId: entry.id,
      after: entry
    });

    return entry;
  }

  async closeMonth(params: {
    companyId: string;
    userId?: string;
    employeeId: string;
    month: number;
    year: number;
    approvedBy?: string;
  }) {
    const start = new Date(params.year, params.month - 1, 1);
    const end = new Date(params.year, params.month, 1);

    const entries = await this.prisma.timeBankEntry.findMany({
      where: {
        employeeId: params.employeeId,
        date: { gte: start, lt: end }
      }
    });

    const balance = entries.reduce((acc, entry) => {
      return acc + (entry.type === 'credit' ? entry.minutes : -entry.minutes);
    }, 0);

    const close = await this.prisma.timeBankClose.upsert({
      where: {
        employeeId_month_year: {
          employeeId: params.employeeId,
          month: params.month,
          year: params.year
        }
      },
      update: {
        balanceMinutes: balance,
        approvedBy: params.approvedBy
      },
      create: {
        employeeId: params.employeeId,
        month: params.month,
        year: params.year,
        balanceMinutes: balance,
        approvedBy: params.approvedBy
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'close',
      entity: 'timebank',
      entityId: close.id,
      after: close
    });

    return close;
  }
}
