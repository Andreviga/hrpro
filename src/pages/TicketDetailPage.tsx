/**
 * Página para visualizar detalhes de um ticket específico
 * Interface para acompanhar conversas e status do chamado
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import { supportApi, Ticket, TicketMessage } from '../services/supportApi';
import { 
  ArrowLeft,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  MessageCircle,
  Loader2,
  FileText
} from 'lucide-react';

const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadTicket(parseInt(id));
    }
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const loadTicket = async (ticketId: number) => {
    try {
      setLoading(true);
      const data = await supportApi.getTicket(ticketId);
      if (data) {
        setTicket(data);
      } else {
        setError('Ticket não encontrado');
      }
    } catch (err) {
      setError('Erro ao carregar ticket');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !ticket || sendingMessage) return;

    setSendingMessage(true);
    try {
      const message = await supportApi.addTicketMessage(ticket.id, newMessage);
      setTicket(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message]
      } : null);
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBack = () => {
    window.location.href = '#/support';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando ticket...</span>
        </div>
      </Layout>
    );
  }

  if (error || !ticket) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar</h3>
          <p className="text-gray-600 mb-4">{error || 'Ticket não encontrado'}</p>
          <Button onClick={handleBack}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Ticket #{ticket.id} - {ticket.title}
              </h1>
              <div className="flex items-center space-x-3 mt-1">
                <Badge className={getStatusColor(ticket.status)}>
                  {getStatusIcon(ticket.status)}
                  <span className="ml-1 capitalize">{ticket.status.replace('_', ' ')}</span>
                </Badge>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {ticket.priority.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-500">
                  Categoria: {ticket.category === 'payroll' ? 'Folha de Pagamento' :
                            ticket.category === 'benefits' ? 'Benefícios' :
                            ticket.category === 'technical' ? 'Problema Técnico' : 'Outros'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Criado em</span>
              </div>
              <p className="text-sm">{formatDateTime(ticket.createdAt)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Solicitante</span>
              </div>
              <p className="text-sm">{ticket.employeeName}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <MessageCircle className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Mensagens</span>
              </div>
              <p className="text-sm">{ticket.messages.length} mensagem(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Conversação</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto p-4 space-y-4">
              {ticket.messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'employee' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md ${
                    message.sender === 'employee' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  } rounded-lg px-4 py-3`}>
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {message.senderName}
                      </span>
                      <span className="text-xs opacity-75">
                        {formatDateTime(message.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {ticket.status !== 'closed' && (
              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    disabled={sendingMessage}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={!newMessage.trim() || sendingMessage}
                      size="sm"
                    >
                      {sendingMessage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Descrição Original</h4>
                <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                  {ticket.description}
                </p>
              </div>
              
              {ticket.assignedTo && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Atribuído a</h4>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{ticket.assignedTo}</span>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Última Atualização</h4>
                <p className="text-gray-700">{formatDateTime(ticket.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default TicketDetailPage;
