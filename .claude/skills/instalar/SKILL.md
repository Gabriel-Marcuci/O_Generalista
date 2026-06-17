---
name: instalar
description: >
  Primeiro comando depois de clonar. Entrevista o usuário sobre nicho, serviço, quem paga,
  tom de voz e marca, e preenche _memoria/negocio.md, a seção Voz de _memoria/discurso.md e
  identidade/marca.md. Use quando o usuário acabou de instalar o sistema ou pedir "/instalar",
  "primeiro setup", "instalar o sistema".
---

# /instalar — Setup inicial

Primeiro comando depois de clonar. Não pode falhar nem soar burocrático. É conversa de descoberta — uma pergunta por vez, escuta de verdade. No fim, o sistema sabe quem é o negócio, como ele fala e onde está o atrito. Dura 5–7 minutos no máximo.

## Pré-checagem

1. Nome da pasta (`basename "$(pwd)"`). Se for genérico (`svi-no-claude`, `sistema-venda-invisivel`, `*-main`), avisar que no fim a gente renomeia pro nome do negócio.
2. Se `_memoria/negocio.md` ou `_memoria/discurso.md` já tiver conteúdo real (não placeholder), perguntar: sobrescrever (recomeçar) ou complementar o que falta.

## Fase 1 — Entrevista

Uma pergunta por vez, esperando a resposta. Se vier vaga, pedir concretude **uma** vez e registrar o que vier. Não insistir mais que isso.

**Negócio:**
1. "Como você chama o que você faz? (nome da empresa, ou seu nome se for marca pessoal)"
2. "O que você entrega, em uma frase do jeito que falaria pro vizinho?"
3. "Quem te paga? Perfil de cliente real — sem persona genérica."
4. "Qual o resultado mais forte que você já entregou pra um cliente? Com número, se for real — **não invente**."
5. "Você toca sozinho ou tem equipe? Se tem, quantos e fazendo o quê?"

**Voz:**
6. "Me cola um exemplo da tua escrita — uma legenda, um email, qualquer coisa real e recente. Pra eu calibrar o jeito de escrever sem adivinhar."
7. "O que te dá ranço quando alguém escreve? (ex: 'vamos juntos!', emoji em email, jargão de guru, 'alavancar', 'sinergia')"

**Marca:**
8. "Tem identidade visual definida? Se sim, me passa as cores principais e a fonte. Se tá no zero, tudo bem."

## Fase 2 — Preencher os arquivos

- `_memoria/negocio.md` ← perguntas 1–3, 5.
- `_memoria/discurso.md` ← campo "Resultado mais forte" (4) e a seção **Voz** (6–7). O resto do discurso fica pra skill `/discurso`.
- `identidade/marca.md` ← pergunta 8. Se não tiver marca, deixar em branco e avisar que as skills visuais leem esse arquivo.

Regras: não inventar. Resposta vaga vira placeholder claro. **Lei Zero** — número só entra se for real. Não reformatar os arquivos inteiros; preencher os campos.

## Fase 3 — Resumo + renomear

Mostrar o que foi configurado (negócio, voz, marca). Se a pasta tem nome genérico, instruir a renomear pro slug do negócio (minúsculas, sem acento, hífen): fechar VS Code → renomear no Finder/Explorer → reabrir.

## Fase 4 — Próximo passo

> "Pronto. O sistema já te conhece. Agora roda `/comecar` — eu te levo do zero ao primeiro PIX, um passo por vez. Começamos pelo teu discurso."
