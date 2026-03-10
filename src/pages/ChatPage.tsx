/**
 * Página de chat em tempo real com administradores
 * Interface de mensagens instantâneas
 */
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { supportApi, ChatMessage } from '../services/supportApi';
import { 
  ArrowLeft,
  Send,
  User,
  Clock,
  CheckCheck,
  Loader2,
  MessageCircle
} from 'lucide-react';

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    markMessagesAsRead();
    
    // Simular atualizações em tempo real
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await supportApi.getChatMessages();
      setMessages(data);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supportApi.markMessagesAsRead();
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const sentMessage = await supportApi.sendChatMessage(newMessage);
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      
      // Recarregar mensagens após enviar para pegar possíveis respostas
      setTimeout(() => {
        loadMessages();
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    window.location.href = '#/support';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const dateKey = new Date(message.createdAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando chat...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <Card className="h-[calc(100vh-12rem)]">
          {/* Chat Header */}
          <CardHeader className="border-b bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Chat com Suporte RH</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-100 text-green-800">Online</Badge>
                      <span className="text-sm text-gray-500">Resposta em até 5 minutos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Messages Area */}
          <CardContent className="p-0 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Object.entries(messageGroups).map(([dateKey, dayMessages]) => (
                <div key={dateKey}>
                  {/* Date Separator */}
                  <div className="flex items-center my-4">
                    <div className="flex-1 border-t border-gray-200"></div>
                    <span className="px-3 text-xs text-gray-500 bg-white">
                      {formatDate(dayMessages[0].createdAt)}
                    </span>
                    <div className="flex-1 border-t border-gray-200"></div>
                  </div>

                  {/* Messages for this date */}
                  {dayMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'employee' ? 'justify-end' : 'justify-start'} mb-4`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${
                        message.sender === 'employee' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      } rounded-lg px-4 py-2`}>
                        <div className="flex items-center space-x-2 mb-1">
                          <User className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {message.senderName}
                          </span>
                        </div>
                        <p className="text-sm">{message.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs opacity-75">
                            {formatTime(message.createdAt)}
                          </span>
                          {message.sender === 'employee' && (
                            <CheckCheck className={`h-3 w-3 ${
                              message.isRead ? 'text-blue-200' : 'text-blue-300'
                            }`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Bem-vindo ao chat!
                  </h3>
                  <p className="text-gray-600">
                    Digite sua primeira mensagem para iniciar a conversa.
                  </p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="border-t p-4 bg-white">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={sending}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sending}
                  size="sm"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
              <p className="text-xs text-gray-500 mt-2">
                Pressione Enter para enviar. Nossa equipe normalmente responde em poucos minutos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ChatPage;
