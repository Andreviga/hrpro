# Modulo Estruturado de Holerite por XLSM

O modulo novo fica em `server/src/modules/payroll/payslip-excel` e foi separado em cinco camadas:

- `excel-reader`: abre o `.xlsm`, descobre tabelas nomeadas reais e le os valores com formula e valor calculado.
- `payroll-mapper`: localiza as linhas do colaborador em `Tabela1`, `Tabela2`, `Tabela35` e `Tabela354`.
- `payslip-builder`: monta o objeto `Payslip` tipado.
- `payslip-renderer`: gera HTML estruturado pronto para PDF A4.
- `payslip-pdf-exporter`: gera PDF com `pdfkit`.

## Avisos de preenchimento manual

Quando o sistema nao encontra um dado confiavel, ele adiciona um item em `payslip.warnings[]` com `fillLocation`.

Hoje o principal ponto pendente propositalmente marcado para preenchimento manual e:

- Endereco da empresa em `server/src/modules/payroll/payslip-excel/company-registry.ts`

Os CNPJs das duas empresas foram preenchidos:

- `RAIZES CENTRO EDUCACIONAL LTDA ME` -> `20.755.729/0001-85`
- `RAIZES RECREAÇÃO INFANTIL LTDA ME` -> `59.946.400/0001-37`

Os enderecos foram deixados com placeholder para evitar inventar dado que nao apareceu com seguranca na planilha ou no cadastro atual.

## Exemplos reais

Os testes e exemplos reais usam os dois funcionarios abaixo da planilha:

- `ANDRÉ LUCAS BARBOSA DE OLIVEIRA`
- `NATHALIA DE OLIVEIRA PRESSINOTTE`

Arquivo de referencia usado nos testes:

- `Folha de pagamento de fevereiro 2026.xlsm`

## API utilitaria exportada

O modulo exporta as funcoes:

- `loadWorkbook(filePath)`
- `readNamedTable(workbook, sheetName, tableName)`
- `findEmployeeByName(table, name)`
- `findEmployeeByCpf(table, cpf)`
- `buildPayslipFromExcel({ workbook, employeeKey, competence })`
- `renderPayslipHtml(payslip)`
- `exportPayslipPdf(payslip)`