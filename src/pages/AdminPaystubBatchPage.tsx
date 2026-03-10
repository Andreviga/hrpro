import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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
        title: 'Falha ao carregar competencias',
        description: getFriendlyError(error, 'Nao foi possivel carregar as competencias informadas.')
      });
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const ensureCalculated = async (run: PayrollRun) => {
    if (run.status !== 'draft') return run.status;

    toast({
      title: 'Calculando folha',
      description: `Competencia ${run.month}/${run.year} em processamento antes da emissao.`
    });

    const calculatedRun = await payrollApi.calculatePayrollRun(run.id);
    if (calculatedRun.status === 'draft') {
      throw new Error('A folha permanece em rascunho apos tentativa de calculo.');
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
        ? `${result.createdCount} novos e ${result.skippedCount} ja existentes.`
        : `${result.createdCount} holerites emitidos.`;

      toast({
        title: 'Emissao concluida',
        description: `Competencia ${run.month}/${run.year}: ${summary}`
      });

      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao emitir holerites',
        description: getFriendlyError(error, 'Nao foi possivel emitir os holerites da competencia.')
      });
    } finally {
      setEmittingId(null);
    }
  };

  const handleRegeneratePaystubs = async (run: PayrollRun) => {
    const confirmed = window.confirm(
      `Regerar todos os holerites da competencia ${run.month}/${run.year}?\n\nOs holerites atuais serao desativados e novos arquivos serao criados.`
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
        title: 'Regeracao concluida',
        description: `Competencia ${run.month}/${run.year}: ${result.createdCount} novos, ${regenerated} anteriores desativados.`
      });

      await loadRuns();
    } catch (error) {
      toast({
        title: 'Falha ao regerar holerites',
        description: getFriendlyError(error, 'Nao foi possivel regerar os holerites desta competencia.')
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Emitir Holerites</h1>
            <p className="text-gray-600 mt-1">Escolha a competencia e emita ou regera com um clique.</p>
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
              Emissao Rapida
            </CardTitle>
            <CardDescription>
              Emissao padrao evita duplicidade. Regerar substitui os holerites existentes da competencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Mes</Label>
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
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar competencia'}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : runs.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhuma competencia encontrada para o periodo informado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competencia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Versao</TableHead>
                    <TableHead>Acoes</TableHead>
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
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPaystubBatchPage;
