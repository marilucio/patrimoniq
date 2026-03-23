# Refatoracao para Escopo Individual

## Resumo

Este ciclo removeu o Patrimoniq do dominio de financas familiares e o reposicionou como aplicativo individual de financas pessoais.

## Mudancas estruturais

- ownership refatorado de `familyId` para `userId`
- remoção de modelos e fluxos de familia
- autenticacao obrigatoria antes do dashboard
- sessao mantida por cookie HTTP-only
- seed refeito para usuarios individuais

## Mudancas visiveis

- menu simplificado
- tela de familia removida
- login e cadastro como porta de entrada obrigatoria
- dashboard mais leve
- nova paleta e nova hierarquia visual
- interface principal em portugues do Brasil

## Validacoes executadas

- `pnpm --filter @patrimoniq/domain build`
- `pnpm --filter @patrimoniq/api prisma:generate`
- `pnpm --filter @patrimoniq/api lint`
- `pnpm --filter @patrimoniq/api build`
- `pnpm --filter @patrimoniq/web build`
- `pnpm --filter @patrimoniq/api prisma db push --force-reset`
- `pnpm --filter @patrimoniq/api db:seed`

## Pendencias restantes

- migracao principal para Supabase
- upload e OCR de documentos
- importacao bancaria
- Open Finance
- exportacao fiscal
