/**
 * POST /api/avaliar
 *
 * Handler no contrato Web Fetch (Request → Response).
 * Serve em Vercel / Netlify / Cloudflare / Next route sem reescrever.
 *
 * Body: answers (shape de questions.js)
 * Query: payload=1 → só o JSON do prompt do laudo
 *
 * Não chama LLM. Score e oferta saem do motor.
 */
import { avaliar } from '../lib/score.js'
import { parseAnswers, formatZodError } from '../lib/schema.js'

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })

export async function handleAvaliar(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    })
  }

  if (request.method !== 'POST') {
    return json(405, { ok: false, erro: 'use POST' })
  }

  let bruto
  try {
    bruto = await request.json()
  } catch {
    return json(400, { ok: false, erro: 'JSON inválido' })
  }

  const parsed = parseAnswers(bruto)
  if (!parsed.success) {
    return json(422, {
      ok: false,
      erro: 'answers fora do contrato',
      issues: formatZodError(parsed),
    })
  }

  const resultado = avaliar(parsed.data)
  const url = new URL(request.url)
  const soPayload = url.searchParams.get('payload') === '1'

  if (soPayload) {
    return json(200, { ok: true, payload: resultado.payload })
  }

  return json(200, {
    ok: true,
    scores: resultado.scores,
    subscores: resultado.subscores,
    flags: resultado.flags,
    selos: resultado.selos,
    oferta: resultado.oferta,
    persona_sugerida: resultado.persona_sugerida,
    missing: resultado.missing,
    invalidas: resultado.invalidas ?? [],
    payload: resultado.payload,
  })
}

/** Adapter Node http (server.mjs). */
export async function nodeListener(req, res) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks).toString('utf8') || '{}'
  const host = req.headers.host || 'localhost'
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
  const response = await handleAvaliar(request)
  res.statusCode = response.status
  response.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await response.arrayBuffer()))
}
