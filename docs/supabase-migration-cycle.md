# Ciclo de Migracao para Supabase

## Objetivo

Migrar a persistencia principal do Patrimoniq para Supabase Postgres, mantendo Prisma como ORM, o modelo individual por usuario e o monorepo atual com Next.js + NestJS.

## Estrutura encontrada

- `apps/api`: API NestJS com Prisma, sessao HTTP-only e ownership por `userId`
- `apps/web`: App Router do Next.js com rotas protegidas e consumo da API
- `packages/domain`: calculos e catalogos compartilhados
- `apps/api/prisma/schema.prisma`: schema central da persistencia

## Estrategia usada

- Supabase CLI para vincular o projeto remoto e aplicar migrations SQL
- Prisma como fonte de verdade do modelo
- `prisma migrate diff --from-empty --to-schema-datamodel` para gerar o SQL inicial reproduzivel
- `supabase db push --linked --include-roles` para aplicar papel dedicado do Prisma e o schema remoto
- `prisma db seed` para popular o banco em nuvem com dados individuais de demonstracao

Usei migration SQL versionada em vez de `prisma db push` como fluxo principal porque isso deixa o estado do banco remoto rastreavel e coerente para deploy beta.

## Arquivos alterados

- `apps/api/.env`
- `apps/api/.env.example`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/common/email.service.ts`
- `apps/api/src/common/email.templates.ts`
- `apps/api/src/common/prisma.module.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/web/middleware.ts`
- `apps/web/src/app/login/page-client.tsx`
- `apps/web/src/app/forgot-password/page.tsx`
- `apps/web/src/app/forgot-password/page-client.tsx`
- `apps/web/src/app/reset-password/page.tsx`
- `apps/web/src/app/reset-password/page-client.tsx`
- `apps/web/src/components/app-shell.tsx`
- `README.md`
- `docs/architecture.md`
- `docs/deploy-beta.md`
- `docs/delivery-status.md`
- `docs/individual-refactor-cycle.md`
- `package.json`
- `docker-compose.beta.yml`
- `supabase/.gitignore`
- `supabase/config.toml`
- `supabase/migrations/20260322222252_initial_individual_schema.sql`

## Arquivos novos

- `docs/supabase-migration-cycle.md`
- `scripts/render-supabase-role.ps1`
- `supabase/roles.sql.template`
- `supabase/seed.sql`

## Arquivos removidos

- `docker-compose.yml`

## Variaveis de ambiente necessarias

### API

- `DATABASE_URL`
- `PORT`
- `FRONTEND_URL`
- `APP_PUBLIC_URL`
- `CORS_ORIGINS`
- `TRUST_PROXY`
- `COOKIE_SECURE`
- `COOKIE_DOMAIN`
- `PASSWORD_RESET_TOKEN_TTL_MINUTES`
- `EMAIL_PROVIDER`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`

### Web

- `API_URL`
- `NEXT_PUBLIC_API_URL`

## O que copiar do painel do Supabase

1. `Connect > Session pooler`
   Use a string na porta `5432` como base da `DATABASE_URL`.
2. `Project URL`
   Opcional neste ciclo. So sera util se voce quiser integrar o SDK do Supabase depois.

As chaves `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nao sao necessarias no runtime atual do Patrimoniq.

## Comandos executados no terminal

```powershell
supabase --version
supabase projects list
supabase link --project-ref mykrcgdfxgoupmrajcvw
supabase projects api-keys --project-ref mykrcgdfxgoupmrajcvw
supabase migration new initial_individual_schema
pnpm --filter @patrimoniq/api exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
$env:SUPABASE_PRISMA_DB_PASSWORD='<senha-do-usuario-prisma>'
pnpm supabase:role:render
pnpm db:push
pnpm db:seed
```

## Como conectar ao Supabase

1. autentique o Supabase CLI com `supabase login`
2. vincule o projeto com `pnpm supabase:link`
3. defina `SUPABASE_PRISMA_DB_PASSWORD` no terminal
4. gere `supabase/roles.sql` com `pnpm supabase:role:render`
5. monte `DATABASE_URL` com o usuario `prisma.<PROJECT_REF>`
6. aplique schema e roles com `pnpm db:push`
7. popule o banco com `pnpm db:seed`

## Como rodar sem Docker para banco

1. configure `apps/api/.env` apontando para o pooler do Supabase
2. configure `apps/web/.env.local`
3. execute `pnpm dev:api`
4. execute `pnpm dev:web`

O Docker agora e apenas opcional para empacotar API e Web. O banco principal fica no Supabase.

## Como aplicar schema

O arquivo versionado principal e:

- `supabase/migrations/20260322222252_initial_individual_schema.sql`

Para aplicar:

```powershell
pnpm db:push
```

## Como executar seed

```powershell
pnpm db:seed
```

O seed continua individual por usuario e cria as contas demo:

- `ricardo@patrimoniq.local`
- `ana@patrimoniq.local`

## Endpoints de recuperacao de senha

- `POST /api/auth/password/forgot`
- `POST /api/auth/password/reset`

## O que ficou implementado para recuperacao de senha

- tabela `PasswordResetToken` no Prisma
- token com hash e expiracao
- revogacao de sessoes ativas apos redefinicao
- servico de e-mail com provider `console` ou SMTP
- template de e-mail HTML e texto
- telas `forgot-password` e `reset-password`

## Pendencias restantes

- configurar SMTP transacional real para producao
- validar fluxo completo de reset por link recebido em caixa externa com provedor SMTP real
- gerar tipos Supabase apenas se o projeto passar a usar SDK do Supabase
- Open Finance
- OCR
- importacao bancaria
