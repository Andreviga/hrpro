import { Payslip, PayrollItem } from './types';

const fmt = (value: number | null | undefined, deduction = false) => {
  if (value === null || value === undefined) return '-';
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  return deduction ? `(${formatted})` : formatted;
};

const fmtNum = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
};

const payrollRows = (items: PayrollItem[], type: 'earning' | 'deduction') => {
  const filtered = items.filter((i) => i.type === type && i.amount > 0).sort((a, b) => a.order - b.order);
  if (filtered.length === 0) return '<tr><td colspan="2" style="color:#9ca3af">-</td></tr>';
  return filtered
    .map((i) => `<tr><td>${i.description}</td><td class="amt">${fmt(i.amount, type === 'deduction')}</td></tr>`)
    .join('');
};

export const renderPayslipHtml = (payslip: Payslip) => {
  const compositionRows = payslip.classComposition
    .map((line) => {
      const qtd = line.quantity !== null ? fmtNum(line.quantity) : '-';
      const unit = fmt(line.unitValue);
      const total = fmt(line.totalValue);
      return `
        <tr>
          <td>${line.description}</td>
          <td class="num">${qtd}</td>
          <td class="num">${unit}</td>
          <td class="num">${total}</td>
        </tr>
        ${line.note ? `<tr><td colspan="4" class="note">${line.note}</td></tr>` : ''}`;
    })
    .join('');

  const bankLine = [payslip.bank, payslip.agency, payslip.account].filter(Boolean).join(' / ') || '-';
  const pixLine = payslip.pix ?? '-';
  const pensaoLine = payslip.pensionAlimony && payslip.pensionAlimony > 0 ? fmt(payslip.pensionAlimony, true) : '-';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<title>${payslip.title}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:9pt;color:#111;margin:16px}
  h1{font-size:11pt;text-align:center;margin:0 0 2px;text-transform:uppercase}
  .company{text-align:center;font-weight:bold;font-size:9pt;margin:0}
  .company-address{text-align:center;font-size:8pt;color:#444;margin:0 0 6px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #aaa;padding:3px 5px;font-size:8.5pt}
  th{background:#dce6f1;font-weight:bold;text-align:center}
  td.num,td.amt{text-align:right}
  td.note{font-style:italic;color:#666;border-top:none;font-size:8pt}
  .section-title{font-weight:bold;font-size:9pt;background:#f0f4f8;border:1px solid #aaa;padding:3px 5px;margin-top:8px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0}
  .info-cell{border:1px solid #aaa;padding:3px 6px}
  .lbl{font-size:7.5pt;color:#555}
  .val{font-size:9pt;font-weight:bold}
  .totals-row td{font-weight:bold;background:#f0f4f8}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .footer-line{margin-top:24px;border-top:1px solid #333;width:240px}
  .footer-caption{font-size:8pt;color:#555;margin-top:2px}
</style>
</head>
<body>

<h1>${payslip.title}</h1>
<p class="company">${payslip.companyName}</p>
<p class="company-address">${payslip.companyAddress ?? ''} — CNPJ: ${payslip.companyCnpj ?? '-'} — Competência: ${payslip.referenceMonth}</p>

<div class="info-grid">
  <div class="info-cell"><div class="lbl">Código</div><div class="val">${payslip.employeeCode ?? '-'}</div></div>
  <div class="info-cell"><div class="lbl">Nome</div><div class="val">${payslip.employeeName}</div></div>
  <div class="info-cell"><div class="lbl">Cargo</div><div class="val">${payslip.employeeRole}</div></div>
  <div class="info-cell"><div class="lbl">Competência</div><div class="val">${payslip.referenceMonth}</div></div>
  <div class="info-cell"><div class="lbl">CPF</div><div class="val">${payslip.employeeCpf}</div></div>
  <div class="info-cell"><div class="lbl">Qtd Aulas</div><div class="val">${fmtNum(payslip.totalClassQuantity)}</div></div>
  <div class="info-cell"><div class="lbl">Valor / Aula</div><div class="val">${fmt(payslip.classUnitValue)}</div></div>
  <div class="info-cell"><div class="lbl">Admissão</div><div class="val">${payslip.admissionDate ?? '-'}</div></div>
</div>

<div class="section-title">Composição de Aulas</div>
<table>
  <thead><tr><th>Tipo</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
  <tbody>${compositionRows}</tbody>
</table>

<div class="two-col" style="margin-top:8px">
  <div>
    <div class="section-title">Proventos</div>
    <table><tbody>${payrollRows(payslip.earnings, 'earning')}</tbody></table>
  </div>
  <div>
    <div class="section-title">Descontos</div>
    <table><tbody>${payrollRows(payslip.deductions, 'deduction')}</tbody></table>
  </div>
</div>

<table style="margin-top:8px">
  <tbody>
    <tr class="totals-row"><td>Salário Bruto</td><td class="amt">${fmt(payslip.grossSalary)}</td><td>Salário Líquido</td><td class="amt">${fmt(payslip.netSalary)}</td></tr>
    <tr><td>Pensão Alimentícia</td><td class="amt">${pensaoLine}</td><td>FGTS (8%)</td><td class="amt">${fmt(payslip.fgts)}</td></tr>
    <tr><td>Banco / Ag / Conta</td><td class="amt">${bankLine}</td><td>PIX</td><td class="amt">${pixLine}</td></tr>
    <tr><td>Vale Alimentação</td><td class="amt">${fmt(payslip.foodAllowance)}</td><td>E-mail</td><td class="amt">${payslip.email ?? '-'}</td></tr>
    ${payslip.thirteenthSecondInstallment ? `<tr><td>13º — 2ª Parcela</td><td class="amt">${fmt(payslip.thirteenthSecondInstallment)}</td><td>INSS do 13º</td><td class="amt">${fmt(payslip.thirteenthInss, true)}</td></tr>` : ''}
    ${payslip.thirteenthIrrf ? `<tr><td>IRRF do 13º</td><td class="amt">${fmt(payslip.thirteenthIrrf, true)}</td><td>Base de Cálculo</td><td class="amt">${fmt(payslip.calculationBase)}</td></tr>` : ''}
  </tbody>
</table>

<p style="font-size:8pt;margin-top:16px">Recebi da empresa acima identificada a importância líquida constante neste demonstrativo.</p>
<div class="footer-line"></div>
<div class="footer-caption">Assinatura do(a) colaborador(a) — Emitido em ${new Date().toLocaleDateString('pt-BR')}</div>

</body>
</html>`;
};
