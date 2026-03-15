import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PayrollService } from './payroll.service';
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
  async reopenRun(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { sub: string } }
  ) {
    return this.payroll.reopenRun(id, req.user.sub, body?.reason);
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

  /** @deprecated use POST payroll/runs/:id/calculate-sync */
  @Post('payroll-runs/:id/calculate-sync')
  async calculateSync(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.calculateRun(id, req.user.sub);
  }

  /** @deprecated use POST payroll/runs/:id/close */
  @Post('payroll-runs/:id/close')
  @Roles('admin', 'rh', 'manager')
  async closeRun(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.closeRun(id, req.user.sub);
  }

  // ── v2 canonical routes ───────────────────────────────────────────────
  @Post('payroll/runs/:id/calculate-sync')
  async calculateSyncV2(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.payroll.calculateRun(id, req.user.sub);
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
    if (req.user.employeeId) {
      return this.payroll.listPaystubsByEmployee(req.user.employeeId);
    }

    return [];
  }

  @Get('paystubs/admin')
  @Roles('admin', 'rh', 'manager')
  async listPaystubsAdmin(
    @Req() req: { user: { companyId: string } },
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('employeeId') employeeId?: string,
    @Query('employeeName') employeeName?: string
  ) {
    const parsedMonth = month ? Number(month) : undefined;
    const parsedYear = year ? Number(year) : undefined;

    if (month && (!parsedMonth || Number.isNaN(parsedMonth))) {
      throw new BadRequestException('Month must be numeric.');
    }

    if (year && (!parsedYear || Number.isNaN(parsedYear))) {
      throw new BadRequestException('Year must be numeric.');
    }

    return this.payroll.listPaystubsForCompany({
      companyId: req.user.companyId,
      month: parsedMonth,
      year: parsedYear,
      employeeId,
      employeeName
    });
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

  @Patch('paystubs/:id/content')
  @Roles('admin', 'rh', 'manager')
  async updatePaystubContent(
    @Param('id') id: string,
    @Body()
    body: {
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
        mealVoucherValue?: number;
      };
      companyProfile?: {
        name?: string;
        cnpj?: string;
        address?: string;
        logoUrl?: string;
      };
      payslipOverride?: Record<string, unknown>;
      reason?: string;
    },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.payroll.updatePaystubContent({
      paystubId: id,
      companyId: req.user.companyId,
      userId: req.user.sub,
      employee: body.employee,
      companyProfile: body.companyProfile,
      payslipOverride: body.payslipOverride,
      reason: body.reason
    });
  }

  @Get('paystubs/:id/pdf')
  async paystubPdf(
    @Param('id') id: string,
    @Req() req: { user: { employeeId?: string | null; companyId: string; role: string; sub?: string } },
    @Res() res: Response
  ) {
    const exportedDocument = await this.payroll.exportPaystubPdf({
      paystubId: id,
      requester: req.user,
      userId: req.user.sub
    });

    res.setHeader('Content-Type', exportedDocument.contentType);
    res.setHeader('Content-Disposition', `inline; filename=${exportedDocument.filename}`);
    res.send(exportedDocument.buffer);
  }

  @Post('paystubs/:id/send-email')
  async sendPaystubByEmail(
    @Param('id') id: string,
    @Body() body: { email?: string; subject?: string; message?: string },
    @Req() req: { user: { employeeId?: string | null; companyId: string; role: string; sub?: string } }
  ) {
    return this.payroll.sendPaystubByEmail({
      paystubId: id,
      requester: req.user,
      userId: req.user.sub,
      recipientEmail: body.email,
      subject: body.subject,
      message: body.message
    });
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

  // ── v2 alias routes para documentos ───────────────────────────────────
  @Post('payroll/runs/:id/documents')
  @Roles('admin', 'rh', 'manager')
  async generateDocumentsV2(
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

  @Post('payroll/runs/:id/documents/reprocess')
  @Roles('admin', 'rh', 'manager')
  async reprocessDocumentsV2(
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

// helper

