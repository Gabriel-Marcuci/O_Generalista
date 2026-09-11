// Raio-X da Clínica: chat guiado + laudo preenchido ao vivo.
// O motor (lib/score.js) calcula. Este arquivo só conduz e desenha.

import { avaliar, normalizar } from '../../lib/score.js'
import { QUESTOES, answersVazio } from '../../lib/questions.js'
import {
  CONFIG, SECOES, LIKERT_OPCOES, EIXOS, faixa, COR_FAIXA,
  PERGUNTAS, OBRIGATORIAS, MENSAGENS_INTRO, MENSAGENS_DEPOIS, MENSAGENS_TRANSICAO_LEAD, ANALISE_FRASES,
  BADGES, PERSONA_FLAVOR, OFERTA_TITULOS, SELO_PRECO, SELO_PAPEL, notaEixo, swotDeterministico, NUMEROS_PEDIR,
} from './flow.js'

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'raio_x_clinica_v1'
const state = {
  view: 'intro',
  cursor: 0,
  answers: answersVazio(),
  lead: null,
  revealed: false,
  unlocked: new Set(),
  bumps: 0,
}

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      view: state.view, cursor: state.cursor, answers: state.answers, lead: state.lead, revealed: state.revealed, unlocked: [...state.unlocked],
    }))
  } catch (_) {}
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const s = JSON.parse(raw)
    if (!s || !s.answers) return false
    state.view = s.view || 'intro'
    state.cursor = s.cursor || 0
    state.answers = { ...answersVazio(), ...s.answers }
    state.lead = s.lead || null
    state.revealed = !!s.revealed
    state.unlocked = new Set(s.unlocked || [])
    return true
  } catch (_) { return false }
}

function reset() {
  try { localStorage.removeItem(STORAGE_KEY) } catch (_) {}
  location.reload()
}

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------

function buildSteps() {
  const steps = []
  for (const html of MENSAGENS_INTRO) steps.push({ type: 'message', html, secao: 'perfil' })
  for (const p of PERGUNTAS) {
    steps.push({ type: 'question', ...p })
    const m = MENSAGENS_DEPOIS[p.id]
    if (m) steps.push({ type: 'message', fn: typeof m === 'function' ? m : () => m, secao: p.secao, after: p })
  }
  for (const html of MENSAGENS_TRANSICAO_LEAD) steps.push({ type: 'message', html, secao: 'extra' })
  steps.push({ type: 'lead-form', secao: 'extra' })
  return steps
}
const STEPS = buildSteps()

function getAnswer(p) { return state.answers[p.grupo][p.id] }
function setAnswer(p, v) { state.answers[p.grupo][p.id] = v }
function hasAnswer(p) {
  const v = getAnswer(p)
  if (Array.isArray(v)) return v.length > 0
  return v !== null && v !== undefined && v !== ''
}
function labelDe(p, v) {
  if (p.tipo === 'likert') return LIKERT_OPCOES.find((o) => o.valor === v)?.label || String(v)
  if (p.tipo === 'multi') return (v || []).map((k) => p.opcoes[k]).join(' · ')
  if (p.tipo === 'texto') return v
  return p.opcoes?.[v] || String(v)
}

function interpolar(html) {
  const nome = (state.answers.lead.nome || '').trim().split(' ')[0]
  return html.replaceAll('{nome}', esc(nome || 'você'))
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

function setView(v) {
  state.view = v
  document.body.dataset.view = v
  $$('.view').forEach((el) => el.setAttribute('aria-hidden', el.dataset.view === v ? 'false' : 'true'))
  save()
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const stackEl = () => $('[data-stack]')
const TIMING = { typing: 800, typingCascade: 650, pause: 450, beforeQuestion: 500, afterUser: 350 }
let timer = null
function schedule(fn, ms) { clearTimeout(timer); timer = setTimeout(fn, reduceMotion ? Math.min(ms, 120) : ms) }

function avatarHtml() {
  return `<span class="bubble__avatar" aria-hidden="true">${esc(CONFIG.guiaIniciais)}</span>`
}

function scrollTo(el, block = 'end') {
  setTimeout(() => el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block }), 30)
}

function appendBot(html, stepIndex) {
  const li = document.createElement('li')
  li.className = 'bubble bubble--bot'
  li.dataset.stepIndex = stepIndex
  li.innerHTML = `${avatarHtml()}<div class="bubble__text">${interpolar(html)}</div>`
  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li)
  if (li.querySelector('[data-onboarding-result]')) nudgeReport()
}

function appendUser(p, stepIndex) {
  const li = document.createElement('li')
  li.className = 'bubble bubble--user'
  li.dataset.stepIndex = stepIndex
  li.dataset.qid = p.id
  const v = getAnswer(p)
  const text = hasAnswer(p) ? labelDe(p, v) : 'Pulei essa.'
  li.innerHTML = `<span class="bubble__text">${esc(text)}</span><button type="button" class="bubble__edit" aria-label="Editar esta resposta" title="Editar"><span aria-hidden="true">✎</span></button>`
  li.querySelector('.bubble__edit').addEventListener('click', () => goBack(stepIndex))
  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li)
}

function showTyping() {
  hideTyping()
  const li = document.createElement('li')
  li.className = 'bubble bubble--typing'
  li.dataset.typing = '1'
  li.innerHTML = `${avatarHtml()}<div class="bubble__text"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`
  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li)
}
function hideTyping() { $('[data-typing]')?.remove() }

function appendQuestion(step, stepIndex) {
  const li = document.createElement('li')
  li.className = 'bubble bubble--question'
  li.dataset.stepIndex = stepIndex
  li.dataset.active = 'question'

  const current = getAnswer(step)
  let body = ''
  if (step.tipo === 'texto') {
    body = `<input type="text" id="q-${step.id}" class="q__input" data-input placeholder="${esc(step.placeholder)}" maxlength="120" value="${esc(current || '')}" autocomplete="off" spellcheck="false">`
  } else if (step.tipo === 'likert') {
    body = `<div class="q__options q__options--likert" role="group">${LIKERT_OPCOES.map((o) => `
      <button type="button" class="q__option" data-value="${o.valor}" aria-pressed="${current === o.valor}"><span class="q__scale">${o.valor}</span>${esc(o.label)}</button>`).join('')}</div>`
  } else {
    const sel = Array.isArray(current) ? current : current ? [current] : []
    body = `<div class="q__options" role="group">${Object.entries(step.opcoes).map(([k, label]) => `
      <button type="button" class="q__option" data-value="${esc(k)}" aria-pressed="${sel.includes(k)}">${esc(label)}</button>`).join('')}</div>`
  }

  const precisaBotao = step.tipo === 'texto' || step.tipo === 'multi'
  const nav = precisaBotao || step.opcional ? `<nav class="q__nav">
      ${step.opcional ? '<button type="button" class="q__btn q__btn--ghost" data-skip>Pular</button>' : '<span></span>'}
      ${precisaBotao ? `<button type="button" class="q__btn q__btn--primary" data-next ${hasAnswer(step) ? '' : 'disabled'}>Continuar <span aria-hidden="true">→</span></button>` : ''}
    </nav>` : ''

  li.innerHTML = `<article class="q">
      <span class="q__section">${esc(SECOES[step.secao] || step.secao)}</span>
      <p class="q__prompt">${interpolar(esc(step.prompt))}</p>
      ${body}${nav}
    </article>`

  const nextBtn = li.querySelector('[data-next]')
  const skipBtn = li.querySelector('[data-skip]')

  if (step.tipo === 'texto') {
    const input = li.querySelector('[data-input]')
    input.addEventListener('input', () => {
      const v = input.value.trim()
      setAnswer(step, v)
      nextBtn.disabled = v.length < 1
      save()
    })
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !nextBtn.disabled) { e.preventDefault(); advance(stepIndex) } })
    setTimeout(() => input.focus({ preventScroll: true }), 120)
  } else {
    let auto = null
    li.querySelectorAll('.q__option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.value
        if (step.tipo === 'multi') {
          const arr = Array.isArray(getAnswer(step)) ? [...getAnswer(step)] : []
          const i = arr.indexOf(raw)
          if (i >= 0) arr.splice(i, 1)
          else if (arr.length < (step.max || 99)) arr.push(raw)
          else return
          setAnswer(step, arr)
          li.querySelectorAll('.q__option').forEach((b) => b.setAttribute('aria-pressed', arr.includes(b.dataset.value)))
          nextBtn.disabled = arr.length === 0
          save()
          liveUpdate()
          return
        }
        const v = step.tipo === 'likert' ? Number(raw) : raw
        setAnswer(step, v)
        li.querySelectorAll('.q__option').forEach((b) => b.setAttribute('aria-pressed', 'false'))
        btn.setAttribute('aria-pressed', 'true')
        save()
        clearTimeout(auto)
        auto = setTimeout(() => { if (li.isConnected && li.dataset.active === 'question') advance(stepIndex) }, reduceMotion ? 60 : 380)
      })
    })
  }
  nextBtn?.addEventListener('click', () => advance(stepIndex))
  skipBtn?.addEventListener('click', () => { setAnswer(step, ''); advance(stepIndex) })

  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li, 'center')
}

function appendLeadCard(stepIndex) {
  const li = document.createElement('li')
  li.className = 'bubble bubble--question bubble--lead'
  li.dataset.stepIndex = stepIndex
  li.dataset.active = 'lead'
  li.innerHTML = `<article class="q q--card">
      <form class="lead" data-lead-form novalidate>
        <label class="lead__field"><span>WhatsApp</span>
          <input type="tel" id="lead-whatsapp" name="whatsapp" required autocomplete="tel" inputmode="tel" placeholder="(11) 9XXXX-XXXX" data-whats></label>
        <label class="lead__field"><span>E-mail (opcional)</span>
          <input type="email" id="lead-email" name="email" autocomplete="email" inputmode="email" placeholder="voce@clinica.com.br"></label>
        <nav class="q__nav q__nav--end">
          <button type="submit" class="q__btn q__btn--primary">Liberar meu laudo <span aria-hidden="true">→</span></button>
        </nav>
        <p class="lead__error" role="alert" hidden></p>
        <p class="lead__fine">Suas respostas só geram o seu laudo. Nada é compartilhado.</p>
      </form>
    </article>`
  const whats = li.querySelector('[data-whats]')
  whats.addEventListener('input', () => { whats.value = fmtPhone(whats.value) })
  li.querySelector('[data-lead-form]').addEventListener('submit', (e) => {
    e.preventDefault()
    const err = li.querySelector('.lead__error')
    const digits = whats.value.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) {
      err.textContent = 'Coloca o WhatsApp com DDD. É pra lá que o laudo vai.'
      err.hidden = false
      whats.focus()
      return
    }
    err.hidden = true
    state.lead = { whatsapp: digits, email: li.querySelector('#lead-email').value.trim(), em: new Date().toISOString() }
    li.dataset.active = ''
    li.querySelectorAll('input,button').forEach((el) => { el.disabled = true })
    save()
    enviarParaApi()
    startAnalysis(stepIndex)
  })
  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li, 'center')
  setTimeout(() => whats.focus({ preventScroll: true }), 150)
}

function fmtPhone(s) {
  const d = s.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// Motor do fluxo -------------------------------------------------------------

function runFrom(cursor, first = true) {
  state.cursor = cursor
  save()
  if (cursor >= STEPS.length) return
  const step = STEPS[cursor]
  if (step.type === 'message') {
    const html = step.fn ? step.fn(getAnswer(step.after), state.answers, currentResult()) : step.html
    if (!html) return runFrom(cursor + 1, first)
    schedule(() => {
      showTyping()
      schedule(() => {
        hideTyping()
        appendBot(html, cursor)
        schedule(() => runFrom(cursor + 1, false), TIMING.pause)
      }, first ? TIMING.typing : TIMING.typingCascade)
    }, first ? TIMING.afterUser : TIMING.pause)
    return
  }
  schedule(() => {
    if (step.type === 'question') appendQuestion(step, cursor)
    else if (step.type === 'lead-form') appendLeadCard(cursor)
    updateProgress()
  }, first ? TIMING.beforeQuestion : TIMING.pause)
}

function advance(stepIndex) {
  const step = STEPS[stepIndex]
  const li = $(`[data-step-index="${stepIndex}"][data-active]`)
  if (li) li.remove()
  appendUser(step, stepIndex)
  liveUpdate()
  runFrom(stepIndex + 1, true)
}

function goBack(stepIndex) {
  clearTimeout(timer)
  hideTyping()
  $$('[data-step-index]').forEach((el) => { if (Number(el.dataset.stepIndex) >= stepIndex) el.remove() })
  runFrom(stepIndex, false)
}

function currentResult() { return avaliar(state.answers) }

// ---------------------------------------------------------------------------
// Laudo (template compartilhado entre preview da intro e laudo real)
// ---------------------------------------------------------------------------

const ATTR_ICON = {
  nome: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
  papel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
  foco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-3 3-6 6-6 10a6 6 0 0 0 12 0c0-4-3-7-6-10z"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
}

const SWOT_ICON = {
  forcas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14c0-3 2-5 5-5h2l3-3v6l-3 3v3a3 3 0 0 1-3 3H8a2 2 0 0 1-2-2z"/></svg>',
  fraquezas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5"/><path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5"/></svg>',
  oportunidades: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
  alertas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
}

const SWOT_TITULO = { forcas: 'Forças', fraquezas: 'Fraquezas', oportunidades: 'Oportunidades', alertas: 'Alertas' }
const SWOT_TOM = { forcas: 'is-positive', fraquezas: 'is-negative', oportunidades: 'is-opportunity', alertas: 'is-alert' }

function mesAno() {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
}

export function reportTemplate() {
  const radarLabel = (eixo, x, y, anchor, valueFirst) => {
    const v = `<text x="${x}" y="${valueFirst ? y : y + 24}" font-size="20" font-weight="800" data-radar-value="${eixo.id}" fill="#F6F2E7">—</text>`
    const l = `<text x="${x}" y="${valueFirst ? y + 24 : y}" font-size="11" font-weight="700" letter-spacing="2" fill="#F6F2E7" opacity=".8">${eixo.radar}</text>`
    return `<g text-anchor="${anchor}" font-family="Figtree, system-ui, sans-serif">${v}${l}</g>`
  }
  return `
  <div class="report__analyzing" data-analyzing hidden>
    <span class="report__pill"><span class="report__pill-dot" aria-hidden="true">●</span> analisando</span>
    <span class="report__pill-sub" data-analyzing-sub>${ANALISE_FRASES[0]}</span>
  </div>
  <header class="report__intro">
    <div class="intro-top">
      <span class="tagline"><span class="tagline__rule"></span><span class="tagline__label">raio-x da clínica</span></span>
      <span class="intro-meta">${mesAno()}</span>
    </div>
    <h2 class="intro-title">Diagnóstico comercial da clínica</h2>
    <div class="intro-body">
      <ul class="profile" data-ident>
        ${['nome', 'papel', 'foco', 'agenda'].map((k) => `
        <li class="attr" data-ident-key="${k}">
          <span class="attr__icon" aria-hidden="true">${ATTR_ICON[k]}</span>
          <span class="attr__body"><span class="attr__key">${{ nome: 'Nome', papel: 'Papel', foco: 'Linha', agenda: 'Agenda' }[k]}</span><span class="attr__val" data-empty>—</span></span>
        </li>`).join('')}
      </ul>
      <div class="trophy" data-trophy>
        <div class="trophy__head"><span class="trophy__label">Persona</span><span class="trophy__rule"></span></div>
        <div class="trophy__body">
          <span class="trophy__emblem" aria-hidden="true">✦</span>
          <div class="trophy__name is-pending" data-persona>???</div>
        </div>
        <p class="trophy__flavor" data-persona-flavor>Sua persona aparece aqui quando você terminar de responder.</p>
      </div>
    </div>
  </header>

  <section class="report__section report__section--radar">
    <div class="section-head"><span class="section-num">01</span><h3>Radar</h3><span class="section-meta">4 eixos</span></div>
    <div class="radar-card">
      <svg viewBox="0 0 500 460" role="img" aria-label="Radar dos 4 eixos: marca, captação, conversão e equipe">
        <defs data-radar-defs></defs>
        <g fill="none" stroke="rgba(246,242,231,0.10)" stroke-width="1">
          <polygon points="250,70 410,230 250,390 90,230"/><polygon points="250,110 370,230 250,350 130,230"/>
          <polygon points="250,150 330,230 250,310 170,230"/><polygon points="250,190 290,230 250,270 210,230"/>
        </g>
        <g stroke="rgba(246,242,231,0.10)" stroke-width="1" stroke-dasharray="3,4"><line x1="250" y1="70" x2="250" y2="390"/><line x1="90" y1="230" x2="410" y2="230"/></g>
        <g fill-opacity="0.55" data-radar-quadrants></g>
        <g fill="none" stroke-width="2" stroke-linejoin="round" data-radar-edges></g>
        <g stroke="#041B15" stroke-width="1.5" data-radar-points></g>
        ${radarLabel(EIXOS[0], 250, 28, 'middle', true)}
        ${radarLabel(EIXOS[1], 496, 222, 'end', false)}
        ${radarLabel(EIXOS[2], 250, 420, 'middle', false)}
        ${radarLabel(EIXOS[3], 4, 222, 'start', false)}
      </svg>
    </div>
    <div class="scores" data-scores>
      ${EIXOS.map((e) => `
      <div class="score is-none" data-score="${e.id}">
        <span class="score__icon" aria-hidden="true">${e.icon}</span>
        <div class="score__body">
          <div class="score__label">${e.longo}</div>
          <div class="score__bar"><div class="score__fill" style="width:0%"></div></div>
          <div class="score__note is-pending" data-note>Preenche conforme você responde.</div>
        </div>
        <span class="score__value" data-value>—</span>
      </div>`).join('')}
    </div>
    <div class="selos" data-selos>
      <span class="selo is-pending" data-selo="preco"><span class="selo__key">Preço</span><span class="selo__val">—</span></span>
      <span class="selo is-pending" data-selo="papel"><span class="selo__key">Quem vende</span><span class="selo__val">—</span></span>
    </div>
  </section>

  <section class="report__section">
    <div class="section-head"><span class="section-num">02</span><h3>Condecorações</h3><span class="section-meta" data-badges-meta>0 conquistadas</span></div>
    <div class="badges-meta"><span class="badges-count" data-badges-count>0 / ${BADGES.length}</span></div>
    <div class="badge-grid" data-badges>
      ${BADGES.map((b) => `<div class="badge locked" data-badge="${b.id}" data-tooltip="${esc(b.blurb)}" tabindex="0"><span class="badge__emoji" aria-hidden="true">${b.icon}</span><span class="badge__name">${esc(b.nome)}</span></div>`).join('')}
    </div>
  </section>

  <section class="report__section report__section--gated" data-gated>
    <div class="section-head"><span class="section-num">03</span><h3>SWOT</h3><span class="section-meta">leitura da clínica</span></div>
    <div class="swot-grid">
      ${Object.keys(SWOT_TITULO).map((k) => `
      <div class="swot ${SWOT_TOM[k]}">
        <div class="swot__head"><span class="swot__icon" aria-hidden="true">${SWOT_ICON[k]}</span><span class="swot__title">${SWOT_TITULO[k]}</span></div>
        <ul class="swot__list" data-swot="${k}"><li class="is-pending">Liberado com o laudo.</li></ul>
      </div>`).join('')}
    </div>
  </section>

  <section class="report__section report__section--gated" data-gated>
    <div class="section-head"><span class="section-num">04</span><h3>Próximo passo</h3><span class="section-meta">uma oferta, não um menu</span></div>
    <div class="offer" data-offer>
      <p class="offer__pending is-pending">O roteamento aparece aqui com o laudo.</p>
    </div>
  </section>

  <footer class="report__footer">
    <span class="footer-note" data-footer-note></span>
    <div class="report__actions">
      <button type="button" class="btn-act btn-act--primary" data-action="copy" disabled data-tooltip="Libera quando o laudo sair.">Copiar resumo</button>
      <button type="button" class="btn-act" data-action="print" disabled data-tooltip="Libera quando o laudo sair.">Baixar PDF</button>
    </div>
  </footer>`
}

// Renderização ---------------------------------------------------------------

function tierClass(el, f) {
  el.classList.remove('is-top', 'is-good', 'is-mid', 'is-low', 'is-none')
  el.classList.add(`is-${f}`)
}

function renderRadar(root, scores) {
  const cx = 250, cy = 230, maxR = 160
  const val = (id) => (scores[id] === null || scores[id] === undefined ? 0 : scores[id])
  const pts = [
    [cx, cy - maxR * (val('marca_demanda') / 100)],
    [cx + maxR * (val('captacao') / 100), cy],
    [cx, cy + maxR * (val('conversao') / 100)],
    [cx - maxR * (val('equipe_sistema') / 100), cy],
  ]
  const cols = EIXOS.map((e) => COR_FAIXA[faixa(scores[e.id])])
  const grads = [[0, 1], [1, 2], [2, 3], [3, 0]]
  $('[data-radar-defs]', root).innerHTML = grads.map(([a, b], i) => `
    <linearGradient id="rg-${root.id}-${i}" gradientUnits="userSpaceOnUse" x1="${pts[a][0].toFixed(1)}" y1="${pts[a][1].toFixed(1)}" x2="${pts[b][0].toFixed(1)}" y2="${pts[b][1].toFixed(1)}">
      <stop offset="0%" stop-color="${cols[a]}"/><stop offset="100%" stop-color="${cols[b]}"/></linearGradient>`).join('')
  $('[data-radar-quadrants]', root).innerHTML = grads.map(([a, b], i) =>
    `<polygon points="${cx},${cy} ${pts[a][0].toFixed(1)},${pts[a][1].toFixed(1)} ${pts[b][0].toFixed(1)},${pts[b][1].toFixed(1)}" fill="url(#rg-${root.id}-${i})"/>`).join('')
  $('[data-radar-edges]', root).innerHTML = grads.map(([a, b], i) =>
    `<line x1="${pts[a][0].toFixed(1)}" y1="${pts[a][1].toFixed(1)}" x2="${pts[b][0].toFixed(1)}" y2="${pts[b][1].toFixed(1)}" stroke="url(#rg-${root.id}-${i})"/>`).join('')
  $('[data-radar-points]', root).innerHTML = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="${cols[i]}"/>`).join('')
  EIXOS.forEach((e, i) => {
    const t = $(`[data-radar-value="${e.id}"]`, root)
    t.textContent = scores[e.id] === null ? '—' : String(scores[e.id])
    t.setAttribute('fill', scores[e.id] === null ? '#F6F2E7' : cols[i])
  })
}

function blocoCompleto(ids, grupo) {
  return ids.every((id) => {
    const v = state.answers[grupo][id]
    return v !== null && v !== undefined && v !== ''
  })
}

const PRECO_IDS = PERGUNTAS.filter((p) => p.grupo === 'likert' && p.id.startsWith('P')).map((p) => p.id)
const PAPEL_IDS = PERGUNTAS.filter((p) => p.grupo === 'categoricas').map((p) => p.id)

// opts: { complete, revealed, animate, answers }
export function renderReport(root, r, opts = {}) {
  const a = opts.answers || normalizar(state.answers).answers
  const complete = opts.complete ?? OBRIGATORIAS.every(hasAnswer)
  const revealed = opts.revealed ?? state.revealed
  const animate = opts.animate ?? true

  // Identidade
  const ident = {
    nome: (a.lead.nome || '').trim(),
    papel: a.lead.papel ? QUESTOES.lead.papel.opcoes[a.lead.papel] : '',
    foco: a.lead.foco ? QUESTOES.lead.foco.opcoes[a.lead.foco] : '',
    agenda: a.roteamento.agenda ? QUESTOES.roteamento.agenda.opcoes[a.roteamento.agenda] : '',
  }
  for (const [k, v] of Object.entries(ident)) {
    const el = $(`[data-ident-key="${k}"] .attr__val`, root)
    if (!el) continue
    if (v) {
      if (el.textContent !== v) { el.textContent = v; el.removeAttribute('data-empty'); if (animate) flash(el) }
    } else if (el.textContent !== '—') { el.textContent = '—'; el.setAttribute('data-empty', '') }
  }

  // Radar + barras
  renderRadar(root, r.scores)
  for (const e of EIXOS) {
    const row = $(`[data-score="${e.id}"]`, root)
    const s = r.scores[e.id]
    tierClass(row, faixa(s))
    $('.score__fill', row).style.width = `${s ?? 0}%`
    const valEl = $('[data-value]', row)
    const txt = s === null ? '—' : String(s)
    if (valEl.textContent !== txt) { valEl.textContent = txt; if (animate && s !== null) flash(valEl) }
    const note = $('[data-note]', row)
    const n = complete ? notaEixo(e.id, r) : null
    note.textContent = n || 'Preenche conforme você responde.'
    note.classList.toggle('is-pending', !n)
  }

  // Selos
  const seloPreco = blocoCompleto(PRECO_IDS, 'likert') ? SELO_PRECO[r.selos.selo_preco] : null
  const seloPapel = blocoCompleto(PAPEL_IDS, 'categoricas') ? SELO_PAPEL[r.selos.selo_papel] : null
  for (const [k, s] of [['preco', seloPreco], ['papel', seloPapel]]) {
    const el = $(`[data-selo="${k}"]`, root)
    el.classList.toggle('is-pending', !s)
    el.classList.remove('is-top', 'is-mid', 'is-low')
    if (s) el.classList.add(`is-${s.tom}`)
    $('.selo__val', el).textContent = s ? s.label : '—'
  }

  // Condecorações
  let ganhas = 0
  const novas = []
  for (const b of BADGES) {
    const ok = !!b.when(a, r)
    const el = $(`[data-badge="${b.id}"]`, root)
    el.classList.toggle('locked', !ok)
    if (ok) {
      ganhas++
      if (opts.trackUnlocks && !state.unlocked.has(b.id)) { state.unlocked.add(b.id); novas.push(b); if (animate) { el.classList.remove('is-revealing'); void el.offsetWidth; el.classList.add('is-revealing') } }
    }
  }
  $('[data-badges-meta]', root).textContent = `${ganhas} conquistada${ganhas === 1 ? '' : 's'}`
  $('[data-badges-count]', root).textContent = `${ganhas} / ${BADGES.length}`

  // Persona
  const personaEl = $('[data-persona]', root)
  const flavorEl = $('[data-persona-flavor]', root)
  if (complete) {
    if (personaEl.textContent !== r.persona_titulo) {
      personaEl.textContent = r.persona_titulo
      personaEl.classList.remove('is-pending')
      if (animate) { personaEl.classList.remove('is-revealing'); void personaEl.offsetWidth; personaEl.classList.add('is-revealing') }
    }
    flavorEl.textContent = PERSONA_FLAVOR[r.persona_sugerida] || ''
  } else {
    personaEl.textContent = '???'
    personaEl.classList.add('is-pending')
    flavorEl.textContent = 'Sua persona aparece aqui quando você terminar de responder.'
  }

  // SWOT + oferta (gated)
  root.classList.toggle('is-revealed', revealed)
  if (revealed) {
    const swot = swotDeterministico(r, a)
    for (const k of Object.keys(SWOT_TITULO)) {
      $(`[data-swot="${k}"]`, root).innerHTML = (swot[k].length ? swot[k] : ['—']).map((t) => `<li>${esc(t)}</li>`).join('')
    }
    const o = r.oferta
    $('[data-offer]', root).innerHTML = `
      <div class="offer__main">
        <span class="offer__kicker">Oferta principal</span>
        <div class="offer__title">${esc(OFERTA_TITULOS[o.principal])}</div>
        <p class="offer__copy">${esc(o.copy_gancho)}</p>
        ${o.complementar ? `<span class="offer__chip">+ ${esc(OFERTA_TITULOS[o.complementar])}</span>` : ''}
        ${o.trafego_proibido_passo_1 ? '<span class="offer__chip offer__chip--warn">Tráfego não é o passo 1</span>' : ''}
      </div>
      <div class="offer__grid">
        <div class="offer__block"><span class="offer__kicker">O que não fazer agora</span><p>${esc(o.o_que_nao_fazer_agora)}</p></div>
        <div class="offer__block"><span class="offer__kicker">Fase 2</span><p>${esc(o.fase_2)}</p></div>
      </div>
      <div class="offer__numbers"><span class="offer__kicker">Os 3 números que eu vou te pedir</span><ol>${NUMEROS_PEDIR.map((n) => `<li>${esc(n)}</li>`).join('')}</ol></div>`
    $$('[data-action="copy"],[data-action="print"]', root).forEach((b) => { b.disabled = false; b.removeAttribute('data-tooltip') })
    $('[data-footer-note]', root).textContent = `Pré-laudo gerado pelo motor. O laudo comentado sai no WhatsApp${state.lead ? '' : ' após o cadastro'}.`
  }

  return { ganhas, novas }
}

function flash(el) {
  if (reduceMotion) return
  el.classList.remove('is-flashing'); void el.offsetWidth; el.classList.add('is-flashing')
}

// Atualização ao vivo --------------------------------------------------------

let lastScores = null
function liveUpdate() {
  const root = $('#laudo')
  const r = currentResult()
  const before = lastScores
  const { novas } = renderReport(root, r, { trackUnlocks: true })
  lastScores = { ...r.scores }
  novas.forEach(queueToast)
  if (before) {
    const changed = EIXOS.some((e) => before[e.id] !== r.scores[e.id])
    if (changed || novas.length) bumpTab()
  }
  updateProgress()
  save()
}

function updateProgress() {
  const done = OBRIGATORIAS.filter(hasAnswer).length
  const pct = Math.round((done / OBRIGATORIAS.length) * 100)
  const fill = $('[data-progress-fill]')
  if (fill) fill.style.width = `${state.revealed ? 100 : Math.min(pct, 96)}%`
}

// Análise + revelação --------------------------------------------------------

function startAnalysis(stepIndex) {
  const root = $('#laudo')
  const pill = $('[data-analyzing]', root)
  pill.hidden = false
  root.classList.add('is-analyzing')
  let i = 0
  const sub = $('[data-analyzing-sub]', root)
  const rot = setInterval(() => { i = (i + 1) % ANALISE_FRASES.length; sub.textContent = ANALISE_FRASES[i] }, 900)
  schedule(() => { showTyping() }, 400)
  setTimeout(() => {
    clearInterval(rot)
    pill.hidden = true
    root.classList.remove('is-analyzing')
    state.revealed = true
    hideTyping()
    liveUpdate()
    const r = currentResult()
    appendBot(`Saiu, {nome}. Persona: <strong>${esc(r.persona_titulo)}</strong>. Oferta principal: <strong>${esc(OFERTA_TITULOS[r.oferta.principal])}</strong>.${r.oferta.trafego_proibido_passo_1 ? ' Tráfego não é o passo 1 aqui.' : ''}`, stepIndex + 1)
    schedule(() => {
      appendBot('O laudo completo, com o SWOT comentado e a mensagem que eu te mandaria, vai pro seu WhatsApp. Enquanto isso o card já é seu: copia o resumo ou baixa o PDF.<span data-onboarding-result></span>', stepIndex + 2)
      $('[data-progress-fill]').style.width = '100%'
      if (CONFIG.whatsapp) {
        schedule(() => appendCta(stepIndex + 3), 900)
      }
    }, 1400)
  }, reduceMotion ? 600 : 3600)
}

function appendCta(stepIndex) {
  const li = document.createElement('li')
  li.className = 'bubble bubble--question'
  li.dataset.stepIndex = stepIndex
  const r = currentResult()
  const msg = encodeURIComponent(`Oi ${CONFIG.guia}, fiz o Raio-X. Persona: ${r.persona_titulo}. Oferta: ${OFERTA_TITULOS[r.oferta.principal]}. Quero o laudo completo.`)
  li.innerHTML = `<article class="q"><nav class="q__nav q__nav--end"><a class="q__btn q__btn--primary" href="https://wa.me/${CONFIG.whatsapp}?text=${msg}" target="_blank" rel="noopener">Receber laudo no WhatsApp <span aria-hidden="true">→</span></a></nav></article>`
  stackEl().appendChild(li)
  requestAnimationFrame(() => li.classList.add('is-in'))
  scrollTo(li)
}

async function enviarParaApi() {
  try {
    await fetch('/api/avaliar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state.answers) })
  } catch (_) { /* motor roda no cliente; API é opcional */ }
}

// Toast + tab badge ----------------------------------------------------------

const toastQueue = []
let toastOn = false
function queueToast(b) { toastQueue.push(b); if (!toastOn) nextToast() }
function nextToast() {
  const b = toastQueue.shift()
  const t = $('[data-toast]')
  if (!b || !t) { toastOn = false; return }
  toastOn = true
  t.innerHTML = `<span class="toast__icon" aria-hidden="true">${b.icon}</span><div class="toast__body"><span class="toast__title">Condecoração: ${esc(b.nome)}</span><span class="toast__blurb">${esc(b.blurb)}</span></div>`
  t.hidden = false
  requestAnimationFrame(() => t.classList.add('is-visible'))
  setTimeout(() => { t.classList.remove('is-visible'); setTimeout(() => { t.hidden = true; nextToast() }, 420) }, 3800)
}

function bumpTab() {
  const tab = $('[data-tab="report"]')
  if (!tab || tab.classList.contains('is-active')) return
  state.bumps++
  const badge = $('[data-tab-badge]')
  badge.textContent = String(state.bumps)
  badge.hidden = false
  tab.classList.remove('is-flashing'); void tab.offsetWidth; tab.classList.add('is-flashing')
}

function nudgeReport() {
  const card = $('#laudo')
  card.classList.remove('is-nudge'); void card.offsetWidth; card.classList.add('is-nudge')
  const tab = $('[data-tab="report"]')
  if (tab && !tab.classList.contains('is-active')) tab.classList.add('is-onboarding')
}

function setupTabs() {
  $$('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
    const which = tab.dataset.tab
    $$('[data-tab]').forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab) })
    $$('[data-pane]').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === which))
    if (which === 'report') { state.bumps = 0; const b = $('[data-tab-badge]'); b.hidden = true; tab.classList.remove('is-onboarding') }
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }))
}

// Ações do laudo -------------------------------------------------------------

function setupActions() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const act = btn.dataset.action
    if (act === 'start') { setView('flow'); if (state.cursor === 0) runFrom(0, true) }
    if (act === 'reset') { if (confirm('Apagar as respostas e começar de novo?')) reset() }
    if (act === 'print') window.print()
    if (act === 'copy') {
      const r = currentResult()
      const txt = [
        `${CONFIG.marca} — ${(state.answers.lead.nome || '').trim()}`,
        `Persona: ${r.persona_titulo}`,
        ...EIXOS.map((x) => `${x.longo}: ${r.scores[x.id] ?? '—'}`),
        `Preço: ${SELO_PRECO[r.selos.selo_preco].label} · Quem vende: ${SELO_PAPEL[r.selos.selo_papel].label}`,
        `Oferta principal: ${OFERTA_TITULOS[r.oferta.principal]}${r.oferta.complementar ? ` + ${OFERTA_TITULOS[r.oferta.complementar]}` : ''}`,
        r.oferta.trafego_proibido_passo_1 ? 'Tráfego não é o passo 1.' : '',
      ].filter(Boolean).join('\n')
      try { await navigator.clipboard.writeText(txt); toastSimple('Resumo copiado.') } catch (_) { toastSimple('Não deu pra copiar. Seleciona o card e copia.') }
    }
  })
}

function toastSimple(msg) {
  const t = $('[data-toast]')
  t.innerHTML = `<div class="toast__body"><span class="toast__title">${esc(msg)}</span></div>`
  t.hidden = false
  requestAnimationFrame(() => t.classList.add('is-visible'))
  setTimeout(() => { t.classList.remove('is-visible'); setTimeout(() => { t.hidden = true }, 420) }, 2200)
}

// Tooltip clamp dentro do laudo -----------------------------------------------
function setupTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]')
    if (!el) return
    const card = el.closest('.fsm-report')
    if (!card) return
    const r = el.getBoundingClientRect(), c = card.getBoundingClientRect()
    const mid = r.left + r.width / 2
    const half = 120
    let off = 0
    if (mid - half < c.left + 8) off = c.left + 8 - (mid - half)
    if (mid + half > c.right - 8) off = c.right - 8 - (mid + half)
    el.style.setProperty('--tt-offset', `${off}px`)
  })
}

// Preview da intro (fixture da Camila) ---------------------------------------

// O laudo do preview é desenhado num container largo (2 colunas, como na impressão)
// e reduzido por transform, pra caber inteiro: persona, radar, badges, SWOT e oferta.
const PREVIEW_W = 1600

function ajustarPreview() {
  const frame = $('[data-preview-frame]')
  const scaler = $('[data-preview-scaler]')
  const card = $('#laudo-preview')
  const figura = $('.intro__preview')
  if (!frame || !scaler || !card || !figura) return
  const alturaCard = card.offsetHeight
  if (!alturaCard) return
  // Cabe na largura da coluna e na dobra: o card aparece inteiro, sem corte.
  const alturaMax = Math.min(760, innerHeight * 0.8)
  const escala = Math.min(figura.clientWidth / PREVIEW_W, alturaMax / alturaCard)
  scaler.style.setProperty('--preview-w', `${PREVIEW_W}px`)
  scaler.style.setProperty('--preview-scale', escala)
  frame.style.width = `${Math.round(PREVIEW_W * escala)}px`
  frame.style.height = `${Math.round(alturaCard * escala)}px`
}

async function renderPreview() {
  const root = $('#laudo-preview')
  if (!root) return
  root.innerHTML = reportTemplate()
  try {
    const fixture = window.__RAIOX_FIXTURE__ || await (await fetch('../lib/exemplo.secretaria-r500.json')).json()
    const r = avaliar(fixture)
    renderReport(root, r, { complete: true, revealed: true, animate: false, answers: normalizar(fixture).answers })
    $('[data-footer-note]', root).textContent = 'Exemplo fictício. O seu sai com as suas respostas.'
    $$('[data-action]', root).forEach((b) => { b.disabled = true; b.removeAttribute('data-tooltip') })
  } catch (_) {
    renderReport(root, avaliar(answersVazio()), { complete: false, revealed: false, animate: false, answers: answersVazio() })
  }
  ajustarPreview()
  if (window.ResizeObserver) new ResizeObserver(ajustarPreview).observe($('[data-preview-frame]'))
  if (document.fonts?.ready) document.fonts.ready.then(ajustarPreview)
  addEventListener('resize', ajustarPreview)
}

// Restaurar sessão ------------------------------------------------------------

function restore() {
  // Reconstrói o chat a partir das respostas já dadas, sem cascata.
  const stack = stackEl()
  stack.innerHTML = ''
  for (let i = 0; i < state.cursor && i < STEPS.length; i++) {
    const s = STEPS[i]
    if (s.type === 'message') {
      const html = s.fn ? s.fn(getAnswer(s.after), state.answers, currentResult()) : s.html
      if (html) { appendBot(html, i) }
    } else if (s.type === 'question') {
      if (hasAnswer(s) || s.opcional) appendUser(s, i)
    } else if (s.type === 'lead-form' && state.lead) {
      const li = document.createElement('li'); li.className = 'bubble bubble--user'; li.dataset.stepIndex = i
      li.innerHTML = `<span class="bubble__text">WhatsApp: ${esc(fmtPhone(state.lead.whatsapp))}</span>`; stack.appendChild(li); li.classList.add('is-in')
    }
  }
  $$('.bubble').forEach((b) => b.classList.add('is-in'))
  if (state.revealed) {
    const r = currentResult()
    appendBot(`Seu laudo está aqui, {nome}. Persona: <strong>${esc(r.persona_titulo)}</strong>. Oferta principal: <strong>${esc(OFERTA_TITULOS[r.oferta.principal])}</strong>.`, STEPS.length + 1)
  } else if (state.cursor < STEPS.length) {
    runFrom(state.cursor, false)
  }
}

// Init ------------------------------------------------------------------------

function init() {
  const had = load()
  $('#laudo').innerHTML = reportTemplate()
  setupTabs()
  setupActions()
  setupTooltips()
  renderPreview()
  const r = currentResult()
  renderReport($('#laudo'), r, { animate: false, trackUnlocks: true })
  lastScores = { ...r.scores }
  updateProgress()
  if (had && state.view === 'flow') { setView('flow'); restore() } else setView('intro')
}

document.addEventListener('DOMContentLoaded', init)
