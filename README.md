# HRPro Folha de Pagamento

## Stack
- Frontend: React + TypeScript + Tailwind/shadcn (esbuild)
- Backend: NestJS + Prisma + PostgreSQL
- Filas: BullMQ + Redis
- Infra local: Docker Compose

## Deploy de homologacao (Render)
- Blueprint pronto em [`render.yaml`](/D:/OneDrive/HRPro%20Folha%20de%20Pagamento/render.yaml).
- Guia completo em [`docs/homolog-render.md`](/D:/OneDrive/HRPro%20Folha%20de%20Pagamento/docs/homolog-render.md).
- O blueprint sobe frontend + API + worker + Postgres + Redis.

## Como rodar do zero (Windows)
1) Instale Node.js LTS e Docker Desktop.
2) Na raiz do repo:
   - `npm install`
3) No backend:
   - `cd server`
   - `npm install`
4) Suba banco e redis:
   - `docker compose up -d db redis`
5) Migrations + seed:
   - `npm run prisma:migrate`
   - se houver conflito entre Postgres local e Docker na porta `5432`, rode `npm run prisma:sync:docker`
   - `npm run prisma:seed`
6) Suba backend:
   - `npm run dev` (porta 4000)
7) Suba worker:
   - `npm run worker`
8) Suba frontend:
   - `cd ..`
   - `npm run dev` (porta 8000)
9) Swagger:
   - http://localhost:4000/docs

## Comandos principais
- Frontend: `npm run dev`
- Backend API: `npm run dev` (em `server/package.json`)
- Worker: `npm run worker` (em `server/package.json`)
- Lint/typecheck: `npm run lint`
- Testes server: `npm.cmd test -- --runInBand` (em `server/package.json`)
- Sincronizar migrations Prisma no Postgres Docker: `npm run prisma:sync:docker`
- Sincronizar apenas historico Prisma no Docker: `npm run prisma:sync:docker:history`

## Prisma + Docker
- Use `npm run prisma:sync:docker` quando o banco Docker ja estiver no ar e voce quiser aplicar migrations pendentes e registrar o historico do Prisma no `_prisma_migrations`.
- Use `npm run prisma:sync:docker:history` quando o SQL ja tiver sido aplicado manualmente no container e faltar apenas sincronizar o historico.
- Os atalhos funcionam tanto na raiz quanto em `server/`.
- Script base: `scripts/prisma-sync-docker.ps1`.

## Variaveis de ambiente
- Backend: `server/.env` (copiado de `server/.env.example`)
- Infra local: `docker-compose.yml` usa `./.env` para Postgres/Redis

## Documentos: gerar e exportar
- Gerar manual via folha: `POST /payroll-runs/:id/documents`
- Reprocessar falhas: `POST /payroll-runs/:id/documents/reprocess`
- Exportar binario:
  - `GET /documents/:id/export/pdf`
  - `GET /documents/:id/export/docx`
- Nome do arquivo: `{tipo}_{cpf}_{competencia}_{versao}.pdf/.docx`

## Fechamento de competencia (auto-geracao)
- Abrir competencia: `POST /payroll/runs/open`
- Listar competencias: `GET /payroll/runs`
- Fechar competencia: `POST /payroll/runs/:id/close`
- Reabrir competencia: `POST /payroll/runs/:id/reopen`
- Resumo por competencia: `GET /payroll/runs/summary?month=MM&year=YYYY`
- Ao fechar, o sistema gera automaticamente:
  - TRCT para funcionarios em rescisao
  - Recibo de Ferias quando houver eventos de ferias
- A geracao e idempotente e registra auditoria.
- Importacao de folha em competencia fechada retorna conflito (HTTP 409).

## Troubleshooting basico
- Erros de permissao no PowerShell: use `npm.cmd` e `npx.cmd`.
- Prisma generate falhando por arquivo em uso: finalize processos Node e rode novamente.
- Conflito ao fechar competencia: existe folha fechada para o mesmo mes/ano.
- Se `prisma migrate` conectar no Postgres errado por causa de conflito entre Postgres local e Docker na `5432`, prefira `npm run prisma:sync:docker`.

## Notas
- Em PowerShell, use `npm.cmd` se `npm` estiver bloqueado por ExecutionPolicy.
- O frontend usa `window.HRPRO_API_URL` ou variavel de build `HRPRO_API_URL` (default `http://localhost:4000`).
