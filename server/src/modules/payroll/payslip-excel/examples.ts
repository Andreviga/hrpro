import path from 'path';
import { buildPayslipFromExcel } from './payslip-builder';
import { loadWorkbook } from './excel-reader';

export const REAL_PAYSLIP_EXAMPLES = [
  {
    name: 'ANDRÉ LUCAS BARBOSA DE OLIVEIRA',
    cpf: '480.318.238-80'
  },
  {
    name: 'NATHALIA DE OLIVEIRA PRESSINOTTE',
    cpf: '486.807.758-94'
  }
];

export const buildExamplePayslips = async (filePath: string) => {
  const workbook = await loadWorkbook(filePath);
  return REAL_PAYSLIP_EXAMPLES.map((employee) =>
    buildPayslipFromExcel({
      workbook,
      employeeKey: { cpf: employee.cpf, name: employee.name }
    })
  );
};

export const defaultExampleWorkbookPath = path.resolve(
  __dirname,
  '../../../../Folha de pagamento de fevereiro 2026.xlsm'
);