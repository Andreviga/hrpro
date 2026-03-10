import PDFDocument from 'pdfkit';
import { Payslip } from './types';

const formatCurrency = (value: number | null | undefined, deduction = false) => {
  if (value === null || value === undefined) return '-';
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
  return deduction ? `(${formatted})` : formatted;
};

export const exportPayslipPdf = async (payslip: Payslip) => {
  const doc = new PDFDocument({ size: 'A4', margin: 28 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.font('Helvetica-Bold').fontSize(14).text(payslip.title, { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(10).text(payslip.companyName);
    doc.font('Helvetica').fontSize(9).text(`Endereco: ${payslip.companyAddress ?? 'Nao informado'}`);
    doc.text(`CNPJ: ${payslip.companyCnpj ?? 'Nao informado'}    Competencia: ${payslip.referenceMonth}`);
    doc.moveDown(0.6);

    if (payslip.warnings.length > 0) {
      doc.font('Helvetica-Bold').fillColor('#9a3412').text('Avisos de preenchimento');
      doc.font('Helvetica').fillColor('#1f2937');
      for (const warning of payslip.warnings) {
        doc.text(`- ${warning.message}${warning.fillLocation ? ` | Preencher em ${warning.fillLocation}` : ''}`);
      }
      doc.moveDown(0.6);
    }

    doc.font('Helvetica-Bold').text('Dados do colaborador');
    doc.font('Helvetica');
    doc.text(`Nome: ${payslip.employeeName}`);
    doc.text(`CPF: ${payslip.employeeCpf}`);
    doc.text(`Cargo: ${payslip.employeeRole}`);
    doc.text(`Admissao: ${payslip.admissionDate ?? '-'}`);
    doc.text(`E-mail: ${payslip.email ?? '-'}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').text('Composição de aulas');
    doc.font('Helvetica');
    for (const line of payslip.classComposition) {
      doc.text(
        `${line.description}: qtd ${line.quantity ?? '-'} | unit ${formatCurrency(line.unitValue)} | total ${formatCurrency(line.totalValue)}`
      );
      if (line.note) {
        doc.fillColor('#6b7280').text(`  ${line.note}`).fillColor('#1f2937');
      }
    }
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').text('Proventos');
    doc.font('Helvetica');
    for (const item of payslip.earnings) {
      doc.text(`${item.description}: ${formatCurrency(item.amount)}`);
    }
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').text('Descontos');
    doc.font('Helvetica');
    for (const item of payslip.deductions) {
      doc.text(`${item.description}: ${formatCurrency(item.amount, true)}`);
    }
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').text('Totais');
    doc.font('Helvetica');
    doc.text(`Salário Bruto: ${formatCurrency(payslip.grossSalary)}`);
    doc.text(`Salário Líquido: ${formatCurrency(payslip.netSalary)}`);
    doc.text(`FGTS: ${formatCurrency(payslip.fgts)}`);
    doc.text(`Vale Alimentação: ${formatCurrency(payslip.foodAllowance)}`);
    doc.text(`2ª do 13º: ${formatCurrency(payslip.thirteenthSecondInstallment)}`);
    doc.text(`INSS do 13º: ${formatCurrency(payslip.thirteenthInss, true)}`);
    doc.text(`IRRF do 13º: ${formatCurrency(payslip.thirteenthIrrf, true)}`);
    doc.text(`Base de cálculo: ${formatCurrency(payslip.calculationBase)}`);
    doc.text(`Banco/Agência/Conta: ${payslip.bank ?? '-'} / ${payslip.agency ?? '-'} / ${payslip.account ?? '-'}`);

    doc.end();
  });
};