import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TimeBankService } from './timebank.service';

@Controller('timebank')
@UseGuards(AuthGuard('jwt'))
export class TimeBankController {
  constructor(private timebank: TimeBankService) {}

  @Get()
  async list(@Req() req: { user: { employeeId?: string } }) {
    if (!req.user.employeeId) return [];
    return this.timebank.list(req.user.employeeId);
  }

  @Post('entries')
  async createEntry(
    @Body() body: { employeeId: string; date: string; minutes: number; type: 'credit' | 'debit'; note?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.timebank.createEntry({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeId: body.employeeId,
      date: body.date,
      minutes: body.minutes,
      type: body.type,
      note: body.note
    });
  }

  @Post('close')
  async close(
    @Body() body: { employeeId: string; month: number; year: number; approvedBy?: string },
    @Req() req: { user: { companyId: string; sub: string } }
  ) {
    return this.timebank.closeMonth({
      companyId: req.user.companyId,
      userId: req.user.sub,
      employeeId: body.employeeId,
      month: body.month,
      year: body.year,
      approvedBy: body.approvedBy
    });
  }
}
