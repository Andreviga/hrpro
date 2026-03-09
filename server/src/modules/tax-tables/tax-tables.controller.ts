import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TaxTablesService } from './tax-tables.service';

@Controller('tax')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TaxTablesController {
  constructor(private taxTables: TaxTablesService) {}

  @Get('inss')
  @Roles('admin', 'rh', 'manager')
  async listInss(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: { user: { companyId: string } },
  ) {
    return this.taxTables.listInss(
      req.user.companyId,
      Number(month),
      Number(year),
    );
  }

  @Get('irrf')
  @Roles('admin', 'rh', 'manager')
  async listIrrf(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: { user: { companyId: string } },
  ) {
    return this.taxTables.listIrrf(
      req.user.companyId,
      Number(month),
      Number(year),
    );
  }

  @Post('inss')
  @Roles('admin', 'rh')
  async upsertInss(
    @Body()
    body: {
      month: number;
      year: number;
      brackets: {
        minValue: number;
        maxValue: number;
        rate: number;
        deduction: number;
      }[];
    },
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.taxTables.upsertInss(req.user.companyId, body, req.user.sub);
  }

  @Post('irrf')
  @Roles('admin', 'rh')
  async upsertIrrf(
    @Body()
    body: {
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
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.taxTables.upsertIrrf(req.user.companyId, body, req.user.sub);
  }
}
