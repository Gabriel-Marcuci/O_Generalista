# Raio-X da Clínica — app (chat + laudo ao vivo)

O quiz que a dona responde. Uma pergunta por vez, no chat, e o laudo escuro à direita
vai sendo preenchido em tempo real: identidade, radar de 4 eixos, barras, selos,
condecorações. Persona sai quando as obrigatórias acabam. SWOT e oferta liberam depois
do WhatsApp.

Mesmo idioma visual da referência (papel quente + card forest/lime, Figtree), código próprio.
Sem framework, sem build obrigatório. O motor roda no navegador (`../lib/score.js`).

```
app/
├── index.html          intro (preview do laudo + copy) e fluxo (chat + laudo)
├── styles/app.css      tokens, chat, laudo, print
├── scripts/flow.js     perguntas na ordem do chat, mensagens do guia, badges, SWOT determinístico
├── scripts/app.js      motor do chat, laudo ao vivo, gate de WhatsApp, restauração
└── build.mjs           empacota tudo num HTML só (dist/raio-x.html)
```

## Rodar

```sh
cd raio-x-clinica
npm run dev            # http://127.0.0.1:8787/app/  (serve app + lib + POST /api/avaliar)
```

Ou qualquer servidor estático na pasta `raio-x-clinica/` (o app importa `../lib/`).

## Arquivo único

```sh
node app/build.mjs     # → app/dist/raio-x.html
```

Abre direto no navegador ou publica onde aceitar um HTML. Fonte vem do Google Fonts; sem internet cai em system-ui.

## Ajustes rápidos

- `scripts/flow.js` → `CONFIG`: nome do guia, iniciais do avatar, WhatsApp (vazio = sem botão de contato).
- Ordem e texto das perguntas: `PERGUNTAS` (IDs do contrato em `lib/questions.js`). Versão atual = 27 obrigatórias + 2 bônus.
- Mensagens entre perguntas: `MENSAGENS_DEPOIS` (string ou função que recebe a resposta e pode devolver `null`).
- Condecorações: `BADGES` (18). Cada uma tem `when(answers, resultado)`.
- Faixas de cor do radar seguem os limiares do motor: ≥65 lime, ≥55 sage, ≥40 âmbar, <40 vermelho.

## O que é determinístico e o que vem do LLM

Tudo que está no card sai do motor: scores, flags, selos, persona, oferta, e um SWOT
traduzido das flags (`swotDeterministico`). O laudo comentado, com a mensagem 1 de WhatsApp,
é o `prompt-laudo.md` rodando em cima de `r.payload`. Esse vai no WhatsApp, não no card.

## Persistência

`localStorage` guarda respostas e posição. Reabrir a página restaura o chat sem a cascata.
"Apagar respostas e recomeçar" limpa. Nenhum dado sai do navegador, a não ser o POST opcional
para `/api/avaliar` quando o servidor está de pé.
