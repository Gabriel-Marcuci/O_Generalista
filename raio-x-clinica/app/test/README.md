# Testes de fluxo do app (e2e)

Playwright + `node:test`. Sobe o `server.mjs` de verdade numa porta livre, com
`RAIOX_DATA_DIR` numa pasta temporária, e percorre o app no Chromium headless.

## Rodar

```sh
npm run e2e          # node --test app/test/*.test.mjs  (~25 s)
```

## Pré-requisitos

- Node ≥ 20 e `npm install` (o `playwright` é devDependency; o download do browser
  fica desligado por `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — não rode `playwright install`).
- Um Chromium local. Padrão: `/opt/pw-browsers/chromium`. Pra outro binário:

  ```sh
  RAIOX_CHROMIUM=/caminho/do/chromium npm run e2e
  ```

- Nada de `ANTHROPIC_API_KEY`: o teste apaga a variável ao subir o servidor, então
  `POST /api/laudo` responde 503 e o app usa o pré-laudo do motor. Nenhuma chamada sai pra API.

## O que cobre (`fluxo.test.mjs`, 10 casos numa mesma page)

1. Quiz inteiro por **teclado** (dígitos + Enter) com S1 = `sou_eu`: S3 e S4 nunca aparecem
   como card e ficam gravadas como `sou_eu` no `localStorage`.
2. Contraste: em todo `li.bubble--user`, `color` ≠ `background-color` computados.
3. Gate de WhatsApp → `#laudo.is-revealed` com `[data-persona]` ≠ `???` e `.offer__title`.
4. Balão do tempo `[data-tempo]` com "Você levou".
5. Balão `li[data-link] a[data-link-laudo]` com `/l/<id>`; abrir o link em outra page →
   `body[data-view="laudo"]`, mesma persona, `#laudo` presente, `[data-laudo-empty]` oculto.
6. `/l/zzzzzzzz99` → `[data-laudo-empty]` visível com "Laudo não encontrado.".
7. Reload restaura o chat (balões > 0, sem S3/S4) e mantém a persona.
8. Editar S1 (lápis do balão) → `informar_valores` → S3 e S4 voltam a aparecer.
9. Backend: `<RAIOX_DATA_DIR>/leads.jsonl` com 1 linha e o WhatsApp enviado;
   `<RAIOX_DATA_DIR>/laudos/<id>.json` existe com o mesmo `id` do link.
10. Zero `pageerror` em todas as pages (quiz, `/l/:id`, `/l/404`).

## Notas

- O contexto do browser usa `reducedMotion: 'reduce'`: o app encurta as pausas do chat pra
  ≤120 ms e a animação de análise pra 600 ms (mesmo mecanismo, teste rápido).
- Requests pra `fonts.googleapis.com` / `fonts.gstatic.com` são abortados no contexto —
  sem rede eles travariam o evento `load` por ~12 s por navegação.
- Timeouts explícitos: `waitForSelector` 15 s, laudo 40 s, cada `it` 60 s.
