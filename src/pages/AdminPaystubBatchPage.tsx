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
        title: 'Falha ao carregar competências',
        description: getFriendlyError(error, 'Não foi possível carregar as competências informadas.')
      });
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEmitPaystubs = async (run: PayrollRun) => {
    setEmittingId(run.id);
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
        ? `${result.createdCount} novos e ${result.skippedCount} já existentes.`
        : `${result.createdCount} holerites emitidos.`;

      toast({
        title: 'Emissão concluída',
        description: `Competência ${run.month}/${run.year}: ${summary}`
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
  useEffect(() => {
    void loadRuns();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Emitir Holerites</h1>
            <p className="text-gray-600 mt-1">Escolha a competência e emita em lote com um clique.</p>
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
              Emissão Rápida
            </CardTitle>
            <CardDescription>
              A emissão usa reprocessamento idempotente para evitar duplicidade de holerites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{run.month}/{run.year}</TableCell>
                      <TableCell>
                        <Badge className={statusBadgeClass[run.status]}>
                          {statusLabels[run.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>v{run.version}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => void handleEmitPaystubs(run)}
                          disabled={emittingId === run.id}
                        >
                          {emittingId === run.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Emitindo...
                            </>
                          ) : (
                            run.status === 'draft' ? 'Calcular + emitir' : 'Emitir holerites'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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


