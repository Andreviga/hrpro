/**
 * Página para exibir detalhes completos de um holerite específico
 * Organizada em seções de rendimentos, descontos e resumo
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { apiService, PaystubDetail } from '../services/api';
import { API_BASE } from '../services/http';
import { 
  ArrowLeft, 
  Download, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Calendar,
  Loader2,
  FileText
} from 'lucide-react';

const PaystubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [paystub, setPaystub] = useState<PaystubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadPaystubDetail(id);
    }
  }, [id]);

  const loadPaystubDetail = async (paystubId: string) => {
    try {
      setLoading(true);
      const data = await apiService.getPaystubDetail(paystubId);
      if (data) {
        setPaystub(data);
      } else {
        setError('Holerite não encontrado');
      }
    } catch (err) {
      setError('Erro ao carregar detalhes do holerite');
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

  const handleBack = () => {
    window.location.href = '#/paystubs';
  };

  const handleDownload = () => {
    if (!paystub) return;
    window.open(`${API_BASE}/paystubs/${paystub.id}/pdf`, '_blank');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando detalhes...</span>
        </div>
      </Layout>
    );
  }

  if (error || !paystub) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar</h3>
          <p className="text-gray-600 mb-4">{error || 'Holerite não encontrado'}</p>
          <Button onClick={handleBack}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  const earningsItems = [
    { label: 'Salário Base', value: paystub.earnings.baseSalary },
    { label: 'Horas Extras', value: paystub.earnings.overtimeValue },
    { label: 'Adicional Noturno', value: paystub.earnings.nightShiftBonus },
    { label: 'Adicional de Feriados', value: paystub.earnings.holidaysBonus },
    { label: 'Outros Bônus', value: paystub.earnings.otherBonuses },
  ].filter(item => item.value > 0);

  const deductionsItems = [
    { label: 'INSS', value: paystub.deductions.inssDeduction },
    { label: 'IRRF', value: paystub.deductions.irrfDeduction },
    { label: 'Vale Transporte', value: paystub.deductions.transportVoucherDeduction },
    { label: 'Vale Refeição', value: paystub.deductions.mealVoucherDeduction },
    { label: 'Taxa Sindical', value: paystub.deductions.syndicateFee },
    { label: 'Outros Descontos', value: paystub.deductions.otherDeductions },
  ].filter(item => item.value > 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Holerite - {formatMonthYear(paystub.month, paystub.year)}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Referência: {paystub.month}/{paystub.year}</span>
              </div>
            </div>
          </div>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Salário Bruto</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(paystub.summary.grossSalary)}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Total Descontos</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(paystub.summary.totalDeductions)}
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Salário Líquido</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(paystub.summary.netSalary)}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                <span>Rendimentos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {earningsItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-semibold text-green-600">
                    + {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center py-2 bg-green-50 px-3 rounded">
                <span className="font-semibold text-green-800">Total Bruto</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(paystub.summary.grossSalary)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Deductions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                <span>Descontos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deductionsItems.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-semibold text-red-600">
                    - {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center py-2 bg-red-50 px-3 rounded">
                <span className="font-semibold text-red-800">Total Descontos</span>
                <span className="font-bold text-red-600">
                  - {formatCurrency(paystub.summary.totalDeductions)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Final Summary and FGTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-800">Resumo Final</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Salário Bruto</span>
                <span className="font-semibold">
                  {formatCurrency(paystub.summary.grossSalary)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">(-) Total Descontos</span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(paystub.summary.totalDeductions)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2 bg-blue-100 px-3 rounded">
                <span className="font-bold text-blue-800">Salário Líquido</span>
                <span className="font-bold text-blue-600 text-xl">
                  {formatCurrency(paystub.summary.netSalary)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800">Informações Adicionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Depósito FGTS (8%)</span>
                <span className="font-semibold text-purple-600">
                  {formatCurrency(paystub.summary.fgtsDeposit)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Base de Cálculo FGTS</span>
                <span className="font-semibold">
                  {formatCurrency(paystub.summary.fgtsDeposit * 12.5)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                O valor do FGTS é depositado mensalmente em sua conta vinculada.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legal Notice */}
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-600 text-center">
              Este documento é o comprovante oficial de pagamento e deve ser guardado para fins de 
              comprovação de renda e controle pessoal. Em caso de dúvidas, entre em contato com o 
              departamento de Recursos Humanos.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PaystubDetailPage;
