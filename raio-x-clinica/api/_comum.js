/**
 * Helpers compartilhados pelos handlers de api/*.
 * Contrato Web Fetch (Request → Response) + adaptador Node http.
 */
import { avaliar } from '../lib/score.js'

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  })

/** Resposta padrão ao preflight CORS. */
export function cors(metodos = 'POST, OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': metodos,
      'access-control-allow-headers': 'content-type',
    },
  })
}

/** Lê o body como JSON. Devolve { ok:true, valor } ou { ok:false, resposta } pronta pra retornar. */
export async function lerJsonBody(request) {
  try {
    const valor = await request.json()
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
      return { ok: false, resposta: json(400, { ok: false, erro: 'body precisa ser um objeto JSON' }) }
    }
    return { ok: true, valor }
  } catch {
    return { ok: false, resposta: json(400, { ok: false, erro: 'JSON inválido' }) }
  }
}

/**
 * Resumo persistido junto de lead e laudo salvo.
 * Só o que a operação precisa pra decidir o próximo contato — sem número inventado.
 */
export function montarResumo(answers, resultado = avaliar(answers)) {
  return {
    nome: answers?.lead?.nome ?? null,
    persona_sugerida: resultado.persona_sugerida,
    persona_titulo: resultado.persona_titulo,
    scores: resultado.scores,
    selos: resultado.selos,
    oferta: {
      principal: resultado.oferta.principal,
      complementar: resultado.oferta.complementar ?? null,
      trafego_proibido_passo_1: resultado.oferta.trafego_proibido_passo_1,
    },
    flags: resultado.flags,
  }
}

/** Cria o adaptador Node http (server.mjs) pra um handler Web Fetch. */
export function criarNodeListener(handler) {
  return async function nodeListener(req, res) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks).toString('utf8') || '{}'
    const host = req.headers.host || 'localhost'
    const request = new Request(`http://${host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    })
    let response
    try {
      response = await handler(request)
    } catch (e) {
      console.error('[api] erro não tratado:', e)
      response = json(500, { ok: false, erro: 'erro_interno' })
    }
    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))
    res.end(Buffer.from(await response.arrayBuffer()))
  }
}
