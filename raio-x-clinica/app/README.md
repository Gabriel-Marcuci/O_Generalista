# Raio-X da Clínica — app (chat + laudo ao vivo)

O quiz que a dona responde. Uma pergunta por vez, no chat, e o laudo escuro à direita
vai sendo preenchido em tempo real: identidade, radar de 4 eixos, barras, selos,
condecorações. Persona sai quando as obrigatórias acabam. SWOT e oferta liberam depois
do WhatsApp.

Estética minimalista tipo Apple: página clara e silenciosa, laudo em card escuro, cor
só onde ela informa. Sem framework, sem build obrigatório. O motor roda no navegador
(`../lib/score.js`).

## Temas

Dois temas prontos, definidos só por tokens em `styles/app.css`:

| Tema | Atributo | Acento |
|---|---|---|
| Preto e branco (padrão) | `<html data-tema="mono">` | branco sobre preto |
| Roxo | `<html data-tema="roxo">` | `#A78BFA` |

O seletor no canto superior direito existe pra você comparar. Pra fixar um tema,
apague o bloco `.temas` do `index.html` e deixe o `data-tema` que quiser no `<html>`.

Nenhum componente usa cor literal: tudo passa por token, então um terceiro tema é só
mais um bloco `[data-tema="x"]`. A página também responde a `prefers-color-scheme: dark`.

**Cor é informação, não decoração.** As faixas do radar seguem os limiares do motor:
≥65 acento cheio, ≥55 cinza, ≥40 âmbar, abaixo disso vermelho. Clínica saudável fica
neutra; vermelho só aparece onde existe problema de verdade.

Tipografia: SF do sistema em Apple, Inter no resto. Condecorações usam ícone de linha,
não emoji.

```
app/
├── index.html          intro (preview do laudo + copy) e fluxo (chat + laudo)
├── styles/app.css      tokens, chat, laudo, print
├── scripts/flow.js     perguntas na ordem do chat (com condicionais), mensagens do guia, badges, SWOT determinístico
├── scripts/app.js      motor do chat, teclado, laudo ao vivo, gate de WhatsApp, backend, modo /l/:id
├── scripts/stories.js  PNG 1080×1920 pra Stories (módulo opcional, contrato window.__raiox)
└── build.mjs           empacota tudo num HTML só (dist/raio-x.html)
```

## Rodar

```sh
cd raio-x-clinica
npm run dev            # http://127.0.0.1:8787/app/  (serve app + lib + /api/lead, /api/laudo, /api/salvar, /l/:id)
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
- Faixas de cor: `--tier-top`, `--tier-good`, `--tier-mid` e `--tier-low` em cada tema.

## Perguntas condicionais

Cada item de `PERGUNTAS` aceita, além do texto fixo:

- `prompt(answers) → string`: o enunciado muda conforme respostas anteriores.
- `pular(answers) → boolean`: `true` = a pergunta não aparece. O valor de `padrao`
  (ou `preencher(answers)`) é gravado e o fluxo segue sem card nem balão.

Em uso hoje: S1 = `sou_eu` pula S3 e S4 (gravadas como `sou_eu`, que o motor já entende)
e troca o enunciado de S2; R5 = `automatico` troca o enunciado de S1. Puladas contam como
respondidas no progresso. Ao editar uma resposta anterior (lápis no balão), as auto-preenchidas
dali pra frente voltam a `null` e a condição é reavaliada.

## Teclado

Teclas `1`–`9` escolhem a n-ésima opção do card ativo (Likert: a tecla é o valor 1–4).
`Enter` aciona "Continuar" quando habilitado; no campo de texto, `Enter` já avança.
Nada é capturado com o foco em `input`/`textarea` nem com Ctrl/Alt/Cmd. Cada opção simples ou
múltipla mostra um `<kbd class="q__key">` com o número; em tela de toque ele some.

## Integração com o backend (degrada sozinha)

O motor roda no navegador; o servidor só acrescenta. Qualquer 4xx/5xx/501/rede fora = fallback
silencioso.

1. Ao enviar o WhatsApp: `POST /api/lead` `{ lead, answers, origem:'app' }`, fire-and-forget.
2. Durante "analisando": `POST /api/laudo` `{ answers }`, mínimo ~3,5 s de animação, espera
   até 25 s. Se vier `ok:true`, `state.laudo` guarda o laudo (validado com `validarLaudo` do
   motor; laudo que contradiz o motor é descartado) e o card usa: `persona.subtitulo`,
   `scores_comentados[eixo].texto`, `swot`, `oferta.por_que` ("Por quê") e o bloco
   **05 Mensagem** (`whatsapp_msg_1` + "Copiar mensagem", `frase_share` em itálico).
   Sem laudo: SWOT determinístico, sem bloco 05 e nota "Pré-laudo do motor. O laudo comentado
   sai no WhatsApp."
3. Depois: `POST /api/salvar` `{ answers, laudo }`. Se `ok`, `state.link` recebe
   `origin + url`, o rodapé ganha "Copiar link" e o chat um balão com o link. Se falhar,
   nada aparece.

O balão final diz "Você levou N minutos" com N real (mínimo 1), medido do "Começar" até o laudo.

## Modo visualização (`/l/:id`)

Se `location.pathname` casa `^/l/([a-z0-9]{8,16})$` — ou, pra host estático e teste,
`?__ver=<id>` — o app não abre intro nem chat: busca `GET /api/laudo/:id` e renderiza só o
card, em largura de leitura (860px, radar em 2 colunas), com `body[data-view="laudo"]`.
Botões: Copiar resumo, Baixar PDF, Copiar link. Em 404: "Laudo não encontrado." e
"Fazer o meu". Nada é gravado no `localStorage` nesse modo.

O servidor serve o mesmo `index.html` em `/l/:id` com `<base href="/app/">` pra os assets
relativos resolverem; os `fetch` do app usam caminhos absolutos (`/api/...`).

## Stories

`scripts/stories.js` (módulo opcional) registra `window.__raiox.gerarStories({ resultado,
answers, tema, marca }) → Blob` e dispara `raiox:stories-pronto`. O botão "Stories" no rodapé
do card só aparece quando a função existe; gera `raio-x-<nome>.png` (1080×1920) via
`<a download>` e, em celular com `navigator.share` de arquivos, oferece compartilhar.

## O que é determinístico e o que vem do LLM

Tudo que está no card sai do motor: scores, flags, selos, persona, oferta, e um SWOT
traduzido das flags (`swotDeterministico`). O laudo comentado (`prompt-laudo.md` em cima de
`r.payload`) entra no card só quando `POST /api/laudo` responde; senão vai pro WhatsApp.

## Persistência

`localStorage` guarda respostas, posição, perguntas auto-preenchidas, tempo, laudo e link.
Reabrir a página restaura o chat sem a cascata; recarregar no meio da análise retoma a análise.
"Apagar respostas e recomeçar" limpa. Nenhum dado sai do navegador a não ser pelos POSTs
acima, quando o servidor está de pé.
