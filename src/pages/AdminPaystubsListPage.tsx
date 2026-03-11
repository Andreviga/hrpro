import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Loader2, FileText, Download, Eye, RefreshCcw, Search } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { apiService, PaystubSummary } from '../services/api';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const AdminPaystubsListPage: React.FC = () => {
  const { toast } = useToast();
  const now = new Date();

  const [month, setMonth] = useState('');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [employeeName, setEmployeeName] = useState('');
  const [paystubs, setPaystubs] = useState<PaystubSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPaystubsAdmin({
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        employeeName: employeeName.trim() || undefined
      });
      setPaystubs(data);
      setSearched(true);
    } catch (error) {
      toast({
        title: 'Falha ao buscar holerites',
        description: error instanceof Error ? error.message : 'Não foi possível carregar os holerites.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (paystub: PaystubSummary) => {
    if (!paystub.filePath) {
      toast({ title: 'PDF não disponível', description: 'Este holerite ainda não possui PDF gerado.' });
      return;
    }
    try {
      await apiService.openPaystubPdf(paystub.id);
    } catch (err: unknown) {
      const e = err as { isValidationError?: boolean; missingFields?: string[] };
      if (e.isValidationError && e.missingFields?.length) {
        toast({
          title: 'Holerite com dados incompletos',
          description: `Campos ausentes: ${e.missingFields.join(', ')}.`
        });
      } else {
        toast({
          title: 'Falha ao baixar PDF',
          description: err instanceof Error ? err.message : 'Não foi possível baixar o PDF.'
        });
      }
    }
  };

  const handleView = (id: string) => {
    window.location.href = `#/paystubs/${id}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Todos os Holerites</h1>
            <p className="text-gray-600 mt-1">Consulte e baixe holerites de todos os funcionários.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filtros de busca
            </CardTitle>
            <CardDescription>Filtre por competência e/ou nome do funcionário.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label>Mês</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="Todos"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
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
                  onChange={(e) => setYear(e.target.value)}
                  className="w-32"
                />
              </div>
              <div>
                <Label>Funcionário</Label>
                <Input
                  type="text"
                  placeholder="Nome (parcial)"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-52"
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                />
              </div>
              <Button onClick={() => void handleSearch()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
              {searched && (
                <Button
                  variant="outline"
                  onClick={() => void handleSearch()}
                  disabled={loading}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {searched && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resultados
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({paystubs.length} holerite{paystubs.length !== 1 ? 's' : ''})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Carregando...
                </div>
              ) : paystubs.length === 0 ? (
                <div className="text-sm text-gray-500 py-6 text-center">
                  Nenhum holerite encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paystubs.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.employeeName ?? '—'}
                          </TableCell>
                          <TableCell>
                            {String(p.month).padStart(2, '0')}/{p.year}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(p.netSalary)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleView(p.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              {p.filePath && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleDownload(p)}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default AdminPaystubsListPage;
