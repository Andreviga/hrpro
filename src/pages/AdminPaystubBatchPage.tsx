import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Loader2, FileText, RefreshCcw } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { payrollApi, PayrollRun } from '../services/payrollApi';

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

const AdminPaystubBatchPage: React.FC = () => {
  const { toast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [availableCompetencies, setAvailableCompetencies] = useState<Array<{
    key: string;
    month: number;
    year: number;
    status: PayrollRun['status'];
  }>>([]);
  const [selectedCompetency, setSelectedCompetency] = useState('');
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const getFriendlyError = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      try {
        const payload = JSON.parse(error.message);
        if (payload?.message) {
          if (Array.isArray(payload?.details?.issues) && payload.details.issues.length > 0) {
            return `${payload.message} ${payload.details.issues.join(' ')}`;
          }
          return payload.message as string;
        }
      } catch {
        return error.message || fallback;
      }
    }
    return fallback;
  };

  const loadRuns = async () => {
    if (!month || !year) return;

    setLoading(true);
    try {
      const data = await payrollApi.listRuns({
        month: Number(month),
        year: Number(year)
      });

      const sorted = [...data].sort((a, b) => b.version - a.version);
      setRuns(sorted);
    } catch (error) {
      toast({
        title: 'Falha ao carregar competências',
        description: getFriendlyError(error, 'Não foi possível carregar as competências informadas.')
      });
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCompetencies = async () => {
    try {
      const allRuns = await payrollApi.listRuns();
      const seen = new Set<string>();
      const normalized = [...allRuns]
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          if (a.month !== b.month) return b.month - a.month;
          return b.version - a.version;
        })
        .filter((run) => {
          const key = `${run.month}-${run.year}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((run) => ({
          key: `${run.month}-${run.year}`,
          month: run.month,
          year: run.year,
          status: run.status
        }));

      setAvailableCompetencies(normalized);
    } catch {
      setAvailableCompetencies([]);
    }
  };

  const ensureCalculated = async (run: PayrollRun) => {
    if (run.status !== 'draft') return run.status;

    toast({
      title: 'Calculando folha',
      description: `competência ${run.month}/${run.year} em processamento antes da Emissão.`
    });

    const calculatedRun = await payrollApi.calculatePayrollRun(run.id);
    if (calculatedRun.status === 'draft') {
      throw new Error('A folha permanece em rascunho após tentativa de cálculo.');
    }

    return calculatedRun.status;
  };

  const handleEmitPaystubs = async (run: PayrollRun) => {
    setEmittingId(run.id);
    try {
      await ensureCalculated(run);

      const result = await payrollApi.generateDocumentsFromRun(
        run.id,
        {
          documentType: 'holerite',
          reason: `emissao_holerites_${run.month}_${run.year}`
        },
        true
      );

      const summary = result.skippedCount > 0
        ? `${result.createdCount} novos e ${result.skippedCount} já existentes.`
        : `${result.createdCount} holerites emitidos.`;

      toast({
        title: 'Emissão concluída',
        description: `competência ${run.month}/${run.year}: ${summary}`
      });

      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao emitir holerites',
        description: getFriendlyError(error, 'Não foi possível emitir os holerites da competência.')
      });
    } finally {
      setEmittingId(null);
    }
  };

  const handleRegeneratePaystubs = async (run: PayrollRun) => {
    const confirmed = window.confirm(
      `Regerar todos os holerites da competência ${run.month}/${run.year}?\n\nOs holerites atuais serão desativados e novos arquivos serão criados.`
    );

    if (!confirmed) return;

    setRegeneratingId(run.id);
    try {
      await ensureCalculated(run);

      const result = await payrollApi.generateDocumentsFromRun(run.id, {
        documentType: 'holerite',
        reason: `regeracao_holerites_${run.month}_${run.year}`,
        forceRegenerate: true
      });

      const regenerated = result.regeneratedFromPreviousCount ?? 0;
      toast({
        title: 'Regeneração concluída',
        description: `competência ${run.month}/${run.year}: ${result.createdCount} novos, ${regenerated} anteriores desativados.`
      });

      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao regerar holerites',
        description: getFriendlyError(error, 'Não foi possível regerar os holerites desta competência.')
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  useEffect(() => {
    void loadRuns();
    void loadAvailableCompetencies();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Emitir Holerites</h1>
            <p className="text-gray-600 mt-1">Escolha a competência e emita ou regera com um clique.</p>
          </div>
          <Button variant="outline" onClick={() => void loadRuns()} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Emissão Rapida
            </CardTitle>
            <CardDescription>
              Emissão padrão evita duplicidade. Regerar substitui os holerites existentes da competência.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>competências existentes</Label>
              <div className="flex flex-wrap items-end gap-3 mt-1">
                <Select
                  value={selectedCompetency}
                  onValueChange={(value) => {
                    setSelectedCompetency(value);
                    const [selectedMonth, selectedYear] = value.split('-');
                    setMonth(selectedMonth);
                    setYear(selectedYear);
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione uma competência existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCompetencies.map((competency) => (
                      <SelectItem key={competency.key} value={competency.key}>
                        {String(competency.month).padStart(2, '0')}/{competency.year} - {statusLabels[competency.status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={() => void loadRuns()}
                  disabled={loading || !selectedCompetency}
                >
                  Carregar selecionada
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="w-24"
                />
              </div>
              <div>
                <Label>Ano</Label>
                <Input
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={() => void loadRuns()} disabled={loading || !month || !year}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar competência'}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhuma competência encontrada para o período informado.</div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => {
                    const isEmitting = emittingId === run.id;
                    const isRegenerating = regeneratingId === run.id;
                    const isBusy = isEmitting || isRegenerating;

                    return (
                      <TableRow key={run.id}>
                        <TableCell>{run.month}/{run.year}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass[run.status]}>
                            {statusLabels[run.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>v{run.version}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => void handleEmitPaystubs(run)}
                              disabled={isBusy}
                            >
                              {isEmitting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Emitindo...
                                </>
                              ) : run.status === 'draft' ? (
                                'Calcular + emitir'
                              ) : (
                                'Emitir holerites'
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleRegeneratePaystubs(run)}
                              disabled={isBusy}
                            >
                              {isRegenerating ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Regerando...
                                </>
                              ) : (
                                'Regerar tudo'
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPaystubBatchPage;

