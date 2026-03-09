# Homologacao no Render (1 clique)

Este repositorio ja possui blueprint em [`render.yaml`](/D:/OneDrive/HRPro%20Folha%20de%20Pagamento/render.yaml).

## O que sobe automaticamente
- `hrpro-postgres` (PostgreSQL)
- `hrpro-redis` (Redis)
- `hrpro-api` (NestJS)
- `hrpro-worker` (BullMQ worker)
- `hrpro-web` (frontend estatico)

## Passo a passo
1. Suba este projeto para um repositorio Git (GitHub/GitLab).
2. No Render, clique em `New +` -> `Blueprint`.
3. Selecione o repositorio e confirme o arquivo `render.yaml`.
4. Aguarde o deploy terminar.
5. Abra a URL do frontend (`hrpro-web`) e a API (`hrpro-api/docs`).

## Seed de homologacao
No deploy da API, o pre-deploy executa:
- `npx prisma migrate deploy`
- `npm run prisma:seed:js`

Credenciais iniciais de teste:
- Usuario: `admin@hrpro.com`
- Senha: `123456`

## Checklist de teste ponta a ponta
1. Login com `admin@hrpro.com`.
2. Cadastre/importe funcionarios (CLT e professor horista).
3. Importe planilha de folha da competencia.
4. Calcule a folha da competencia.
5. Feche a competencia e confirme auto-geracao de documentos.
6. Gere holerite PDF (`GET /payroll/paystubs/:id/pdf`).
7. Gere informe anual (`POST /payroll/income-statements/generate`).
8. Exporte documentos (`GET /documents/:id/export/pdf` e `docx`).
9. Reprocesse documentos quando necessario (`POST /payroll-runs/:id/documents/reprocess`).

## Observacoes
- O frontend recebe a URL da API por variavel de build `HRPRO_API_URL` (definida no blueprint).
- Em homologacao, altere a senha do usuario admin apos validar o acesso.
