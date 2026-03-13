import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { calculatePayrollForEmployee, hasFgtsContributionByCategory } from './payroll.utils';
import { DocumentsService } from '../documents/documents.service';
import { Payslip, PayslipDataBuilder } from '../documents/payslip-data.builder';
import { PayslipPdfService } from '../documents/payslip-pdf.service';
import { renderPayslipHtml } from '../documents/payslip-template';

interface CompanyProfileConfig {
  name: string;
  cnpj: string;
  address: string;
  logoUrl?: string;
}

type EditablePayslipOverride = Partial<Payslip> & {
  updatedAt?: string;
  updatedBy?: string | null;
};

const SYSTEM_CONFIG_KEY = 'system_config';

const DEFAULT_COMPANY_PROFILES: CompanyProfileConfig[] = [
  {
    name: 'Raizes Centro Educacional',
    cnpj: '20.755.729/0001-85',
    address: 'Rua Diogo de Sousa, 251, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  },
  {
    name: 'Raizes Recreacao Infantil',
    cnpj: '59.946.400/0001-37',
    address: 'Rua Diogo de Sousa, 257, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  }
];

@Injectable()
export class PayrollService {
  private queue: Queue;
  private logger = new Logger(PayrollService.name);
  private readonly requiredRubricCodes = ['BASE', 'INSS', 'IRRF'] as const;
  private readonly missingPayslipBuilder = {
    buildPayslip: async () => {
      throw new Error('PayslipDataBuilder dependency was not provided');
    }
  } as unknown as PayslipDataBuilder;
  private readonly missingPayslipPdf = {
    generatePayslipPdf: async () => {
      throw new Error('PayslipPdfService dependency was not provided');
    }
  } as unknown as PayslipPdfService;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private documents: DocumentsService,
    private payslipBuilder: PayslipDataBuilder = {
      buildPayslip: async () => {
        throw new Error('PayslipDataBuilder dependency was not provided');
      }
    } as unknown as PayslipDataBuilder,
    private payslipPdf: PayslipPdfService = {
      generatePayslipPdf: async () => {
        throw new Error('PayslipPdfService dependency was not provided');
      }
    } as unknown as PayslipPdfService
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.queue = new Queue('payroll.calculate', {
      connection: new IORedis(redisUrl, { maxRetriesPerRequest: null })
    });

    this.payslipBuilder = payslipBuilder ?? this.missingPayslipBuilder;
    this.payslipPdf = payslipPdf ?? this.missingPayslipPdf;
  }

  private onlyDigits(value: string | null | undefined) {
    return String(value ?? '').replace(/\D+/g, '');
  }

  private formatCnpj(value: string | null | undefined) {
    const digits = this.onlyDigits(value);
    if (digits.length !== 14) return String(value ?? '').trim();
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }

  private roundMoney(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private asMoney(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return this.roundMoney(parsed);
  }

  private asText(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async getSystemConfig(companyId: string): Promise<Record<string, unknown>> {
    const configRow = await this.prisma.systemConfig.findUnique({
      where: {
        companyId_key: {
          companyId,
          key: SYSTEM_CONFIG_KEY
        }
      }
    });

    if (!configRow || !this.isObject(configRow.value)) {
      return {};
    }

    return configRow.value;
  }

  private async saveSystemConfig(companyId: string, value: Record<string, unknown>) {
    const jsonValue = value as Prisma.InputJsonValue;

    await this.prisma.systemConfig.upsert({
      where: {
        companyId_key: {
          companyId,
          key: SYSTEM_CONFIG_KEY
        }
      },
      create: {
        companyId,
        key: SYSTEM_CONFIG_KEY,
        value: jsonValue
      },
      update: {
        value: jsonValue
      }
    });
  }

  private getCompanyProfiles(config: Record<string, unknown>) {
    const fromConfig = Array.isArray(config.companyProfiles)
      ? config.companyProfiles.filter((item): item is Record<string, unknown> => this.isObject(item))
      : [];

    const merged = new Map<string, CompanyProfileConfig>();
    for (const profile of DEFAULT_COMPANY_PROFILES) {
      const cnpjDigits = this.onlyDigits(profile.cnpj);
      if (!cnpjDigits) continue;
      merged.set(cnpjDigits, {
        ...profile,
        cnpj: this.formatCnpj(profile.cnpj)
      });
    }

    for (const profile of fromConfig) {
      const cnpjDigits = this.onlyDigits(String(profile.cnpj ?? ''));
      if (cnpjDigits.length !== 14) continue;

      const previous = merged.get(cnpjDigits);
      const next: CompanyProfileConfig = {
        name: this.asText(profile.name) ?? previous?.name ?? '-',
        cnpj: this.formatCnpj(cnpjDigits),
        address: this.asText(profile.address) ?? previous?.address ?? '-',
        logoUrl: this.asText(profile.logoUrl) ?? previous?.logoUrl
      };

      merged.set(cnpjDigits, next);
    }

    return Array.from(merged.values());
  }

  private getPaystubOverrides(config: Record<string, unknown>) {
    if (!this.isObject(config.paystubOverrides)) {
      return {} as Record<string, EditablePayslipOverride>;
    }

    const output: Record<string, EditablePayslipOverride> = {};
    for (const [paystubId, payload] of Object.entries(config.paystubOverrides)) {
      if (this.isObject(payload)) {
        output[paystubId] = payload as EditablePayslipOverride;
      }
    }

    return output;
  }

  private resolveCompanyProfile(
    profiles: CompanyProfileConfig[],
    employeeEmployerCnpj?: string | null,
    fallbackCompanyCnpj?: string | null
  ) {
    const byEmployee = this.onlyDigits(employeeEmployerCnpj);
    const byCompany = this.onlyDigits(fallbackCompanyCnpj);

    if (byEmployee.length === 14) {
      const found = profiles.find((profile) => this.onlyDigits(profile.cnpj) === byEmployee);
      if (found) return found;
    }

    if (byCompany.length === 14) {
      const found = profiles.find((profile) => this.onlyDigits(profile.cnpj) === byCompany);
      if (found) return found;
    }

    return null;
  }

  private parseClassComposition(input: unknown, fallback: Payslip['classComposition']) {
    if (!Array.isArray(input)) {
      return fallback;
    }

    const parsed = input
      .filter((row) => this.isObject(row))
      .map((row) => {
        const quantity = this.asMoney(row.quantity);
        const unitValue = this.asMoney(row.unitValue);
        const totalValue = this.asMoney(row.totalValue);
        return {
          code: this.asText(row.code) ?? '-',
          description: this.asText(row.description) ?? '-',
          quantity: quantity ?? 0,
          unitValue: unitValue ?? 0,
          totalValue: totalValue ?? 0
        };
      });

    return parsed.length > 0 ? parsed : fallback;
  }

  private parseRubrics(
    input: unknown,
    type: 'earning' | 'deduction',
    fallback: Payslip['earnings'] | Payslip['deductions']
  ) {
    if (!Array.isArray(input)) {
      return fallback;
    }

    const parsed = input
      .filter((row) => this.isObject(row))
      .map((row) => ({
        code: this.asText(row.code) ?? '-',
        description: this.asText(row.description) ?? '-',
        amount: this.asMoney(row.amount) ?? 0,
        type
      }));

    return parsed.length > 0 ? parsed : fallback;
  }

  private applyPayslipOverride(
    base: Payslip,
    companyProfile: CompanyProfileConfig | null,
    override: EditablePayslipOverride | undefined
  ): Payslip {
    const nextOverride = override ?? {};

    const classComposition = this.parseClassComposition(nextOverride.classComposition, base.classComposition);
    const earnings = this.parseRubrics(nextOverride.earnings, 'earning', base.earnings) as Payslip['earnings'];
    const deductions = this.parseRubrics(nextOverride.deductions, 'deduction', base.deductions) as Payslip['deductions'];

    const earningsTotal = this.roundMoney(earnings.reduce((sum, row) => sum + Number(row.amount ?? 0), 0));
    const deductionsTotal = this.roundMoney(deductions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0));

    const grossSalary = this.asMoney(nextOverride.grossSalary) ?? (nextOverride.earnings ? earningsTotal : base.grossSalary);
    const totalDiscounts =
      this.asMoney(nextOverride.totalDiscounts)
      ?? (nextOverride.deductions ? deductionsTotal : base.totalDiscounts);
    const netSalary = this.asMoney(nextOverride.netSalary) ?? this.roundMoney(Number(grossSalary ?? 0) - Number(totalDiscounts ?? 0));

    const totalClassQuantity =
      this.asMoney(nextOverride.totalClassQuantity)
      ?? this.roundMoney(classComposition.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0));

    const companyName = this.asText(nextOverride.companyName) ?? companyProfile?.name ?? base.companyName;
    const companyCnpj =
      this.asText(nextOverride.companyCnpj)
      ?? (companyProfile?.cnpj ? this.formatCnpj(companyProfile.cnpj) : base.companyCnpj);
    const companyAddress = this.asText(nextOverride.companyAddress) ?? companyProfile?.address ?? base.companyAddress;
    const companyLogoUrl = this.asText(nextOverride.companyLogoUrl) ?? companyProfile?.logoUrl ?? base.companyLogoUrl;

    return {
      ...base,
      ...nextOverride,
      companyName,
      companyCnpj,
      companyAddress,
      companyLogoUrl,
      classComposition,
      earnings,
      deductions,
      grossSalary: grossSalary ?? 0,
      totalDiscounts: totalDiscounts ?? 0,
      netSalary,
      totalClassQuantity,
      classUnitValue: this.asMoney(nextOverride.classUnitValue) ?? base.classUnitValue
    };
  }

  async createRun(companyId: string, month: number, year: number) {
    // Keep create endpoint backward compatible but idempotent.
    return this.openRun(companyId, month, year);
  }

  private async ensureCalculationPreconditions(payrollRun: { id: string; companyId: string; month: number; year: number }) {
    const [activeRubrics, inssCount, irrfCount] = await Promise.all([
      this.prisma.rubric.findMany({
        where: { companyId: payrollRun.companyId, active: true },
        select: { code: true }
      }),
      this.prisma.taxTableInss.count({
        where: {
          companyId: payrollRun.companyId,
          month: payrollRun.month,
          year: payrollRun.year
        }
      }),
      this.prisma.taxTableIrrf.count({
        where: {
          companyId: payrollRun.companyId,
          month: payrollRun.month,
          year: payrollRun.year
        }
      })
    ]);

    const activeRubricCodes = new Set(activeRubrics.map((item) => item.code.toUpperCase()));
    const missingRubricCodes = this.requiredRubricCodes.filter((code) => !activeRubricCodes.has(code));

    const issues: string[] = [];
    if (activeRubrics.length === 0) {
      issues.push('Nenhuma rubrica ativa encontrada.');
    } else if (missingRubricCodes.length > 0) {
      issues.push(`Rubricas obrigatorias ausentes: ${missingRubricCodes.join(', ')}.`);
    }

    if (inssCount === 0) {
      issues.push('Tabela INSS não configurada para a competência.');
    }

    if (irrfCount === 0) {
      issues.push('Tabela IRRF não configurada para a competência.');
    }

    if (issues.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Cálculo bloqueado: configure Rubricas + INSS + IRRF antes de calcular a folha.',
        code: 'PAYROLL_CALC_PRECONDITION_FAILED',
        details: {
          payrollRunId: payrollRun.id,
          month: payrollRun.month,
          year: payrollRun.year,
          issues,
          missingRubricCodes,
          requiredRubricCodes: [...this.requiredRubricCodes],
          inssBracketsCount: inssCount,
          irrfBracketsCount: irrfCount
        }
      });
    }
  }

  async listRuns(companyId: string, filters: { month?: number; year?: number; status?: 'draft' | 'calculated' | 'closed' }) {
    return this.prisma.payrollRun.findMany({
      where: {
        companyId,
        month: filters.month,
        year: filters.year,
        status: filters.status as any
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async openRun(companyId: string, month: number, year: number, userId?: string) {
    const closedRun = await this.prisma.payrollRun.findFirst({
      where: { companyId, month, year, status: 'closed' }
    });

    if (closedRun) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Competência já fechada para esta empresa.',
        code: 'PAYROLL_COMPETENCE_CLOSED',
        details: { payrollRunId: closedRun.id, month, year }
      });
    }

    const existingOpen = await this.prisma.payrollRun.findFirst({
      where: { companyId, month, year, status: { in: ['draft', 'calculated'] } },
      orderBy: { createdAt: 'desc' }
    });

    if (existingOpen) {
      return existingOpen;
    }

    const created = await this.prisma.payrollRun.create({
      data: { companyId, month, year }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'open',
      entity: 'payroll_run',
      entityId: created.id,
      after: { status: created.status, month: created.month, year: created.year }
    });

    return created;
  }

  async enqueueCalculate(payrollRunId: string, userId?: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    const existingResultsCount = await this.prisma.payrollResult.count({ where: { payrollRunId } });
    if (existingResultsCount === 0) {
      await this.ensureCalculationPreconditions(payrollRun);
    }

    await this.queue.add('calculate', { payrollRunId, userId });
    return { queued: true };
  }

  async calculateRun(payrollRunId: string, userId?: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    const existingResultsCount = await this.prisma.payrollResult.count({
      where: { payrollRunId }
    });

    if (payrollRun.status === 'draft' && existingResultsCount > 0) {
      const updatedFromExisting = await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: { status: 'calculated' }
      });

      await this.audit.log({
        companyId: payrollRun.companyId,
        userId,
        action: 'calculate',
        entity: 'payroll_run',
        entityId: payrollRunId,
        after: {
          status: updatedFromExisting.status,
          source: 'existing_results',
          existingResultsCount
        }
      });

      return updatedFromExisting;
    }

    await this.ensureCalculationPreconditions(payrollRun);

    const employees = await this.prisma.employee.findMany({
      where: { companyId: payrollRun.companyId, status: 'active' }
    });

    const inssTable = await this.prisma.taxTableInss.findMany({
      where: { companyId: payrollRun.companyId, month: payrollRun.month, year: payrollRun.year },
      orderBy: { minValue: 'asc' }
    });

    const irrfTable = await this.prisma.taxTableIrrf.findMany({
      where: { companyId: payrollRun.companyId, month: payrollRun.month, year: payrollRun.year },
      orderBy: { minValue: 'asc' }
    });

    const resultIds = await this.prisma.payrollResult.findMany({
      where: { payrollRunId },
      select: { id: true }
    });

    await this.prisma.$transaction([
      this.prisma.payrollEvent.deleteMany({
        where: { payrollResultId: { in: resultIds.map((item) => item.id) } }
      }),
      this.prisma.payrollResult.deleteMany({ where: { payrollRunId } })
    ]);

    for (const employee of employees) {
      const calc = calculatePayrollForEmployee({
        employee,
        inssTable,
        irrfTable,
        month: payrollRun.month,
        year: payrollRun.year
      });

      const payrollResult = await this.prisma.payrollResult.create({
        data: {
          payrollRunId,
          employeeId: employee.id,
          grossSalary: calc.grossSalary,
          totalDeductions: calc.totalDeductions,
          netSalary: calc.netSalary,
          fgts: calc.fgts
        }
      });

      for (const item of calc.earnings) {
        await this.prisma.payrollEvent.create({
          data: {
            payrollResultId: payrollResult.id,
            code: item.code,
            description: item.description,
            type: 'earning',
            amount: item.amount
          }
        });
      }

      for (const item of calc.deductions) {
        await this.prisma.payrollEvent.create({
          data: {
            payrollResultId: payrollResult.id,
            code: item.code,
            description: item.description,
            type: 'deduction',
            amount: item.amount
          }
        });
      }
    }

    const updated = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'calculated' }
    });

    await this.audit.log({
      companyId: payrollRun.companyId,
      userId,
      action: 'calculate',
      entity: 'payroll_run',
      entityId: payrollRunId,
      after: { status: updated.status }
    });

    return updated;
  }

  async closeRun(payrollRunId: string, userId?: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    if (payrollRun.status === 'closed') {
      this.logger.warn(`Payroll run ${payrollRunId} already closed.`);
      return { payrollRun, autoGeneration: { alreadyClosed: true } };
    }

    const existingClosed = await this.prisma.payrollRun.findFirst({
      where: {
        companyId: payrollRun.companyId,
        month: payrollRun.month,
        year: payrollRun.year,
        status: 'closed',
        id: { not: payrollRun.id }
      }
    });

    if (existingClosed) {
      this.logger.warn(
        `Duplicate close attempt for company ${payrollRun.companyId} competence ${payrollRun.month}/${payrollRun.year}.`
      );
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Competência já fechada para esta empresa.',
        code: 'PAYROLL_CLOSE_DUPLICATE',
        details: { existingPayrollRunId: existingClosed.id }
      });
    }

    // Build immutable snapshot of all results + events before closing
    const resultsForSnapshot = await this.prisma.payrollResult.findMany({
      where: { payrollRunId },
      include: {
        employee: { select: { fullName: true, cpf: true } },
        events: { orderBy: { code: 'asc' } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const closedSnapshot = {
      capturedAt: new Date().toISOString(),
      month: payrollRun.month,
      year: payrollRun.year,
      resultCount: resultsForSnapshot.length,
      results: resultsForSnapshot.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee.fullName,
        employeeCpf: r.employee.cpf,
        grossSalary: Number(r.grossSalary),
        totalDeductions: Number(r.totalDeductions),
        netSalary: Number(r.netSalary),
        fgts: Number(r.fgts),
        events: r.events.map((e) => ({
          id: e.id,
          code: e.code,
          description: e.description,
          type: e.type,
          amount: Number(e.amount)
        }))
      }))
    };

    const closed = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'closed', closedAt: new Date(), closedSnapshot }
    });

    await this.audit.log({
      companyId: payrollRun.companyId,
      userId,
      action: 'close',
      entity: 'payroll_run',
      entityId: payrollRunId,
      after: { status: closed.status, closedAt: closed.closedAt }
    });

    this.logger.log(`Payroll run ${payrollRunId} closed. Starting auto generation.`);
    let autoGeneration = {} as Record<string, unknown>;
    try {
      autoGeneration = await this.autoGenerateDocumentsOnClose({ payrollRun: closed, userId });
      this.logger.log(`Auto generation summary for run ${payrollRunId}: ${JSON.stringify(autoGeneration)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Auto generation failed for run ${payrollRunId}: ${message}`);
      throw error;
    }

    return { payrollRun: closed, autoGeneration };
  }

  async closeRunWithValidation(payrollRunId: string, userId?: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    if (payrollRun.status !== 'calculated' && payrollRun.status !== 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'A folha precisa estar calculada antes do fechamento.',
        code: 'PAYROLL_CLOSE_NOT_CALCULATED',
        details: { payrollRunId }
      });
    }

    return this.closeRun(payrollRunId, userId);
  }

  async reopenRun(payrollRunId: string, userId?: string, reason?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Motivo de reabertura e obrigatorio.',
        code: 'PAYROLL_REOPEN_REASON_REQUIRED'
      });
    }

    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    if (payrollRun.status !== 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Somente folhas fechadas podem ser reabertas.',
        code: 'PAYROLL_REOPEN_NOT_CLOSED',
        details: { payrollRunId }
      });
    }

    const otherClosed = await this.prisma.payrollRun.findFirst({
      where: {
        companyId: payrollRun.companyId,
        month: payrollRun.month,
        year: payrollRun.year,
        status: 'closed',
        id: { not: payrollRunId }
      }
    });

    if (otherClosed) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Outra folha já está fechada para esta competência.',
        code: 'PAYROLL_REOPEN_DUPLICATE',
        details: { payrollRunId: otherClosed.id }
      });
    }

    const reopened = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'calculated',
        closedAt: null,
        reopenedAt: new Date(),
        reopenedBy: userId,
        reopenReason: reason.trim()
      }
    });

    await this.audit.log({
      companyId: payrollRun.companyId,
      userId,
      action: 'reopen',
      entity: 'payroll_run',
      entityId: payrollRunId,
      reason: reason.trim(),
      after: { status: reopened.status }
    });

    return reopened;
  }

  async getRunSummary(companyId: string, month: number, year: number) {
    const closedRun = await this.prisma.payrollRun.findFirst({
      where: { companyId, month, year, status: 'closed' }
    });

    const payrollRun = closedRun
      ? closedRun
      : await this.prisma.payrollRun.findFirst({
          where: { companyId, month, year },
          orderBy: { createdAt: 'desc' }
        });

    if (!payrollRun) throw new NotFoundException('Payroll run not found');

    const summary = await this.prisma.payrollResult.aggregate({
      where: { payrollRunId: payrollRun.id },
      _sum: {
        grossSalary: true,
        totalDeductions: true,
        netSalary: true,
        fgts: true
      },
      _count: { _all: true }
    });

    return {
      payrollRunId: payrollRun.id,
      month: payrollRun.month,
      year: payrollRun.year,
      status: payrollRun.status,
      closedAt: payrollRun.closedAt,
      employeesCount: summary._count._all,
      totals: {
        grossSalary: Number(summary._sum.grossSalary ?? 0),
        totalDeductions: Number(summary._sum.totalDeductions ?? 0),
        netSalary: Number(summary._sum.netSalary ?? 0),
        fgts: Number(summary._sum.fgts ?? 0)
      }
    };
  }

  private async listActivePaystubDocuments(params: {
    payrollRunIds: string[];
    employeeIds: string[];
  }) {
    if (params.payrollRunIds.length === 0 || params.employeeIds.length === 0) {
      return new Map<string, { id: string }>();
    }

    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        payrollRunId: { in: params.payrollRunIds },
        employeeId: { in: params.employeeIds },
        type: 'holerite' as any,
        deletedAt: null
      },
      select: {
        id: true,
        employeeId: true,
        payrollRunId: true
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    const lookup = new Map<string, { id: string }>();
    for (const document of documents) {
      const key = `${document.payrollRunId}:${document.employeeId}`;
      if (!lookup.has(key)) {
        lookup.set(key, { id: document.id });
      }
    }

    return lookup;
  }

  async listPaystubsByEmployee(employeeId: string) {
    const results = await this.prisma.payrollResult.findMany({
      where: { employeeId },
      include: { payrollRun: true, employee: true },
      orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }]
    });

    const documentLookup = await this.listActivePaystubDocuments({
      payrollRunIds: results.map((result) => result.payrollRunId),
      employeeIds: results.map((result) => result.employeeId)
    });

    return results.map((result) => {
      const documentKey = `${result.payrollRunId}:${result.employeeId}`;

      return {
        id: result.id,
        employeeId: result.employeeId,
        employeeName: result.employee.fullName,
        month: result.payrollRun.month,
        year: result.payrollRun.year,
        netSalary: Number(result.netSalary),
        filePath: documentLookup.has(documentKey)
          ? `/documents/${documentLookup.get(documentKey)?.id}/export/pdf`
          : `/paystubs/${result.id}/pdf`
      };
    });
  }

  async listPaystubsByCompany(companyId: string) {
    return this.listPaystubsForCompany({ companyId });
  }

  async listPaystubsForCompany(params: {
    companyId: string;
    month?: number;
    year?: number;
    employeeId?: string;
    employeeName?: string;
  }) {
    const results = await this.prisma.payrollResult.findMany({
      where: {
        payrollRun: {
          is: {
            companyId: params.companyId,
            ...(params.month ? { month: params.month } : {}),
            ...(params.year ? { year: params.year } : {})
          }
        },
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
        ...(params.employeeName
          ? {
              employee: {
                is: {
                  fullName: {
                    contains: params.employeeName,
                    mode: 'insensitive'
                  }
                }
              }
            }
          : {})
      },
      include: { payrollRun: true, employee: true },
      orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }, { employee: { fullName: 'asc' } }]
    });

    const documentLookup = await this.listActivePaystubDocuments({
      payrollRunIds: results.map((result) => result.payrollRunId),
      employeeIds: results.map((result) => result.employeeId)
    });

    return results.map((result) => {
      const documentKey = `${result.payrollRunId}:${result.employeeId}`;

      return {
        id: result.id,
        employeeId: result.employeeId,
        employeeName: result.employee.fullName,
        month: result.payrollRun.month,
        year: result.payrollRun.year,
        netSalary: Number(result.netSalary),
        filePath: documentLookup.has(documentKey)
          ? `/documents/${documentLookup.get(documentKey)?.id}/export/pdf`
          : `/paystubs/${result.id}/pdf`
      };
    });
  }

  async removeEmployeeFromRun(params: {
    payrollRunId: string;
    employeeId: string;
    companyId: string;
    userId?: string;
    reason?: string;
  }) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: params.payrollRunId } });
    if (!payrollRun || payrollRun.companyId !== params.companyId) {
      throw new NotFoundException('Payroll run not found');
    }

    if (payrollRun.status === 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Competência fechada. Não é possível remover funcionário da folha.',
        code: 'PAYROLL_RUN_CLOSED',
        details: { payrollRunId: params.payrollRunId }
      });
    }

    const payrollResult = await this.prisma.payrollResult.findUnique({
      where: {
        payrollRunId_employeeId: {
          payrollRunId: params.payrollRunId,
          employeeId: params.employeeId
        }
      },
      include: { employee: true }
    });

    const now = new Date();

    const txResult = await this.prisma.$transaction(async (tx) => {
      let removedPayrollResult = false;

      if (payrollResult) {
        await tx.payrollEvent.deleteMany({ where: { payrollResultId: payrollResult.id } });
        await tx.payrollResult.delete({ where: { id: payrollResult.id } });
        removedPayrollResult = true;
      }

      const documentsUpdate = await tx.employeeDocument.updateMany({
        where: {
          companyId: params.companyId,
          employeeId: params.employeeId,
          payrollRunId: params.payrollRunId,
          deletedAt: null
        },
        data: {
          deletedAt: now,
          deletedBy: params.userId ?? null,
          deletedReason: params.reason ?? 'removed_from_payroll_run'
        }
      });

      return {
        removedPayrollResult,
        deletedDocumentsCount: Number(documentsUpdate?.count ?? 0)
      };
    });

    const removedPayrollResult = txResult.removedPayrollResult;
    const deletedDocumentsCount = txResult.deletedDocumentsCount;
    const removed = removedPayrollResult || deletedDocumentsCount > 0;

    if (!removed) {
      return { removed: false, message: 'Funcionário não encontrado nesta competência.' };
    }

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'remove_employee_from_run',
      entity: 'payroll_run',
      entityId: params.payrollRunId,
      reason: params.reason,
      after: {
        payrollRunId: params.payrollRunId,
        employeeId: params.employeeId,
        employeeName: payrollResult?.employee.fullName,
        removedPayrollResult,
        deletedDocumentsCount
      }
    });

    return {
      removed,
      payrollRunId: params.payrollRunId,
      employeeId: params.employeeId,
      employeeName: payrollResult?.employee.fullName,
      removedPayrollResult,
      deletedDocumentsCount
    };
  }

  async previewCalculation(companyId: string, employeeId: string, month: number, year: number) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.companyId !== companyId) throw new NotFoundException('Employee not found');

    const inssTable = await this.prisma.taxTableInss.findMany({
      where: { companyId, month, year },
      orderBy: { minValue: 'asc' }
    });

    const irrfTable = await this.prisma.taxTableIrrf.findMany({
      where: { companyId, month, year },
      orderBy: { minValue: 'asc' }
    });

    return calculatePayrollForEmployee({ employee, inssTable, irrfTable, month, year });
  }

  async getPaystubDetail(
    paystubId: string,
    requester?: { companyId: string; role: string; employeeId?: string | null }
  ) {
    const result = await this.prisma.payrollResult.findUnique({
      where: { id: paystubId },
      include: {
        payrollRun: { include: { company: true } },
        events: true,
        employee: true
      }
    });

    if (!result) throw new NotFoundException('Paystub not found');

    if (requester) {
      const isAdminScope = ['admin', 'rh', 'manager'].includes(requester.role);
      if (isAdminScope) {
        if (result.payrollRun.companyId !== requester.companyId) {
          throw new NotFoundException('Paystub not found');
        }
      } else if (!requester.employeeId || requester.employeeId !== result.employeeId) {
        throw new NotFoundException('Paystub not found');
      }
    }

    const earnings = result.events.filter((event) => event.type === 'earning');
    const deductions = result.events.filter((event) => event.type === 'deduction');

    const sumByCode = (items: typeof result.events, code: string) =>
      items.filter((item) => item.code === code).reduce((acc, item) => acc + Number(item.amount), 0);
    const sumByDescription = (items: typeof result.events, keyword: string) =>
      items
        .filter((item) => item.description.toLowerCase().includes(keyword))
        .reduce((acc, item) => acc + Number(item.amount), 0);

    const irrfBaseRow = await this.prisma.taxTableIrrf.findFirst({
      where: {
        companyId: result.payrollRun.companyId,
        month: result.payrollRun.month,
        year: result.payrollRun.year
      },
      orderBy: { minValue: 'asc' }
    });

    const dependentDeduction = Number(irrfBaseRow?.dependentDeduction ?? 0);
    const inssValue = sumByCode(deductions, 'INSS');
    const irrfBase = Math.max(0, Number(result.grossSalary) - inssValue - (result.employee.dependents * dependentDeduction));
    const pensionAlimony = sumByCode(deductions, 'PENSAO') + sumByDescription(deductions, 'pensao');
    const mealVoucherCredit = sumByCode(earnings, 'VA');

    const paystubDocument = await this.prisma.employeeDocument.findFirst({
      where: {
        companyId: result.payrollRun.companyId,
        payrollRunId: result.payrollRunId,
        employeeId: result.employeeId,
        type: 'holerite' as any,
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        status: true,
        filePath: true,
        updatedAt: true
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    const payslip = await this.payslipBuilder
      .buildPayslip(result.employeeId, {
        companyId: result.payrollRun.companyId,
        payrollRunId: result.payrollRunId,
        month: result.payrollRun.month,
        year: result.payrollRun.year
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'unknown_error';
        this.logger.warn(
          `Falling back to runtime payslip detail for ${paystubId}: ${message}`
        );

        return this.buildFallbackPayslip({
          companyId: result.payrollRun.companyId,
          companyName: result.payrollRun.company.name,
          companyCnpj: result.payrollRun.company.cnpj,
          companyAddress: 'Endereço não informado',
          employeeId: result.employeeId,
          employeeName: result.employee.fullName,
          employeeCpf: result.employee.cpf,
          employeeCode: result.employee.employeeCode,
          employeeRole: result.employee.position,
          admissionDate: result.employee.admissionDate,
          employeeEmail: result.employee.email,
          bank: result.employee.bankName,
          agency: result.employee.bankAgency,
          account: result.employee.bankAccount,
          paymentMethod: result.employee.paymentMethod,
          competenceMonth: result.payrollRun.month,
          competenceYear: result.payrollRun.year,
          earnings: earnings.map((event) => ({
            code: event.code,
            description: event.description,
            amount: Number(event.amount),
            type: 'earning' as const
          })),
          deductions: deductions.map((event) => ({
            code: event.code,
            description: event.description,
            amount: Number(event.amount),
            type: 'deduction' as const
          })),
          grossSalary: Number(result.grossSalary),
          totalDiscounts: Number(result.totalDeductions),
          netSalary: Number(result.netSalary),
          fgts: Number(result.fgts),
          inssBase: Number(result.grossSalary),
          fgtsBase: Number(result.grossSalary),
          irrfBase: Number(irrfBase.toFixed(2)),
          foodAllowance: mealVoucherCredit,
          alimony: pensionAlimony,
          thirteenthSecondInstallment: sumByDescription(earnings, '13'),
          thirteenthInss: sumByDescription(deductions, 'inss 13') + sumByDescription(deductions, '13 inss'),
          thirteenthIrrf: sumByDescription(deductions, 'irrf 13') + sumByDescription(deductions, '13 irrf'),
          calculationBase: Number(result.grossSalary)
        });
      });

    const systemConfig = await this.getSystemConfig(result.payrollRun.companyId);
    const companyProfiles = this.getCompanyProfiles(systemConfig);
    const companyProfile = this.resolveCompanyProfile(
      companyProfiles,
      result.employee.employerCnpj,
      result.payrollRun.company.cnpj
    );
    const paystubOverrides = this.getPaystubOverrides(systemConfig);
    const effectivePayslip = this.applyPayslipOverride(
      payslip,
      companyProfile,
      paystubOverrides[paystubId]
    );

    const summaryGross = Number(effectivePayslip.grossSalary ?? result.grossSalary);
    const summaryDeductions = Number(effectivePayslip.totalDiscounts ?? result.totalDeductions);
    const summaryNet = Number(effectivePayslip.netSalary ?? result.netSalary);
    const summaryFgts = Number(effectivePayslip.fgts ?? result.fgts);

    const events = result.events
      .map((event) => ({
        id: event.id,
        code: event.code,
        description: event.description,
        type: event.type,
        amount: Number(event.amount)
      }))
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'earning' ? -1 : 1;
        }
        return left.code.localeCompare(right.code);
      });

    return {
      id: result.id,
      company: {
        name: effectivePayslip.companyName,
        cnpj: effectivePayslip.companyCnpj
      },
      employee: {
        fullName: result.employee.fullName,
        cpf: result.employee.cpf,
        position: result.employee.position,
        department: result.employee.department,
        admissionDate: result.employee.admissionDate,
        employeeCode: result.employee.employeeCode,
        pis: result.employee.pis,
        email: result.employee.email,
        bankName: result.employee.bankName,
        bankAgency: result.employee.bankAgency,
        bankAccount: result.employee.bankAccount,
        paymentMethod: result.employee.paymentMethod,
        dependents: result.employee.dependents,
        salaryType: result.employee.salaryType,
        baseSalary: result.employee.baseSalary === null ? null : Number(result.employee.baseSalary),
        hourlyRate: result.employee.hourlyRate === null ? null : Number(result.employee.hourlyRate),
        weeklyHours: result.employee.weeklyHours === null ? null : Number(result.employee.weeklyHours),
        transportVoucherValue:
          result.employee.transportVoucherValue === null ? null : Number(result.employee.transportVoucherValue),
        mealVoucherValue: result.employee.mealVoucherValue === null ? null : Number(result.employee.mealVoucherValue)
      },
      month: result.payrollRun.month,
      year: result.payrollRun.year,
      document: paystubDocument
        ? {
            id: paystubDocument.id,
            title: paystubDocument.title,
            status: paystubDocument.status,
            filePath: `/documents/${paystubDocument.id}/export/pdf`,
            storedFilePath: paystubDocument.filePath,
            updatedAt: paystubDocument.updatedAt
          }
        : null,
      payslip: effectivePayslip,
      earnings: {
        baseSalary: sumByCode(earnings, 'BASE'),
        overtimeValue: sumByCode(earnings, 'EXTRA'),
        nightShiftBonus: sumByCode(earnings, 'NOTURNO'),
        holidaysBonus: sumByCode(earnings, 'FERIADOS'),
        mealVoucherCredit,
        otherBonuses: sumByCode(earnings, 'OUTROS') + sumByCode(earnings, 'DSR') + sumByCode(earnings, 'HORA_ATV')
      },
      deductions: {
        inssDeduction: inssValue,
        irrfDeduction: sumByCode(deductions, 'IRRF'),
        transportVoucherDeduction: sumByCode(deductions, 'VT'),
        mealVoucherDeduction: sumByCode(deductions, 'VA'),
        pensionAlimony,
        syndicateFee: sumByCode(deductions, 'SIND'),
        otherDeductions: sumByCode(deductions, 'OUTROS') + sumByCode(deductions, 'EMPRESTIMO')
      },
      events,
      bases: {
        inssBase: Number(result.grossSalary),
        fgtsBase: Number(result.grossSalary),
        irrfBase: Number(irrfBase.toFixed(2)),
        dependentDeduction
      },
      summary: {
        grossSalary: summaryGross,
        totalDeductions: summaryDeductions,
        netSalary: summaryNet,
        fgtsDeposit: summaryFgts
      }
    };
  }

  private buildFallbackPayslip(params: {
    companyId: string;
    companyName: string;
    companyCnpj: string;
    companyAddress?: string | null;
    employeeId: string;
    employeeName: string;
    employeeCpf: string;
    employeeCode?: string | null;
    employeeRole?: string | null;
    admissionDate?: Date | null;
    employeeEmail?: string | null;
    bank?: string | null;
    agency?: string | null;
    account?: string | null;
    paymentMethod?: string | null;
    competenceMonth: number;
    competenceYear: number;
    earnings: Payslip['earnings'];
    deductions: Payslip['deductions'];
    grossSalary: number;
    totalDiscounts: number;
    netSalary: number;
    fgts: number;
    inssBase: number;
    fgtsBase: number;
    irrfBase: number;
    foodAllowance: number;
    alimony: number;
    thirteenthSecondInstallment: number;
    thirteenthInss: number;
    thirteenthIrrf: number;
    calculationBase: number;
  }): Payslip {
    const addFunctionAmount = params.earnings
      .filter((event) => {
        const code = String(event.code ?? '').toUpperCase();
        const description = String(event.description ?? '').toUpperCase();
        return code.includes('AD') || description.includes('AD FUNCAO') || description.includes('ADICIONAL TURNO');
      })
      .reduce((sum, event) => sum + Number(event.amount ?? 0), 0);

    return {
      companyId: params.companyId,
      companyName: String(params.companyName || '').trim() || '-',
      companyCnpj: String(params.companyCnpj || '').trim() || '-',
      companyAddress: String(params.companyAddress || '').trim() || 'Endereço não informado',
      employeeId: params.employeeId,
      employeeName: String(params.employeeName || '').trim() || '-',
      employeeCpf: String(params.employeeCpf || '').trim() || '-',
      employeeCode: String(params.employeeCode || '').trim() || '-',
      employeeRole: String(params.employeeRole || '').trim() || '-',
      admissionDate: this.formatPayslipDate(params.admissionDate),
      employeeEmail: String(params.employeeEmail || '').trim() || '-',
      bank: String(params.bank || '').trim() || '-',
      agency: String(params.agency || '').trim() || '-',
      account: String(params.account || '').trim() || '-',
      paymentMethod: String(params.paymentMethod || '').trim() || '-',
      competenceMonth: params.competenceMonth,
      competenceYear: params.competenceYear,
      classComposition: [
        { code: '1', description: 'ENSINO INFANTIL', quantity: 0, unitValue: 0, totalValue: 0 },
        { code: '2', description: 'ENSINO FUNDAMENTAL I', quantity: 0, unitValue: 0, totalValue: 0 },
        { code: '3', description: 'ENSINO FUNDAMENTAL II', quantity: 0, unitValue: 0, totalValue: 0 },
        { code: '4', description: 'ENSINO MEDIO', quantity: 0, unitValue: 0, totalValue: 0 },
        { code: '5', description: 'RO', quantity: 0, unitValue: 0, totalValue: 0 },
        { code: '6', description: 'AD FUNCAO / TURNO', quantity: 0, unitValue: 0, totalValue: Number(addFunctionAmount.toFixed(2)) }
      ],
      earnings: params.earnings,
      deductions: params.deductions,
      grossSalary: Number(params.grossSalary.toFixed(2)),
      totalDiscounts: Number(params.totalDiscounts.toFixed(2)),
      netSalary: Number(params.netSalary.toFixed(2)),
      fgts: Number(params.fgts.toFixed(2)),
      inssBase: Number(params.inssBase.toFixed(2)),
      fgtsBase: Number(params.fgtsBase.toFixed(2)),
      irrfBase: Number(params.irrfBase.toFixed(2)),
      foodAllowance: Number(params.foodAllowance.toFixed(2)),
      alimony: Number(params.alimony.toFixed(2)),
      thirteenthSecondInstallment: Number(params.thirteenthSecondInstallment.toFixed(2)),
      thirteenthInss: Number(params.thirteenthInss.toFixed(2)),
      thirteenthIrrf: Number(params.thirteenthIrrf.toFixed(2)),
      calculationBase: Number(params.calculationBase.toFixed(2)),
      createdAt: new Date().toISOString()
    };
  }

  private formatPayslipDate(value?: Date | null) {
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return parsed.toLocaleDateString('pt-BR');
  }

  async exportPaystubPdf(params: {
    paystubId: string;
    requester: { companyId: string; role: string; employeeId?: string | null };
    userId?: string;
  }) {
    const paystub = await this.prisma.payrollResult.findUnique({
      where: { id: params.paystubId },
      include: {
        payrollRun: true,
        employee: true
      }
    });

    if (!paystub || paystub.payrollRun.companyId !== params.requester.companyId) {
      throw new NotFoundException('Paystub not found');
    }

    const detail = await this.getPaystubDetail(params.paystubId, params.requester);
    if (!detail?.payslip) {
      throw new BadRequestException('Não foi possível montar os dados do holerite para gerar o PDF.');
    }

    const buffer = await this.payslipPdf.generatePayslipPdf(detail.payslip);
    const filename = `holerite-${detail.year}-${String(detail.month).padStart(2, '0')}-${detail.id}.pdf`;

    return {
      buffer,
      filename,
      contentType: 'application/pdf'
    };
  }

  async updatePaystubEvent(params: {
    paystubId: string;
    eventId: string;
    companyId: string;
    userId?: string;
    amount?: number;
    description?: string;
    reason?: string;
  }) {
    const paystub = await this.prisma.payrollResult.findUnique({
      where: { id: params.paystubId },
      include: {
        payrollRun: true,
        employee: true,
        events: true
      }
    });

    if (!paystub || paystub.payrollRun.companyId !== params.companyId) {
      throw new NotFoundException('Paystub not found');
    }

    if (paystub.payrollRun.status === 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Competência fechada. Reabra a folha antes de editar holerite.',
        code: 'PAYROLL_COMPETENCE_CLOSED',
        details: { payrollRunId: paystub.payrollRun.id, month: paystub.payrollRun.month, year: paystub.payrollRun.year }
      });
    }

    const currentEvent = paystub.events.find((item) => item.id === params.eventId);
    if (!currentEvent) {
      throw new NotFoundException('Payroll event not found');
    }

    const parsedAmount = params.amount === undefined ? Number(currentEvent.amount) : Number(params.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      throw new BadRequestException('Invalid amount');
    }

    const nextAmount = Math.round(parsedAmount * 100) / 100;
    const nextDescription = params.description === undefined ? currentEvent.description : String(params.description).trim();
    if (!nextDescription) {
      throw new BadRequestException('Description is required');
    }

    await this.prisma.payrollEvent.update({
      where: { id: params.eventId },
      data: {
        amount: nextAmount,
        description: nextDescription
      }
    });

    const mergedEvents = paystub.events.map((item) =>
      item.id === params.eventId
        ? { ...item, amount: nextAmount, description: nextDescription }
        : item
    );

    const round = (value: number) => Math.round(value * 100) / 100;
    const grossSalary = round(
      mergedEvents
        .filter((item) => item.type === 'earning')
        .reduce((acc, item) => acc + Number(item.amount), 0)
    );

    const totalDeductions = round(
      mergedEvents
        .filter((item) => item.type === 'deduction')
        .reduce((acc, item) => acc + Number(item.amount), 0)
    );

    const netSalary = round(grossSalary - totalDeductions);
    const fgts = hasFgtsContributionByCategory(paystub.employee) ? round(grossSalary * 0.08) : 0;

    await this.prisma.payrollResult.update({
      where: { id: params.paystubId },
      data: {
        grossSalary,
        totalDeductions,
        netSalary,
        fgts
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'update_paystub_event',
      entity: 'paystub',
      entityId: params.paystubId,
      reason: params.reason,
      before: {
        eventId: currentEvent.id,
        code: currentEvent.code,
        description: currentEvent.description,
        amount: Number(currentEvent.amount),
        grossSalary: Number(paystub.grossSalary),
        totalDeductions: Number(paystub.totalDeductions),
        netSalary: Number(paystub.netSalary),
        fgts: Number(paystub.fgts)
      },
      after: {
        eventId: currentEvent.id,
        code: currentEvent.code,
        description: nextDescription,
        amount: nextAmount,
        grossSalary,
        totalDeductions,
        netSalary,
        fgts
      }
    });

    return {
      paystubId: params.paystubId,
      event: {
        id: currentEvent.id,
        code: currentEvent.code,
        type: currentEvent.type,
        description: nextDescription,
        amount: nextAmount
      },
      summary: {
        grossSalary,
        totalDeductions,
        netSalary,
        fgtsDeposit: fgts
      }
    };
  }

  async updatePaystubContent(params: {
    paystubId: string;
    companyId: string;
    userId?: string;
    employee?: {
      fullName?: string;
      cpf?: string;
      position?: string;
      admissionDate?: string;
      email?: string;
      bankName?: string;
      bankAgency?: string;
      bankAccount?: string;
      paymentMethod?: string;
      employeeCode?: string;
      pis?: string;
      weeklyHours?: number;
      transportVoucherValue?: number;
    };
    companyProfile?: {
      name?: string;
      cnpj?: string;
      address?: string;
      logoUrl?: string;
    };
    payslipOverride?: Record<string, unknown>;
    reason?: string;
  }) {
    const paystub = await this.prisma.payrollResult.findUnique({
      where: { id: params.paystubId },
      include: {
        payrollRun: { include: { company: true } },
        employee: true
      }
    });

    if (!paystub || paystub.payrollRun.companyId !== params.companyId) {
      throw new NotFoundException('Paystub not found');
    }

    const employeePatch: Record<string, unknown> = {};
    if (params.employee) {
      const fullName = this.asText(params.employee.fullName);
      if (fullName) employeePatch.fullName = fullName;

      if (params.employee.cpf !== undefined) {
        const cpf = this.onlyDigits(params.employee.cpf);
        if (cpf.length !== 11) {
          throw new BadRequestException('CPF inválido. Informe 11 dígitos.');
        }
        employeePatch.cpf = cpf;
      }

      const position = this.asText(params.employee.position);
      if (position) employeePatch.position = position;

      if (params.employee.admissionDate !== undefined) {
        const parsedDate = new Date(String(params.employee.admissionDate));
        if (Number.isNaN(parsedDate.getTime())) {
          throw new BadRequestException('Data de admissão inválida.');
        }
        employeePatch.admissionDate = parsedDate;
      }

      const email = this.asText(params.employee.email);
      if (email) employeePatch.email = email;

      const bankName = this.asText(params.employee.bankName);
      if (bankName) employeePatch.bankName = bankName;

      const bankAgency = this.asText(params.employee.bankAgency);
      if (bankAgency) employeePatch.bankAgency = bankAgency;

      const bankAccount = this.asText(params.employee.bankAccount);
      if (bankAccount) employeePatch.bankAccount = bankAccount;

      const paymentMethod = this.asText(params.employee.paymentMethod);
      if (paymentMethod) employeePatch.paymentMethod = paymentMethod;

      const employeeCode = this.asText(params.employee.employeeCode);
      if (employeeCode) employeePatch.employeeCode = employeeCode;

      const pis = this.asText(params.employee.pis);
      if (pis) employeePatch.pis = pis;

      if (params.employee.weeklyHours !== undefined) {
        const weeklyHours = Number(params.employee.weeklyHours);
        if (!Number.isFinite(weeklyHours) || weeklyHours < 0) {
          throw new BadRequestException('Carga horária semanal inválida.');
        }
        employeePatch.weeklyHours = this.roundMoney(weeklyHours);
      }

      if (params.employee.transportVoucherValue !== undefined) {
        const transportValue = Number(params.employee.transportVoucherValue);
        if (!Number.isFinite(transportValue) || transportValue < 0) {
          throw new BadRequestException('Valor de vale-transporte inválido.');
        }
        employeePatch.transportVoucherValue = this.roundMoney(transportValue);
      }
    }

    if (Object.keys(employeePatch).length > 0) {
      await this.prisma.employee.update({
        where: { id: paystub.employeeId },
        data: employeePatch
      });
    }

    let config = await this.getSystemConfig(params.companyId);
    let configChanged = false;

    if (params.companyProfile) {
      const companyProfiles = this.getCompanyProfiles(config);
      const cnpjDigits = this.onlyDigits(
        params.companyProfile.cnpj
        ?? paystub.employee.employerCnpj
        ?? paystub.payrollRun.company.cnpj
      );

      if (cnpjDigits.length !== 14) {
        throw new BadRequestException('CNPJ inválido para o perfil da empresa.');
      }

      const existing = companyProfiles.find((item) => this.onlyDigits(item.cnpj) === cnpjDigits);
      const profile: CompanyProfileConfig = {
        name: this.asText(params.companyProfile.name) ?? existing?.name ?? paystub.payrollRun.company.name,
        cnpj: this.formatCnpj(cnpjDigits),
        address: this.asText(params.companyProfile.address) ?? existing?.address ?? '-',
        logoUrl: this.asText(params.companyProfile.logoUrl) ?? existing?.logoUrl
      };

      const nextProfiles = [
        ...companyProfiles.filter((item) => this.onlyDigits(item.cnpj) !== cnpjDigits),
        profile
      ].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));

      config = {
        ...config,
        companyProfiles: nextProfiles
      };
      configChanged = true;
    }

    if (this.isObject(params.payslipOverride)) {
      const overrides = this.getPaystubOverrides(config);
      const previous = overrides[params.paystubId] ?? {};

      overrides[params.paystubId] = {
        ...previous,
        ...params.payslipOverride,
        updatedAt: new Date().toISOString(),
        updatedBy: params.userId ?? null
      };

      config = {
        ...config,
        paystubOverrides: overrides
      };
      configChanged = true;
    }

    if (configChanged) {
      await this.saveSystemConfig(params.companyId, config);
    }

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'update_paystub_content',
      entity: 'paystub',
      entityId: params.paystubId,
      reason: params.reason,
      after: {
        employeeUpdated: Object.keys(employeePatch).length > 0,
        configUpdated: configChanged,
        overrideUpdated: this.isObject(params.payslipOverride)
      }
    });

    return this.getPaystubDetail(params.paystubId, {
      companyId: params.companyId,
      role: 'admin'
    });
  }

  private normalizeEventLabel(value: string) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private formatMoney(value: number) {
    const amount = Number.isFinite(value) ? value : 0;
    return amount.toFixed(2).replace('.', ',');
  }

  async generateIncomeStatementsForYear(params: {
    companyId: string;
    year: number;
    userId?: string;
    employeeIds?: string[];
    reason?: string;
    idempotent?: boolean;
  }) {
    const company = await this.prisma.company.findUnique({ where: { id: params.companyId } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const templateResult = await this.documents.ensureIncomeStatementTemplate({
      companyId: params.companyId,
      userId: params.userId,
      reason: params.reason ?? 'bootstrap_informe_rendimentos_anual'
    });

    const template = templateResult.template;

    const payrollResults = await this.prisma.payrollResult.findMany({
      where: {
        employeeId: params.employeeIds && params.employeeIds.length > 0 ? { in: params.employeeIds } : undefined,
        payrollRun: {
          is: {
            companyId: params.companyId,
            year: params.year,
            status: 'closed'
          }
        }
      },
      include: { employee: true, events: true, payrollRun: true },
      orderBy: [{ employee: { fullName: 'asc' } }, { payrollRun: { month: 'asc' } }]
    });

    if (payrollResults.length === 0) {
      return {
        templateCreated: templateResult.created,
        createdCount: 0,
        skippedCount: 0,
        documents: []
      };
    }

    const grouped = new Map<string, typeof payrollResults>();
    for (const result of payrollResults) {
      const current = grouped.get(result.employeeId) ?? [];
      current.push(result);
      grouped.set(result.employeeId, current);
    }

    const idempotent = params.idempotent ?? true;
    const existing = idempotent
      ? await this.prisma.employeeDocument.findMany({
          where: {
            companyId: params.companyId,
            employeeId: { in: Array.from(grouped.keys()) },
            templateId: template.id,
            year: params.year,
            deletedAt: null
          },
          select: { employeeId: true }
        })
      : [];

    const existingEmployees = new Set(existing.map((item) => item.employeeId));
    const created: any[] = [];
    const skipped: { employeeId: string; reason: string }[] = [];

    for (const [employeeId, results] of grouped.entries()) {
      if (idempotent && existingEmployees.has(employeeId)) {
        skipped.push({ employeeId, reason: 'already_exists' });
        continue;
      }

      const employee = results[0].employee;
      let totalGross = 0;
      let previdenciaOficial = 0;
      let previdenciaComplementar = 0;
      let pensao = 0;
      let irrf = 0;
      let parcelaIsenta65 = 0;
      let parcelaIsenta13_65 = 0;
      let diariasAjudas = 0;
      let molestiaGrave = 0;
      let lucrosDividendos = 0;
      let simplesNacional = 0;
      let indenizacoesRescisao = 0;
      let jurosMora = 0;
      let outrosIsentos = 0;
      let decimoTerceiro = 0;
      let irrfDecimoTerceiro = 0;
      let outrosExclusivos = 0;

      for (const result of results) {
        totalGross += Number(result.grossSalary ?? 0);

        for (const event of result.events) {
          const amount = Math.abs(Number(event.amount ?? 0));
          if (!Number.isFinite(amount) || amount === 0) continue;

          const label = this.normalizeEventLabel(`${event.code} ${event.description}`);
          const isDeduction = event.type === 'deduction';

          if (isDeduction) {
            if (label.includes('inss')) {
              previdenciaOficial += amount;
              continue;
            }
            if (label.includes('irrf 13') || label.includes('irrf13') || (label.includes('irfonte') && label.includes('13'))) {
              irrfDecimoTerceiro += amount;
              continue;
            }
            if (label.includes('irrf') || label.includes('irfonte')) {
              irrf += amount;
              continue;
            }
            if (label.includes('pensao')) {
              pensao += amount;
              continue;
            }
            if (label.includes('fapi') || label.includes('previdencia complementar') || label.includes('prev comp')) {
              previdenciaComplementar += amount;
              continue;
            }
            continue;
          }

          if (label.includes('13') || label.includes('decimo')) {
            decimoTerceiro += amount;
            continue;
          }

          if (label.includes('plr') || label.includes('participacao nos lucros') || label.includes('lucros') || label.includes('resultados')) {
            outrosExclusivos += amount;
            continue;
          }

          if (label.includes('rescis') || label.includes('indeniz')) {
            indenizacoesRescisao += amount;
            continue;
          }

          if (label.includes('juros') && label.includes('mora')) {
            jurosMora += amount;
            continue;
          }

          if (label.includes('sal.fam') || label.includes('salario familia') || label.includes('isento')) {
            outrosIsentos += amount;
            continue;
          }
        }
      }

      const totalIsentos =
        parcelaIsenta65 +
        parcelaIsenta13_65 +
        diariasAjudas +
        molestiaGrave +
        lucrosDividendos +
        simplesNacional +
        indenizacoesRescisao +
        jurosMora +
        outrosIsentos;

      const totalTributaveis = Math.max(0, totalGross - decimoTerceiro - outrosExclusivos - totalIsentos);
      const issueDate = new Date().toLocaleDateString('pt-BR');

      const placeholders: Record<string, string> = {
        exercicio: String(params.year + 1),
        ano_calendario: String(params.year),
        fonte_cnpj_cpf: company.cnpj,
        fonte_nome: company.name,
        beneficiario_cpf: employee.cpf,
        beneficiario_nome: employee.fullName,
        natureza_rendimento: `Trabalho assalariado - ${employee.position}`,

        q3_l1_total_rendimentos: this.formatMoney(totalTributaveis),
        q3_l2_previdencia_oficial: this.formatMoney(previdenciaOficial),
        q3_l3_previdencia_complementar: this.formatMoney(previdenciaComplementar),
        q3_l4_pensao_alimenticia: this.formatMoney(pensao),
        q3_l5_irrf: this.formatMoney(irrf),

        q4_l1_parcela_isenta_65: this.formatMoney(parcelaIsenta65),
        q4_l2_parcela_isenta_13_65: this.formatMoney(parcelaIsenta13_65),
        q4_l3_diarias_ajudas_custo: this.formatMoney(diariasAjudas),
        q4_l4_molestia_grave: this.formatMoney(molestiaGrave),
        q4_l5_lucros_dividendos: this.formatMoney(lucrosDividendos),
        q4_l6_simples_nacional: this.formatMoney(simplesNacional),
        q4_l7_indenizacoes_rescisao: this.formatMoney(indenizacoesRescisao),
        q4_l8_juros_mora: this.formatMoney(jurosMora),
        q4_l9_outros: this.formatMoney(outrosIsentos),

        q5_l1_decimo_terceiro: this.formatMoney(decimoTerceiro),
        q5_l2_irrf_decimo_terceiro: this.formatMoney(irrfDecimoTerceiro),
        q5_l3_outros: this.formatMoney(outrosExclusivos),

        q6_1_numero_processo: '',
        q6_1_natureza_rendimento: '',
        q6_1_quantidade_meses: '',
        q6_l1_total_rendimentos: '0,00',
        q6_l2_despesas_acao_judicial: '0,00',
        q6_l3_previdencia_oficial: '0,00',
        q6_l4_pensao_alimenticia: '0,00',
        q6_l5_irrf: '0,00',
        q6_l6_isentos_molestia: '0,00',

        quadro7_observacoes: `Consolidado anual com ${results.length} competências fechadas em ${params.year}.`,
        data_emissao: issueDate,
        assinatura_fonte_pagadora: company.name,
        responsavel_cargo_nome: 'Responsavel RH'
      };

      const document = await this.documents.createDocumentFromTemplate({
        companyId: params.companyId,
        userId: params.userId,
        employeeId,
        templateId: template.id,
        title: `Informe de Rendimentos ${params.year}`,
        placeholders,
        month: 12,
        year: params.year,
        reason: params.reason ?? 'geracao_informe_rendimentos_anual'
      });

      created.push(document);
    }

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'generate_income_statements',
      entity: 'income_statement',
      entityId: String(params.year),
      reason: params.reason,
      after: {
        year: params.year,
        templateId: template.id,
        createdCount: created.length,
        skippedCount: skipped.length
      }
    });

    return {
      templateCreated: templateResult.created,
      createdCount: created.length,
      skippedCount: skipped.length,
      documents: created,
      skipped
    };
  }

  private buildHoleriteFilename(year: number, month: number) {
    return `holerite-${year}-${String(month).padStart(2, '0')}.pdf`;
  }

  private async resolveDocumentOwnerUserId(companyId: string, employeeId: string) {
    const ownerUser = await this.prisma.user.findFirst({
      where: {
        companyId,
        employeeId
      },
      select: { id: true }
    });

    return ownerUser?.id ?? employeeId;
  }

  private async generateFixedPayslipDocument(params: {
    companyId: string;
    payrollRunId: string;
    month: number;
    year: number;
    employeeId: string;
    actorUserId?: string;
    reason?: string;
  }) {
    const payslip = await this.payslipBuilder.buildPayslip(params.employeeId, {
      companyId: params.companyId,
      payrollRunId: params.payrollRunId,
      month: params.month,
      year: params.year
    });

    const pdfBuffer = await this.payslipPdf.generatePayslipPdf(payslip);
    const htmlContent = renderPayslipHtml(payslip);
    const ownerUserId = await this.resolveDocumentOwnerUserId(params.companyId, params.employeeId);

    const saved = await this.documents.saveDocumentRecord({
      companyId: params.companyId,
      userId: ownerUserId,
      employeeId: params.employeeId,
      payrollRunId: params.payrollRunId,
      documentType: 'holerite',
      title: `Holerite ${String(params.month).padStart(2, '0')}/${params.year} - ${payslip.employeeName}`,
      competenceMonth: params.month,
      competenceYear: params.year,
      status: 'finalized',
      filename: this.buildHoleriteFilename(params.year, params.month),
      pdfBuffer,
      htmlContent,
      createdBy: params.actorUserId,
      reason: params.reason
    });

    return saved.document;
  }

  async generateDocumentsForRun(params: {
    payrollRunId: string;
    companyId: string;
    userId?: string;
    documentType: 'trct' | 'recibo_ferias' | 'holerite';
    templateId?: string;
    employeeIds?: string[];
    extraPlaceholders?: Record<string, string>;
    reason?: string;
    idempotent?: boolean;
    forceRegenerate?: boolean;
    source?: 'manual' | 'auto_close' | 'reprocess';
  }) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: params.payrollRunId } });
    if (!payrollRun || payrollRun.companyId !== params.companyId) {
      throw new NotFoundException('Payroll run not found');
    }

    const shouldUseFixedPayslipFlow = params.documentType === 'holerite';
    const template = shouldUseFixedPayslipFlow
      ? null
      : params.templateId
        ? await this.prisma.documentTemplate.findUnique({ where: { id: params.templateId } })
        : await this.prisma.documentTemplate.findFirst({
            where: {
              companyId: params.companyId,
              type: params.documentType as any,
              deletedAt: null
            },
            orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }]
          });

    if (!shouldUseFixedPayslipFlow && (!template || template.companyId !== params.companyId)) {
      throw new NotFoundException('Template not found for document generation');
    }

    const formatMoney = (value: number) => Number(value ?? 0).toFixed(2);
    const formatDate = (value?: Date | null) => {
      if (!value) return '-';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('pt-BR');
    };

    const results = await this.prisma.payrollResult.findMany({
      where: {
        payrollRunId: payrollRun.id,
        employeeId: params.employeeIds && params.employeeIds.length > 0 ? { in: params.employeeIds } : undefined
      },
      include: { employee: true, events: true }
    });

    const employeeIds = results.map((item) => item.employeeId);
    const regenerationEmployeeFilter = params.employeeIds && params.employeeIds.length > 0
      ? { in: params.employeeIds }
      : undefined;

    let regeneratedFromPreviousCount = 0;
    if (params.forceRegenerate) {
      const now = new Date();
      const deletedResult = await this.prisma.employeeDocument.updateMany({
        where: {
          companyId: params.companyId,
          payrollRunId: payrollRun.id,
          type: params.documentType as any,
          employeeId: regenerationEmployeeFilter,
          deletedAt: null
        },
        data: {
          deletedAt: now,
          deletedBy: params.userId ?? null,
          deletedReason: params.reason ?? 'force_regenerate_documents'
        }
      });
      regeneratedFromPreviousCount = Number(deletedResult?.count ?? 0);
    }

    const idempotent = params.forceRegenerate ? false : params.idempotent ?? false;
    const existingWhere = idempotent
      ? ({
          payrollRunId: payrollRun.id,
          type: params.documentType as any,
          employeeId: { in: employeeIds },
          deletedAt: null
        } as any)
      : null;

    const existing = idempotent && existingWhere
      ? await this.prisma.employeeDocument.findMany({
          where: existingWhere,
          select: { employeeId: true, type: true, id: true }
        })
      : [];

    const existingKey = new Set(existing.map((item) => `${item.employeeId}:${item.type}`));

    const created: any[] = [];
    const skipped: any[] = [];
    this.logger.log(
      `Generating documents for run ${payrollRun.id} type ${params.documentType} (idempotent=${idempotent}).`
    );
    for (const result of results) {
      const key = `${result.employeeId}:${params.documentType}`;
      if (idempotent && existingKey.has(key)) {
        skipped.push({ employeeId: result.employeeId, type: params.documentType });
        continue;
      }

      if (shouldUseFixedPayslipFlow) {
        const doc = await this.generateFixedPayslipDocument({
          companyId: params.companyId,
          payrollRunId: payrollRun.id,
          month: payrollRun.month,
          year: payrollRun.year,
          employeeId: result.employeeId,
          actorUserId: params.userId,
          reason: params.reason
        });

        created.push(doc);
        continue;
      }

      const events = result.events ?? [];
      const mealVoucherCredit = events
        .filter((event) => event.type === 'earning' && event.code === 'VA')
        .reduce((sum, event) => sum + Number(event.amount), 0);
      const pensionAlimony = events
        .filter((event) => event.type === 'deduction' && (event.code === 'PENSAO' || /pensao/i.test(event.description)))
        .reduce((sum, event) => sum + Number(event.amount), 0);
      const eventLines = events
        .slice()
        .sort((left, right) => {
          if (left.type !== right.type) {
            return left.type === 'earning' ? -1 : 1;
          }
          return left.code.localeCompare(right.code);
        })
        .map((event) => {
          const signal = event.type === 'earning' ? '+' : '-';
          return `${event.code} - ${event.description}: ${signal} R$ ${formatMoney(Number(event.amount))}`;
        })
        .join('\n');

      const placeholders = {
        company_name: '-',
        company_cnpj: '-',
        employee_name: result.employee.fullName,
        employee_code: result.employee.employeeCode ?? '-',
        employee_cpf: result.employee.cpf,
        employee_position: result.employee.position,
        employee_department: result.employee.department,
        employee_email: result.employee.email ?? '-',
        admission_date: formatDate(result.employee.admissionDate),
        payroll_month: String(payrollRun.month),
        payroll_year: String(payrollRun.year),
        competence: `${String(payrollRun.month).padStart(2, '0')}/${payrollRun.year}`,
        gross_salary: formatMoney(Number(result.grossSalary)),
        total_deductions: formatMoney(Number(result.totalDeductions)),
        net_salary: formatMoney(Number(result.netSalary)),
        fgts: formatMoney(Number(result.fgts)),
        inss_base: formatMoney(Number(result.grossSalary)),
        fgts_base: formatMoney(Number(result.grossSalary)),
        irrf_base: formatMoney(0),
        bank_name: result.employee.bankName ?? '-',
        bank_agency: result.employee.bankAgency ?? '-',
        bank_account: result.employee.bankAccount ?? '-',
        payment_method: result.employee.paymentMethod ?? '-',
        meal_voucher_credit: formatMoney(mealVoucherCredit),
        pension_alimony: formatMoney(pensionAlimony),
        event_lines: eventLines || '-',
        ...(params.extraPlaceholders ?? {})
      };

      const documentTitle = params.documentType === 'holerite'
        ? `Holerite ${String(payrollRun.month).padStart(2, '0')}/${payrollRun.year} - ${result.employee.fullName}`
        : params.documentType === 'recibo_ferias'
          ? `Recibo de Férias ${String(payrollRun.month).padStart(2, '0')}/${payrollRun.year} - ${result.employee.fullName}`
          : template!.name;

      const doc = await this.documents.createDocumentFromTemplate({
        companyId: params.companyId,
        userId: params.userId,
        employeeId: result.employeeId,
        templateId: template!.id,
        payrollRunId: payrollRun.id,
        title: documentTitle,
        placeholders,
        month: payrollRun.month,
        year: payrollRun.year,
        reason: params.reason
      });

      created.push(doc);
    }

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'generate_documents',
      entity: 'payroll_run',
      entityId: payrollRun.id,
      reason: params.reason,
      after: {
        documentType: params.documentType,
        source: params.source ?? 'manual',
        forceRegenerate: params.forceRegenerate ?? false,
        regeneratedFromPreviousCount,
        createdCount: created.length,
        skippedCount: skipped.length
      }
    });

    this.logger.log(
      `Documents generated for run ${payrollRun.id}: created=${created.length}, skipped=${skipped.length}, regenerated=${regeneratedFromPreviousCount}.`
    );

    return {
      createdCount: created.length,
      skippedCount: skipped.length,
      regeneratedFromPreviousCount,
      documents: created
    };
  }

  async reprocessDocumentsForRun(params: {
    payrollRunId: string;
    companyId: string;
    userId?: string;
    documentType: 'trct' | 'recibo_ferias' | 'holerite';
    templateId?: string;
    employeeIds?: string[];
    extraPlaceholders?: Record<string, string>;
    reason?: string;
    forceRegenerate?: boolean;
  }) {
    return this.generateDocumentsForRun({
      ...params,
      idempotent: true,
      forceRegenerate: params.forceRegenerate,
      source: 'reprocess'
    });
  }

  private async autoGenerateDocumentsOnClose(params: { payrollRun: { id: string; companyId: string; month: number; year: number }; userId?: string }) {
    const results = await this.prisma.payrollResult.findMany({
      where: { payrollRunId: params.payrollRun.id },
      include: { employee: true, events: true }
    });

    const trctEmployeeIds: string[] = [];
    const feriasEmployeeIds: string[] = [];

    for (const result of results) {
      const hasRescisaoEvent = result.events.some((event) =>
        /rescis/i.test(event.description) || /^RESC/i.test(event.code)
      );
      const hasFeriasEvent = result.events.some((event) =>
        /ferias/i.test(event.description) || /^FER/i.test(event.code)
      );

      if (result.employee.status === 'dismissed' || hasRescisaoEvent) {
        trctEmployeeIds.push(result.employeeId);
      }

      if (hasFeriasEvent) {
        feriasEmployeeIds.push(result.employeeId);
      }
    }

    const summary: Record<string, unknown> = {};

    if (trctEmployeeIds.length > 0) {
      summary.trct = await this.generateDocumentsForRun({
        payrollRunId: params.payrollRun.id,
        companyId: params.payrollRun.companyId,
        userId: params.userId,
        documentType: 'trct',
        employeeIds: Array.from(new Set(trctEmployeeIds)),
        reason: 'auto_close',
        idempotent: true,
        source: 'auto_close'
      });
    } else {
      summary.trct = { createdCount: 0, skippedCount: 0 };
    }

    if (feriasEmployeeIds.length > 0) {
      summary.recibo_ferias = await this.generateDocumentsForRun({
        payrollRunId: params.payrollRun.id,
        companyId: params.payrollRun.companyId,
        userId: params.userId,
        documentType: 'recibo_ferias',
        employeeIds: Array.from(new Set(feriasEmployeeIds)),
        reason: 'auto_close',
        idempotent: true,
        source: 'auto_close'
      });
    } else {
      summary.recibo_ferias = { createdCount: 0, skippedCount: 0 };
    }

    return summary;
  }

  async getPayrollGrid(companyId: string, month: number, year: number) {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: { companyId, month, year },
      orderBy: { version: 'desc' },
    });

    if (!payrollRun) {
      return { payrollRunId: null, status: null, month, year, employees: [] };
    }

    const results = await this.prisma.payrollResult.findMany({
      where: { payrollRunId: payrollRun.id },
      include: {
        employee: true,
        events: true,
      },
    });

    const allCodes = new Set<string>();
    for (const r of results) {
      for (const ev of r.events) {
        allCodes.add(ev.code);
      }
    }

    const rubricColumns = Array.from(allCodes).sort();

    const employees = results.map((r) => {
      const eventsByCode: Record<string, number> = {};
      for (const ev of r.events) {
        eventsByCode[ev.code] = (eventsByCode[ev.code] ?? 0) + Number(ev.amount);
      }

      return {
        employeeId: r.employeeId,
        fullName: r.employee.fullName,
        cpf: r.employee.cpf,
        position: r.employee.position,
        department: r.employee.department,
        salaryType: r.employee.salaryType,
        baseSalary: Number(r.employee.baseSalary ?? 0),
        hourlyRate: Number(r.employee.hourlyRate ?? 0),
        weeklyHours: Number(r.employee.weeklyHours ?? 0),
        events: eventsByCode,
        grossSalary: Number(r.grossSalary),
        totalDeductions: Number(r.totalDeductions),
        netSalary: Number(r.netSalary),
        fgts: Number(r.fgts),
      };
    });

    return {
      payrollRunId: payrollRun.id,
      status: payrollRun.status,
      month,
      year,
      rubricColumns,
      employees,
    };
  }
}

