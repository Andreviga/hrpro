import { CompanyRegistryEntry } from './types';

export const COMPANY_REGISTRY_FILL_LOCATION =
  'server/src/modules/payroll/payslip-excel/company-registry.ts';

export const COMPANY_REGISTRY: Record<string, CompanyRegistryEntry> = {
  'RAIZES CENTRO EDUCACIONAL': {
    name: 'Raizes Centro Educacional',
    cnpj: '20.755.729/0001-85',
    address: 'Rua Diogo de Sousa, 251, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  },
  'RAIZES CENTRO EDUCACIONAL LTDA ME': {
    name: 'Raizes Centro Educacional',
    cnpj: '20.755.729/0001-85',
    address: 'Rua Diogo de Sousa, 251, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  },
  'RAIZES RECREACAO INFANTIL': {
    name: 'Raizes Recreacao Infantil',
    cnpj: '59.946.400/0001-37',
    address: 'Rua Diogo de Sousa, 257, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  },
  'RAIZES RECREAÇÃO INFANTIL LTDA ME': {
    name: 'Raizes Recreacao Infantil',
    cnpj: '59.946.400/0001-37',
    address: 'Rua Diogo de Sousa, 257, Cidade Lider, Sao Paulo/SP, CEP 08285-330'
  }
};

export const resolveCompanyRegistry = (companyName: string | null | undefined) => {
  if (!companyName) {
    return null;
  }

  return COMPANY_REGISTRY[companyName.trim()] ?? null;
};