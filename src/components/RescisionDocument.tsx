/**
 * Componente para exibir documento de rescisão formatado
 * Baseado no modelo TRCT oficial
 */
import React from 'react';
import { RescisionCalculation } from '../services/rescisionApi';

interface RescisionDocumentProps {
  calculation: RescisionCalculation;
}

const RescisionDocument: React.FC<RescisionDocumentProps> = ({ calculation }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getRescisionTypeName = (type: string) => {
    const types = {
      'demissao_sem_justa_causa': 'DESPEDIDA SEM JUSTA CAUSA, PELO EMPREGADOR',
      'pedido_demissao': 'PEDIDO DE DEMISSÃO PELO EMPREGADO',
      'justa_causa': 'DESPEDIDA POR JUSTA CAUSA',
      'acordo_comum': 'RESCISÃO POR ACORDO',
      'rescisao_indireta': 'RESCISÃO INDIRETA'
    };
    return types[type as keyof typeof types] || type;
  };

  return (
    <div className="bg-white p-8 shadow-lg rounded-lg max-w-4xl mx-auto" id="rescision-document">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold mb-2">TERMO DE RESCISÃO DO CONTRATO DE TRABALHO</h1>
      </div>

      {/* Employer Information */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">IDENTIFICAÇÃO DO EMPREGADOR</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>01 CNPJ/CEI:</strong> 20.755.729/0001-85
          </div>
          <div>
            <strong>02 Razão Social/Nome:</strong> RAIZES CENTRO EDUCACIONAL LTDA ME
          </div>
          <div>
            <strong>03 Endereço:</strong> RUA DIOGO DE SOUSA, 251
          </div>
          <div>
            <strong>04 Bairro:</strong> CIDADE LIDER
          </div>
          <div>
            <strong>05 Município:</strong> SÃO PAULO
          </div>
          <div>
            <strong>06 UF:</strong> SP
          </div>
          <div>
            <strong>07 CEP:</strong> 08285-330
          </div>
          <div>
            <strong>08 CNAE:</strong> 8513900
          </div>
        </div>
      </div>

      {/* Employee Information */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">IDENTIFICAÇÃO DO TRABALHADOR</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>10 PIS/PASEP:</strong> {calculation.employee.pis}
          </div>
          <div>
            <strong>11 Nome:</strong> {calculation.employee.name}
          </div>
          <div>
            <strong>12 Endereço:</strong> {calculation.employee.address?.street}, {calculation.employee.address?.number}
          </div>
          <div>
            <strong>13 Bairro:</strong> {calculation.employee.address?.neighborhood}
          </div>
          <div>
            <strong>14 Município:</strong> {calculation.employee.address?.city}
          </div>
          <div>
            <strong>15 UF:</strong> {calculation.employee.address?.state}
          </div>
          <div>
            <strong>16 CEP:</strong> {calculation.employee.address?.zipCode}
          </div>
          <div>
            <strong>17 CTPS:</strong> {calculation.employee.ctps}
          </div>
          <div>
            <strong>18 CPF:</strong> {formatCPF(calculation.employee.cpf)}
          </div>
          <div>
            <strong>19 Data de Nascimento:</strong> {formatDate(calculation.employee.birthDate)}
          </div>
          <div>
            <strong>20 Nome da Mãe:</strong> {calculation.employee.motherName}
          </div>
        </div>
      </div>

      {/* Contract Data */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">DADOS DO CONTRATO</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>21 Tipo de Contrato:</strong> CONTRATO DE TRABALHO INDETERMINADO
          </div>
          <div>
            <strong>22 Causa do Afastamento:</strong> {getRescisionTypeName(calculation.rescisionType)}
          </div>
          <div>
            <strong>23 Remuneração Mês Ant.:</strong> {formatCurrency(calculation.calculation.grossSalary)}
          </div>
          <div>
            <strong>24 Data de Admissão:</strong> {formatDate(calculation.employee.admissionDate)}
          </div>
          <div>
            <strong>25 Data do Aviso Prévio:</strong> {formatDate(calculation.rescisionDate)}
          </div>
          <div>
            <strong>26 Data de Afastamento:</strong> {formatDate(calculation.rescisionDate)}
          </div>
          <div>
            <strong>30 Categoria do Trabalhador:</strong> EMPREGADO 04
          </div>
        </div>
      </div>

      {/* Rescision Values */}
      <div className="mb-6">
        <h3 className="font-bold mb-4">DISCRIMINAÇÃO DAS VERBAS RESCISÓRIAS</h3>
        
        {/* Earnings */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2 text-green-700">VERBAS RESCISÓRIAS</h4>
          <div className="space-y-2 text-sm">
            {calculation.calculation.items
              .filter(item => item.type === 'earning')
              .map((item, index) => (
                <div key={index} className="flex justify-between border-b pb-1">
                  <span><strong>{item.code}</strong> {item.description}</span>
                  <span className="font-mono">{formatCurrency(item.value)}</span>
                </div>
              ))}
            <div className="flex justify-between font-bold border-t pt-2 text-green-700">
              <span>TOTAL BRUTO</span>
              <span className="font-mono">{formatCurrency(calculation.calculation.totalGross)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-4">
          <h4 className="font-semibold mb-2 text-red-700">DEDUÇÕES</h4>
          <div className="space-y-2 text-sm">
            {calculation.calculation.items
              .filter(item => item.type === 'deduction')
              .map((item, index) => (
                <div key={index} className="flex justify-between border-b pb-1">
                  <span><strong>{item.code}</strong> {item.description}</span>
                  <span className="font-mono">-{formatCurrency(item.value)}</span>
                </div>
              ))}
            <div className="flex justify-between font-bold border-t pt-2 text-red-700">
              <span>TOTAL DEDUÇÕES</span>
              <span className="font-mono">-{formatCurrency(calculation.calculation.totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Value */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between text-xl font-bold text-blue-700">
            <span>VALOR LÍQUIDO</span>
            <span className="font-mono">{formatCurrency(calculation.calculation.netValue)}</span>
          </div>
        </div>
      </div>

      {/* FGTS Information */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">INFORMAÇÕES FGTS</h3>
        <div className="grid grid-cols-2 gap-4 text-sm bg-purple-50 p-4 rounded-lg">
          <div>
            <strong>Depósito FGTS (8%):</strong> {formatCurrency(calculation.calculation.fgtsDeposit)}
          </div>
          <div>
            <strong>Multa FGTS:</strong> {formatCurrency(calculation.calculation.fgtsFine)}
          </div>
        </div>
      </div>

      {/* Bank Information */}
      <div className="mb-6">
        <h3 className="font-bold mb-2">DADOS BANCÁRIOS</h3>
        <div className="text-sm">
          <p><strong>Banco:</strong> {calculation.employee.bankData.bank}</p>
          <p><strong>Agência:</strong> {calculation.employee.bankData.agency}</p>
          <p><strong>Conta:</strong> {calculation.employee.bankData.account}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-600">
        <p>Documento gerado automaticamente pelo Sistema HRPro</p>
        <p>Data: {new Date().toLocaleDateString('pt-BR')}</p>
      </div>
    </div>
  );
};

export default RescisionDocument;