/**
 * Página para mostrar detalhes completos do holerite.
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import Layout from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';
import { apiService, PaystubDetail } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Loader2,
  FileText,
  Pencil,
  Save,
  Calculator
} from 'lucide-react';

const parseAmountInput = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
};

const getFriendlyError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return String(parsed.message);
    } catch {
      return error.message || fallback;
    }
  }
  return fallback;
};

const formatDateValue = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('pt-BR');
};

const buildRubricRows = (paystub: PaystubDetail) => {
  const earnings = paystub.payslip?.earnings ?? [];
  const deductions = paystub.payslip?.deductions ?? [];
  const size = Math.max(earnings.length, deductions.length, 1);

  return Array.from({ length: size }, (_, index) => ({
    earning: earnings[index] ?? null,
    deduction: deductions[index] ?? null
  }));
};

const sumClassQuantity = (paystub: PaystubDetail) => {
  const classRows = paystub.payslip?.classComposition ?? [];
  const totalFromRows = classRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  if (totalFromRows > 0) return totalFromRows;
  return Number(paystub.payslip?.totalClassQuantity ?? 0);
};

const buildFreeEditPayload = (paystub: PaystubDetail) => {
  const payslip = paystub.payslip;

  return {
    companyProfile: {
      name: payslip?.companyName ?? paystub.company?.name ?? '',
      cnpj: payslip?.companyCnpj ?? paystub.company?.cnpj ?? '',
      address: payslip?.companyAddress ?? '',
      logoUrl: payslip?.companyLogoUrl ?? ''
    },
    employee: {
      fullName: payslip?.employeeName ?? paystub.employee?.fullName ?? '',
      cpf: payslip?.employeeCpf ?? paystub.employee?.cpf ?? '',
      position: payslip?.employeeRole ?? paystub.employee?.position ?? '',
      admissionDate: payslip?.admissionDate ?? '',
      email: payslip?.employeeEmail ?? paystub.employee?.email ?? '',
      bankName: payslip?.bank ?? paystub.employee?.bankName ?? '',
      bankAgency: payslip?.agency ?? paystub.employee?.bankAgency ?? '',
      bankAccount: payslip?.account ?? paystub.employee?.bankAccount ?? '',
      paymentMethod: payslip?.paymentMethod ?? paystub.employee?.paymentMethod ?? '',
      employeeCode: payslip?.employeeCode ?? paystub.employee?.employeeCode ?? '',
      pis: paystub.employee?.pis ?? '',
      weeklyHours: paystub.employee?.weeklyHours ?? 0,
      transportVoucherValue: paystub.employee?.transportVoucherValue ?? 0
    },
    payslipOverride: {
      title: payslip?.title,
      referenceMonth: payslip?.referenceMonth,
      companyName: payslip?.companyName,
      companyCnpj: payslip?.companyCnpj,
      companyAddress: payslip?.companyAddress,
      companyLogoUrl: payslip?.companyLogoUrl,
      employeeName: payslip?.employeeName,
      employeeCpf: payslip?.employeeCpf,
      employeeCode: payslip?.employeeCode,
      employeeRole: payslip?.employeeRole,
      admissionDate: payslip?.admissionDate,
      employeeEmail: payslip?.employeeEmail,
      bank: payslip?.bank,
      agency: payslip?.agency,
      account: payslip?.account,
      paymentMethod: payslip?.paymentMethod,
      classComposition: payslip?.classComposition ?? [],
      earnings: payslip?.earnings ?? [],
      deductions: payslip?.deductions ?? [],
      grossSalary: payslip?.grossSalary ?? paystub.summary.grossSalary,
      totalDiscounts: payslip?.totalDiscounts ?? paystub.summary.totalDeductions,
      netSalary: payslip?.netSalary ?? paystub.summary.netSalary,
      fgts: payslip?.fgts ?? paystub.summary.fgtsDeposit,
      inssBase: payslip?.inssBase ?? paystub.bases?.inssBase,
      fgtsBase: payslip?.fgtsBase ?? paystub.bases?.fgtsBase,
      irrfBase: payslip?.irrfBase ?? paystub.bases?.irrfBase,
      foodAllowance: payslip?.foodAllowance,
      alimony: payslip?.alimony,
      thirteenthSecondInstallment: payslip?.thirteenthSecondInstallment,
      thirteenthInss: payslip?.thirteenthInss,
      thirteenthIrrf: payslip?.thirteenthIrrf,
      calculationBase: payslip?.calculationBase,
      totalClassQuantity: payslip?.totalClassQuantity,
      classUnitValue: payslip?.classUnitValue,
      pix: payslip?.pix
    },
    reason: 'edicao_livre_holerite'
  };
};

const PaystubDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [paystub, setPaystub] = useState<PaystubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [freeEditJson, setFreeEditJson] = useState('');
  const [savingFreeEdit, setSavingFreeEdit] = useState(false);
  const [transportForm, setTransportForm] = useState({
    farePerTrip: 5,
    tripsPerDay: 2,
    workDays: 22
  });
  const [savingTransport, setSavingTransport] = useState(false);

  const canEdit = ['admin', 'rh', 'manager'].includes(user?.role ?? '');

  useEffect(() => {
    if (id) {
      void loadPaystubDetail(id);
    }
  }, [id]);

  useEffect(() => {
    if (!paystub) return;

    setFreeEditJson(JSON.stringify(buildFreeEditPayload(paystub), null, 2));

    const classQuantity = sumClassQuantity(paystub);
    const weeklyHours = Number(paystub.employee?.weeklyHours ?? 0);
    const estimatedWorkDays =
      weeklyHours > 0 && classQuantity > 0
        ? Math.max(1, Math.round((classQuantity / weeklyHours) * 5))
        : 22;

    setTransportForm({
      farePerTrip: 5,
      tripsPerDay: 2,
      workDays: estimatedWorkDays
    });
  }, [paystub]);

  const loadPaystubDetail = async (paystubId: string) => {
    try {
      setLoading(true);
      const data = await apiService.getPaystubDetail(paystubId);
      if (data) {
        setPaystub(data);
        setError('');
      } else {
        setError('Holerite não encontrado.');
      }
    } catch {
      setError('Erro ao carregar detalhes do holerite.');
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

  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[month - 1]} ${year}`;
  };

  const handleBack = () => {
    window.location.href = '#/paystubs';
  };

  const handleDownload = async () => {
    if (!paystub) return;

    try {
      await apiService.openPaystubPdf(paystub.id);
    } catch (downloadError: unknown) {
      const err = downloadError as { isValidationError?: boolean; missingFields?: string[]; message?: string };
      if (err.isValidationError && err.missingFields && err.missingFields.length > 0) {
        toast({
          title: 'Holerite com dados incompletos',
          description: `Campos ausentes: ${err.missingFields.join(', ')}. Voce pode ajustar na edicao livre e tentar novamente.`
        });
      } else {
        toast({
          title: 'Falha ao baixar PDF',
          description: getFriendlyError(downloadError, 'Não foi possível abrir o PDF deste holerite.')
        });
      }
    }
  };

  const handleEditEvent = async (eventItem: NonNullable<PaystubDetail['events']>[number]) => {
    if (!paystub || !canEdit) return;

    const amountInput = window.prompt(
      `Novo valor para ${eventItem.code} (${eventItem.description})`,
      eventItem.amount.toFixed(2).replace('.', ',')
    );

    if (amountInput === null) return;

    const parsedAmount = parseAmountInput(amountInput);
    if (parsedAmount === null) {
      toast({
        title: 'Valor inválido',
        description: 'Informe um valor numérico maior ou igual a zero.'
      });
      return;
    }

    const descriptionInput = window.prompt('Nova descrição (opcional)', eventItem.description);
    if (descriptionInput === null) return;

    try {
      setUpdatingEventId(eventItem.id);
      await apiService.updatePaystubEvent(paystub.id, eventItem.id, {
        amount: parsedAmount,
        description: descriptionInput,
        reason: 'ajuste_manual_holerite'
      });

      await loadPaystubDetail(paystub.id);
      toast({
        title: 'Holerite atualizado',
        description: `${eventItem.code} ajustado com sucesso.`
      });
    } catch (updateError) {
      toast({
        title: 'Falha ao atualizar',
        description: getFriendlyError(updateError, 'Não foi possível editar o evento deste holerite.')
      });
    } finally {
      setUpdatingEventId(null);
    }
  };

  const handleSaveFreeEdit = async () => {
    if (!paystub || !canEdit) return;

    let payload: unknown;
    try {
      payload = JSON.parse(freeEditJson);
    } catch {
      toast({
        title: 'JSON inválido',
        description: 'Revise a estrutura antes de salvar as alterações.'
      });
      return;
    }

    try {
      setSavingFreeEdit(true);
      await apiService.updatePaystubContent(paystub.id, payload as any);
      await loadPaystubDetail(paystub.id);
      toast({
        title: 'Holerite atualizado',
        description: 'As alterações livres foram salvas com sucesso.'
      });
    } catch (saveError) {
      toast({
        title: 'Falha ao salvar edição livre',
        description: getFriendlyError(saveError, 'Não foi possível salvar os campos do holerite.')
      });
    } finally {
      setSavingFreeEdit(false);
    }
  };

  const handleApplyTransportValue = async () => {
    if (!paystub || !canEdit) return;

    const grossSalary = Number(paystub.payslip?.grossSalary ?? paystub.summary.grossSalary ?? 0);
    const grossVoucher = Math.max(0, transportForm.farePerTrip * transportForm.tripsPerDay * transportForm.workDays);
    const legalDiscountLimit = grossSalary * 0.06;
    const suggestedDiscount = Math.min(grossVoucher, legalDiscountLimit);

    try {
      setSavingTransport(true);
      await apiService.updatePaystubContent(paystub.id, {
        employee: {
          transportVoucherValue: Number(grossVoucher.toFixed(2))
        },
        payslipOverride: {
          totalDiscounts: Number(
            (
              Number(paystub.payslip?.totalDiscounts ?? paystub.summary.totalDeductions ?? 0)
              - Number(paystub.deductions.transportVoucherDeduction ?? 0)
              + suggestedDiscount
            ).toFixed(2)
          )
        },
        reason: 'simulador_vale_transporte'
      });

      await loadPaystubDetail(paystub.id);
      toast({
        title: 'Vale-transporte aplicado',
        description: 'Valor mensal do vale-transporte salvo no cadastro do Funcionário.'
      });
    } catch (saveError) {
      toast({
        title: 'Falha ao aplicar vale-transporte',
        description: getFriendlyError(saveError, 'Não foi possível salvar o vale-transporte.')
      });
    } finally {
      setSavingTransport(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando detalhes...</span>
        </div>
      </Layout>
    );
  }

  if (error || !paystub) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Erro ao carregar</h3>
          <p className="text-gray-600 mb-4">{error || 'Holerite não encontrado.'}</p>
          <Button onClick={handleBack}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  const payslip = paystub.payslip;
  const rubricRows = buildRubricRows(paystub);
  const classQuantity = sumClassQuantity(paystub);
  const weeklyHours = Number(paystub.employee?.weeklyHours ?? 0);
  const grossSalaryForTransport = Number(payslip?.grossSalary ?? paystub.summary.grossSalary ?? 0);
  const transportGrossValue = Math.max(0, transportForm.farePerTrip * transportForm.tripsPerDay * transportForm.workDays);
  const legalTransportLimit = grossSalaryForTransport * 0.06;
  const suggestedPayrollDiscount = Math.min(transportGrossValue, legalTransportLimit);
  const suggestedCompanyCredit = Math.max(0, transportGrossValue - suggestedPayrollDiscount);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Holerite - {formatMonthYear(paystub.month, paystub.year)}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Referência: {paystub.month}/{paystub.year}</span>
                {canEdit && <Badge variant="secondary">Edição liberada</Badge>}
              </div>
            </div>
          </div>
          <Button onClick={() => void handleDownload()}>
            <Download className="h-4 w-4 mr-2" />
            Baixar PDF
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Documento do Holerite</span>
              <div className="flex items-center gap-2">
                {paystub.document?.status ? <Badge variant="outline">{paystub.document.status}</Badge> : null}
                {canEdit ? <Badge variant="secondary">Edição liberada</Badge> : null}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div>
              <p className="text-gray-500">Título</p>
              <p className="font-medium text-gray-900">{paystub.document?.title ?? payslip?.title ?? 'Holerite fixo'}</p>
            </div>
            <div>
              <p className="text-gray-500">Empresa</p>
              <p className="font-medium text-gray-900">{payslip?.companyName ?? paystub.company?.name ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">CNPJ</p>
              <p className="font-medium text-gray-900">{payslip?.companyCnpj ?? paystub.company?.cnpj ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Última atualização</p>
              <p className="font-medium text-gray-900">{formatDateValue(paystub.document?.updatedAt)}</p>
            </div>
            <div>
              <p className="text-gray-500">Referência da planilha</p>
              <p className="font-medium text-gray-900">{payslip?.referenceMonth ?? `${paystub.month}/${paystub.year}`}</p>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <p className="text-gray-500">Endereço</p>
              <p className="font-medium text-gray-900">{payslip?.companyAddress ?? '-'}</p>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <p className="text-gray-500">Logotipo da empresa</p>
              {payslip?.companyLogoUrl ? (
                <div className="mt-2 rounded-md border p-3 inline-flex bg-white">
                  <img
                    src={payslip.companyLogoUrl}
                    alt="Logo da empresa"
                    className="max-h-16 max-w-56 object-contain"
                  />
                </div>
              ) : (
                <p className="font-medium text-gray-900">Não informado</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Salário Bruto</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(paystub.summary.grossSalary)}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Total Descontos</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(paystub.summary.totalDeductions)}
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded-full">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Salário Líquido</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(paystub.summary.netSalary)}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Funcionário</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div>
              <p className="text-gray-500">Código</p>
              <p className="font-medium text-gray-900">{payslip?.employeeCode ?? paystub.employee?.employeeCode ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Nome</p>
              <p className="font-medium text-gray-900">{payslip?.employeeName ?? paystub.employee?.fullName ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Cargo</p>
              <p className="font-medium text-gray-900">{payslip?.employeeRole ?? paystub.employee?.position ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Competência</p>
              <p className="font-medium text-gray-900">{formatMonthYear(paystub.month, paystub.year)}</p>
            </div>
            <div>
              <p className="text-gray-500">CPF</p>
              <p className="font-medium text-gray-900">{payslip?.employeeCpf ?? paystub.employee?.cpf ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Admissão</p>
              <p className="font-medium text-gray-900">{payslip?.admissionDate ?? formatDateValue(paystub.employee?.admissionDate)}</p>
            </div>
            <div>
              <p className="text-gray-500">E-mail</p>
              <p className="font-medium text-gray-900 break-all">{payslip?.employeeEmail ?? paystub.employee?.email ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Forma de pagamento</p>
              <p className="font-medium text-gray-900">{payslip?.paymentMethod ?? paystub.employee?.paymentMethod ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Banco</p>
              <p className="font-medium text-gray-900">{payslip?.bank ?? paystub.employee?.bankName ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Agência</p>
              <p className="font-medium text-gray-900">{payslip?.agency ?? paystub.employee?.bankAgency ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Conta</p>
              <p className="font-medium text-gray-900">{payslip?.account ?? paystub.employee?.bankAccount ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">PIX</p>
              <p className="font-medium text-gray-900 break-all">{payslip?.pix ?? '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">PIS</p>
              <p className="font-medium text-gray-900">{paystub.employee?.pis ?? '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição de Aulas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3 text-right">Quantidade</th>
                    <th className="py-2 pr-3 text-right">Valor aula / unitário</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(payslip?.classComposition ?? []).map((row) => (
                    <tr key={row.code} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-medium text-gray-900">{row.code}</td>
                      <td className="py-3 pr-3 text-gray-700">{row.description}</td>
                      <td className="py-3 pr-3 text-right text-gray-700">{row.quantity.toFixed(2)}</td>
                      <td className="py-3 pr-3 text-right text-gray-700">{formatCurrency(row.unitValue)}</td>
                      <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(row.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-700" />
              Simulador de Vale-Transporte (folha + carga de aulas)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border p-3">
                <p className="text-gray-500">Carga de aulas (planilha)</p>
                <p className="text-xl font-semibold text-gray-900">{classQuantity.toFixed(2)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-gray-500">Carga semanal do funcionário</p>
                <p className="text-xl font-semibold text-gray-900">{weeklyHours > 0 ? weeklyHours.toFixed(2) : '-'}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-gray-500">Salário bruto da competência</p>
                <p className="text-xl font-semibold text-gray-900">{formatCurrency(grossSalaryForTransport)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 mb-1">Tarifa por viagem (R$)</p>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-md border px-3 py-2"
                  value={transportForm.farePerTrip}
                  onChange={(e) =>
                    setTransportForm((current) => ({
                      ...current,
                      farePerTrip: Number(e.target.value) || 0
                    }))
                  }
                />
              </div>
              <div>
                <p className="text-gray-500 mb-1">Viagens por dia</p>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="w-full rounded-md border px-3 py-2"
                  value={transportForm.tripsPerDay}
                  onChange={(e) =>
                    setTransportForm((current) => ({
                      ...current,
                      tripsPerDay: Number(e.target.value) || 0
                    }))
                  }
                />
              </div>
              <div>
                <p className="text-gray-500 mb-1">Dias úteis</p>
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="w-full rounded-md border px-3 py-2"
                  value={transportForm.workDays}
                  onChange={(e) =>
                    setTransportForm((current) => ({
                      ...current,
                      workDays: Number(e.target.value) || 0
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-blue-700">Custo mensal calculado</p>
                <p className="text-lg font-semibold text-blue-800">{formatCurrency(transportGrossValue)}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-700">Limite legal (6%)</p>
                <p className="text-lg font-semibold text-amber-800">{formatCurrency(legalTransportLimit)}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-emerald-700">Complemento estimado da empresa</p>
                <p className="text-lg font-semibold text-emerald-800">{formatCurrency(suggestedCompanyCredit)}</p>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-gray-700">
                Desconto sugerido em folha: <strong>{formatCurrency(suggestedPayrollDiscount)}</strong>
              </p>
            </div>

            {canEdit ? (
              <Button onClick={() => void handleApplyTransportValue()} disabled={savingTransport}>
                {savingTransport ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Aplicar valor no cadastro do funcionário
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rubricas do Holerite</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3 text-right">Provento</th>
                    <th className="py-2 text-right">Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {rubricRows.map((row, index) => (
                    <tr key={`${row.earning?.code ?? row.deduction?.code ?? 'row'}-${index}`} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-medium text-gray-900">{row.earning?.code ?? row.deduction?.code ?? '-'}</td>
                      <td className="py-3 pr-3 text-gray-700">{row.earning?.description ?? row.deduction?.description ?? '-'}</td>
                      <td className="py-3 pr-3 text-right text-green-700">{row.earning ? formatCurrency(row.earning.amount) : '-'}</td>
                      <td className="py-3 text-right text-red-700">{row.deduction ? formatCurrency(row.deduction.amount) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {paystub.events && paystub.events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Eventos do Holerite</span>
                {canEdit ? (
                  <Badge variant="outline">Clique em editar para ajustar rubrica</Badge>
                ) : (
                  <Badge variant="secondary">Somente leitura</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paystub.events.map((eventItem) => (
                <div key={eventItem.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <p className="font-medium text-gray-900">{eventItem.code} - {eventItem.description}</p>
                    <p className="text-sm text-gray-500">
                      Tipo: {eventItem.type === 'earning' ? 'Provento' : 'Desconto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={eventItem.type === 'earning' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                      {eventItem.type === 'earning' ? '+' : '-'} {formatCurrency(eventItem.amount)}
                    </span>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleEditEvent(eventItem)}
                        disabled={updatingEventId === eventItem.id}
                      >
                        {updatingEventId === eventItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle>Edição livre do holerite (todos os campos)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Edite o JSON abaixo para ajustar quaisquer campos do holerite, empresa, logo e dados do funcionário.
              </p>
              <Textarea
                value={freeEditJson}
                onChange={(e) => setFreeEditJson(e.target.value)}
                className="min-h-[320px] font-mono text-xs"
              />
              <Button onClick={() => void handleSaveFreeEdit()} disabled={savingFreeEdit}>
                {savingFreeEdit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar edição livre
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">Bases e Totais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Salário Bruto</span>
                <span className="font-semibold text-green-700">{formatCurrency(payslip?.grossSalary ?? paystub.summary.grossSalary)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Total Descontos</span>
                <span className="font-semibold text-red-700">{formatCurrency(payslip?.totalDiscounts ?? paystub.summary.totalDeductions)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Salário Líquido</span>
                <span className="font-semibold text-blue-700">{formatCurrency(payslip?.netSalary ?? paystub.summary.netSalary)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">FGTS</span>
                <span className="font-semibold">{formatCurrency(payslip?.fgts ?? paystub.summary.fgtsDeposit)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Base INSS</span>
                <span className="font-semibold">{formatCurrency(payslip?.inssBase ?? paystub.bases?.inssBase ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Base FGTS</span>
                <span className="font-semibold">{formatCurrency(payslip?.fgtsBase ?? paystub.bases?.fgtsBase ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Base IRRF</span>
                <span className="font-semibold">{formatCurrency(payslip?.irrfBase ?? paystub.bases?.irrfBase ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Base de Cálculo</span>
                <span className="font-semibold">{formatCurrency(payslip?.calculationBase ?? paystub.summary.grossSalary)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Qtd. total de aulas</span>
                <span className="font-semibold">{typeof payslip?.totalClassQuantity === 'number' ? payslip.totalClassQuantity.toFixed(2) : '-'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Valor unitário aula</span>
                <span className="font-semibold">{typeof payslip?.classUnitValue === 'number' ? formatCurrency(payslip.classUnitValue) : '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">Informações Complementares</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Vale Alimentação</span>
                <span className="font-semibold">{formatCurrency(payslip?.foodAllowance ?? paystub.earnings.mealVoucherCredit ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Pensão Alimentícia</span>
                <span className="font-semibold text-red-700">{formatCurrency(payslip?.alimony ?? paystub.deductions.pensionAlimony ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">2ª Parcela 13º</span>
                <span className="font-semibold">{formatCurrency(payslip?.thirteenthSecondInstallment ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">INSS 13º</span>
                <span className="font-semibold text-red-700">{formatCurrency(payslip?.thirteenthInss ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">IRRF 13º</span>
                <span className="font-semibold text-red-700">{formatCurrency(payslip?.thirteenthIrrf ?? 0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Dependentes</span>
                <span className="font-semibold">{paystub.employee?.dependents ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Tipo salarial</span>
                <span className="font-semibold">{paystub.employee?.salaryType ?? '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {payslip?.sourceWarnings && payslip.sourceWarnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Alertas da Planilha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {payslip.sourceWarnings.map((warning) => (
                <div key={`${warning.code}-${warning.sourceCell ?? warning.sourceTable ?? warning.message}`} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium text-amber-900">{warning.code}</p>
                  <p className="text-amber-800">{warning.message}</p>
                  <p className="text-amber-700">
                    {warning.fillLocation ?? warning.sourceSheet ?? 'Origem não informada'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700">
                <TrendingUp className="h-5 w-5" />
                <span>Resumo de Proventos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Salário Base', value: paystub.earnings.baseSalary },
                { label: 'Horas Extras', value: paystub.earnings.overtimeValue },
                { label: 'Adicional Noturno', value: paystub.earnings.nightShiftBonus },
                { label: 'Adicional de Feriados', value: paystub.earnings.holidaysBonus },
                { label: 'Vale Alimentação', value: paystub.earnings.mealVoucherCredit ?? 0 },
                { label: 'Outros Bônus', value: paystub.earnings.otherBonuses }
              ].filter((item) => item.value > 0).map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-semibold text-green-600">
                    + {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center py-2 bg-green-50 px-3 rounded">
                <span className="font-semibold text-green-800">Total Bruto</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(paystub.summary.grossSalary)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <TrendingDown className="h-5 w-5" />
                <span>Resumo de Descontos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'INSS', value: paystub.deductions.inssDeduction },
                { label: 'IRRF', value: paystub.deductions.irrfDeduction },
                { label: 'Vale Transporte', value: paystub.deductions.transportVoucherDeduction },
                { label: 'Vale Refeição', value: paystub.deductions.mealVoucherDeduction },
                { label: 'Pensão Alimentícia', value: paystub.deductions.pensionAlimony ?? 0 },
                { label: 'Taxa Sindical', value: paystub.deductions.syndicateFee },
                { label: 'Outros Descontos', value: paystub.deductions.otherDeductions }
              ].filter((item) => item.value > 0).map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2">
                  <span className="text-gray-700">{item.label}</span>
                  <span className="font-semibold text-red-600">
                    - {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between items-center py-2 bg-red-50 px-3 rounded">
                <span className="font-semibold text-red-800">Total Descontos</span>
                <span className="font-bold text-red-600">
                  - {formatCurrency(paystub.summary.totalDeductions)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
};

export default PaystubDetailPage;

