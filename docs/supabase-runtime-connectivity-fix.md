# Correcao de conectividade Supabase no runtime

## Problema encontrado

O runtime da API falhava com `P1001` mesmo com o host do Supabase acessivel por TCP.

Na pratica, a `DATABASE_URL` usada pela API estava incompleta para o pooler do Supabase:

- faltava `sslmode=require`
- faltava `connect_timeout=30`

Depois que a conectividade voltou, a validacao de login revelou um segundo problema operacional:

- o banco remoto ainda nao tinha as tabelas novas `ProductEvent` e `FeedbackSubmission`

Na web local havia ainda um detalhe de configuracao separado:

- `API_URL` apontava para `http://localhost:3000/api/proxy`
- isso fazia as leituras server-side do Next chamarem o proprio proxy
- o ajuste correto para o ambiente local e apontar `API_URL` direto para `http://localhost:3333/api`

## O que foi corrigido

### API

Arquivo local ajustado:

- `apps/api/.env`

Formato corrigido da conexao:

```txt
postgresql://prisma.<PROJECT_REF>:<PRISMA_DB_PASSWORD>@<DB_REGION>.pooler.supabase.com:5432/postgres?schema=public&sslmode=require&connect_timeout=30
```

Tambem foi alinhado o exemplo:

- `apps/api/.env.example`

### Web local

Arquivo local ajustado:

- `apps/web/.env.local`

Mudanca aplicada:

```txt
API_URL=http://localhost:3333/api
NEXT_PUBLIC_API_URL=/api/proxy
BACKEND_API_URL=http://localhost:3333/api
```

Tambem foi alinhado o exemplo:

- `apps/web/.env.example`

## Comandos executados

```powershell
pnpm --dir apps/api exec prisma db pull --print
pnpm --dir apps/api exec prisma db push --skip-generate
pnpm --filter @patrimoniq/api start
pnpm --filter @patrimoniq/web dev
```

## Resultado da validacao final

### Backend direto

- `GET /api/health`: ok
- `POST /api/auth/login`: ok
- `GET /api/auth/me`: ok
- `GET /api/dashboard/overview`: ok
- `GET /api/transactions?page=1&pageSize=5`: ok
- `POST /api/feedback`: ok
- `GET /api/feedback?limit=5`: ok
- `GET /api/analytics/summary`: ok

### Proxy same-origin da web

- `GET /api/proxy/health`: ok
- `POST /api/proxy/auth/login`: ok
- `GET /api/proxy/auth/me`: ok
- `GET /api/proxy/dashboard/overview`: ok
- `GET /api/proxy/transactions?page=1&pageSize=3`: ok
- `GET /api/proxy/analytics/summary`: ok
- `POST /api/proxy/feedback`: ok

## Observacao sobre a API externa

Durante esta correcao, `https://api.mariluciorocha.com/api/health` respondeu `503`.

Isso indica que a instancia externa ainda precisa receber a mesma configuracao corrigida:

- `DATABASE_URL` com `sslmode=require&connect_timeout=30`
- schema remoto sincronizado com `ProductEvent` e `FeedbackSubmission`

Depois disso, vale revalidar o health e o login no ambiente do Coolify.
