# Relatorio completo do sistema HRPro

Data: 2026-02-05

## 1) Visao geral
O sistema e uma aplicacao web em React + TypeScript com UI baseada em Tailwind + componentes Radix/shadcn. O build e feito por esbuild e o roteamento e feito via `HashRouter`.

- Entrada da app: [src/main.tsx](src/main.tsx)
- Componente raiz e rotas: [src/App.tsx](src/App.tsx)
- Layout principal (header + sidebar): [src/components/Layout.tsx](src/components/Layout.tsx)
- Protecao de rotas e controle de acesso: [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)
- Estilos globais: [src/shadcn.css](src/shadcn.css)
- Build e dev server: [scripts/build.mjs](scripts/build.mjs)

## 2) Arquitetura e fluxo
- App client-side com `HashRouter` (URLs do tipo `#/rota`).
- Autenticacao simulada em memoria, com persistencia em `localStorage` via `AuthContext`.
- Servicos sao mocks locais (sem backend real), com delays via `setTimeout`.
- Fluxo geral: UI -> pagina -> service mock -> dados em memoria -> renderizacao.

Arquivos base:
- Auth e usuario: [src/context/AuthContext.tsx](src/context/AuthContext.tsx)
- Utilitarios: [src/lib/utils.ts](src/lib/utils.ts)
- Hooks de UI: [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx), [src/hooks/use-toast.ts](src/hooks/use-toast.ts)

## 3) Navegacao e rotas
Rotas definidas em [src/App.tsx](src/App.tsx). Todas, exceto login, exigem autenticacao. Rotas com `requiredRole="admin"` exigem perfil admin.

- `#/login` -> Login
- `#/` -> Dashboard
- `#/paystubs` -> Holerites
- `#/paystubs/:id` -> Detalhe do holerite
- `#/admin/payroll-upload` -> Upload folha (admin)
- `#/support` -> Central de suporte
- `#/support/chat` -> Chat com suporte
- `#/support/new-ticket` -> Abrir ticket
- `#/support/tickets/:id` -> Detalhe do ticket
- `#/calendar` -> Gestao academica
- `#/reports` -> Relatorios academicos
- `#/rescision` -> Calculadora de rescisao
- `#/documents` -> Documentos e avisos
- `#/benefits` -> Beneficios
- `#/admin/employees` -> Gestao de funcionarios (admin)
- `#/admin/config` -> Configuracoes (admin)

Observacao: ha duplicidade da rota `#/rescision` e import duplicado no arquivo de rotas. Ver [src/App.tsx](src/App.tsx).

## 4) Modulos e paginas (detalhamento)

### 4.1) Autenticacao
- Contexto de auth com usuarios mock e senha fixa `123456`.
- Persistencia em `localStorage` (`hrpro_user`).
- Roles suportadas: `employee`, `intern`, `admin`.
- Arquivo: [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

### 4.2) Login
- Formulario com validacao simples e senha visivel/oculta.
- Credenciais de teste exibidas em tela.
- Arquivo: [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx)

### 4.3) Dashboard
- Cards de resumo (salario, holerites, tempo empresa, performance).
- Info do funcionario a partir do contexto de auth.
- Acoes rapidas para holerites e documentos.
- Arquivo: [src/pages/DashboardPage.tsx](src/pages/DashboardPage.tsx)

### 4.4) Holerites
- Lista de holerites e resumo do ultimo recebido.
- Download simulado de PDF.
- Service: [src/services/api.ts](src/services/api.ts)
- Paginas: [src/pages/PaystubsPage.tsx](src/pages/PaystubsPage.tsx), [src/pages/PaystubDetailPage.tsx](src/pages/PaystubDetailPage.tsx)

### 4.5) Upload de folha (admin)
- Upload de planilha Excel, validacao de tipo.
- Processamento simulado com contagem de linhas e erros.
- Service: [src/services/api.ts](src/services/api.ts)
- Pagina: [src/pages/AdminPayrollUploadPage.tsx](src/pages/AdminPayrollUploadPage.tsx)

### 4.6) Suporte
- Lista de tickets com status e prioridade.
- Chat ao vivo com atualizacao periodica (polling a cada 5s).
- Criacao de tickets e mensagens.
- Service: [src/services/supportApi.ts](src/services/supportApi.ts)
- Paginas: [src/pages/SupportPage.tsx](src/pages/SupportPage.tsx), [src/pages/ChatPage.tsx](src/pages/ChatPage.tsx), [src/pages/NewTicketPage.tsx](src/pages/NewTicketPage.tsx), [src/pages/TicketDetailPage.tsx](src/pages/TicketDetailPage.tsx)

### 4.7) Gestao academica
- Filtros por professor, mes e ano.
- Controle de aulas programadas/realizadas/extras/substituicoes.
- Cadastro e aprovacao de aulas extras.
- Relatorios (placeholder).
- Services: [src/services/academicApi.ts](src/services/academicApi.ts), [src/services/employeeApi.ts](src/services/employeeApi.ts)
- Pagina: [src/pages/CalendarPage.tsx](src/pages/CalendarPage.tsx)

### 4.8) Relatorios academicos
- Analiticos anuais com graficos (linha, barras, pizza).
- Soma de aulas, receita e valor medio por hora.
- Service: [src/services/academicApi.ts](src/services/academicApi.ts)
- Pagina: [src/pages/ReportsPage.tsx](src/pages/ReportsPage.tsx)

### 4.9) Calculadora de rescisao
- Busca por CPF, parametrizacao de tipo e data de rescisao.
- Calcula verbas rescisorias e gera documento TRCT.
- Service: [src/services/rescisionApi.ts](src/services/rescisionApi.ts)
- Pagina: [src/pages/RescisionCalculatorPage.tsx](src/pages/RescisionCalculatorPage.tsx)
- Documento: [src/components/RescisionDocument.tsx](src/components/RescisionDocument.tsx)

### 4.10) Documentos e avisos
- Listagem com filtros, download e visualizacao simulada.
- Assinatura digital por token (mock) com modal.
- Aba de avisos e historico de beneficios.
- Upload de documentos.
- Service: [src/services/documentsApi.ts](src/services/documentsApi.ts)
- Pagina: [src/pages/DocumentsPage.tsx](src/pages/DocumentsPage.tsx)

### 4.11) Beneficios
- Solicitacao de vale transporte e vale alimentacao.
- Historico de solicitacoes (mock).
- Pagina: [src/pages/BenefitsPage.tsx](src/pages/BenefitsPage.tsx)

### 4.12) Gestao de funcionarios (admin)
- Listagem com filtros e modal de detalhes.
- Fluxo de aprovacao/rejeicao de pendentes.
- Cadastro de novo funcionario (modal).
- Calculo de folha mensal em lote (mock), com totalizadores.
- Service: [src/services/employeeApi.ts](src/services/employeeApi.ts)
- Pagina: [src/pages/AdminEmployeesPage.tsx](src/pages/AdminEmployeesPage.tsx)

### 4.13) Configuracoes do sistema (admin)
- Edicao de valores de hora-aula, INSS, IRRF, formulas e beneficios.
- Exportacao/importacao de configuracoes (JSON).
- Teste de calculo com resultado detalhado.
- Service: [src/services/configApi.ts](src/services/configApi.ts)
- Pagina: [src/pages/AdminConfigPage.tsx](src/pages/AdminConfigPage.tsx)

## 5) Servicos e dados
Todos os services sao mocks locais (sem rede real).

- Holerites e upload folha: [src/services/api.ts](src/services/api.ts)
- Tickets e chat: [src/services/supportApi.ts](src/services/supportApi.ts)
- Gestao academica: [src/services/academicApi.ts](src/services/academicApi.ts)
- Documentos, avisos, beneficios: [src/services/documentsApi.ts](src/services/documentsApi.ts)
- Funcionarios e folha: [src/services/employeeApi.ts](src/services/employeeApi.ts)
- Rescisao: [src/services/rescisionApi.ts](src/services/rescisionApi.ts)
- Configuracoes: [src/services/configApi.ts](src/services/configApi.ts)

Caracteristicas comuns:
- Dados em memoria (arrays mock).
- Latencia simulada via `setTimeout`.
- Sem persistencia real (reinicio da pagina perde alteracoes).

## 6) Regras e calculos relevantes

### 6.1) Holerite
- Resumo por mes com rendimentos e descontos.
- FGTS exibido (8%).
- Ver [src/pages/PaystubDetailPage.tsx](src/pages/PaystubDetailPage.tsx), [src/services/api.ts](src/services/api.ts)

### 6.2) Folha de pagamento
- Professores: calculo por hora (horas semanais * valor hora * 4.5).
- DSR: 1/6 do salario base.
- Hora atividade: 5% sobre base + DSR.
- INSS e IRRF com tabelas 2024.
- FGTS: 8%.
- Ver [src/services/employeeApi.ts](src/services/employeeApi.ts), [src/services/configApi.ts](src/services/configApi.ts)

### 6.3) Rescisao
- Saldo de salario, aviso previo, 13o, ferias e FGTS conforme tipo.
- Multa FGTS: 40% (sem justa causa/indireta), 20% (acordo).
- Ver [src/services/rescisionApi.ts](src/services/rescisionApi.ts)

### 6.4) Beneficios
- Vale transporte e alimentacao com valores configuraveis.
- Beneficios em [src/services/configApi.ts](src/services/configApi.ts) e simulacao em [src/pages/BenefitsPage.tsx](src/pages/BenefitsPage.tsx).

## 7) UI e componentes
- Componentes de UI em [src/components/ui](src/components/ui).
- Bibliotecas de UI: Radix, shadcn, Lucide, Recharts.
- Utilitario `cn` (merge de classes) e formatadores basicos em [src/lib/utils.ts](src/lib/utils.ts).

## 8) Build, dev e deploy
- Dev: `npm run dev` (esbuild + watch + serve).
- Build prod: `npm run build`.
- Script de build: [scripts/build.mjs](scripts/build.mjs)
- Config Tailwind: [tailwind.config.js](tailwind.config.js)
- Entrada HTML: [index.html](index.html)
- Guia de deploy: [DeploymentGuide.txt](DeploymentGuide.txt)
- Instrucoes basicas: [FileDescription.txt](FileDescription.txt)

## 9) Dependencias principais (resumo)
- React 18, React Router 7, Tailwind CSS.
- UI: Radix UI, Lucide, shadcn, Recharts.
- Forms: React Hook Form, Zod.
- Outros: date-fns, zustand, sonner, jsPDF, html2canvas.
- Ver [package.json](package.json)

## 10) Limitacoes atuais (tecnicas)
- Sem backend real e sem persistencia duravel; tudo e mock em memoria.
- Autenticacao e autorizacao simuladas; senha fixa.
- Downloads e uploads sao simulados na maioria dos fluxos.
- Alguns relatorios estao marcados como "em desenvolvimento".

## 11) Inventario do sistema (arquivos-chave)
- App e rotas: [src/App.tsx](src/App.tsx)
- Layout: [src/components/Layout.tsx](src/components/Layout.tsx)
- Autenticacao: [src/context/AuthContext.tsx](src/context/AuthContext.tsx)
- Paginas: [src/pages](src/pages)
- Servicos: [src/services](src/services)
- Estilos: [src/shadcn.css](src/shadcn.css)
- Build: [scripts/build.mjs](scripts/build.mjs)

---
Fim do relatorio.
