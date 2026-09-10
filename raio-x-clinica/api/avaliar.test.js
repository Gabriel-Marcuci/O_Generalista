import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { handleAvaliar } from './avaliar.js'
import { parseAnswers } from '../lib/schema.js'

const dir = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(dir, '../lib/exemplo.secretaria-r500.json'), 'utf8'),
)

test('schema aceita a fixture da secretária R$500', () => {
  const r = parseAnswers(fixture)
  assert.equal(r.success, true, JSON.stringify(r.error?.issues, null, 2))
})

test('schema recusa Likert 5 e problema inválido', () => {
  const r = parseAnswers({
    ...fixture,
    likert: { ...fixture.likert, P2: 5 },
    roteamento: { ...fixture.roteamento, problemas: ['foo'] },
  })
  assert.equal(r.success, false)
})

test('POST /api/avaliar 200 + PACOTE_COMPLETO na fixture', async () => {
  const req = new Request('http://localhost/api/avaliar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fixture),
  })
  const res = await handleAvaliar(req)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(body.oferta.trafego_proibido_passo_1, true)
  assert.ok(body.flags.includes('funcao_comercial_inexistente'))
})

test('POST /api/avaliar?payload=1 devolve só payload', async () => {
  const req = new Request('http://localhost/api/avaliar?payload=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fixture),
  })
  const res = await handleAvaliar(req)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.ok(body.payload)
  assert.equal(body.oferta, undefined)
})

test('POST sem JSON → 400; GET → 405; enum quebrado → 422', async () => {
  const badJson = await handleAvaliar(
    new Request('http://localhost/api/avaliar', {
      method: 'POST',
      body: '{',
      headers: { 'content-type': 'application/json' },
    }),
  )
  assert.equal(badJson.status, 400)

  const get = await handleAvaliar(new Request('http://localhost/api/avaliar', { method: 'GET' }))
  assert.equal(get.status, 405)

  const unprocessable = await handleAvaliar(
    new Request('http://localhost/api/avaliar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lead: { nome: 'A' } }),
    }),
  )
  assert.equal(unprocessable.status, 422)
})
