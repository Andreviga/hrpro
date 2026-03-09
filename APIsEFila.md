# Especificacao de APIs e filas

Data: 2026-02-05

## 1) Principios
- API REST em NestJS com OpenAPI/Swagger.
- Auth JWT + refresh token.
- Multitenancy por company_id.
- Auditoria obrigatoria para alteracoes criticas.

## 2) Modulos e endpoints (resumo)

### 2.1) Auth
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

### 2.2) Companies
- GET /companies
- POST /companies
- GET /companies/:id
- PATCH /companies/:id

### 2.3) Users
- GET /users
- POST /users
- GET /users/:id
- PATCH /users/:id

### 2.4) Employees
- GET /employees
- POST /employees
- GET /employees/:id
- PATCH /employees/:id
- GET /employees/:id/contracts
- POST /employees/:id/contracts

### 2.5) Interns (TSVE)
- GET /interns
- POST /interns
- GET /interns/:id
- PATCH /interns/:id
- GET /interns/:id/contracts
- POST /interns/:id/contracts

### 2.6) Payroll
- GET /payroll/runs (lista competencias)
- POST /payroll/runs/open (abre competencia)
- POST /payroll/runs/:id/close (fecha competencia)
- POST /payroll/runs/:id/reopen (reabre competencia)
- GET /payroll/runs/summary?month=MM&year=YYYY (totais)
- POST /payroll-runs (cria competencia - legado)
- POST /payroll-runs/:id/calculate (enqueue)
- POST /payroll-runs/:id/close (lock - legado)
- GET /payroll-runs/:id/events
- GET /payroll-runs/:id/results

### 2.7) Rubrics
- GET /rubrics
- POST /rubrics
- PATCH /rubrics/:id

### 2.8) Tax Tables
- GET /tax/inss
- POST /tax/inss
- GET /tax/irrf
- POST /tax/irrf

### 2.9) TimeBank
- GET /timebank
- POST /timebank/entries
- POST /timebank/close

### 2.10) Contracts & Documents
- GET /templates
- POST /templates
- POST /documents
- GET /documents/:id
- POST /documents/:id/sign

### 2.11) Imports
- POST /imports/xlsx (enqueue)
- GET /imports/:id

### 2.12) eSocial
- POST /esocial/batches
- GET /esocial/batches/:id
- POST /esocial/batches/:id/submit (enqueue)
- GET /esocial/events

## 3) Filas (BullMQ)

### 3.1) payroll.calculate
- Payload: payrollRunId, companyId, version
- Worker: calcula rubricas e totais

### 3.2) payroll.close
- Payload: payrollRunId
- Worker: valida consistencia e trava competencia

### 3.3) esocial.generate
- Payload: companyId, payrollRunId, eventTypes[]
- Worker: gera XMLs por evento

### 3.4) esocial.submit
- Payload: batchId
- Worker: envia lote e processa retorno

### 3.5) imports.xlsx
- Payload: importBatchId
- Worker: executa importacao por aba

### 3.6) reports.generate
- Payload: reportType, companyId, filters
- Worker: gera PDF/CSV/XLSX

## 4) Status e tracking
- Todas as filas registram status em tabelas (ImportBatch, ESocialBatch, PayrollRun).
- Falhas vao para retry com backoff + log de erro.

---
Fim do documento.
