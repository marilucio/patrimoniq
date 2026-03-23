# Arquitetura

## Escopo do produto

Patrimoniq agora e um app individual de financas pessoais. Nao existe mais dominio de familia, membros, convites ou colaboracao multiusuario. Cada entidade financeira pertence diretamente a um usuario.

## Principios

- ownership individual por `userId`
- login obrigatorio antes do app
- leitura e escrita sempre isoladas por usuario autenticado
- interface simples, limpa e em portugues do Brasil
- backend robusto, tipado e preparado para crescimento

## Monorepo

- `apps/web`
  - Next.js com App Router
  - middleware para rotas protegidas
  - telas principais consumindo apenas a API real
- `apps/api`
  - NestJS modular
  - sessao em cookie HTTP-only
  - Prisma como camada de persistencia
  - Supabase Postgres como banco principal
- `packages/domain`
  - catalogo padrao de categorias
  - calculos compartilhados

## Ownership de dados

As entidades abaixo pertencem ao usuario:

- `users`
- `accounts`
- `cards`
- `categories`
- `subcategories`
- `transactions`
- `budgets`
- `goals`
- `goal_contributions`
- `assets`
- `liabilities`
- `net_worth_snapshots`
- `alerts`
- `insights`
- `subscriptions`
- `tax_tags`
- `documents`
- `simulations`
- `missions`
- `score_history`

## Autenticacao

- cadastro cria usuario, seed de categorias padrao e sessao
- login cria sessao com cookie `patrimoniq_session`
- logout revoga a sessao
- recuperacao de senha usa token com expiracao e revoga sessoes anteriores apos redefinicao
- frontend server-side valida sessao antes de renderizar rotas internas
- backend usa guard para proteger endpoints autenticados

## Modulos da API

- `auth`
- `dashboard`
- `transactions`
- `budgets`
- `goals`
- `net-worth`
- `reports`
- `accounts`
- `categories`
- `subcategories`
- `assets`
- `liabilities`
- `settings`
- `insights`

## Direcao de evolucao

- importacao OFX/CSV/PDF
- Open Finance
- OCR de comprovantes
- simulacoes persistidas
- exportacao fiscal
