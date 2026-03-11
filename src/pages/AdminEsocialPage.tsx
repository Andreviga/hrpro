import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { esocialApi, EsocialDocument, EsocialOccurrence } from '../services/esocialApi';
import { Database, FileWarning, Loader2, RefreshCw, UploadCloud } from 'lucide-react';

const severityBadgeClass: Record<string, string> = {
  ERROR: 'bg-red-100 text-red-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  INFO: 'bg-blue-100 text-blue-800',
  UNKNOWN: 'bg-gray-100 text-gray-800'
};

const processingBadgeClass: Record<string, string> = {
  failed: 'bg-red-100 text-red-800',
  partial: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  unknown: 'bg-gray-100 text-gray-800'
};

const getFriendlyEsocialError = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const rawMessage = error.message || '';

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed?.message) {
      const message = typeof parsed.message === 'string' ? parsed.message : JSON.stringify(parsed.message);
      if (message.toLowerCase().includes('internal server error')) {
        return 'Falha interna ao processar dados do eSocial. Tente novamente em instantes.';
      }
      return message;
    }
  } catch {
    // not a json payload
  }

  if (rawMessage.toLowerCase().includes('internal server error')) {
    return 'Falha interna ao processar dados do eSocial. Tente novamente em instantes.';
  }

  return rawMessage || fallback;
};

const AdminEsocialPage: React.FC = () => {
  const [xmlInput, setXmlInput] = useState('');
  const [sourceLabel, setSourceLabel] = useState('manual-import');
  const [validateXsd, setValidateXsd] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [documents, setDocuments] = useState<EsocialDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<EsocialDocument | null>(null);
  const [selectedOccurrences, setSelectedOccurrences] = useState<EsocialOccurrence[]>([]);

  const [globalOccurrences, setGlobalOccurrences] = useState<EsocialOccurrence[]>([]);
  const [globalOccurrencesLoading, setGlobalOccurrencesLoading] = useState(false);

  const [documentFilters, setDocumentFilters] = useState({
    processingResult: 'all',
    documentType: 'all',
    workerCpf: ''
  });

  const [occurrenceFilters, setOccurrenceFilters] = useState({
    severity: 'all',
    code: ''
  });

  const loadDocuments = async () => {
    try {
      setDocumentsLoading(true);
      const data = await esocialApi.getDocuments({
        page: 1,
        pageSize: 30,
        processingResult:
          documentFilters.processingResult === 'all' ? undefined : documentFilters.processingResult,
        documentType: documentFilters.documentType === 'all' ? undefined : documentFilters.documentType,
        workerCpf: documentFilters.workerCpf || undefined
      });
      setDocuments(data.items);
    } catch (error) {
      setFeedback(getFriendlyEsocialError(error, 'Erro ao carregar documentos do eSocial.'));
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadGlobalOccurrences = async () => {
    try {
      setGlobalOccurrencesLoading(true);
      const data = await esocialApi.getOccurrences({
        page: 1,
        pageSize: 50,
        severity: occurrenceFilters.severity === 'all' ? undefined : occurrenceFilters.severity,
        code: occurrenceFilters.code || undefined
      });
      setGlobalOccurrences(data.items);
    } catch (error) {
      setFeedback(getFriendlyEsocialError(error, 'Erro ao carregar ocorrencias do eSocial.'));
    } finally {
      setGlobalOccurrencesLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [documentFilters.processingResult, documentFilters.documentType, documentFilters.workerCpf]);

  useEffect(() => {
    loadGlobalOccurrences();
  }, [occurrenceFilters.severity, occurrenceFilters.code]);

  const handleImport = async () => {
    if (!file && !xmlInput.trim()) {
      setFeedback('Informe um XML no campo de texto ou selecione um arquivo.');
      return;
    }

    try {
      setImporting(true);
      setFeedback(null);

      const result = await esocialApi.importXml({
        xml: file ? undefined : xmlInput,
        file,
        validateXsd,
        sourceLabel
      });

      if (result.duplicated) {
        setFeedback('XML ja importado anteriormente. O sistema retornou o documento existente.');
      } else {
        setFeedback('XML importado com sucesso.');
      }

      setSelectedDocument(result.document);
      setSelectedOccurrences(result.document.occurrences ?? []);
      await loadDocuments();
      await loadGlobalOccurrences();
    } catch (error) {
      setFeedback(getFriendlyEsocialError(error, 'Falha ao importar XML do eSocial.'));
    } finally {
      setImporting(false);
    }
  };

  const handleSelectDocument = async (documentId: string) => {
    try {
      const [document, occurrences] = await Promise.all([
        esocialApi.getDocument(documentId),
        esocialApi.getDocumentOccurrences(documentId)
      ]);
      setSelectedDocument(document);
      setSelectedOccurrences(occurrences);
    } catch (error) {
      setFeedback(getFriendlyEsocialError(error, 'Erro ao carregar detalhes do documento.'));
    }
  };

  const syncDefaultCatalog = async () => {
    try {
      const result = await esocialApi.syncCatalog();
      setFeedback(`Catalogo sincronizado (${result.syncedCount} mensagens).`);
      await loadGlobalOccurrences();
    } catch (error) {
      setFeedback(getFriendlyEsocialError(error, 'Falha ao sincronizar catalogo.'));
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Monitor eSocial</h1>
            <p className="text-gray-600">Importacao, auditoria e interpretacao de retornos XML com todas as ocorrencias.</p>
          </div>
          <Button variant="outline" onClick={syncDefaultCatalog}>
            <Database className="h-4 w-4 mr-2" />
            Sincronizar Catalogo
          </Button>
        </div>

        {feedback && (
          <Alert>
            <FileWarning className="h-4 w-4" />
            <AlertDescription>{feedback}</AlertDescription>
          </Alert>
        )}

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4 text-sm text-blue-900 space-y-1">
            <p>Como usar: envie um XML de evento/retorno do eSocial por arquivo ou colagem no campo de texto.</p>
            <p>Formato aceito: arquivo .xml valido. Recomendacao: usar arquivos oficiais exportados do ambiente de folha/eSocial.</p>
            <p>Fluxo sugerido: importar XML, revisar ocorrencias e depois sincronizar catalogo para enriquecer mensagens.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar XML eSocial</CardTitle>
            <CardDescription>Envie XML por texto ou arquivo. O sistema detecta o tipo automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Origem</Label>
                <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="ex: retorno-api-esocial" />
              </div>
              <div>
                <Label>Arquivo XML</Label>
                <Input type="file" accept=".xml,text/xml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div>
              <Label>XML bruto</Label>
              <Textarea
                value={xmlInput}
                onChange={(e) => setXmlInput(e.target.value)}
                placeholder="Cole aqui o XML do eSocial"
                className="min-h-[180px] font-mono text-xs"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox checked={validateXsd} onCheckedChange={(checked) => setValidateXsd(checked === true)} />
              <Label>Validar contra XSD quando houver schema local</Label>
            </div>

            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
              Importar XML
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="occurrences">Ocorrencias</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label>Resultado</Label>
                    <Select
                      value={documentFilters.processingResult}
                      onValueChange={(value) => setDocumentFilters({ ...documentFilters, processingResult: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo de documento</Label>
                    <Select
                      value={documentFilters.documentType}
                      onValueChange={(value) => setDocumentFilters({ ...documentFilters, documentType: value })}
                    >
                      <SelectTrigger className="w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="event_xml">Evento enviado</SelectItem>
                        <SelectItem value="lote_envio">Envio de lote</SelectItem>
                        <SelectItem value="retorno_recepcao_lote">Retorno de recepcao</SelectItem>
                        <SelectItem value="retorno_processamento_lote">Retorno processamento lote</SelectItem>
                        <SelectItem value="retorno_processamento_evento">Retorno processamento evento</SelectItem>
                        <SelectItem value="consulta">Consulta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>CPF trabalhador</Label>
                    <Input
                      value={documentFilters.workerCpf}
                      onChange={(e) => setDocumentFilters({ ...documentFilters, workerCpf: e.target.value })}
                      placeholder="Somente numeros"
                    />
                  </div>

                  <Button variant="outline" onClick={loadDocuments}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {documentsLoading ? (
                  <div className="flex items-center text-sm text-gray-600"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</div>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="border rounded-lg p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{doc.documentType}</span>
                            <Badge className={processingBadgeClass[doc.processingResult] || processingBadgeClass.unknown}>
                              {doc.processingResult}
                            </Badge>
                            <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Evento: {doc.eventType || '--'} | Recibo: {doc.receiptNumber || '--'} | Protocolo: {doc.protocolNumber || '--'}
                          </div>
                          <div className="text-xs text-gray-500">
                            Ocorrencias: {doc._count?.occurrences ?? doc.occurrences?.length ?? 0}
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => handleSelectDocument(doc.id)}>Ver detalhes</Button>
                      </div>
                    ))}
                    {documents.length === 0 && <p className="text-sm text-gray-500">Nenhum documento encontrado.</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="occurrences" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label>Severidade</Label>
                    <Select
                      value={occurrenceFilters.severity}
                      onValueChange={(value) => setOccurrenceFilters({ ...occurrenceFilters, severity: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="ERROR">ERROR</SelectItem>
                        <SelectItem value="WARNING">WARNING</SelectItem>
                        <SelectItem value="INFO">INFO</SelectItem>
                        <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Codigo</Label>
                    <Input
                      value={occurrenceFilters.code}
                      onChange={(e) => setOccurrenceFilters({ ...occurrenceFilters, code: e.target.value })}
                      placeholder="Ex: MS0155"
                    />
                  </div>
                  <Button variant="outline" onClick={loadGlobalOccurrences}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-2">
                {globalOccurrencesLoading ? (
                  <div className="flex items-center text-sm text-gray-600"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</div>
                ) : (
                  globalOccurrences.map((occurrence) => (
                    <div key={occurrence.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={severityBadgeClass[occurrence.severity] || severityBadgeClass.UNKNOWN}>
                          {occurrence.severity}
                        </Badge>
                        <span className="font-medium">{occurrence.code || '--'}</span>
                        <span className="text-xs text-gray-500">{occurrence.sourceType}</span>
                      </div>
                      <p className="text-sm">{occurrence.description}</p>
                      {occurrence.location && <p className="text-xs text-gray-500 mt-1">Localizacao: {occurrence.location}</p>}
                      {occurrence.suggestedAction && <p className="text-xs text-blue-700 mt-1">Sugestao: {occurrence.suggestedAction}</p>}
                    </div>
                  ))
                )}
                {!globalOccurrencesLoading && globalOccurrences.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma ocorrencia encontrada para os filtros atuais.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            {!selectedDocument ? (
              <Card>
                <CardContent className="pt-6 text-sm text-gray-600">
                  Selecione um documento na aba "Documentos" para visualizar detalhes e auditoria completa.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Documento Selecionado</CardTitle>
                    <CardDescription>ID: {selectedDocument.id}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>Tipo: <strong>{selectedDocument.documentType}</strong></div>
                    <div>Evento: <strong>{selectedDocument.eventType || '--'}</strong></div>
                    <div>Recibo: <strong>{selectedDocument.receiptNumber || '--'}</strong></div>
                    <div>Protocolo: <strong>{selectedDocument.protocolNumber || '--'}</strong></div>
                    <div>Status: <strong>{selectedDocument.statusCode || '--'} - {selectedDocument.statusDescription || '--'}</strong></div>
                    <div>Resultado: <strong>{selectedDocument.processingResult}</strong></div>
                    <div>XSD: <strong>{selectedDocument.xsdValidationStatus || 'skipped'}</strong></div>
                    <div>Layout: <strong>{selectedDocument.layoutVersion || '--'}</strong></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ocorrencias do Documento ({selectedOccurrences.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedOccurrences.map((occurrence) => (
                      <div key={occurrence.id} className="border rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={severityBadgeClass[occurrence.severity] || severityBadgeClass.UNKNOWN}>
                            {occurrence.severity}
                          </Badge>
                          <span className="font-medium">{occurrence.code || '--'}</span>
                          <span className="text-xs text-gray-500">{occurrence.occurrenceTypeLabel || 'UNKNOWN'}</span>
                        </div>
                        <p className="text-sm">{occurrence.description}</p>
                        {occurrence.location && <p className="text-xs text-gray-500 mt-1">Localizacao: {occurrence.location}</p>}
                        {occurrence.logicalXpath && <p className="text-xs text-gray-500">XPath logico: {occurrence.logicalXpath}</p>}
                      </div>
                    ))}
                    {selectedOccurrences.length === 0 && <p className="text-sm text-gray-500">Sem ocorrencias extraidas.</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>XML Bruto (auditoria)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea readOnly value={selectedDocument.rawXml} className="min-h-[240px] font-mono text-xs" />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminEsocialPage;
