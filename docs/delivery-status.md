# Status de Entrega

## Pronto

- modelo individual por `userId`
- autenticacao com cadastro, login, logout e sessao persistida
- rotas protegidas no frontend
- guard autenticado no backend
- dashboard simplificado
- CRUD real de transacoes
- CRUD real de contas
- CRUD real de categorias
- CRUD real de subcategorias
- CRUD real de orcamentos
- CRUD real de metas
- CRUD real de ativos
- CRUD real de dividas
- snapshots patrimoniais manuais
- relatorios consolidados
- seed individual
- interface principal em portugues do Brasil
- redesign global da UI
- Supabase como persistencia principal
- recuperacao de senha implementada com token e expiracao
- logging e respostas de erro com `requestId`
- dashboard e transacoes refinados para beta externo
- proxy same-origin para sessao em dominio externo
- onboarding inicial no dashboard
- status operacional em `Configuracoes`
- preview externo rapido por `localtunnel`
- analytics basicos de produto
- feedback beta dentro do app
- estrategia estavel de beta com Caddy + Docker Compose

## Removido

- dominio de familia
- membros, papeis e convites
- familia ativa
- tela de familia
- onboarding familiar
- autorizacao por familia

## Pendencias

- credenciais SMTP reais para envio externo
- webhook real de monitoramento para ambiente beta
- deploy persistente de web e API fora do ambiente local, se o beta deixar de ser temporario
- importacao de extratos
- Open Finance
- OCR de comprovantes
- exportacao fiscal
- simulacoes persistidas
