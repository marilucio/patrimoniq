# Checklist Manual de Beta

## Credenciais seed

- `ricardo@patrimoniq.local` / `Patrimoniq123!`
- `ana@patrimoniq.local` / `Patrimoniq123!`

## Testes principais

1. acessar `/dashboard` sem login e validar redirecionamento para `/login`
2. fazer login com usuario seed
3. validar carregamento da visao geral
4. validar checklist de onboarding no dashboard de um usuario novo
5. validar `/login` com cookie invalido e confirmar que a tela abre sem loop
6. criar conta nova
7. confirmar e-mail de boas-vindas quando SMTP estiver ativo
8. fazer logout
9. confirmar bloqueio das rotas internas
10. solicitar recuperacao de senha
11. validar recebimento do e-mail de reset
12. redefinir senha com token valido
13. confirmar falha com token expirado ou repetido
14. criar transacao
15. editar transacao
16. cancelar transacao
17. aplicar filtros em transacoes
18. criar conta em `Configuracoes`
19. criar categoria
20. criar subcategoria
21. criar orcamento
22. editar orcamento
23. criar meta
24. editar meta
25. criar ativo
26. criar divida
27. criar snapshot patrimonial
28. validar reflexo no dashboard e patrimonio
29. validar relatorios apos mutacoes
30. abrir `Configuracoes` e validar status de SMTP, sessao e monitoramento
31. quando SMTP estiver ativo, disparar `Enviar teste de e-mail`
32. validar a URL externa do beta
33. usar `Feedback beta` em pelo menos uma tela e confirmar salvamento do relato

## Sinais de erro que nao podem passar

- dashboard abrindo sem autenticacao
- loop entre `/login` e `/dashboard` com cookie invalido
- dados de um usuario aparecendo em outro
- enums em ingles na interface
- erro bruto do backend exposto ao usuario
- formularios salvando sem feedback
- e-mail transacional falhando sem log diagnostico
- proxy `/api/proxy` quebrando login ou logout
- onboarding inicial desaparecendo cedo demais ou nao sumindo quando a base ja esta pronta

## Checklist curto para os primeiros usuarios beta

1. criar a conta ou entrar com a credencial recebida
2. cadastrar a primeira conta financeira
3. registrar uma receita
4. registrar uma despesa
5. verificar se o dashboard ficou claro
6. criar uma meta simples
7. testar sair e entrar novamente
8. testar "Esqueci a senha" e confirmar recebimento do e-mail

## Como coletar feedback

Use um processo simples e centralizado:

1. um formulario curto ou planilha compartilhada
2. uma linha por problema ou sugestao
3. colunas minimas: usuario, tela, passo a passo, resultado esperado, resultado atual, gravidade
4. revisar feedback diariamente na primeira semana do beta

## Riscos conhecidos para comunicar ao grupo beta

- o ambiente externo atual pode mudar de URL se o tunnel for reiniciado
- o e-mail de reset pode cair em spam ou lixo eletronico
- algumas areas ainda estao focadas em MVP e priorizam clareza sobre profundidade
