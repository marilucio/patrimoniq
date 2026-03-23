# Patrimoniq

Patrimoniq e um aplicativo individual de financas pessoais. Cada usuario cria sua propria conta, faz login obrigatorio e acessa somente os proprios dados de transacoes, orcamentos, metas, patrimonio, relatorios e configuracoes.

## Stack

- `apps/web`: Next.js 15 + TypeScript + App Router
- `apps/api`: NestJS 11 + Prisma + PostgreSQL no Supabase
- `packages/domain`: catalogos e calculos compartilhados

## Estrutura

```text
apps/
  api/
  web/
packages/
  domain/
docs/
```

## Fluxo atual

1. o usuario entra em `/login` ou cria conta em `/register`
2. a sessao HTTP-only e criada pela API
3. o middleware protege as rotas internas e redireciona anonimos para login
4. todo dado financeiro passa a pertencer diretamente ao `userId`

## Modulos ativos

- Visao geral
- Transacoes
- Orcamentos
- Metas
- Patrimonio
- Relatorios
- Configuracoes

## Scripts

- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm start:web`
- `pnpm start:api`
- `pnpm build`
- `pnpm db:push`
- `pnpm db:seed`
- `pnpm supabase:link`
- `pnpm supabase:role:render`
- `pnpm supabase:types`
- `pnpm beta:preview`
- `pnpm beta:tunnel`
- `pnpm docker:beta:up`
- `pnpm docker:beta:down`
- `pnpm docker:beta:stable:up`
- `pnpm docker:beta:stable:down`

## Primeiro setup com Supabase

1. copiar `apps/api/.env.example` para `apps/api/.env`
2. copiar `apps/web/.env.example` para `apps/web/.env.local`
3. definir `SUPABASE_PRISMA_DB_PASSWORD` no terminal
4. rodar `pnpm supabase:link`
5. rodar `pnpm supabase:role:render`
6. rodar `pnpm db:push`
7. rodar `pnpm db:seed`
8. subir a API com `pnpm --filter @patrimoniq/api build` e `pnpm start:api`
9. subir a web com `pnpm dev:web`

O banco principal agora e o Supabase. Docker nao e mais necessario para persistencia.

## Valores que voce precisa copiar do painel do Supabase

1. `Connect > Session pooler` para montar a `DATABASE_URL`
2. `Project URL` apenas se voce quiser preparar integracoes futuras com a API do Supabase

As chaves `anon` e `service_role` nao sao necessarias no runtime atual do Patrimoniq.

Para a API do Patrimoniq, use a string exata do `Session pooler` no painel `Connect` do Supabase.
Se a API acusar `P1001`, revise a string e considere manter `connect_timeout=30` na `DATABASE_URL`.

## Reset de senha

O fluxo de recuperacao de senha ja esta implementado com:

- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`
- tokens expiram por `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `EMAIL_PROVIDER=auto` para usar SMTP real quando as credenciais existirem
- fallback `console` apenas quando nao houver SMTP configurado

## API via proxy same-origin

O frontend agora fala com a API por `NEXT_PUBLIC_API_URL=/api/proxy`.

Na pratica:

- o navegador conversa apenas com a web
- a web encaminha para a API real com `BACKEND_API_URL`
- o cookie HTTP-only fica estavel no dominio da web

## SMTP transacional

Para ambiente externo, configure:

- `EMAIL_PROVIDER=smtp` para obrigar envio real
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

## Monitoramento basico

Para habilitar captura externa simples de falhas da API:

- `MONITORING_PROVIDER=webhook`
- `MONITORING_WEBHOOK_URL`
- `MONITORING_WEBHOOK_TOKEN`
- `MONITORING_WEBHOOK_TIMEOUT_MS=3500`

## Analytics e feedback beta

O app agora registra eventos basicos de ativacao e uso:

- cadastro concluido
- login realizado
- recuperacao de senha solicitada
- primeira conta criada
- primeira receita criada
- primeira despesa criada
- primeira meta criada
- primeira visualizacao do dashboard
- onboarding interrompido, quando o usuario fica parado cedo demais
- feedback enviado pelo app

Endpoints principais:

- `GET /api/analytics/summary`
- `GET /api/feedback`
- `POST /api/feedback`

Variaveis opcionais para encaminhamento operacional do feedback:

- `FEEDBACK_WEBHOOK_URL`
- `FEEDBACK_WEBHOOK_TOKEN`
- `FEEDBACK_WEBHOOK_TIMEOUT_MS=3500`
- `FEEDBACK_EMAIL_TO`
- `ONBOARDING_STALE_HOURS=24`

## Beta externo rapido

1. subir a API com `pnpm --filter @patrimoniq/api build` e `pnpm start:api`
2. subir a web com `pnpm dev:web` ou `pnpm start:web`
3. abrir uma URL externa temporaria com `pnpm beta:preview`

## Beta estavel recomendado

Para um beta pequeno com menos oscilacao do que `localtunnel`, use:

- `docker-compose.beta.stable.yml`
- `infra/beta/Caddyfile`
- Supabase como banco remoto
- Hostinger SMTP para e-mails transacionais

Esse caminho publica apenas a web em HTTPS com Caddy. A API continua privada e e acessada pela web via proxy same-origin.

## Credenciais seed

- `ricardo@patrimoniq.local` / `Patrimoniq123!`
- `ana@patrimoniq.local` / `Patrimoniq123!`

## Documentacao principal

- `docs/architecture.md`
- `docs/product-flows.md`
- `docs/design-system.md`
- `docs/delivery-status.md`
- `docs/deploy-beta.md`
- `docs/beta-manual-checklist.md`
- `docs/individual-refactor-cycle.md`
- `docs/supabase-migration-cycle.md`
- `docs/beta-hardening-cycle.md`
- `docs/external-beta-cycle.md`
- `docs/beta-opening-readiness.md`
- `docs/beta-small-opening-playbook.md`
- `docs/beta-small-cycle.md`
