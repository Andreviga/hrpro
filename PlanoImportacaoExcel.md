# Plano detalhado de importacao (Excel legado)

Data: 2026-02-05
Arquivo analisado: Folha de pagamento de fevereiro 2026.xlsm

## 1) Objetivos do importador
- Migrar dados historicos e parametros de calculo do Excel para o banco.
- Detectar e reportar formulas quebradas (#REF!).
- Normalizar dados e separar por empresa (CNPJ).
- Converter formulas em regras de dominio no backend (nao executar Excel em runtime).

## 2) Estrategia geral
1) Pre-validacao
   - Verificar abas obrigatorias.
   - Verificar cabecalhos minimos esperados.
   - Registrar #REF! e inconsistencias.

2) Extracao
   - Ler dados por aba.
   - Normalizar tipos (datas, CPF, valores monetarios, horas).
   - Mapear empresa/unidade.

3) Transformacao
   - Resolver chaves (ex.: funcionario pelo nome ou CPF).
   - Converter tabelas em regras (INSS, IRRF, hora aula, etc.).
   - Criar historico de competencia.

4) Carga
   - Persistir em transacao por aba.
   - Registrar erros por linha.
   - Permitir reprocessamento parcial.

## 3) Abas mapeadas e destinos

### 3.1) Cadastro Funcionarios
- Origem: aba "Cadastro Funcionarios"
- Destinos:
  - EMPLOYEE
  - BANK_ACCOUNT
  - EMPLOYEE_DEPENDENT (se existir colunas de dependentes)
  - EMPLOYEE_CONTRACT (dados contratuais)
- Chaves:
  - CPF preferencial
  - Nome + data admissao (fallback)
- Validacoes:
  - CPF valido
  - Email unico por empresa
  - Datas coerentes (nascimento < admissao)

### 3.2) Quantidade de aula 0125
- Origem: aba "Quantidade de aula 0125"
- Destinos:
  - EMPLOYEE (para professores)
  - PAYROLL_INPUT (horas por competencia)
  - RUBRIC (horas/aulas por tipo)
- Regras extraidas:
  - Salario base = horas semanais * valor hora * 4.5
  - DSR = 1/6 do salario base
  - Hora atividade = 5% sobre base + DSR
- Observacoes:
  - Esta aba serve de base para o calculo de professores.

### 3.3) Tab auxilio 0125
- Origem: aba "Tab auxilio 0125"
- Destinos:
  - TAX_TABLE_INSS (por competencia)
  - TAX_TABLE_IRRF (por competencia)
- Validacoes:
  - Faixas ordenadas e sem sobreposicao
  - Deducao e aliquota coerentes

### 3.4) Folha de pagto janeiro2026 (mensal)
- Origem: aba "Folha de pagto janeiro2026"
- Destinos:
  - PAYROLL_RUN (competencia)
  - PAYROLL_EVENT (rubricas por funcionario)
  - PAYROLL_RESULT (totais por funcionario)
- Observacoes:
  - #REF! detectados em C1, E1, E44, H45 (corrigir regras antes de importar totais)
  - Rubricas por competencia, sem hardcode

### 3.5) Folha de pagto 13 2025
- Origem: aba "Folha de pagto 13 2025"
- Destinos:
  - PAYROLL_RUN (tipo = 13o)
  - PAYROLL_EVENT / PAYROLL_RESULT
- Observacoes:
  - #REF! detectados em G1, H1, H44, I45

### 3.6) Folha de pagto Ferias
- Origem: aba "Folha de pagto Ferias"
- Destinos:
  - PAYROLL_RUN (tipo = ferias)
  - PAYROLL_EVENT / PAYROLL_RESULT
- Observacoes:
  - #REF! detectados em E1, G1, F5, L5, M5, D37, J41, J42, J43, G45, H46

### 3.7) Folha de pagto extra 0125
- Origem: aba "Folha de pagto extra 0125"
- Destinos:
  - PAYROLL_RUN (tipo = complementar/extra)
  - PAYROLL_EVENT / PAYROLL_RESULT

### 3.8) VT012026
- Origem: aba "VT012026"
- Destinos:
  - BENEFIT_RULE (parametros por competencia)
  - BENEFIT_REQUEST (quando houver por funcionario)
- Observacao:
  - Colunas livres (texto) exigem normalizacao.

### 3.9) Holerite
- Origem: aba "Holerite"
- Destino:
  - TEMPLATE (layout/preview)
  - Validacao de rubricas obrigatorias

### 3.10) TRCT
- Origem: aba "TRCT"
- Destino:
  - TEMPLATE TRCT
  - Mapas de campos para merge

### 3.11) Recibo de Ferias
- Origem: aba "Recibo de Ferias"
- Destino:
  - TEMPLATE Recibo Ferias

## 4) Mapeamento de competencias
- Cada planilha de folha vira um PAYROLL_RUN.
- Competencia = mes/ano da aba.
- Versao inicial = 1.
- Fechamento gera PAYROLL_LOCK.

## 5) Detecao de inconsistencias
- #REF! detectados nas abas listadas acima.
- Regras quebradas devem ser corrigidas no mapeamento de dominio.
- Durante importacao, marcar PAYROLL_RUN como "incompleto" se houver #REF!.

## 6) Reprocessamento
- Importacao por lotes.
- Permitir reprocessar somente uma aba/competencia.
- Guardar LOG de importacao por linha.

## 7) Saidas do importador
- Relatorio de importacao (CSV/JSON) com:
  - Registros criados/atualizados
  - Erros por linha
  - Campos obrigatorios ausentes
  - #REF! e formulas quebradas

## 8) Proximos passos
- Confirmar cabecalhos exatos de "Cadastro Funcionarios".
- Validar se ha CPFs em todas as abas de folha (ou se precisaremos de chave por nome).
- Definir estrategia para historico de folha (importar totais vs. rubricas detalhadas).

---
Fim do plano.
