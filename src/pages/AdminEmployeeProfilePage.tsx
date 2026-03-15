/**
 * AdminEmployeeProfilePage — Perfil completo do funcionário para o admin
 * Exibe e permite editar: dados pessoais, vínculo, folha mensal, histórico salarial,
 * benefícios/descontos, documentos e tickets.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User,
  Briefcase,
  DollarSign,
  TrendingUp,
  Gift,
  FileText,
  MessageSquare,
  Edit,
  Save,
  X,
  Plus,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useToast } from '../hooks/use-toast';
import { employeeApi, Employee } from '../services/employeeApi';
import { apiService } from '../services/api';
import { documentsApi, Document as HRDocument } from '../services/documentsApi';
import { supportApi, Ticket } from '../services/supportApi';
import { request } from '../services/http';
import Layout from '../components/Layout';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCurrency = (v?: number | null) => (v != null ? fmt.format(v) : '—');
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
};
const formatCPF = (v: string) =>
  v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
const formatPhone = (v: string) =>
  v.replace(/\D/g, '').replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active:           { label: 'Ativo',      cls: 'bg-green-100 text-green-800' },
    inactive:         { label: 'Inativo',    cls: 'bg-gray-100 text-gray-800' },
    pending_approval: { label: 'Pendente',   cls: 'bg-yellow-100 text-yellow-800' },
    dismissed:        { label: 'Demitido',   cls: 'bg-red-100 text-red-800' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

const ApprovalBadge = ({ status }: { status?: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Pendente',  cls: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Aprovado',  cls: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rejeitado', cls: 'bg-red-100 text-red-800' },
    draft:    { label: 'Rascunho',  cls: 'bg-gray-100 text-gray-600' },
  };
  const s = map[status ?? ''] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
};

const docTypeLabel: Record<string, string> = {
  trct:           'TRCT',
  termo_quitacao: 'Termo de Quitação',
  aviso_previo:   'Aviso Prévio',
  recibo_ferias:  'Recibo de Férias',
  aviso_ferias:   'Aviso de Férias',
  holerite:       'Holerite',
  recibo_13:      'Recibo 13°',
  recibo_plr:     'Recibo PLR',
  outros:         'Outros',
};

const ticketStatusLabel: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Aberto',      cls: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'Em Andamento',cls: 'bg-yellow-100 text-yellow-800' },
  resolved:    { label: 'Resolvido',   cls: 'bg-green-100 text-green-800' },
  closed:      { label: 'Fechado',     cls: 'bg-gray-100 text-gray-700' },
};

const benefitTypeLabel: Record<string, string> = {
  transport: 'Vale-Transporte',
  meal:      'Vale-Alimentação',
  other:     'Outro',
};

// ─── Tab definitions ─────────────────────────────────────────────────────────

type TabId = 'pessoal' | 'vinculo' | 'folha' | 'historico' | 'beneficios' | 'documentos' | 'tickets';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'pessoal',    label: 'Dados Pessoais',       icon: <User className="h-4 w-4" /> },
  { id: 'vinculo',    label: 'Vínculo / Cargo',       icon: <Briefcase className="h-4 w-4" /> },
  { id: 'folha',      label: 'Folha de Pagamento',    icon: <DollarSign className="h-4 w-4" /> },
  { id: 'historico',  label: 'Histórico Salarial',    icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'beneficios', label: 'Benefícios / Descontos',icon: <Gift className="h-4 w-4" /> },
  { id: 'documentos', label: 'Documentos',             icon: <FileText className="h-4 w-4" /> },
  { id: 'tickets',    label: 'Tickets / Suporte',     icon: <MessageSquare className="h-4 w-4" /> },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminEmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('pessoal');
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  // secondary data
  const [paystubs, setPaystubs] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [documents, setDocuments] = useState<HRDocument[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // loading states
  const [loadingPaystubs, setLoadingPaystubs] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [loadingBenefits, setLoadingBenefits] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);

  // folha filter
  const [folhaMonth, setFolhaMonth] = useState(new Date().getMonth() + 1);
  const [folhaYear, setFolhaYear] = useState(new Date().getFullYear());

  // salary history form
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [salaryFormData, setSalaryFormData] = useState({ baseSalary: '', reason: '', effectiveFrom: '' });
  const [savingSalary, setSavingSalary] = useState(false);

  // benefit form
  const [showBenefitForm, setShowBenefitForm] = useState(false);
  const [benefitFormData, setBenefitFormData] = useState({ type: 'transport', amount: '', reason: '', effectiveFrom: '' });
  const [savingBenefit, setSavingBenefit] = useState(false);

  // ── load employee ──
  const loadEmployee = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const emp = await employeeApi.getEmployee(id);
      setEmployee(emp);
    } catch {
      toast({ title: 'Erro ao carregar funcionário', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { loadEmployee(); }, [loadEmployee]);

  // ── lazy tab loaders ──
  const loadPaystubs = useCallback(async () => {
    if (!employee) return;
    setLoadingPaystubs(true);
    try {
      const data = await apiService.getPaystubsAdmin({
        month: folhaMonth,
        year: folhaYear,
        employeeName: employee.fullName,
      });
      setPaystubs(data);
    } catch {
      setPaystubs([]);
    } finally {
      setLoadingPaystubs(false);
    }
  }, [employee, folhaMonth, folhaYear]);

  const loadSalaryHistory = useCallback(async () => {
    if (!id) return;
    setLoadingHistory(true);
    try {
      const data = await employeeApi.getSalaryHistory(id);
      setSalaryHistory(data);
    } catch {
      setSalaryHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [id]);

  const loadContracts = useCallback(async () => {
    if (!id) return;
    setLoadingContracts(true);
    try {
      const data = await employeeApi.getContracts(id);
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setLoadingContracts(false);
    }
  }, [id]);

  const loadBenefits = useCallback(async () => {
    if (!id) return;
    setLoadingBenefits(true);
    try {
      const data = await employeeApi.getBenefitsList(id);
      setBenefits(data);
    } catch {
      setBenefits([]);
    } finally {
      setLoadingBenefits(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    setLoadingDocs(true);
    try {
      const data = await documentsApi.listDocuments({ employeeId: id });
      setDocuments(data);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [id]);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const all = await supportApi.getTickets();
      setTickets(all.filter((t) => t.employeeId === id));
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [id]);

  // trigger lazy loads when tab changes
  useEffect(() => {
    if (!employee) return;
    if (activeTab === 'vinculo' && contracts.length === 0) loadContracts();
    if (activeTab === 'folha') loadPaystubs();
    if (activeTab === 'historico' && salaryHistory.length === 0) loadSalaryHistory();
    if (activeTab === 'beneficios' && benefits.length === 0) loadBenefits();
    if (activeTab === 'documentos' && documents.length === 0) loadDocuments();
    if (activeTab === 'tickets' && tickets.length === 0) loadTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, employee]);

  // reload paystubs when month/year changes
  useEffect(() => {
    if (activeTab === 'folha' && employee) loadPaystubs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folhaMonth, folhaYear]);

  // ── edit handlers ──
  const startEdit = () => {
    if (!employee) return;
    setEditData({ ...employee });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!id || !employee) return;
    setSaving(true);
    try {
      const updated = await employeeApi.updateEmployee(id, editData, 'Atualização pelo admin');
      setEmployee(updated);
      setEditing(false);
      setEditData({});
      toast({ title: 'Funcionário atualizado com sucesso!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: keyof Employee, value: any) =>
    setEditData((prev) => ({ ...prev, [field]: value }));

  // ── salary history form ──
  const saveSalaryHistory = async () => {
    if (!id) return;
    setSavingSalary(true);
    try {
      await request(`/employees/${id}/salary-history`, {
        method: 'POST',
        body: JSON.stringify({
          baseSalary: Number(salaryFormData.baseSalary),
          salaryType: employee?.salaryType ?? 'monthly',
          effectiveFrom: salaryFormData.effectiveFrom || new Date().toISOString(),
          reason: salaryFormData.reason,
        }),
      });
      toast({ title: 'Atualização salarial registrada!' });
      setShowSalaryForm(false);
      setSalaryFormData({ baseSalary: '', reason: '', effectiveFrom: '' });
      loadSalaryHistory();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar histórico', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingSalary(false);
    }
  };

  // ── benefit form ──
  const saveBenefit = async () => {
    if (!id) return;
    setSavingBenefit(true);
    try {
      await request(`/employees/${id}/benefits`, {
        method: 'POST',
        body: JSON.stringify({
          type: benefitFormData.type,
          amount: Number(benefitFormData.amount),
          effectiveFrom: benefitFormData.effectiveFrom || new Date().toISOString(),
          reason: benefitFormData.reason,
        }),
      });
      toast({ title: 'Benefício registrado!' });
      setShowBenefitForm(false);
      setBenefitFormData({ type: 'transport', amount: '', reason: '', effectiveFrom: '' });
      loadBenefits();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar benefício', description: e?.message, variant: 'destructive' });
    } finally {
      setSavingBenefit(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Carregando funcionário…
        </div>
      </Layout>
    );
  }

  if (!employee) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
          <AlertCircle className="h-10 w-10" />
          <p>Funcionário não encontrado.</p>
          <Button variant="outline" onClick={() => navigate('/admin/employees')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Funcionários
            </Button>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
              {employee.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{employee.fullName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-500">{employee.position}</span>
                <span className="text-gray-300">·</span>
                <StatusBadge status={employee.status} />
                {employee.employeeCode && (
                  <span className="text-xs text-gray-400">Cód: {employee.employeeCode}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={startEdit}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="flex overflow-x-auto gap-1 border-b pb-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DADOS PESSOAIS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pessoal' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Dados Básicos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" /> Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <EditableField
                  label="Nome Completo"
                  value={editing ? (editData.fullName ?? '') : employee.fullName}
                  editing={editing}
                  onChange={(v) => setField('fullName', v)}
                />
                <EditableField
                  label="Nome Social"
                  value={editing ? (editData.socialName ?? '') : (employee.socialName ?? '')}
                  editing={editing}
                  onChange={(v) => setField('socialName', v)}
                  placeholder="—"
                />
                <Row label="CPF" value={formatCPF(employee.cpf)} />
                <EditableField
                  label="RG"
                  value={editing ? (editData.rg ?? '') : (employee.rg ?? '')}
                  editing={editing}
                  onChange={(v) => setField('rg', v)}
                  placeholder="—"
                />
                <EditableField
                  label="Órgão Emissor RG"
                  value={editing ? (editData.rgIssuer ?? '') : (employee.rgIssuer ?? '')}
                  editing={editing}
                  onChange={(v) => setField('rgIssuer', v)}
                  placeholder="—"
                />
                <EditableField
                  label="Data Nascimento"
                  value={editing ? (editData.birthDate ?? '') : fmtDate(employee.birthDate)}
                  editing={editing}
                  inputType={editing ? 'date' : undefined}
                  onChange={(v) => setField('birthDate', v)}
                />
                <EditableField
                  label="Nome da Mãe"
                  value={editing ? (editData.motherName ?? '') : (employee.motherName ?? '')}
                  editing={editing}
                  onChange={(v) => setField('motherName', v)}
                  placeholder="—"
                />
                <SelectableField
                  label="Gênero"
                  value={editing ? (editData.gender ?? '') : (employee.gender ?? '')}
                  editing={editing}
                  options={[
                    { value: 'M', label: 'Masculino' },
                    { value: 'F', label: 'Feminino' },
                    { value: 'O', label: 'Outro' },
                  ]}
                  onChange={(v) => setField('gender', v)}
                />
                <SelectableField
                  label="Estado Civil"
                  value={editing ? (editData.maritalStatus ?? '') : (employee.maritalStatus ?? '')}
                  editing={editing}
                  options={[
                    { value: 'solteiro', label: 'Solteiro(a)' },
                    { value: 'casado', label: 'Casado(a)' },
                    { value: 'divorciado', label: 'Divorciado(a)' },
                    { value: 'viuvo', label: 'Viúvo(a)' },
                    { value: 'uniao_estavel', label: 'União Estável' },
                  ]}
                  onChange={(v) => setField('maritalStatus', v)}
                />
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" /> Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <EditableField
                  label="E-mail"
                  value={editing ? (editData.email ?? '') : (employee.email ?? '')}
                  editing={editing}
                  inputType="email"
                  onChange={(v) => setField('email', v)}
                  icon={<Mail className="h-3 w-3" />}
                />
                <EditableField
                  label="Telefone"
                  value={editing ? (editData.phone ?? '') : (employee.phone ? formatPhone(employee.phone) : '')}
                  editing={editing}
                  onChange={(v) => setField('phone', v)}
                  icon={<Phone className="h-3 w-3" />}
                  placeholder="—"
                />
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" /> Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <EditableField
                  label="Rua"
                  value={editing ? (editData.address?.street ?? '') : (employee.address?.street ?? '')}
                  editing={editing}
                  onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), street: v })}
                  placeholder="—"
                />
                <EditableField
                  label="Número"
                  value={editing ? (editData.address?.number ?? '') : (employee.address?.number ?? '')}
                  editing={editing}
                  onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), number: v })}
                  placeholder="—"
                />
                <EditableField
                  label="Complemento"
                  value={editing ? (editData.address?.complement ?? '') : (employee.address?.complement ?? '')}
                  editing={editing}
                  onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), complement: v })}
                  placeholder="—"
                />
                <EditableField
                  label="Bairro"
                  value={editing ? (editData.address?.neighborhood ?? '') : (employee.address?.neighborhood ?? '')}
                  editing={editing}
                  onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), neighborhood: v })}
                  placeholder="—"
                />
                <div className="grid grid-cols-2 gap-2">
                  <EditableField
                    label="Cidade"
                    value={editing ? (editData.address?.city ?? '') : (employee.address?.city ?? '')}
                    editing={editing}
                    onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), city: v })}
                    placeholder="—"
                  />
                  <EditableField
                    label="UF"
                    value={editing ? (editData.address?.state ?? '') : (employee.address?.state ?? '')}
                    editing={editing}
                    onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), state: v })}
                    placeholder="—"
                  />
                </div>
                <EditableField
                  label="CEP"
                  value={editing ? (editData.address?.zipCode ?? '') : (employee.address?.zipCode ?? '')}
                  editing={editing}
                  onChange={(v) => setField('address', { ...(editing ? editData.address : employee.address), zipCode: v })}
                  placeholder="—"
                />
              </CardContent>
            </Card>

            {/* Dados Bancários */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-600" /> Dados Bancários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <EditableField
                  label="Banco"
                  value={editing ? (editData.bankData?.bank ?? '') : (employee.bankData?.bank ?? '')}
                  editing={editing}
                  onChange={(v) => setField('bankData', { ...(editing ? editData.bankData : employee.bankData), bank: v })}
                  placeholder="—"
                />
                <EditableField
                  label="Agência"
                  value={editing ? (editData.bankData?.agency ?? '') : (employee.bankData?.agency ?? '')}
                  editing={editing}
                  onChange={(v) => setField('bankData', { ...(editing ? editData.bankData : employee.bankData), agency: v })}
                  placeholder="—"
                />
                <EditableField
                  label="Conta"
                  value={editing ? (editData.bankData?.account ?? '') : (employee.bankData?.account ?? '')}
                  editing={editing}
                  onChange={(v) => setField('bankData', { ...(editing ? editData.bankData : employee.bankData), account: v })}
                  placeholder="—"
                />
                <SelectableField
                  label="Tipo de Conta"
                  value={editing ? (editData.bankData?.accountType ?? '') : (employee.bankData?.accountType ?? '')}
                  editing={editing}
                  options={[
                    { value: 'corrente', label: 'Corrente' },
                    { value: 'poupanca', label: 'Poupança' },
                  ]}
                  onChange={(v) => setField('bankData', { ...(editing ? editData.bankData : employee.bankData), accountType: v })}
                />
                <EditableField
                  label="Chave PIX"
                  value={editing ? (editData.bankData?.pixKey ?? '') : (employee.bankData?.pixKey ?? '')}
                  editing={editing}
                  onChange={(v) => setField('bankData', { ...(editing ? editData.bankData : employee.bankData), pixKey: v })}
                  placeholder="—"
                />
              </CardContent>
            </Card>

            {/* Documentos Trabalhistas */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" /> Documentos Trabalhistas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <EditableField label="CTPS" value={editing ? (editData.ctpsNumber ?? '') : (employee.ctpsNumber ?? '')} editing={editing} onChange={(v) => setField('ctpsNumber', v)} placeholder="—" />
                <EditableField label="Série CTPS" value={editing ? (editData.ctpsSeries ?? '') : (employee.ctpsSeries ?? '')} editing={editing} onChange={(v) => setField('ctpsSeries', v)} placeholder="—" />
                <EditableField label="UF CTPS" value={editing ? (editData.ctpsState ?? '') : (employee.ctpsState ?? '')} editing={editing} onChange={(v) => setField('ctpsState', v)} placeholder="—" />
                <EditableField label="PIS/PASEP" value={editing ? (editData.pis ?? '') : (employee.pis ?? '')} editing={editing} onChange={(v) => setField('pis', v)} placeholder="—" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: VÍNCULO / CARGO
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'vinculo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Situação Atual */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-blue-600" /> Situação Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <EditableField
                  label="Cargo"
                  value={editing ? (editData.position ?? '') : employee.position}
                  editing={editing}
                  onChange={(v) => setField('position', v)}
                />
                <SelectableField
                  label="Departamento"
                  value={editing ? (editData.department ?? '') : employee.department}
                  editing={editing}
                  options={[
                    { value: 'centro_educacional', label: 'Centro Educacional' },
                    { value: 'recreacao_infantil', label: 'Recreação Infantil' },
                  ]}
                  onChange={(v) => setField('department', v)}
                />
                <SelectableField
                  label="Tipo Contrato"
                  value={editing ? (editData.contractType ?? '') : (employee.contractType ?? '')}
                  editing={editing}
                  options={[
                    { value: 'CLT', label: 'CLT' },
                    { value: 'temporary', label: 'Temporário' },
                    { value: 'intern', label: 'Estágio' },
                  ]}
                  onChange={(v) => setField('contractType', v as any)}
                />
                <SelectableField
                  label="Tipo Salário"
                  value={editing ? (editData.salaryType ?? '') : employee.salaryType}
                  editing={editing}
                  options={[
                    { value: 'monthly', label: 'Mensal' },
                    { value: 'hourly', label: 'Por Hora' },
                  ]}
                  onChange={(v) => setField('salaryType', v as any)}
                />
                <EditableField
                  label="Salário Base"
                  value={editing ? String(editData.baseSalary ?? employee.baseSalary ?? '') : fmtCurrency(employee.baseSalary)}
                  editing={editing}
                  inputType={editing ? 'number' : undefined}
                  onChange={(v) => setField('baseSalary', Number(v))}
                />
                {(employee.salaryType === 'hourly' || editData.salaryType === 'hourly') && (
                  <EditableField
                    label="Valor Hora"
                    value={editing ? String(editData.hourlyRate ?? employee.hourlyRate ?? '') : fmtCurrency(employee.hourlyRate)}
                    editing={editing}
                    inputType={editing ? 'number' : undefined}
                    onChange={(v) => setField('hourlyRate', Number(v))}
                  />
                )}
                <EditableField
                  label="Carga Horária Semanal"
                  value={editing ? String(editData.weeklyHours ?? employee.weeklyHours ?? '') : (employee.weeklyHours ? `${employee.weeklyHours}h` : '—')}
                  editing={editing}
                  inputType={editing ? 'number' : undefined}
                  onChange={(v) => setField('weeklyHours', Number(v))}
                />
                <EditableField
                  label="Data de Admissão"
                  value={editing ? (editData.admissionDate ?? '') : fmtDate(employee.admissionDate)}
                  editing={editing}
                  inputType={editing ? 'date' : undefined}
                  onChange={(v) => setField('admissionDate', v)}
                />
                <Row label="CNPJ Empregador" value={employee.employerCnpj ?? '—'} />
                <Row label="Dependentes" value={String(employee.payrollData?.dependents ?? 0)} />
                <Row label="Contratado em" value={fmtDate(employee.createdAt)} />
              </CardContent>
            </Card>

            {/* Histórico de Contratos */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" /> Histórico de Contratos
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={loadContracts} disabled={loadingContracts}>
                  <RefreshCw className={`h-3 w-3 ${loadingContracts ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent>
                {loadingContracts ? (
                  <p className="text-sm text-gray-500 py-4 text-center">Carregando…</p>
                ) : contracts.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhum contrato registrado.</p>
                ) : (
                  <div className="space-y-2">
                    {contracts.map((c: any) => (
                      <div key={c.id} className="border rounded-lg p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.position ?? '—'}</span>
                          <ApprovalBadge status={c.approvalStatus} />
                        </div>
                        <div className="text-gray-500">
                          {c.department} · {c.contractType ?? '—'} · {c.salaryType === 'hourly' ? 'Por hora' : 'Mensal'}
                        </div>
                        <div className="text-gray-600">
                          {fmtCurrency(c.baseSalary ? Number(c.baseSalary) : undefined)} ·
                          {c.weeklyHours ? ` ${c.weeklyHours}h/sem ·` : ''}
                          Início: {fmtDate(c.effectiveFrom)}
                          {c.effectiveTo ? ` — Fim: ${fmtDate(c.effectiveTo)}` : ''}
                        </div>
                        {c.reason && <div className="text-xs text-gray-400">Motivo: {c.reason}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: FOLHA DE PAGAMENTO
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'folha' && (
          <div className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs">Mês</Label>
                    <Select value={String(folhaMonth)} onValueChange={(v) => setFolhaMonth(Number(v))}>
                      <SelectTrigger className="w-36 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => (
                          <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ano</Label>
                    <Select value={String(folhaYear)} onValueChange={(v) => setFolhaYear(Number(v))}>
                      <SelectTrigger className="w-28 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" variant="outline" onClick={loadPaystubs} disabled={loadingPaystubs}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loadingPaystubs ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingPaystubs ? (
              <div className="text-center text-gray-500 py-8">Carregando holerites…</div>
            ) : paystubs.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum holerite encontrado para este período.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {paystubs.map((p: any) => (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">
                            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][(p.month ?? folhaMonth) - 1]}/{p.year ?? folhaYear}
                          </p>
                          <p className="text-xs text-gray-500">{p.employeeName ?? employee.fullName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Salário Líquido</p>
                            <p className="font-semibold text-green-700">{fmtCurrency(p.netSalary)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/paystubs/${p.id}`)}
                          >
                            <Printer className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: HISTÓRICO SALARIAL
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'historico' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">Histórico de Remuneração</h2>
              <Button size="sm" onClick={() => setShowSalaryForm(!showSalaryForm)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Ajuste
              </Button>
            </div>

            {/* Form */}
            {showSalaryForm && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Registrar Atualização Salarial</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Novo Salário Base (R$)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm mt-1"
                      value={salaryFormData.baseSalary}
                      onChange={(e) => setSalaryFormData((p) => ({ ...p, baseSalary: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vigência (a partir de)</Label>
                    <Input
                      type="date"
                      className="h-8 text-sm mt-1"
                      value={salaryFormData.effectiveFrom}
                      onChange={(e) => setSalaryFormData((p) => ({ ...p, effectiveFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <Input
                      className="h-8 text-sm mt-1"
                      value={salaryFormData.reason}
                      onChange={(e) => setSalaryFormData((p) => ({ ...p, reason: e.target.value }))}
                      placeholder="Ex: Promoção, Reajuste anual…"
                    />
                  </div>
                  <div className="md:col-span-3 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowSalaryForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={saveSalaryHistory} disabled={savingSalary || !salaryFormData.baseSalary}>
                      {savingSalary ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingHistory ? (
              <div className="text-center text-gray-500 py-8">Carregando histórico…</div>
            ) : salaryHistory.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum histórico salarial registrado.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {salaryHistory.map((h: any, idx: number) => (
                  <Card key={h.id}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium">
                          {h.salaryType === 'hourly' ? 'Valor/hora: ' : 'Salário: '}
                          <span className="text-green-700">{fmtCurrency(h.baseSalary ? Number(h.baseSalary) : undefined)}</span>
                        </span>
                        {h.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">Motivo: {h.reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <ApprovalBadge status={h.approvalStatus} />
                          {idx === 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Atual</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Vigente: {fmtDate(h.effectiveFrom)}
                          {h.effectiveTo ? ` até ${fmtDate(h.effectiveTo)}` : ''}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: BENEFÍCIOS / DESCONTOS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'beneficios' && (
          <div className="space-y-4">
            {/* Resumo dos benefícios do cadastro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Gift className="h-4 w-4 text-green-600" /> Vale-Transporte
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Row
                    label="Status"
                    value={
                      <span className={employee.benefits?.transportVoucher.enabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {employee.benefits?.transportVoucher.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    }
                  />
                  <Row label="Valor Mensal" value={fmtCurrency(employee.benefits?.transportVoucher.monthlyValue)} />
                  <Row label="Dias de Trabalho" value={String(employee.benefits?.transportVoucher.workDays ?? 22)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Gift className="h-4 w-4 text-orange-500" /> Vale-Alimentação
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Row
                    label="Status"
                    value={
                      <span className={employee.benefits?.mealVoucher.enabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {employee.benefits?.mealVoucher.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    }
                  />
                  <Row label="Valor Mensal" value={fmtCurrency(employee.benefits?.mealVoucher.monthlyValue)} />
                  <Row label="Dias de Trabalho" value={String(employee.benefits?.mealVoucher.workDays ?? 22)} />
                </CardContent>
              </Card>
            </div>

            {/* Descontos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-red-500" /> Encargos e Descontos em Folha
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Row label="Dependentes (IRRF)" value={String(employee.payrollData?.dependents ?? 0)} />
                <Row label="Contribuição Sindical" value={employee.payrollData?.unionFee ? 'Sim' : 'Não'} />
              </CardContent>
            </Card>

            {/* Histórico de benefícios */}
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">Benefícios Registrados</h2>
              <Button size="sm" onClick={() => setShowBenefitForm(!showBenefitForm)}>
                <Plus className="h-4 w-4 mr-1" /> Novo Benefício
              </Button>
            </div>

            {showBenefitForm && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Registrar Benefício</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={benefitFormData.type} onValueChange={(v) => setBenefitFormData((p) => ({ ...p, type: v }))}>
                      <SelectTrigger className="h-8 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transport">Vale-Transporte</SelectItem>
                        <SelectItem value="meal">Vale-Alimentação</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm mt-1"
                      value={benefitFormData.amount}
                      onChange={(e) => setBenefitFormData((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vigência inicial</Label>
                    <Input
                      type="date"
                      className="h-8 text-sm mt-1"
                      value={benefitFormData.effectiveFrom}
                      onChange={(e) => setBenefitFormData((p) => ({ ...p, effectiveFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Motivo</Label>
                    <Input
                      className="h-8 text-sm mt-1"
                      value={benefitFormData.reason}
                      onChange={(e) => setBenefitFormData((p) => ({ ...p, reason: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="md:col-span-4 flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowBenefitForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={saveBenefit} disabled={savingBenefit || !benefitFormData.amount}>
                      {savingBenefit ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingBenefits ? (
              <div className="text-center text-gray-500 py-8">Carregando benefícios…</div>
            ) : benefits.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum benefício registrado na base estruturada.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {benefits.map((b: any) => (
                  <Card key={b.id}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-sm">
                          {benefitTypeLabel[b.type] ?? b.type}
                        </span>
                        <span className="ml-3 text-green-700 font-semibold text-sm">
                          {fmtCurrency(b.amount ? Number(b.amount) : undefined)}
                        </span>
                        {b.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">Motivo: {b.reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <ApprovalBadge status={b.approvalStatus} />
                        <p className="text-xs text-gray-400 mt-1">
                          {fmtDate(b.effectiveFrom)}
                          {b.effectiveTo ? ` até ${fmtDate(b.effectiveTo)}` : ' — presente'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DOCUMENTOS
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">Documentos do Funcionário</h2>
              <Button size="sm" variant="outline" onClick={loadDocuments} disabled={loadingDocs}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingDocs ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingDocs ? (
              <div className="text-center text-gray-500 py-8">Carregando documentos…</div>
            ) : documents.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum documento encontrado para este funcionário.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <Card key={doc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{docTypeLabel[doc.type] ?? doc.type}</p>
                          {doc.month && doc.year && (
                            <p className="text-xs text-gray-400">
                              {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][doc.month - 1]}/{doc.year}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <DocStatusBadge status={doc.status} />
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(doc.updatedAt ?? doc.createdAt)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: TICKETS / SUPORTE
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">Tickets de Suporte</h2>
              <Button size="sm" variant="outline" onClick={loadTickets} disabled={loadingTickets}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loadingTickets ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {loadingTickets ? (
              <div className="text-center text-gray-500 py-8">Carregando tickets…</div>
            ) : tickets.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum ticket registrado para este funcionário.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => {
                  const ts = ticketStatusLabel[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' };
                  return (
                    <Card
                      key={t.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/support/tickets/${t.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{t.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ts.cls}`}>{ts.label}</span>
                              <span className="text-xs text-gray-400">{categoryLabel(t.category)}</span>
                              <PriorityBadge priority={t.priority} />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-400">{fmtDate(t.createdAt)}</p>
                            {t.messages.length > 0 && (
                              <p className="text-xs text-blue-600 mt-1">{t.messages.length} msg{t.messages.length > 1 ? 's' : ''}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right font-medium">{value ?? '—'}</span>
    </div>
  );
}

function EditableField({
  label,
  value,
  editing,
  onChange,
  inputType,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  inputType?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  if (!editing) {
    return <Row label={label} value={value || placeholder || '—'} />;
  }
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-gray-500">{label}</Label>
      <div className="relative">
        {icon && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <Input
          type={inputType ?? 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-7 text-sm ${icon ? 'pl-6' : ''}`}
        />
      </div>
    </div>
  );
}

function SelectableField({
  label,
  value,
  editing,
  options,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const found = options.find((o) => o.value === value);
  if (!editing) return <Row label={label} value={found?.label ?? value ?? '—'} />;
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-gray-500">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-sm">
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    review:    'bg-yellow-100 text-yellow-800',
    approved:  'bg-blue-100 text-blue-800',
    signed:    'bg-indigo-100 text-indigo-800',
    finalized: 'bg-green-100 text-green-800',
    reopened:  'bg-orange-100 text-orange-800',
  };
  const labels: Record<string, string> = {
    draft: 'Rascunho', review: 'Em Revisão', approved: 'Aprovado',
    signed: 'Assinado', finalized: 'Finalizado', reopened: 'Reaberto',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    low:    { label: 'Baixa',   cls: 'text-gray-500' },
    medium: { label: 'Média',   cls: 'text-yellow-600' },
    high:   { label: 'Alta',    cls: 'text-orange-600' },
    urgent: { label: 'Urgente', cls: 'text-red-600 font-semibold' },
  };
  const s = map[priority] ?? { label: priority, cls: 'text-gray-500' };
  return <span className={`text-xs ${s.cls}`}>{s.label}</span>;
}

function categoryLabel(cat: string): string {
  const m: Record<string, string> = {
    payroll: 'Folha', benefits: 'Benefícios', technical: 'Técnico', other: 'Outro',
  };
  return m[cat] ?? cat;
}
