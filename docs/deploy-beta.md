# Deploy Beta

## Estrategia recomendada

Use a web como ponto unico de sessao e encaminhe a API real por `/api/proxy`.

Isso evita o problema de cookie entre dominios diferentes e simplifica login, logout, middleware e recuperacao de senha.

Para o beta pequeno, a opcao mais estavel dentro da arquitetura atual e:

- um host Linux pequeno
- `docker-compose.beta.stable.yml`
- Caddy terminando HTTPS
- web exposta no dominio beta
- API privada atras da web
- Supabase como banco
- Hostinger SMTP para transacionais

## Variaveis da API

- `DATABASE_URL`
- `PORT`
- `NODE_ENV`
- `APP_STAGE`
- `FRONTEND_URL`
- `APP_PUBLIC_URL`
- `CORS_ORIGINS`
- `TRUST_PROXY`
- `APP_PROXY_MODE`
- `COOKIE_SECURE`
- `COOKIE_DOMAIN`
- `COOKIE_SAME_SITE`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `EMAIL_PROVIDER`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_REPLY_TO`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_VERIFY_CONNECTION`
- `ENABLE_SMTP_SELF_TEST`
- `MONITORING_PROVIDER`
- `MONITORING_WEBHOOK_URL`
- `MONITORING_WEBHOOK_TOKEN`
- `MONITORING_WEBHOOK_TIMEOUT_MS`
- `FEEDBACK_WEBHOOK_URL`
- `FEEDBACK_WEBHOOK_TOKEN`
- `FEEDBACK_WEBHOOK_TIMEOUT_MS`
- `FEEDBACK_EMAIL_TO`
- `ONBOARDING_STALE_HOURS`

## Variaveis da Web

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `API_URL`
- `NEXT_PUBLIC_API_URL`
- `BACKEND_API_URL`

## Fluxo minimo de deploy

1. criar ou vincular o projeto Supabase
2. gerar `supabase/roles.sql` com `SUPABASE_PRISMA_DB_PASSWORD`
3. definir `DATABASE_URL` apontando para o pooler de sessao do Supabase
   use a string exata do `Session pooler` do painel `Connect`
   mantenha `connect_timeout=30` quando quiser mais tolerancia a latencia
4. configurar a web para expor `/api/proxy` e apontar `BACKEND_API_URL` para a API real
5. configurar SMTP real com `EMAIL_PROVIDER=smtp`
6. revisar cookie para producao:
   `COOKIE_SECURE=true`
   `COOKIE_SAME_SITE=lax`
   `COOKIE_DOMAIN=` vazio quando a sessao ficar centralizada na web
7. revisar `APP_PUBLIC_URL`, `FRONTEND_URL` e `CORS_ORIGINS` para o dominio beta real
8. opcionalmente ligar `MONITORING_PROVIDER=webhook`
9. executar `pnpm db:push`
10. executar `pnpm db:seed`
11. buildar API com `pnpm --filter @patrimoniq/api build`
12. buildar Web com `pnpm --filter @patrimoniq/web build`
13. publicar API
14. publicar Web

## Caminho estavel com Caddy

Arquivos prontos:

- `docker-compose.beta.stable.yml`
- `infra/beta/Caddyfile`
- `infra/beta/.env.example`

Passo a passo:

1. copiar `infra/beta/.env.example` para `infra/beta/.env`
2. definir `BETA_DOMAIN` e `LETSENCRYPT_EMAIL`
3. preencher `apps/api/.env` com Supabase, SMTP e variaveis de beta
4. preencher `apps/web/.env.local` com a URL final do beta
5. rodar `pnpm docker:beta:stable:up`
6. apontar o DNS do dominio para o host
7. validar login, reset de senha e feedback no app

## Docker beta opcional

O repositorio inclui containers somente para a API e a Web:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `docker-compose.beta.yml`

## Preview externo rapido

Para um beta temporario sem publicar infra definitiva:

1. subir a API com `pnpm --filter @patrimoniq/api build`
2. subir a API com `pnpm start:api`
3. subir a web com `pnpm dev:web`
4. abrir a URL externa com `pnpm beta:preview`

Use esse caminho apenas para demonstracoes ou teste rapido. Para usuarios beta reais, prefira o compose com Caddy.

## Checklist antes de abrir beta

- login e cadastro funcionando
- recuperacao de senha validada
- SMTP configurado para producao
- cookie de sessao em ambiente externo validado pela web
- CORS ajustado para a URL real da web
- `BACKEND_API_URL` apontando para a API real
- banco Supabase acessivel pela API
- seed de demonstracao carregado ou ambiente vazio pronto
- rotas protegidas validas sem acesso anonimo
- variaveis de producao revisadas
- feedback no app salvando no banco
- analytics respondendo em `GET /api/analytics/summary`
