import PDFDocument from 'pdfkit';
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

// ─── layout constants ───────────────────────────────────────────────────────
const CELL_PAD = 4;
const ROW_H = 16;
const HEADER_ROW_H = 14;

const drawHLine = (doc: PDFKit.PDFDocument, x: number, y: number, w: number) => {
  doc.moveTo(x, y).lineTo(x + w, y).stroke();
};

const drawVLine = (doc: PDFKit.PDFDocument, x: number, y1: number, y2: number) => {
  doc.moveTo(x, y1).lineTo(x, y2).stroke();
};

/**
 * Draws a single table row with the given column widths.
 * cols: array of { text, align?, bold? }
 * Returns new y after the row.
 */
const drawRow = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  pageW: number,
  colWidths: number[],
  cells: { text: string; align?: 'left' | 'right' | 'center'; bold?: boolean }[],
  rowHeight = ROW_H,
  bgColor?: string
) => {
  if (bgColor) {
    doc.save().fillColor(bgColor).rect(x, y, pageW, rowHeight).fill().restore();
  }
  doc.rect(x, y, pageW, rowHeight).stroke();

  let cx = x;
  colWidths.forEach((w, i) => {
    if (i > 0) drawVLine(doc, cx, y, y + rowHeight);
    const cell = cells[i] ?? { text: '' };
    doc
      .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor('#111111')
      .fontSize(8)
      .text(cell.text, cx + CELL_PAD, y + (rowHeight - 8) / 2 + 1, {
        width: w - CELL_PAD * 2,
        align: cell.align ?? 'left',
        lineBreak: false
      });
    cx += w;
  });

  return y + rowHeight;
};

export const exportPayslipPdf = async (payslip: Payslip): Promise<Buffer> => {
  const doc = new PDFDocument({ size: 'A4', margin: 28 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const ml = doc.page.margins.left;
    const pageW = doc.page.width - ml - doc.page.margins.right;
    let y = doc.page.margins.top;

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111')
      .text(payslip.title, ml, y, { width: pageW, align: 'center' });
    y = doc.y + 2;
    doc.font('Helvetica-Bold').fontSize(9).text(payslip.companyName, ml, y, { width: pageW, align: 'center' });
    y = doc.y + 1;
    doc.font('Helvetica').fontSize(8).fillColor('#444444')
      .text(
        `${payslip.companyAddress ?? ''}  —  CNPJ: ${payslip.companyCnpj ?? '-'}  —  Competência: ${payslip.referenceMonth}`,
        ml, y, { width: pageW, align: 'center' }
      );
    y = doc.y + 6;
    drawHLine(doc, ml, y, pageW);
    y += 4;

    // ── Employee info grid (4 pairs × 2 rows) ────────────────────────────────
    const infoColW = pageW / 4;
    const infoColWidths = [infoColW, infoColW, infoColW, infoColW];
    const infoRows: { label: string; value: string }[][] = [
      [
        { label: 'Código', value: payslip.employeeCode ?? '-' },
        { label: 'Nome', value: payslip.employeeName },
        { label: 'Cargo', value: payslip.employeeRole },
        { label: 'Competência', value: payslip.referenceMonth }
      ],
      [
        { label: 'CPF', value: payslip.employeeCpf },
        { label: 'Qtd Aulas', value: fmtNum(payslip.totalClassQuantity) },
        { label: 'Valor / Aula', value: fmt(payslip.classUnitValue) },
        { label: 'Admissão', value: payslip.admissionDate ?? '-' }
      ]
    ];

    for (const infoRow of infoRows) {
      const rowTop = y;
      const rowH = 26;
      doc.rect(ml, rowTop, pageW, rowH).stroke();
      let cx = ml;
      infoRow.forEach((cell, i) => {
        if (i > 0) drawVLine(doc, cx, rowTop, rowTop + rowH);
        doc.font('Helvetica').fontSize(7).fillColor('#555555')
          .text(cell.label, cx + CELL_PAD, rowTop + 3, { width: infoColW - CELL_PAD * 2, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
          .text(cell.value, cx + CELL_PAD, rowTop + 11, { width: infoColW - CELL_PAD * 2, lineBreak: false });
        cx += infoColW;
      });
      y = rowTop + rowH;
    }
    y += 6;

    // ── Composition table ────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
      .text('COMPOSIÇÃO DE AULAS', ml, y);
    y = doc.y + 1;
    const compWidths = [pageW * 0.40, pageW * 0.20, pageW * 0.20, pageW * 0.20];
    y = drawRow(doc, ml, y, pageW, compWidths,
      [
        { text: 'Tipo', bold: true },
        { text: 'Qtd', bold: true, align: 'right' },
        { text: 'Valor Unit.', bold: true, align: 'right' },
        { text: 'Total', bold: true, align: 'right' }
      ],
      HEADER_ROW_H, '#dce6f1');

    for (const line of payslip.classComposition) {
      const noteText = line.note ? ` (${line.note})` : '';
      y = drawRow(doc, ml, y, pageW, compWidths, [
        { text: line.description + noteText },
        { text: line.quantity !== null ? fmtNum(line.quantity) : '-', align: 'right' },
        { text: fmt(line.unitValue), align: 'right' },
        { text: fmt(line.totalValue), align: 'right' }
      ]);
    }
    y += 6;

    // ── Earnings & Deductions side by side ───────────────────────────────────
    const halfW = (pageW - 6) / 2;
    const twoColY = y;

    const earnings = payslip.earnings.filter((i) => i.type === 'earning' && i.amount > 0).sort((a, b) => a.order - b.order);
    const deductions = payslip.deductions.filter((i) => i.type === 'deduction' && i.amount > 0).sort((a, b) => a.order - b.order);
    const maxRows = Math.max(earnings.length, deductions.length, 1);

    // Earnings header
    let ey = twoColY;
    const earningsColW = [halfW * 0.65, halfW * 0.35];
    doc.font('Helvetica-Bold').fontSize(8).text('PROVENTOS', ml, ey);
    ey = doc.y + 1;
    ey = drawRow(doc, ml, ey, halfW, earningsColW,
      [{ text: 'Descrição', bold: true }, { text: 'Valor', bold: true, align: 'right' }],
      HEADER_ROW_H, '#dce6f1');
    for (let i = 0; i < maxRows; i++) {
      const item = earnings[i];
      ey = drawRow(doc, ml, ey, halfW, earningsColW, [
        { text: item?.description ?? '' },
        { text: item ? fmt(item.amount) : '', align: 'right' }
      ]);
    }
    const earningsEnd = ey;

    // Deductions header
    const dx = ml + halfW + 6;
    let dy = twoColY;
    const deductionsColW = [halfW * 0.65, halfW * 0.35];
    doc.font('Helvetica-Bold').fontSize(8).text('DESCONTOS', dx, dy);
    dy = doc.y + 1;
    dy = drawRow(doc, dx, dy, halfW, deductionsColW,
      [{ text: 'Descrição', bold: true }, { text: 'Valor', bold: true, align: 'right' }],
      HEADER_ROW_H, '#dce6f1');
    for (let i = 0; i < maxRows; i++) {
      const item = deductions[i];
      dy = drawRow(doc, dx, dy, halfW, deductionsColW, [
        { text: item?.description ?? '' },
        { text: item ? fmt(item.amount, true) : '', align: 'right' }
      ]);
    }

    y = Math.max(earningsEnd, dy) + 6;

    // ── Totals block ─────────────────────────────────────────────────────────
    const totW = pageW / 4;
    const totWidths = [totW, totW, totW, totW];
    const pensao = payslip.pensionAlimony && payslip.pensionAlimony > 0 ? fmt(payslip.pensionAlimony, true) : '-';
    const bankLine = [payslip.bank, payslip.agency, payslip.account].filter(Boolean).join(' / ') || '-';

    const totalsData: { text: string; align?: 'left' | 'right' | 'center'; bold?: boolean }[][] = [
      [
        { text: 'SALÁRIO BRUTO', bold: true },
        { text: fmt(payslip.grossSalary), align: 'right', bold: true },
        { text: 'SALÁRIO LÍQUIDO', bold: true },
        { text: fmt(payslip.netSalary), align: 'right', bold: true }
      ],
      [
        { text: 'Pensão Alimentícia' },
        { text: pensao, align: 'right' },
        { text: 'FGTS (8%)' },
        { text: fmt(payslip.fgts), align: 'right' }
      ],
      [
        { text: 'Banco / Ag / Conta' },
        { text: bankLine, align: 'right' },
        { text: 'PIX' },
        { text: payslip.pix ?? '-', align: 'right' }
      ],
      [
        { text: 'Vale Alimentação' },
        { text: fmt(payslip.foodAllowance), align: 'right' },
        { text: 'E-mail' },
        { text: payslip.email ?? '-', align: 'right' }
      ]
    ];

    if (payslip.thirteenthSecondInstallment) {
      totalsData.push([
        { text: '13º — 2ª Parcela' },
        { text: fmt(payslip.thirteenthSecondInstallment), align: 'right' },
        { text: 'INSS do 13º' },
        { text: fmt(payslip.thirteenthInss, true), align: 'right' }
      ]);
    }
    if (payslip.thirteenthIrrf) {
      totalsData.push([
        { text: 'IRRF do 13º' },
        { text: fmt(payslip.thirteenthIrrf, true), align: 'right' },
        { text: 'Base de Cálculo' },
        { text: fmt(payslip.calculationBase), align: 'right' }
      ]);
    }

    for (const [idx, row] of totalsData.entries()) {
      y = drawRow(doc, ml, y, pageW, totWidths, row, ROW_H, idx === 0 ? '#dce6f1' : undefined);
    }

    y += 16;

    // ── Signature line ────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(8).fillColor('#333333')
      .text('Recebi da empresa acima identificada a importância líquida constante neste demonstrativo.', ml, y, { width: pageW });
    y = doc.y + 18;
    doc.moveTo(ml + 20, y).lineTo(ml + 240, y).stroke();
    y += 3;
    doc.font('Helvetica').fontSize(7.5).fillColor('#555555')
      .text('Assinatura do(a) colaborador(a)', ml + 20, y, { width: 220, align: 'center' });
    doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, ml + pageW - 150, y, { width: 150, align: 'right' });

    doc.end();
  });
};
