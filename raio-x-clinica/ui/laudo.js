const EIXOS = [
  { key: 'marca_demanda', label: 'Marca', full: 'Marca' },
  { key: 'captacao', label: 'Captação', full: 'Captação' },
  { key: 'conversao', label: 'Conversão', full: 'Conversão' },
  { key: 'equipe_sistema', label: 'Equipe', full: 'Equipe' },
]

const tone = (n) => (n >= 65 ? '#c6f04a' : n >= 40 ? '#e8a83a' : '#e25b4a')

function polar(cx, cy, r, i, total) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / total
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function drawRadar(svg, scores) {
  const cx = 160
  const cy = 160
  const maxR = 104
  const rings = [0.33, 0.66, 1]
  let ringsG = ''
  rings.forEach((t) => {
    const pts = EIXOS.map((_, i) => polar(cx, cy, maxR * t, i, 4).join(',')).join(' ')
    ringsG += `<polygon points="${pts}" fill="none" stroke="rgba(198,240,74,.16)" stroke-width="1"/>`
  })
  const axes = EIXOS.map((_, i) => {
    const [x, y] = polar(cx, cy, maxR, i, 4)
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(198,240,74,.2)" />`
  }).join('')

  const values = EIXOS.map((e, i) => {
    const v = Math.max(0, Math.min(100, Number(scores[e.key]) || 0))
    return polar(cx, cy, maxR * (v / 100), i, 4)
  })
  const poly = values.map((p) => p.join(',')).join(' ')
  const dots = values
    .map(([x, y], i) => {
      const v = Number(scores[EIXOS[i].key]) || 0
      return `<circle cx="${x}" cy="${y}" r="5" fill="${tone(v)}" />`
    })
    .join('')

  const labels = EIXOS.map((e, i) => {
    const [x, y] = polar(cx, cy, maxR + 28, i, 4)
    const v = Number(scores[e.key]) || 0
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${tone(v)}" font-size="13" font-weight="700" font-family="Outfit,sans-serif">${v}</text>
      <text x="${x}" y="${y + 14}" text-anchor="middle" fill="#8aa090" font-size="9" letter-spacing="1" font-family="Outfit,sans-serif">${e.label.toUpperCase()}</text>`
  }).join('')

  svg.innerHTML = `
    ${ringsG}
    ${axes}
    <polygon points="${poly}" fill="rgba(198,240,74,.18)" stroke="#c6f04a" stroke-width="2"/>
    ${dots}
    ${labels}
  `
}

function renderBars(el, scores) {
  el.innerHTML = EIXOS.map((e) => {
    const v = Number(scores[e.key]) || 0
    return `<div class="bar-row">
      <span>${e.full}</span><strong style="color:${tone(v)}">${v}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${v}%;background:${tone(v)}"></div></div>
    </div>`
  }).join('')
}

function renderBadges(el, earned = [], locked = []) {
  const on = earned.map((b) => `<span class="badge on">✦ ${b}</span>`).join('')
  const off = locked.map((b) => `<span class="badge lock">◌ ${b}</span>`).join('')
  el.innerHTML = on + off || '<span class="badge lock">Nenhuma condecoração ainda</span>'
}

function renderSwot(el, swot = {}) {
  const blocks = [
    ['Forças', 'g', swot.forcas],
    ['Fraquezas', 'r', swot.fraquezas],
    ['Oportunidades', 'g', swot.oportunidades],
    ['Alertas', 'o', swot.alertas],
  ]
  el.innerHTML = blocks
    .map(
      ([title, c, items]) => `
      <div class="swot-card">
        <h3><span class="dot ${c}"></span>${title}</h3>
        <ul>${(items || []).slice(0, 4).map((t) => `<li>${t}</li>`).join('')}</ul>
      </div>`,
    )
    .join('')
}

export function renderLaudo(data) {
  const lead = data.lead || {}
  document.getElementById('report-meta').textContent = [lead.nome, lead.papel, lead.foco]
    .filter(Boolean)
    .join(' · ')
  document.getElementById('persona-title').textContent = data.persona?.titulo || '—'
  document.getElementById('persona-sub').textContent = data.persona?.subtitulo || ''
  drawRadar(document.getElementById('radar'), data.scores || {})
  renderBars(document.getElementById('bars'), data.scores || {})
  renderBadges(document.getElementById('badges'), data.badges_conquistadas, data.badges_bloqueadas)
  renderSwot(document.getElementById('swot'), data.swot)
}

const demo = await fetch('./demo-laudo.json').then((r) => r.json())
renderLaudo(demo)

window.renderLaudo = renderLaudo
