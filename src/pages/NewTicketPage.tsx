/**
 * Página para criação de novos tickets de suporte
 * Formulário detalhado para abertura de chamados
 */
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { supportApi } from '../services/supportApi';
import { 
  ArrowLeft,
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  MessageCircle,
  Settings,
  DollarSign
} from 'lucide-react';

const NewTicketPage: React.FC = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'other' as 'payroll' | 'benefits' | 'technical' | 'other'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const ticket = await supportApi.createTicket(formData);
      setSuccess(true);
      
      // Redirecionar para o ticket criado após 2 segundos
      setTimeout(() => {
        window.location.href = `#/support/tickets/${ticket.id}`;
      }, 2000);
    } catch (err) {
      setError('Erro ao criar ticket. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = '#/support';
  };

  const categoryIcons = {
    payroll: DollarSign,
    benefits: FileText,
    technical: Settings,
    other: MessageCircle
  };

  const CategoryIcon = categoryIcons[formData.category];

  if (success) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardContent className="p-12">
              <div className="bg-green-100 p-4 rounded-full w-16 h-16 mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Ticket Criado com Sucesso!
              </h2>
              <p className="text-gray-600 mb-6">
                Seu ticket foi criado e nossa equipe foi notificada. 
                Você receberá uma resposta em breve.
              </p>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Redirecionando para o ticket...
                </p>
                <div className="flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Novo Ticket</h1>
            <p className="text-gray-600 mt-1">
              Descreva sua solicitação ou problema detalhadamente
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Ticket</CardTitle>
            <CardDescription>
              Preencha os campos abaixo para criar seu chamado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Título do Ticket <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Ex: Dúvida sobre desconto do INSS"
                  disabled={loading}
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleInputChange('category', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payroll">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4" />
                          <span>Folha de Pagamento</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="benefits">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4" />
                          <span>Benefícios</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="technical">
                        <div className="flex items-center space-x-2">
                          <Settings className="h-4 w-4" />
                          <span>Problema Técnico</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="other">
                        <div className="flex items-center space-x-2">
                          <MessageCircle className="h-4 w-4" />
                          <span>Outros</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridade</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value) => handleInputChange('priority', value)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">
                        <span className="text-green-600">Baixa</span>
                      </SelectItem>
                      <SelectItem value="medium">
                        <span className="text-yellow-600">Média</span>
                      </SelectItem>
                      <SelectItem value="high">
                        <span className="text-orange-600">Alta</span>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <span className="text-red-600">Urgente</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Descrição Detalhada <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descreva detalhadamente sua solicitação ou problema. Inclua informações como datas, valores, ou passos que levaram ao problema..."
                  rows={6}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Quanto mais detalhes você fornecer, mais rápido poderemos ajudá-lo.
                </p>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <CategoryIcon className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Pré-visualização</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Título:</span>
                    <span className="text-sm text-gray-700">
                      {formData.title || 'Não informado'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Categoria:</span>
                    <span className="text-sm text-gray-700 capitalize">
                      {formData.category === 'payroll' ? 'Folha de Pagamento' :
                       formData.category === 'benefits' ? 'Benefícios' :
                       formData.category === 'technical' ? 'Problema Técnico' : 'Outros'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">Prioridade:</span>
                    <span className={`text-sm capitalize ${
                      formData.priority === 'low' ? 'text-green-600' :
                      formData.priority === 'medium' ? 'text-yellow-600' :
                      formData.priority === 'high' ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {formData.priority === 'low' ? 'Baixa' :
                       formData.priority === 'medium' ? 'Média' :
                       formData.priority === 'high' ? 'Alta' : 'Urgente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex space-x-3">
                <Button
                  type="submit"
                  disabled={loading || !formData.title.trim() || !formData.description.trim()}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando Ticket...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Criar Ticket
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleBack}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Dicas para um bom ticket</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700">
            <ul className="space-y-2 text-sm">
              <li>• Seja claro e específico no título</li>
              <li>• Descreva o problema com o máximo de detalhes possível</li>
              <li>• Inclua datas, valores ou códigos de erro quando relevante</li>
              <li>• Escolha a prioridade adequada (urgente apenas para casos críticos)</li>
              <li>• Se necessário, você pode adicionar mais informações depois</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default NewTicketPage;
