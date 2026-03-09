import { findRubricMapping } from './imports.service';

describe('findRubricMapping', () => {
  it('does not map salary liquid header to BASE', () => {
    expect(findRubricMapping('Salario liquido')).toBeUndefined();
    expect(findRubricMapping('Salário líquido')).toBeUndefined();
  });

  it('maps salary gross header to BASE', () => {
    const mapping = findRubricMapping('Salario bruto');

    expect(mapping).toBeDefined();
    expect(mapping?.[1]).toEqual({ code: 'BASE', type: 'earning' });
  });

  it('keeps descontos mapped as deduction', () => {
    const mapping = findRubricMapping('Descontos');

    expect(mapping).toBeDefined();
    expect(mapping?.[1]).toEqual({ code: 'OUTROS', type: 'deduction' });
  });

  it('keeps exact generic salary alias supported', () => {
    const mapping = findRubricMapping('Salario');

    expect(mapping).toBeDefined();
    expect(mapping?.[1]).toEqual({ code: 'BASE', type: 'earning' });
  });
});
