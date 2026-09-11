// Peça compartilhável do Raio-X da Clínica: um PNG 1080×1920 (formato Stories)
// desenhado em canvas a partir do `resultado` de avaliar(). Sem fonte web, sem SVG,
// sem número que não venha do motor. As cores saem dos tokens do tema em runtime.
//
//   const blob = await gerarStoriesPNG({ resultado, answers, tema: 'roxo', marca: 'Raio-X da Clínica' })
//
// Todo nome de topo é prefixado com `st` pra não colidir no bundle (app/build.mjs
// concatena os módulos sem escopo).

import { EIXOS, faixa, BADGES, SELO_PRECO, SELO_PAPEL, OFERTA_TITULOS, PERSONA_FLAVOR, CONFIG } from './flow.js'
import { PERSONAS } from '../../lib/score.js'

const stW = 1080
const stH = 1920
const stM = 80
const stCW = stW - stM * 2
const stFontStack = '-apple-system, "SF Pro Display", Inter, system-ui, sans-serif'

// Fallback = tema mono. Em runtime lê o token do tema ativo.
const stCoresMono = {
  card: '#0B0B0C',
  surface2: '#161618',
  fgStrong: '#F5F5F7',
  fg: '#E6E6EA',
  fgDim: '#A1A1A6',
  accent: '#FFFFFF',
  accentFg: '#0B0B0C',
  tierTop: '#FFFFFF',
  tierGood: '#A1A1A6',
  tierMid: '#FF9F0A',
  tierLow: '#FF453A',
  hairline: 'rgba(255,255,255,.09)',
  hairlineStrong: 'rgba(255,255,255,.18)',
}
const stTokens = {
  card: '--card',
  surface2: '--surface2',
  fgStrong: '--fg-strong',
  fg: '--fg',
  fgDim: '--fg-dim',
  accent: '--accent',
  accentFg: '--accent-fg',
  tierTop: '--tier-top',
  tierGood: '--tier-good',
  tierMid: '--tier-mid',
  tierLow: '--tier-low',
  hairline: '--hairline',
  hairlineStrong: '--hairline-strong',
}

function stCores() {
  const out = { ...stCoresMono }
  if (typeof document === 'undefined' || !document.documentElement) return out
  const cs = getComputedStyle(document.documentElement)
  for (const [k, token] of Object.entries(stTokens)) {
    const v = cs.getPropertyValue(token).trim()
    if (v) out[k] = v
  }
  return out
}

function stCorFaixa(c, f) {
  return { top: c.tierTop, good: c.tierGood, mid: c.tierMid, low: c.tierLow, none: c.hairlineStrong }[f] || c.tierGood
}

function stCorTom(c, tom) {
  return { top: c.accent, good: c.tierGood, mid: c.tierMid, low: c.tierLow }[tom] || c.fgStrong
}

// ---------------------------------------------------------------------------
// Primitivas de desenho
// ---------------------------------------------------------------------------

function stFont(weight, size) {
  return `${weight} ${size}px ${stFontStack}`
}

function stSetFont(ctx, weight, size, tracking = 0) {
  ctx.font = stFont(weight, size)
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking}px`
}

function stMedir(ctx, text, tracking = 0) {
  const w = ctx.measureText(text).width
  // Chromium já inclui letterSpacing em measureText quando suportado.
  return 'letterSpacing' in ctx ? w : w + tracking * Math.max(0, text.length - 1)
}

function stTexto(ctx, text, x, y, { size = 24, weight = 400, color = '#fff', align = 'left', tracking = 0, baseline = 'alphabetic', alpha = 1 } = {}) {
  ctx.save()
  stSetFont(ctx, weight, size, tracking)
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(text, x, y)
  ctx.restore()
}

// Quebra por palavra medindo com o ctx.font atual. Palavra maior que a largura
// quebra por caractere. Se estourar maxLines, a última linha ganha reticência.
function stQuebrar(ctx, text, maxW, maxLines = Infinity) {
  const palavras = String(text || '').trim().split(/\s+/).filter(Boolean)
  const linhas = []
  let atual = ''
  const push = (l) => { if (l) linhas.push(l) }
  for (const p of palavras) {
    const tent = atual ? `${atual} ${p}` : p
    if (ctx.measureText(tent).width <= maxW) { atual = tent; continue }
    push(atual)
    if (ctx.measureText(p).width <= maxW) { atual = p; continue }
    let parte = ''
    for (const ch of p) {
      if (ctx.measureText(parte + ch).width <= maxW) parte += ch
      else { push(parte); parte = ch }
    }
    atual = parte
  }
  push(atual)
  if (linhas.length > maxLines) {
    const corte = linhas.slice(0, maxLines)
    let ult = corte[maxLines - 1]
    while (ult.length && ctx.measureText(`${ult}…`).width > maxW) ult = ult.slice(0, -1).trimEnd()
    corte[maxLines - 1] = `${ult}…`
    return corte
  }
  return linhas
}

function stRetArred(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Pílula com partes de texto lado a lado. Retorna a largura desenhada.
// opts.dry = só mede.
function stPilula(ctx, x, y, h, partes, { bg = null, border = null, padX = 22, gap = 12, dry = false, alpha = 1 } = {}) {
  let w = padX * 2
  const larguras = partes.map((p) => {
    stSetFont(ctx, p.weight || 500, p.size || 22, p.tracking || 0)
    return stMedir(ctx, p.text, p.tracking || 0)
  })
  w += larguras.reduce((s, l) => s + l, 0) + gap * (partes.length - 1)
  if (dry) return w
  ctx.save()
  ctx.globalAlpha = alpha
  stRetArred(ctx, x, y, w, h, h / 2)
  if (bg) { ctx.fillStyle = bg; ctx.fill() }
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1.5; ctx.stroke() }
  let cx = x + padX
  partes.forEach((p, i) => {
    stTexto(ctx, p.text, cx, y + h / 2 + 1, { size: p.size || 22, weight: p.weight || 500, color: p.color || '#fff', tracking: p.tracking || 0, baseline: 'middle', alpha: p.alpha ?? 1 })
    cx += larguras[i] + gap
  })
  ctx.restore()
  return w
}

// Linha de pílulas com quebra. Retorna a altura ocupada.
function stLinhaPilulas(ctx, x, y, maxW, itens, h, gap, { dry = false } = {}) {
  let cx = x
  let cy = y
  let linhas = 1
  for (const it of itens) {
    const w = stPilula(ctx, 0, 0, h, it.partes, { ...it.opts, dry: true })
    if (cx > x && cx + w > x + maxW) { cx = x; cy += h + gap; linhas++ }
    if (!dry) stPilula(ctx, cx, cy, h, it.partes, it.opts)
    cx += w + gap
  }
  return itens.length ? linhas * h + (linhas - 1) * gap : 0
}

// ---------------------------------------------------------------------------
// Dados derivados do resultado
// ---------------------------------------------------------------------------

function stPrimeiroNome(answers) {
  const nome = String(answers?.lead?.nome || '').trim()
  if (!nome) return ''
  const p = nome.split(/\s+/)[0]
  return p.charAt(0).toUpperCase() + p.slice(1)
}

function stMesAno() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
}

function stConquistadas(answers, resultado) {
  if (!answers || !answers.likert || !answers.categoricas) return []
  const out = []
  for (const b of BADGES) {
    try { if (b.when(answers, resultado)) out.push(b) } catch { /* resposta em branco */ }
  }
  return out
}

// ---------------------------------------------------------------------------
// Seções. Cada uma desenha a partir de y e devolve a altura usada.
// ---------------------------------------------------------------------------

function stSecTopo(ctx, c, y, marca) {
  stTexto(ctx, marca.toUpperCase(), stM, y + 20, { size: 20, weight: 600, color: c.fgDim, tracking: 4 })
  stTexto(ctx, stMesAno(), stW - stM, y + 20, { size: 20, weight: 600, color: c.fgDim, tracking: 3, align: 'right', alpha: 0.6 })
  return 26
}

function stSecTitulo(ctx, c, y, nome) {
  ctx.save()
  stSetFont(ctx, 700, 64, -1.8)
  ctx.fillStyle = c.fgStrong
  ctx.fillText('Raio-X da clínica', stM, y + 60)
  ctx.restore()
  let h = 76
  if (nome) {
    stTexto(ctx, nome, stM, y + h + 32, { size: 34, weight: 500, color: c.fgDim })
    h += 46
  }
  return h
}

function stSecPersona(ctx, c, y, resultado, { dry = false } = {}) {
  const pad = 40
  const inner = stCW - pad * 2
  const titulo = resultado.persona_titulo || PERSONAS[resultado.persona_sugerida] || 'Persona'
  const flavor = PERSONA_FLAVOR[resultado.persona_sugerida] || ''

  stSetFont(ctx, 700, 54, -1.4)
  const nomeLinhas = stQuebrar(ctx, titulo, inner, 2)
  stSetFont(ctx, 400, 24, 0)
  const flavorLinhas = flavor ? stQuebrar(ctx, flavor, inner, 2) : []

  const hLabel = 18
  const hNome = nomeLinhas.length * 60
  const hFlavor = flavorLinhas.length ? 16 + flavorLinhas.length * 32 : 0
  const h = pad + hLabel + 18 + hNome + hFlavor + pad - 8
  if (dry) return h

  ctx.save()
  stRetArred(ctx, stM, y, stCW, h, 28)
  ctx.fillStyle = c.accent
  ctx.fill()
  ctx.restore()

  let cy = y + pad
  stTexto(ctx, 'PERSONA', stM + pad, cy + 16, { size: 18, weight: 700, color: c.accentFg, tracking: 5, alpha: 0.65 })
  cy += hLabel + 18
  ctx.save()
  stSetFont(ctx, 700, 54, -1.4)
  ctx.fillStyle = c.accentFg
  for (const l of nomeLinhas) { ctx.fillText(l, stM + pad, cy + 48); cy += 60 }
  ctx.restore()
  if (flavorLinhas.length) {
    cy += 16
    ctx.save()
    stSetFont(ctx, 400, 24, 0)
    ctx.fillStyle = c.accentFg
    ctx.globalAlpha = 0.78
    for (const l of flavorLinhas) { ctx.fillText(l, stM + pad, cy + 24); cy += 32 }
    ctx.restore()
  }
  return h
}

// Radar em losango (mesma geometria do card: Marca topo, Captação direita,
// Conversão baixo, Equipe esquerda) + 4 barras à direita.
function stSecRadar(ctx, c, y, scores) {
  const colW = 500
  const hSec = 440
  const cx = stM + colW / 2
  const maxR = 130
  const cy = y + 222
  const val = (id) => (scores[id] === null || scores[id] === undefined ? 0 : scores[id])
  const cols = EIXOS.map((e) => stCorFaixa(c, faixa(scores[e.id])))
  const pts = [
    [cx, cy - maxR * (val('marca_demanda') / 100)],
    [cx + maxR * (val('captacao') / 100), cy],
    [cx, cy + maxR * (val('conversao') / 100)],
    [cx - maxR * (val('equipe_sistema') / 100), cy],
  ]

  ctx.save()
  // Grade concêntrica
  ctx.strokeStyle = c.hairlineStrong
  ctx.lineWidth = 1
  for (const f of [1, 0.75, 0.5, 0.25]) {
    const r = maxR * f
    ctx.beginPath()
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy)
    ctx.closePath()
    ctx.globalAlpha = f === 1 ? 1 : 0.6
    ctx.stroke()
  }
  ctx.globalAlpha = 0.6
  ctx.setLineDash([3, 5])
  ctx.beginPath(); ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy); ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  // Polígono: 4 triângulos com gradiente por aresta
  const arestas = [[0, 1], [1, 2], [2, 3], [3, 0]]
  const grad = (a, b) => {
    const [ax, ay] = pts[a]; const [bx, by] = pts[b]
    if (Math.abs(ax - bx) < 0.5 && Math.abs(ay - by) < 0.5) return cols[a]
    const g = ctx.createLinearGradient(ax, ay, bx, by)
    g.addColorStop(0, cols[a]); g.addColorStop(1, cols[b])
    return g
  }
  ctx.globalAlpha = 0.5
  for (const [a, b] of arestas) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...pts[a]); ctx.lineTo(...pts[b]); ctx.closePath()
    ctx.fillStyle = grad(a, b)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  for (const [a, b] of arestas) {
    ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(...pts[b])
    ctx.strokeStyle = grad(a, b)
    ctx.stroke()
  }
  pts.forEach((p, i) => {
    if (scores[EIXOS[i].id] === null || scores[EIXOS[i].id] === undefined) return
    ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2)
    ctx.fillStyle = cols[i]; ctx.fill()
    ctx.lineWidth = 3; ctx.strokeStyle = c.card; ctx.stroke()
  })
  ctx.restore()

  // Rótulos: eixo + valor colorido
  const rotulo = (i, x, yLabel, align, valorPrimeiro) => {
    const e = EIXOS[i]
    const v = scores[e.id] === null || scores[e.id] === undefined ? '—' : String(scores[e.id])
    const corV = scores[e.id] === null || scores[e.id] === undefined ? c.fgDim : cols[i]
    const yV = valorPrimeiro ? yLabel - 26 : yLabel + 38
    stTexto(ctx, e.radar, x, yLabel, { size: 15, weight: 600, color: c.fgDim, tracking: 2.5, align })
    stTexto(ctx, v, x, yV, { size: 34, weight: 700, color: corV, align, tracking: -1 })
  }
  rotulo(0, cx, cy - maxR - 26, 'center', true)
  rotulo(1, stM + colW, cy - 8, 'right', false)
  rotulo(2, cx, cy + maxR + 40, 'center', false)
  rotulo(3, stM, cy - 8, 'left', false)

  // Barras
  const bx = stM + colW + 40
  const bw = stW - stM - bx
  const rowH = 58
  const gap = 30
  const hBars = EIXOS.length * rowH + (EIXOS.length - 1) * gap
  let by = y + Math.round((hSec - hBars) / 2)
  EIXOS.forEach((e, i) => {
    const s = scores[e.id]
    const cor = cols[i]
    stTexto(ctx, e.label, bx, by + 22, { size: 23, weight: 600, color: c.fgStrong })
    stTexto(ctx, s === null || s === undefined ? '—' : String(s), bx + bw, by + 24, { size: 30, weight: 700, color: s === null || s === undefined ? c.fgDim : cor, align: 'right', tracking: -1 })
    const barY = by + 40
    ctx.save()
    stRetArred(ctx, bx, barY, bw, 12, 6)
    ctx.fillStyle = c.hairline; ctx.fill()
    ctx.strokeStyle = c.hairlineStrong; ctx.lineWidth = 1; ctx.stroke()
    const fillW = Math.max(0, Math.min(1, val(e.id) / 100)) * bw
    if (fillW > 0) {
      stRetArred(ctx, bx, barY, Math.max(fillW, 12), 12, 6)
      ctx.fillStyle = cor; ctx.fill()
    }
    ctx.restore()
    by += rowH + gap
  })
  return hSec
}

function stSecSelos(ctx, c, y, selos, { dry = false } = {}) {
  const h = 60
  const preco = SELO_PRECO[selos?.selo_preco]
  const papel = SELO_PAPEL[selos?.selo_papel]
  const item = (key, s) => ({
    partes: [
      { text: key, size: 15, weight: 600, color: c.fgDim, tracking: 2.5 },
      { text: s ? s.label : '—', size: 23, weight: 700, color: s ? stCorTom(c, s.tom) : c.fgDim },
    ],
    opts: { bg: c.surface2, border: c.hairlineStrong, padX: 24, gap: 14 },
  })
  return stLinhaPilulas(ctx, stM, y, stCW, [item('PREÇO', preco), item('QUEM VENDE', papel)], h, 16, { dry })
}

function stSecCondecoracoes(ctx, c, y, conquistadas, { dry = false } = {}) {
  const total = BADGES.length
  const n = conquistadas.length
  if (!dry) {
    stTexto(ctx, 'CONDECORAÇÕES', stM, y + 16, { size: 16, weight: 600, color: c.fgDim, tracking: 3.5 })
    ctx.save()
    stSetFont(ctx, 500, 22, 0)
    const sufixo = ' conquistadas'
    const wS = ctx.measureText(sufixo).width
    stTexto(ctx, sufixo, stW - stM, y + 18, { size: 22, weight: 500, color: c.fgDim, align: 'right' })
    stTexto(ctx, `${n} / ${total}`, stW - stM - wS, y + 18, { size: 24, weight: 700, color: c.fgStrong, align: 'right' })
    ctx.restore()
  }
  let h = 22 + 22
  const itens = conquistadas.slice(0, 6).map((b) => ({
    partes: [{ text: b.nome, size: 21, weight: 600, color: c.fg }],
    opts: { bg: null, border: c.hairlineStrong, padX: 20 },
  }))
  if (itens.length) {
    h += stLinhaPilulas(ctx, stM, y + h, stCW, itens, 46, 12, { dry })
  } else {
    if (!dry) stTexto(ctx, 'Nenhuma ainda. O laudo mostra por onde começar.', stM, y + h + 22, { size: 22, weight: 400, color: c.fgDim })
    h += 30
  }
  return h
}

function stSecProximo(ctx, c, y, oferta, { dry = false } = {}) {
  const pad = 38
  const inner = stCW - pad * 2
  const titulo = OFERTA_TITULOS[oferta?.principal] || 'Diagnóstico pontual'
  const complementar = oferta?.complementar ? OFERTA_TITULOS[oferta.complementar] : null
  const alerta = !!oferta?.trafego_proibido_passo_1

  stSetFont(ctx, 700, 44, -1.2)
  const linhas = stQuebrar(ctx, titulo, inner, 2)
  let h = pad + 18 + 18 + linhas.length * 50
  if (complementar) h += 14 + 26
  if (alerta) h += 20 + 44
  h += pad - 6
  if (dry) return h

  ctx.save()
  stRetArred(ctx, stM, y, stCW, h, 28)
  ctx.fillStyle = c.surface2; ctx.fill()
  ctx.strokeStyle = c.hairline; ctx.lineWidth = 1.5; ctx.stroke()
  ctx.restore()

  let cy = y + pad
  stTexto(ctx, 'PRÓXIMO PASSO', stM + pad, cy + 16, { size: 18, weight: 700, color: c.accent, tracking: 5 })
  cy += 18 + 18
  ctx.save()
  stSetFont(ctx, 700, 44, -1.2)
  ctx.fillStyle = c.fgStrong
  for (const l of linhas) { ctx.fillText(l, stM + pad, cy + 40); cy += 50 }
  ctx.restore()
  if (complementar) {
    cy += 14
    stTexto(ctx, `Complemento: ${complementar}`, stM + pad, cy + 22, { size: 23, weight: 500, color: c.fgDim })
    cy += 26
  }
  if (alerta) {
    cy += 20
    stPilula(ctx, stM + pad, cy, 44, [{ text: 'Tráfego não é o passo 1', size: 20, weight: 700, color: '#FFFFFF' }], { bg: c.tierLow, padX: 20 })
  }
  return h
}

function stRodape(ctx, c, marca) {
  const yLinha = stH - stM - 74
  ctx.save()
  ctx.strokeStyle = c.hairline
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(stM, yLinha); ctx.lineTo(stW - stM, yLinha); ctx.stroke()
  ctx.restore()
  const yT = stH - stM - 26
  stTexto(ctx, 'Faça o seu', stM, yT, { size: 22, weight: 400, color: c.fgDim })
  stSetFont(ctx, 400, 22, 0)
  const w = ctx.measureText('Faça o seu').width
  stTexto(ctx, marca.toUpperCase(), stM + w + 16, yT - 1, { size: 18, weight: 700, color: c.fgStrong, tracking: 3.5 })
}

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

function stCompor(ctx, c, { resultado, answers, marca, gapExtra = 0, dry = false }) {
  const scores = resultado?.scores || { marca_demanda: null, captacao: null, conversao: null, equipe_sistema: null }
  const conquistadas = stConquistadas(answers, resultado)
  const gap = 52 + gapExtra

  if (!dry) {
    ctx.fillStyle = c.card
    ctx.fillRect(0, 0, stW, stH)
    // Brilho discreto no canto, como o card
    const g = ctx.createRadialGradient(stW, 0, 0, stW, 0, 620)
    g.addColorStop(0, c.accent); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = g; ctx.fillRect(0, 0, stW, stH); ctx.restore()
  }

  let y = stM
  if (!dry) stSecTopo(ctx, c, y, marca)
  y += 26 + 44
  if (!dry) stSecTitulo(ctx, c, y, stPrimeiroNome(answers))
  y += 76 + (stPrimeiroNome(answers) ? 46 : 0)
  y += gap
  y += stSecPersona(ctx, c, y, resultado, { dry })
  y += gap
  if (!dry) stSecRadar(ctx, c, y, scores)
  y += 440
  y += gap
  y += stSecSelos(ctx, c, y, resultado?.selos, { dry })
  y += gap
  y += stSecCondecoracoes(ctx, c, y, conquistadas, { dry })
  y += gap
  y += stSecProximo(ctx, c, y, resultado?.oferta, { dry })
  if (!dry) stRodape(ctx, c, marca)
  return y
}

export async function gerarStoriesPNG({ resultado, answers, tema = 'mono', marca } = {}) {
  if (typeof document === 'undefined') throw new Error('gerarStoriesPNG precisa de DOM (canvas)')
  if (!resultado) throw new Error('gerarStoriesPNG: resultado ausente')
  const nomeMarca = marca || CONFIG.marca || 'Raio-X da Clínica'

  // O tema pedido pode não ser o ativo na página: aplica só durante a leitura dos tokens.
  const root = document.documentElement
  const temaAntes = root.dataset.tema
  let c
  try {
    if (tema && tema !== temaAntes) root.dataset.tema = tema
    c = stCores()
  } finally {
    if (temaAntes === undefined) delete root.dataset.tema
    else root.dataset.tema = temaAntes
  }

  if (document.fonts?.ready) { try { await document.fonts.ready } catch { /* segue */ } }

  const canvas = document.createElement('canvas')
  canvas.width = stW
  canvas.height = stH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponível')

  // Passo 1: mede. Passo 2: distribui a folga entre as seções (limitada) e desenha.
  const limite = stH - stM - 74 - 44
  const fim = stCompor(ctx, c, { resultado, answers, marca: nomeMarca, dry: true })
  const folga = limite - fim
  const gapExtra = Math.max(-16, Math.min(56, Math.floor(folga / 5)))
  stCompor(ctx, c, { resultado, answers, marca: nomeMarca, gapExtra })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob falhou'))), 'image/png')
  })
}

if (typeof window !== 'undefined') {
  window.__raiox = window.__raiox || {}
  window.__raiox.gerarStories = gerarStoriesPNG
  window.dispatchEvent(new CustomEvent('raiox:stories-pronto'))
}
