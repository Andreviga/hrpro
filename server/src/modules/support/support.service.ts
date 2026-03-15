import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  private isMissingTableError(error: unknown) {
    if (!error || typeof error !== 'object') return false;
    const maybeCode = (error as { code?: string }).code;
    const message = String((error as { message?: string }).message ?? '');
    return maybeCode === 'P2021' || message.includes('does not exist');
  }

  private isAdminRole(role?: string) {
    return Boolean(role && ['admin', 'rh', 'manager'].includes(role));
  }

  private sanitizeText(value: string | undefined, fieldName: string, maxLength = 2000) {
    const sanitized = (value ?? '').trim();
    if (!sanitized) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    if (sanitized.length > maxLength) {
      throw new BadRequestException(`${fieldName} exceeds max length (${maxLength})`);
    }
    return sanitized;
  }

  async listTickets(companyId: string, employeeId?: string, role?: string) {
    const where =
      role && ['admin', 'rh', 'manager'].includes(role)
        ? { companyId }
        : { companyId, employeeId: employeeId ?? undefined };

    try {
      return await this.prisma.supportTicket.findMany({
        where,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' }
      });
    } catch (error) {
      if (this.isMissingTableError(error)) {
        return [];
      }
      throw error;
    }
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
    if (!employeeId) {
      throw new BadRequestException('Tickets must be linked to an employee.');
    }

    const title = this.sanitizeText(data.title, 'title', 160);
    const description = this.sanitizeText(data.description, 'description', 4000);

    return this.prisma.supportTicket.create({
      data: {
        companyId,
        employeeId,
        title,
        description,
        priority: data.priority,
        category: data.category,
        messages: {
          create: {
            message: description,
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

    const sanitizedMessage = this.sanitizeText(message, 'message', 4000);
    const isAdmin = this.isAdminRole(role);
    if (!isAdmin && ticket.employeeId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const sender = isAdmin ? 'admin' : 'employee';
    let nextStatus = ticket.status;

    if (isAdmin && ticket.status === 'open') {
      nextStatus = 'in_progress';
    }

    if (!isAdmin && ['resolved', 'closed'].includes(ticket.status)) {
      nextStatus = 'open';
    }

    const newMessage = await this.prisma.ticketMessage.create({
      data: { ticketId, userId, message: sanitizedMessage, sender, senderName }
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        status: nextStatus,
      }
    });

    return newMessage;
  }

  async updateTicketStatus(
    ticketId: string,
    companyId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed',
    role?: string,
  ) {
    if (!this.isAdminRole(role)) {
      throw new ForbiddenException('Only admin/rh/manager can update ticket status');
    }

    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, companyId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listChatMessages(companyId: string) {
    try {
      return await this.prisma.chatMessage.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        take: 200
      });
    } catch (error) {
      if (this.isMissingTableError(error)) {
        return [];
      }
      throw error;
    }
  }

  async sendChatMessage(
    companyId: string,
    userId: string | undefined,
    senderName: string,
    message: string,
    role?: string
  ) {
    if (!userId) {
      throw new BadRequestException('User ID is required to send messages.');
    }

    const sanitizedMessage = this.sanitizeText(message, 'message', 4000);
    const sender = this.isAdminRole(role) ? 'admin' : 'employee';

    try {
      return await this.prisma.chatMessage.create({
        data: { companyId, userId, message: sanitizedMessage, sender, senderName }
      });
    } catch (error) {
      if (this.isMissingTableError(error)) {
        return {
          id: `local-${Date.now()}`,
          companyId,
          userId,
          message: sanitizedMessage,
          sender,
          senderName,
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
      throw error;
    }
  }

  async markChatRead(companyId: string, role?: string) {
    if (!this.isAdminRole(role)) {
      throw new ForbiddenException('Only admin/rh/manager can mark chat messages as read.');
    }

    try {
      await this.prisma.chatMessage.updateMany({
        where: { companyId, isRead: false },
        data: { isRead: true }
      });
    } catch (error) {
      if (!this.isMissingTableError(error)) {
        throw error;
      }
    }
    return { ok: true };
  }
}
