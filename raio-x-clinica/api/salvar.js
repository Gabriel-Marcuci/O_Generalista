/**
 * POST /api/salvar
 *
 * Body: { answers, laudo?: object|null }
 * Grava data/laudos/<id>.json = { id, criado_em, answers, laudo, resumo }
 * e devolve o link público: 200 { ok:true, id, url:'/l/<id>' }.
 *
 * O frontend abre /l/<id>, lê o id da URL e busca GET /api/laudo/:id.
 */
import { avaliar } from '../lib/score.js'
import { parseAnswers, formatZodError } from '../lib/schema.js'
import { salvarJson, novoId } from '../lib/storage.js'
import { json, cors, lerJsonBody, montarResumo, criarNodeListener } from './_comum.js'

export async function handleSalvar(request) {
  if (request.method === 'OPTIONS') return cors()
  if (request.method !== 'POST') return json(405, { ok: false, erro: 'use POST' })

  const body = await lerJsonBody(request)
  if (!body.ok) return body.resposta
  const bruto = body.valor

  const parsed = parseAnswers(bruto.answers)
  if (!parsed.success) {
    return json(422, { ok: false, erro: 'answers fora do contrato', issues: formatZodError(parsed) })
  }
  const answers = parsed.data

  let laudo = null
  if (bruto.laudo !== undefined && bruto.laudo !== null) {
    if (typeof bruto.laudo !== 'object' || Array.isArray(bruto.laudo)) {
      return json(400, { ok: false, erro: 'laudo precisa ser objeto ou null' })
    }
    laudo = bruto.laudo
  }

  const resultado = avaliar(answers)
  const resumo = montarResumo(answers, resultado)
  const id = novoId()
  const criado_em = new Date().toISOString()

  salvarJson('laudos', id, { id, criado_em, answers, laudo, resumo })

  return json(200, { ok: true, id, url: `/l/${id}` })
}

/** Adapter Node http (server.mjs). */
export const nodeListener = criarNodeListener(handleSalvar)
