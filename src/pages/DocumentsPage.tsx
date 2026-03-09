// @ts-nocheck
/**
 * Página de gerenciamento de documentos
 * Interface para visualização, upload e assinatura de documentos
 */
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { documentsApi, Document, Notice, BenefitRequest } from '../services/documentsApi';
import { 
  FileText,
  Upload,
  Download,
  Eye,
  PenTool,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Search,
  Plus,
  Loader2,
  Shield,
  Bell,
  CreditCard,
  Bus,
  Utensils
} from 'lucide-react';

const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [benefitRequests, setBenefitRequests] = useState<BenefitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    category: 'all'
  });

  // Upload states
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    type: 'other' as Document['type'],
    category: '',
    isRequired: false,
    requiresSignature: false,
    expiryDate: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Signature states
  const [signingDocument, setSigningDocument] = useState<number | null>(null);
  const [signatureToken, setSignatureToken] = useState('');
  const [generatingToken, setGeneratingToken] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [docsData, noticesData, benefitsData] = await Promise.all([
        documentsApi.getDocuments(filters),
        documentsApi.getNotices(),
        documentsApi.getBenefitRequests()
      ]);
      setDocuments(docsData);
      setNotices(noticesData);
      setBenefitRequests(benefitsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await documentsApi.uploadDocument({
        ...uploadData,
        file: selectedFile
      });
      
      setShowUpload(false);
      setUploadData({
        title: '',
        description: '',
        type: 'other',
        category: '',
        isRequired: false,
        requiresSignature: false,
        expiryDate: ''
      });
      setSelectedFile(null);
      loadData();
    } catch (error) {
      console.error('Erro no upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateToken = async (documentId: number) => {
    setGeneratingToken(true);
    try {
      const token = await documentsApi.generateSignatureToken(documentId);
      alert(`Token enviado para seu celular: ${token}`);
      setSigningDocument(documentId);
    } catch (error) {
      console.error('Erro ao gerar token:', error);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleSignDocument = async () => {
    if (!signingDocument || !signatureToken) return;

    setValidatingToken(true);
    try {
      const isValid = await documentsApi.validateSignatureToken(signingDocument, signatureToken);
      if (isValid) {
        await documentsApi.signDocument(signingDocument, 'token');
        setSigningDocument(null);
        setSignatureToken('');
        loadData();
        alert('Documento assinado com sucesso!');
      } else {
        alert('Token inválido. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro na assinatura:', error);
    } finally {
      setValidatingToken(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      signed: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      rejected: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      signed: <CheckCircle className="h-4 w-4" />,
      expired: <XCircle className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />
    };
    return icons[status as keyof typeof icons] || <Clock className="h-4 w-4" />;
  };

  const getNoticeTypeColor = (type: string) => {
    const colors = {
      info: 'bg-blue-100 text-blue-800',
      warning: 'bg-yellow-100 text-yellow-800',
      urgent: 'bg-red-100 text-red-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Carregando documentos...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Documentos e Avisos</h1>
            <p className="text-gray-600 mt-1">
              Gerencie documentos, avisos e solicitações de benefícios
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="documents" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="notices" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>Avisos</span>
            </TabsTrigger>
            <TabsTrigger value="benefits" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Benefícios</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </TabsTrigger>
          </TabsList>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="signed">Assinado</SelectItem>
                        <SelectItem value="expired">Expirado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="contract">Contratos</SelectItem>
                      <SelectItem value="policy">Políticas</SelectItem>
                      <SelectItem value="notice">Avisos</SelectItem>
                      <SelectItem value="other">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Documents List */}
            <div className="space-y-4">
              {documents.map((document) => (
                <Card key={document.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{document.title}</h3>
                          <Badge className={getStatusColor(document.status)}>
                            {getStatusIcon(document.status)}
                            <span className="ml-1 capitalize">{document.status}</span>
                          </Badge>
                          {document.isRequired && (
                            <Badge variant="secondary">Obrigatório</Badge>
                          )}
                          {document.requiresSignature && (
                            <Badge className="bg-purple-100 text-purple-800">
                              <PenTool className="h-3 w-3 mr-1" />
                              Requer Assinatura
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3">{document.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{document.fileName}</span>
                          <span>{formatFileSize(document.fileSize)}</span>
                          <span>Enviado em {new Date(document.uploadDate).toLocaleDateString('pt-BR')}</span>
                          <span>Por {document.uploadedBy}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Visualizar
                        </Button>
                        
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        
                        {document.requiresSignature && document.status === 'pending' && (
                          <Button 
                            size="sm"
                            onClick={() => handleGenerateToken(document.id)}
                            disabled={generatingToken}
                          >
                            {generatingToken ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <PenTool className="h-4 w-4 mr-1" />
                            )}
                            Assinar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {documents.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum documento encontrado
                    </h3>
                    <p className="text-gray-600">
                      Não há documentos que correspondam aos filtros aplicados.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Notices Tab */}
          <TabsContent value="notices" className="space-y-4">
            <div className="space-y-4">
              {notices.map((notice) => (
                <Card key={notice.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{notice.title}</h3>
                          <Badge className={getNoticeTypeColor(notice.type)}>
                            {notice.type.toUpperCase()}
                          </Badge>
                          {notice.isRecurring && (
                            <Badge variant="outline">Recorrente</Badge>
                          )}
                        </div>
                        
                        <p className="text-gray-700 mb-3">{notice.content}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Por {notice.createdBy}</span>
                          <span>{new Date(notice.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span>Audiência: {notice.targetAudience === 'all' ? 'Todos' : notice.targetAudience}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {notices.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum aviso disponível
                    </h3>
                    <p className="text-gray-600">
                      Não há avisos ativos no momento.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Benefits Tab */}
          <TabsContent value="benefits" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transport Voucher */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Bus className="h-5 w-5 text-blue-600" />
                    <span>Vale Transporte</span>
                  </CardTitle>
                  <CardDescription>
                    Solicite seu vale transporte mensal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Solicitação
                  </Button>
                </CardContent>
              </Card>

              {/* Meal Voucher */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Utensils className="h-5 w-5 text-green-600" />
                    <span>Vale Alimentação</span>
                  </CardTitle>
                  <CardDescription>
                    Solicite seu vale alimentação mensal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Solicitação
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Requests History */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Solicitações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {benefitRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {request.type === 'transport' ? 'Vale Transporte' : 
                           request.type === 'meal' ? 'Vale Alimentação' : 
                           'Vale Transporte + Alimentação'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Solicitado em {new Date(request.requestDate).toLocaleDateString('pt-BR')}
                        </p>
                        {request.transportValue && (
                          <p className="text-sm text-gray-600">
                            Transporte: {formatCurrency(request.transportValue)}
                          </p>
                        )}
                        {request.mealValue && (
                          <p className="text-sm text-gray-600">
                            Alimentação: {formatCurrency(request.mealValue)}
                          </p>
                        )}
                      </div>
                      <Badge className={getStatusColor(request.status)}>
                        {request.status === 'pending' ? 'Pendente' :
                         request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </Badge>
                    </div>
                  ))}

                  {benefitRequests.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="h-8 w-8 mx-auto mb-2" />
                      <p>Nenhuma solicitação encontrada</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Documento</CardTitle>
                <CardDescription>
                  Envie novos documentos para o sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doc-title">Título</Label>
                    <Input
                      id="doc-title"
                      value={uploadData.title}
                      onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
                      placeholder="Título do documento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doc-type">Tipo</Label>
                    <Select value={uploadData.type} onValueChange={(value) => setUploadData({...uploadData, type: value as Document['type']})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contrato</SelectItem>
                        <SelectItem value="policy">Política</SelectItem>
                        <SelectItem value="notice">Aviso</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-description">Descrição</Label>
                  <Textarea
                    id="doc-description"
                    value={uploadData.description}
                    onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                    placeholder="Descrição do documento"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-file">Arquivo</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is-required"
                      checked={uploadData.isRequired}
                      onCheckedChange={(checked) => setUploadData({...uploadData, isRequired: checked as boolean})}
                    />
                    <Label htmlFor="is-required" className="text-sm">Obrigatório</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requires-signature"
                      checked={uploadData.requiresSignature}
                      onCheckedChange={(checked) => setUploadData({...uploadData, requiresSignature: checked as boolean})}
                    />
                    <Label htmlFor="requires-signature" className="text-sm">Requer Assinatura</Label>
                  </div>
                </div>

                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || !selectedFile || !uploadData.title}
                  className="w-full"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Fazer Upload
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Digital Signature Modal */}
        {signingDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span>Assinatura Digital</span>
                </CardTitle>
                <CardDescription>
                  Digite o token enviado para seu celular
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signature-token">Token de Verificação</Label>
                  <Input
                    id="signature-token"
                    value={signatureToken}
                    onChange={(e) => setSignatureToken(e.target.value)}
                    placeholder="Digite o token de 6 dígitos"
                    maxLength={6}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button 
                    onClick={handleSignDocument}
                    disabled={validatingToken || signatureToken.length !== 6}
                    className="flex-1"
                  >
                    {validatingToken ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PenTool className="h-4 w-4 mr-2" />
                    )}
                    Assinar
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSigningDocument(null);
                      setSignatureToken('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DocumentsPage;
