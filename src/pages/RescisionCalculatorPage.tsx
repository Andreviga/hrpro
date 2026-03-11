/**
 * Página da Calculadora de Rescisão Trabalhista
 * Calcula todas as verbas rescisórias conforme CCT Sinprosp 2024/2025
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { rescisionApi, Employee, RescisionCalculation } from '../services/rescisionApi';
import RescisionDocument from '../components/RescisionDocument';
import { 
  Calculator,
  Search,
  FileText,
  Download,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2,
  User,
  Building,
  CreditCard
} from 'lucide-react';

const RescisionCalculatorPage: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [calculation, setCalculation] = useState<RescisionCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [calcError, setCalcError] = useState('');

  // Estados do formulário
  const [rescisionType, setRescisionType] = useState('');
  const [rescisionDate, setRescisionDate] = useState('');
  const [priorNoticeType, setPriorNoticeType] = useState('indenizado');
  const [hasVacationDue, setHasVacationDue] = useState(false);

  const handleSearchEmployee = async () => {
    setSearchError('');
    if (!cpf.trim()) {
      setSearchError('Digite um CPF para buscar');
      return;
    }

    try {
      setSearching(true);
      const foundEmployee = await rescisionApi.searchEmployeeByCPF(cpf);
      if (foundEmployee) {
        setEmployee(foundEmployee);
        setRescisionDate(new Date().toISOString().split('T')[0]);
      } else {
        setSearchError('Funcionário não encontrado');
        setEmployee(null);
      }
    } catch (error) {
      setSearchError('Erro ao buscar funcionário. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  const handleCalculate = async () => {
    setCalcError('');
    if (!employee || !rescisionType || !rescisionDate) {
      setCalcError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setLoading(true);
      const result = await rescisionApi.calculateRescision({
        employee,
        rescisionType,
        rescisionDate,
        priorNoticeType,
        hasVacationDue
      });
      setCalculation(result);
    } catch (error) {
      setCalcError('Erro ao calcular rescisão. Verifique os dados e tente novamente.');
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

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const getRescisionTypeName = (type: string) => {
    const types = {
      'demissao_sem_justa_causa': 'Demissão sem Justa Causa',
      'pedido_demissao': 'Pedido de Demissão',
      'justa_causa': 'Demissão por Justa Causa',
      'acordo_comum': 'Rescisão por Acordo',
      'rescisao_indireta': 'Rescisão Indireta'
    };
    return types[type as keyof typeof types] || type;
  };

  const getRescisionTypeColor = (type: string) => {
    const colors = {
      'demissao_sem_justa_causa': 'bg-red-100 text-red-800',
      'pedido_demissao': 'bg-yellow-100 text-yellow-800',
      'justa_causa': 'bg-gray-100 text-gray-800',
      'acordo_comum': 'bg-blue-100 text-blue-800',
      'rescisao_indireta': 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const exportCalculationSummary = () => {
    if (!calculation) return;

    const lines = [
      'RESUMO DE RESCISAO',
      '==================',
      `Funcionario: ${calculation.employee.name}`,
      `CPF: ${formatCPF(calculation.employee.cpf)}`,
      `Tipo: ${getRescisionTypeName(calculation.rescisionType)}`,
      `Data da rescisao: ${new Date(calculation.rescisionDate).toLocaleDateString('pt-BR')}`,
      '',
      'VALORES',
      `Total bruto: ${formatCurrency(calculation.calculation.totalGross)}`,
      `Deducoes: ${formatCurrency(calculation.calculation.totalDeductions)}`,
      `Liquido: ${formatCurrency(calculation.calculation.netValue)}`,
      `FGTS deposito: ${formatCurrency(calculation.calculation.fgtsDeposit)}`,
      `FGTS multa: ${formatCurrency(calculation.calculation.fgtsFine)}`,
      '',
      'ITENS',
      ...calculation.calculation.items.map(
        (item) => `${item.type === 'deduction' ? '-' : '+'} ${item.code} ${item.description}: ${formatCurrency(item.value)}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rescisao_${calculation.employee.name.replace(/\s+/g, '_').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">⚖️ Calculadora de Rescisão</h1>
            <p className="text-gray-600 mt-1">
              Cálculo completo de verbas rescisórias conforme CCT Sinprosp 2024/2025
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário */}
          <div className="lg:col-span-1 space-y-6">
            {/* Busca de Funcionário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Buscar Funcionário</span>
                </CardTitle>
                <CardDescription>
                  Digite o CPF para localizar o funcionário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cpf">CPF do Funcionário</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="cpf"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      className="flex-1"
                    />
                    <Button onClick={handleSearchEmployee} disabled={searching}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {searchError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{searchError}</AlertDescription>
                  </Alert>
                )}
                {employee && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Funcionário Encontrado</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Nome:</strong> {employee.name}</p>
                      <p><strong>CPF:</strong> {formatCPF(employee.cpf)}</p>
                      <p><strong>Cargo:</strong> {employee.position}</p>
                      <p><strong>Admissão:</strong> {new Date(employee.admissionDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuração da Rescisão */}
            {employee && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calculator className="h-5 w-5" />
                    <span>Dados da Rescisão</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="rescisionType">Tipo de Rescisão *</Label>
                    <Select value={rescisionType} onValueChange={setRescisionType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demissao_sem_justa_causa">Demissão sem Justa Causa</SelectItem>
                        <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                        <SelectItem value="justa_causa">Demissão por Justa Causa</SelectItem>
                        <SelectItem value="acordo_comum">Rescisão por Acordo</SelectItem>
                        <SelectItem value="rescisao_indireta">Rescisão Indireta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="rescisionDate">Data da Rescisão *</Label>
                    <Input
                      id="rescisionDate"
                      type="date"
                      value={rescisionDate}
                      onChange={(e) => setRescisionDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="priorNoticeType">Aviso Prévio</Label>
                    <Select value={priorNoticeType} onValueChange={setPriorNoticeType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indenizado">Indenizado</SelectItem>
                        <SelectItem value="trabalhado">Trabalhado</SelectItem>
                        <SelectItem value="nao_aplicavel">Não se Aplica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="hasVacationDue"
                      checked={hasVacationDue}
                      onCheckedChange={(checked) => setHasVacationDue(checked as boolean)}
                    />
                    <Label htmlFor="hasVacationDue">
                      Possui férias vencidas (período aquisitivo completo)
                    </Label>
                  </div>

                  <Button 
                    onClick={handleCalculate} 
                    className="w-full"
                    disabled={loading || !rescisionType || !rescisionDate}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Calculator className="h-4 w-4 mr-2" />
                    )}
                    Calcular Rescisão
                  </Button>

                  {calcError && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{calcError}</AlertDescription>
                    </Alert>
                  )}

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Revise tipo de rescisão, aviso prévio e férias vencidas antes de gerar o termo final.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Resultado */}
          <div className="lg:col-span-2 space-y-6">
            {calculation && (
              <>
                {/* Resumo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Resumo da Rescisão</span>
                      <Badge className={getRescisionTypeColor(calculation.rescisionType)}>
                        {getRescisionTypeName(calculation.rescisionType)}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Data da rescisão: {new Date(calculation.rescisionDate).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Total Bruto</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatCurrency(calculation.calculation.totalGross)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <DollarSign className="h-6 w-6 text-red-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Deduções</p>
                        <p className="text-xl font-bold text-red-600">
                          -{formatCurrency(calculation.calculation.totalDeductions)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <DollarSign className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Valor Líquido</p>
                        <p className="text-xl font-bold text-blue-600">
                          {formatCurrency(calculation.calculation.netValue)}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <Building className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">FGTS Total</p>
                        <p className="text-xl font-bold text-purple-600">
                          {formatCurrency(calculation.calculation.fgtsDeposit + calculation.calculation.fgtsFine)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detalhamento */}
                <Card>
                  <CardHeader>
                    <CardTitle>Discriminação das Verbas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Verbas Rescisórias */}
                      <div>
                        <h4 className="font-semibold text-green-700 mb-3">Verbas Rescisórias</h4>
                        <div className="space-y-2">
                          {calculation.calculation.items
                            .filter(item => item.type === 'earning')
                            .map((item, index) => (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                                <div>
                                  <span className="font-medium">{item.code}</span>
                                  <span className="text-gray-600 ml-2">{item.description}</span>
                                </div>
                                <span className="font-mono text-green-600">
                                  {formatCurrency(item.value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Deduções */}
                      <div>
                        <h4 className="font-semibold text-red-700 mb-3">Deduções</h4>
                        <div className="space-y-2">
                          {calculation.calculation.items
                            .filter(item => item.type === 'deduction')
                            .map((item, index) => (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                                <div>
                                  <span className="font-medium">{item.code}</span>
                                  <span className="text-gray-600 ml-2">{item.description}</span>
                                </div>
                                <span className="font-mono text-red-600">
                                  -{formatCurrency(item.value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* FGTS */}
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-700 mb-3">Informações FGTS</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Depósito FGTS (8%)</p>
                            <p className="font-semibold">{formatCurrency(calculation.calculation.fgtsDeposit)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Multa FGTS</p>
                            <p className="font-semibold">{formatCurrency(calculation.calculation.fgtsFine)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Document Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Documento de Rescisão</CardTitle>
                    <CardDescription>
                      Prévia do Termo de Rescisão do Contrato de Trabalho
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <RescisionDocument calculation={calculation} />
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex space-x-3">
                      <Button className="flex-1" onClick={() => window.print()}>
                        <Download className="h-4 w-4 mr-2" />
                        Gerar Termo de Rescisão
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                        <FileText className="h-4 w-4 mr-2" />
                        Imprimir Cálculo
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={exportCalculationSummary}>
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Resumo (.txt)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {!calculation && !employee && (
              <Card className="lg:col-span-2">
                <CardContent className="p-12 text-center">
                  <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Calculadora de Rescisão Trabalhista
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Digite o CPF do funcionário para começar o cálculo das verbas rescisórias
                  </p>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Importante:</strong> Esta calculadora segue as normas da CCT Sinprosp 2024/2025 
                      e a legislação trabalhista vigente. Sempre consulte um contador ou advogado trabalhista 
                      para casos específicos.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RescisionCalculatorPage;