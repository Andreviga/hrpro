import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Payslip, PayslipClassCompositionLine, PayslipRubric } from './payslip-data.builder';

const fixedClassRows: Array<{ code: string; description: string }> = [
  { code: '1', description: 'ENSINO INFANTIL' },
  { code: '2', description: 'ENSINO FUNDAMENTAL I' },
  { code: '3', description: 'ENSINO FUNDAMENTAL II' },
  { code: '4', description: 'ENSINO MEDIO' },
  { code: '5', description: 'RO' },
  { code: '6', description: 'AD FUNCAO / TURNO' }
];

const cssSearchPaths = [
  join(__dirname, 'templates', 'payslip-print.css'),
  join(process.cwd(), 'src', 'modules', 'documents', 'templates', 'payslip-print.css'),
  join(process.cwd(), 'server', 'src', 'modules', 'documents', 'templates', 'payslip-print.css')
];

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const asText = (value: unknown, fallback = '-') => {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
};

const toMoney = (value: number | null | undefined, asDeduction = false) => {
  const amount = Number(value ?? 0);
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number.isFinite(amount) ? amount : 0);

  return asDeduction ? `(${formatted})` : formatted;
};

const toNumber = (value: number | null | undefined) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
};

const monthLabel = (month: number, year: number) => `${String(month).padStart(2, '0')}/${year}`;

const normalizeClassRows = (rows: PayslipClassCompositionLine[]) => {
  const map = new Map(rows.map((row) => [row.description.toUpperCase(), row]));
  return fixedClassRows.map((line) => {
    const current = map.get(line.description);
    return {
      code: line.code,
      description: line.description,
      quantity: Number(current?.quantity ?? 0),
      unitValue: Number(current?.unitValue ?? 0),
      totalValue: Number(current?.totalValue ?? 0)
    };
  });
};

const mergePayrollRows = (earnings: PayslipRubric[], deductions: PayslipRubric[]) => {
  const max = Math.max(earnings.length, deductions.length, 1);
  const rows: Array<{ code: string; description: string; earning: number | null; deduction: number | null }> = [];

  for (let idx = 0; idx < max; idx += 1) {
    const earning = earnings[idx];
    const deduction = deductions[idx];

    rows.push({
      code: asText(earning?.code ?? deduction?.code, '-'),
      description: asText(earning?.description ?? deduction?.description, '-'),
      earning: earning ? Number(earning.amount ?? 0) : null,
      deduction: deduction ? Number(deduction.amount ?? 0) : null
    });
  }

  return rows;
};

export const renderPayslipCss = () => {
  const foundPath = cssSearchPaths.find((filePath) => existsSync(filePath));
  if (!foundPath) {
    throw new Error('payslip-print.css not found');
  }

  return readFileSync(foundPath, 'utf8');
};

export const renderPayslipHtml = (payslip: Payslip) => {
  const classRows = normalizeClassRows(payslip.classComposition);
  const payrollRows = mergePayrollRows(payslip.earnings, payslip.deductions);
  const css = renderPayslipCss();
  const competence = monthLabel(payslip.competenceMonth, payslip.competenceYear);
  const generatedAt = new Date(payslip.createdAt).toLocaleDateString('pt-BR');

  const classTableHtml = classRows
    .map((row) => {
      return `
      <tr>
        <td class="text-center">${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td class="text-right">${escapeHtml(toNumber(row.quantity))}</td>
        <td class="text-right">${escapeHtml(toMoney(row.unitValue))}</td>
        <td class="text-right">${escapeHtml(toMoney(row.totalValue))}</td>
      </tr>`;
    })
    .join('');

  const payrollTableHtml = payrollRows
    .map((row) => {
      const earningCell = row.earning === null ? '-' : toMoney(row.earning);
      const deductionCell = row.deduction === null ? '-' : toMoney(row.deduction, true);
      return `
      <tr>
        <td class="text-center">${escapeHtml(row.code)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td class="text-right">${escapeHtml(earningCell)}</td>
        <td class="text-right value-deduction">${escapeHtml(deductionCell)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demonstrativo de Pagamento</title>
  <style>${css}</style>
</head>
<body>
  <main class="payslip-sheet">
    <section class="header">
      <h1>DEMONSTRATIVO DE PAGAMENTO</h1>
      <div class="header-meta">
        <div><strong>Razao social:</strong> ${escapeHtml(asText(payslip.companyName))}</div>
        <div><strong>Endereco:</strong> ${escapeHtml(asText(payslip.companyAddress))}</div>
        <div><strong>CNPJ:</strong> ${escapeHtml(asText(payslip.companyCnpj))}</div>
      </div>
    </section>

    <section class="employee-info">
      <div class="employee-info-title">DADOS DO FUNCIONARIO</div>
      <div class="employee-info-grid">
        <div class="employee-info-item"><div class="employee-info-label">Codigo</div><div class="employee-info-value">${escapeHtml(asText(payslip.employeeCode))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">Nome</div><div class="employee-info-value">${escapeHtml(asText(payslip.employeeName))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">Cargo</div><div class="employee-info-value">${escapeHtml(asText(payslip.employeeRole))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">Competencia</div><div class="employee-info-value">${escapeHtml(competence)}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">CPF</div><div class="employee-info-value">${escapeHtml(asText(payslip.employeeCpf))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">Data de admissao</div><div class="employee-info-value">${escapeHtml(asText(payslip.admissionDate))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">E-mail</div><div class="employee-info-value">${escapeHtml(asText(payslip.employeeEmail))}</div></div>
        <div class="employee-info-item"><div class="employee-info-label">Forma de pagamento</div><div class="employee-info-value">${escapeHtml(asText(payslip.paymentMethod))}</div></div>
      </div>
    </section>

    <table class="classes-table">
      <caption>BLOCO DE AULAS</caption>
      <thead>
        <tr>
          <th style="width: 8%;">Item</th>
          <th style="width: 40%;">Descricao</th>
          <th style="width: 17%;">Quantidade</th>
          <th style="width: 17%;">Valor aula / unitario</th>
          <th style="width: 18%;">Total</th>
        </tr>
      </thead>
      <tbody>${classTableHtml}
      </tbody>
    </table>

    <table class="payroll-table">
      <caption>PROVENTOS E DESCONTOS</caption>
      <thead>
        <tr>
          <th style="width: 10%;">Codigo</th>
          <th style="width: 45%;">Descricao</th>
          <th style="width: 22%;">Provento</th>
          <th style="width: 23%;">Desconto</th>
        </tr>
      </thead>
      <tbody>${payrollTableHtml}
      </tbody>
    </table>

    <section class="totals-grid">
      <div class="totals-item"><span class="totals-label">Salario bruto</span><span class="totals-value">${escapeHtml(toMoney(payslip.grossSalary))}</span></div>
      <div class="totals-item"><span class="totals-label">Total descontos</span><span class="totals-value value-deduction">${escapeHtml(toMoney(payslip.totalDiscounts, true))}</span></div>
      <div class="totals-item"><span class="totals-label">Salario liquido</span><span class="totals-value">${escapeHtml(toMoney(payslip.netSalary))}</span></div>
      <div class="totals-item"><span class="totals-label">FGTS</span><span class="totals-value">${escapeHtml(toMoney(payslip.fgts))}</span></div>
      <div class="totals-item"><span class="totals-label">Base INSS</span><span class="totals-value">${escapeHtml(toMoney(payslip.inssBase))}</span></div>
      <div class="totals-item"><span class="totals-label">Base FGTS</span><span class="totals-value">${escapeHtml(toMoney(payslip.fgtsBase))}</span></div>
      <div class="totals-item"><span class="totals-label">Base IRRF</span><span class="totals-value">${escapeHtml(toMoney(payslip.irrfBase))}</span></div>
      <div class="totals-item"><span class="totals-label">Conta bancaria</span><span class="totals-value">${escapeHtml(`${asText(payslip.bank)} / ${asText(payslip.agency)} / ${asText(payslip.account)}`)}</span></div>
      <div class="totals-item"><span class="totals-label">Vale alimentacao</span><span class="totals-value">${escapeHtml(toMoney(payslip.foodAllowance))}</span></div>
      <div class="totals-item"><span class="totals-label">Pensao alimenticia</span><span class="totals-value value-deduction">${escapeHtml(toMoney(payslip.alimony, true))}</span></div>
      <div class="totals-item"><span class="totals-label">2a do 13o</span><span class="totals-value">${escapeHtml(toMoney(payslip.thirteenthSecondInstallment))}</span></div>
      <div class="totals-item"><span class="totals-label">INSS 13o</span><span class="totals-value value-deduction">${escapeHtml(toMoney(payslip.thirteenthInss, true))}</span></div>
      <div class="totals-item"><span class="totals-label">IRRF 13o</span><span class="totals-value value-deduction">${escapeHtml(toMoney(payslip.thirteenthIrrf, true))}</span></div>
      <div class="totals-item"><span class="totals-label">Base de calculo</span><span class="totals-value">${escapeHtml(toMoney(payslip.calculationBase))}</span></div>
    </section>

    <section class="footer-note">
      <span>E-mail enviado para: ${escapeHtml(asText(payslip.employeeEmail))}</span>
      <span>Gerado em: ${escapeHtml(generatedAt)}</span>
    </section>
  </main>
</body>
</html>`;
};
