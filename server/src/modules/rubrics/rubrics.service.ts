import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RubricsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(companyId: string, includeInactive = false) {
    return this.prisma.rubric.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async getById(companyId: string, id: string) {
    return this.prisma.rubric.findFirst({
      where: { id, companyId },
      include: { assignments: true },
    });
  }

  async create(
    companyId: string,
    data: {
      code: string;
      name: string;
      description?: string;
      type: 'earning' | 'deduction';
      formula?: string;
      percentage?: number;
      fixedValue?: number;
      baseRubric?: string;
      sortOrder?: number;
    },
    userId?: string,
  ) {
    const rubric = await this.prisma.rubric.create({
      data: {
        companyId,
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        type: data.type,
        formula: data.formula,
        percentage: data.percentage,
        fixedValue: data.fixedValue,
        baseRubric: data.baseRubric,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'rubric.create',
      entity: 'Rubric',
      entityId: rubric.id,
      after: rubric,
    });

    return rubric;
  }

  async update(
    companyId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      type?: 'earning' | 'deduction';
      formula?: string;
      percentage?: number;
      fixedValue?: number;
      baseRubric?: string;
      active?: boolean;
      sortOrder?: number;
    },
    userId?: string,
  ) {
    const before = await this.prisma.rubric.findFirst({
      where: { id, companyId },
    });

    const rubric = await this.prisma.rubric.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.formula !== undefined && { formula: data.formula }),
        ...(data.percentage !== undefined && { percentage: data.percentage }),
        ...(data.fixedValue !== undefined && { fixedValue: data.fixedValue }),
        ...(data.baseRubric !== undefined && { baseRubric: data.baseRubric }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'rubric.update',
      entity: 'Rubric',
      entityId: rubric.id,
      before,
      after: rubric,
    });

    return rubric;
  }

  async delete(companyId: string, id: string, userId?: string) {
    const rubric = await this.prisma.rubric.findFirst({
      where: { id, companyId },
    });

    await this.prisma.rubric.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'rubric.deactivate',
      entity: 'Rubric',
      entityId: id,
      before: rubric,
    });

    return { success: true };
  }

  async seedDefaults(companyId: string, userId?: string) {
    const defaults = [
      { code: 'BASE', name: 'Salário Base', type: 'earning' as const, formula: 'salaryType === "hourly" ? weeklyHours * hourlyRate * 4.5 : baseSalary', sortOrder: 1 },
      { code: 'HORA_ATV', name: 'Hora Atividade', type: 'earning' as const, formula: 'BASE * 0.05', percentage: 5, baseRubric: 'BASE', sortOrder: 2 },
      { code: 'DSR', name: 'DSR', type: 'earning' as const, formula: '(BASE + HORA_ATV) / 6', sortOrder: 3 },
      { code: 'EXTRA', name: 'Hora Extra', type: 'earning' as const, formula: '(BASE / horasContratuais) * qtdHorasExtras * 1.5', sortOrder: 4 },
      { code: 'DECIMO_13', name: '13° Salário', type: 'earning' as const, formula: 'BRUTO * (mesesTrabalhados / 12)', sortOrder: 5 },
      { code: 'FERIAS', name: 'Férias', type: 'earning' as const, formula: 'BRUTO + (BRUTO / 3)', sortOrder: 6 },
      { code: 'PLR', name: 'PLR', type: 'earning' as const, sortOrder: 7 },
      { code: 'INSS', name: 'INSS', type: 'deduction' as const, formula: 'tabelaProgressiva(BRUTO, tabelaINSS)', sortOrder: 10 },
      { code: 'IRRF', name: 'IRRF', type: 'deduction' as const, formula: 'tabelaProgressiva(BRUTO - INSS - dependentes * deducaoDependente, tabelaIRRF)', sortOrder: 11 },
      { code: 'VT', name: 'Vale Transporte', type: 'deduction' as const, formula: 'min(valorInformado, BRUTO * 0.06)', percentage: 6, sortOrder: 12 },
      { code: 'VA', name: 'Vale Alimentação', type: 'deduction' as const, formula: 'valorFixo', sortOrder: 13 },
      { code: 'SIND', name: 'Taxa Sindical', type: 'deduction' as const, formula: 'unionFee ? 25 : 0', fixedValue: 25, sortOrder: 14 },
      { code: 'FGTS', name: 'FGTS', type: 'earning' as const, formula: 'BRUTO * 0.08', percentage: 8, sortOrder: 20, description: 'Encargo patronal - não desconta do empregado' },
    ];

    const results = [];
    for (const d of defaults) {
      const existing = await this.prisma.rubric.findUnique({
        where: { companyId_code: { companyId, code: d.code } },
      });
      if (!existing) {
        const rubric = await this.create(companyId, d, userId);
        results.push(rubric);
      } else {
        results.push(existing);
      }
    }
    return results;
  }
}
