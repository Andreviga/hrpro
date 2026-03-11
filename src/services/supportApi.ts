/**
 * Serviços de API para sistema de suporte e chat
 * Conecta ao backend real via HTTP
 */
import { request } from './http';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'payroll' | 'benefits' | 'technical' | 'other';
  employeeId: string | null;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  message: string;
  sender: 'employee' | 'admin';
  senderName: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  sender: 'employee' | 'admin';
  senderName: string;
  createdAt: string;
  isRead: boolean;
}

export const supportApi = {
  async getTickets(): Promise<Ticket[]> {
    return request<Ticket[]>('/support/tickets');
  },

  async getTicket(id: string): Promise<Ticket | null> {
    try {
      return await request<Ticket>(`/support/tickets/${id}`);
    } catch {
      return null;
    }
  },

  async createTicket(ticketData: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'payroll' | 'benefits' | 'technical' | 'other';
  }): Promise<Ticket> {
    return request<Ticket>('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData)
    });
  },

  async addTicketMessage(ticketId: string, message: string): Promise<TicketMessage> {
    return request<TicketMessage>(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async updateTicketStatus(
    ticketId: string,
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
  ): Promise<Ticket> {
    return request<Ticket>(`/support/tickets/${ticketId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async getChatMessages(): Promise<ChatMessage[]> {
    return request<ChatMessage[]>('/support/chat');
  },

  async sendChatMessage(message: string): Promise<ChatMessage> {
    return request<ChatMessage>('/support/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  },

  async markMessagesAsRead(): Promise<void> {
    await request('/support/chat/mark-read', { method: 'POST' });
  }
};