# STATUS_ATUAL

Data: 2026-02-06

## O que ja existe
- Frontend React/TS com paginas principais (login, dashboard, holerites, documentos, admin, suporte).
- Backend NestJS com modulos Auth, Employees, Payroll, Imports, TimeBank, Audit, Documents.
- Prisma + Postgres com schema completo para folha, documentos e auditoria.
- Payroll run com calculo, fechamento e auto-geracao de documentos por competencia.
- Endpoints de ciclo de competencia (abrir, listar, fechar, reabrir, resumo) em /payroll/runs.
- Tela admin de competencias com filtros, resumo e acao de fechar/reabrir.
- Bloqueio de importacao de folha quando a competencia esta fechada (HTTP 409).
- Documentos vinculados a folha fechada nao podem ser editados ou reabertos.
- Exportacao de documentos em PDF/DOCX e auditoria de exportacao.
- Filas BullMQ para processamento de folha.

## Lacunas funcionais
- Fechamento de folha sem snapshot imutavel (nao ha congelamento de eventos e rubricas).
- Deteccao de rescisao/ferias baseada em eventos/flags simples; pode exigir modelo dedicado.
- UI administrativa ainda nao expone indicadores avancados (tempo de processamento, divergencias).
- Motor de folha ainda nao cobre ferias/13o/rescisao/complementar.
- Integracao banco de horas com folha ainda ausente.

## Riscos tecnicos
- Falta de padrao global de erros HTTP (alguns endpoints retornam mensagens brutas).
- Auto-geracao depende de eventos/descricao, risco de falso positivo/negativo.
- Falta de testes E2E com base real para fluxo completo de fechamento.
- Crescimento de documentos sem exportacao em lote.
