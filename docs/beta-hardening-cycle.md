# Ciclo de Endurecimento para Beta Externo

## Objetivo

Endurecer o Patrimoniq para beta externo real com:

- SMTP transacional preparado para producao
- autenticacao validada ponta a ponta
- dashboard e transacoes com UX mais limpa
- logging e tratamento de erro mais rastreaveis

## Arquivos alterados

- `apps/api/.env`
- `apps/api/.env.example`
- `apps/api/src/app.module.ts`
- `apps/api/src/common/app-exception.filter.ts`
- `apps/api/src/common/email.service.ts`
- `apps/api/src/common/email.templates.ts`
- `apps/api/src/common/request-logging.interceptor.ts`
- `apps/api/src/common/session-auth.guard.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/web/middleware.ts`
- `apps/web/src/app/dashboard/page-client.tsx`
- `apps/web/src/app/forgot-password/page-client.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/login/page-client.tsx`
- `apps/web/src/app/register/page-client.tsx`
- `apps/web/src/app/reset-password/page-client.tsx`
- `apps/web/src/app/transactions/page-client.tsx`
- `apps/web/src/components/form-controls.tsx`
- `apps/web/src/components/toast-provider.tsx`
- `apps/web/src/components/ui.tsx`
- `apps/web/src/hooks/use-api-resource.ts`
- `apps/web/src/lib/api.ts`
- `README.md`
- `docs/beta-hardening-cycle.md`
- `docs/beta-manual-checklist.md`
- `docs/deploy-beta.md`
- `docs/delivery-status.md`

## Melhorias de autenticacao aplicadas

- `COOKIE_SAME_SITE` configuravel por ambiente
- mensagens de `401` mais claras no backend
- `requestId` tambem em erros de guard de autenticacao
- redirecionamento para `/login?motivo=sessao-expirada` no frontend
- pagina de login aceita cookie invalido sem entrar em loop
- cadastro envia e-mail de boas-vindas quando o provedor estiver pronto
- reset de senha redireciona de volta ao login apos sucesso

## SMTP transacional

### Modos suportados

- `EMAIL_PROVIDER=auto`
  Usa SMTP real quando `SMTP_HOST` e credenciais estiverem preenchidos. Caso contrario, cai em `console`.
- `EMAIL_PROVIDER=smtp`
  Exige SMTP valido e falha cedo se a configuracao estiver incompleta.
- `EMAIL_PROVIDER=console`
  Mantem o modo local de desenvolvimento.

### Variaveis necessarias para producao

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

## Melhorias operacionais aplicadas

- filtro global de excecao com payload padronizado
- `x-request-id` nas respostas de erro
- interceptor de request com log de metodo, rota, duracao e usuario
- feedback de falha mais claro no frontend
- fallback de e-mail logado explicitamente

## Melhorias visuais aplicadas

- paleta refinada com contraste melhor
- toasts mais fortes e legiveis
- inputs e cards com mais respiro
- dashboard menos carregado e mais focado
- tela de transacoes com formulario agrupado e tabela mais clara

## Fluxos validados

- `GET /login` sem sessao
- `/login` com cookie invalido
- cadastro
- login
- `GET /api/auth/me`
- logout
- dashboard autenticado
- transacoes autenticadas
- solicitacao de reset de senha
- redefinicao de senha com token valido
- login com a nova senha
- respostas de erro com `requestId`

## Estado atual para beta externo

O produto esta pronto para beta fechado do ponto de vista de:

- persistencia principal em nuvem
- autenticacao individual
- protecao de rotas
- CRUD principal
- fluxo de reset de senha
- layout mais maduro nas telas-chave
- diagnostico basico de erro

## Pendencias restantes antes de abrir para usuarios externos

- credenciais SMTP reais para validar envio externo de verdade
- revisar dominios finais para `COOKIE_DOMAIN`, `COOKIE_SECURE` e `COOKIE_SAME_SITE`
- monitoramento externo centralizado, se desejado
- Open Finance, importacao bancaria e OCR ficam para ciclos seguintes
