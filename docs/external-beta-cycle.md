# Ciclo de Beta Externo

## Resumo

Este ciclo deixou o Patrimoniq mais pronto para beta externo real sem reescrever a arquitetura:

- web com proxy same-origin em `/api/proxy`
- sessao HTTP-only centralizada na web
- monitoramento externo opcional por webhook
- autoteste autenticado de e-mail em `Configuracoes`
- onboarding inicial discreto no dashboard
- preview externo rapido por `localtunnel`

## Arquivos alterados

### Backend

- `apps/api/.env`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/common/app-exception.filter.ts`
- `apps/api/src/common/email.service.ts`
- `apps/api/src/common/email.templates.ts`
- `apps/api/src/common/monitoring.service.ts`
- `apps/api/src/common/prisma.module.ts`
- `apps/api/src/common/runtime-config.service.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/settings/settings.controller.ts`
- `apps/api/src/modules/settings/settings.service.ts`

### Frontend

- `apps/web/.env.example`
- `apps/web/.env.local`
- `apps/web/src/app/api/proxy/[...path]/route.ts`
- `apps/web/src/app/dashboard/page-client.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/settings/page-client.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/server-auth.ts`

### Operacao e documentacao

- `package.json`
- `docker-compose.beta.yml`
- `ngrok.beta.yml`
- `README.md`
- `docs/deploy-beta.md`
- `docs/beta-manual-checklist.md`
- `docs/delivery-status.md`
- `docs/external-beta-cycle.md`

## Endpoints novos ou alterados

- `POST /api/settings/diagnostics/email-test`
- `GET /api/dashboard/overview` com bloco `onboarding`
- `GET /api/settings` com bloco `runtime`
- `GET|POST|PATCH|PUT|DELETE|OPTIONS /api/proxy/[...path]`

## Variaveis de ambiente para beta

### API

- `DATABASE_URL`
- `PORT`
- `NODE_ENV=production`
- `APP_STAGE=beta`
- `FRONTEND_URL=https://sua-web-beta`
- `APP_PUBLIC_URL=https://sua-web-beta`
- `CORS_ORIGINS=https://sua-web-beta`
- `TRUST_PROXY=1`
- `APP_PROXY_MODE=same-origin`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=lax`
- `COOKIE_DOMAIN=`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES=60`
- `EMAIL_PROVIDER=smtp`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_REPLY_TO`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_VERIFY_CONNECTION=true`
- `ENABLE_SMTP_SELF_TEST=true`
- `MONITORING_PROVIDER=webhook`
- `MONITORING_WEBHOOK_URL`
- `MONITORING_WEBHOOK_TOKEN`
- `MONITORING_WEBHOOK_TIMEOUT_MS=3500`

### Web

- `APP_URL=https://sua-web-beta`
- `NEXT_PUBLIC_APP_URL=https://sua-web-beta`
- `API_URL=https://sua-web-beta/api/proxy`
- `NEXT_PUBLIC_API_URL=/api/proxy`
- `BACKEND_API_URL=https://sua-api-beta/api`

## Preview externo rapido

1. `pnpm --filter @patrimoniq/api build`
2. `pnpm start:api`
3. `pnpm dev:web` ou `pnpm start:web`
4. `pnpm beta:preview`

Esse caminho usa `localtunnel` e expoe apenas a web. A API continua privada e acessivel pela web via proxy.

## Monitoramento

O backend agora consegue enviar erros internos para um webhook externo com:

- `requestId`
- rota
- status
- usuario autenticado, quando houver
- stack, quando disponivel

## Onboarding

O dashboard agora orienta o primeiro uso com:

- primeira conta
- revisao de categorias
- primeira receita
- primeira despesa
- primeira meta

## Validacao executada

- login, `auth/me`, dashboard, settings e logout via `http://localhost:3000/api/proxy`
- protecao de rota apos logout
- cadastro, recuperacao e reset de senha via proxy
- `GET /api/proxy/health`
- login e dashboard pela URL externa do `localtunnel`

## Pendencias restantes

- credenciais SMTP reais no ambiente beta
- webhook real de monitoramento
- deploy persistente da web e da API, se o beta deixar de ser temporario
- Open Finance, importacao bancaria e OCR

## Atualizacao 2026-03-23

Este ciclo curto fechou a etapa operacional que faltava antes da abertura para os primeiros
usuarios de teste:

- SMTP Hostinger validado com `smtp.hostinger.com`, porta `465` e SSL/TLS
- `EMAIL_PROVIDER=smtp` ativo no backend local
- conexao SMTP verificada no boot com `SMTP_VERIFY_CONNECTION=true`
- e-mail de boas-vindas enviado em cadastro real
- e-mail de teste disparado pela tela `Configuracoes`
- recuperacao de senha enviada por e-mail real
- redefinicao de senha concluida com token expiravel
- validacao ponta a ponta local e por URL externa temporaria

O beta externo temporario validado neste ciclo foi:

- `https://curvy-rules-joke.loca.lt`

Como o endereco e temporario, ele pode mudar em um novo bootstrap do tunnel.
