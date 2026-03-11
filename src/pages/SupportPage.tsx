/**
 * Página principal de suporte com tickets e chat
 * Interface para comunicação com administradores
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { supportApi, Ticket } from '../services/supportApi';
import { 
  MessageCircle, 
  Ticket as TicketIcon, 
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  User,
  Search,
  Filter
} from 'lucide-react';

const SupportPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Ticket['status']>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Ticket['priority']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Ticket['category']>('all');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await supportApi.getTickets();
      setTickets(data);
    } catch (err) {
      setError('Erro ao carregar tickets');
    } finally {
      setLoading(false);
    }
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

  const getStatusLabel = (status: Ticket['status']) => {
    const labels: Record<Ticket['status'], string> = {
      open: 'Aberto',
      in_progress: 'Em andamento',
      resolved: 'Resolvido',
      closed: 'Fechado',
    };
    return labels[status];
  };

  const getCategoryLabel = (category: Ticket['category']) => {
    const labels: Record<Ticket['category'], string> = {
      payroll: 'Folha',
      benefits: 'Benefícios',
      technical: 'Técnico',
      other: 'Outros',
    };
    return labels[category];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleTicketClick = (ticketId: string) => {
    window.location.href = `#/support/tickets/${ticketId}`;
  };

  const handleNewTicket = () => {
    window.location.href = '#/support/new-ticket';
  };

  const handleStartChat = () => {
    window.location.href = '#/support/chat';
  };

  const filteredTickets = tickets.filter((ticket) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      ticket.title.toLowerCase().includes(normalizedSearch) ||
      ticket.description.toLowerCase().includes(normalizedSearch) ||
      ticket.id.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const resolvedTickets = tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed');
  const avgResolutionHours = resolvedTickets.length
    ? resolvedTickets.reduce((sum, ticket) => {
        const opened = new Date(ticket.createdAt).getTime();
        const closed = new Date(ticket.updatedAt).getTime();
        const diffHours = Math.max(0, (closed - opened) / (1000 * 60 * 60));
        return sum + diffHours;
      }, 0) / resolvedTickets.length
    : null;

  const now = new Date();
  const currentHour = now.getHours();
  const isBusinessDay = now.getDay() >= 1 && now.getDay() <= 5;
  const isChatOnline = isBusinessDay && currentHour >= 8 && currentHour < 18;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando suporte...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Central de Suporte</h1>
            <p className="text-gray-600 mt-1">
              Entre em contato conosco através de tickets ou chat ao vivo
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleStartChat}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <MessageCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Chat ao Vivo</h3>
                  <p className="text-gray-600">Converse diretamente com nossa equipe</p>
                  <Badge className={`mt-2 ${isChatOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {isChatOnline ? 'Online agora' : 'Fora do horário'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={handleNewTicket}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 p-4 rounded-full">
                  <TicketIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Abrir Ticket</h3>
                  <p className="text-gray-600">Crie um chamado para questões específicas</p>
                  <Button size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />
                    Novo Ticket
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Support Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 p-2 rounded">
                  <TicketIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Tickets</p>
                  <p className="text-lg font-semibold">{tickets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="bg-yellow-100 p-2 rounded">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Em Andamento</p>
                  <p className="text-lg font-semibold">
                    {tickets.filter(t => t.status === 'in_progress' || t.status === 'open').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="bg-green-100 p-2 rounded">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Resolvidos</p>
                  <p className="text-lg font-semibold">
                    {resolvedTickets.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="bg-orange-100 p-2 rounded">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tempo Médio</p>
                  <p className="text-lg font-semibold">
                    {avgResolutionHours !== null ? `${avgResolutionHours.toFixed(1)}h` : '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meus Tickets</CardTitle>
                <CardDescription>
                  Acompanhe o status dos seus chamados ({filteredTickets.length} de {tickets.length})
                </CardDescription>
              </div>
              <Button onClick={handleNewTicket}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Ticket
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                  placeholder="Buscar por título, ID ou descrição"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | Ticket['status'])}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2 text-gray-500" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as 'all' | Ticket['priority'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Prioridades</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as 'all' | Ticket['category'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Categorias</SelectItem>
                    <SelectItem value="payroll">Folha</SelectItem>
                    <SelectItem value="benefits">Benefícios</SelectItem>
                    <SelectItem value="technical">Técnico</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-8">
                <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum ticket encontrado
                </h3>
                <p className="text-gray-600 mb-4">
                  Você ainda não criou nenhum ticket de suporte.
                </p>
                <Button onClick={handleNewTicket}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Ticket
                </Button>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8">
                <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum ticket encontrado com esses filtros
                </h3>
                <p className="text-gray-600 mb-4">
                  Limpe os filtros para visualizar todos os chamados.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setPriorityFilter('all');
                    setCategoryFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">#{ticket.id} - {ticket.title}</h3>
                          <Badge className={getStatusColor(ticket.status)}>
                            {getStatusIcon(ticket.status)}
                            <span className="ml-1">{getStatusLabel(ticket.status)}</span>
                          </Badge>
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {ticket.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(ticket.createdAt)}
                          </span>
                          <span className="flex items-center">
                            <MessageCircle className="h-3 w-3 mr-1" />
                            {ticket.messages.length} mensagem(s)
                          </span>
                          {ticket.assignedTo && (
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {ticket.assignedTo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Precisa de ajuda imediata?</CardTitle>
            <CardDescription className="text-blue-700">
              Nossa equipe está disponível para ajudá-lo das 8h às 18h, de segunda a sexta-feira.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-3">
              <Button onClick={handleStartChat} className="bg-blue-600 hover:bg-blue-700">
                <MessageCircle className="h-4 w-4 mr-2" />
                Iniciar Chat
              </Button>
              <Button variant="outline" className="border-blue-300 text-blue-800 hover:bg-blue-100">
                Ver FAQ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SupportPage;
