// @ts-nocheck
/**
 * Página de relatórios acadêmicos para professores
 * Exibe análises detalhadas de aulas e receitas
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { academicApi, MonthlyReport } from '../services/academicApi';
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp,
  Calendar,
  DollarSign,
  BookOpen,
  Download,
  Filter,
  Loader2
} from 'lucide-react';

const ReportsPage: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [selectedYear]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await academicApi.getYearlyReports(1, selectedYear);
      setReports(data);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
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

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                   'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[month - 1];
  };

  // Dados para gráficos
  const monthlyData = reports.map(report => ({
    month: getMonthName(report.month),
    aulas: report.totalHours,
    valor: report.totalValue,
    valorPorHora: report.totalHours > 0 ? report.totalValue / report.totalHours : 0
  }));

  // Dados para gráfico de pizza (matérias)
  const subjectData = reports.reduce((acc, report) => {
    report.classesBySubject.forEach(subject => {
      const existing = acc.find(item => item.name === subject.subjectName);
      if (existing) {
        existing.value += subject.value;
        existing.hours += subject.hours;
      } else {
        acc.push({
          name: subject.subjectName,
          value: subject.value,
          hours: subject.hours,
          color: subject.color
        });
      }
    });
    return acc;
  }, [] as Array<{name: string, value: number, hours: number, color: string}>);

  // Totais anuais
  const yearlyTotals = {
    totalHours: reports.reduce((sum, r) => sum + r.totalHours, 0),
    totalValue: reports.reduce((sum, r) => sum + r.totalValue, 0),
    averagePerHour: 0,
    totalSubjects: subjectData.length
  };
  yearlyTotals.averagePerHour = yearlyTotals.totalHours > 0 
    ? yearlyTotals.totalValue / yearlyTotals.totalHours 
    : 0;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando relatórios...</span>
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
            <h1 className="text-3xl font-bold text-gray-900">Relatórios Acadêmicos</h1>
            <p className="text-gray-600 mt-1">
              Análise detalhada de aulas e receitas
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Aulas</p>
                  <p className="text-2xl font-bold text-blue-600">{yearlyTotals.totalHours}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Receita Total</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(yearlyTotals.totalValue)}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Valor Médio/Hora</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(yearlyTotals.averagePerHour)}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Matérias Ativas</p>
                  <p className="text-2xl font-bold text-orange-600">{yearlyTotals.totalSubjects}</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Receita Mensal - {selectedYear}</CardTitle>
              <CardDescription>Evolução da receita ao longo do ano</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'valor' ? formatCurrency(Number(value)) : value,
                      name === 'valor' ? 'Receita' : name === 'aulas' ? 'Aulas' : 'Valor/Hora'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Classes Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Aulas por Mês - {selectedYear}</CardTitle>
              <CardDescription>Quantidade de aulas ministradas mensalmente</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="aulas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subject Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Matéria</CardTitle>
              <CardDescription>Receita por disciplina lecionada</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percent}) => `${name} (${(percent * 100).toFixed(1)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {subjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Subject Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas por Matéria</CardTitle>
              <CardDescription>Detalhamento de aulas e valores por disciplina</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subjectData.map((subject, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: subject.color }}
                      />
                      <div>
                        <p className="font-medium">{subject.name}</p>
                        <p className="text-sm text-gray-500">{subject.hours} aulas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCurrency(subject.value)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(subject.value / subject.hours)}/aula
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Detail Table */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo Mensal Detalhado</CardTitle>
            <CardDescription>Tabela completa com dados mensais de {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Mês</th>
                    <th className="text-right p-3">Aulas</th>
                    <th className="text-right p-3">Receita</th>
                    <th className="text-right p-3">Valor/Hora</th>
                    <th className="text-right p-3">Crescimento</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report, index) => {
                    const previousValue = index > 0 ? reports[index - 1].totalValue : 0;
                    const growth = previousValue > 0 
                      ? ((report.totalValue - previousValue) / previousValue * 100)
                      : 0;
                    
                    return (
                      <tr key={report.month} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">
                          {getMonthName(report.month)} {report.year}
                        </td>
                        <td className="p-3 text-right">{report.totalHours}</td>
                        <td className="p-3 text-right font-medium">
                          {formatCurrency(report.totalValue)}
                        </td>
                        <td className="p-3 text-right">
                          {report.totalHours > 0 
                            ? formatCurrency(report.totalValue / report.totalHours)
                            : 'R$ 0,00'
                          }
                        </td>
                        <td className="p-3 text-right">
                          {index > 0 && (
                            <span className={`${growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ReportsPage;
