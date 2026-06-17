---
name: fvd
description: >
  Monta o Fluxo de Venda Direta no Manychat: 7 blocos, bifurcação Caminho A / Caminho B,
  que conduz o lead do PVD até o PIX. Use quando o aluno pedir "monta a FVD", "automação do
  Direct", "script do Manychat" ou "fluxo de venda por DM".
---

# /fvd — FVD + Automação no Manychat (7 blocos)

A FVD é o tubo entre o PVD e o PIX. O lead manda `[SUA PALAVRA-CHAVE]` no Direct, a automação dispara e conduz a conversa até a oferta. Sete blocos, dois caminhos. Preço só no Bloco 7 — antes disso o lead nem precisa saber quanto custa, ele precisa querer.

## Como rodar

1. Leio `_memoria/negocio.md` e `_memoria/discurso.md` pra calibrar tudo ao negócio do aluno: palavra-chave, nicho, dor central, produtos.
2. Puxo os **dois produtos da bifurcação** de `_memoria/`:
   - **Caminho A** = lead que já atende / já tem estrutura rodando → oferta o produto de escala.
   - **Caminho B** = lead que ainda está estruturando → oferta o produto de entrada.
   - Se faltar produto definido, escrevo `[SEU PRODUTO A]` / `[SEU PRODUTO B]` com `[SEU TICKET]` e marco como pendência. Não invento preço, não chuto ticket.
3. Escrevo os 7 blocos pra **cada caminho** (A e B compartilham 1, 2; bifurcam a partir do 3).
4. Salvo o roteiro completo em `saidas/fvd-[data].md` — pronto pra colar bloco a bloco no Manychat.
5. Quando a automação estiver no ar e testada, marco `[x] FVD` em `_memoria/progresso.md`.

## Anatomia — os 7 blocos

Tom humano em todos. O lead tem que sentir que tem gente do outro lado, não um robô cuspindo template.

1. **Boas-vindas** — confirma que ele veio por `[SUA PALAVRA-CHAVE]`, cumprimenta como gente. Sem "Olá! Seja bem-vindo ao nosso atendimento automático."
2. **Qualificação que bifurca** — UMA pergunta que separa A de B (ex.: "você já está atendendo cliente no `[SEU NICHO]` ou ainda montando?"). A resposta manda pro Caminho A ou B.
3. **Validação / diagnóstico** — espelha a dor específica daquele caminho. O lead precisa ler e pensar "é exatamente isso".
4. **Prova + future pacing** — mostra o "depois". Se o aluno tem número real, entra aqui (extrato, print, resultado). **Lei Zero: número é real ou não existe** — sem caso real, uso `[SEU RESULTADO REAL — extrato/print]` e o aluno preenche. Não fabrico print, não invento "fulano faturou X".
5. **Stack de valor** — lista do que está incluso, ancorando valor (entregáveis, bônus, acesso, suporte). Ainda sem preço.
6. **Quebra de objeção + ancoragem** — derruba a objeção principal do caminho e ancora o valor (custo de não resolver, comparação). Continua sem citar o número.
7. **Oferta + PREÇO + CTA** — só aqui aparece `[SEU TICKET]` e o link de pagamento `[SEU LINK DE PAGAMENTO]`. Chamada direta pro PIX: POST → SCRIPT AUTOMÁTICO → PIX.

## Antes de ativar

- Teste você mesmo: mande `[SUA PALAVRA-CHAVE]` no **seu próprio Direct** e percorra o fluxo inteiro.
- Percorra os **dois caminhos** (A e B). Se a bifurcação do Bloco 2 não te jogar pro caminho certo, conserta antes de qualquer lead entrar.
- Confira: o link do Bloco 7 abre? O preço está certo? O tom soa humano lendo em voz alta?
- Só depois de A e B rodando limpos é que a FVD vai ao ar — e aí sim marco `[x] FVD` em `_memoria/progresso.md`.

## Regras

- Calibro SEMPRE ao negócio do aluno (`_memoria/`). Sem estratégia, preço ou número de terceiros enfiado no fluxo.
- Onde faltar dado real do aluno, placeholder explícito (`[SEU TICKET]`, `[SEU RESULTADO REAL]`) — nunca número fabricado.
- Preço aparece UMA vez: Bloco 7. Citou antes, quebrou o método.
- Palavra-chave é sempre `[SUA PALAVRA-CHAVE]` até o aluno definir.
- Saída vai pra `saidas/`. Roteiro original do método fica intocado.
