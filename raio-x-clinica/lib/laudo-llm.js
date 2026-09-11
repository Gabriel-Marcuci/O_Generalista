/**
 * Laudo comentado gerado pelo modelo.
 *
 *   gerarLaudo(resultado, { model, apiKey, fetchImpl, maxTokens })
 *     → { laudo, tentativas, modelo, erros_finais }
 *
 * - System = prompt-laudo.md (lido do disco uma vez, cache em memória).
 * - User   = JSON do payload do motor. Pede saída só JSON.
 * - Valida com validarLaudo(). Diverge → refaz UMA vez listando os erros.
 *   Ainda diverge → força os campos rígidos com o valor do motor e marca
 *   observacao_motor = 'campos rígidos forçados pelo motor'.
 *
 * Zero dependências: fetch nativo do Node 20+. Endpoint e headers conferidos
 * na referência da API (POST /v1/messages, x-api-key, anthropic-version).
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validarLaudo, PERSONAS } from './score.js'

export const API_URL = 'https://api.anthropic.com/v1/messages'
export const API_VERSION = '2023-06-01'
export const MODELO_PADRAO = 'claude-sonnet-5'
export const MAX_TOKENS_PADRAO = 4000
export const TIMEOUT_MS = 120_000

const PROMPT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompt-laudo.md')
let promptCache = null

/** Erro tipado: codigo é 'sem_chave' ou 'llm_falhou'. */
export class ErroLaudo extends Error {
  constructor(codigo, detalhe) {
    super(detalhe || codigo)
    this.codigo = codigo
    this.detalhe = detalhe
  }
}

export function lerPrompt() {
  if (promptCache === null) promptCache = readFileSync(PROMPT_PATH, 'utf8')
  return promptCache
}

/** Parse tolerante: pega do primeiro `{` ao último `}` mesmo com texto em volta. */
export function extrairJson(texto) {
  if (typeof texto !== 'string') return null
  const ini = texto.indexOf('{')
  const fim = texto.lastIndexOf('}')
  if (ini === -1 || fim === -1 || fim <= ini) return null
  try {
    return JSON.parse(texto.slice(ini, fim + 1))
  } catch {
    return null
  }
}

/**
 * Reconstrói o mínimo de `resultado` a partir de um payload pronto
 * (quando o cliente manda `payload` em vez de `answers`).
 */
export function resultadoDePayload(payload) {
  const m = payload?.motor ?? {}
  return {
    payload,
    oferta: {
      principal: m.oferta_principal,
      complementar: m.oferta_complementar ?? null,
      trafego_proibido_passo_1: Boolean(m.trafego_proibido_passo_1),
    },
    selos: { selo_preco: m.selo_preco, selo_papel: m.selo_papel },
    persona_sugerida: m.persona_sugerida,
    persona_titulo: m.persona_titulo ?? PERSONAS[m.persona_sugerida],
    scores: payload?.scores,
    flags: payload?.flags ?? [],
  }
}

/** Sobrescreve os campos que o motor decide. Não mexe no texto do modelo. */
export function forcarCamposRigidos(laudo, resultado) {
  const out = laudo && typeof laudo === 'object' ? laudo : {}
  out.oferta = { ...(out.oferta ?? {}), principal: resultado.oferta.principal }
  if (out.oferta.complementar === undefined) out.oferta.complementar = resultado.oferta.complementar ?? null
  out.persona = {
    ...(out.persona ?? {}),
    id: resultado.persona_sugerida,
    titulo: resultado.persona_titulo ?? PERSONAS[resultado.persona_sugerida],
  }
  out.selo_preco = resultado.selos.selo_preco
  out.selo_papel = resultado.selos.selo_papel
  out.observacao_motor = 'campos rígidos forçados pelo motor'
  return out
}

function textoDaResposta(data) {
  if (!Array.isArray(data?.content)) return ''
  return data.content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
}

async function chamarModelo({ fetchImpl, apiKey, model, maxTokens, system, messages }) {
  let res
  try {
    res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    throw new ErroLaudo('llm_falhou', `rede: ${e?.message ?? e}`)
  }

  if (!res.ok) {
    let corpo = ''
    try { corpo = await res.text() } catch { /* sem corpo */ }
    throw new ErroLaudo('llm_falhou', `HTTP ${res.status}: ${corpo.slice(0, 500)}`)
  }

  let data
  try {
    data = await res.json()
  } catch (e) {
    throw new ErroLaudo('llm_falhou', `resposta não é JSON: ${e?.message ?? e}`)
  }
  if (data?.stop_reason === 'refusal') {
    throw new ErroLaudo('llm_falhou', `modelo recusou: ${data?.stop_details?.category ?? 'sem categoria'}`)
  }
  return { texto: textoDaResposta(data), stop_reason: data?.stop_reason ?? null }
}

/**
 * @param {object} resultado  saída de avaliar(answers) — ou resultadoDePayload(payload)
 * @param {object} [opts]
 * @param {string} [opts.model]      default LAUDO_MODEL ou MODELO_PADRAO
 * @param {string} [opts.apiKey]     default ANTHROPIC_API_KEY
 * @param {Function} [opts.fetchImpl] default fetch global (testes injetam um fake)
 * @param {number} [opts.maxTokens]  default MAX_TOKENS_PADRAO
 */
export async function gerarLaudo(resultado, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ErroLaudo('sem_chave', 'defina ANTHROPIC_API_KEY')
  if (!resultado?.payload) throw new ErroLaudo('llm_falhou', 'resultado sem payload')

  const model = opts.model ?? process.env.LAUDO_MODEL ?? MODELO_PADRAO
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const maxTokens = opts.maxTokens ?? MAX_TOKENS_PADRAO
  const system = lerPrompt()

  const messages = [
    {
      role: 'user',
      content:
        'Payload do motor abaixo. Responda SÓ com o JSON do laudo, sem texto antes ou depois.\n\n' +
        JSON.stringify(resultado.payload),
    },
  ]

  let tentativas = 0
  let laudo = null
  let erros = []

  // Tentativa 1
  tentativas++
  const r1 = await chamarModelo({ fetchImpl, apiKey, model, maxTokens, system, messages })
  laudo = extrairJson(r1.texto)
  erros = laudo ? validarLaudo(laudo, resultado) : [
    r1.stop_reason === 'max_tokens' ? 'resposta cortada em max_tokens' : 'resposta não é um JSON válido',
  ]

  // Tentativa 2 — só se divergiu ou não parseou
  if (erros.length) {
    tentativas++
    messages.push({ role: 'assistant', content: r1.texto || '(vazio)' })
    messages.push({
      role: 'user',
      content:
        'O laudo acima não passou na validação do motor. Erros:\n- ' +
        erros.join('\n- ') +
        '\n\nCorrija e devolva o JSON completo de novo. persona.id, persona.titulo, selo_preco, selo_papel e oferta.principal têm que ser iguais ao campo `motor` do payload. SÓ o JSON.',
    })
    const r2 = await chamarModelo({ fetchImpl, apiKey, model, maxTokens, system, messages })
    const l2 = extrairJson(r2.texto)
    if (l2) {
      laudo = l2
      erros = validarLaudo(laudo, resultado)
    } else if (!laudo) {
      throw new ErroLaudo('llm_falhou', 'modelo não devolveu JSON válido em 2 tentativas')
    }
    // Ainda diverge → o motor manda.
    if (erros.length) laudo = forcarCamposRigidos(laudo, resultado)
  }

  return { laudo, tentativas, modelo: model, erros_finais: erros }
}
