// Teste de fluxo do app Raio-X (chat + laudo), rodável com `npm run e2e`.
//
// Sobe `node server.mjs` numa porta livre com RAIOX_DATA_DIR temporário, abre o app
// no Chromium via Playwright e percorre: quiz por teclado (S1 = sou_eu) → gate de WhatsApp
// → laudo revelado → balão com /l/:id → modo visualização → restore → edição de S1.
//
// Sem ANTHROPIC_API_KEY: POST /api/laudo responde 503 e o app usa o pré-laudo do motor.
// Nenhuma chamada sai pra API real.
//
// Chromium: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 no ambiente, então o binário não vem do
// `npx playwright install`. Usamos o Chromium local em /opt/pw-browsers/chromium; pra outro
// caminho, exporte RAIOX_CHROMIUM=/caminho/do/chromium.
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CHROMIUM = process.env.RAIOX_CHROMIUM || '/opt/pw-browsers/chromium'
const WHATSAPP = '11999998888'
const T = { sel: 15_000, laudo: 40_000, it: 60_000 }

// ---------------------------------------------------------------------------------------
// infra: porta livre, servidor filho, browser

function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })
}

async function esperarPronto(url, ms = 15_000) {
  const fim = Date.now() + ms
  let ultimo = null
  while (Date.now() < fim) {
    try {
      const r = await fetch(url)
      if (r.ok) return
      ultimo = `HTTP ${r.status}`
    } catch (e) {
      ultimo = e.message
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`servidor não ficou pronto em ${ms} ms (${ultimo})`)
}

const ctxt = {
  dataDir: null,
  server: null,
  base: null,
  browser: null,
  ctx: null,
  page: null,
  pageErrors: [],
  serverLog: '',
  // resultados compartilhados entre os `it` (sequência numa mesma page)
  vistos: [],
  persona: null,
  link: null,
  laudoId: null,
}

function ligarErros(page, rotulo) {
  page.on('pageerror', (e) => ctxt.pageErrors.push(`[${rotulo}] ${String(e)}`))
}

// ---------------------------------------------------------------------------------------
// helpers do quiz

async function cardAtivo(page) {
  await page.waitForSelector('li[data-active="question"][data-qid][data-tipo], [data-active="lead"]', { timeout: T.sel })
  if (await page.locator('[data-active="lead"]').count()) return null
  return page.locator('li[data-active="question"][data-qid][data-tipo]')
}

/**
 * Responde o card ativo só com teclado (dígitos + Enter) até chegar no gate de WhatsApp.
 * Devolve a lista de qids vistos como card.
 */
async function responderQuiz(page, { s1Key = '5' } = {}) {
  const vistos = []
  for (let n = 0; n < 60; n++) {
    const li = await cardAtivo(page)
    if (!li) return vistos
    const qid = await li.getAttribute('data-qid')
    const tipo = await li.getAttribute('data-tipo')
    const stepIndex = await li.getAttribute('data-step-index')
    vistos.push(qid)
    if (tipo === 'texto') {
      const input = li.locator('[data-input]')
      await input.fill(qid === 'nome' ? 'Camila' : 'limpeza de pele')
      await input.press('Enter')
    } else if (tipo === 'multi') {
      await page.keyboard.press('1')
      await page.keyboard.press('2')
      await page.keyboard.press('Enter')
    } else if (tipo === 'likert') {
      await page.keyboard.press('2')
    } else {
      await page.keyboard.press(qid === 'S1' ? s1Key : '1')
    }
    await page.waitForSelector(`[data-step-index="${stepIndex}"][data-active]`, { state: 'detached', timeout: T.sel })
  }
  throw new Error('quiz não chegou ao lead em 60 passos')
}

// ---------------------------------------------------------------------------------------

describe('fluxo do app: chat + laudo', () => {
  before(async () => {
    ctxt.dataDir = mkdtempSync(join(tmpdir(), 'raiox-e2e-'))
    const port = await portaLivre()
    ctxt.base = `http://127.0.0.1:${port}`
    const env = { ...process.env, PORT: String(port), RAIOX_DATA_DIR: ctxt.dataDir }
    delete env.ANTHROPIC_API_KEY
    delete env.LEAD_WEBHOOK_URL
    ctxt.server = spawn(process.execPath, ['server.mjs'], { cwd: RAIZ, env, stdio: ['ignore', 'pipe', 'pipe'] })
    ctxt.server.stdout.on('data', (d) => { ctxt.serverLog += d })
    ctxt.server.stderr.on('data', (d) => { ctxt.serverLog += d })
    await esperarPronto(`${ctxt.base}/app/`)

    ctxt.browser = await chromium.launch({ executablePath: CHROMIUM })
    ctxt.ctx = await ctxt.browser.newContext({
      viewport: { width: 1360, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
      // prefers-reduced-motion: o app encurta as pausas do chat pra <=120 ms (mecanismo igual, teste rápido)
      reducedMotion: 'reduce',
    })
    // Google Fonts: sem rede o `load` ficaria ~12 s preso na stylesheet; aborta e usa a fallback stack.
    await ctxt.ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
    ctxt.page = await ctxt.ctx.newPage()
    ligarErros(ctxt.page, 'quiz')
  })

  after(async () => {
    await ctxt.browser?.close().catch(() => {})
    if (ctxt.server && ctxt.server.exitCode === null) {
      ctxt.server.kill('SIGTERM')
      await new Promise((r) => { ctxt.server.once('exit', r); setTimeout(r, 3000) })
    }
    if (ctxt.dataDir) rmSync(ctxt.dataDir, { recursive: true, force: true })
  })

  it('percorre o quiz inteiro por teclado com S1 = sou_eu, sem cards S3/S4', { timeout: T.it }, async () => {
    const { page, base } = ctxt
    await page.goto(`${base}/app/`, { waitUntil: 'load' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'load' })
    await page.click('.cta[data-action="start"]')
    await page.waitForSelector('li[data-active="question"][data-qid][data-tipo]', { timeout: T.sel })

    ctxt.vistos = await responderQuiz(page, { s1Key: '5' })
    assert.ok(ctxt.vistos.includes('S1'), 'S1 apareceu como card')
    assert.ok(!ctxt.vistos.includes('S3'), `S3 não deve aparecer como card (vistos: ${ctxt.vistos.join(',')})`)
    assert.ok(!ctxt.vistos.includes('S4'), `S4 não deve aparecer como card (vistos: ${ctxt.vistos.join(',')})`)

    const estado = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('raio_x_clinica_v1'))
      return { S1: s.answers.categoricas.S1, S3: s.answers.categoricas.S3, S4: s.answers.categoricas.S4 }
    })
    assert.equal(estado.S1, 'sou_eu', 'tecla 5 em S1 = sou_eu')
    assert.equal(estado.S3, 'sou_eu', 'S3 auto-preenchida')
    assert.equal(estado.S4, 'sou_eu', 'S4 auto-preenchida')
    assert.ok(await page.isVisible('[data-active="lead"] [data-whats]'), 'gate de WhatsApp visível')
  })

  it('contraste: em todo li.bubble--user, color ≠ background-color', { timeout: T.it }, async () => {
    const res = await ctxt.page.evaluate(() =>
      [...document.querySelectorAll('li.bubble--user')].map((b) => {
        const cs = getComputedStyle(b)
        return { qid: b.dataset.qid, color: cs.color, bg: cs.backgroundColor }
      }),
    )
    assert.ok(res.length > 0, 'há balões de usuário')
    for (const r of res) assert.notEqual(r.color, r.bg, `balão ${r.qid}: cor igual ao fundo (${r.color})`)
  })

  it('WhatsApp → laudo revelado com persona e oferta', { timeout: T.it }, async () => {
    const { page } = ctxt
    await page.fill('[data-active="lead"] [data-whats]', WHATSAPP)
    await page.press('[data-active="lead"] [data-whats]', 'Enter')
    await page.waitForSelector('#laudo.is-revealed', { timeout: T.laudo })

    ctxt.persona = (await page.textContent('#laudo [data-persona]')).trim()
    assert.ok(ctxt.persona.length > 0, 'persona não vazia')
    assert.notEqual(ctxt.persona, '???', 'persona resolvida')
    assert.equal(await page.locator('#laudo .offer__title').count(), 1, '.offer__title presente')
  })

  it('balão do tempo: "Você levou"', { timeout: T.it }, async () => {
    await ctxt.page.waitForSelector('[data-tempo]', { timeout: T.sel })
    const tempo = await ctxt.page.textContent('[data-tempo]')
    assert.match(tempo, /Você levou/)
  })

  it('balão com link /l/<id> e modo visualização com a mesma persona', { timeout: T.it }, async () => {
    const { page, ctx } = ctxt
    await page.waitForSelector('li[data-link] a[data-link-laudo]', { timeout: T.sel })
    ctxt.link = await page.getAttribute('li[data-link] a[data-link-laudo]', 'href')
    const m = /\/l\/([a-z0-9]{8,16})$/.exec(ctxt.link || '')
    assert.ok(m, `href do balão termina em /l/<id>: ${ctxt.link}`)
    ctxt.laudoId = m[1]
    assert.ok(await page.isVisible('#laudo [data-action="copy-link"]'), 'botão Copiar link visível')

    const p2 = await ctx.newPage()
    ligarErros(p2, '/l/:id')
    try {
      await p2.goto(ctxt.link, { waitUntil: 'load' })
      await p2.waitForSelector('#laudo:not([hidden]) .offer__title', { timeout: T.sel })
      assert.equal(await p2.getAttribute('body', 'data-view'), 'laudo', 'body[data-view="laudo"]')
      assert.equal((await p2.textContent('#laudo [data-persona]')).trim(), ctxt.persona, 'mesma persona')
      assert.equal(await p2.locator('#laudo').count(), 1, '#laudo presente')
      assert.equal(await p2.isVisible('[data-laudo-empty]'), false, '[data-laudo-empty] oculto')
    } finally {
      await p2.close()
    }
  })

  it('/l/<id inexistente> → "Laudo não encontrado."', { timeout: T.it }, async () => {
    const p3 = await ctxt.ctx.newPage()
    ligarErros(p3, '/l/404')
    try {
      await p3.goto(`${ctxt.base}/l/zzzzzzzz99`, { waitUntil: 'load' })
      await p3.waitForSelector('[data-laudo-empty]:not([hidden])', { timeout: T.sel })
      assert.equal(await p3.isVisible('[data-laudo-empty]'), true)
      assert.match(await p3.textContent('[data-laudo-empty]'), /Laudo não encontrado\./)
      assert.equal(await p3.getAttribute('body', 'data-view'), 'laudo')
    } finally {
      await p3.close()
    }
  })

  it('reload restaura o chat sem cards S3/S4', { timeout: T.it }, async () => {
    const { page } = ctxt
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('#laudo.is-revealed', { timeout: T.sel })
    const baloes = await page.locator('li.bubble').count()
    assert.ok(baloes > 0, `chat restaurado (${baloes} balões)`)
    assert.equal(await page.locator('[data-qid="S3"], [data-qid="S4"]').count(), 0, 'nenhum card/balão de S3/S4')
    assert.equal((await page.textContent('#laudo [data-persona]')).trim(), ctxt.persona, 'restore mantém a persona')
  })

  it('editar S1 → informar_valores faz S3 e S4 aparecerem', { timeout: T.it }, async () => {
    const { page } = ctxt
    await page.click('li.bubble--user[data-qid="S1"] .bubble__edit')
    await page.waitForSelector('li[data-active="question"][data-qid="S1"]', { timeout: T.sel })
    await page.keyboard.press('2') // informar_valores
    await page.waitForSelector('li[data-active="question"][data-qid="S2"]', { timeout: T.sel })
    const s1 = await page.evaluate(() => JSON.parse(localStorage.getItem('raio_x_clinica_v1')).answers.categoricas.S1)
    assert.equal(s1, 'informar_valores', 'tecla 2 em S1 = informar_valores')
    await page.keyboard.press('1')
    await page.waitForSelector('li[data-active="question"][data-qid="S3"]', { timeout: T.sel })
    await page.keyboard.press('1')
    await page.waitForSelector('li[data-active="question"][data-qid="S4"]', { timeout: T.sel })
    assert.ok(true, 'S3 e S4 apareceram como card')
  })

  it('backend gravou leads.jsonl (1 linha com o WhatsApp) e laudos/<id>.json', { timeout: T.it }, async () => {
    const leadsPath = join(ctxt.dataDir, 'leads.jsonl')
    assert.ok(existsSync(leadsPath), `leads.jsonl existe em ${ctxt.dataDir}`)
    const linhas = readFileSync(leadsPath, 'utf8').split('\n').filter(Boolean)
    assert.equal(linhas.length, 1, `exatamente 1 lead gravado (${linhas.length})`)
    const lead = JSON.parse(linhas[0])
    assert.equal(lead.lead?.whatsapp ?? lead.whatsapp, WHATSAPP, `whatsapp gravado: ${linhas[0]}`)

    assert.ok(ctxt.laudoId, 'id do laudo capturado no balão')
    const laudoPath = join(ctxt.dataDir, 'laudos', `${ctxt.laudoId}.json`)
    assert.ok(existsSync(laudoPath), `laudos/${ctxt.laudoId}.json existe (há: ${existsSync(join(ctxt.dataDir, 'laudos')) ? readdirSync(join(ctxt.dataDir, 'laudos')).join(',') : 'nada'})`)
    const salvo = JSON.parse(readFileSync(laudoPath, 'utf8'))
    assert.equal(salvo.id, ctxt.laudoId)
  })

  it('zero pageerror em todas as pages', () => {
    assert.deepEqual(ctxt.pageErrors, [], `pageerror: ${ctxt.pageErrors.join(' | ')}`)
  })
})
