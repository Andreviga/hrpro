/**
 * Página para listagem de holerites do Funcionário.
 * Exibe lista de holerites com navegação para detalhes.
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { apiService, PaystubSummary } from '../services/api';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  Loader2
} from 'lucide-react';

const getFriendlyError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return String(parsed.message);
    } catch {
      return error.message || fallback;
    }
  }
  return fallback;
};
const PaystubsPage: React.FC = () => {
  const [paystubs, setPaystubs] = useState<PaystubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdminWithoutEmployee = ['admin', 'rh', 'manager'].includes(user?.role ?? '') && !user?.employeeId;

  useEffect(() => {
    if (isAdminWithoutEmployee) {
      window.location.href = '#/admin/paystubs';
      return;
    }
    void loadPaystubs();
  }, [isAdminWithoutEmployee]);

  const loadPaystubs = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPaystubs();
      setPaystubs(data);
      setError('');
    } catch {
      setError('Erro ao carregar holerites.');
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
      'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  const handleViewDetails = (id: string) => {
    window.location.href = `#/paystubs/${id}`;
  };

  const handleDownload = async (paystubId: string) => {
    try {
      await apiService.openPaystubPdf(paystubId);
    } catch (downloadError: unknown) {
      const err = downloadError as { isValidationError?: boolean; missingFields?: string[]; message?: string };
      if (err.isValidationError && err.missingFields && err.missingFields.length > 0) {
        toast({
          title: 'Holerite com dados incompletos',
          description: `Campos ausentes: ${err.missingFields.join(', ')}. Complete a planilha e reimporte.`
        });
      } else {
        toast({
          title: 'Falha ao baixar PDF',
          description: getFriendlyError(downloadError, 'Não foi possível baixar o PDF do holerite. Faça login novamente e tente de novo.')
        });
      }
    }
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
          <Button onClick={() => void loadPaystubs()}>Tentar novamente</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {isAdminWithoutEmployee && (
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-900">Conta administrativa sem vínculo de funcionário</CardTitle>
              <CardDescription className="text-amber-800">
                Redirecionando para a visão administrativa com todos os holerites da empresa.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meus Holerites</h1>
            <p className="text-gray-600 mt-1">
              Consulte e baixe seus comprovantes de pagamento.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="text-sm">
              {paystubs.length} holerites disponiveis
            </Badge>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Ultimo Holerite</h3>
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

        <div className="grid gap-4">
          {paystubs.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum holerite disponivel
                </h3>
                <p className="text-gray-600">
                  Seus holerites aparecerao aqui quando estiverem disponiveis.
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
                        {paystub.employeeName && (
                          <p className="text-sm text-gray-600 mt-1">Funcionário: {paystub.employeeName}</p>
                        )}
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
                          onClick={() => void handleDownload(paystub.id)}
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

        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-yellow-800">Precisa de ajuda?</CardTitle>
            <CardDescription className="text-yellow-700">
              Se voce Não encontrou o holerite que procura ou tem dúvidas sobre os valores,
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

