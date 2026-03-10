/**
 * Página administrativa para abertura, fechamento e reabertura de folhas por competência.
 */
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../components/ui/alert-dialog';
import { useToast } from '../hooks/use-toast';
import { payrollApi, PayrollRun, PayrollRunSummary } from '../services/payrollApi';
import { BarChart3, CalendarCheck, FileText, Loader2, Lock, RefreshCcw, Unlock } from 'lucide-react';

const statusLabels: Record<PayrollRun['status'], string> = {
  draft: 'Rascunho',
  calculated: 'Calculada',
  closed: 'Fechada'
};

const statusBadgeClass: Record<PayrollRun['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  calculated: 'bg-blue-100 text-blue-700',
  closed: 'bg-emerald-100 text-emerald-700'
};

const AdminPayrollRunsPage: React.FC = () => {
  const { toast } = useToast();

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ month: '', year: '', status: 'all' });
  const [openForm, setOpenForm] = useState({ month: currentMonth.toString(), year: currentYear.toString() });
  const [summaryForm, setSummaryForm] = useState({ month: currentMonth.toString(), year: currentYear.toString() });
  const [summary, setSummary] = useState<PayrollRunSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'close' | 'reopen' | null>(null);
  const [actionRun, setActionRun] = useState<PayrollRun | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

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

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await payrollApi.listRuns({
        month: filters.month ? Number(filters.month) : undefined,
        year: filters.year ? Number(filters.year) : undefined,
        status: filters.status !== 'all' ? (filters.status as PayrollRun['status']) : undefined
      });
      setRuns(data);
    } catch (error) {
      toast({
        title: 'Falha ao carregar',
        description: getFriendlyError(error, 'Não foi possível carregar as folhas.')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRun = async () => {
    if (!openForm.month || !openForm.year) {
      toast({
        title: 'Dados incompletos',
        description: 'Informe mês e ano para abrir a competência.'
      });
      return;
    }

    try {
      const created = await payrollApi.openRun(Number(openForm.month), Number(openForm.year));
      toast({
        title: 'Competência aberta',
        description: `Folha ${created.month}/${created.year} pronta para cálculo.`
      });
      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao abrir',
        description: getFriendlyError(error, 'Não foi possível abrir a competência.')
      });
    }
  };

  const handleLoadSummary = async () => {
    if (!summaryForm.month || !summaryForm.year) {
      toast({
        title: 'Dados incompletos',
        description: 'Informe mês e ano para carregar o resumo.'
      });
      return;
    }

    setSummaryLoading(true);
    try {
      const data = await payrollApi.getSummary(Number(summaryForm.month), Number(summaryForm.year));
      setSummary(data);
    } catch (error) {
      setSummary(null);
      toast({
        title: 'Falha ao carregar resumo',
        description: getFriendlyError(error, 'Não foi possível obter o resumo.')
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  const requestAction = (run: PayrollRun, type: 'close' | 'reopen') => {
    setActionRun(run);
    setActionType(type);
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    if (!actionRun || !actionType) return;

    try {
      if (actionType === 'close') {
        await payrollApi.closeRun(actionRun.id);
        toast({
          title: 'Folha fechada',
          description: `Competência ${actionRun.month}/${actionRun.year} fechada com sucesso.`
        });
      } else {
        await payrollApi.reopenRun(actionRun.id);
        toast({
          title: 'Folha reaberta',
          description: `Competência ${actionRun.month}/${actionRun.year} reaberta.`
        });
      }
      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha na operação',
        description: getFriendlyError(error, 'Não foi possível concluir a operação.')
      });
    } finally {
      setDialogOpen(false);
    }
  };

  const handleGenerateHolerites = async (run: PayrollRun) => {
    setGeneratingId(run.id);
    try {
      let status = run.status;
      if (status === 'draft') {
        toast({
          title: 'Calculando folha',
          description: `Competência ${run.month}/${run.year} em processamento antes da emissão.`
        });
        const calculatedRun = await payrollApi.calculatePayrollRun(run.id);
        status = calculatedRun.status;
      }

      if (status === 'draft') {
        throw new Error('A folha permanece em rascunho após tentativa de cálculo.');
      }

      const result = await payrollApi.generateDocumentsFromRun(
        run.id,
        {
          documentType: 'holerite',
          reason: `emissao_holerites_${run.month}_${run.year}`
        },
        true
      );

      const summary = result.skippedCount > 0
        ? `${result.createdCount} gerados e ${result.skippedCount} já existentes.`
        : `${result.createdCount} gerados com sucesso.`;

      toast({
        title: 'Holerites emitidos',
        description: `Competência ${run.month}/${run.year}: ${summary}`
      });

      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao emitir holerites',
        description: getFriendlyError(error, 'Não foi possível emitir os holerites da competência.')
      });
    } finally {
      setGeneratingId(null);
    }
  };
  const formatDate = (value?: string | null) => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fechamento por Competência</h1>
            <p className="text-gray-600 mt-1">
              Controle de abertura, fechamento e reabertura da folha.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadRuns()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarCheck className="h-5 w-5" />
                <span>Abrir competência</span>
              </CardTitle>
              <CardDescription>Crie ou reutilize a folha do mês.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={openForm.month}
                    onChange={(event) => setOpenForm({ ...openForm, month: event.target.value })}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={openForm.year}
                    onChange={(event) => setOpenForm({ ...openForm, year: event.target.value })}
                    placeholder="2026"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={() => void handleOpenRun()}>
                Abrir competência
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Resumo por competência</span>
              </CardTitle>
              <CardDescription>Totais calculados da folha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label>Mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={summaryForm.month}
                    onChange={(event) => setSummaryForm({ ...summaryForm, month: event.target.value })}
                    className="w-28"
                  />
                </div>
                <div>
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={summaryForm.year}
                    onChange={(event) => setSummaryForm({ ...summaryForm, year: event.target.value })}
                    className="w-32"
                  />
                </div>
                <Button variant="outline" onClick={() => void handleLoadSummary()} disabled={summaryLoading}>
                  {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar resumo'}
                </Button>
              </div>

              {summary ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Status</p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">
                        {summary.month}/{summary.year}
                      </p>
                      <Badge className={statusBadgeClass[summary.status]}>{statusLabels[summary.status]}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Funcionarios: {summary.employeesCount}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-4">
                    <p className="text-xs text-blue-600">Total bruto</p>
                    <p className="text-lg font-semibold text-blue-700">
                      {formatCurrency(summary.totals.grossSalary)}
                    </p>
                    <p className="text-xs text-blue-500 mt-2">FGTS: {formatCurrency(summary.totals.fgts)}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <p className="text-xs text-emerald-600">Total líquido</p>
                    <p className="text-lg font-semibold text-emerald-700">
                      {formatCurrency(summary.totals.netSalary)}
                    </p>
                    <p className="text-xs text-emerald-500 mt-2">
                      Descontos: {formatCurrency(summary.totals.totalDeductions)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Carregue um resumo para visualizar os totais.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Competências registradas</CardTitle>
            <CardDescription>Filtre por mes, ano ou status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={filters.month}
                  onChange={(event) => setFilters({ ...filters, month: event.target.value })}
                  className="w-24"
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  value={filters.year}
                  onChange={(event) => setFilters({ ...filters, year: event.target.value })}
                  className="w-28"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="calculated">Calculada</SelectItem>
                    <SelectItem value="closed">Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void loadRuns()}>Buscar</Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando folhas...
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead>Fechada em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                        Nenhuma competência encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{run.month}/{run.year}</div>
                          <div className="text-xs text-gray-500">v{run.version}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass[run.status]}>
                            {statusLabels[run.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(run.createdAt)}</TableCell>
                        <TableCell>{formatDate(run.closedAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestAction(run, 'close')}
                              disabled={run.status !== 'calculated'}
                            >
                              <Lock className="h-4 w-4 mr-1" />
                              Fechar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestAction(run, 'reopen')}
                              disabled={run.status !== 'closed'}
                            >
                              <Unlock className="h-4 w-4 mr-1" />
                              Reabrir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleGenerateHolerites(run)}
                              disabled={generatingId === run.id}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              {generatingId === run.id ? 'Processando...' : run.status === 'draft' ? 'Calcular + emitir' : 'Emitir holerites'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'close' ? 'Confirmar fechamento' : 'Confirmar reabertura'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionRun
                ? `Competência ${actionRun.month}/${actionRun.year}. Deseja continuar?`
                : 'Deseja continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmAction()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default AdminPayrollRunsPage;



