/**
 * POST /api/lead
 *
 * Body: { lead: { whatsapp, email?, em? }, answers, origem? }
 *
 * - whatsapp: 10–11 dígitos (aceita máscara; guarda só os dígitos) → 400 se inválido
 * - answers: shape de questions.js → 422 se fora do contrato
 * - roda avaliar() no servidor, grava data/leads.jsonl, dispara LEAD_WEBHOOK_URL se houver
 *
 * 200: { ok:true, id, webhook: 'enviado' | 'falhou' | 'desligado' }
 */
import { avaliar } from '../lib/score.js'
import { parseAnswers, formatZodError } from '../lib/schema.js'
import { appendJsonl, novoId } from '../lib/storage.js'
import { json, cors, lerJsonBody, montarResumo, criarNodeListener } from './_comum.js'

export const WEBHOOK_TIMEOUT_MS = 5000

/** Normaliza o WhatsApp pra dígitos. Devolve null se não tiver 10–11. */
export function normalizarWhatsapp(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const digitos = String(valor).replace(/\D/g, '')
  return /^\d{10,11}$/.test(digitos) ? digitos : null
}

function validarLead(lead) {
  if (!lead || typeof lead !== 'object') return { erro: 'lead obrigatório' }
  const whatsapp = normalizarWhatsapp(lead.whatsapp)
  if (!whatsapp) return { erro: 'whatsapp inválido: use 10 ou 11 dígitos (DDD + número)' }

  const out = { whatsapp }
  if (lead.email !== undefined && lead.email !== null && lead.email !== '') {
    const email = String(lead.email).trim().toLowerCase()
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: 'email inválido' }
    out.email = email
  }
  if (lead.em !== undefined && lead.em !== null && lead.em !== '') {
    const em = new Date(lead.em)
    if (Number.isNaN(em.getTime())) return { erro: 'em precisa ser uma data ISO' }
    out.em = em.toISOString()
  }
  return { lead: out }
}

/** POST pro webhook. Nunca lança — falha vira 'falhou' e log em stderr. */
export async function dispararWebhook(url, corpo, fetchImpl = globalThis.fetch) {
  if (!url) return 'desligado'
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.error(`[lead ${corpo.id}] webhook respondeu HTTP ${res.status}`)
      return 'falhou'
    }
    return 'enviado'
  } catch (e) {
    console.error(`[lead ${corpo.id}] webhook falhou: ${e?.message ?? e}`)
    return 'falhou'
  }
}

export async function handleLead(request, deps = {}) {
  if (request.method === 'OPTIONS') return cors()
  if (request.method !== 'POST') return json(405, { ok: false, erro: 'use POST' })

  const body = await lerJsonBody(request)
  if (!body.ok) return body.resposta
  const bruto = body.valor

  const v = validarLead(bruto.lead)
  if (v.erro) return json(400, { ok: false, erro: v.erro })

  const parsed = parseAnswers(bruto.answers)
  if (!parsed.success) {
    return json(422, { ok: false, erro: 'answers fora do contrato', issues: formatZodError(parsed) })
  }
  const answers = parsed.data

  const resultado = avaliar(answers)
  const resumo = montarResumo(answers, resultado)
  const id = novoId()
  const criado_em = new Date().toISOString()
  const origem = typeof bruto.origem === 'string' ? bruto.origem.slice(0, 80) : undefined

  const registro = { id, criado_em, lead: v.lead, resumo, answers }
  if (origem) registro.origem = origem
  appendJsonl('leads.jsonl', registro)

  const webhookUrl = deps.webhookUrl ?? process.env.LEAD_WEBHOOK_URL
  const webhook = await dispararWebhook(
    webhookUrl,
    { id, criado_em, lead: v.lead, resumo, ...(origem ? { origem } : {}) },
    deps.fetchImpl,
  )

  return json(200, { ok: true, id, webhook })
}

/** Adapter Node http (server.mjs). */
export const nodeListener = criarNodeListener(handleLead)
