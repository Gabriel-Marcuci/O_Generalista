---
name: comecar
description: >
  O guia mestre. Lê _memoria/progresso.md e _memoria/discurso.md, descobre onde o usuário está
  na trilha e o conduz pro próximo passo concreto — do zero ao primeiro PIX. Use quando o usuário
  não souber o que fazer, pedir "/comecar", "e agora?", "qual o próximo passo", "tô perdido".
---

# /comecar — O guia do zero ao primeiro PIX

Esta skill é o GPS do sistema. O usuário nunca precisa decidir sozinho o que fazer — ela lê o estado dele e aponta **o próximo passo**, um de cada vez.

## Como rodar

1. **Ler o estado.** Abrir `_memoria/progresso.md` e `_memoria/discurso.md`. Identificar o primeiro item NÃO marcado na trilha:
   `Setup → Discurso → Perfil → 3 PVDs → FVD → No ar → (10 vendas → Monetização)`.

2. **Se nada foi feito ainda:** confirmar que o `/instalar` rodou (`_memoria/negocio.md` preenchido). Se não, mandar rodar `/instalar` primeiro.

3. **Apontar UM passo.** Mostrar só o próximo, nunca a lista inteira. Em 2 linhas: o que entrega + qual skill chama.
   - Discurso não pronto → "Próximo: teu discurso. É a base de tudo — sem ele teus posts falam com todo mundo e com ninguém. Roda `/discurso`."
   - Discurso ok, perfil não → "Próximo: transformar teu perfil em vitrine que converte. Roda `/perfil`."
   - Perfil ok, PVDs não → "Próximo: teus 3 primeiros posts de venda. Roda `/pvd` (faz um por vez, publica e fixa no topo)."
   - PVDs ok, FVD não → "Próximo: o fluxo que conduz a venda no Manychat. Roda `/fvd`."
   - FVD ok, não testado → "Falta ativar: manda tua palavra-chave no teu próprio Direct e percorre os 2 caminhos. Te ajudo a checar bloco por bloco."
   - Tudo no ar → "Teu sistema tá rodando. Agora é volume de PVD + fechar as primeiras 10 vendas. Monetização (`/monetizacao`) destrava depois disso."

4. **A régua.** Reforçar: se o passo não termina em algo publicado no Instagram, é teoria — e teoria aqui é opcional. Cada passo fecha em entrega publicada.

5. **Atualizar progresso.** Quando o usuário confirmar que publicou um passo, marcar `[x]` em `_memoria/progresso.md`.

## Regras

- **Um passo por vez.** Nunca despejar a trilha inteira — gera paralisia.
- Sempre calibrar pelo `_memoria/` (nicho, palavra-chave, produtos do usuário).
- **Não** empurrar monetização / tráfego / esteira antes das 10 vendas. Complexidade prematura mata caixa.
- Tom: direto, sem motivacional barato.
