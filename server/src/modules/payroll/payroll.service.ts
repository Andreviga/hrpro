import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { calculatePayrollForEmployee } from './payroll.utils';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class PayrollService {
  private queue: Queue;
  private logger = new Logger(PayrollService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private documents: DocumentsService
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.queue = new Queue('payroll.calculate', {
      connection: new IORedis(redisUrl, { maxRetriesPerRequest: null })
    });
  }

  async createRun(companyId: string, month: number, year: number) {
    // Keep create endpoint backward compatible but idempotent.
    return this.openRun(companyId, month, year);
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
        message: 'Competencia ja fechada para esta empresa.',
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
    await this.queue.add('calculate', { payrollRunId, userId });
    return { queued: true };
  }

  async calculateRun(payrollRunId: string, userId?: string) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!payrollRun) throw new NotFoundException('Payroll run not found');

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
        message: 'Competencia ja fechada para esta empresa.',
        code: 'PAYROLL_CLOSE_DUPLICATE',
        details: { existingPayrollRunId: existingClosed.id }
      });
    }

    const closed = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'closed', closedAt: new Date() }
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

  async reopenRun(payrollRunId: string, userId?: string) {
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
        message: 'Outra folha ja esta fechada para esta competencia.',
        code: 'PAYROLL_REOPEN_DUPLICATE',
        details: { payrollRunId: otherClosed.id }
      });
    }

    const reopened = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'calculated', closedAt: null }
    });

    await this.audit.log({
      companyId: payrollRun.companyId,
      userId,
      action: 'reopen',
      entity: 'payroll_run',
      entityId: payrollRunId,
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

  async listPaystubsByEmployee(employeeId: string) {
    const results = await this.prisma.payrollResult.findMany({
      where: { employeeId },
      include: { payrollRun: true },
      orderBy: [{ payrollRun: { year: 'desc' } }, { payrollRun: { month: 'desc' } }]
    });

    return results.map((result) => ({
      id: result.id,
      month: result.payrollRun.month,
      year: result.payrollRun.year,
      netSalary: Number(result.netSalary),
      filePath: `/paystubs/${result.id}/pdf`
    }));
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

  async getPaystubDetail(paystubId: string) {
    const result = await this.prisma.payrollResult.findUnique({
      where: { id: paystubId },
      include: {
        payrollRun: { include: { company: true } },
        events: true,
        employee: true
      }
    });

    if (!result) throw new NotFoundException('Paystub not found');

    const earnings = result.events.filter((event) => event.type === 'earning');
    const deductions = result.events.filter((event) => event.type === 'deduction');

    const sumByCode = (items: typeof result.events, code: string) =>
      items.filter((item) => item.code === code).reduce((acc, item) => acc + Number(item.amount), 0);

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

    const events = result.events
      .map((event) => ({
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
        name: result.payrollRun.company.name,
        cnpj: result.payrollRun.company.cnpj
      },
      employee: {
        fullName: result.employee.fullName,
        cpf: result.employee.cpf,
        position: result.employee.position,
        department: result.employee.department,
        admissionDate: result.employee.admissionDate,
        employeeCode: result.employee.employeeCode,
        pis: result.employee.pis,
        dependents: result.employee.dependents
      },
      month: result.payrollRun.month,
      year: result.payrollRun.year,
      earnings: {
        baseSalary: sumByCode(earnings, 'BASE'),
        overtimeValue: sumByCode(earnings, 'EXTRA'),
        nightShiftBonus: sumByCode(earnings, 'NOTURNO'),
        holidaysBonus: sumByCode(earnings, 'FERIADOS'),
        otherBonuses: sumByCode(earnings, 'OUTROS') + sumByCode(earnings, 'DSR') + sumByCode(earnings, 'HORA_ATV')
      },
      deductions: {
        inssDeduction: inssValue,
        irrfDeduction: sumByCode(deductions, 'IRRF'),
        transportVoucherDeduction: sumByCode(deductions, 'VT'),
        mealVoucherDeduction: sumByCode(deductions, 'VA'),
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
        grossSalary: Number(result.grossSalary),
        totalDeductions: Number(result.totalDeductions),
        netSalary: Number(result.netSalary),
        fgtsDeposit: Number(result.fgts)
      }
    };
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

        quadro7_observacoes: `Consolidado anual com ${results.length} competencias fechadas em ${params.year}.`,
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
    source?: 'manual' | 'auto_close' | 'reprocess';
  }) {
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: params.payrollRunId } });
    if (!payrollRun || payrollRun.companyId !== params.companyId) {
      throw new NotFoundException('Payroll run not found');
    }

    const template = params.templateId
      ? await this.prisma.documentTemplate.findUnique({ where: { id: params.templateId } })
      : params.documentType === 'holerite'
        ? (
            await this.documents.ensurePaystubTemplate({
              companyId: params.companyId,
              userId: params.userId,
              reason: params.reason ?? 'bootstrap_holerite'
            })
          ).template
        : await this.prisma.documentTemplate.findFirst({
            where: {
              companyId: params.companyId,
              type: params.documentType as any,
              deletedAt: null
            },
            orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }]
          });

    if (!template || template.companyId !== params.companyId) {
      throw new NotFoundException('Template not found for document generation');
    }

    const results = await this.prisma.payrollResult.findMany({
      where: {
        payrollRunId: payrollRun.id,
        employeeId: params.employeeIds && params.employeeIds.length > 0 ? { in: params.employeeIds } : undefined
      },
      include: { employee: true }
    });

    const idempotent = params.idempotent ?? false;
    const existingWhere = idempotent
      ? ({
          payrollRunId: payrollRun.id,
          type: params.documentType as any,
          employeeId: { in: results.map((item) => item.employeeId) },
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

      const placeholders = {
        employee_name: result.employee.fullName,
        employee_cpf: result.employee.cpf,
        employee_position: result.employee.position,
        employee_department: result.employee.department,
        payroll_month: String(payrollRun.month),
        payroll_year: String(payrollRun.year),
        gross_salary: Number(result.grossSalary).toFixed(2),
        total_deductions: Number(result.totalDeductions).toFixed(2),
        net_salary: Number(result.netSalary).toFixed(2),
        fgts: Number(result.fgts).toFixed(2),
        ...(params.extraPlaceholders ?? {})
      };

      const doc = await this.documents.createDocumentFromTemplate({
        companyId: params.companyId,
        userId: params.userId,
        employeeId: result.employeeId,
        templateId: template.id,
        payrollRunId: payrollRun.id,
        title: template.name,
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
        createdCount: created.length,
        skippedCount: skipped.length
      }
    });

    this.logger.log(
      `Documents generated for run ${payrollRun.id}: created=${created.length}, skipped=${skipped.length}.`
    );

    return { createdCount: created.length, skippedCount: skipped.length, documents: created };
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
  }) {
    return this.generateDocumentsForRun({
      ...params,
      idempotent: true,
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

