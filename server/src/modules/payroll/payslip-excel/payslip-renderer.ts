import { Payslip, PayrollItem } from './types';

const formatCurrency = (value: number | null | undefined, options?: { deduction?: boolean }) => {
  if (value === null || value === undefined) {
    return ' - ';
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

  return options?.deduction ? `(${formatted})` : formatted;
};

const renderPayrollRows = (items: PayrollItem[], type: 'earning' | 'deduction') => {
  const filtered = items.filter((item) => item.type === type && item.amount > 0);
  if (filtered.length === 0) {
    return '<tr><td colspan="2">-</td></tr>';
  }

  return filtered
    .sort((left, right) => left.order - right.order)
    .map(
      (item) =>
        `<tr><td>${item.description}</td><td style="text-align:right;">${formatCurrency(item.amount, { deduction: type === 'deduction' })}</td></tr>`
    )
    .join('');
};

export const renderPayslipHtml = (payslip: Payslip) => {
  const warningsHtml = payslip.warnings.length
    ? `<section class="warnings"><h3>Avisos de preenchimento</h3><ul>${payslip.warnings
        .map(
          (warning) =>
            `<li><strong>${warning.code}</strong>: ${warning.message}${warning.fillLocation ? ` <em>Preencher em ${warning.fillLocation}</em>` : ''}</li>`
        )
        .join('')}</ul></section>`
    : '';

  const classRows = payslip.classComposition.length
    ? payslip.classComposition
        .map(
          (line) =>
            `<tr><td>${line.description}</td><td>${line.quantity ?? '-'}</td><td>${formatCurrency(line.unitValue)}</td><td>${formatCurrency(line.totalValue)}</td></tr>${
              line.note ? `<tr><td colspan="4" class="note">${line.note}</td></tr>` : ''
            }`
        )
        .join('')
    : '<tr><td colspan="4">-</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${payslip.title}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
    h1, h2, h3 { margin: 0 0 8px; }
    .header, .grid, .summary, .warnings { margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 4px; font-size: 12px; }
    th { text-align: left; background: #f9fafb; }
    .totals td { font-weight: bold; }
    .note { font-style: italic; color: #6b7280; }
    .warnings { background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 12px; }
    .muted { color: #6b7280; }
  </style>
</head>
<body>
  <section class="header card">
    <h1>${payslip.title}</h1>
    <div><strong>${payslip.companyName}</strong></div>
    <div>${payslip.companyAddress ?? 'Endereco nao informado'}</div>
    <div>CNPJ: ${payslip.companyCnpj ?? 'Nao informado'} | Competência: ${payslip.referenceMonth}</div>
  </section>

  ${warningsHtml}

  <section class="grid">
    <div class="card">
      <h3>Dados do colaborador</h3>
      <div>Nome: ${payslip.employeeName}</div>
      <div>CPF: ${payslip.employeeCpf}</div>
      <div>Cargo: ${payslip.employeeRole}</div>
      <div>Admissão: ${payslip.admissionDate ?? '-'}</div>
      <div>E-mail: ${payslip.email ?? '-'}</div>
    </div>
    <div class="card">
      <h3>Dados bancários</h3>
      <div>Banco: ${payslip.bank ?? '-'}</div>
      <div>Agência: ${payslip.agency ?? '-'}</div>
      <div>Conta: ${payslip.account ?? '-'}</div>
      <div>PIX: ${payslip.pix ?? '-'}</div>
    </div>
  </section>

  <section class="card">
    <h3>Composição de aulas</h3>
    <table>
      <thead>
        <tr><th>Descrição</th><th>Quantidade</th><th>Valor unitário</th><th>Valor total</th></tr>
      </thead>
      <tbody>${classRows}</tbody>
    </table>
  </section>

  <section class="grid">
    <div class="card">
      <h3>Proventos</h3>
      <table><tbody>${renderPayrollRows(payslip.earnings, 'earning')}</tbody></table>
    </div>
    <div class="card">
      <h3>Descontos</h3>
      <table><tbody>${renderPayrollRows(payslip.deductions, 'deduction')}</tbody></table>
    </div>
  </section>

  <section class="card summary">
    <h3>Totais</h3>
    <table>
      <tbody>
        <tr class="totals"><td>Salário Bruto</td><td style="text-align:right;">${formatCurrency(payslip.grossSalary)}</td></tr>
        <tr class="totals"><td>Salário Líquido</td><td style="text-align:right;">${formatCurrency(payslip.netSalary)}</td></tr>
        <tr><td>FGTS</td><td style="text-align:right;">${formatCurrency(payslip.fgts)}</td></tr>
        <tr><td>Vale Alimentação</td><td style="text-align:right;">${formatCurrency(payslip.foodAllowance)}</td></tr>
        <tr><td>2ª parcela do 13º</td><td style="text-align:right;">${formatCurrency(payslip.thirteenthSecondInstallment)}</td></tr>
        <tr><td>INSS do 13º</td><td style="text-align:right;">${formatCurrency(payslip.thirteenthInss, { deduction: true })}</td></tr>
        <tr><td>IRRF do 13º</td><td style="text-align:right;">${formatCurrency(payslip.thirteenthIrrf, { deduction: true })}</td></tr>
        <tr><td>Base de cálculo</td><td style="text-align:right;">${formatCurrency(payslip.calculationBase)}</td></tr>
      </tbody>
    </table>
  </section>
</body>
</html>`;
};