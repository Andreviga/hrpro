import { CompanyRegistryEntry } from './types';

export const COMPANY_REGISTRY_FILL_LOCATION =
  'server/src/modules/payroll/payslip-excel/company-registry.ts';

export const COMPANY_REGISTRY: Record<string, CompanyRegistryEntry> = {
  'RAIZES CENTRO EDUCACIONAL LTDA ME': {
    name: 'RAIZES CENTRO EDUCACIONAL LTDA ME',
    cnpj: '20.755.729/0001-85',
    address: 'PREENCHER_ENDERECO_RAIZES_CENTRO_EDUCACIONAL',
    needsAddressFill: true
  },
  'RAIZES RECREAÇÃO INFANTIL LTDA ME': {
    name: 'RAIZES RECREAÇÃO INFANTIL LTDA ME',
    cnpj: '59.946.400/0001-37',
    address: 'PREENCHER_ENDERECO_RAIZES_RECREACAO_INFANTIL',
    needsAddressFill: true
  }
};

export const resolveCompanyRegistry = (companyName: string | null | undefined) => {
  if (!companyName) {
    return null;
  }

  return COMPANY_REGISTRY[companyName.trim()] ?? null;
};