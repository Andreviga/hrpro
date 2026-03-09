/**
 * Serviços de API para sistema de suporte e chat
 * Contém funções para tickets, mensagens e comunicação
 */

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'payroll' | 'benefits' | 'technical' | 'other';
  employeeId: number;
  employeeName: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  message: string;
  sender: 'employee' | 'admin';
  senderName: string;
  timestamp: string;
  attachments?: string[];
}

export interface ChatMessage {
  id: number;
  message: string;
  sender: 'employee' | 'admin';
  senderName: string;
  timestamp: string;
  isRead: boolean;
}

// Mock data
const mockTickets: Ticket[] = [
  {
    id: 1,
    title: 'Dúvida sobre desconto do INSS',
    description: 'Gostaria de entender melhor como é calculado o desconto do INSS no meu holerite de novembro.',
    status: 'open',
    priority: 'medium',
    category: 'payroll',
    employeeId: 1,
    employeeName: 'João Silva',
    createdAt: '2024-11-20T10:30:00Z',
    updatedAt: '2024-11-20T10:30:00Z',
    messages: [
      {
        id: 1,
        ticketId: 1,
        message: 'Gostaria de entender melhor como é calculado o desconto do INSS no meu holerite de novembro.',
        sender: 'employee',
        senderName: 'João Silva',
        timestamp: '2024-11-20T10:30:00Z'
      }
    ]
  },
  {
    id: 2,
    title: 'Erro no sistema - não consigo acessar holerites',
    description: 'Estou com dificuldades para acessar meus holerites. A página não carrega.',
    status: 'in_progress',
    priority: 'high',
    category: 'technical',
    employeeId: 1,
    employeeName: 'João Silva',
    assignedTo: 'Admin TI',
    createdAt: '2024-11-19T14:15:00Z',
    updatedAt: '2024-11-20T09:00:00Z',
    messages: [
      {
        id: 2,
        ticketId: 2,
        message: 'Estou com dificuldades para acessar meus holerites. A página não carrega.',
        sender: 'employee',
        senderName: 'João Silva',
        timestamp: '2024-11-19T14:15:00Z'
      },
      {
        id: 3,
        ticketId: 2,
        message: 'Olá João! Estamos investigando o problema. Você pode tentar limpar o cache do navegador?',
        sender: 'admin',
        senderName: 'Admin TI',
        timestamp: '2024-11-20T09:00:00Z'
      }
    ]
  }
];

const mockChatMessages: ChatMessage[] = [
  {
    id: 1,
    message: 'Olá! Como posso ajudá-lo hoje?',
    sender: 'admin',
    senderName: 'Suporte RH',
    timestamp: '2024-11-20T10:00:00Z',
    isRead: true
  },
  {
    id: 2,
    message: 'Oi! Tenho uma dúvida sobre meu holerite.',
    sender: 'employee',
    senderName: 'João Silva',
    timestamp: '2024-11-20T10:01:00Z',
    isRead: true
  },
  {
    id: 3,
    message: 'Claro! Qual é sua dúvida específica?',
    sender: 'admin',
    senderName: 'Suporte RH',
    timestamp: '2024-11-20T10:02:00Z',
    isRead: false
  }
];

export const supportApi = {
  /**
   * Busca todos os tickets do usuário
   */
  async getTickets(): Promise<Ticket[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockTickets;
  },

  /**
   * Busca um ticket específico por ID
   */
  async getTicket(id: number): Promise<Ticket | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockTickets.find(ticket => ticket.id === id) || null;
  },

  /**
   * Cria um novo ticket
   */
  async createTicket(ticketData: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'payroll' | 'benefits' | 'technical' | 'other';
  }): Promise<Ticket> {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const newTicket: Ticket = {
      id: mockTickets.length + 1,
      ...ticketData,
      status: 'open',
      employeeId: 1,
      employeeName: 'João Silva',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: Date.now(),
          ticketId: mockTickets.length + 1,
          message: ticketData.description,
          sender: 'employee',
          senderName: 'João Silva',
          timestamp: new Date().toISOString()
        }
      ]
    };

    mockTickets.unshift(newTicket);
    return newTicket;
  },

  /**
   * Adiciona uma mensagem a um ticket
   */
  async addTicketMessage(ticketId: number, message: string): Promise<TicketMessage> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const ticket = mockTickets.find(t => t.id === ticketId);
    if (!ticket) throw new Error('Ticket não encontrado');

    const newMessage: TicketMessage = {
      id: Date.now(),
      ticketId,
      message,
      sender: 'employee',
      senderName: 'João Silva',
      timestamp: new Date().toISOString()
    };

    ticket.messages.push(newMessage);
    ticket.updatedAt = new Date().toISOString();

    return newMessage;
  },

  /**
   * Busca mensagens do chat
   */
  async getChatMessages(): Promise<ChatMessage[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockChatMessages;
  },

  /**
   * Envia uma mensagem no chat
   */
  async sendChatMessage(message: string): Promise<ChatMessage> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newMessage: ChatMessage = {
      id: mockChatMessages.length + 1,
      message,
      sender: 'employee',
      senderName: 'João Silva',
      timestamp: new Date().toISOString(),
      isRead: false
    };

    mockChatMessages.push(newMessage);

    // Simular resposta automática do admin após 2 segundos
    setTimeout(() => {
      const adminResponse: ChatMessage = {
        id: mockChatMessages.length + 1,
        message: 'Obrigado pela mensagem! Vou analisar sua solicitação e responder em breve.',
        sender: 'admin',
        senderName: 'Suporte RH',
        timestamp: new Date().toISOString(),
        isRead: false
      };
      mockChatMessages.push(adminResponse);
    }, 2000);

    return newMessage;
  },

  /**
   * Marca mensagens como lidas
   */
  async markMessagesAsRead(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    mockChatMessages.forEach(msg => msg.isRead = true);
  }
};
