/**
 * Página de solicitação e gestão de benefícios (Vale Transporte e Alimentação)
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  CreditCard,
  Coffee,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Bus,
  Utensils
} from 'lucide-react';

interface BenefitRequest {
  id: number;
  type: 'vale_transporte' | 'vale_alimentacao';
  month: string;
  status: 'pending' | 'approved' | 'rejected';
  amount: number;
  workDays: number;
  routes?: string[];
  requestDate: string;
  approvedDate?: string;
}

const BenefitsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transport' | 'food'>('transport');
  const [transportForm, setTransportForm] = useState({
    month: new Date().toISOString().split('T')[0].substr(0, 7),
    workDays: 22,
    routes: ['']
  });
  const [foodForm, setFoodForm] = useState({
    month: new Date().toISOString().split('T')[0].substr(0, 7),
    workDays: 22
  });
  const [requests, setRequests] = useState<BenefitRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Valores fixos (podem vir de API)
  const transportValue = 5.00; // Valor por viagem
  const foodValue = 25.00; // Valor por dia

  useEffect(() => {
    // Simular carregamento de solicitações
    const mockRequests: BenefitRequest[] = [
      {
        id: 1,
        type: 'vale_transporte',
        month: '2024-12',
        status: 'approved',
        amount: 440.00,
        workDays: 22,
        routes: ['Casa - Trabalho', 'Trabalho - Casa'],
        requestDate: '2024-11-25',
        approvedDate: '2024-11-26'
      },
      {
        id: 2,
        type: 'vale_alimentacao',
        month: '2024-12',
        status: 'pending',
        amount: 550.00,
        workDays: 22,
        requestDate: '2024-11-25'
      }
    ];
    setRequests(mockRequests);
  }, []);

  const calculateTransportValue = () => {
    const dailyTrips = transportForm.routes.filter(r => r.trim()).length;
    return transportForm.workDays * dailyTrips * transportValue;
  };

  const calculateFoodValue = () => {
    return foodForm.workDays * foodValue;
  };

  const handleTransportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Simular envio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newRequest: BenefitRequest = {
        id: Date.now(),
        type: 'vale_transporte',
        month: transportForm.month,
        status: 'pending',
        amount: calculateTransportValue(),
        workDays: transportForm.workDays,
        routes: transportForm.routes.filter(r => r.trim()),
        requestDate: new Date().toISOString().split('T')[0]
      };
      
      setRequests([newRequest, ...requests]);
      alert('Solicitação de Vale Transporte enviada com sucesso!');
    } catch (error) {
      alert('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleFoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Simular envio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newRequest: BenefitRequest = {
        id: Date.now(),
        type: 'vale_alimentacao',
        month: foodForm.month,
        status: 'pending',
        amount: calculateFoodValue(),
        workDays: foodForm.workDays,
        requestDate: new Date().toISOString().split('T')[0]
      };
      
      setRequests([newRequest, ...requests]);
      alert('Solicitação de Vale Alimentação enviada com sucesso!');
    } catch (error) {
      alert('Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const addRoute = () => {
    setTransportForm({
      ...transportForm,
      routes: [...transportForm.routes, '']
    });
  };

  const removeRoute = (index: number) => {
    setTransportForm({
      ...transportForm,
      routes: transportForm.routes.filter((_, i) => i !== index)
    });
  };

  const updateRoute = (index: number, value: string) => {
    const newRoutes = [...transportForm.routes];
    newRoutes[index] = value;
    setTransportForm({
      ...transportForm,
      routes: newRoutes
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      default: return 'Pendente';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benefícios</h1>
          <p className="text-gray-600 mt-1">
            Solicite vale transporte e vale alimentação
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={activeTab === 'transport' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('transport')}
            className="flex-1"
          >
            <Bus className="h-4 w-4 mr-2" />
            Vale Transporte
          </Button>
          <Button
            variant={activeTab === 'food' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('food')}
            className="flex-1"
          >
            <Utensils className="h-4 w-4 mr-2" />
            Vale Alimentação
          </Button>
        </div>

        {/* Vale Transporte */}
        {activeTab === 'transport' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bus className="h-5 w-5" />
                <span>Solicitação de Vale Transporte</span>
              </CardTitle>
              <CardDescription>
                Informe suas rotas de deslocamento para calcular o benefício
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTransportSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="transport-month">Mês de Referência</Label>
                    <Input
                      id="transport-month"
                      type="month"
                      value={transportForm.month}
                      onChange={(e) => setTransportForm({...transportForm, month: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="transport-days">Dias Úteis</Label>
                    <Input
                      id="transport-days"
                      type="number"
                      min="1"
                      max="31"
                      value={transportForm.workDays}
                      onChange={(e) => setTransportForm({...transportForm, workDays: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Rotas de Deslocamento</Label>
                  <div className="space-y-3 mt-2">
                    {transportForm.routes.map((route, index) => (
                      <div key={index} className="flex space-x-2">
                        <Input
                          placeholder={`Rota ${index + 1} (ex: Casa → Trabalho)`}
                          value={route}
                          onChange={(e) => updateRoute(index, e.target.value)}
                          className="flex-1"
                        />
                        {transportForm.routes.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeRoute(index)}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addRoute}>
                      Adicionar Rota
                    </Button>
                  </div>
                </div>

                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Valor calculado:</strong> R$ {calculateTransportValue().toFixed(2)}
                    <br />
                    ({transportForm.workDays} dias × {transportForm.routes.filter(r => r.trim()).length} viagens × R$ {transportValue.toFixed(2)})
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Enviando...' : 'Solicitar Vale Transporte'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Vale Alimentação */}
        {activeTab === 'food' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Utensils className="h-5 w-5" />
                <span>Solicitação de Vale Alimentação</span>
              </CardTitle>
              <CardDescription>
                Solicite seu vale alimentação baseado nos dias trabalhados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFoodSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="food-month">Mês de Referência</Label>
                    <Input
                      id="food-month"
                      type="month"
                      value={foodForm.month}
                      onChange={(e) => setFoodForm({...foodForm, month: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="food-days">Dias Úteis</Label>
                    <Input
                      id="food-days"
                      type="number"
                      min="1"
                      max="31"
                      value={foodForm.workDays}
                      onChange={(e) => setFoodForm({...foodForm, workDays: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <Alert>
                  <DollarSign className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Valor calculado:</strong> R$ {calculateFoodValue().toFixed(2)}
                    <br />
                    ({foodForm.workDays} dias × R$ {foodValue.toFixed(2)} por dia)
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Enviando...' : 'Solicitar Vale Alimentação'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Solicitações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Histórico de Solicitações</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {requests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma solicitação encontrada
                </p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-gray-100">
                        {request.type === 'vale_transporte' ? (
                          <Bus className="h-5 w-5" />
                        ) : (
                          <Utensils className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {request.type === 'vale_transporte' ? 'Vale Transporte' : 'Vale Alimentação'}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {new Date(request.month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-sm text-gray-600">
                          Solicitado em {new Date(request.requestDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                      <p className="text-lg font-semibold mt-1">
                        R$ {request.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default BenefitsPage;
