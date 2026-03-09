/**
 * Página principal do dashboard
 * Exibe informações resumidas do funcionário e acesso rápido
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
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

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const quickStats = [
    {
      title: 'Último Salário',
      value: 'R$ 4.399,50',
      description: 'Novembro 2024',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      title: 'Holerites',
      value: '12',
      description: 'Disponíveis em 2024',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Tempo na Empresa',
      value: '2 anos',
      description: 'Desde Jan 2022',
      icon: Calendar,
      color: 'text-purple-600'
    },
    {
      title: 'Performance',
      value: '95%',
      description: 'Avaliação atual',
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
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="bg-green-100 p-2 rounded-full">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Holerite de Novembro disponível</p>
                  <p className="text-xs text-gray-500">Há 2 dias</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                <div className="bg-blue-100 p-2 rounded-full">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Comprovante de rendimentos gerado</p>
                  <p className="text-xs text-gray-500">Há 1 semana</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DashboardPage;
