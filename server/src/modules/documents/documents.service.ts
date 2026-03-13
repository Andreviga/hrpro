import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DocumentStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { Document as DocxDocument, Packer, Paragraph, TextRun } from 'docx';
import { DocumentStorageService } from './document-storage.service';
import { PayslipDataBuilder } from './payslip-data.builder';
import { PayslipPdfService } from './payslip-pdf.service';
import { renderPayslipHtml } from './payslip-template';

const PLACEHOLDER_REGEX = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export const extractPlaceholders = (content: string) => {
  const matches = content.matchAll(PLACEHOLDER_REGEX);
  const values = new Set<string>();
  for (const match of matches) {
    values.add(match[1]);
  }
  return Array.from(values);
};

export const mergePlaceholders = (content: string, values: Record<string, string>) => {
  return content.replace(PLACEHOLDER_REGEX, (_, key) => {
    const replacement = values[key];
    return replacement === undefined || replacement === null ? '' : String(replacement);
  });
};

export const validateRequiredPlaceholders = (
  required: string[] | null | undefined,
  values: Record<string, string>
) => {
  const requiredList = required ?? [];
  const missing = requiredList.filter((key) => {
    const value = values[key];
    return value === undefined || value === null || String(value).trim() === '';
  });
  return missing;
};

const allowedTransitions: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ['review', 'reopened'],
  review: ['approved', 'reopened'],
  approved: ['signed', 'reopened'],
  signed: ['finalized', 'reopened'],
  finalized: ['reopened'],
  reopened: ['review']
};

export const canTransitionStatus = (current: DocumentStatus, next: DocumentStatus) => {
  return allowedTransitions[current]?.includes(next) ?? false;
};

const INCOME_STATEMENT_TEMPLATE_NAME = 'Informe de Rendimentos IRPF (IN RFB 2.060/2021)';

const incomeStatementRequiredPlaceholders = [
  'exercicio',
  'ano_calendario',
  'fonte_cnpj_cpf',
  'fonte_nome',
  'beneficiario_cpf',
  'beneficiario_nome',
  'natureza_rendimento',
  'q3_l1_total_rendimentos',
  'q3_l2_previdencia_oficial',
  'q3_l3_previdencia_complementar',
  'q3_l4_pensao_alimenticia',
  'q3_l5_irrf',
  'q4_l1_parcela_isenta_65',
  'q4_l2_parcela_isenta_13_65',
  'q4_l3_diarias_ajudas_custo',
  'q4_l4_molestia_grave',
  'q4_l5_lucros_dividendos',
  'q4_l6_simples_nacional',
  'q4_l7_indenizacoes_rescisao',
  'q4_l8_juros_mora',
  'q4_l9_outros',
  'q5_l1_decimo_terceiro',
  'q5_l2_irrf_decimo_terceiro',
  'q5_l3_outros',
  'data_emissao'
];

export const buildIncomeStatementTemplateName = () => INCOME_STATEMENT_TEMPLATE_NAME;

export const buildIncomeStatementRequiredPlaceholders = () => [...incomeStatementRequiredPlaceholders];

export const buildIncomeStatementTemplateContent = () => `
MINISTERIO DA FAZENDA
SECRETARIA ESPECIAL DA RECEITA FEDERAL DO BRASIL
IMPOSTO SOBRE A RENDA DA PESSOA FISICA

COMPROVANTE DE RENDIMENTOS PAGOS E DE IMPOSTO SOBRE A RENDA RETIDO NA FONTE
Exercicio: {{exercicio}}
Ano-calendario: {{ano_calendario}}

1. FONTE PAGADORA PESSOA JURIDICA OU PESSOA FISICA
CNPJ/CPF: {{fonte_cnpj_cpf}}
Nome empresarial/nome completo: {{fonte_nome}}

2. PESSOA FISICA BENEFICIARIA DOS RENDIMENTOS
CPF: {{beneficiario_cpf}}
Nome completo: {{beneficiario_nome}}
Natureza do rendimento: {{natureza_rendimento}}

3. RENDIMENTOS TRIBUTAVEIS, DEDUCOES E IMPOSTO SOBRE A RENDA RETIDO NA FONTE (IRRF)
01. Total dos rendimentos (inclusive ferias): {{q3_l1_total_rendimentos}}
02. Contribuição previdenciária oficial: {{q3_l2_previdencia_oficial}}
03. Contribuição a entidades de previdência complementar/FAPI: {{q3_l3_previdencia_complementar}}
04. Pensão alimentícia: {{q3_l4_pensao_alimenticia}}
05. Imposto sobre a renda retido na fonte (IRRF): {{q3_l5_irrf}}

4. RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS
01. Parcela isenta de aposentadoria/pensão (65 anos ou mais): {{q4_l1_parcela_isenta_65}}
02. Parcela isenta do 13º salário (65 anos ou mais): {{q4_l2_parcela_isenta_13_65}}
03. Diarias e ajudas de custo: {{q4_l3_diarias_ajudas_custo}}
04. Pensão/proventos por moléstia grave ou acidente em serviço: {{q4_l4_molestia_grave}}
05. Lucros e dividendos (a partir de 1996): {{q4_l5_lucros_dividendos}}
06. Valores pagos a titular/sócio de ME/EPP (Simples), exceto pro-labore/aluguéis/serviços: {{q4_l6_simples_nacional}}
07. Indenizações por rescisão, inclusive PDV e acidente de trabalho: {{q4_l7_indenizacoes_rescisao}}
08. Juros de mora por atraso em remuneração: {{q4_l8_juros_mora}}
09. Outros (especificar): {{q4_l9_outros}}

5. RENDIMENTOS SUJEITOS A TRIBUTAÇÃO EXCLUSIVA (RENDIMENTO LÍQUIDO)
01. 13º salário: {{q5_l1_decimo_terceiro}}
02. IRRF sobre 13º salário: {{q5_l2_irrf_decimo_terceiro}}
03. Outros: {{q5_l3_outros}}

6. RENDIMENTOS RECEBIDOS ACUMULADAMENTE - ART. 12-A DA LEI No 7.713/1988 (TRIBUTAÇÃO EXCLUSIVA)
6.1 Número do processo (se houver): {{q6_1_numero_processo}}
6.1 Natureza do rendimento: {{q6_1_natureza_rendimento}}
6.1 Quantidade de meses: {{q6_1_quantidade_meses}}
Linha 1 - Total dos rendimentos tributáveis (inclusive férias e 13º): {{q6_l1_total_rendimentos}}
Linha 2 - Exclusão: despesas com ação judicial: {{q6_l2_despesas_acao_judicial}}
Linha 3 - Dedução: contribuição previdenciária oficial: {{q6_l3_previdencia_oficial}}
Linha 4 - Dedução: pensão alimentícia: {{q6_l4_pensao_alimenticia}}
Linha 5 - IRRF: {{q6_l5_irrf}}
Linha 6 - Rendimentos isentos por moléstia grave/acidente em serviço: {{q6_l6_isentos_molestia}}

7. INFORMAÇÕES COMPLEMENTARES
{{quadro7_observacoes}}

Declaro que as informações acima foram prestadas em conformidade com o modelo da IN RFB no 2.060/2021.
Data de emissão: {{data_emissao}}
Assinatura da fonte pagadora: {{assinatura_fonte_pagadora}}
Cargo/responsável: {{responsavel_cargo_nome}}
`.trim();

const PAYSTUB_TEMPLATE_NAME = 'Holerite Padrao (Automatico v2)';

const paystubRequiredPlaceholders = [
  'company_name',
  'company_cnpj',
  'employee_name',
  'employee_code',
  'employee_cpf',
  'employee_position',
  'employee_department',
  'employee_email',
  'admission_date',
  'competence',
  'gross_salary',
  'total_deductions',
  'net_salary',
  'fgts',
  'inss_base',
  'fgts_base',
  'irrf_base',
  'bank_name',
  'bank_agency',
  'bank_account',
  'payment_method',
  'meal_voucher_credit',
  'pension_alimony',
  'event_lines'
];

export const buildPaystubTemplateName = () => PAYSTUB_TEMPLATE_NAME;

export const buildPaystubRequiredPlaceholders = () => [...paystubRequiredPlaceholders];

export const buildPaystubTemplateContent = () => `
DEMONSTRATIVO DE PAGAMENTO
Empresa: {{company_name}}
CNPJ: {{company_cnpj}}
Funcionário: {{employee_name}}
Código: {{employee_code}}
CPF: {{employee_cpf}}
Cargo: {{employee_position}}
Departamento: {{employee_department}}
Admissão: {{admission_date}}
E-mail: {{employee_email}}
Competência: {{competence}}

PROVENTOS E DESCONTOS
Salário Bruto: {{gross_salary}}
Total de Descontos: {{total_deductions}}
Salário Líquido: {{net_salary}}
FGTS: {{fgts}}
Base INSS: {{inss_base}}
Base FGTS: {{fgts_base}}
Base IRRF: {{irrf_base}}

PAGAMENTO
Banco: {{bank_name}}
Agência: {{bank_agency}}
Conta: {{bank_account}}
Forma de Pagamento: {{payment_method}}

INFORMAÇÕES COMPLEMENTARES
Vale Alimentação (crédito): {{meal_voucher_credit}}
Pensão Alimentícia: {{pension_alimony}}

RUBRICAS
{{event_lines}}

Declaro ter recebido os valores acima referentes à competência informada.
`.trim();

const paystubTemplateNeedsRepair = (template: { content: string; requiredPlaceholders?: unknown }) => {
  const placeholders = extractPlaceholders(template.content ?? '');
  const required = Array.isArray(template.requiredPlaceholders)
    ? (template.requiredPlaceholders as string[])
    : [];

  return required.some((item) => !placeholders.includes(item));
};
const sanitizeFilenamePart = (value: string) => {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
};

const formatCompetence = (month?: number | null, year?: number | null) => {
  if (!month || !year) return 'sem_competencia';
  return `${String(month).padStart(2, '0')}${year}`;
};

export const buildExportFilename = (params: {
  type: string;
  cpf: string | null | undefined;
  month?: number | null;
  year?: number | null;
  version: number;
  extension: 'pdf' | 'docx';
}) => {
  const cpf = sanitizeFilenamePart((params.cpf || 'sem_cpf').replace(/\D+/g, '')) || 'sem_cpf';
  const competence = sanitizeFilenamePart(formatCompetence(params.month, params.year));
  const type = sanitizeFilenamePart(params.type || 'documento');
  const version = sanitizeFilenamePart(String(params.version || 1));
  return `${type}_${cpf}_${competence}_${version}.${params.extension}`;
};

const renderPdfBuffer = (params: {
  title: string;
  content: string;
  employeeName?: string | null;
  employeeCpf?: string | null;
  competence?: string;
}) => {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text(params.title, { align: 'center' });
      doc.moveDown(0.5);
      if (params.competence) {
        doc.fontSize(10).text(`Competência: ${params.competence}`, { align: 'center' });
        doc.moveDown();
      }

      if (params.employeeName || params.employeeCpf) {
        doc.fontSize(11).text(`Funcionário: ${params.employeeName ?? 'N/A'}`);
        doc.fontSize(10).text(`CPF: ${params.employeeCpf ?? 'N/A'}`);
        doc.moveDown();
      }

      doc.fontSize(11).text('Conteúdo');
      doc.moveDown(0.5);
      params.content.split(/\r?\n/).forEach((line) => {
        doc.fontSize(10).text(line || ' ');
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const renderDocxBuffer = async (params: {
  title: string;
  content: string;
  employeeName?: string | null;
  employeeCpf?: string | null;
  competence?: string;
}) => {
  const paragraphs: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: params.title, bold: true, size: 28 })] })
  ];

  if (params.competence) {
    paragraphs.push(new Paragraph({ children: [new TextRun(`Competência: ${params.competence}`)] }));
  }
  if (params.employeeName || params.employeeCpf) {
    paragraphs.push(new Paragraph({ children: [new TextRun(`Funcionário: ${params.employeeName ?? 'N/A'}`)] }));
    paragraphs.push(new Paragraph({ children: [new TextRun(`CPF: ${params.employeeCpf ?? 'N/A'}`)] }));
  }

  paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
  params.content.split(/\r?\n/).forEach((line) => {
    paragraphs.push(new Paragraph({ children: [new TextRun(line || ' ')] }));
  });

  const doc = new DocxDocument({
    sections: [{ children: paragraphs }]
  });

  return Packer.toBuffer(doc);
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: DocumentStorageService,
    private payslipBuilder: PayslipDataBuilder,
    private payslipPdf: PayslipPdfService
  ) {}

  private async getTemplateOrThrow(id: string, companyId: string) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!template || template.companyId !== companyId) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  private async getDocumentOrThrow(id: string, companyId: string) {
    const document = await this.prisma.employeeDocument.findUnique({ where: { id } });
    if (!document || document.companyId !== companyId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  private async assertPayrollRunEditable(document: { payrollRunId?: string | null }) {
    if (!document.payrollRunId) return;
    const payrollRun = await this.prisma.payrollRun.findUnique({ where: { id: document.payrollRunId } });
    if (payrollRun?.status === 'closed') {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Competência fechada. Documento não pode ser alterado.',
        code: 'PAYROLL_COMPETENCE_CLOSED',
        details: { payrollRunId: payrollRun.id, month: payrollRun.month, year: payrollRun.year }
      });
    }
  }

  async listTemplates(companyId: string, filters: { type?: string; status?: string; includeDeleted?: boolean }) {
    return this.prisma.documentTemplate.findMany({
      where: {
        companyId,
        type: filters.type as any,
        status: filters.status as any,
        deletedAt: filters.includeDeleted ? undefined : null
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async ensureIncomeStatementTemplate(params: { companyId: string; userId?: string; reason?: string }) {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: {
        companyId: params.companyId,
        type: 'outros',
        name: INCOME_STATEMENT_TEMPLATE_NAME,
        deletedAt: null
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }]
    });

    if (existing) {
      return { created: false, template: existing };
    }

    const template = await this.createTemplate({
      companyId: params.companyId,
      userId: params.userId,
      type: 'outros',
      name: INCOME_STATEMENT_TEMPLATE_NAME,
      description: 'Modelo de informe de rendimentos baseado na IN RFB 2.060/2021',
      content: buildIncomeStatementTemplateContent(),
      status: 'draft',
      requiredPlaceholders: buildIncomeStatementRequiredPlaceholders(),
      reason: params.reason ?? 'bootstrap_informe_rendimentos'
    });

    return { created: true, template };
  }

  async ensurePaystubTemplate(params: { companyId: string; userId?: string; reason?: string }) {
    const defaultContent = buildPaystubTemplateContent();
    const defaultRequired = buildPaystubRequiredPlaceholders();

    const existing = await this.prisma.documentTemplate.findFirst({
      where: {
        companyId: params.companyId,
        type: 'holerite',
        name: PAYSTUB_TEMPLATE_NAME,
        deletedAt: null
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }]
    });

    if (existing) {
      if (paystubTemplateNeedsRepair(existing)) {
        const template = await this.updateTemplate(existing.id, {
          companyId: params.companyId,
          userId: params.userId,
          content: defaultContent,
          requiredPlaceholders: defaultRequired,
          reason: params.reason ?? 'repair_holerite_template_placeholders'
        });

        return { created: false, template };
      }

      return { created: false, template: existing };
    }

    const template = await this.createTemplate({
      companyId: params.companyId,
      userId: params.userId,
      type: 'holerite',
      name: PAYSTUB_TEMPLATE_NAME,
      description: 'Template padrão de holerite para emissão em lote.',
      content: defaultContent,
      status: 'draft',
      requiredPlaceholders: defaultRequired,
      reason: params.reason ?? 'bootstrap_holerite'
    });

    return { created: true, template };
  }

  async getTemplate(id: string, companyId: string, includeDeleted?: boolean) {
    const template = await this.getTemplateOrThrow(id, companyId);
    if (template.deletedAt && !includeDeleted) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async listTemplateVersions(templateId: string, companyId: string) {
    await this.getTemplateOrThrow(templateId, companyId);
    return this.prisma.documentVersion.findMany({
      where: { templateId, companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createTemplate(params: {
    companyId: string;
    userId?: string;
    type: string;
    name: string;
    description?: string;
    content: string;
    status?: DocumentStatus;
    requiredPlaceholders?: string[];
    reason?: string;
  }) {
    const placeholders = extractPlaceholders(params.content);
    const required = params.requiredPlaceholders ?? placeholders;

    const invalidRequired = required.filter((item: string) => !placeholders.includes(item));
    if (invalidRequired.length > 0) {
      throw new BadRequestException(`Required placeholders missing in template: ${invalidRequired.join(', ')}`);
    }

    const template = await this.prisma.documentTemplate.create({
      data: {
        companyId: params.companyId,
        type: params.type as any,
        name: params.name,
        description: params.description,
        content: params.content,
        status: params.status ?? 'draft',
        placeholders,
        requiredPlaceholders: required,
        createdBy: params.userId
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        templateId: template.id,
        action: 'create_template',
        reason: params.reason,
        after: template,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'create',
      entity: 'document_template',
      entityId: template.id,
      reason: params.reason,
      after: template
    });

    return template;
  }

  async updateTemplate(id: string, params: { companyId: string; userId?: string; reason?: string } & Record<string, any>) {
    const before = await this.getTemplateOrThrow(id, params.companyId);
    if (before.deletedAt) {
      throw new BadRequestException('Template is deleted');
    }

    const content = params.content ?? before.content;
    const placeholders = extractPlaceholders(content);
    const required = params.requiredPlaceholders ?? before.requiredPlaceholders ?? placeholders;
    const invalidRequired = required.filter((item: string) => !placeholders.includes(item));
    if (invalidRequired.length > 0) {
      throw new BadRequestException(`Required placeholders missing in template: ${invalidRequired.join(', ')}`);
    }

    const shouldBumpVersion = params.content && params.content !== before.content;

    const template = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        type: params.type ?? undefined,
        name: params.name ?? undefined,
        description: params.description ?? undefined,
        content: params.content ?? undefined,
        status: params.status ?? undefined,
        placeholders,
        requiredPlaceholders: required,
        version: shouldBumpVersion ? before.version + 1 : before.version
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        templateId: id,
        action: 'update_template',
        reason: params.reason,
        before,
        after: template,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'update',
      entity: 'document_template',
      entityId: id,
      reason: params.reason,
      before,
      after: template
    });

    return template;
  }

  async softDeleteTemplate(id: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.getTemplateOrThrow(id, companyId);
    const template = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        deletedReason: reason ?? 'N/A'
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId,
        templateId: id,
        action: 'delete_template',
        reason,
        before,
        after: template,
        createdBy: userId
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'delete',
      entity: 'document_template',
      entityId: id,
      reason,
      before,
      after: template
    });

    return template;
  }

  async restoreTemplate(id: string, companyId: string, userId?: string, reason?: string) {
    const before = await this.getTemplateOrThrow(id, companyId);
    if (!before.deletedAt) {
      throw new BadRequestException('Template is not deleted');
    }

    const template = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        deletedReason: null
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId,
        templateId: id,
        action: 'restore_template',
        reason,
        before,
        after: template,
        createdBy: userId
      }
    });

    await this.audit.log({
      companyId,
      userId,
      action: 'restore',
      entity: 'document_template',
      entityId: id,
      reason,
      before,
      after: template
    });

    return template;
  }

  async listDocuments(
    companyId: string,
    filters: { employeeId?: string; month?: number; year?: number; type?: string; status?: string },
    userId: string,
    role: string
  ) {
    const isEmployeeScope = role === 'employee' || role === 'intern';
    let employeeId = filters.employeeId;

    if (isEmployeeScope) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      employeeId = user?.employeeId ?? undefined;
      if (!employeeId) return [];
    }

    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        companyId,
        employeeId,
        OR: isEmployeeScope ? [{ userId }, { userId: null, employeeId }] : undefined,
        month: filters.month,
        year: filters.year,
        type: filters.type as any,
        status: filters.status as any,
        deletedAt: null
      },
      include: {
        payrollRun: {
          select: { id: true, month: true, year: true, status: true, closedAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (isEmployeeScope) {
      return documents.filter((document) => {
        const ownerUserId = this.storage.getStoredOwnerUserId(document);
        return !ownerUserId || ownerUserId === userId;
      });
    }

    return documents;
  }

  async getDocumentForUser(id: string, companyId: string, userId: string, role: string) {
    const document = await this.getDocumentOrThrow(id, companyId);
    if (document.deletedAt) throw new NotFoundException('Document not found');

    if (role === 'employee' || role === 'intern') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.employeeId || user.employeeId !== document.employeeId) {
        throw new ForbiddenException('Not allowed to access this document');
      }

      const ownerUserId = this.storage.getStoredOwnerUserId(document);
      if (ownerUserId && ownerUserId !== userId) {
        throw new ForbiddenException('Not allowed to access this document');
      }
    }

    return document;
  }

  async listDocumentVersions(documentId: string, companyId: string) {
    await this.getDocumentOrThrow(documentId, companyId);
    return this.prisma.documentVersion.findMany({
      where: { documentId, companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDocumentFromTemplate(params: {
    companyId: string;
    userId?: string;
    employeeId: string;
    templateId: string;
    payrollRunId?: string;
    title?: string;
    placeholders: Record<string, string>;
    month?: number;
    year?: number;
    eventDate?: string;
    reason?: string;
  }) {
    const template = await this.getTemplateOrThrow(params.templateId, params.companyId);
    if (template.deletedAt) throw new BadRequestException('Template is deleted');

    if (template.type === 'holerite') {
      throw new BadRequestException(
        'Holerite generation now uses fixed Payslip pipeline and cannot be created from generic templates.'
      );
    }

    const required = (template.requiredPlaceholders as string[]) ?? [];
    const missing = validateRequiredPlaceholders(required, params.placeholders);
    if (missing.length > 0) {
      throw new BadRequestException(`Missing required placeholders: ${missing.join(', ')}`);
    }

    const content = mergePlaceholders(template.content, params.placeholders);

    const document = await this.prisma.employeeDocument.create({
      data: {
        companyId: params.companyId,
        employeeId: params.employeeId,
        templateId: template.id,
        payrollRunId: params.payrollRunId,
        type: template.type,
        title: params.title ?? template.name,
        status: 'draft',
        content,
        placeholders: params.placeholders,
        requiredPlaceholders: required,
        month: params.month,
        year: params.year,
        eventDate: params.eventDate ? new Date(params.eventDate) : undefined,
        createdBy: params.userId
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        documentId: document.id,
        action: 'create_document',
        reason: params.reason,
        after: document,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'create',
      entity: 'employee_document',
      entityId: document.id,
      reason: params.reason,
      after: document
    });

    return document;
  }

  async updateDocument(
    id: string,
    params: { companyId: string; userId?: string; reason?: string } & Record<string, any>
  ) {
    const before = await this.getDocumentOrThrow(id, params.companyId);
    if (before.deletedAt) throw new BadRequestException('Document is deleted');
    await this.assertPayrollRunEditable(before);

    const content = params.content ?? before.content;
    const required = (before.requiredPlaceholders as string[]) ?? [];
    const placeholders = params.placeholders ?? before.placeholders ?? {};

    if (params.placeholders || params.content) {
      const missing = validateRequiredPlaceholders(required, placeholders);
      if (missing.length > 0) {
        throw new BadRequestException(`Missing required placeholders: ${missing.join(', ')}`);
      }
    }

    const updated = await this.prisma.employeeDocument.update({
      where: { id },
      data: {
        title: params.title ?? undefined,
        content: content ?? undefined,
        placeholders: params.placeholders ?? undefined
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        documentId: id,
        action: 'update_document',
        reason: params.reason,
        before,
        after: updated,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'update',
      entity: 'employee_document',
      entityId: id,
      reason: params.reason,
      before,
      after: updated
    });

    return updated;
  }

  async transitionStatus(params: {
    documentId: string;
    companyId: string;
    userId?: string;
    role: string;
    status: DocumentStatus;
    reason?: string;
  }) {
    const before = await this.getDocumentOrThrow(params.documentId, params.companyId);
    if (before.deletedAt) throw new BadRequestException('Document is deleted');

    if (params.status === 'reopened') {
      await this.assertPayrollRunEditable(before);
    }

    if (!canTransitionStatus(before.status as DocumentStatus, params.status)) {
      throw new BadRequestException(`Invalid status transition from ${before.status} to ${params.status}`);
    }

    if (params.status === 'reopened' && !['admin', 'rh', 'manager'].includes(params.role)) {
      throw new ForbiddenException('Not allowed to reopen document');
    }

    const updated = await this.prisma.employeeDocument.update({
      where: { id: params.documentId },
      data: {
        status: params.status,
        finalizedAt: params.status === 'finalized' ? new Date() : undefined,
        reopenedAt: params.status === 'reopened' ? new Date() : undefined
      }
    });

    await this.prisma.documentApproval.create({
      data: {
        documentId: params.documentId,
        status: params.status,
        reviewerRole: params.role as any,
        reviewerId: params.userId,
        reason: params.reason,
        decidedAt: new Date()
      }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        documentId: params.documentId,
        action: 'status_change',
        reason: params.reason,
        before,
        after: updated,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'status_change',
      entity: 'employee_document',
      entityId: params.documentId,
      reason: params.reason,
      before,
      after: updated
    });

    return updated;
  }

  async signDocument(params: {
    documentId: string;
    companyId: string;
    userId?: string;
    role: string;
    employeeId?: string;
    signatureType: 'digital' | 'token' | 'biometric';
    tokenHash?: string;
    ipAddress?: string;
    deviceInfo?: string;
    reason?: string;
  }) {
    const before = await this.getDocumentForUser(
      params.documentId,
      params.companyId,
      params.userId ?? '',
      params.role
    );
    if (before.status !== 'approved' && before.status !== 'signed') {
      throw new BadRequestException('Document must be approved before signing');
    }

    // Validate that employee users can only sign docs for themselves
    const isAdminRole = ['admin', 'rh', 'manager'].includes(params.role);
    if (!isAdminRole && params.employeeId && params.employeeId !== params.userId) {
      throw new ForbiddenException('Employees can only sign documents for themselves');
    }

    // Check idempotency: prevent duplicate signatures from the same user
    const existingSignature = await this.prisma.documentSignature.findFirst({
      where: {
        documentId: params.documentId,
        userId: params.userId
      }
    });

    if (existingSignature) {
      // Already signed by this user; return success without creating a duplicate
      return before;
    }

    const signature = await this.prisma.documentSignature.create({
      data: {
        documentId: params.documentId,
        employeeId: params.employeeId,
        userId: params.userId,
        signatureType: params.signatureType as any,
        tokenHash: params.tokenHash,
        ipAddress: params.ipAddress,
        deviceInfo: params.deviceInfo
      }
    });

    const updated = await this.prisma.employeeDocument.update({
      where: { id: params.documentId },
      data: { status: 'signed' }
    });

    await this.prisma.documentVersion.create({
      data: {
        companyId: params.companyId,
        documentId: params.documentId,
        action: 'sign_document',
        reason: params.reason,
        before,
        after: updated,
        createdBy: params.userId
      }
    });

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'sign',
      entity: 'employee_document',
      entityId: params.documentId,
      reason: params.reason,
      before,
      after: { ...updated, signatureId: signature.id }
    });

    return updated;
  }

  async exportDocumentPayload(id: string, companyId: string, userId: string, role: string) {
    const document = await this.getDocumentForUser(id, companyId, userId, role);

    return {
      id: document.id,
      type: document.type,
      title: document.title,
      status: document.status,
      content: document.content,
      placeholders: document.placeholders ?? {},
      month: document.month,
      year: document.year,
      eventDate: document.eventDate,
      generatedAt: new Date().toISOString()
    };
  }

  private async resolveDocumentOwnerUserId(document: {
    companyId: string;
    employeeId: string;
    userId?: string | null;
  }) {
    if (document.userId && document.userId.trim().length > 0) {
      return document.userId;
    }

    const ownerUser = await this.prisma.user.findFirst({
      where: {
        companyId: document.companyId,
        employeeId: document.employeeId
      },
      select: { id: true }
    });

    return ownerUser?.id ?? document.employeeId;
  }

  private buildPayslipFilename(year?: number | null, month?: number | null) {
    return `holerite-${year ?? 'sem-ano'}-${String(month ?? 0).padStart(2, '0')}.pdf`;
  }

  private async ensureStoredHoleriteFile(document: {
    id: string;
    companyId: string;
    employeeId: string;
    payrollRunId?: string | null;
    userId?: string | null;
    month?: number | null;
    year?: number | null;
    title: string;
  }) {
    if (!document.month || !document.year) {
      throw new BadRequestException(
        'Holerite sem competência associada. Regenerate the document to export PDF.'
      );
    }

    const payslip = await this.payslipBuilder.buildPayslip(document.employeeId, {
      companyId: document.companyId,
      payrollRunId: document.payrollRunId ?? undefined,
      month: document.month,
      year: document.year
    });

    const pdfBuffer = await this.payslipPdf.generatePayslipPdf(payslip);
    const htmlContent = renderPayslipHtml(payslip);
    const ownerUserId = await this.resolveDocumentOwnerUserId(document);

    const saved = await this.storage.saveDocumentRecord({
      companyId: document.companyId,
      userId: ownerUserId,
      employeeId: document.employeeId,
      payrollRunId: document.payrollRunId ?? undefined,
      documentType: 'holerite',
      title: document.title,
      competenceMonth: document.month,
      competenceYear: document.year,
      status: 'finalized',
      filename: this.buildPayslipFilename(document.year, document.month),
      pdfBuffer,
      htmlContent,
      documentId: document.id,
      reason: 'regenerate_legacy_holerite_storage'
    });

    return {
      buffer: pdfBuffer,
      filename: saved.filePath.split('/').pop() || this.buildPayslipFilename(document.year, document.month),
      contentType: 'application/pdf' as const
    };
  }

  async saveDocumentRecord(params: Parameters<DocumentStorageService['saveDocumentRecord']>[0]) {
    return this.storage.saveDocumentRecord(params);
  }

  async listUserDocuments(userId: string, type?: string) {
    return this.storage.listUserDocuments(userId, type);
  }

  async exportDocumentFile(params: {
    id: string;
    companyId: string;
    userId: string;
    role: string;
    format: 'pdf' | 'docx';
  }) {
    const document = await this.getDocumentForUser(params.id, params.companyId, params.userId, params.role);

    if (document.type === 'holerite') {
      if (params.format !== 'pdf') {
        throw new BadRequestException('Holerite export supports only PDF format');
      }

      const storedPath = this.storage.getStoredFilePath(document);
      if (storedPath) {
        try {
          const buffer = await this.storage.readStoredPdf(storedPath);
          const filename = storedPath.split('/').pop() || 'holerite.pdf';

          await this.audit.log({
            companyId: params.companyId,
            userId: params.userId,
            action: 'export',
            entity: 'employee_document',
            entityId: document.id,
            after: {
              format: 'pdf',
              filename,
              source: 'stored_file',
              exportedAt: new Date().toISOString()
            }
          });

          return {
            buffer,
            filename,
            contentType: 'application/pdf'
          };
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            throw error;
          }
        };
      }

      const regenerated = await this.ensureStoredHoleriteFile(document);

      await this.audit.log({
        companyId: params.companyId,
        userId: params.userId,
        action: 'export',
        entity: 'employee_document',
        entityId: document.id,
        after: {
          format: 'pdf',
          filename: regenerated.filename,
          source: 'regenerated_legacy_file',
          exportedAt: new Date().toISOString()
        }
      });

      return regenerated;
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: document.employeeId } });
    if (!employee || employee.companyId !== params.companyId) {
      throw new NotFoundException('Employee not found');
    }

    const template = document.templateId
      ? await this.prisma.documentTemplate.findUnique({ where: { id: document.templateId } })
      : null;
    const version = template?.version ?? 1;
    const competence = formatCompetence(document.month, document.year);

    const filename = buildExportFilename({
      type: document.type,
      cpf: employee.cpf,
      month: document.month,
      year: document.year,
      version,
      extension: params.format
    });

    const contentType =
      params.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const payload = {
      title: document.title,
      content: document.content,
      employeeName: employee.fullName,
      employeeCpf: employee.cpf,
      competence
    };

    const buffer =
      params.format === 'pdf' ? await renderPdfBuffer(payload) : await renderDocxBuffer(payload);

    await this.audit.log({
      companyId: params.companyId,
      userId: params.userId,
      action: 'export',
      entity: 'employee_document',
      entityId: document.id,
      after: {
        format: params.format,
        filename,
        exportedAt: new Date().toISOString()
      }
    });

    return { buffer, filename, contentType };
  }
}


