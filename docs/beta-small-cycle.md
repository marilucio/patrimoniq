# Ciclo de Beta Pequeno

## Objetivo

Preparar o Patrimoniq para um beta pequeno real com:

- ambiente beta mais estavel
- eventos basicos de produto
- feedback discreto dentro do app
- onboarding mais guiado
- refinamentos finos de UX

## Arquivos alterados

### Backend

- `apps/api/.env.example`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/email.templates.ts`
- `apps/api/src/common/prisma.module.ts`
- `apps/api/src/common/product-analytics.service.ts`
- `apps/api/src/common/runtime-config.service.ts`
- `apps/api/src/modules/accounts/accounts.service.ts`
- `apps/api/src/modules/analytics/analytics.controller.ts`
- `apps/api/src/modules/analytics/analytics.module.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/feedback/feedback.controller.ts`
- `apps/api/src/modules/feedback/feedback.module.ts`
- `apps/api/src/modules/feedback/feedback.service.ts`
- `apps/api/src/modules/goals/goals.service.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`

### Frontend

- `apps/web/src/app/dashboard/page-client.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/settings/page-client.tsx`
- `apps/web/src/app/transactions/page-client.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/components/feedback-widget.tsx`
- `apps/web/src/lib/api.ts`

### Deploy e documentacao

- `docker-compose.beta.stable.yml`
- `infra/beta/Caddyfile`
- `infra/beta/.env.example`
- `package.json`
- `README.md`
- `docs/beta-manual-checklist.md`
- `docs/beta-small-cycle.md`
- `docs/beta-small-opening-playbook.md`
- `docs/deploy-beta.md`
- `docs/delivery-status.md`

## Eventos implementados

- `REGISTER_COMPLETED`
- `LOGIN_COMPLETED`
- `PASSWORD_RESET_REQUESTED`
- `DASHBOARD_FIRST_VIEWED`
- `FIRST_ACCOUNT_CREATED`
- `FIRST_INCOME_CREATED`
- `FIRST_EXPENSE_CREATED`
- `FIRST_GOAL_CREATED`
- `ONBOARDING_STALLED`
- `FEEDBACK_SUBMITTED`

## Onde os eventos sao disparados

- cadastro e login: `auth.service.ts`
- recuperacao de senha: `auth.service.ts`
- primeira conta: `accounts.service.ts`
- primeira receita e primeira despesa: `transactions.service.ts`
- primeira meta: `goals.service.ts`
- primeira visao geral e onboarding interrompido: `dashboard.service.ts`
- envio de feedback: `feedback.service.ts`

## Como consultar esses dados

- `GET /api/analytics/summary`
- `GET /api/feedback`
- pela tela `Configuracoes`, em `Sinais do beta` e `Feedback recente`

## Mecanismo de feedback implementado

- botao discreto `Feedback beta` fixo na interface autenticada
- categoria opcional
- mensagem curta
- contexto automatico da tela atual
- armazenamento em `FeedbackSubmission`
- encaminhamento opcional por:
  - `FEEDBACK_WEBHOOK_URL`
  - `FEEDBACK_EMAIL_TO`

## Melhorias de onboarding aplicadas

- passo principal explicito na visao geral
- frase de nudge com proxima acao recomendada
- transacoes orientando o usuario a cadastrar conta primeiro
- sinais do beta mostrando se o onboarding travou cedo

## Estrategia recomendada para beta estavel

Recomendacao principal:

- `docker-compose.beta.stable.yml`
- Caddy como proxy HTTPS
- dominio proprio
- web expondo `/api/proxy`
- API privada no host
- Supabase como banco remoto

## Estado atual para abertura

O produto ficou pronto para um beta pequeno e controlado, com:

- autenticacao individual
- recuperacao de senha real
- analytics basicos
- feedback em contexto
- onboarding mais guiado
- caminho estavel de deploy documentado

## Observacao importante desta rodada

O schema novo foi aplicado no Supabase com `pnpm db:push`. O build da API e da web passou.
Na validacao local de runtime, a API encontrou um problema de conectividade com a `DATABASE_URL`
atual (`P1001`), enquanto o projeto continua vinculado ao Supabase via CLI. Isso aponta para um
ajuste de string de conexao ou ambiente, nao para falha da implementacao de analytics/feedback.
