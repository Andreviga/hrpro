/**
 * Página principal do dashboard
 * Exibe informações resumidas do funcionário e acesso rápido
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService, PaystubSummary } from '../services/api';
import { employeeApi } from '../services/employeeApi';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  FileText, 
  DollarSign, 
  Calendar, 
  TrendingUp,
  User,
  Building2
} from 'lucide-react';

const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const computeTenure = (date: string | null): string => {
  if (!date) return '–';
  const now = new Date();
  const admission = new Date(date);
  const diffMs = now.getTime() - admission.getTime();
  const years = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
  if (years >= 1) return `${years} ano${years > 1 ? 's' : ''}`;
  const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4));
  return `${months} mês${months !== 1 ? 'es' : ''}`;
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [paystubs, setPaystubs] = useState<PaystubSummary[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [admissionDate, setAdmissionDate] = useState<string | null>(null);

  const isAdministrativeProfile = ['admin', 'rh', 'manager'].includes(user?.role || '') && !user?.employeeId;

  useEffect(() => {
    if (isAdministrativeProfile || !user?.employeeId) {
      setStatsLoading(false);
      return;
    }
    Promise.all([
      apiService.getPaystubs(),
      employeeApi.getEmployee(user.employeeId)
    ])
      .then(([stubs, emp]) => {
        setPaystubs(stubs);
        setAdmissionDate(emp?.admissionDate ?? null);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [isAdministrativeProfile, user?.employeeId]);

  const mostRecent = paystubs.length > 0
    ? paystubs.reduce((a, b) => (a.year > b.year || (a.year === b.year && a.month > b.month)) ? a : b)
    : null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const quickStats = isAdministrativeProfile ? [
    {
      title: 'Perfil',
      value: 'Administrativo',
      description: 'Sem vínculo de Funcionário',
      icon: User,
      color: 'text-blue-600'
    },
    {
      title: 'Holerites pessoais',
      value: 'N/A',
      description: 'Não se aplica para este login',
      icon: FileText,
      color: 'text-slate-600'
    },
    {
      title: 'Modulo recomendado',
      value: 'competências',
      description: 'Use Fechamento por competência',
      icon: Calendar,
      color: 'text-emerald-600'
    },
    {
      title: 'Gestao',
      value: 'RH / Folha',
      description: 'Acesso aos paineis administrativos',
      icon: TrendingUp,
      color: 'text-orange-600'
    }
  ] : [
    {
      title: 'Último Salário Líquido',
      value: statsLoading ? '...' : (mostRecent ? formatCurrency(mostRecent.netSalary) : '–'),
      description: statsLoading ? 'Carregando...' : (mostRecent ? `${monthNames[mostRecent.month - 1]} ${mostRecent.year}` : 'Sem holerites'),
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: 'Holerites Disponíveis',
      value: statsLoading ? '...' : String(paystubs.length),
      description: statsLoading ? 'Carregando...' : (paystubs.length > 0 ? 'Total processados' : 'Nenhum processado'),
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Tempo na Empresa',
      value: statsLoading ? '...' : computeTenure(admissionDate),
      description: statsLoading ? 'Carregando...' : (admissionDate ? `Desde ${new Date(admissionDate).toLocaleDateString('pt-BR')}` : '–'),
      icon: Calendar,
      color: 'text-purple-600'
    },
    {
      title: 'Nível de Acesso',
      value: user?.role ?? '–',
      description: 'Perfil no sistema',
      icon: TrendingUp,
      color: 'text-orange-600'
    }
  ];

  const quickActions = [
    {
      title: 'Ver Holerites',
      description: 'Consulte seus holerites mensais',
      href: '#/paystubs',
      icon: FileText
    },
    {
      title: 'Solicitar Documentos',
      description: 'Solicite declarações e comprovantes',
      href: '#/documents',
      icon: User
    }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Bem-vindo de volta, {user?.fullName}!
          </p>
        </div>

        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Informações do Funcionário</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdministrativeProfile ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                Esta conta Não possui vínculo de Funcionário. Dados pessoais de holerite e performance individual Não são exibidos neste dashboard.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Matrícula</p>
                  <p className="font-semibold">{user?.employeeCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cargo</p>
                  <p className="font-semibold">{user?.position}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Departamento</p>
                  <p className="font-semibold flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    {user?.department}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nível de Acesso</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-gray-100 ${stat.color}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quickActions.map((action, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <action.icon className="h-5 w-5 text-blue-600" />
                    <span>{action.title}</span>
                  </CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <a href={action.href}>Acessar</a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isAdministrativeProfile ? (
              <p className="text-sm text-gray-600">
                Acompanhe eventos operacionais nos modulos de competências, Documentos e Monitor eSocial.
              </p>
            ) : statsLoading ? (
              <p className="text-sm text-gray-500">Carregando atividades...</p>
            ) : paystubs.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma atividade recente encontrada.</p>
            ) : (
              <div className="space-y-4">
                {[...paystubs]
                  .sort((a, b) => b.year - a.year || b.month - a.month)
                  .slice(0, 3)
                  .map((stub) => (
                    <div key={stub.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="bg-green-100 p-2 rounded-full">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Holerite de {monthNames[stub.month - 1]} {stub.year} disponível
                        </p>
                        <p className="text-xs text-gray-500">
                          Líquido: {formatCurrency(stub.netSalary)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DashboardPage;

