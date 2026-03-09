import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RubricsService } from './rubrics.service';

@Controller('rubrics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RubricsController {
  constructor(private rubrics: RubricsService) {}

  @Get()
  @Roles('admin', 'rh', 'manager')
  async list(
    @Req() req: { user: { companyId: string } },
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.rubrics.list(
      req.user.companyId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @Roles('admin', 'rh', 'manager')
  async getById(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string } },
  ) {
    return this.rubrics.getById(req.user.companyId, id);
  }

  @Post()
  @Roles('admin', 'rh')
  async create(
    @Body()
    body: {
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
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.rubrics.create(req.user.companyId, body, req.user.sub);
  }

  @Patch(':id')
  @Roles('admin', 'rh')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
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
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.rubrics.update(req.user.companyId, id, body, req.user.sub);
  }

  @Delete(':id')
  @Roles('admin', 'rh')
  async delete(
    @Param('id') id: string,
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.rubrics.delete(req.user.companyId, id, req.user.sub);
  }

  @Post('seed-defaults')
  @Roles('admin')
  async seedDefaults(
    @Req() req: { user: { companyId: string; sub: string } },
  ) {
    return this.rubrics.seedDefaults(req.user.companyId, req.user.sub);
  }
}
