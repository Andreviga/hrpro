import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async listTickets(companyId: string, employeeId?: string, role?: string) {
    const where =
      role && ['admin', 'rh', 'manager'].includes(role)
        ? { companyId }
        : { companyId, employeeId: employeeId ?? undefined };

    return this.prisma.supportTicket.findMany({
      where,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getTicket(id: string, companyId: string, employeeId?: string, role?: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, companyId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAdmin = role && ['admin', 'rh', 'manager'].includes(role);
    if (!isAdmin && ticket.employeeId !== employeeId) {
      throw new ForbiddenException('Access denied');
    }

    return ticket;
  }

  async createTicket(
    companyId: string,
    employeeId: string | undefined,
    senderName: string,
    data: {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      category: 'payroll' | 'benefits' | 'technical' | 'other';
    }
  ) {
    return this.prisma.supportTicket.create({
      data: {
        companyId,
        employeeId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        category: data.category,
        messages: {
          create: {
            message: data.description,
            sender: 'employee',
            senderName
          }
        }
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
  }

  async addMessage(
    ticketId: string,
    companyId: string,
    userId: string | undefined,
    senderName: string,
    message: string,
    role?: string
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, companyId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAdmin = role && ['admin', 'rh', 'manager'].includes(role);
    const sender = isAdmin ? 'admin' : 'employee';

    const newMessage = await this.prisma.ticketMessage.create({
      data: { ticketId, userId, message, sender, senderName }
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() }
    });

    return newMessage;
  }

  async listChatMessages(companyId: string) {
    return this.prisma.chatMessage.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      take: 200
    });
  }

  async sendChatMessage(
    companyId: string,
    userId: string | undefined,
    senderName: string,
    message: string,
    role?: string
  ) {
    const sender = role && ['admin', 'rh', 'manager'].includes(role) ? 'admin' : 'employee';

    return this.prisma.chatMessage.create({
      data: { companyId, userId, message, sender, senderName }
    });
  }

  async markChatRead(companyId: string) {
    await this.prisma.chatMessage.updateMany({
      where: { companyId, isRead: false },
      data: { isRead: true }
    });
    return { ok: true };
  }
}
