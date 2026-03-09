# Copilot instructions for HRPro

## Big picture
- Frontend is a React + TypeScript SPA built with a custom esbuild pipeline; entry is [src/main.tsx](src/main.tsx) and assets output to dist/ via [scripts/build.mjs](scripts/build.mjs).
- Backend is a NestJS monolith with modular features (Auth, Employees, Payroll, Imports, TimeBank, Audit) wired in [server/src/app.module.ts](server/src/app.module.ts).
- Data lives in PostgreSQL with Prisma; queue processing uses BullMQ + Redis (see [docker-compose.yml](docker-compose.yml) and [server/src/worker.ts](server/src/worker.ts)).
- Architecture and API surface are documented in [ArquiteturaERD.md](ArquiteturaERD.md) and [APIsEFila.md](APIsEFila.md).

## Developer workflows
- Frontend dev server (esbuild serve + watch): `npm run dev` (root [package.json](package.json)).
- Frontend production build: `npm run build` outputs dist/ (see [scripts/build.mjs](scripts/build.mjs)).
- Backend dev API: `npm run dev` in [server/package.json](server/package.json) (ts-node-dev + NestJS).
- Background worker for queues: `npm run worker` in [server/package.json](server/package.json).
- Local infra: `docker-compose up` uses Postgres + Redis + API + worker; env values come from compose.*.env files.

## Project-specific patterns
- Frontend API base URL is runtime-configurable via `window.HRPRO_API_URL`, defaulting to http://localhost:4000 (see [src/services/http.ts](src/services/http.ts)).
- Auth token storage is localStorage key `hrpro_token`, set/cleared in [src/services/http.ts](src/services/http.ts); session bootstrap uses `/auth/me` in [src/context/AuthContext.tsx](src/context/AuthContext.tsx).
- Payroll calculation is async via BullMQ queue `payroll.calculate` and a dedicated worker process (see [server/src/worker.ts](server/src/worker.ts)).
- Prisma client is injected via `PrismaService` and module in [server/src/common/prisma.service.ts](server/src/common/prisma.service.ts).

## Domain notes worth knowing
- Multi-company by `company_id` is a core assumption across entities (see [ArquiteturaERD.md](ArquiteturaERD.md)).
- Excel legacy import and eSocial integration have defined flows and validations (see [PlanoImportacaoExcel.md](PlanoImportacaoExcel.md) and [PlanoIntegracaoESocial.md](PlanoIntegracaoESocial.md)).
- API/queue names and payload expectations are captured in [APIsEFila.md](APIsEFila.md).
