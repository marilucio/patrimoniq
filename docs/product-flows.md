# Fluxos do Produto

## Navegacao principal

- Visao geral
- Transacoes
- Orcamentos
- Metas
- Patrimonio
- Relatorios
- Configuracoes

## 1. Entrada no produto

1. usuario acessa `/login`
2. se nao tiver conta, vai para `/register`
3. apos autenticar, entra em `/dashboard`
4. se estiver deslogado e tentar abrir rota interna, volta para `/login`

## 2. Setup inicial

1. categorias padrao sao criadas no cadastro
2. usuario ajusta contas em `Configuracoes`
3. usuario revisa categorias e cria subcategorias proprias
4. usuario passa a registrar transacoes e metas

## 3. Uso diario

### Visao geral

- saldo do mes
- entrou
- saiu
- sobra projetada
- contas a vencer
- metas em progresso
- patrimonio liquido
- insights uteis

### Transacoes

- criar receita, despesa, transferencia e outros tipos
- filtrar por busca, direcao, status, categoria e subcategoria
- editar ou cancelar lancamentos
- listar resultados paginados

### Orcamentos

- definir limites por categoria ou subcategoria
- comparar planejado, realizado e previsao
- identificar itens em risco

### Metas

- criar objetivos com prioridade
- acompanhar progresso real
- cancelar metas que perderam prioridade

### Patrimonio

- registrar ativos
- registrar dividas
- salvar snapshots patrimoniais
- acompanhar evolucao historica

### Relatorios

- resumo financeiro consolidado
- gastos por categoria
- fluxo mensal
- score financeiro mais recente

### Configuracoes

- gerenciar contas
- gerenciar categorias
- gerenciar subcategorias
- revisar perfil e preparo do beta
