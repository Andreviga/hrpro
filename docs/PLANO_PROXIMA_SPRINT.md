# PLANO_PROXIMA_SPRINT

Data: 2026-02-06

## P0 (producao minima)
- Snapshot imutavel da folha no fechamento (eventos e rubricas congelados).
- Padronizar payload de erro dos endpoints de folha (close, generate, reprocess).
- Melhorar auditoria para reabertura (motivo obrigatorio).

Estimativa: 3-4 dias
Dependencias: definicao de modelo de snapshot e migracao no Prisma.

## P1 (robustez)
- Melhorar deteccao de rescisao/ferias com base em modelo dedicado (em vez de heuristica por descricao).
- Indicadores de processamento e divergencias por competencia.

Estimativa: 4-6 dias
Dependencias: definicao de modelo de dados para snapshot e eventos de ferias/rescisao.

## P2 (qualidade e operacao)
- Testes E2E do fluxo completo de fechamento (create -> calculate -> close -> documentos).
- Observabilidade: dashboards simples para auditoria e falhas.
- Exportacao em lote de documentos por competencia.

Estimativa: 5-7 dias
Dependencias: ambiente de teste com dados e infraestrutura estavel.

## Observacoes
- Nao alterar regra de negocio atual sem validacao do dominio.
- Qualquer ambiguidade de regra deve ser documentada antes de implementar.
