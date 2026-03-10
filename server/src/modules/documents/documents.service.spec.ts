import {
  buildExportFilename,
  buildIncomeStatementRequiredPlaceholders,
  buildIncomeStatementTemplateContent,
  buildIncomeStatementTemplateName,
  buildPaystubRequiredPlaceholders,
  buildPaystubTemplateContent,
  buildPaystubTemplateName,
  canTransitionStatus,
  extractPlaceholders,
  mergePlaceholders,
  validateRequiredPlaceholders
} from './documents.service';

describe('DocumentsService helpers', () => {
  it('extracts unique placeholders', () => {
    const content = 'Hello {{name}}, your code is {{ code }} and {{name}} again.';
    const placeholders = extractPlaceholders(content).sort();
    expect(placeholders).toEqual(['code', 'name']);
  });

  it('merges placeholders with values', () => {
    const content = 'Hello {{name}}, month {{month}}.';
    const merged = mergePlaceholders(content, { name: 'Ana', month: '02/2026' });
    expect(merged).toBe('Hello Ana, month 02/2026.');
  });

  it('validates missing required placeholders', () => {
    const missing = validateRequiredPlaceholders(['name', 'cpf'], { name: 'Joao' });
    expect(missing).toEqual(['cpf']);
  });

  it('allows valid status transitions', () => {
    expect(canTransitionStatus('draft', 'review')).toBe(true);
    expect(canTransitionStatus('approved', 'signed')).toBe(true);
    expect(canTransitionStatus('finalized', 'reopened')).toBe(true);
  });

  it('blocks invalid status transitions', () => {
    expect(canTransitionStatus('draft', 'signed')).toBe(false);
    expect(canTransitionStatus('finalized', 'approved')).toBe(false);
  });

  it('builds export filename with cpf and competence', () => {
    const filename = buildExportFilename({
      type: 'trct',
      cpf: '123.456.789-00',
      month: 2,
      year: 2026,
      version: 3,
      extension: 'pdf'
    });

    expect(filename).toBe('trct_12345678900_022026_3.pdf');
  });

  it('builds official income statement template content', () => {
    const templateName = buildIncomeStatementTemplateName();
    const content = buildIncomeStatementTemplateContent();

    expect(templateName).toBe('Informe de Rendimentos IRPF (IN RFB 2.060/2021)');
    expect(content).toContain('COMPROVANTE DE RENDIMENTOS PAGOS E DE IMPOSTO SOBRE A RENDA RETIDO NA FONTE');
    expect(content).toContain('1. FONTE PAGADORA PESSOA JURIDICA OU PESSOA FISICA');
    expect(content).toContain('6. RENDIMENTOS RECEBIDOS ACUMULADAMENTE - ART. 12-A DA LEI No 7.713/1988');
    expect(content).toContain('{{q3_l1_total_rendimentos}}');
    expect(content).toContain('{{q5_l1_decimo_terceiro}}');
    expect(content).toContain('{{quadro7_observacoes}}');
  });

  it('returns required placeholders for income statement template', () => {
    const required = buildIncomeStatementRequiredPlaceholders();

    expect(required).toEqual(expect.arrayContaining([
      'exercicio',
      'ano_calendario',
      'fonte_cnpj_cpf',
      'beneficiario_cpf',
      'q3_l1_total_rendimentos',
      'q4_l1_parcela_isenta_65',
      'q5_l1_decimo_terceiro',
      'data_emissao'
    ]));

    expect(new Set(required).size).toBe(required.length);
  });

  it('keeps paystub required placeholders aligned with template content', () => {
    const templateName = buildPaystubTemplateName();
    const content = buildPaystubTemplateContent();
    const required = buildPaystubRequiredPlaceholders();
    const placeholders = extractPlaceholders(content);

    expect(templateName).toBe('Holerite Padrao (Automatico v2)');
    expect(content).toContain('{{competence}}');
    expect(required).not.toEqual(expect.arrayContaining(['payroll_month', 'payroll_year']));
    expect(required.every((item) => placeholders.includes(item))).toBe(true);
  });
});
