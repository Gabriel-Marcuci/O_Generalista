---
name: monetizacao
description: >
  Monta a escada de produtos do aluno (order bump, upsell, trafego, recorrencia, DFY, afiliados).
  PORTAO: so depois de 10 vendas validadas. Use quando o aluno pedir "/monetizacao", "subir o ticket",
  "escala", "trafego pago", "esteira", "novos produtos".
---

# /monetizacao — Sua escada de produtos

Esta skill só roda **depois das primeiras 10 vendas**. Antes disso, complexidade prematura mata caixa.

## Portão (checar primeiro)

Ler `_memoria/progresso.md`. Se "10 vendas" NÃO estiver marcado, avisar e parar:

> "Ainda é cedo pra isso. Foca em fechar as primeiras 10 vendas do teu produto atual — depois a gente sobe a escada. Adicionar produto agora só dilui foco."

## A escada por fase

- **Fase 1** (0 vendas): apenas 2 produtos.
- **Fase 2** (10+ vendas): adiciona porta de entrada + order bump.
- **Fase 3** (caixa consistente): adiciona DFY + recorrência + afiliados.

## As alavancas (sempre placeholder/faixa — nunca preço fixo)

- **Order bump:** complemento do mesmo problema, faixa de 10–25% do ticket principal. Aceitação típica 25–50% (faixa de mercado — valide com os SEUS).
- **Upsell:** oferecido no pico emocional (o cliente acabou de ver o sistema dele pronto). Upsell = a diferença entre o ticket de entrada e o maior.
- **Tráfego pago:** regra de ouro — **CAC ≤ 30% do SEU ticket**. CPM/CTR são faixa de mercado (siga a tendência, não um número fixo). Budget de teste pequeno (ex: R$10–30/dia por PVD — é pesquisa, não aquisição).
- **Recorrência:** comunidade ou produção mensal a `[SEU TICKET RECORRENTE]`/mês.
- **DFY:** execução feita por você a `[SEU TICKET PREMIUM]`. Defina sua capacidade (ex: 3 simultâneos).
- **Afiliados:** comissão definida por você (faixa comum 20–40%). Só alunos/clientes com caso documentado.

## Regras

- Ler `_memoria/discurso.md` (seção Produtos) pra calibrar os nomes.
- Reescrever sempre como **sua** escada — nunca a de outra pessoa.
- Nenhum produto novo antes de 10 vendas do atual.
- **Lei Zero** nos números de resultado.
