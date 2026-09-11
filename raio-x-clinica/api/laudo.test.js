import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { avaliar } from '../lib/score.js'
import { gerarLaudo, extrairJson, forcarCamposRigidos, ErroLaudo, API_URL } from '../lib/laudo-llm.js'
import { handleLaudo } from './laudo.js'
import { handleSalvar } from './salvar.js'
import { handleLead } from './lead.js'
import { novoId, ID_RE, lerJson } from '../lib/storage.js'

const dir = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(dir, '../lib/exemplo.secretaria-r500.json'), 'utf8'))
const resultado = avaliar(fixture)

// Dados de teste vão pra uma pasta temporária — nunca pro data/ real.
let dataDir
before(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'raiox-test-'))
  process.env.RAIOX_DATA_DIR = dataDir
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.LEAD_WEBHOOK_URL
})
after(() => {
  rmSync(dataDir, { recursive: true, force: true })
  delete process.env.RAIOX_DATA_DIR
})

/** Laudo mínimo coerente com o motor (só campos rígidos + textos placeholder). */
function laudoValido() {
  return {
    persona: { id: resultado.persona_sugerida, titulo: resultado.persona_titulo, subtitulo: 'placeholder' },
    scores_comentados: {},
    selo_preco: resultado.selos.selo_preco,
    selo_papel: resultado.selos.selo_papel,
    swot: { forcas: [], fraquezas: [], oportunidades: [], alertas: [] },
    badges_conquistadas: [],
    badges_bloqueadas: [],
    oferta: {
      principal: resultado.oferta.principal,
      complementar: resultado.oferta.complementar ?? null,
      por_que: 'placeholder',
      o_que_nao_fazer_agora: 'placeholder',
      fase_2: 'placeholder',
    },
    numeros_pedir: ['avaliações por semana', '% que fecha em 7 dias', 'ticket médio do último mês'],
    whatsapp_msg_1: 'placeholder',
    frase_share: 'placeholder',
    observacao_motor: '',
  }
}

/** Laudo divergente: TRAFEGO quando o motor diz PACOTE_COMPLETO, persona e selos errados. */
function laudoDivergente() {
  const l = laudoValido()
  l.oferta.principal = 'TRAFEGO'
  l.persona = { id: 'sumida_no_digital', titulo: 'Título errado', subtitulo: 'x' }
  l.selo_preco = 'preco_no_controle'
  return l
}

/** fetch fake: devolve as respostas em sequência e registra as chamadas. */
function fakeFetch(respostas) {
  const chamadas = []
  const fn = async (url, init) => {
    chamadas.push({ url, body: JSON.parse(init.body), headers: init.headers })
    const proxima = respostas.shift()
    if (proxima instanceof Error) throw proxima
    if (typeof proxima === 'number') {
      return new Response(JSON.stringify({ type: 'error', error: { message: 'boom' } }), { status: proxima })
    }
    return new Response(
      JSON.stringify({
        id: 'msg_teste',
        type: 'message',
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: proxima }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  fn.chamadas = chamadas
  return fn
}

test('fixture roteia PACOTE_COMPLETO (pré-condição dos testes)', () => {
  assert.equal(resultado.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(resultado.oferta.trafego_proibido_passo_1, true)
})

test('extrairJson tolera texto em volta e rejeita lixo', () => {
  assert.deepEqual(extrairJson('Aqui vai:\n```json\n{"a":1}\n```\nfim'), { a: 1 })
  assert.equal(extrairJson('sem json aqui'), null)
  assert.equal(extrairJson('{quebrado'), null)
})

test('gerarLaudo: laudo válido de primeira → 1 tentativa, headers e modelo corretos', async () => {
  const fetchImpl = fakeFetch([JSON.stringify(laudoValido())])
  const r = await gerarLaudo(resultado, { apiKey: 'sk-teste', fetchImpl, model: 'modelo-x' })
  assert.equal(r.tentativas, 1)
  assert.equal(r.modelo, 'modelo-x')
  assert.equal(r.laudo.oferta.principal, 'PACOTE_COMPLETO')
  assert.deepEqual(r.erros_finais, [])

  assert.equal(fetchImpl.chamadas.length, 1)
  const c = fetchImpl.chamadas[0]
  assert.equal(c.url, API_URL)
  assert.equal(c.headers['x-api-key'], 'sk-teste')
  assert.equal(c.headers['anthropic-version'], '2023-06-01')
  assert.equal(c.body.model, 'modelo-x')
  assert.ok(typeof c.body.system === 'string' && c.body.system.includes('Saída'))
  assert.equal(c.body.messages.length, 1)
  assert.ok(c.body.messages[0].content.includes('"oferta_principal":"PACOTE_COMPLETO"'))
})

test('gerarLaudo: divergente → retry com erros listados → válido na 2a', async () => {
  const fetchImpl = fakeFetch([JSON.stringify(laudoDivergente()), JSON.stringify(laudoValido())])
  const r = await gerarLaudo(resultado, { apiKey: 'sk-teste', fetchImpl })
  assert.equal(r.tentativas, 2)
  assert.equal(r.laudo.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(r.laudo.observacao_motor, '')

  // A 2a chamada carrega assistant (resposta errada) + user com os erros
  const msgs = fetchImpl.chamadas[1].body.messages
  assert.equal(msgs.length, 3)
  assert.equal(msgs[1].role, 'assistant')
  assert.equal(msgs[2].role, 'user')
  assert.ok(msgs[2].content.includes('oferta.principal deveria ser PACOTE_COMPLETO'))
  assert.ok(msgs[2].content.includes('TRAFEGO como passo 1'))
})

test('gerarLaudo: divergente 2x → campos rígidos forçados pelo motor', async () => {
  const fetchImpl = fakeFetch([JSON.stringify(laudoDivergente()), JSON.stringify(laudoDivergente())])
  const r = await gerarLaudo(resultado, { apiKey: 'sk-teste', fetchImpl })
  assert.equal(r.tentativas, 2)
  assert.equal(r.laudo.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(r.laudo.persona.id, resultado.persona_sugerida)
  assert.equal(r.laudo.persona.titulo, resultado.persona_titulo)
  assert.equal(r.laudo.selo_preco, resultado.selos.selo_preco)
  assert.equal(r.laudo.selo_papel, resultado.selos.selo_papel)
  assert.equal(r.laudo.observacao_motor, 'campos rígidos forçados pelo motor')
  // texto do modelo preservado
  assert.equal(r.laudo.oferta.por_que, 'placeholder')
  assert.ok(r.erros_finais.length > 0)
})

test('gerarLaudo: texto sem JSON na 1a, JSON na 2a → ok; lixo 2x → llm_falhou', async () => {
  const ok = await gerarLaudo(resultado, {
    apiKey: 'k',
    fetchImpl: fakeFetch(['não consigo', JSON.stringify(laudoValido())]),
  })
  assert.equal(ok.tentativas, 2)

  await assert.rejects(
    gerarLaudo(resultado, { apiKey: 'k', fetchImpl: fakeFetch(['nada', 'nada de novo']) }),
    (e) => e instanceof ErroLaudo && e.codigo === 'llm_falhou',
  )
})

test('gerarLaudo: sem chave → sem_chave; HTTP 500 → llm_falhou', async () => {
  await assert.rejects(
    gerarLaudo(resultado, { fetchImpl: fakeFetch([]) }),
    (e) => e instanceof ErroLaudo && e.codigo === 'sem_chave',
  )
  await assert.rejects(
    gerarLaudo(resultado, { apiKey: 'k', fetchImpl: fakeFetch([500]) }),
    (e) => e instanceof ErroLaudo && e.codigo === 'llm_falhou' && /HTTP 500/.test(e.detalhe),
  )
})

test('forcarCamposRigidos não apaga o resto do laudo', () => {
  const l = forcarCamposRigidos({ oferta: { principal: 'TRAFEGO', por_que: 'x' }, swot: { forcas: ['a'] } }, resultado)
  assert.equal(l.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(l.oferta.por_que, 'x')
  assert.deepEqual(l.swot.forcas, ['a'])
})

test('POST /api/laudo sem chave → 503 sem_chave', async () => {
  const res = await handleLaudo(
    new Request('http://localhost/api/laudo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: fixture }),
    }),
  )
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.erro, 'sem_chave')
})

test('POST /api/laudo com fetch fake → 200 com motor, modelo e tentativas', async () => {
  const fetchImpl = fakeFetch([JSON.stringify(laudoValido())])
  const res = await handleLaudo(
    new Request('http://localhost/api/laudo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: fixture }),
    }),
    { apiKey: 'k', fetchImpl, model: 'm' },
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.motor.oferta_principal, 'PACOTE_COMPLETO')
  assert.equal(body.modelo, 'm')
  assert.equal(body.tentativas, 1)
  assert.equal(body.laudo.oferta.principal, 'PACOTE_COMPLETO')
})

test('POST /api/laudo aceita { payload } pronto; API 500 → 502 llm_falhou', async () => {
  const ok = await handleLaudo(
    new Request('http://localhost/api/laudo', {
      method: 'POST',
      body: JSON.stringify({ payload: resultado.payload }),
    }),
    { apiKey: 'k', fetchImpl: fakeFetch([JSON.stringify(laudoValido())]) },
  )
  assert.equal(ok.status, 200)

  const ruim = await handleLaudo(
    new Request('http://localhost/api/laudo', { method: 'POST', body: JSON.stringify({ answers: fixture }) }),
    { apiKey: 'k', fetchImpl: fakeFetch([500]) },
  )
  assert.equal(ruim.status, 502)
  assert.equal((await ruim.json()).erro, 'llm_falhou')
})

test('POST /api/salvar → GET /api/laudo/:id devolve o arquivo; id inexistente → 404', async () => {
  const salvo = await handleSalvar(
    new Request('http://localhost/api/salvar', {
      method: 'POST',
      body: JSON.stringify({ answers: fixture, laudo: laudoValido() }),
    }),
  )
  assert.equal(salvo.status, 200)
  const s = await salvo.json()
  assert.ok(ID_RE.test(s.id))
  assert.equal(s.url, `/l/${s.id}`)
  assert.ok(existsSync(join(dataDir, 'laudos', `${s.id}.json`)))

  const lido = await handleLaudo(new Request(`http://localhost/api/laudo/${s.id}`, { method: 'GET' }))
  assert.equal(lido.status, 200)
  const l = await lido.json()
  assert.equal(l.ok, true)
  assert.equal(l.id, s.id)
  assert.equal(l.resumo.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(l.resumo.nome, 'Camila')
  assert.equal(l.laudo.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(l.answers.lead.nome, 'Camila')

  const nao = await handleLaudo(new Request('http://localhost/api/laudo/zzzzzzzzzz', { method: 'GET' }))
  assert.equal(nao.status, 404)
  assert.equal((await nao.json()).erro, 'nao_encontrado')

  // path traversal não chega ao disco
  const trav = await handleLaudo(new Request('http://localhost/api/laudo/..%2F..%2Fetc', { method: 'GET' }))
  assert.equal(trav.status, 404)
  assert.equal(lerJson('laudos', '../x'), null)
})

test('POST /api/salvar sem laudo → laudo null; answers inválido → 422', async () => {
  const semLaudo = await handleSalvar(
    new Request('http://localhost/api/salvar', { method: 'POST', body: JSON.stringify({ answers: fixture }) }),
  )
  assert.equal(semLaudo.status, 200)
  const { id } = await semLaudo.json()
  assert.equal(lerJson('laudos', id).laudo, null)

  const ruim = await handleSalvar(
    new Request('http://localhost/api/salvar', { method: 'POST', body: JSON.stringify({ answers: { lead: {} } }) }),
  )
  assert.equal(ruim.status, 422)
})

test('POST /api/lead grava em leads.jsonl; webhook desligado/enviado/falhou', async () => {
  const fazer = (deps) =>
    handleLead(
      new Request('http://localhost/api/lead', {
        method: 'POST',
        body: JSON.stringify({
          lead: { whatsapp: '(11) 98888-7777', email: 'Camila@Exemplo.com' },
          answers: fixture,
          origem: 'teste',
        }),
      }),
      deps,
    )

  const a = await (await fazer({})).json()
  assert.equal(a.ok, true)
  assert.equal(a.webhook, 'desligado')
  assert.ok(ID_RE.test(a.id))

  const hook = fakeFetch(['{}'])
  const b = await (await fazer({ webhookUrl: 'https://hook.exemplo/x', fetchImpl: hook })).json()
  assert.equal(b.webhook, 'enviado')
  assert.equal(hook.chamadas[0].url, 'https://hook.exemplo/x')
  assert.equal(hook.chamadas[0].body.lead.whatsapp, '11988887777')
  assert.equal(hook.chamadas[0].body.lead.email, 'camila@exemplo.com')
  assert.equal(hook.chamadas[0].body.resumo.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(hook.chamadas[0].body.answers, undefined)

  const c = await (await fazer({ webhookUrl: 'https://hook.exemplo/x', fetchImpl: fakeFetch([new Error('rede')]) })).json()
  assert.equal(c.ok, true)
  assert.equal(c.webhook, 'falhou')

  const linhas = readFileSync(join(dataDir, 'leads.jsonl'), 'utf8').trim().split('\n')
  assert.equal(linhas.length, 3)
  const reg = JSON.parse(linhas[0])
  assert.equal(reg.id, a.id)
  assert.equal(reg.lead.whatsapp, '11988887777')
  assert.equal(reg.resumo.persona_sugerida, resultado.persona_sugerida)
  assert.equal(reg.answers.lead.nome, 'Camila')
  assert.equal(reg.origem, 'teste')
})

test('POST /api/lead: whatsapp inválido → 400; answers quebrado → 422; GET → 405', async () => {
  const w = await handleLead(
    new Request('http://localhost/api/lead', {
      method: 'POST',
      body: JSON.stringify({ lead: { whatsapp: '123' }, answers: fixture }),
    }),
  )
  assert.equal(w.status, 400)
  assert.equal((await w.json()).ok, false)

  const a = await handleLead(
    new Request('http://localhost/api/lead', {
      method: 'POST',
      body: JSON.stringify({ lead: { whatsapp: '11988887777' }, answers: { lead: {} } }),
    }),
  )
  assert.equal(a.status, 422)

  const g = await handleLead(new Request('http://localhost/api/lead', { method: 'GET' }))
  assert.equal(g.status, 405)
})

test('novoId: 10 chars base36, sem colisão em 2000 amostras', () => {
  const vistos = new Set()
  for (let i = 0; i < 2000; i++) {
    const id = novoId()
    assert.ok(ID_RE.test(id) && id.length === 10, id)
    vistos.add(id)
  }
  assert.equal(vistos.size, 2000)
  // nada de arquivo temporário sobrando na pasta de laudos
  const sobras = existsSync(join(dataDir, 'laudos')) ? readdirSync(join(dataDir, 'laudos')).filter((f) => f.endsWith('.tmp')) : []
  assert.deepEqual(sobras, [])
})
