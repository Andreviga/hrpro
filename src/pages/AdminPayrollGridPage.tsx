import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { PayrollGridData, payrollGridApi } from '../services/rubricsApi';
import { payrollApi } from '../services/payrollApi';
import {
  TableProperties,
  Loader2,
  Download,
  Search,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

type SortField = 'fullName' | 'department' | 'grossSalary' | 'totalDeductions' | 'netSalary' | 'fgts' | string;
type SortDir = 'asc' | 'desc';

const AdminPayrollGridPage: React.FC = () => {
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [gridData, setGridData] = useState<PayrollGridData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('fullName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [removingEmployeeId, setRemovingEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    void loadGrid();
  }, [month, year]);

  const loadGrid = async () => {
    try {
      setLoading(true);
      const data = await payrollGridApi.getGrid(month, year);
      setGridData(data);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao carregar dados da folha.' });
      setGridData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!gridData) return [];
    let list = gridData.employees;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.cpf.includes(q) ||
          e.department.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      let va: any;
      let vb: any;
      if (sortField === 'fullName' || sortField === 'department') {
        va = (a as any)[sortField]?.toLowerCase() ?? '';
        vb = (b as any)[sortField]?.toLowerCase() ?? '';
      } else if (['grossSalary', 'totalDeductions', 'netSalary', 'fgts'].includes(sortField)) {
        va = (a as any)[sortField] ?? 0;
        vb = (b as any)[sortField] ?? 0;
      } else {
        va = a.events[sortField] ?? 0;
        vb = b.events[sortField] ?? 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [gridData, search, sortField, sortDir]);

  const totals = useMemo(() => {
    if (!filteredEmployees.length) return null;
    const t = {
      grossSalary: 0,
      totalDeductions: 0,
      netSalary: 0,
      fgts: 0,
      events: {} as Record<string, number>,
    };
    for (const e of filteredEmployees) {
      t.grossSalary += e.grossSalary;
      t.totalDeductions += e.totalDeductions;
      t.netSalary += e.netSalary;
      t.fgts += e.fgts;
      for (const [code, val] of Object.entries(e.events)) {
        t.events[code] = (t.events[code] ?? 0) + val;
      }
    }
    return t;
  }, [filteredEmployees]);

  const rubricColumns = gridData?.rubricColumns ?? [];

  const earningCodes = new Set(['BASE', 'DSR', 'HORA_ATV', 'EXTRA', 'NOTURNO', 'FERIADOS', 'DECIMO_13', 'FERIAS', 'PLR', 'OUTROS']);
  const earningColumns = rubricColumns.filter((c) => earningCodes.has(c));
  const deductionColumns = rubricColumns.filter((c) => !earningCodes.has(c));

  const handleExportCSV = () => {
    if (!gridData || !filteredEmployees.length) return;
    const headers = [
      'Funcionario',
      'CPF',
      'Cargo',
      'Departamento',
      ...rubricColumns,
      'Bruto',
      'Descontos',
      'Liquido',
      'FGTS',
    ];
    const rows = filteredEmployees.map((e) => [
      e.fullName,
      e.cpf,
      e.position,
      e.department,
      ...rubricColumns.map((c) => String(e.events[c] ?? 0)),
      String(e.grossSalary),
      String(e.totalDeductions),
      String(e.netSalary),
      String(e.fgts),
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folha_${String(month).padStart(2, '0')}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemoveFromRun = async (employee: PayrollGridData['employees'][number]) => {
    if (!gridData?.payrollRunId) return;

    if (gridData.status === 'closed') {
      toast({ title: 'Folha fechada', description: 'Reabra a competencia para remover funcionarios.' });
      return;
    }

    const confirmed = window.confirm(
      `Remover ${employee.fullName} da competencia ${String(month).padStart(2, '0')}/${year}?`
    );
    if (!confirmed) return;

    const reason = window.prompt('Motivo da exclusao (opcional):', 'ajuste_manual') ?? undefined;

    try {
      setRemovingEmployeeId(employee.employeeId);
      const response = await payrollApi.removeEmployeeFromRun(gridData.payrollRunId, employee.employeeId, reason);

      if (!response.removed) {
        toast({ title: 'Nada para remover', description: response.message || 'Funcionario nao estava na folha.' });
        return;
      }

      toast({
        title: 'Funcionario removido',
        description:
          employee.fullName +
          ' foi removido da competencia ' +
          String(month).padStart(2, '0') +
          '/' +
          year +
          '.',
      });

      await loadGrid();
    } catch {
      toast({ title: 'Erro', description: 'Nao foi possivel remover o funcionario desta competencia.' });
    } finally {
      setRemovingEmployeeId(null);
    }
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode; className?: string }> = ({
    field,
    children,
    className,
  }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 ${className ?? ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  );

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TableProperties className="h-6 w-6" />
              Visao Macro da Folha
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualizacao tipo planilha com todos os funcionarios e rubricas para conferencia
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label>Mes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label>Ano</Label>
                  <Input
                    type="number"
                    min={2020}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-24"
                  />
                </div>
                {gridData?.status && (
                  <Badge variant={gridData.status === 'closed' ? 'default' : gridData.status === 'calculated' ? 'secondary' : 'outline'}>
                    {gridData.status === 'closed' ? 'Fechada' : gridData.status === 'calculated' ? 'Calculada' : 'Rascunho'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar funcionario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Button variant="outline" onClick={handleExportCSV} disabled={!filteredEmployees.length}>
                  <Download className="h-4 w-4 mr-1" /> Exportar CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !gridData || !gridData.payrollRunId ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">Nenhuma folha encontrada para {String(month).padStart(2, '0')}/{year}</p>
                <p className="text-sm mt-1">Abra e calcule uma competencia na tela de Competencias.</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhum resultado encontrado para a busca.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <SortableHeader field="fullName" className="sticky left-0 bg-background z-10 min-w-48">
                        Funcionario
                      </SortableHeader>
                      <SortableHeader field="department" className="min-w-28">
                        Depto
                      </SortableHeader>
                      {earningColumns.map((code) => (
                        <SortableHeader key={code} field={code} className="min-w-28 text-right">
                          <span className="text-green-600">{code}</span>
                        </SortableHeader>
                      ))}
                      <SortableHeader field="grossSalary" className="min-w-32 text-right font-bold">
                        BRUTO
                      </SortableHeader>
                      {deductionColumns.map((code) => (
                        <SortableHeader key={code} field={code} className="min-w-28 text-right">
                          <span className="text-red-500">{code}</span>
                        </SortableHeader>
                      ))}
                      <SortableHeader field="totalDeductions" className="min-w-32 text-right font-bold">
                        DESCONTOS
                      </SortableHeader>
                      <SortableHeader field="netSalary" className="min-w-32 text-right font-bold">
                        LIQUIDO
                      </SortableHeader>
                      <SortableHeader field="fgts" className="min-w-28 text-right">
                        FGTS
                      </SortableHeader>
                      <TableHead className="min-w-28 text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp) => (
                      <TableRow key={emp.employeeId} className="hover:bg-muted/20">
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          <div>{emp.fullName}</div>
                          <div className="text-xs text-muted-foreground">{emp.position}</div>
                        </TableCell>
                        <TableCell className="text-sm">{emp.department}</TableCell>
                        {earningColumns.map((code) => (
                          <TableCell key={code} className="text-right text-sm font-mono tabular-nums">
                            {emp.events[code] ? formatCurrency(emp.events[code]) : '--'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold text-green-700 font-mono tabular-nums">
                          {formatCurrency(emp.grossSalary)}
                        </TableCell>
                        {deductionColumns.map((code) => (
                          <TableCell key={code} className="text-right text-sm font-mono tabular-nums text-red-600">
                            {emp.events[code] ? formatCurrency(emp.events[code]) : '--'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold text-red-600 font-mono tabular-nums">
                          {formatCurrency(emp.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700 font-mono tabular-nums">
                          {formatCurrency(emp.netSalary)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-mono tabular-nums">
                          {formatCurrency(emp.fgts)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemoveFromRun(emp)}
                            disabled={removingEmployeeId === emp.employeeId || gridData?.status === 'closed'}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            {removingEmployeeId === emp.employeeId ? 'Removendo...' : 'Excluir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {totals && (
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell className="sticky left-0 bg-muted/50 z-10">
                          TOTAL ({filteredEmployees.length} funcionario{filteredEmployees.length !== 1 ? 's' : ''})
                        </TableCell>
                        <TableCell></TableCell>
                        {earningColumns.map((code) => (
                          <TableCell key={code} className="text-right font-mono tabular-nums">
                            {totals.events[code] ? formatCurrency(totals.events[code]) : '--'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-green-700 font-mono tabular-nums">
                          {formatCurrency(totals.grossSalary)}
                        </TableCell>
                        {deductionColumns.map((code) => (
                          <TableCell key={code} className="text-right font-mono tabular-nums text-red-600">
                            {totals.events[code] ? formatCurrency(totals.events[code]) : '--'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-red-600 font-mono tabular-nums">
                          {formatCurrency(totals.totalDeductions)}
                        </TableCell>
                        <TableCell className="text-right text-blue-700 font-mono tabular-nums">
                          {formatCurrency(totals.netSalary)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(totals.fgts)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
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

export default AdminPayrollGridPage;
