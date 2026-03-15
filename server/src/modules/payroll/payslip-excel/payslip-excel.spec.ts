import path from 'path';
import { buildExamplePayslips, buildPayslipFromExcel, exportPayslipPdf, loadWorkbook, readNamedTable, renderPayslipHtml } from './index';

const workbookPath = path.resolve(__dirname, '../../../../../Folha de pagamento de fevereiro 2026.xlsm');

describe('payslip excel module', () => {
  it('reads named excel tables from the xlsm workbook', async () => {
    const workbook = await loadWorkbook(workbookPath);
    const registration = readNamedTable(workbook, 'Cadastro Funcionários', 'Tabela1');
    const classes = readNamedTable(workbook, 'Quantidade de aula 0125', 'Tabela2');

    expect(registration.headers).toEqual(expect.arrayContaining(['Nome', 'CPF', 'BANCO']));
    expect(classes.headers).toEqual(expect.arrayContaining(['Professor', 'Disciplina', 'Salário Bruto']));
    expect(registration.rows.length).toBeGreaterThan(1);
  });

  it('builds a real payslip for André without registry fill warnings', async () => {
    const workbook = await loadWorkbook(workbookPath);
    const payslip = buildPayslipFromExcel({
      workbook,
      employeeKey: { cpf: '480.318.238-80', name: 'ANDRÉ LUCAS BARBOSA DE OLIVEIRA' }
    });

    expect(payslip.employeeName).toBe('ANDRÉ LUCAS BARBOSA DE OLIVEIRA');
    expect(payslip.companyName).toBe('RAIZES CENTRO EDUCACIONAL LTDA ME');
    expect(payslip.companyCnpj).toBe('20.755.729/0001-85');
    expect(payslip.bank).toBe('ITAU');
    expect(payslip.warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'COMPANY_ADDRESS_FILL_REQUIRED',
          fillLocation: 'server/src/modules/payroll/payslip-excel/company-registry.ts'
        })
      ])
    );
  });

  it('builds example payslips for André and Nathalia and renders deductions with parentheses', async () => {
    const payslips = await buildExamplePayslips(workbookPath);
    expect(payslips).toHaveLength(2);
    expect(payslips[1].employeeName).toBe('NATHALIA DE OLIVEIRA PRESSINOTTE');

    const html = renderPayslipHtml(payslips[0]);
    expect(html).toContain('DEMONSTRATIVO DE PAGAMENTO');
    expect(html).toContain('(R$');
  });

  it('exports a pdf buffer for the generated payslip', async () => {
    const workbook = await loadWorkbook(workbookPath);
    const payslip = buildPayslipFromExcel({
      workbook,
      employeeKey: { name: 'NATHALIA DE OLIVEIRA PRESSINOTTE' }
    });

    const pdf = await exportPayslipPdf(payslip);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});