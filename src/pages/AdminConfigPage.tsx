/**
 * Página de configurações administrativas
 * Permite personalizar fórmulas, tabelas e valores do sistema
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { configApi, SystemConfig, HourlyRateConfig, INSSConfig, IRRFConfig, FormulaConfig } from '../services/configApi';
import { 
  Settings,
  Calculator,
  DollarSign,
  Percent,
  Download,
  Upload,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  Code,
  Users,
  Loader2
} from 'lucide-react';

const AdminConfigPage: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('hourly-rates');
  const [tempConfig, setTempConfig] = useState<SystemConfig | null>(null);
  const [testResults, setTestResults] = useState<any>({});

  // Estados para edição
  const [editingRate, setEditingRate] = useState<HourlyRateConfig | null>(null);
  const [editingINSS, setEditingINSS] = useState<INSSConfig | null>(null);
  const [editingIRRF, setEditingIRRF] = useState<IRRFConfig | null>(null);
  const [editingFormula, setEditingFormula] = useState<FormulaConfig | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const systemConfig = await configApi.getSystemConfig();
      setConfig(systemConfig);
      setTempConfig(JSON.parse(JSON.stringify(systemConfig))); // Deep copy
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!tempConfig) return;

    try {
      setSaving(true);
      await configApi.updateSystemConfig(tempConfig);
      setConfig(tempConfig);
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const testCalculation = async () => {
    if (!tempConfig) return;

    try {
      const result = await configApi.calculateSalaryWithConfig(
        {
          type: 'hourly',
          level: 'fundamental2',
          weeklyHours: 20
        },
        {
          workDays: 22,
          absences: 0
        }
      );
      setTestResults(result);
    } catch (error) {
      console.error('Erro no teste:', error);
    }
  };

  const exportConfig = async () => {
    try {
      const configData = await configApi.exportConfig();
      const blob = new Blob([configData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sistema-config-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    } catch (error) {
      alert('Erro ao exportar configuração');
    }
  };

  const importConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedConfig = await configApi.importConfig(text);
      setConfig(importedConfig);
      setTempConfig(JSON.parse(JSON.stringify(importedConfig)));
      alert('Configuração importada com sucesso!');
    } catch (error) {
      alert('Erro ao importar configuração');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando configurações...</span>
        </div>
      </Layout>
    );
  }

  if (!config || !tempConfig) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Erro ao carregar configurações</h2>
          <Button onClick={loadConfig} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
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
            <h1 className="text-3xl font-bold text-gray-900">⚙️ Configurações do Sistema</h1>
            <p className="text-gray-600 mt-1">
              Personalize fórmulas, tabelas e valores de cálculo
            </p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={exportConfig}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Importar
              <input
                type="file"
                accept=".json"
                onChange={importConfig}
                className="hidden"
              />
            </label>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Tudo
            </Button>
          </div>
        </div>

        {/* Status */}
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')} • 
            <strong> Valores atuais baseados na CCT Sinprosp 2024/2025</strong>
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="hourly-rates">Horas Aula</TabsTrigger>
            <TabsTrigger value="inss">INSS</TabsTrigger>
            <TabsTrigger value="irrf">IRRF</TabsTrigger>
            <TabsTrigger value="formulas">Fórmulas</TabsTrigger>
            <TabsTrigger value="benefits">Benefícios</TabsTrigger>
            <TabsTrigger value="test">Teste</TabsTrigger>
          </TabsList>

          {/* Tab: Valores Hora Aula */}
          <TabsContent value="hourly-rates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Valores das Horas Aula por Nível</span>
                </CardTitle>
                <CardDescription>
                  Configure os valores por hora para cada nível de ensino
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tempConfig.hourlyRates.map((rate, index) => (
                    <div key={rate.level} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{rate.description}</h4>
                        <p className="text-sm text-gray-600">Nível: {rate.level}</p>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          value={rate.value}
                          onChange={(e) => {
                            const newRates = [...tempConfig.hourlyRates];
                            newRates[index].value = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, hourlyRates: newRates });
                          }}
                          className="text-right"
                        />
                      </div>
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(rate.value)}
                      </div>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">📊 Comparativo CCT 2024/2025</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-blue-600">EI / EF I</p>
                      <p className="font-semibold">R$ 26,45</p>
                    </div>
                    <div>
                      <p className="text-blue-600">EF II / EM</p>
                      <p className="font-semibold">R$ 31,44</p>
                    </div>
                    <div>
                      <p className="text-blue-600">Pré-Vestibular</p>
                      <p className="font-semibold">R$ 47,02</p>
                    </div>
                    <div>
                      <p className="text-blue-600">Auxiliares</p>
                      <p className="font-semibold">R$ 1.954,58</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: INSS */}
          <TabsContent value="inss" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Percent className="h-5 w-5" />
                  <span>Tabela INSS 2024</span>
                </CardTitle>
                <CardDescription>
                  Faixas de contribuição previdenciária
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tempConfig.inssTable.map((bracket, index) => (
                    <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                      <div>
                        <Label>De</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.minValue}
                          onChange={(e) => {
                            const newTable = [...tempConfig.inssTable];
                            newTable[index].minValue = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, inssTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Até</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.maxValue}
                          onChange={(e) => {
                            const newTable = [...tempConfig.inssTable];
                            newTable[index].maxValue = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, inssTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Alíquota (%)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={(bracket.rate * 100)}
                          onChange={(e) => {
                            const newTable = [...tempConfig.inssTable];
                            newTable[index].rate = (parseFloat(e.target.value) || 0) / 100;
                            setTempConfig({ ...tempConfig, inssTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Dedução</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.deduction}
                          onChange={(e) => {
                            const newTable = [...tempConfig.inssTable];
                            newTable[index].deduction = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, inssTable: newTable });
                          }}
                        />
                      </div>
                      <div className="flex items-end">
                        <Badge>{bracket.description}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: IRRF */}
          <TabsContent value="irrf" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Percent className="h-5 w-5" />
                  <span>Tabela IRRF 2024</span>
                </CardTitle>
                <CardDescription>
                  Faixas do Imposto de Renda Retido na Fonte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tempConfig.irrfTable.map((bracket, index) => (
                    <div key={index} className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                      <div>
                        <Label>De</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.minValue}
                          onChange={(e) => {
                            const newTable = [...tempConfig.irrfTable];
                            newTable[index].minValue = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, irrfTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Até</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.maxValue}
                          onChange={(e) => {
                            const newTable = [...tempConfig.irrfTable];
                            newTable[index].maxValue = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, irrfTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Alíquota (%)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={(bracket.rate * 100)}
                          onChange={(e) => {
                            const newTable = [...tempConfig.irrfTable];
                            newTable[index].rate = (parseFloat(e.target.value) || 0) / 100;
                            setTempConfig({ ...tempConfig, irrfTable: newTable });
                          }}
                        />
                      </div>
                      <div>
                        <Label>Dedução</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={bracket.deduction}
                          onChange={(e) => {
                            const newTable = [...tempConfig.irrfTable];
                            newTable[index].deduction = parseFloat(e.target.value) || 0;
                            setTempConfig({ ...tempConfig, irrfTable: newTable });
                          }}
                        />
                      </div>
                      <div className="flex items-end">
                        <Badge>{bracket.description}</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">💡 Dedução por Dependente</h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <Label>Valor por dependente:</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={tempConfig.irrfTable[0]?.dependentDeduction || 189.59}
                      onChange={(e) => {
                        const newTable = [...tempConfig.irrfTable];
                        const newValue = parseFloat(e.target.value) || 189.59;
                        newTable.forEach(bracket => bracket.dependentDeduction = newValue);
                        setTempConfig({ ...tempConfig, irrfTable: newTable });
                      }}
                      className="w-32"
                    />
                    <span className="text-yellow-700">R$ {tempConfig.irrfTable[0]?.dependentDeduction.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Fórmulas */}
          <TabsContent value="formulas" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Fórmulas de Cálculo</span>
                </CardTitle>
                <CardDescription>
                  Personalize as fórmulas usadas nos cálculos salariais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {tempConfig.formulas.map((formula, index) => (
                    <div key={formula.name} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{formula.description}</h4>
                        <Badge variant="outline">{formula.name}</Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <Label>Fórmula</Label>
                          <Textarea
                            value={formula.formula}
                            onChange={(e) => {
                              const newFormulas = [...tempConfig.formulas];
                              newFormulas[index].formula = e.target.value;
                              setTempConfig({ ...tempConfig, formulas: newFormulas });
                            }}
                            className="font-mono text-sm"
                            rows={2}
                          />
                        </div>
                        
                        <div>
                          <Label>Variáveis Disponíveis</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {formula.variables.map(variable => (
                              <Badge key={variable} variant="secondary">
                                {variable}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">🔢 Percentuais Padrão</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>DSR (1/6)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={(tempConfig.percentages.dsr * 100).toFixed(4)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            percentages: {
                              ...tempConfig.percentages,
                              dsr: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">{formatPercent(tempConfig.percentages.dsr)}</p>
                    </div>

                    <div>
                      <Label>Hora Atividade</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(tempConfig.percentages.hourActivity * 100)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            percentages: {
                              ...tempConfig.percentages,
                              hourActivity: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">{formatPercent(tempConfig.percentages.hourActivity)}</p>
                    </div>

                    <div>
                      <Label>FGTS</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(tempConfig.percentages.fgts * 100)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            percentages: {
                              ...tempConfig.percentages,
                              fgts: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">{formatPercent(tempConfig.percentages.fgts)}</p>
                    </div>

                    <div>
                      <Label>1/3 Férias</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={(tempConfig.percentages.vacationThird * 100).toFixed(4)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            percentages: {
                              ...tempConfig.percentages,
                              vacationThird: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">{formatPercent(tempConfig.percentages.vacationThird)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Benefícios */}
          <TabsContent value="benefits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Configurações de Benefícios</span>
                </CardTitle>
                <CardDescription>
                  Configure valores e percentuais dos benefícios
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Vale Transporte</h4>
                    <div>
                      <Label>Valor por Viagem</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tempConfig.benefits.transportValue}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            benefits: {
                              ...tempConfig.benefits,
                              transportValue: parseFloat(e.target.value) || 0
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        {formatCurrency(tempConfig.benefits.transportValue)}
                      </p>
                    </div>
                    <div>
                      <Label>% Desconto do Salário</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(tempConfig.benefits.transportDeductionPercent * 100)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            benefits: {
                              ...tempConfig.benefits,
                              transportDeductionPercent: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        {formatPercent(tempConfig.benefits.transportDeductionPercent)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Vale Alimentação</h4>
                    <div>
                      <Label>Valor por Dia</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tempConfig.benefits.mealValue}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            benefits: {
                              ...tempConfig.benefits,
                              mealValue: parseFloat(e.target.value) || 0
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        {formatCurrency(tempConfig.benefits.mealValue)}
                      </p>
                    </div>
                    <div>
                      <Label>% Desconto do Salário</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={(tempConfig.benefits.mealDeductionPercent * 100)}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            benefits: {
                              ...tempConfig.benefits,
                              mealDeductionPercent: (parseFloat(e.target.value) || 0) / 100
                            }
                          });
                        }}
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        {formatPercent(tempConfig.benefits.mealDeductionPercent)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">📅 Configurações de Trabalho</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Dias Úteis Padrão/Mês</Label>
                      <Input
                        type="number"
                        value={tempConfig.workDays.defaultMonthlyDays}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            workDays: {
                              ...tempConfig.workDays,
                              defaultMonthlyDays: parseInt(e.target.value) || 22
                            }
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Multiplicador Semana (4.5)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={tempConfig.workDays.weekMultiplier}
                        onChange={(e) => {
                          setTempConfig({
                            ...tempConfig,
                            workDays: {
                              ...tempConfig.workDays,
                              weekMultiplier: parseFloat(e.target.value) || 4.5
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Teste */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calculator className="h-5 w-5" />
                  <span>Teste de Configurações</span>
                </CardTitle>
                <CardDescription>
                  Teste os cálculos com as configurações atuais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button onClick={testCalculation} className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Testar Cálculo (Professor EF II - 20h semanais)
                  </Button>

                  {testResults.baseSalary && (
                    <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                      <h4 className="font-medium mb-4">Resultado do Teste</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Salário Base</p>
                          <p className="font-semibold text-blue-600">
                            {formatCurrency(testResults.baseSalary)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">DSR</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(testResults.dsr)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Hora Atividade</p>
                          <p className="font-semibold text-purple-600">
                            {formatCurrency(testResults.hourActivity)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Salário Bruto</p>
                          <p className="font-semibold text-orange-600">
                            {formatCurrency(testResults.grossSalary)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">INSS</p>
                          <p className="font-semibold text-red-600">
                            -{formatCurrency(testResults.inss)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">IRRF</p>
                          <p className="font-semibold text-red-600">
                            -{formatCurrency(testResults.irrf)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">FGTS</p>
                          <p className="font-semibold text-indigo-600">
                            {formatCurrency(testResults.fgts)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Salário Líquido</p>
                          <p className="font-semibold text-green-700 text-lg">
                            {formatCurrency(testResults.netSalary)}
                          </p>
                        </div>
                      </div>

                      {testResults.breakdown && (
                        <div className="mt-4 p-3 bg-white rounded border">
                          <h5 className="font-medium mb-2">Detalhamento dos Cálculos</h5>
                          <div className="text-xs space-y-1 text-gray-600">
                            <p><strong>Salário Base:</strong> {testResults.breakdown.calculations.baseSalaryFormula}</p>
                            <p><strong>DSR:</strong> {testResults.breakdown.calculations.dsrFormula}</p>
                            <p><strong>Hora Atividade:</strong> {testResults.breakdown.calculations.hourActivityFormula}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminConfigPage;
