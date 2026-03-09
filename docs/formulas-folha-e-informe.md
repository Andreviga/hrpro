# Formulas de Folha e Informe Anual (base legal)

## Atualizacoes 2026 aplicadas
- Regras conferidas em 05/03/2026 com fontes oficiais gov.br.
- INSS atualizado para competencia janeiro/2026 com faixas progressivas oficiais.
- IRRF atualizado para tabela mensal 2026 e regra de reducao prevista na Lei 15.270/2025.
- Salario minimo considerado em R$ 1.621,00 desde 01/01/2026.
- Holerite com detalhamento de rubricas (proventos e descontos) no formato de demonstrativo de pagamento.

## Formula de professor horista aplicada no sistema
- Salario base: valor importado da planilha (quando existir) ou `horas_semanais * valor_hora * 4.5`.
- Adicional de hora-atividade: `salario_base * 5%`.
- DSR: `(salario_base + hora_atividade) / 6`.
- Salario bruto: `salario_base + hora_atividade + dsr`.

## Descontos e encargos aplicados no sistema
- INSS: `max(0, salario_bruto * aliquota - parcela_deduzir)`.
- Base IRRF: `salario_bruto - inss - (dependentes * deducao_dependente)`.
- IRRF: `max(0, base_irrf * aliquota - parcela_deduzir)` e aplicacao de reducao legal em 2026.
- Vale-transporte: `min(valor_informado, salario_bruto * 6%)`.
- FGTS: `salario_bruto * 8%`.

## Referencias oficiais consultadas
- Tabela INSS 2026 (gov.br / INSS): https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
- Reajuste INSS e teto 2026 (gov.br / MPS): https://www.gov.br/previdencia/pt-br/noticias/2026/janeiro/beneficios-com-valor-acima-do-salario-minimo-sao-reajustados-em-3-9
- Tabela IRPF 2026 (gov.br / Receita): https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
- Exemplos da Lei 15.270/2025 (gov.br / Receita): https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025
- Salario minimo 2026 (gov.br / MTE): https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/janeiro/salario-minimo-sera-de-r-1-621-em-2026
- Salario minimo 2026 no eSocial Domestico (gov.br / eSocial): https://www.gov.br/esocial/pt-br/noticias/novo-salario-minimo-2026-veja-como-registrar-o-reajuste-no-esocial-domestico
- CLT art. 464 (Planalto): https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm
- CLT art. 464 (Senado): https://legis.senado.leg.br/norma/530547/publicacao/37353698
- Manual eSocial S-1.3 (demonstrativos e rubricas S-1200): https://www.gov.br/esocial/pt-br/documentacao-tecnica/manuais/mos-s-1-3-consolidada-ate-a-no-s-1-3-07-2026.pdf
- Validacao eSocial para desconto de consignado (Credito do Trabalhador): https://www.gov.br/esocial/pt-br/noticias/esocial-implanta-nova-validacao-para-descontos-de-emprestimo-consignado-do-programa-credito-do-trabalhador

## Como alimentar o informe anual no sistema
1. Importar todas as planilhas de folha do ano (mes a mes), incluindo abas de apoio (`Tab auxilio`, `Quantidade de aula`, `Folha de pagto`, `13o`, `PLR` quando houver).
2. Fechar cada competencia no sistema (status `closed`).
3. Gerar informe anual via endpoint `POST /payroll/income-statements/generate` com o ano desejado.
4. O sistema consolida rendimentos/descontos de todas as competencias fechadas do ano e cria os documentos de informe por colaborador.

