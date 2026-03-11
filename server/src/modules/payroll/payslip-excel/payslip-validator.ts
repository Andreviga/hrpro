import { Payslip } from './types';

export class PayslipValidationException extends Error {
  constructor(
    public readonly missingFields: string[],
    public readonly sourceHints: Record<string, string>
  ) {
    super(`Holerite incompleto. Campos ausentes: ${missingFields.join(', ')}`);
    this.name = 'PayslipValidationException';
  }
}

export const validatePayslipBeforeRender = (payslip: Payslip): void => {
  const missing: string[] = [];
  const hints: Record<string, string> = {};

  const check = (fieldLabel: string, value: unknown, hint: string) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      missing.push(fieldLabel);
      hints[fieldLabel] = hint;
    }
  };

  const checkPlaceholder = (fieldLabel: string, value: string | null | undefined, hint: string) => {
    if (!value || value.startsWith('PREENCHER_') || value.startsWith('FUNCIONARIO_NAO') || value.startsWith('CPF_NAO') || value.startsWith('CARGO_NAO') || value.startsWith('EMPRESA_NAO')) {
      missing.push(fieldLabel);
      hints[fieldLabel] = hint;
    }
  };

  checkPlaceholder('companyName', payslip.companyName, 'Tabela35 > coluna Empresa');
  check('companyCnpj', payslip.companyCnpj, 'server/src/modules/payroll/payslip-excel/company-registry.ts');
  check('companyAddress', payslip.companyAddress, 'server/src/modules/payroll/payslip-excel/company-registry.ts');
  checkPlaceholder('employeeName', payslip.employeeName, 'Tabela1 > coluna Nome');
  checkPlaceholder('employeeCpf', payslip.employeeCpf, 'Tabela1 > coluna CPF');
  checkPlaceholder('employeeRole', payslip.employeeRole, 'Tabela2 > coluna Cargo');
  check('referenceMonth', payslip.referenceMonth, 'Parâmetro competência passado ao buildPayslip');
  check('grossSalary', payslip.grossSalary, 'Tabela35 > coluna VALOR ou Tabela2 > coluna Salário Base');
  check('netSalary', payslip.netSalary, 'Tabela35 > coluna Salário Líquído');

  if (missing.length > 0) {
    throw new PayslipValidationException(missing, hints);
  }
};
