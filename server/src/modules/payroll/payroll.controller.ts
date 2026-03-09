import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayrollService } from './payroll.service';
import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PayrollController {
  constructor(private payroll: PayrollService) {}

  @Get('payroll/runs')
  @Roles('admin', 'rh', 'manager')
  async listRuns(
    @Query('month') month: string | undefined,
    @Query('year') year: string | undefined,
    @Query('status') status: 'draft' | 'calculated' | 'closed' | undefined,
    @Req() req: { user: { companyId: string } }
  ) {
    return this.payroll.listRuns(req.user.companyId, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      status
    });
  }

  @Post('payroll/runs/open')
  @Roles('admin', 'rh', 'manager')
  async openRun(
    @Body() body: { month: number; year: number },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.openRun(req.user.companyId, body.month, body.year, req.user.sub);
  }

  @Post('payroll/runs/:id/close')
  @Roles('admin', 'rh', 'manager')
  async closeRunV2(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.closeRunWithValidation(id, req.user.sub);
  }

  @Post('payroll/runs/:id/reopen')
  @Roles('admin', 'rh', 'manager')
  async reopenRun(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.reopenRun(id, req.user.sub);
  }

  @Get('payroll/runs/summary')
  @Roles('admin', 'rh', 'manager')
  async runSummary(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: { user: { companyId: string } }
  ) {
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    if (!month || !year || Number.isNaN(parsedMonth) || Number.isNaN(parsedYear)) {
      throw new BadRequestException('Month and year are required');
    }
    return this.payroll.getRunSummary(req.user.companyId, parsedMonth, parsedYear);
  }

  @Post('payroll/income-statements/generate')
  @Roles('admin', 'rh', 'manager')
  async generateIncomeStatements(
    @Body() body: { year: number; employeeIds?: string[]; reason?: string; idempotent?: boolean },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    const year = Number(body.year);
    if (!body.year || Number.isNaN(year)) {
      throw new BadRequestException('Year is required');
    }

    return this.payroll.generateIncomeStatementsForYear({
      companyId: req.user.companyId,
      year,
      userId: req.user.sub,
      employeeIds: body.employeeIds,
      reason: body.reason,
      idempotent: body.idempotent
    });
  }

  @Post('payroll-runs')
  async createRun(@Body() body: { month: number; year: number }, @Req() req: { user: { companyId: string } }) {
    return this.payroll.createRun(req.user.companyId, body.month, body.year);
  }

  @Post('payroll-runs/:id/calculate')
  async calculate(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.enqueueCalculate(id, req.user.sub);
  }

  @Post('payroll-runs/:id/calculate-sync')
  async calculateSync(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.calculateRun(id, req.user.sub);
  }

  @Post('payroll-runs/:id/close')
  @Roles('admin', 'rh', 'manager')
  async closeRun(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.closeRun(id, req.user.sub);
  }

  @Post('payroll/preview')
  async preview(@Body() body: { employeeId: string; month: number; year: number }, @Req() req: { user: { companyId: string } }) {
    return this.payroll.previewCalculation(req.user.companyId, body.employeeId, body.month, body.year);
  }

  @Get('payroll/grid')
  @Roles('admin', 'rh', 'manager')
  async getPayrollGrid(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: { user: { companyId: string } },
  ) {
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    if (!month || !year || Number.isNaN(parsedMonth) || Number.isNaN(parsedYear)) {
      throw new BadRequestException('Month and year are required');
    }
    return this.payroll.getPayrollGrid(req.user.companyId, parsedMonth, parsedYear);
  }

  @Get('paystubs')
  async listPaystubs(@Req() req: { user: { employeeId?: string } }) {
    if (!req.user.employeeId) return [];
    return this.payroll.listPaystubsByEmployee(req.user.employeeId);
  }

  @Get('paystubs/:id')
  async getPaystub(@Param('id') id: string) {
    return this.payroll.getPaystubDetail(id);
  }

  @Get('paystubs/:id/pdf')
  async paystubPdf(@Param('id') id: string, @Res() res: Response) {
    const detail = await this.payroll.getPaystubDetail(id);

    const formatCurrency = (value: number) => `R$ ${Number(value ?? 0).toFixed(2).replace('.', ',')}`;
    const formatDate = (value?: string | Date | null) => {
      if (!value) return '--';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleDateString('pt-BR');
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=holerite-${detail.year}-${detail.month}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 28 });
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(13).text('DEMONSTRATIVO DE PAGAMENTO', { align: 'center' });
    doc.moveDown(0.35);
    doc.fontSize(10).text(detail.company?.name ?? 'EMPRESA NAO INFORMADA');
    doc
      .fontSize(9)
      .text(`CNPJ: ${detail.company?.cnpj ?? '--'}   Competencia: ${String(detail.month).padStart(2, '0')}/${detail.year}`);

    doc.moveDown(0.35);
    doc
      .fontSize(9)
      .text(`Funcionario: ${detail.employee?.fullName ?? '--'}`)
      .text(`CPF: ${detail.employee?.cpf ?? '--'}   Cargo: ${detail.employee?.position ?? '--'}`)
      .text(
        `Matricula: ${detail.employee?.employeeCode ?? '--'}   PIS: ${detail.employee?.pis ?? '--'}   Admissao: ${formatDate(
          detail.employee?.admissionDate
        )}`
      );

    doc.moveDown(0.45);

    const codeWidth = 60;
    const descWidth = 250;
    const amountWidth = (pageWidth - codeWidth - descWidth) / 2;
    const xStart = doc.page.margins.left;

    let y = doc.y;

    const drawTableHeader = () => {
      doc.rect(xStart, y, codeWidth + descWidth + amountWidth * 2, 20).stroke();
      doc
        .fontSize(9)
        .text('Codigo', xStart + 6, y + 6, { width: codeWidth - 8 })
        .text('Descricao', xStart + codeWidth + 6, y + 6, { width: descWidth - 8 })
        .text('Proventos', xStart + codeWidth + descWidth + 6, y + 6, { width: amountWidth - 8, align: 'right' })
        .text('Descontos', xStart + codeWidth + descWidth + amountWidth + 6, y + 6, {
          width: amountWidth - 8,
          align: 'right'
        });

      y += 20;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight < doc.page.height - doc.page.margins.bottom) return;
      doc.addPage();
      y = doc.page.margins.top;
      drawTableHeader();
    };

    drawTableHeader();

    const rows = (detail.events ?? []).map((event: any) => ({
      code: event.code,
      description: event.description,
      provento: event.type === 'earning' ? Number(event.amount) : 0,
      desconto: event.type === 'deduction' ? Number(event.amount) : 0
    }));

    for (const row of rows) {
      ensureSpace(18);
      doc.rect(xStart, y, codeWidth + descWidth + amountWidth * 2, 18).stroke();
      doc
        .fontSize(8.5)
        .text(String(row.code ?? ''), xStart + 6, y + 5, { width: codeWidth - 8 })
        .text(String(row.description ?? ''), xStart + codeWidth + 6, y + 5, { width: descWidth - 10 })
        .text(row.provento ? formatCurrency(row.provento) : '', xStart + codeWidth + descWidth + 6, y + 5, {
          width: amountWidth - 8,
          align: 'right'
        })
        .text(row.desconto ? formatCurrency(row.desconto) : '', xStart + codeWidth + descWidth + amountWidth + 6, y + 5, {
          width: amountWidth - 8,
          align: 'right'
        });
      y += 18;
    }

    ensureSpace(86);

    doc.moveTo(xStart, y + 6).lineTo(xStart + codeWidth + descWidth + amountWidth * 2, y + 6).stroke();
    y += 12;

    doc
      .fontSize(10)
      .text(`Salario Bruto: ${formatCurrency(detail.summary.grossSalary)}`, xStart, y)
      .text(`Total Descontos: ${formatCurrency(detail.summary.totalDeductions)}`, xStart + 220, y)
      .fontSize(11)
      .text(`Salario Liquido: ${formatCurrency(detail.summary.netSalary)}`, xStart + 430, y, {
        width: 120,
        align: 'right'
      });

    y += 24;

    doc
      .fontSize(9)
      .text(
        `Bases -> INSS: ${formatCurrency(detail.bases?.inssBase ?? detail.summary.grossSalary)} | FGTS: ${formatCurrency(
          detail.bases?.fgtsBase ?? detail.summary.grossSalary
        )} | IRRF: ${formatCurrency(detail.bases?.irrfBase ?? 0)}`,
        xStart,
        y
      )
      .text(`FGTS (8%): ${formatCurrency(detail.summary.fgtsDeposit)}`, xStart, y + 14);

    y += 42;

    doc
      .fontSize(8.5)
      .text(
        'Recebi da empresa acima identificada a importancia liquida deste demonstrativo de pagamento.',
        xStart,
        y,
        { width: pageWidth }
      );

    doc.end();
  }

  @Post('payroll-runs/:id/documents')
  @Roles('admin', 'rh', 'manager')
  async generateDocuments(
    @Param('id') id: string,
    @Body()
    body: {
      documentType: 'trct' | 'recibo_ferias';
      templateId?: string;
      employeeIds?: string[];
      extraPlaceholders?: Record<string, string>;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.generateDocumentsForRun({
      payrollRunId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      documentType: body.documentType,
      templateId: body.templateId,
      employeeIds: body.employeeIds,
      extraPlaceholders: body.extraPlaceholders,
      reason: body.reason
    });
  }

  @Post('payroll-runs/:id/documents/reprocess')
  @Roles('admin', 'rh', 'manager')
  async reprocessDocuments(
    @Param('id') id: string,
    @Body()
    body: {
      documentType: 'trct' | 'recibo_ferias';
      templateId?: string;
      employeeIds?: string[];
      extraPlaceholders?: Record<string, string>;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.reprocessDocumentsForRun({
      payrollRunId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      documentType: body.documentType,
      templateId: body.templateId,
      employeeIds: body.employeeIds,
      extraPlaceholders: body.extraPlaceholders,
      reason: body.reason
    });
  }
}

