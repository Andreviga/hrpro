/**
 * Central de documentos com templates, instâncias e exportações.
 */
import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { documentsApi, Document, DocumentStatus, DocumentTemplate, DocumentType, DocumentVersion } from '../services/documentsApi';
import { payrollApi, PayrollRun } from '../services/payrollApi';
import { API_BASE, getAuthToken } from '../services/http';
import {
  FileText,
  Download,
  Plus,
  History,
  RefreshCcw,
  Trash2,
  RotateCcw,
  Pencil,
  Upload,
  Loader2
} from 'lucide-react';

const documentTypes: Array<{ value: DocumentType; label: string }> = [
  { value: 'trct', label: 'TRCT' },
  { value: 'termo_quitacao', label: 'Termo de Quitacao' },
  { value: 'aviso_previo', label: 'Aviso Previo' },
  { value: 'recibo_ferias', label: 'Recibo de Ferias' },
  { value: 'aviso_ferias', label: 'Aviso de Ferias' },
  { value: 'holerite', label: 'Holerite' },
  { value: 'recibo_13', label: 'Recibo 13o' },
  { value: 'recibo_plr', label: 'Recibo PLR' },
  { value: 'outros', label: 'Outros' }
];

const statusOptions: Array<{ value: DocumentStatus; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'review', label: 'Em revisao' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'signed', label: 'Assinado' },
  { value: 'finalized', label: 'Finalizado' },
  { value: 'reopened', label: 'Reaberto' }
];

const statusBadgeClass: Record<DocumentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  finalized: 'bg-emerald-100 text-emerald-700',
  reopened: 'bg-orange-100 text-orange-700'
};

const emptyTemplateForm = {
  id: '',
  type: 'trct' as DocumentType,
  name: '',
  description: '',
  content: '',
  status: 'draft' as DocumentStatus,
  requiredPlaceholders: '',
  reason: ''
};

const emptyDocumentForm = {
  id: '',
  templateId: '',
  employeeId: '',
  title: '',
  placeholders: '{}',
  month: '',
  year: '',
  eventDate: '',
  reason: '',
  content: ''
};

const emptyGenerationForm = {
  payrollRunId: '',
  documentType: 'trct' as 'trct' | 'recibo_ferias' | 'holerite',
  templateId: '',
  employeeIds: '',
  reason: ''
};

const DocumentsCenterPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManageTemplates = ['admin', 'rh', 'manager'].includes(user?.role || '');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentPage, setDocumentPage] = useState(1);
  const [availableRuns, setAvailableRuns] = useState<PayrollRun[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState('');

  const [docFilters, setDocFilters] = useState({
    employeeId: '',
    month: '',
    year: '',
    type: '',
    status: ''
  });

  const [templateFilters, setTemplateFilters] = useState({
    type: '',
    status: '',
    includeDeleted: false
  });

  const [templateForm, setTemplateForm] = useState({ ...emptyTemplateForm });
  const [documentForm, setDocumentForm] = useState({ ...emptyDocumentForm });
  const [generationForm, setGenerationForm] = useState({ ...emptyGenerationForm });

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);

  const [payloadPreview, setPayloadPreview] = useState<string>('');
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [versionsTitle, setVersionsTitle] = useState('');

  useEffect(() => {
    void loadDocuments();
    void loadTemplates();
    void loadAvailableRuns();
  }, []);

  const loadDocuments = async () => {
    try {
      setDocumentsLoading(true);
      setError('');
      const filters: {
        employeeId?: string;
        month?: number;
        year?: number;
        type?: DocumentType;
        status?: DocumentStatus;
      } = {};

      if (docFilters.employeeId.trim()) filters.employeeId = docFilters.employeeId.trim();
      if (docFilters.month) filters.month = Number(docFilters.month);
      if (docFilters.year) filters.year = Number(docFilters.year);
      if (docFilters.type) filters.type = docFilters.type as DocumentType;
      if (docFilters.status) filters.status = docFilters.status as DocumentStatus;

      const data = await documentsApi.listDocuments(filters);
      setDocuments(data);
      setDocumentPage(1);
    } catch (err) {
      setError('Erro ao carregar documentos.');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadAvailableRuns = async () => {
    try {
      const runs = await payrollApi.listRuns();
      const sorted = [...runs].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.month !== b.month) return b.month - a.month;
        return b.version - a.version;
      });
      setAvailableRuns(sorted);
    } catch {
      setAvailableRuns([]);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      setError('');
      const filters: { type?: DocumentType; status?: DocumentStatus; includeDeleted?: boolean } = {};
      if (templateFilters.type) filters.type = templateFilters.type as DocumentType;
      if (templateFilters.status) filters.status = templateFilters.status as DocumentStatus;
      if (templateFilters.includeDeleted) filters.includeDeleted = true;
      const data = await documentsApi.listTemplates(filters);
      setTemplates(data);
    } catch (err) {
      setError('Erro ao carregar templates.');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleBootstrapIncomeStatementTemplate = async () => {
    try {
      const result = await documentsApi.bootstrapIncomeStatementTemplate('Inclusao do modelo oficial de informe de rendimentos');
      await loadTemplates();
      toast({
        title: result.created ? 'Modelo incluido' : 'Modelo ja disponivel',
        description: result.created
          ? 'Template oficial de informe de rendimentos adicionado com sucesso.'
          : 'O template oficial ja existe e foi mantido.'
      });
      setError('');
    } catch (err) {
      setError('Erro ao incluir modelo oficial de informe de rendimentos.');
    }
  };

  const openTemplateDialog = (template?: DocumentTemplate) => {
    if (template) {
      setTemplateForm({
        id: template.id,
        type: template.type,
        name: template.name,
        description: template.description || '',
        content: template.content,
        status: template.status,
        requiredPlaceholders: (template.requiredPlaceholders || []).join(', '),
        reason: ''
      });
    } else {
      setTemplateForm({ ...emptyTemplateForm });
    }
    setTemplateDialogOpen(true);
  };

  const openDocumentDialog = (document?: Document) => {
    if (document && document.payrollRun?.status === 'closed') {
      setError('Competência fechada. Documento não pode ser editado.');
      return;
    }

    if (document) {
      setDocumentForm({
        id: document.id,
        templateId: document.templateId || '',
        employeeId: '',
        title: document.title,
        placeholders: JSON.stringify(document.placeholders || {}, null, 2),
        month: document.month?.toString() || '',
        year: document.year?.toString() || '',
        eventDate: '',
        reason: '',
        content: document.content || ''
      });
    } else {
      setDocumentForm({ ...emptyDocumentForm });
    }
    setDocumentDialogOpen(true);
  };

  const parsePlaceholders = (value: string) => {
    if (!value.trim()) return {};
    return JSON.parse(value);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      setError('Nome e conteúdo do template são obrigatórios.');
      return;
    }

    const requiredPlaceholders = templateForm.requiredPlaceholders
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setError('');
      if (templateForm.id) {
        await documentsApi.updateTemplate(templateForm.id, {
          type: templateForm.type,
          name: templateForm.name,
          description: templateForm.description || undefined,
          content: templateForm.content,
          status: templateForm.status,
          requiredPlaceholders: requiredPlaceholders.length ? requiredPlaceholders : undefined,
          reason: templateForm.reason || undefined
        });
      } else {
        await documentsApi.createTemplate({
          type: templateForm.type,
          name: templateForm.name,
          description: templateForm.description || undefined,
          content: templateForm.content,
          status: templateForm.status,
          requiredPlaceholders: requiredPlaceholders.length ? requiredPlaceholders : undefined,
          reason: templateForm.reason || undefined
        });
      }
      setTemplateDialogOpen(false);
      void loadTemplates();
    } catch (err) {
      setError('Erro ao salvar template.');
    }
  };

  const handleDeleteTemplate = async (template: DocumentTemplate) => {
    const reason = window.prompt('Motivo para arquivar o template?') || undefined;
    try {
      await documentsApi.deleteTemplate(template.id, reason);
      void loadTemplates();
    } catch (err) {
      setError('Erro ao arquivar template.');
    }
  };

  const handleRestoreTemplate = async (template: DocumentTemplate) => {
    const reason = window.prompt('Motivo para restaurar o template?') || undefined;
    try {
      await documentsApi.restoreTemplate(template.id, reason);
      void loadTemplates();
    } catch (err) {
      setError('Erro ao restaurar template.');
    }
  };

  const handleSaveDocument = async () => {
    try {
      setError('');
      const placeholders = parsePlaceholders(documentForm.placeholders);

      if (!documentForm.id) {
        if (!documentForm.templateId || !documentForm.employeeId.trim()) {
          setError('Template e funcionário são obrigatórios.');
          return;
        }
        await documentsApi.createDocument({
          templateId: documentForm.templateId,
          employeeId: documentForm.employeeId.trim(),
          title: documentForm.title || undefined,
          placeholders,
          month: documentForm.month ? Number(documentForm.month) : undefined,
          year: documentForm.year ? Number(documentForm.year) : undefined,
          eventDate: documentForm.eventDate || undefined,
          reason: documentForm.reason || undefined
        });
      } else {
        await documentsApi.updateDocument(documentForm.id, {
          content: documentForm.content || undefined,
          placeholders,
          reason: documentForm.reason || undefined
        });
      }

      setDocumentDialogOpen(false);
      void loadDocuments();
    } catch (err) {
      setError('Erro ao salvar documento. Verifique o JSON de placeholders.');
    }
  };

  const handleChangeStatus = async (document: Document, status: DocumentStatus) => {
    if (document.payrollRun?.status === 'closed') {
      setError('Competência fechada. Documento não pode ter status alterado.');
      return;
    }

    try {
      await documentsApi.changeStatus(document.id, status);
      void loadDocuments();
    } catch (err) {
      setError('Erro ao alterar status.');
    }
  };

  const handleViewVersions = async (title: string, fetcher: () => Promise<DocumentVersion[]>) => {
    try {
      const data = await fetcher();
      setVersions(data);
      setVersionsTitle(title);
      setVersionsDialogOpen(true);
    } catch (err) {
      setError('Erro ao carregar histórico.');
    }
  };

  const handleExportPayload = async (document: Document) => {
    try {
      const data = await documentsApi.exportPayload(document.id);
      setPayloadPreview(JSON.stringify(data, null, 2));
      setPayloadDialogOpen(true);
    } catch (err) {
      setError('Erro ao gerar payload.');
    }
  };

  const downloadFile = async (path: string, filename: string) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (!response.ok) {
      throw new Error('Falha no download');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (document: Document, format: 'pdf' | 'docx') => {
    try {
      const filename = `${document.title || document.type}-${document.id}.${format}`;
      await downloadFile(`/documents/${document.id}/export/${format}`, filename);
      setError('');
    } catch (err) {
      setError('Erro ao exportar documento.');
    }
  };

  const handleGenerateFromPayroll = async () => {
    if (!generationForm.payrollRunId.trim()) {
      setError('Selecione uma competência para gerar documentos.');
      return;
    }

    try {
      setError('');
      const employeeIds = generationForm.employeeIds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      await documentsApi.generateFromPayroll({
        payrollRunId: generationForm.payrollRunId.trim(),
        documentType: generationForm.documentType,
        templateId: generationForm.templateId || undefined,
        employeeIds: employeeIds.length ? employeeIds : undefined,
        reason: generationForm.reason || undefined
      });
      setGenerationForm({ ...emptyGenerationForm });
    } catch (err) {
      setError('Erro ao gerar documentos pela folha.');
    }
  };

  const hasTemplates = templates.length > 0;
  const documentsPerPage = 12;
  const totalDocumentPages = Math.max(1, Math.ceil(documents.length / documentsPerPage));
  const paginatedDocuments = documents.slice((documentPage - 1) * documentsPerPage, documentPage * documentsPerPage);

  const getFriendlyDocumentTitle = (document: Document) => {
    const hasOpaqueIdTitle = /^[a-z0-9]{18,}$/i.test((document.title || '').trim());
    if (document.title && !hasOpaqueIdTitle) return document.title;

    const monthYear = document.month && document.year ? `${String(document.month).padStart(2, '0')}/${document.year}` : '';
    const employeeName = String((document.placeholders as Record<string, unknown> | null | undefined)?.employee_name ?? '').trim();
    const typeLabel = documentTypes.find((item) => item.value === document.type)?.label || 'Documento';
    const suffix = [monthYear, employeeName].filter(Boolean).join(' - ');
    return suffix ? `${typeLabel} ${suffix}` : `${typeLabel} ${document.id.slice(0, 8)}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Central de Documentos</h1>
            <p className="text-gray-600 mt-1">
              Templates, geração e exportação de documentos oficiais.
            </p>
          </div>
          <Button variant="outline" onClick={() => {
            void loadDocuments();
            void loadTemplates();
            void loadAvailableRuns();
          }}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="generation">Gerar via folha</TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Filtros</span>
                  </CardTitle>
                  <CardDescription>Refine por período, status ou colaborador.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Funcionário</Label>
                    <Input
                      value={docFilters.employeeId}
                      onChange={(event) => setDocFilters({ ...docFilters, employeeId: event.target.value })}
                      placeholder="ID do funcionário"
                    />
                  </div>
                  <div>
                    <Label>Mês</Label>
                    <Input
                      type="number"
                      value={docFilters.month}
                      onChange={(event) => setDocFilters({ ...docFilters, month: event.target.value })}
                      placeholder="02"
                    />
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={docFilters.year}
                      onChange={(event) => setDocFilters({ ...docFilters, year: event.target.value })}
                      placeholder="2026"
                    />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={docFilters.type} onValueChange={(value) => setDocFilters({ ...docFilters, type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={docFilters.status} onValueChange={(value) => setDocFilters({ ...docFilters, status: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-5 flex justify-end">
                    <Button onClick={() => void loadDocuments()}>
                      Buscar documentos
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Documentos gerados</CardTitle>
                    <CardDescription>Gerencie status, exporte e consulte histórico.</CardDescription>
                  </div>
                  <Button onClick={() => openDocumentDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo documento
                  </Button>
                </CardHeader>
                <CardContent>
                  {documentsLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Carregando documentos...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Documento</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {documents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                              Nenhum documento encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedDocuments.map((document) => (
                            <TableRow key={document.id}>
                              <TableCell>
                                <div className="font-medium text-gray-900">{getFriendlyDocumentTitle(document)}</div>
                                <div className="text-xs text-gray-500">{document.id}</div>
                              </TableCell>
                              <TableCell>
                                {documentTypes.find((item) => item.value === document.type)?.label || document.type}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusBadgeClass[document.status]}>
                                  {statusOptions.find((item) => item.value === document.status)?.label || document.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {document.month && document.year ? `${document.month}/${document.year}` : '--'}
                                {document.payrollRun?.status === 'closed' && (
                                  <div className="mt-1">
                                    <Badge className="bg-slate-100 text-slate-700">Folha fechada</Badge>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDocumentDialog(document)}
                                    disabled={document.payrollRun?.status === 'closed'}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleExportPayload(document)}>
                                    <Upload className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleExport(document, 'pdf')}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleExport(document, 'docx')}>
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewVersions(`Histórico: ${document.title}`, () => documentsApi.listDocumentVersions(document.id))}
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="mt-2">
                                  <Select
                                    value={document.status}
                                    onValueChange={(value) => handleChangeStatus(document, value as DocumentStatus)}
                                    disabled={document.payrollRun?.status === 'closed'}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusOptions.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    </div>
                  )}

                  {!documentsLoading && documents.length > documentsPerPage && (
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                      <span>Pagina {documentPage} de {totalDocumentPages}</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDocumentPage((prev) => Math.max(1, prev - 1))}
                          disabled={documentPage <= 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDocumentPage((prev) => Math.min(totalDocumentPages, prev + 1))}
                          disabled={documentPage >= totalDocumentPages}
                        >
                          Proxima
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Filtros de templates</CardTitle>
                  <CardDescription>Filtre por tipo e status.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={templateFilters.type} onValueChange={(value) => setTemplateFilters({ ...templateFilters, type: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={templateFilters.status} onValueChange={(value) => setTemplateFilters({ ...templateFilters, status: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Arquivados</Label>
                    <Select
                      value={templateFilters.includeDeleted ? 'true' : 'false'}
                      onValueChange={(value) => setTemplateFilters({ ...templateFilters, includeDeleted: value === 'true' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Ocultar</SelectItem>
                        <SelectItem value="true">Mostrar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => void loadTemplates()}>
                      Buscar templates
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Templates ativos</CardTitle>
                    <CardDescription>Crie, atualize e arquive modelos.</CardDescription>
                  </div>
                  {canManageTemplates && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => void handleBootstrapIncomeStatementTemplate()}>
                        Incluir modelo oficial
                      </Button>
                      <Button onClick={() => openTemplateDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo template
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Carregando templates...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Template</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {templates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                              Nenhum template encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          templates.map((template) => (
                            <TableRow key={template.id}>
                              <TableCell>
                                <div className="font-medium text-gray-900">{template.name}</div>
                                <div className="text-xs text-gray-500">{template.description || 'Sem Descrição'}</div>
                              </TableCell>
                              <TableCell>
                                {documentTypes.find((item) => item.value === template.type)?.label || template.type}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusBadgeClass[template.status]}>
                                  {statusOptions.find((item) => item.value === template.status)?.label || template.status}
                                </Badge>
                              </TableCell>
                              <TableCell>v{template.version}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-2">
                                  {canManageTemplates && (
                                    <Button size="sm" variant="outline" onClick={() => openTemplateDialog(template)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canManageTemplates && !template.deletedAt && (
                                    <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canManageTemplates && template.deletedAt && (
                                    <Button size="sm" variant="outline" onClick={() => handleRestoreTemplate(template)}>
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewVersions(`Histórico: ${template.name}`, () => documentsApi.listTemplateVersions(template.id))}
                                  >
                                    <History className="h-4 w-4" />
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
          </TabsContent>

          <TabsContent value="generation">
            <Card>
              <CardHeader>
                <CardTitle>Gerar documentos pela folha</CardTitle>
                <CardDescription>
                  Acione geração em lote de TRCT, recibo de férias ou holerite.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>competência da folha</Label>
                  <Select
                    value={generationForm.payrollRunId}
                    onValueChange={(value) => setGenerationForm({ ...generationForm, payrollRunId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a competência" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRuns.map((run) => (
                        <SelectItem key={run.id} value={run.id}>
                          {String(run.month).padStart(2, '0')}/{run.year} - v{run.version} - {run.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de documento</Label>
                  <Select
                    value={generationForm.documentType}
                    onValueChange={(value) => setGenerationForm({ ...generationForm, documentType: value as 'trct' | 'recibo_ferias' | 'holerite' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trct">TRCT</SelectItem>
                      <SelectItem value="recibo_ferias">Recibo de Ferias</SelectItem>
                      <SelectItem value="holerite">Holerite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Template (opcional)</Label>
                  <Select
                    value={generationForm.templateId}
                    onValueChange={(value) => setGenerationForm({ ...generationForm, templateId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={hasTemplates ? 'Selecione' : 'Sem templates'} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>funcionários (opcional)</Label>
                  <Input
                    value={generationForm.employeeIds}
                    onChange={(event) => setGenerationForm({ ...generationForm, employeeIds: event.target.value })}
                    placeholder="id1, id2, id3"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={generationForm.reason}
                    onChange={(event) => setGenerationForm({ ...generationForm, reason: event.target.value })}
                    placeholder="Motivo para auditoria"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={() => void handleGenerateFromPayroll()}>
                    Gerar documentos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{templateForm.id ? 'Editar template' : 'Novo template'}</DialogTitle>
            <DialogDescription>Atualize o conteúdo e placeholders obrigatórios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={templateForm.type} onValueChange={(value) => setTemplateForm({ ...templateForm, type: value as DocumentType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={templateForm.status} onValueChange={(value) => setTemplateForm({ ...templateForm, status: value as DocumentStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={templateForm.name}
                onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })}
                placeholder="Template TRCT 2026"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={templateForm.description}
                onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })}
                placeholder="Uso interno"
              />
            </div>
            <div>
              <Label>Placeholders obrigatórios (separados por virgula)</Label>
              <Input
                value={templateForm.requiredPlaceholders}
                onChange={(event) => setTemplateForm({ ...templateForm, requiredPlaceholders: event.target.value })}
                placeholder="employee_name, company_name"
              />
            </div>
            <div>
              <Label>conteúdo</Label>
              <Textarea
                value={templateForm.content}
                onChange={(event) => setTemplateForm({ ...templateForm, content: event.target.value })}
                rows={8}
              />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={templateForm.reason}
                onChange={(event) => setTemplateForm({ ...templateForm, reason: event.target.value })}
                placeholder="Justificativa para auditoria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveTemplate()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{documentForm.id ? 'Editar documento' : 'Novo documento'}</DialogTitle>
            <DialogDescription>Informe o colaborador e placeholders.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {!documentForm.id && (
              <>
                <div>
                  <Label>Template</Label>
                  <Select
                    value={documentForm.templateId}
                    onValueChange={(value) => setDocumentForm({ ...documentForm, templateId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={hasTemplates ? 'Selecione' : 'Sem templates'} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ID do funcionário</Label>
                  <Input
                    value={documentForm.employeeId}
                    onChange={(event) => setDocumentForm({ ...documentForm, employeeId: event.target.value })}
                    placeholder="employee-id"
                  />
                </div>
                <div>
                  <Label>Titulo (opcional)</Label>
                  <Input
                    value={documentForm.title}
                    onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })}
                    placeholder="TRCT - Fulano"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Mês</Label>
                    <Input
                      type="number"
                      value={documentForm.month}
                      onChange={(event) => setDocumentForm({ ...documentForm, month: event.target.value })}
                      placeholder="02"
                    />
                  </div>
                  <div>
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={documentForm.year}
                      onChange={(event) => setDocumentForm({ ...documentForm, year: event.target.value })}
                      placeholder="2026"
                    />
                  </div>
                </div>
                <div>
                  <Label>Data de evento (opcional)</Label>
                  <Input
                    type="date"
                    value={documentForm.eventDate}
                    onChange={(event) => setDocumentForm({ ...documentForm, eventDate: event.target.value })}
                  />
                </div>
              </>
            )}
            {documentForm.id && (
              <div>
                <Label>conteúdo (opcional)</Label>
                <Textarea
                  value={documentForm.content}
                  onChange={(event) => setDocumentForm({ ...documentForm, content: event.target.value })}
                  rows={6}
                />
              </div>
            )}
            <div>
              <Label>Placeholders (JSON)</Label>
              <Textarea
                value={documentForm.placeholders}
                onChange={(event) => setDocumentForm({ ...documentForm, placeholders: event.target.value })}
                rows={6}
              />
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                value={documentForm.reason}
                onChange={(event) => setDocumentForm({ ...documentForm, reason: event.target.value })}
                placeholder="Justificativa para auditoria"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveDocument()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payloadDialogOpen} onOpenChange={setPayloadDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payload de exportação</DialogTitle>
            <DialogDescription>Dados consolidados para PDF/DOCX.</DialogDescription>
          </DialogHeader>
          <Textarea value={payloadPreview} readOnly rows={12} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayloadDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionsDialogOpen} onOpenChange={setVersionsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{versionsTitle}</DialogTitle>
            <DialogDescription>Últimas movimentações de auditoria.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {versions.length === 0 ? (
              <div className="text-sm text-gray-500">Sem histórico.</div>
            ) : (
              versions.map((version) => (
                <Card key={version.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{version.action}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(version.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {version.reason && (
                      <div className="text-sm text-gray-600">Motivo: {version.reason}</div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default DocumentsCenterPage;



