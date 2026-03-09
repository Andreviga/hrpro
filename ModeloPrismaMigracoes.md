# Modelo Prisma e plano de migracoes

Data: 2026-02-05

## 1) Escopo do modelo
- Multiempresa (company) com segregacao por CNPJ.
- Usuarios com roles e escopo por empresa.
- Funcionarios e estagiarios com contratos separados.
- Motor de folha com rubricas parametrizaveis por competencia e versao.
- Banco de horas, documentos e auditoria.
- eSocial com lotes e eventos.

## 2) Modelo Prisma (alto nivel)

### 2.1) Tenancy e acesso
- Company
- CostCenter
- User
- UserCompany (se usuario acessar multiplas empresas)
- Role

### 2.2) Pessoas
- Employee
- EmployeeDependent
- BankAccount
- EmployeeContract
- EmployeeSalaryHistory

- Intern
- InternContract
- InternScholarship

### 2.3) Folha e rubricas
- PayrollRun (competencia, tipo, status, versao)
- PayrollEvent (por empregado e rubrica)
- PayrollResult (totais por empregado)
- Rubric
- RubricVersion
- RubricIncidence
- TaxTableINSS
- TaxTableIRRF
- TaxTableFGTS (se necessario)

### 2.4) Beneficios e banco de horas
- BenefitRule
- BenefitRequest
- TimeBankDay
- TimeBankEntry
- TimeBankClose

### 2.5) Documentos e assinatura
- ContractTemplate
- ContractDocument
- SignatureFlow
- SignatureEvent

### 2.6) eSocial
- ESocialBatch
- ESocialEvent
- ESocialProtocol
- ESocialError

### 2.7) Auditoria e importacoes
- AuditLog
- ImportBatch
- ImportItem

## 3) Plano de migracoes (ordem)
1) Base tenancy
   - Company
   - CostCenter
   - Role, User, UserCompany

2) Pessoas e contratos
   - Employee, EmployeeDependent, BankAccount
   - EmployeeContract, EmployeeSalaryHistory
   - Intern, InternContract, InternScholarship

3) Tabelas e rubricas
   - Rubric, RubricVersion, RubricIncidence
   - TaxTableINSS, TaxTableIRRF, TaxTableFGTS

4) Motor de folha
   - PayrollRun, PayrollEvent, PayrollResult
   - PayrollLock (fechamento por competencia)

5) Beneficios e banco de horas
   - BenefitRule, BenefitRequest
   - TimeBankDay, TimeBankEntry, TimeBankClose

6) Documentos
   - ContractTemplate, ContractDocument
   - SignatureFlow, SignatureEvent

7) eSocial
   - ESocialBatch, ESocialEvent, ESocialProtocol, ESocialError

8) Auditoria e importacoes
   - AuditLog
   - ImportBatch, ImportItem

## 4) Observacoes de integridade
- Todas as tabelas core com company_id.
- CostCenter opcional, mas exigido no envio eSocial.
- PayrollRun com versao e bloqueio (imutavel apos fechamento).
- Rubricas com validade por competencia.
- Auditoria para mudancas de rubricas, contratos e calculos.

## 5) Proximas entregas
- Gerar schema.prisma completo (detalhado, com enums).
- Criar migrations iniciais no backend NestJS.
- Seed de dados minimos (roles, empresas, rubricas base).

---
Fim do documento.
