import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Rubric,
  TaxBracketInss,
  TaxBracketIrrf,
  rubricsApi,
  taxTablesApi,
} from '../services/rubricsApi';
import {
  Calculator,
  Plus,
  Save,
  Trash2,
  Edit,
  Loader2,
  Code,
  Percent,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatPercent = (value: number) =>
  `${(Number(value) * 100).toFixed(2)}%`;

type RubricFormData = {
  code: string;
  name: string;
  description: string;
  type: 'earning' | 'deduction';
  formula: string;
  percentage: string;
  fixedValue: string;
  baseRubric: string;
  sortOrder: string;
};

const emptyRubricForm: RubricFormData = {
  code: '',
  name: '',
  description: '',
  type: 'earning',
  formula: '',
  percentage: '',
  fixedValue: '',
  baseRubric: '',
  sortOrder: '0',
};

const AdminFormulasPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('rubrics');
  const [loading, setLoading] = useState(true);

  // Rubrics state
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);
  const [rubricForm, setRubricForm] = useState<RubricFormData>(emptyRubricForm);
  const [showRubricForm, setShowRubricForm] = useState(false);
  const [savingRubric, setSavingRubric] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rubricToDelete, setRubricToDelete] = useState<Rubric | null>(null);

  // Tax tables state
  const [taxMonth, setTaxMonth] = useState(new Date().getMonth() + 1);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [inssTable, setInssTable] = useState<TaxBracketInss[]>([]);
  const [irrfTable, setIrrfTable] = useState<TaxBracketIrrf[]>([]);
  const [savingTax, setSavingTax] = useState(false);

  useEffect(() => {
    loadRubrics();
  }, []);

  useEffect(() => {
    loadTaxTables();
  }, [taxMonth, taxYear]);

  const loadRubrics = async () => {
    try {
      setLoading(true);
      const data = await rubricsApi.list(true);
      setRubrics(data);
    } catch (e) {
      toast({ title: 'Erro', description: 'Falha ao carregar rubricas.' });
    } finally {
      setLoading(false);
    }
  };

  const loadTaxTables = async () => {
    try {
      const [inss, irrf] = await Promise.all([
        taxTablesApi.listInss(taxMonth, taxYear),
        taxTablesApi.listIrrf(taxMonth, taxYear),
      ]);
      setInssTable(inss);
      setIrrfTable(irrf);
    } catch {
      // No tables for this period
      setInssTable([]);
      setIrrfTable([]);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setLoading(true);
      await rubricsApi.seedDefaults();
      await loadRubrics();
      toast({ title: 'Sucesso', description: 'Rubricas padrão criadas.' });
    } catch (e) {
      toast({ title: 'Erro', description: 'Falha ao criar rubricas padrão.' });
    } finally {
      setLoading(false);
    }
  };

  const openNewRubric = () => {
    setEditingRubric(null);
    setRubricForm(emptyRubricForm);
    setShowRubricForm(true);
  };

  const openEditRubric = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setRubricForm({
      code: rubric.code,
      name: rubric.name,
      description: rubric.description ?? '',
      type: rubric.type,
      formula: rubric.formula ?? '',
      percentage: rubric.percentage != null ? String(rubric.percentage) : '',
      fixedValue: rubric.fixedValue != null ? String(rubric.fixedValue) : '',
      baseRubric: rubric.baseRubric ?? '',
      sortOrder: String(rubric.sortOrder),
    });
    setShowRubricForm(true);
  };

  const handleSaveRubric = async () => {
    try {
      setSavingRubric(true);
      const payload: any = {
        code: rubricForm.code.toUpperCase(),
        name: rubricForm.name,
        description: rubricForm.description || undefined,
        type: rubricForm.type,
        formula: rubricForm.formula || undefined,
        percentage: rubricForm.percentage ? Number(rubricForm.percentage) : undefined,
        fixedValue: rubricForm.fixedValue ? Number(rubricForm.fixedValue) : undefined,
        baseRubric: rubricForm.baseRubric || undefined,
        sortOrder: Number(rubricForm.sortOrder) || 0,
      };

      if (editingRubric) {
        await rubricsApi.update(editingRubric.id, payload);
        toast({ title: 'Sucesso', description: `Rubrica ${payload.code} atualizada.` });
      } else {
        await rubricsApi.create(payload);
        toast({ title: 'Sucesso', description: `Rubrica ${payload.code} criada.` });
      }
      setShowRubricForm(false);
      await loadRubrics();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao salvar rubrica.' });
    } finally {
      setSavingRubric(false);
    }
  };

  const handleDeleteRubric = async () => {
    if (!rubricToDelete) return;
    try {
      await rubricsApi.delete(rubricToDelete.id);
      toast({ title: 'Sucesso', description: `Rubrica ${rubricToDelete.code} desativada.` });
      setDeleteDialogOpen(false);
      setRubricToDelete(null);
      await loadRubrics();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao desativar rubrica.' });
    }
  };

  const handleToggleActive = async (rubric: Rubric) => {
    try {
      await rubricsApi.update(rubric.id, { active: !rubric.active } as any);
      await loadRubrics();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao atualizar status.' });
    }
  };

  // --- INSS editing ---
  const addInssRow = () => {
    setInssTable((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, minValue: 0, maxValue: 0, rate: 0, deduction: 0 },
    ]);
  };

  const updateInssRow = (index: number, field: keyof TaxBracketInss, value: string) => {
    setInssTable((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: Number(value) } : row)),
    );
  };

  const removeInssRow = (index: number) => {
    setInssTable((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveInss = async () => {
    try {
      setSavingTax(true);
      await taxTablesApi.upsertInss({
        month: taxMonth,
        year: taxYear,
        brackets: inssTable.map(({ minValue, maxValue, rate, deduction }) => ({
          minValue,
          maxValue,
          rate,
          deduction,
        })),
      });
      toast({ title: 'Sucesso', description: 'Tabela INSS salva.' });
      await loadTaxTables();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao salvar tabela INSS.' });
    } finally {
      setSavingTax(false);
    }
  };

  // --- IRRF editing ---
  const addIrrfRow = () => {
    setIrrfTable((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, minValue: 0, maxValue: 0, rate: 0, deduction: 0, dependentDeduction: 0 },
    ]);
  };

  const updateIrrfRow = (index: number, field: keyof TaxBracketIrrf, value: string) => {
    setIrrfTable((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: Number(value) } : row)),
    );
  };

  const removeIrrfRow = (index: number) => {
    setIrrfTable((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveIrrf = async () => {
    try {
      setSavingTax(true);
      await taxTablesApi.upsertIrrf({
        month: taxMonth,
        year: taxYear,
        brackets: irrfTable.map(({ minValue, maxValue, rate, deduction, dependentDeduction }) => ({
          minValue,
          maxValue,
          rate,
          deduction,
          dependentDeduction,
        })),
      });
      toast({ title: 'Sucesso', description: 'Tabela IRRF salva.' });
      await loadTaxTables();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || 'Falha ao salvar tabela IRRF.' });
    } finally {
      setSavingTax(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              Fórmulas e Tabelas
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie rubricas, fórmulas de cálculo e tabelas de INSS/IRRF
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rubrics">
              <Code className="h-4 w-4 mr-1" /> Rubricas
            </TabsTrigger>
            <TabsTrigger value="inss">
              <Percent className="h-4 w-4 mr-1" /> Tabela INSS
            </TabsTrigger>
            <TabsTrigger value="irrf">
              <Percent className="h-4 w-4 mr-1" /> Tabela IRRF
            </TabsTrigger>
          </TabsList>

          {/* ========== RUBRICS TAB ========== */}
          <TabsContent value="rubrics">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Rubricas (Proventos e Descontos)</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeedDefaults} disabled={loading}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Criar Padrões
                    </Button>
                    <Button onClick={openNewRubric}>
                      <Plus className="h-4 w-4 mr-1" /> Nova Rubrica
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : rubrics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma rubrica cadastrada.</p>
                    <p className="text-sm mt-1">Clique em "Criar Padrões" para iniciar com as rubricas padrão do sistema.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Ord.</TableHead>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-24">Tipo</TableHead>
                        <TableHead>Fórmula</TableHead>
                        <TableHead className="w-20">%</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-28">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rubrics.map((rubric) => (
                        <TableRow key={rubric.id} className={!rubric.active ? 'opacity-50' : ''}>
                          <TableCell className="text-sm">{rubric.sortOrder}</TableCell>
                          <TableCell className="font-mono font-semibold">{rubric.code}</TableCell>
                          <TableCell>
                            <div>{rubric.name}</div>
                            {rubric.description && (
                              <div className="text-xs text-muted-foreground">{rubric.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rubric.type === 'earning' ? 'default' : 'destructive'}>
                              {rubric.type === 'earning' ? 'Provento' : 'Desconto'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 py-0.5 rounded max-w-64 block truncate">
                              {rubric.formula || '--'}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm">
                            {rubric.percentage != null ? `${rubric.percentage}%` : '--'}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleToggleActive(rubric)}
                              className="cursor-pointer"
                            >
                              {rubric.active ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => openEditRubric(rubric)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRubricToDelete(rubric);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Rubric Edit Form */}
                {showRubricForm && (
                  <Card className="mt-4 border-primary">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {editingRubric ? `Editar ${editingRubric.code}` : 'Nova Rubrica'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Código *</Label>
                          <Input
                            value={rubricForm.code}
                            onChange={(e) => setRubricForm({ ...rubricForm, code: e.target.value.toUpperCase() })}
                            placeholder="EX: BASE, INSS, VT"
                            disabled={!!editingRubric}
                          />
                        </div>
                        <div>
                          <Label>Nome *</Label>
                          <Input
                            value={rubricForm.name}
                            onChange={(e) => setRubricForm({ ...rubricForm, name: e.target.value })}
                            placeholder="Salário Base"
                          />
                        </div>
                        <div>
                          <Label>Tipo *</Label>
                          <Select
                            value={rubricForm.type}
                            onValueChange={(v) => setRubricForm({ ...rubricForm, type: v as 'earning' | 'deduction' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="earning">Provento</SelectItem>
                              <SelectItem value="deduction">Desconto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-3">
                          <Label>Descrição</Label>
                          <Input
                            value={rubricForm.description}
                            onChange={(e) => setRubricForm({ ...rubricForm, description: e.target.value })}
                            placeholder="Descrição detalhada da rubrica"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Label>Fórmula de Cálculo</Label>
                          <Textarea
                            value={rubricForm.formula}
                            onChange={(e) => setRubricForm({ ...rubricForm, formula: e.target.value })}
                            placeholder='Ex: salaryType === "hourly" ? weeklyHours * hourlyRate * 4.5 : baseSalary'
                            className="font-mono text-sm"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Variáveis disponíveis: baseSalary, hourlyRate, weeklyHours, salaryType, BASE, BRUTO, dependentes, unionFee.
                            Use códigos de outras rubricas (ex: BASE, HORA_ATV) para referenciá-las.
                          </p>
                        </div>
                        <div>
                          <Label>Percentual (%)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={rubricForm.percentage}
                            onChange={(e) => setRubricForm({ ...rubricForm, percentage: e.target.value })}
                            placeholder="Ex: 5 para 5%"
                          />
                        </div>
                        <div>
                          <Label>Valor Fixo (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={rubricForm.fixedValue}
                            onChange={(e) => setRubricForm({ ...rubricForm, fixedValue: e.target.value })}
                            placeholder="Ex: 25.00"
                          />
                        </div>
                        <div>
                          <Label>Rubrica Base</Label>
                          <Input
                            value={rubricForm.baseRubric}
                            onChange={(e) => setRubricForm({ ...rubricForm, baseRubric: e.target.value.toUpperCase() })}
                            placeholder="Ex: BASE"
                          />
                        </div>
                        <div>
                          <Label>Ordem</Label>
                          <Input
                            type="number"
                            value={rubricForm.sortOrder}
                            onChange={(e) => setRubricForm({ ...rubricForm, sortOrder: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSaveRubric} disabled={savingRubric || !rubricForm.code || !rubricForm.name}>
                          {savingRubric ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Salvar
                        </Button>
                        <Button variant="outline" onClick={() => setShowRubricForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== INSS TAB ========== */}
          <TabsContent value="inss">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tabela Progressiva INSS</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label>Mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={taxMonth}
                      onChange={(e) => setTaxMonth(Number(e.target.value))}
                      className="w-20"
                    />
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      min={2020}
                      value={taxYear}
                      onChange={(e) => setTaxYear(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>De (R$)</TableHead>
                      <TableHead>Até (R$)</TableHead>
                      <TableHead>Alíquota</TableHead>
                      <TableHead>Dedução (R$)</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inssTable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                          Nenhuma faixa cadastrada para {String(taxMonth).padStart(2, '0')}/{taxYear}.
                          Clique em "Adicionar Faixa" para começar.
                        </TableCell>
                      </TableRow>
                    )}
                    {inssTable.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{index + 1}ª</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.minValue}
                            onChange={(e) => updateInssRow(index, 'minValue', e.target.value)}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.maxValue}
                            onChange={(e) => updateInssRow(index, 'maxValue', e.target.value)}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={row.rate}
                            onChange={(e) => updateInssRow(index, 'rate', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.deduction}
                            onChange={(e) => updateInssRow(index, 'deduction', e.target.value)}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeInssRow(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={addInssRow}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Faixa
                  </Button>
                  <Button onClick={handleSaveInss} disabled={savingTax}>
                    {savingTax ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar Tabela INSS
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  A alíquota deve ser um decimal (ex: 0.075 para 7,5%). A dedução é o valor a ser subtraído após aplicar a alíquota.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== IRRF TAB ========== */}
          <TabsContent value="irrf">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tabela Progressiva IRRF</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label>Mês</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={taxMonth}
                      onChange={(e) => setTaxMonth(Number(e.target.value))}
                      className="w-20"
                    />
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      min={2020}
                      value={taxYear}
                      onChange={(e) => setTaxYear(Number(e.target.value))}
                      className="w-24"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faixa</TableHead>
                      <TableHead>De (R$)</TableHead>
                      <TableHead>Até (R$)</TableHead>
                      <TableHead>Alíquota</TableHead>
                      <TableHead>Dedução (R$)</TableHead>
                      <TableHead>Ded. Dependente (R$)</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {irrfTable.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                          Nenhuma faixa cadastrada para {String(taxMonth).padStart(2, '0')}/{taxYear}.
                        </TableCell>
                      </TableRow>
                    )}
                    {irrfTable.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{index + 1}ª</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.minValue}
                            onChange={(e) => updateIrrfRow(index, 'minValue', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.maxValue}
                            onChange={(e) => updateIrrfRow(index, 'maxValue', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={row.rate}
                            onChange={(e) => updateIrrfRow(index, 'rate', e.target.value)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.deduction}
                            onChange={(e) => updateIrrfRow(index, 'deduction', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={row.dependentDeduction}
                            onChange={(e) => updateIrrfRow(index, 'dependentDeduction', e.target.value)}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => removeIrrfRow(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={addIrrfRow}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Faixa
                  </Button>
                  <Button onClick={handleSaveIrrf} disabled={savingTax}>
                    {savingTax ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar Tabela IRRF
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  A redução do IRRF conforme Lei 15.270/2025 é aplicada automaticamente para competências a partir de janeiro/2026.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar rubrica?</AlertDialogTitle>
            <AlertDialogDescription>
              A rubrica <strong>{rubricToDelete?.code}</strong> ({rubricToDelete?.name}) será desativada.
              Ela não será removida do banco, apenas ficará inativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRubric}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default AdminFormulasPage;
