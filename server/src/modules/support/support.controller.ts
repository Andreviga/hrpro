import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from './support.service';

interface AuthRequest {
  user: {
    sub: string;
    role: string;
    companyId: string;
    employeeId?: string;
  };
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private support: SupportService) {}

  @Get('support/tickets')
  listTickets(@Req() req: AuthRequest) {
    return this.support.listTickets(req.user.companyId, req.user.employeeId, req.user.role);
  }

  @Get('support/tickets/:id')
  getTicket(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.support.getTicket(id, req.user.companyId, req.user.employeeId, req.user.role);
  }

  @Post('support/tickets')
  createTicket(
    @Body() body: {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category: 'payroll' | 'benefits' | 'technical' | 'other';
      senderName?: string;
    },
    @Req() req: AuthRequest
  ) {
    return this.support.createTicket(
      req.user.companyId,
      req.user.employeeId,
      body.senderName ?? 'Usuário',
      { title: body.title, description: body.description, priority: body.priority, category: body.category }
    );
  }

  @Post('support/tickets/:id/messages')
  addMessage(
    @Param('id') id: string,
    @Body() body: { message: string; senderName?: string },
    @Req() req: AuthRequest
  ) {
    return this.support.addMessage(
      id,
      req.user.companyId,
      req.user.sub,
      body.senderName ?? 'Usuário',
      body.message,
      req.user.role
    );
  }

  @Get('support/chat')
  listChat(@Req() req: AuthRequest) {
    return this.support.listChatMessages(req.user.companyId);
  }

  @Post('support/chat')
  sendChat(
    @Body() body: { message: string; senderName?: string },
    @Req() req: AuthRequest
  ) {
    return this.support.sendChatMessage(
      req.user.companyId,
      req.user.sub,
      body.senderName ?? 'Usuário',
      body.message,
      req.user.role
    );
  }

  @Post('support/chat/mark-read')
  markRead(@Req() req: AuthRequest) {
    return this.support.markChatRead(req.user.companyId);
  }
}
