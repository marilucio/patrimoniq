# Playbook de Abertura do Beta Pequeno

## Objetivo

Abrir o Patrimoniq para um grupo pequeno de usuarios reais com um fluxo simples de convite,
teste e coleta de feedback.

## Como convidar os primeiros usuarios

Mensagem curta sugerida:

> O Patrimoniq entrou em beta fechado. Quero te convidar para testar o app por alguns dias,
> registrar receitas, despesas e metas, e me contar onde a experiencia ficou clara ou travou.
> Se topar, eu envio o link e uma credencial inicial ou voce cria sua conta no primeiro acesso.

## O que pedir para testarem

1. criar a conta ou entrar com a credencial recebida
2. cadastrar a primeira conta financeira
3. registrar uma receita
4. registrar uma despesa
5. criar uma meta simples
6. revisar a visao geral
7. sair e entrar novamente
8. testar "Esqueci a senha"
9. usar o botao `Feedback beta` quando houver duvida, bug ou sugestao

## Como enviar feedback

Dentro do app:

- usar o botao `Feedback beta`
- escolher a categoria
- descrever rapidamente o problema ou sugestao
- o app envia junto a tela atual para dar contexto

Fora do app, se necessario:

- usar o canal definido por voce para acompanhamento do beta
- copiar o passo a passo do erro
- anexar print quando fizer sentido

## Limitacoes conhecidas para comunicar

- o beta ainda prioriza clareza e rotina essencial, nao profundidade total
- importacao bancaria e Open Finance ainda nao fazem parte desta fase
- exportacao fiscal ainda nao esta aberta
- o ambiente externo temporario por tunnel nao deve ser tratado como URL final

## Bugs ou riscos conhecidos antes da abertura

- se a `DATABASE_URL` local ou do host estiver incorreta, a API nao sobe mesmo com o Supabase vinculado via CLI
- entregabilidade de e-mail pode variar entre caixa principal, spam e lixo eletronico
- o monitoramento externo continua opcional ate configurar um webhook real

## Como acompanhar o beta

Use:

- `GET /api/analytics/summary` para ver eventos basicos de ativacao
- `GET /api/feedback` para revisar os relatos enviados pelo app
- `Configuracoes` para acompanhar sinais do beta na interface
