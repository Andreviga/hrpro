/**
 * Página administrativa para upload e processamento de planilhas de folha de pagamento
 * Permite que administradores importem dados de Excel para o sistema
 */
import React, { useState } from 'react';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { apiService } from '../services/api';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Info
} from 'lucide-react';

const AdminPayrollUploadPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    processedRows: number;
    failedRows: number;
    errors: string[];
  } | null>(null);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar se é um arquivo Excel
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.ms-excel.sheet.macroEnabled.12'
      ];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm')) {
        setSelectedFile(file);
        setUploadResult(null);
      } else {
        alert('Por favor, selecione um arquivo Excel válido (.xlsx, .xls ou .xlsm)');
        event.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const result = await apiService.uploadPayroll(selectedFile);
      setUploadResult(result);
    } catch (error) {
      const message = getFriendlyError(error, 'Erro interno do servidor');
      setUploadResult({
        success: false,
        message,
        processedRows: 0,
        failedRows: 0,
        errors: [message]
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload de Folha de Pagamento</h1>
            <p className="text-gray-600 mt-1">
              Faça o upload de planilhas Excel para processar a folha de pagamento dos funcionários
            </p>
          </div>

          {/* Instructions Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-800">
                <Info className="h-5 w-5" />
                <span>Instruções de Upload</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-blue-700">
              <ul className="space-y-2 text-sm">
                <li>• O arquivo deve estar no formato Excel (.xlsx ou .xls)</li>
                <li>• A primeira linha deve conter os cabeçalhos das colunas</li>
                <li>• Certifique-se de que os CPFs dos funcionários estão corretos</li>
                <li>• Os valores devem estar em formato numérico (sem símbolos de moeda)</li>
                <li>• Funcionários não cadastrados no sistema serão ignorados</li>
              </ul>
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivo</CardTitle>
              <CardDescription>
                Escolha a planilha Excel com os dados da folha de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-input">Arquivo Excel</Label>
                <Input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.xlsm"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </div>

              {selectedFile && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {!uploading && (
                    <Button variant="ghost" size="sm" onClick={resetUpload}>
                      Remover
                    </Button>
                  )}
                </div>
              )}

              <div className="flex space-x-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Processar Folha
                    </>
                  )}
                </Button>
                
                {selectedFile && !uploading && (
                  <Button variant="outline" onClick={resetUpload}>
                    Cancelar
                  </Button>
                )}
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processando planilha...</span>
                    <span>Aguarde</span>
                  </div>
                  <Progress value={undefined} className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {uploadResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span>Resultado do Processamento</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant={uploadResult.success ? "default" : "destructive"}>
                  <AlertDescription>
                    {uploadResult.message}
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Linhas Processadas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {uploadResult.processedRows}
                    </p>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Linhas com Erro</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      {uploadResult.failedRows}
                    </p>
                  </div>
                </div>

                {uploadResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Erros Encontrados</span>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded-lg max-h-40 overflow-y-auto">
                      <ul className="space-y-1 text-sm text-yellow-800">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button onClick={resetUpload} className="flex-1">
                    Processar Nova Planilha
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#/paystubs">Ver Holerites</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sample Data Card */}
          <Card>
            <CardHeader>
              <CardTitle>Estrutura da Planilha</CardTitle>
              <CardDescription>
                Exemplo de como a planilha deve ser estruturada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">CPF</th>
                      <th className="px-3 py-2 text-left">Mês</th>
                      <th className="px-3 py-2 text-left">Ano</th>
                      <th className="px-3 py-2 text-left">Salário Base</th>
                      <th className="px-3 py-2 text-left">Horas Extras</th>
                      <th className="px-3 py-2 text-left">INSS</th>
                      <th className="px-3 py-2 text-left">IRRF</th>
                      <th className="px-3 py-2 text-left">...</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr className="border-t">
                      <td className="px-3 py-2">123.456.789-00</td>
                      <td className="px-3 py-2">11</td>
                      <td className="px-3 py-2">2024</td>
                      <td className="px-3 py-2">5000.00</td>
                      <td className="px-3 py-2">300.00</td>
                      <td className="px-3 py-2">550.00</td>
                      <td className="px-3 py-2">125.50</td>
                      <td className="px-3 py-2">...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default AdminPayrollUploadPage;
