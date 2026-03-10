import { Controller, Get, Put, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SystemConfigService } from './system-config.service';

interface AuthRequest {
  user: { sub: string; companyId: string };
}

@Controller('system-config')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SystemConfigController {
  constructor(private sysConfig: SystemConfigService) {}

  @Get()
  get(@Req() req: AuthRequest) {
    return this.sysConfig.getConfig(req.user.companyId);
  }

  @Put()
  @Roles('admin', 'rh')
  put(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    return this.sysConfig.upsertConfig(req.user.companyId, body);
  }

  @Patch()
  @Roles('admin', 'rh')
  patch(@Body() body: Record<string, unknown>, @Req() req: AuthRequest) {
    return this.sysConfig.patchConfig(req.user.companyId, body);
  }
}
