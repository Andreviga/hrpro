# Plano de testes e deploy

Data: 2026-02-05

## 1) Testes unitarios (motor de folha)
- Folha mensal (CLT)
- Folha complementar/extra
- 13o salario
- Ferias + 1/3 + descontos
- PLR
- Rescisao
- VT/VA com descontos
- Rubricas parametrizadas por competencia
- Tabelas INSS/IRRF/FGTS por competencia

Ferramentas: Jest + test data por competencia.

## 2) Testes unitarios (banco de horas)
- Lancamentos diarios
- Calculo de saldo
- Regras 50%/100%
- Fechamento mensal e aprovacao

## 3) Testes de integracao
- API REST (NestJS + Prisma) com banco real em ambiente de teste
- Filas BullMQ (com Redis local)
- Importacao Excel por lote
- Geracao de PDF e export CSV/XLSX

## 4) Testes eSocial
- Mock WebService (homolog)
- Validacao de XML por XSD
- Fluxo de erro e reprocessamento
- Registro de protocolo e recibo

## 5) Deploy (Docker Compose)
- Ambientes: dev, homolog, prod
- Servicos:
  - api (NestJS)
  - web (React build)
  - db (PostgreSQL)
  - redis (BullMQ)
  - worker (NestJS - filas)

## 6) Observabilidade
- Logs estruturados (JSON)
- Auditoria em tabela
- Metricas basicas de fila (jobs ok/fail)

## 7) Backup e restore
- Backup diario do Postgres
- Restore testado em homolog

---
Fim do documento.
