import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
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

  @Post('payroll/runs/:id/employees/:employeeId/remove')
  @Roles('admin', 'rh', 'manager')
  async removeEmployeeFromRun(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.removeEmployeeFromRun({
      payrollRunId: id,
      employeeId,
      companyId: req.user.companyId,
      userId: req.user.sub,
      reason: body?.reason
    });
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
  async listPaystubs(@Req() req: { user: { employeeId?: string; companyId: string; role: string } }) {
    if (['admin', 'rh', 'manager'].includes(req.user.role)) {
      return this.payroll.listPaystubsByCompany(req.user.companyId);
    }

    if (req.user.employeeId) {
      return this.payroll.listPaystubsByEmployee(req.user.employeeId);
    }

    return [];
  }

  @Get('paystubs/:id')
  async getPaystub(
    @Param('id') id: string,
    @Req() req: { user: { employeeId?: string | null; companyId: string; role: string } }
  ) {
    return this.payroll.getPaystubDetail(id, req.user);
  }

  @Patch('paystubs/:id/events/:eventId')
  @Roles('admin', 'rh', 'manager')
  async updatePaystubEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() body: { amount?: number; description?: string; reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.updatePaystubEvent({
      paystubId: id,
      eventId,
      companyId: req.user.companyId,
      userId: req.user.sub,
      amount: body.amount,
      description: body.description,
      reason: body.reason
    });
  }

  @Get('paystubs/:id/pdf')
  async paystubPdf(
    @Param('id') id: string,
    @Req() req: { user: { employeeId?: string | null; companyId: string; role: string } },
    @Res() res: Response
  ) {
    const detail = await this.payroll.getPaystubDetail(id, req.user);

    const formatCurrency = (value: number) => `R$ ${Number(value ?? 0).toFixed(2).replace('.', ',')}`;
    const formatDate = (value?: string | Date | null) => {
      if (!value) return '--';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleDateString('pt-BR');
    };
    const formatNumber = (value: number | null | undefined, decimals = 2) => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--';
      return Number(value).toFixed(decimals).replace('.', ',');
    };
    const formatHours = (value: number | null | undefined) => {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--';
      return `${formatNumber(Number(value), 2)}h`;
    };

    const salaryTypeLabel = detail.employee?.salaryType === 'hourly'
      ? 'Horista / Professor(a)'
      : detail.employee?.salaryType === 'monthly'
        ? 'Mensalista'
        : '--';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=holerite-${detail.year}-${detail.month}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 24 });
    doc.pipe(res);

    const xStart = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const competence = `${String(detail.month).padStart(2, '0')}/${detail.year}`;

    doc.font('Helvetica-Bold').fontSize(13).text('DEMONSTRATIVO DE PAGAMENTO', { align: 'center' });
    doc.moveDown(0.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(detail.company?.name ?? 'EMPRESA NAO INFORMADA', xStart, doc.y, { width: pageWidth });
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text(`CNPJ: ${detail.company?.cnpj ?? '--'}    Competencia: ${competence}`, xStart, doc.y + 1, {
        width: pageWidth
      });

    const employeeBlockTop = doc.y + 8;
    doc.rect(xStart, employeeBlockTop, pageWidth, 58).stroke();
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text(`Funcionario: ${detail.employee?.fullName ?? '--'}`, xStart + 8, employeeBlockTop + 8, {
        width: pageWidth - 16
      })
      .text(
        `Codigo: ${detail.employee?.employeeCode ?? '--'}    CPF: ${detail.employee?.cpf ?? '--'}    PIS: ${detail.employee?.pis ?? '--'}`,
        xStart + 8,
        employeeBlockTop + 24,
        { width: pageWidth - 16 }
      )
      .text(
        `Cargo: ${detail.employee?.position ?? '--'}    Departamento: ${detail.employee?.department ?? '--'}    Admissao: ${formatDate(detail.employee?.admissionDate)}`,
        xStart + 8,
        employeeBlockTop + 40,
        { width: pageWidth - 16 }
      );

    let y = employeeBlockTop + 66;

    const contractHeight = 42;
    const contractCellWidth = pageWidth / 4;
    doc.rect(xStart, y, pageWidth, contractHeight).stroke();
    for (let index = 1; index < 4; index += 1) {
      const xLine = xStart + contractCellWidth * index;
      doc.moveTo(xLine, y).lineTo(xLine, y + contractHeight).stroke();
    }

    const estimatedMonthlyHours =
      detail.employee?.weeklyHours === null || detail.employee?.weeklyHours === undefined
        ? null
        : Number(detail.employee.weeklyHours) * 5;

    const contractItems = [
      { label: 'Tipo Salario', value: salaryTypeLabel },
      { label: 'Salario Base', value: formatCurrency(Number(detail.employee?.baseSalary ?? 0)) },
      { label: 'Valor Hora/Aula', value: formatCurrency(Number(detail.employee?.hourlyRate ?? 0)) },
      { label: 'Carga Semanal', value: `${formatHours(detail.employee?.weeklyHours)} (Mes est.: ${formatHours(estimatedMonthlyHours)})` }
    ];

    contractItems.forEach((item, index) => {
      const xCell = xStart + contractCellWidth * index;
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(item.label, xCell + 6, y + 6, { width: contractCellWidth - 12 });
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(item.value, xCell + 6, y + 20, { width: contractCellWidth - 12 });
    });

    y += contractHeight + 10;

    const colCode = 52;
    const colDesc = 214;
    const colRef = 70;
    const colEarnings = 100;
    const colDeductions = pageWidth - colCode - colDesc - colRef - colEarnings;
    const rowHeight = 18;

    const drawGrid = (currentY: number, height: number) => {
      doc.rect(xStart, currentY, pageWidth, height).stroke();
      let currentX = xStart + colCode;
      doc.moveTo(currentX, currentY).lineTo(currentX, currentY + height).stroke();
      currentX += colDesc;
      doc.moveTo(currentX, currentY).lineTo(currentX, currentY + height).stroke();
      currentX += colRef;
      doc.moveTo(currentX, currentY).lineTo(currentX, currentY + height).stroke();
      currentX += colEarnings;
      doc.moveTo(currentX, currentY).lineTo(currentX, currentY + height).stroke();
    };

    const drawTableHeader = () => {
      drawGrid(y, rowHeight);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('Codigo', xStart + 5, y + 5, { width: colCode - 10 })
        .text('Descricao', xStart + colCode + 5, y + 5, { width: colDesc - 10 })
        .text('Referencia', xStart + colCode + colDesc + 5, y + 5, { width: colRef - 10 })
        .text('Proventos', xStart + colCode + colDesc + colRef + 5, y + 5, {
          width: colEarnings - 10,
          align: 'right'
        })
        .text('Descontos', xStart + colCode + colDesc + colRef + colEarnings + 5, y + 5, {
          width: colDeductions - 10,
          align: 'right'
        });
      y += rowHeight;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (y + requiredHeight <= pageBottom) return;
      doc.addPage();
      y = doc.page.margins.top;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`DEMONSTRATIVO DE PAGAMENTO - ${detail.employee?.fullName ?? '--'} (${competence})`, xStart, y, {
          width: pageWidth
        });
      y = doc.y + 6;
      drawTableHeader();
    };

    drawTableHeader();

    const rows = (detail.events ?? []).map((event: any) => {
      let reference = '--';
      if (event.code === 'BASE') {
        reference = detail.employee?.salaryType === 'monthly' ? 'MES' : formatHours(detail.employee?.weeklyHours);
      } else if (event.code === 'EXTRA' || event.code === 'HORA_ATV') {
        reference = formatHours(detail.employee?.weeklyHours);
      }

      return {
        code: event.code,
        description: event.description,
        reference,
        provento: event.type === 'earning' ? Number(event.amount) : 0,
        desconto: event.type === 'deduction' ? Number(event.amount) : 0
      };
    });

    for (const row of rows) {
      ensureSpace(rowHeight + 2);
      drawGrid(y, rowHeight);
      doc
        .font('Helvetica')
        .fontSize(8)
        .text(String(row.code ?? ''), xStart + 5, y + 5, { width: colCode - 10 })
        .text(String(row.description ?? ''), xStart + colCode + 5, y + 5, { width: colDesc - 10 })
        .text(String(row.reference ?? '--'), xStart + colCode + colDesc + 5, y + 5, { width: colRef - 10 })
        .text(row.provento ? formatCurrency(row.provento) : '', xStart + colCode + colDesc + colRef + 5, y + 5, {
          width: colEarnings - 10,
          align: 'right'
        })
        .text(row.desconto ? formatCurrency(row.desconto) : '', xStart + colCode + colDesc + colRef + colEarnings + 5, y + 5, {
          width: colDeductions - 10,
          align: 'right'
        });
      y += rowHeight;
    }

    ensureSpace(120);

    const totalsTop = y + 6;
    const totalsHeight = 26;
    const totalsColumnWidth = pageWidth / 3;

    doc.rect(xStart, totalsTop, pageWidth, totalsHeight).stroke();
    doc
      .moveTo(xStart + totalsColumnWidth, totalsTop)
      .lineTo(xStart + totalsColumnWidth, totalsTop + totalsHeight)
      .stroke();
    doc
      .moveTo(xStart + totalsColumnWidth * 2, totalsTop)
      .lineTo(xStart + totalsColumnWidth * 2, totalsTop + totalsHeight)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('Salario Bruto', xStart + 6, totalsTop + 4, { width: totalsColumnWidth - 12 })
      .text('Total Descontos', xStart + totalsColumnWidth + 6, totalsTop + 4, { width: totalsColumnWidth - 12 })
      .text('Salario Liquido', xStart + totalsColumnWidth * 2 + 6, totalsTop + 4, { width: totalsColumnWidth - 12 });

    doc
      .font('Helvetica')
      .fontSize(9)
      .text(formatCurrency(detail.summary.grossSalary), xStart + 6, totalsTop + 14, {
        width: totalsColumnWidth - 12,
        align: 'right'
      })
      .text(formatCurrency(detail.summary.totalDeductions), xStart + totalsColumnWidth + 6, totalsTop + 14, {
        width: totalsColumnWidth - 12,
        align: 'right'
      })
      .text(formatCurrency(detail.summary.netSalary), xStart + totalsColumnWidth * 2 + 6, totalsTop + 14, {
        width: totalsColumnWidth - 12,
        align: 'right'
      });

    y = totalsTop + totalsHeight + 6;

    const basesTop = y;
    const basesHeight = 30;
    const baseColumnWidth = pageWidth / 4;

    doc.rect(xStart, basesTop, pageWidth, basesHeight).stroke();
    for (let index = 1; index < 4; index += 1) {
      const xLine = xStart + baseColumnWidth * index;
      doc.moveTo(xLine, basesTop).lineTo(xLine, basesTop + basesHeight).stroke();
    }

    const baseItems = [
      { label: 'Base INSS', value: formatCurrency(detail.bases?.inssBase ?? detail.summary.grossSalary) },
      { label: 'Base FGTS', value: formatCurrency(detail.bases?.fgtsBase ?? detail.summary.grossSalary) },
      { label: 'Base IRRF', value: formatCurrency(detail.bases?.irrfBase ?? 0) },
      { label: 'FGTS (8%)', value: formatCurrency(detail.summary.fgtsDeposit) }
    ];

    baseItems.forEach((item, index) => {
      const xCell = xStart + baseColumnWidth * index;
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(item.label, xCell + 6, basesTop + 5, { width: baseColumnWidth - 12 });
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .text(item.value, xCell + 6, basesTop + 16, { width: baseColumnWidth - 12, align: 'right' });
    });

    y = basesTop + basesHeight + 12;

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text('Recebi da empresa acima identificada a importancia liquida deste demonstrativo de pagamento.', xStart, y, {
        width: pageWidth
      });

    const signatureY = y + 24;
    doc.moveTo(xStart + 20, signatureY).lineTo(xStart + 220, signatureY).stroke();
    doc
      .font('Helvetica')
      .fontSize(8)
      .text('Assinatura do(a) colaborador(a)', xStart + 58, signatureY + 4, { width: 130, align: 'center' })
      .text(`Emitido em ${formatDate(new Date())}`, xStart + pageWidth - 150, signatureY + 4, {
        width: 150,
        align: 'right'
      });

    doc.end();
  }
  @Post('payroll-runs/:id/documents')
  @Roles('admin', 'rh', 'manager')
  async generateDocuments(
    @Param('id') id: string,
    @Body()
    body: {
      documentType: 'trct' | 'recibo_ferias' | 'holerite';
      templateId?: string;
      employeeIds?: string[];
      extraPlaceholders?: Record<string, string>;
      reason?: string;
      forceRegenerate?: boolean;
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
      reason: body.reason,
      forceRegenerate: body.forceRegenerate
    });
  }

  @Post('payroll-runs/:id/documents/reprocess')
  @Roles('admin', 'rh', 'manager')
  async reprocessDocuments(
    @Param('id') id: string,
    @Body()
    body: {
      documentType: 'trct' | 'recibo_ferias' | 'holerite';
      templateId?: string;
      employeeIds?: string[];
      extraPlaceholders?: Record<string, string>;
      reason?: string;
      forceRegenerate?: boolean;
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
      reason: body.reason,
      forceRegenerate: body.forceRegenerate
    });
  }
}

