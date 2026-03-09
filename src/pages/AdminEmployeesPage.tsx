/**
 * Página administrativa para gerenciamento completo de funcionários
 * Cadastro, aprovação, cálculo de folha e gerenciamento
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { employeeApi, Employee, PayrollCalculation } from '../services/employeeApi';
import { payrollApi } from '../services/payrollApi';
import { 
  Users,
  UserPlus,
  UserCheck,
  Calculator,
  FileText,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Building,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Loader2,
  Download,
  Upload
} from 'lucide-react';

const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingEmployees, setPendingEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showNewEmployeeForm, setShowNewEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    department: 'all',
    position: 'all'
  });

  // Estados para cálculo de folha
  const [payrollCalculations, setPayrollCalculations] = useState<PayrollCalculation[]>([]);
  const [calculatingPayroll, setCalculatingPayroll] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const getFriendlyError = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      try {
        const payload = JSON.parse(error.message);
        if (payload?.message) return payload.message as string;
      } catch {
        return error.message || fallback;
      }
    }
    return fallback;
  };

  // Estados para novo funcionário
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({
    status: 'pending_approval',
    contractType: 'CLT',
    department: 'centro_educacional',
    salaryType: 'hourly',
    benefits: {
      transportVoucher: { enabled: false, routes: [], workDays: 22 },
      mealVoucher: { enabled: false, workDays: 22 }
    },
    payrollData: {
      inssBase: 0,
      irrfBase: 0,
      dependents: 0,
      unionFee: false,
      transportDeduction: 0,
      mealDeduction: 0
    }
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesData, pendingData] = await Promise.all([
        employeeApi.getEmployees(filters),
        employeeApi.getPendingEmployees()
      ]);
      setEmployees(employeesData);
      setPendingEmployees(pendingData);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEmployee = async (id: string) => {
    try {
      await employeeApi.approveEmployee(id);
      loadData();
      alert('Funcionário aprovado com sucesso!');
    } catch (error) {
      alert('Erro ao aprovar funcionário');
    }
  };

  const handleRejectEmployee = async (id: string) => {
    try {
      await employeeApi.rejectEmployee(id, 'Não atende aos requisitos');
      loadData();
      alert('Funcionário rejeitado');
    } catch (error) {
      alert('Erro ao rejeitar funcionário');
    }
  };

  const handleCreateEmployee = async () => {
    try {
      if (!newEmployee.fullName || !newEmployee.cpf || !newEmployee.position) {
        alert('Preencha os campos obrigatórios');
        return;
      }

      await employeeApi.createEmployee(newEmployee as Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>);
      setNewEmployee({
        status: 'pending_approval',
        contractType: 'CLT',
        department: 'centro_educacional',
        salaryType: 'hourly',
        benefits: {
          transportVoucher: { enabled: false, routes: [], workDays: 22 },
          mealVoucher: { enabled: false, workDays: 22 }
        },
        payrollData: {
          inssBase: 0,
          irrfBase: 0,
          dependents: 0,
          unionFee: false,
          transportDeduction: 0,
          mealDeduction: 0
        }
      });
      setShowNewEmployeeForm(false);
      loadData();
      alert('Funcionário cadastrado com sucesso!');
    } catch (error) {
      alert('Erro ao cadastrar funcionário');
    }
  };

  const toInputDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const openEditEmployee = (employee: Employee) => {
    setSelectedEmployee(null);
    setEditingEmployee({
      ...employee,
      birthDate: toInputDate(employee.birthDate),
      admissionDate: toInputDate(employee.admissionDate),
      rgIssueDate: toInputDate(employee.rgIssueDate),
      esocialContractEndDate: toInputDate(employee.esocialContractEndDate),
      address: employee.address ?? {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: ''
      }
    });
  };

  const updateEditingEmployee = (field: keyof Employee, value: any) => {
    if (!editingEmployee) return;
    setEditingEmployee({ ...editingEmployee, [field]: value });
  };

  const updateEditingAddress = (field: keyof NonNullable<Employee['address']>, value: string) => {
    if (!editingEmployee) return;

    const currentAddress = editingEmployee.address ?? {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    };

    setEditingEmployee({
      ...editingEmployee,
      address: {
        ...currentAddress,
        [field]: value
      }
    });
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee?.id) return;

    if (!editingEmployee.fullName || !editingEmployee.cpf || !editingEmployee.position) {
      alert('Preencha nome, CPF e cargo para salvar.');
      return;
    }

    try {
      setSavingEmployee(true);
      await employeeApi.updateEmployee(editingEmployee.id, editingEmployee, 'Atualizacao cadastral');
      setEditingEmployee(null);
      await loadData();
      alert('Funcionário atualizado com sucesso!');
    } catch (error) {
      alert(getFriendlyError(error, 'Erro ao atualizar funcionário'));
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleCalculatePayroll = async () => {
    try {
      setCalculatingPayroll(true);
      const payrollRun = await payrollApi.createPayrollRun(selectedMonth, selectedYear);
      await payrollApi.calculatePayrollRun(payrollRun.id);
      const calculations: PayrollCalculation[] = [];
      
      for (const employee of employees.filter(emp => emp.status === 'active')) {
        const calc = await employeeApi.calculateSalary(employee.id, selectedMonth, selectedYear);
        calculations.push(calc);
      }
      
      setPayrollCalculations(calculations);
    } catch (error) {
      alert(getFriendlyError(error, 'Erro ao calcular folha de pagamento'));
    } finally {
      setCalculatingPayroll(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      dismissed: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts = {
      active: 'Ativo',
      inactive: 'Inativo',
      pending_approval: 'Pendente',
      dismissed: 'Demitido'
    };
    return texts[status as keyof typeof texts] || status;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando funcionários...</span>
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
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Funcionários</h1>
            <p className="text-gray-600 mt-1">
              Administração completa de funcionários e folha de pagamento
            </p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={() => setShowNewEmployeeForm(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Funcionário
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Funcionários Ativos</p>
                  <p className="text-xl font-bold">{employees.filter(emp => emp.status === 'active').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Pendentes Aprovação</p>
                  <p className="text-xl font-bold">{pendingEmployees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Centro Educacional</p>
                  <p className="text-xl font-bold">{employees.filter(emp => emp.department === 'centro_educacional').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Recreação Infantil</p>
                  <p className="text-xl font-bold">{employees.filter(emp => emp.department === 'recreacao_infantil').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="employees">Funcionários</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({pendingEmployees.length})</TabsTrigger>
            <TabsTrigger value="payroll">Folha de Pagamento</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          {/* Tab: Funcionários */}
          <TabsContent value="employees" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                        <SelectItem value="dismissed">Demitidos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Select value={filters.department} onValueChange={(value) => setFilters({...filters, department: value})}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="centro_educacional">Centro Educacional</SelectItem>
                      <SelectItem value="recreacao_infantil">Recreação Infantil</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.position} onValueChange={(value) => setFilters({...filters, position: value})}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Professor">Professores</SelectItem>
                      <SelectItem value="Auxiliar">Auxiliares</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Funcionários */}
            <div className="space-y-4">
              {employees.map((employee) => (
                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="font-semibold text-lg">{employee.fullName}</h3>
                          <Badge className={getStatusColor(employee.status)}>
                            {getStatusText(employee.status)}
                          </Badge>
                          <Badge variant="outline">{employee.employeeCode}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Cargo</p>
                            <p className="font-medium">{employee.position}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">CPF</p>
                            <p className="font-medium">{formatCPF(employee.cpf)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Admissão</p>
                            <p className="font-medium">
                              {employee.admissionDate
                                ? new Date(employee.admissionDate).toLocaleDateString('pt-BR')
                                : '--'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Departamento</p>
                            <p className="font-medium">
                              {employee.department === 'centro_educacional' ? 'Centro Educacional' : 'Recreação Infantil'}
                            </p>
                          </div>
                        </div>

                        {employee.salaryType === 'hourly' && employee.teachingData && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-2">Dados Pedagógicos:</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              <div>EI: {employee.teachingData.levels.infantil}h</div>
                              <div>EF I: {employee.teachingData.levels.fundamental1}h</div>
                              <div>EF II: {employee.teachingData.levels.fundamental2}h</div>
                              <div>EM: {employee.teachingData.levels.medio}h</div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(employee)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditEmployee(employee)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.location.href = '#/calendar'}>
                          <Calculator className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab: Funcionários Pendentes */}
          <TabsContent value="pending" className="space-y-4">
            {pendingEmployees.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum funcionário pendente
                  </h3>
                  <p className="text-gray-600">
                    Não há funcionários aguardando aprovação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingEmployees.map((employee) => (
                  <Card key={employee.id} className="border-l-4 border-yellow-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <h3 className="font-semibold text-lg">{employee.fullName}</h3>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente Aprovação
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500">Cargo Pretendido</p>
                              <p className="font-medium">{employee.position}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">CPF</p>
                              <p className="font-medium">{formatCPF(employee.cpf)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Data de Solicitação</p>
                              <p className="font-medium">
                                {employee.createdAt
                                  ? new Date(employee.createdAt).toLocaleDateString('pt-BR')
                                  : '--'}
                              </p>
                            </div>
                          </div>

                          <div className="text-sm text-gray-600">
                            <p><strong>Email:</strong> {employee.email}</p>
                            <p><strong>Telefone:</strong> {employee.phone}</p>
                            <p><strong>Endereço:</strong> {employee.address?.street}, {employee.address?.number} - {employee.address?.neighborhood}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedEmployee(employee)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleApproveEmployee(employee.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleRejectEmployee(employee.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Folha de Pagamento */}
          <TabsContent value="payroll" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Cálculo da Folha de Pagamento</span>
                </CardTitle>
                <CardDescription>
                  Calcule a folha de pagamento mensal para todos os funcionários
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <Label htmlFor="payroll-month">Mês</Label>
                    <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({length: 12}, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {new Date(0, i).toLocaleDateString('pt-BR', { month: 'long' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payroll-year">Ano</Label>
                    <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={handleCalculatePayroll}
                      disabled={calculatingPayroll}
                    >
                      {calculatingPayroll ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Calculator className="h-4 w-4 mr-2" />
                      )}
                      Calcular Folha
                    </Button>
                  </div>
                </div>

                {payrollCalculations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">
                        Folha de {new Date(0, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long' })} {selectedYear}
                      </h3>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Exportar PDF
                        </Button>
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-2" />
                          Enviar para Contabilidade
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Total Bruto</p>
                            <p className="text-xl font-bold text-green-600">
                              {formatCurrency(payrollCalculations.reduce((sum, calc) => sum + calc.calculation.grossEarnings, 0))}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Total Descontos</p>
                            <p className="text-xl font-bold text-red-600">
                              {formatCurrency(payrollCalculations.reduce((sum, calc) => sum + calc.calculation.totalDeductions, 0))}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Total Líquido</p>
                            <p className="text-xl font-bold text-blue-600">
                              {formatCurrency(payrollCalculations.reduce((sum, calc) => sum + calc.calculation.netSalary, 0))}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600">Total FGTS</p>
                            <p className="text-xl font-bold text-purple-600">
                              {formatCurrency(payrollCalculations.reduce((sum, calc) => sum + calc.calculation.fgts, 0))}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-2">
                      {payrollCalculations.map((calc) => (
                        <Card key={calc.employee.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{calc.employee.fullName}</h4>
                                <p className="text-sm text-gray-600">{calc.employee.position}</p>
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm text-right">
                                <div>
                                  <p className="text-gray-500">Bruto</p>
                                  <p className="font-medium text-green-600">
                                    {formatCurrency(calc.calculation.grossEarnings)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Descontos</p>
                                  <p className="font-medium text-red-600">
                                    {formatCurrency(calc.calculation.totalDeductions)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Líquido</p>
                                  <p className="font-medium text-blue-600">
                                    {formatCurrency(calc.calculation.netSalary)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">FGTS</p>
                                  <p className="font-medium text-purple-600">
                                    {formatCurrency(calc.calculation.fgts)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Relatórios */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Relatórios em Desenvolvimento
                </h3>
                <p className="text-gray-600">
                  Em breve você terá acesso a relatórios detalhados de funcionários.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal para Novo Funcionário */}
        {showNewEmployeeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Cadastrar Novo Funcionário</CardTitle>
                <CardDescription>
                  Preencha todos os dados necessários para o cadastro
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="font-semibold mb-3">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Nome Completo *</Label>
                      <Input
                        id="fullName"
                        value={newEmployee.fullName || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, fullName: e.target.value})}
                        placeholder="Nome completo do funcionário"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={newEmployee.cpf || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, cpf: e.target.value})}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rg">RG</Label>
                      <Input
                        id="rg"
                        value={newEmployee.rg || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, rg: e.target.value})}
                        placeholder="00.000.000-0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birthDate">Data de Nascimento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={newEmployee.birthDate || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, birthDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                {/* Dados de Contato */}
                <div>
                  <h3 className="font-semibold mb-3">Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newEmployee.email || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                        placeholder="funcionario@email.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={newEmployee.phone || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                  </div>
                </div>

                {/* Dados Trabalhistas */}
                <div>
                  <h3 className="font-semibold mb-3">Dados Trabalhistas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="position">Cargo *</Label>
                      <Input
                        id="position"
                        value={newEmployee.position || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                        placeholder="Ex: Professor de Matemática"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Departamento</Label>
                      <Select value={newEmployee.department} onValueChange={(value) => setNewEmployee({...newEmployee, department: value as any})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="centro_educacional">Centro Educacional</SelectItem>
                          <SelectItem value="recreacao_infantil">Recreação Infantil</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="admissionDate">Data de Admissão</Label>
                      <Input
                        id="admissionDate"
                        type="date"
                        value={newEmployee.admissionDate || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, admissionDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="salaryType">Tipo de Salário</Label>
                      <Select value={newEmployee.salaryType} onValueChange={(value) => setNewEmployee({...newEmployee, salaryType: value as any})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Por Hora (Professor)</SelectItem>
                          <SelectItem value="monthly">Mensal (Auxiliar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {newEmployee.salaryType === 'hourly' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label htmlFor="hourlyRate">Valor da Hora</Label>
                        <Input
                          id="hourlyRate"
                          type="number"
                          step="0.01"
                          value={newEmployee.hourlyRate || ''}
                          onChange={(e) => setNewEmployee({...newEmployee, hourlyRate: parseFloat(e.target.value)})}
                          placeholder="31.44"
                        />
                      </div>
                      <div>
                        <Label htmlFor="weeklyHours">Horas Semanais</Label>
                        <Input
                          id="weeklyHours"
                          type="number"
                          value={newEmployee.weeklyHours || ''}
                          onChange={(e) => setNewEmployee({...newEmployee, weeklyHours: parseInt(e.target.value)})}
                          placeholder="25"
                        />
                      </div>
                    </div>
                  )}

                  {newEmployee.salaryType === 'monthly' && (
                    <div className="mt-4">
                      <Label htmlFor="baseSalary">Salário Base</Label>
                      <Input
                        id="baseSalary"
                        type="number"
                        step="0.01"
                        value={newEmployee.baseSalary || ''}
                        onChange={(e) => setNewEmployee({...newEmployee, baseSalary: parseFloat(e.target.value)})}
                        placeholder="1954.58"
                      />
                    </div>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button onClick={handleCreateEmployee} className="flex-1">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar Funcionário
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewEmployeeForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de Edicao de Funcionario */}
        {editingEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Editar funcionario</CardTitle>
                <CardDescription>Atualize os dados cadastrais e campos eSocial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Dados principais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome completo *</Label>
                      <Input
                        value={editingEmployee.fullName || ''}
                        onChange={(e) => updateEditingEmployee('fullName', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CPF *</Label>
                      <Input
                        value={editingEmployee.cpf || ''}
                        onChange={(e) => updateEditingEmployee('cpf', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Matricula</Label>
                      <Input
                        value={editingEmployee.employeeCode || ''}
                        onChange={(e) => updateEditingEmployee('employeeCode', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>RG</Label>
                      <Input
                        value={editingEmployee.rg || ''}
                        onChange={(e) => updateEditingEmployee('rg', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Orgao emissor RG</Label>
                      <Input
                        value={editingEmployee.rgIssuer || ''}
                        onChange={(e) => updateEditingEmployee('rgIssuer', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>UF RG</Label>
                      <Input
                        value={editingEmployee.rgIssuerState || ''}
                        onChange={(e) => updateEditingEmployee('rgIssuerState', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data emissao RG</Label>
                      <Input
                        type="date"
                        value={editingEmployee.rgIssueDate || ''}
                        onChange={(e) => updateEditingEmployee('rgIssueDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data nascimento</Label>
                      <Input
                        type="date"
                        value={editingEmployee.birthDate || ''}
                        onChange={(e) => updateEditingEmployee('birthDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Nome social</Label>
                      <Input
                        value={editingEmployee.socialName || ''}
                        onChange={(e) => updateEditingEmployee('socialName', e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label>Nome da mae</Label>
                      <Input
                        value={editingEmployee.motherName || ''}
                        onChange={(e) => updateEditingEmployee('motherName', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Contato e endereco</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editingEmployee.email || ''}
                        onChange={(e) => updateEditingEmployee('email', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={editingEmployee.phone || ''}
                        onChange={(e) => updateEditingEmployee('phone', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input
                        value={editingEmployee.address?.zipCode || ''}
                        onChange={(e) => updateEditingAddress('zipCode', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Logradouro</Label>
                      <Input
                        value={editingEmployee.address?.street || ''}
                        onChange={(e) => updateEditingAddress('street', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Numero</Label>
                      <Input
                        value={editingEmployee.address?.number || ''}
                        onChange={(e) => updateEditingAddress('number', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Complemento</Label>
                      <Input
                        value={editingEmployee.address?.complement || ''}
                        onChange={(e) => updateEditingAddress('complement', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input
                        value={editingEmployee.address?.neighborhood || ''}
                        onChange={(e) => updateEditingAddress('neighborhood', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input
                        value={editingEmployee.address?.city || ''}
                        onChange={(e) => updateEditingAddress('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>UF</Label>
                      <Input
                        value={editingEmployee.address?.state || ''}
                        onChange={(e) => updateEditingAddress('state', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cod municipio IBGE</Label>
                      <Input
                        value={editingEmployee.cityCode || ''}
                        onChange={(e) => updateEditingEmployee('cityCode', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Dados trabalhistas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Cargo *</Label>
                      <Input
                        value={editingEmployee.position || ''}
                        onChange={(e) => updateEditingEmployee('position', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Departamento</Label>
                      <Input
                        value={editingEmployee.department || ''}
                        onChange={(e) => updateEditingEmployee('department', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Data admissao</Label>
                      <Input
                        type="date"
                        value={editingEmployee.admissionDate || ''}
                        onChange={(e) => updateEditingEmployee('admissionDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Tipo salario</Label>
                      <Select
                        value={editingEmployee.salaryType || 'monthly'}
                        onValueChange={(value) => updateEditingEmployee('salaryType', value as Employee['salaryType'])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="hourly">Hora</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Salario base</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingEmployee.baseSalary ?? ''}
                        onChange={(e) => updateEditingEmployee('baseSalary', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div>
                      <Label>Valor hora</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingEmployee.hourlyRate ?? ''}
                        onChange={(e) => updateEditingEmployee('hourlyRate', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div>
                      <Label>Horas semanais</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingEmployee.weeklyHours ?? ''}
                        onChange={(e) => updateEditingEmployee('weeklyHours', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div>
                      <Label>PIS/NIS</Label>
                      <Input
                        value={editingEmployee.pis || ''}
                        onChange={(e) => updateEditingEmployee('pis', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CTPS</Label>
                      <Input
                        value={editingEmployee.ctps || ''}
                        onChange={(e) => updateEditingEmployee('ctps', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CTPS numero</Label>
                      <Input
                        value={editingEmployee.ctpsNumber || ''}
                        onChange={(e) => updateEditingEmployee('ctpsNumber', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CTPS serie</Label>
                      <Input
                        value={editingEmployee.ctpsSeries || ''}
                        onChange={(e) => updateEditingEmployee('ctpsSeries', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CTPS UF</Label>
                      <Input
                        value={editingEmployee.ctpsState || ''}
                        onChange={(e) => updateEditingEmployee('ctpsState', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Campos minimos eSocial</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Sexo</Label>
                      <Input
                        value={editingEmployee.gender || ''}
                        onChange={(e) => updateEditingEmployee('gender', e.target.value)}
                        placeholder="M, F ou N"
                      />
                    </div>
                    <div>
                      <Label>Raca/cor</Label>
                      <Input
                        value={editingEmployee.raceColor || ''}
                        onChange={(e) => updateEditingEmployee('raceColor', e.target.value)}
                        placeholder="1..6"
                      />
                    </div>
                    <div>
                      <Label>Estado civil</Label>
                      <Input
                        value={editingEmployee.maritalStatus || ''}
                        onChange={(e) => updateEditingEmployee('maritalStatus', e.target.value)}
                        placeholder="1..5"
                      />
                    </div>
                    <div>
                      <Label>Grau instrucao</Label>
                      <Input
                        value={editingEmployee.educationLevel || ''}
                        onChange={(e) => updateEditingEmployee('educationLevel', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Pais nacionalidade</Label>
                      <Input
                        value={editingEmployee.nationalityCode || ''}
                        onChange={(e) => updateEditingEmployee('nationalityCode', e.target.value)}
                        placeholder="105"
                      />
                    </div>
                    <div>
                      <Label>Pais nascimento</Label>
                      <Input
                        value={editingEmployee.birthCountryCode || ''}
                        onChange={(e) => updateEditingEmployee('birthCountryCode', e.target.value)}
                        placeholder="105"
                      />
                    </div>
                    <div>
                      <Label>UF nascimento</Label>
                      <Input
                        value={editingEmployee.birthState || ''}
                        onChange={(e) => updateEditingEmployee('birthState', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cod municipio nascimento</Label>
                      <Input
                        value={editingEmployee.birthCityCode || ''}
                        onChange={(e) => updateEditingEmployee('birthCityCode', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Cod categoria eSocial</Label>
                      <Input
                        value={editingEmployee.esocialCategoryCode || ''}
                        onChange={(e) => updateEditingEmployee('esocialCategoryCode', e.target.value)}
                        placeholder="101"
                      />
                    </div>
                    <div>
                      <Label>Tipo regime trab</Label>
                      <Input
                        value={editingEmployee.esocialRegistrationType || ''}
                        onChange={(e) => updateEditingEmployee('esocialRegistrationType', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label>Tipo regime prev</Label>
                      <Input
                        value={editingEmployee.esocialRegimeType || ''}
                        onChange={(e) => updateEditingEmployee('esocialRegimeType', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label>Tipo admissao</Label>
                      <Input
                        value={editingEmployee.esocialAdmissionType || ''}
                        onChange={(e) => updateEditingEmployee('esocialAdmissionType', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Indicativo admissao</Label>
                      <Input
                        value={editingEmployee.esocialAdmissionIndicator || ''}
                        onChange={(e) => updateEditingEmployee('esocialAdmissionIndicator', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Natureza atividade</Label>
                      <Input
                        value={editingEmployee.esocialActivityNature || ''}
                        onChange={(e) => updateEditingEmployee('esocialActivityNature', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>CNPJ sindicato</Label>
                      <Input
                        value={editingEmployee.esocialUnionCnpj || ''}
                        onChange={(e) => updateEditingEmployee('esocialUnionCnpj', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Unidade salario fixo</Label>
                      <Input
                        value={editingEmployee.esocialSalaryUnit || ''}
                        onChange={(e) => updateEditingEmployee('esocialSalaryUnit', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Tipo contrato</Label>
                      <Input
                        value={editingEmployee.esocialContractType || ''}
                        onChange={(e) => updateEditingEmployee('esocialContractType', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Fim contrato</Label>
                      <Input
                        type="date"
                        value={editingEmployee.esocialContractEndDate || ''}
                        onChange={(e) => updateEditingEmployee('esocialContractEndDate', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Horas semanais eSocial</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingEmployee.esocialWeeklyHours ?? ''}
                        onChange={(e) => updateEditingEmployee('esocialWeeklyHours', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Descricao jornada</Label>
                      <Input
                        value={editingEmployee.esocialWorkSchedule || ''}
                        onChange={(e) => updateEditingEmployee('esocialWorkSchedule', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Checkbox
                        checked={editingEmployee.esocialHasDisability === true}
                        onCheckedChange={(checked) => updateEditingEmployee('esocialHasDisability', checked === true)}
                      />
                      <Label>Possui deficiencia</Label>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Tipo deficiencia</Label>
                      <Input
                        value={editingEmployee.esocialDisabilityType || ''}
                        onChange={(e) => updateEditingEmployee('esocialDisabilityType', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button onClick={handleUpdateEmployee} disabled={savingEmployee} className="flex-1">
                    {savingEmployee ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit className="h-4 w-4 mr-2" />}
                    Salvar alteracoes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingEmployee(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de Detalhes do Funcionário */}
        {selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{selectedEmployee.fullName}</span>
                  <Badge className={getStatusColor(selectedEmployee.status)}>
                    {getStatusText(selectedEmployee.status)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dados Pessoais */}
                <div>
                  <h3 className="font-semibold mb-3">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">CPF</p>
                      <p className="font-medium">{formatCPF(selectedEmployee.cpf)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">RG</p>
                      <p className="font-medium">{selectedEmployee.rg}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Data de Nascimento</p>
                      <p className="font-medium">
                        {selectedEmployee.birthDate ? new Date(selectedEmployee.birthDate).toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Nome da Mãe</p>
                      <p className="font-medium">{selectedEmployee.motherName || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Contato */}
                <div>
                  <h3 className="font-semibold mb-3">Contato</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{selectedEmployee.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{selectedEmployee.phone}</span>
                    </div>
                  </div>
                  {selectedEmployee.address && (
                    <div className="flex items-center space-x-2 text-sm mt-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span>
                        {selectedEmployee.address.street}, {selectedEmployee.address.number} - {selectedEmployee.address.neighborhood}, {selectedEmployee.address.city}/{selectedEmployee.address.state}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dados Trabalhistas */}
                <div>
                  <h3 className="font-semibold mb-3">Dados Trabalhistas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Cargo</p>
                      <p className="font-medium">{selectedEmployee.position}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Matrícula</p>
                      <p className="font-medium">{selectedEmployee.employeeCode}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Admissão</p>
                      <p className="font-medium">
                        {selectedEmployee.admissionDate
                          ? new Date(selectedEmployee.admissionDate).toLocaleDateString('pt-BR')
                          : '--'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dados Bancários */}
                {selectedEmployee.bankData && (
                  <div>
                    <h3 className="font-semibold mb-3">Dados Bancários</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Banco</p>
                        <p className="font-medium">{selectedEmployee.bankData.bank}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Agência</p>
                        <p className="font-medium">{selectedEmployee.bankData.agency}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Conta</p>
                        <p className="font-medium">{selectedEmployee.bankData.account}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  {selectedEmployee.status === 'pending_approval' && (
                    <>
                      <Button onClick={() => handleApproveEmployee(selectedEmployee.id)}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                      <Button variant="destructive" onClick={() => handleRejectEmployee(selectedEmployee.id)}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => openEditEmployee(selectedEmployee)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedEmployee(null)}>
                    Fechar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminEmployeesPage;


