/**
 * POST /api/laudo        → laudo comentado gerado pelo modelo
 * GET  /api/laudo/:id    → laudo salvo por POST /api/salvar (data/laudos/<id>.json)
 *
 * POST body: { answers } (roda avaliar) ou { payload } (já pronto).
 * Também aceita o `answers` cru na raiz, como /api/avaliar.
 *
 * 200: { ok:true, laudo, motor, modelo, tentativas }
 * 503: { ok:false, erro:'sem_chave', dica }           — sem ANTHROPIC_API_KEY
 * 502: { ok:false, erro:'llm_falhou', detalhe }       — API do modelo falhou
 */
import { avaliar } from '../lib/score.js'
import { parseAnswers, formatZodError } from '../lib/schema.js'
import { gerarLaudo, resultadoDePayload, ErroLaudo } from '../lib/laudo-llm.js'
import { lerJson, ID_RE } from '../lib/storage.js'
import { json, cors, lerJsonBody, criarNodeListener } from './_comum.js'

/** Extrai o id de /api/laudo/:id (ou null). */
export function idDaRota(pathname) {
  const m = /^\/api\/laudo\/([^/]+)\/?$/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}

function handleGet(id) {
  if (!ID_RE.test(id)) return json(404, { ok: false, erro: 'nao_encontrado' })
  const arquivo = lerJson('laudos', id)
  if (!arquivo) return json(404, { ok: false, erro: 'nao_encontrado' })
  return json(200, { ok: true, ...arquivo })
}

/** Resolve o `resultado` a partir do body: payload pronto ou answers. */
function resolverResultado(bruto) {
  if (bruto.payload && typeof bruto.payload === 'object') {
    if (!bruto.payload.motor?.oferta_principal) {
      return { resposta: json(422, { ok: false, erro: 'payload sem motor.oferta_principal' }) }
    }
    return { resultado: resultadoDePayload(bruto.payload) }
  }
  const answers = bruto.answers && typeof bruto.answers === 'object' ? bruto.answers : bruto
  const parsed = parseAnswers(answers)
  if (!parsed.success) {
    return {
      resposta: json(422, { ok: false, erro: 'answers fora do contrato', issues: formatZodError(parsed) }),
    }
  }
  return { resultado: avaliar(parsed.data) }
}

export async function handleLaudo(request, deps = {}) {
  const url = new URL(request.url)
  const id = idDaRota(url.pathname)

  if (request.method === 'OPTIONS') return cors('GET, POST, OPTIONS')

  if (request.method === 'GET') {
    if (!id) return json(405, { ok: false, erro: 'use POST em /api/laudo ou GET /api/laudo/:id' })
    return handleGet(id)
  }

  if (request.method !== 'POST') return json(405, { ok: false, erro: 'use POST' })
  if (id) return json(405, { ok: false, erro: 'GET /api/laudo/:id pra ler; POST só em /api/laudo' })

  const body = await lerJsonBody(request)
  if (!body.ok) return body.resposta

  const r = resolverResultado(body.valor)
  if (r.resposta) return r.resposta
  const { resultado } = r

  try {
    const { laudo, tentativas, modelo } = await gerarLaudo(resultado, {
      apiKey: deps.apiKey,
      model: deps.model,
      fetchImpl: deps.fetchImpl,
    })
    return json(200, { ok: true, laudo, motor: resultado.payload.motor, modelo, tentativas })
  } catch (e) {
    if (e instanceof ErroLaudo && e.codigo === 'sem_chave') {
      return json(503, { ok: false, erro: 'sem_chave', dica: 'defina ANTHROPIC_API_KEY' })
    }
    const detalhe = e instanceof ErroLaudo ? e.detalhe : String(e?.message ?? e)
    console.error('[laudo] llm_falhou:', detalhe)
    return json(502, { ok: false, erro: 'llm_falhou', detalhe })
  }
}

/** Adapter Node http (server.mjs). */
export const nodeListener = criarNodeListener(handleLaudo)
