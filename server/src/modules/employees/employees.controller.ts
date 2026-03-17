import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(AuthGuard('jwt'))
export class EmployeesController {
  constructor(private employees: EmployeesService) {}

  @Get()
  async list(@Query() query: any, @Req() req: { user: { companyId: string; sub: string } }) {
    return this.employees.list(query, req.user.companyId);
  }

  @Get('pending')
  async pending(@Req() req: { user: { companyId: string } }) {
    return this.employees.listPending(req.user.companyId);
  }

  @Get('cleanup/extra/candidates')
  async listExtraCleanupCandidates(@Req() req: { user: { companyId: string } }) {
    return this.employees.listExtraCleanupCandidates(req.user.companyId);
  }

  @Post('cleanup/extra/delete')
  async cleanupExtraEmployees(
    @Body() body: { employeeIds?: string[]; execute?: boolean; reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.cleanupExtraEmployees({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeIds: body.employeeIds,
      execute: body.execute,
      reason: body.reason
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.employees.getById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.update(id, body, req.user.companyId, req.user.sub, body.reason);
  }

  @Delete(':id')
  async softDelete(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.softDelete(id, req.user.companyId, req.user.sub, body?.reason);
  }

  @Post()
  async create(@Body() body: any, @Req() req: { user: { companyId: string; sub: string } }) {
    return this.employees.create(body, req.user.companyId, req.user.sub);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: { user: { companyId: string; sub: string } }) {
    return this.employees.approve(id, req.user.companyId, req.user.sub);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.reject(id, req.user.companyId, body.reason ?? 'N/A', req.user.sub);
  }

  @Get(':id/contracts')
  async listContracts(@Param('id') id: string, @Req() req: { user: { companyId: string } }) {
    return this.employees.listContracts(id, req.user.companyId);
  }

  @Post(':id/contracts')
  async createContract(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.createContract(id, req.user.companyId, body, req.user.sub);
  }

  @Patch('contracts/:contractId')
  async updateContract(
    @Param('contractId') contractId: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.updateContract(contractId, req.user.companyId, body, req.user.sub, body.reason);
  }

  @Post('contracts/:contractId/approve')
  async approveContract(
    @Param('contractId') contractId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.approveContract(contractId, req.user.companyId, req.user.sub, body?.reason);
  }

  @Post('contracts/:contractId/reject')
  async rejectContract(
    @Param('contractId') contractId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.rejectContract(contractId, req.user.companyId, body.reason ?? 'N/A', req.user.sub);
  }

  @Get(':id/salary-history')
  async listSalaryHistory(@Param('id') id: string, @Req() req: { user: { companyId: string } }) {
    return this.employees.listSalaryHistory(id, req.user.companyId);
  }

  @Post(':id/salary-history')
  async createSalaryHistory(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.createSalaryHistory(id, req.user.companyId, body, req.user.sub);
  }

  @Patch('salary-history/:historyId')
  async updateSalaryHistory(
    @Param('historyId') historyId: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.updateSalaryHistory(historyId, req.user.companyId, body, req.user.sub, body.reason);
  }

  @Post('salary-history/:historyId/approve')
  async approveSalaryHistory(
    @Param('historyId') historyId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.approveSalaryHistory(historyId, req.user.companyId, req.user.sub, body?.reason);
  }

  @Post('salary-history/:historyId/reject')
  async rejectSalaryHistory(
    @Param('historyId') historyId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.rejectSalaryHistory(historyId, req.user.companyId, body.reason ?? 'N/A', req.user.sub);
  }

  @Get(':id/benefits')
  async listBenefits(@Param('id') id: string, @Req() req: { user: { companyId: string } }) {
    return this.employees.listBenefits(id, req.user.companyId);
  }

  @Post(':id/benefits')
  async createBenefit(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.createBenefit(id, req.user.companyId, body, req.user.sub);
  }

  @Patch('benefits/:benefitId')
  async updateBenefit(
    @Param('benefitId') benefitId: string,
    @Body() body: { reason?: string } & Record<string, any>,
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.updateBenefit(benefitId, req.user.companyId, body, req.user.sub, body.reason);
  }

  @Post('benefits/:benefitId/approve')
  async approveBenefit(
    @Param('benefitId') benefitId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.approveBenefit(benefitId, req.user.companyId, req.user.sub, body?.reason);
  }

  @Post('benefits/:benefitId/reject')
  async rejectBenefit(
    @Param('benefitId') benefitId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.rejectBenefit(benefitId, req.user.companyId, body.reason ?? 'N/A', req.user.sub);
  }

  @Delete('benefits/:benefitId')
  async deleteBenefit(
    @Param('benefitId') benefitId: string,
    @Body() body: { reason?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.employees.deleteBenefit(benefitId, req.user.companyId, req.user.sub, body?.reason);
  }
}
