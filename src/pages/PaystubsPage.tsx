/**
 * Página para listagem de holerites do funcionário
 * Exibe lista de holerites com navegação para detalhes
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiService, PaystubSummary } from '../services/api';
import { API_BASE } from '../services/http';
import { 
  FileText, 
  Download, 
  Calendar,
  DollarSign,
  Loader2
} from 'lucide-react';

const PaystubsPage: React.FC = () => {
  const [paystubs, setPaystubs] = useState<PaystubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPaystubs();
  }, []);

  const loadPaystubs = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPaystubs();
      setPaystubs(data);
    } catch (err) {
      setError('Erro ao carregar holerites');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  const handleViewDetails = (id: string) => {
    window.location.href = `#/paystubs/${id}`;
  };

  const handleDownload = (filePath: string) => {
    window.open(`${API_BASE}${filePath}`, '_blank');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando holerites...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadPaystubs}>Tentar novamente</Button>
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
            <h1 className="text-3xl font-bold text-gray-900">Meus Holerites</h1>
            <p className="text-gray-600 mt-1">
              Consulte e baixe seus comprovantes de pagamento
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-sm">
              {paystubs.length} holerites disponíveis
            </Badge>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Último Holerite</h3>
                {paystubs.length > 0 && (
                  <div className="mt-2">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(paystubs[0].netSalary)}
                    </p>
                    <p className="text-blue-700">
                      {formatMonthYear(paystubs[0].month, paystubs[0].year)}
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-blue-100 p-4 rounded-full">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paystubs List */}
        <div className="grid gap-4">
          {paystubs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum holerite disponível
                </h3>
                <p className="text-gray-600">
                  Seus holerites aparecerão aqui quando estiverem disponíveis.
                </p>
              </CardContent>
            </Card>
          ) : (
            paystubs.map((paystub) => (
              <Card key={paystub.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-gray-100 p-3 rounded-full">
                        <FileText className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Holerite - {formatMonthYear(paystub.month, paystub.year)}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="flex items-center text-sm text-gray-600">
                            <Calendar className="h-4 w-4 mr-1" />
                            {paystub.month}/{paystub.year}
                          </span>
                          <span className="flex items-center text-sm font-medium text-green-600">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {formatCurrency(paystub.netSalary)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {paystub.filePath && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(paystub.filePath!)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleViewDetails(paystub.id)}
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Help Section */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Precisa de ajuda?</CardTitle>
            <CardDescription className="text-yellow-700">
              Se você não encontrou o holerite que procura ou tem dúvidas sobre os valores, 
              entre em contato com o RH.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-yellow-300 text-yellow-800 hover:bg-yellow-100">
              Contatar RH
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PaystubsPage;
