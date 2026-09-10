// Motor do Raio-X da Clínica.
// Respostas do quiz → scores (radar 0–100), subscores, flags, selos, oferta roteada,
// persona sugerida e payload cru pro prompt do laudo.
//
// O LLM NÃO calcula score e NÃO inventa flag. Ele só escreve o laudo em cima de `payload`.

import { QUESTOES, LIKERT_PONTOS } from './questions.js'

// ---------------------------------------------------------------------------
// Pesos
// ---------------------------------------------------------------------------

export const PESOS = {
  preco: { P1: 0.10, P2: 0.20, P3: 0.20, P4: 0.10, P5: 0.05, P6: 0.15, P7: 0.10, P8: 0.10 },
  comercial: { C1: 0.15, C2: 0.20, C3: 0.15, C4: 0.15, C5: 0.10, C6: 0.10, C7: 0.15 },
  captacao: { CAP1: 0.20, CAP2: 0.20, CAP3: 0.25, CAP4: 0.15, CAP5: 0.20 },
  whatsapp: { WA1: 0.25, WA2: 0.15, WA3: 0.30, S5: 0.30 },
  marca_demanda: { P7: 0.35, C7: 0.35, CAP3: 0.30 },
  conversao: { preco: 0.45, comercial: 0.55 },
  equipe_sistema: { whatsapp: 0.45, papel: 0.55 },
}

// Papel comercial: começa em 50 e anda com S1–S6 + quem responde o digital.
export const PAPEL_BASE = 50
export const PAPEL_DELTAS = {
  S1: { recepcao: -20, informar_valores: -20, marcar_avaliacao: 0, vender_protocolo: 20, sou_eu: -5 },
  S2: { sim: 25, so_marca: 0, so_tabela: -20, nao_me_chama: -20 },
  S3: { fixo_sem_comissao: -15, fixo_avaliacao: 0, fixo_protocolo: 15, so_comissao: 5, sou_eu: -5 },
  S4: { ate_800: -15, '800_1500': -10, '1500_3000_var': 10, acima: 15, sou_eu: -5 },
  S5: { ninguem_responde: -10, auto_generica: -5, manda_valor: -10, fluxo_marca: 10, depende: -5 },
  S6: { quer_informacao: -10, precisa_qualificar: 5, vendida_com_processo: 15, nao_pensamos: -10 },
  R5: { dona: -5, secretaria: -10, consultora: 5, varias_sem_dono: -15, automatico: -5 },
}

// S5 entra no eixo WhatsApp como pontuação 0–100.
export const S5_PONTOS = { ninguem_responde: 0, auto_generica: 33, manda_valor: 33, depende: 33, fluxo_marca: 100 }

export const LIMIAR_GAP = 55
export const LIMIAR_OK = 65

export const OFERTAS = ['CONSULTORIA', 'COMERCIAL', 'IA_AUTOMACAO', 'TRAFEGO', 'PACOTE_COMPLETO', 'DIAGNOSTICO_PONTUAL']

export const PERSONAS = {
  rainha_do_conteudo_agenda_oca: 'Rainha do conteúdo, agenda oca',
  clinica_quanto_custa: 'Clínica de “quanto custa?”',
  avaliacao_que_nao_fecha: 'Avaliação que não fecha',
  secretaria_no_front: 'Secretária no front',
  dona_no_plantao_21h: 'Dona no plantão 21h',
  desconto_como_idioma: 'Desconto como idioma',
  indicacao_cansada: 'Indicação cansada',
  fecha_barato_sonha_caro: 'Fecha o barato, sonha o caro',
  ferramenta_sem_metodo: 'Ferramenta sem método',
  pronta_para_o_sistema: 'Pronta para o sistema',
  atendimento_no_lugar_de_venda: 'Atendimento no lugar de venda',
  agenda_cheia_caixa_magro: 'Agenda cheia, caixa magro',
}

// Com qualquer uma destas, TRAFEGO nunca é passo 1.
export const FLAGS_PROIBEM_TRAFEGO = [
  'funcao_comercial_inexistente',
  'vendedora_fantasia',
  'avaliacao_balcao_de_tabela',
  'desconto_habito',
]

const ORCAMENTO_ALTO = ['de_3k_a_8k', 'acima_8k']
const ORCAMENTO_BAIXO = ['ate_1k', 'de_1k_a_3k']

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

function vazio(v) {
  return v === undefined || v === null || v === ''
}

// Valida cada resposta contra o contrato. Resposta inválida vira null e entra em `invalidas`.
export function normalizar(answers = {}) {
  const missing = []
  const invalidas = []
  const a = {
    lead: { ...(answers.lead || {}) },
    roteamento: { ...(answers.roteamento || {}) },
    likert: { ...(answers.likert || {}) },
    categoricas: { ...(answers.categoricas || {}) },
    livres: { ...(answers.livres || {}) },
  }

  for (const grupo of ['lead', 'roteamento']) {
    for (const [id, q] of Object.entries(QUESTOES[grupo])) {
      const v = a[grupo][id]
      if (q.tipo === 'texto') {
        a[grupo][id] = vazio(v) ? '' : String(v)
        continue
      }
      if (q.tipo === 'multi') {
        const arr = Array.isArray(v) ? v : vazio(v) ? [] : [v]
        const ok = arr.filter((x) => x in q.opcoes)
        if (ok.length !== arr.length) invalidas.push(`${grupo}.${id}`)
        if (ok.length === 0 && !q.opcional) missing.push(`${grupo}.${id}`)
        a[grupo][id] = ok.slice(0, q.max || ok.length)
        continue
      }
      if (vazio(v)) {
        a[grupo][id] = null
        if (!q.opcional) missing.push(`${grupo}.${id}`)
      } else if (!(v in q.opcoes)) {
        a[grupo][id] = null
        invalidas.push(`${grupo}.${id}`)
      }
    }
  }

  for (const id of Object.keys(QUESTOES.likert)) {
    const v = a.likert[id]
    if (vazio(v)) {
      a.likert[id] = null
      missing.push(`likert.${id}`)
      continue
    }
    const n = Number(v)
    if (![1, 2, 3, 4].includes(n)) {
      a.likert[id] = null
      invalidas.push(`likert.${id}`)
    } else {
      a.likert[id] = n
    }
  }

  for (const [id, q] of Object.entries(QUESTOES.categoricas)) {
    const v = a.categoricas[id]
    if (vazio(v)) {
      a.categoricas[id] = null
      missing.push(`categoricas.${id}`)
    } else if (!(v in q.opcoes)) {
      a.categoricas[id] = null
      invalidas.push(`categoricas.${id}`)
    }
  }

  for (const id of Object.keys(QUESTOES.livres)) {
    a.livres[id] = vazio(a.livres[id]) ? '' : String(a.livres[id]).trim()
  }

  return { answers: a, missing, invalidas }
}

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

function likertPontos(id, valor) {
  if (valor === null || valor === undefined) return null
  const pts = LIKERT_PONTOS[valor]
  return QUESTOES.likert[id]?.invertida ? 100 - pts : pts
}

// Média ponderada ignorando itens em branco (peso redistribuído). null se nada respondido.
export function mediaPonderada(itens) {
  let soma = 0
  let pesos = 0
  for (const { valor, peso } of itens) {
    if (valor === null || valor === undefined) continue
    soma += valor * peso
    pesos += peso
  }
  return pesos === 0 ? null : soma / pesos
}

function arredondar(x) {
  return x === null ? null : Math.round(x)
}

function clamp(x, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, x))
}

function scoreLikert(pesos, likert) {
  return mediaPonderada(Object.entries(pesos).map(([id, peso]) => ({ valor: likertPontos(id, likert[id]), peso })))
}

export function scorePapelComercial(a) {
  const fontes = { ...a.categoricas, R5: a.roteamento.quem_responde_digital }
  let respondeu = false
  let score = PAPEL_BASE
  for (const [id, deltas] of Object.entries(PAPEL_DELTAS)) {
    const v = fontes[id]
    if (v === null || v === undefined) continue
    if (v in deltas) {
      score += deltas[v]
      respondeu = true
    }
  }
  return respondeu ? clamp(score) : null
}

export function calcularScores(a) {
  const { likert, categoricas } = a

  const preco = scoreLikert(PESOS.preco, likert)
  const comercial = scoreLikert(PESOS.comercial, likert)
  const captacao = scoreLikert(PESOS.captacao, likert)
  const marca_demanda = scoreLikert(PESOS.marca_demanda, likert)

  const whatsapp = mediaPonderada([
    { valor: likertPontos('WA1', likert.WA1), peso: PESOS.whatsapp.WA1 },
    { valor: likertPontos('WA2', likert.WA2), peso: PESOS.whatsapp.WA2 },
    { valor: likertPontos('WA3', likert.WA3), peso: PESOS.whatsapp.WA3 },
    { valor: categoricas.S5 ? S5_PONTOS[categoricas.S5] : null, peso: PESOS.whatsapp.S5 },
  ])

  const papel = scorePapelComercial(a)

  const conversao = mediaPonderada([
    { valor: preco, peso: PESOS.conversao.preco },
    { valor: comercial, peso: PESOS.conversao.comercial },
  ])
  const equipe_sistema = mediaPonderada([
    { valor: whatsapp, peso: PESOS.equipe_sistema.whatsapp },
    { valor: papel, peso: PESOS.equipe_sistema.papel },
  ])

  return {
    scores: {
      marca_demanda: arredondar(marca_demanda),
      captacao: arredondar(captacao),
      conversao: arredondar(conversao),
      equipe_sistema: arredondar(equipe_sistema),
    },
    subscores: {
      preco: arredondar(preco),
      comercial: arredondar(comercial),
      papel_comercial: arredondar(papel),
      whatsapp_operacao: arredondar(whatsapp),
    },
  }
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const baixo = (v) => v !== null && v !== undefined && v <= 2
const alto = (v) => v !== null && v !== undefined && v >= 3
const em = (v, lista) => lista.includes(v)

export function detectarFlags(a, scores, subscores) {
  const f = new Set()
  const { likert: L, categoricas: S, roteamento: R } = a

  // --- Preço
  if (baixo(L.P3)) f.add('desconto_habito')
  if (baixo(L.P2)) f.add('preco_por_concorrente')
  if (baixo(L.P1)) f.add('nao_sabe_custo_do_protocolo')
  if (baixo(L.P4)) f.add('vende_sessao_nao_protocolo')
  if (baixo(L.P6)) f.add('avaliacao_balcao_de_tabela')
  if (baixo(L.P7)) f.add('preco_no_instagram_sem_qualificar')
  if (baixo(L.P8)) f.add('caixa_confundido_com_receita')

  // --- Comercial / papel
  const funcaoInexistente =
    em(S.S1, ['recepcao', 'informar_valores']) &&
    em(S.S2, ['so_tabela', 'nao_me_chama']) &&
    S.S3 === 'fixo_sem_comissao' &&
    em(S.S4, ['ate_800', '800_1500'])
  if (funcaoInexistente) f.add('funcao_comercial_inexistente')

  const vendedoraFantasia =
    R.quem_responde_digital === 'secretaria' &&
    S.S4 === 'ate_800' &&
    L.C2 === 1 &&
    em(R.agenda, ['folgada', 'cheia_avaliacao_pouco_fecha'])
  if (vendedoraFantasia) f.add('vendedora_fantasia')

  if (R.quem_responde_digital === 'secretaria' && (S.S1 === 'informar_valores' || S.S2 === 'so_tabela')) {
    f.add('secretaria_informa_preco')
  }
  if (S.S2 !== null && S.S2 !== 'sim') f.add('closer_inexistente')
  if (S.S1 === 'sou_eu' || S.S3 === 'sou_eu' || S.S4 === 'sou_eu' || R.quem_responde_digital === 'dona') {
    f.add('dona_e_o_comercial')
  }
  if (S.S3 === 'fixo_sem_comissao') f.add('remuneracao_sem_comissao')
  if (em(S.S4, ['ate_800', '800_1500'])) f.add('salario_comercial_abaixo_1500')
  if (R.quem_responde_digital === 'varias_sem_dono') f.add('papel_digital_sem_dono')

  // --- Operação WhatsApp
  if (em(S.S5, ['ninguem_responde', 'manda_valor']) || baixo(L.CAP5)) f.add('lead_21h_morto')
  if (baixo(L.C3) || baixo(L.WA3)) f.add('followup_inexistente')
  if (R.quem_responde_digital === 'varias_sem_dono' || baixo(L.WA1)) f.add('whatsapp_sem_dono')
  if (S.WA4 === 'sim' || (R.quem_responde_digital === 'automatico' && em(S.S5, ['manda_valor', 'auto_generica']))) {
    f.add('bot_que_so_manda_tabela')
  }
  if (baixo(L.WA2)) f.add('historico_se_perde_no_celular')

  // --- Captação
  if (scores.captacao !== null && scores.captacao < LIMIAR_GAP) f.add('gap_captacao')
  if (alto(L.CAP1)) f.add('depende_de_postar')
  if (baixo(L.CAP2)) f.add('nao_sabe_origem_do_paciente')
  if (baixo(L.CAP4)) f.add('indicacao_nao_sistematizada')
  if (baixo(L.CAP3)) f.add('conteudo_sem_proximo_passo')

  // --- Conversão
  if ((scores.conversao !== null && scores.conversao < LIMIAR_GAP) || funcaoInexistente) f.add('gap_comercial')
  if (baixo(L.C2)) f.add('nao_mede_taxa_de_fechamento')
  if (baixo(L.C1) || baixo(L.C4)) f.add('avaliacao_sem_roteiro')
  if (baixo(L.C5)) f.add('profissional_e_venda_misturados')
  if (baixo(L.C6)) f.add('no_show_ignorado')
  if (baixo(L.C7)) f.add('mensagem_anuncio_diferente_da_recepcao')

  // --- Contexto
  const agendaFlag = {
    folgada: 'agenda_folgada',
    oscila: 'agenda_oscila',
    cheia_avaliacao_pouco_fecha: 'cheia_de_avaliacao_pouco_fechamento',
    cheia_caixa_nao_reflete: 'cheia_caixa_nao_reflete',
    cheia_no_limite: 'dona_no_limite',
  }[R.agenda]
  if (agendaFlag) f.add(agendaFlag)

  const orcFlag = {
    ate_1k: 'orcamento_ate_1k',
    de_1k_a_3k: 'orcamento_1k_3k',
    de_3k_a_8k: 'orcamento_3k_8k',
    acima_8k: 'orcamento_acima_8k',
    quer_entender_antes: 'quer_entender_antes',
  }[R.orcamento]
  if (orcFlag) f.add(orcFlag)

  return [...f]
}

// ---------------------------------------------------------------------------
// Gaps derivados (usados pelo roteador)
// ---------------------------------------------------------------------------

export function derivarGaps(a, scores, subscores, flags) {
  const has = (x) => flags.includes(x)
  const problemas = a.roteamento.problemas || []

  const gap_preco = has('preco_por_concorrente') || has('desconto_habito') || has('avaliacao_balcao_de_tabela')
  const fechaBarato = a.roteamento.agenda === 'cheia_caixa_nao_reflete' || problemas.includes('fecha_barato')
  const precoFlags = ['desconto_habito', 'preco_por_concorrente', 'avaliacao_balcao_de_tabela'].filter(has).length
  const gap_preco_grave = precoFlags >= 2 || (has('desconto_habito') && fechaBarato)
  const naoChegaNinguem = a.roteamento.agenda === 'folgada' || problemas.includes('pouca_gente')

  return {
    gap_captacao: has('gap_captacao'),
    gap_comercial: has('gap_comercial'),
    gap_preco,
    gap_preco_grave,
    gap_whatsapp: has('lead_21h_morto') || has('followup_inexistente') || has('whatsapp_sem_dono'),
    fecha_barato: fechaBarato,
    nao_chega_ninguem: naoChegaNinguem,
    eixos_abaixo_55: Object.values(scores).filter((s) => s !== null && s < LIMIAR_GAP).length,
    papel_ok: subscores.papel_comercial !== null && subscores.papel_comercial >= LIMIAR_OK && !has('funcao_comercial_inexistente'),
  }
}

// ---------------------------------------------------------------------------
// Selos
// ---------------------------------------------------------------------------

export function calcularSelos(a, subscores, flags) {
  const has = (x) => flags.includes(x)
  const S = a.categoricas
  const R5 = a.roteamento.quem_responde_digital

  let selo_preco
  if (has('desconto_habito')) selo_preco = 'desconto_como_habito'
  else if (has('preco_por_concorrente') || has('avaliacao_balcao_de_tabela') || (subscores.preco !== null && subscores.preco < LIMIAR_OK)) {
    selo_preco = 'tabela_fragil'
  } else selo_preco = 'preco_no_controle'

  let selo_papel
  if (has('funcao_comercial_inexistente') || has('vendedora_fantasia')) selo_papel = 'funcao_ausente'
  else if (S.S2 === 'sim' && em(S.S1, ['vender_protocolo', 'marcar_avaliacao'])) selo_papel = 'closer_existente'
  else if (S.S1 === 'sou_eu' || R5 === 'dona') selo_papel = 'dona_vende'
  else if (em(R5, ['secretaria', 'consultora']) || em(S.S1, ['recepcao', 'informar_valores'])) selo_papel = 'secretaria_no_comercial'
  else if (has('closer_inexistente')) selo_papel = 'funcao_ausente'
  else selo_papel = 'closer_existente'

  return { selo_preco, selo_papel }
}

// ---------------------------------------------------------------------------
// Roteamento
// ---------------------------------------------------------------------------

const COPY = {
  PACOTE_COMPLETO: 'Vocês estão pagando para um funil que a recepção não consegue virar venda.',
  COMERCIAL: 'Não falta paciente. Falta conversa que fecha.',
  IA_AUTOMACAO: "O ralo é o intervalo entre o 'oi' e a avaliação.",
  TRAFEGO: 'O comercial aguenta volume. Agora falta volume certo.',
  CONSULTORIA: 'Anúncio em cima de preço frágil só treina o mercado a pechinchar.',
  DIAGNOSTICO_PONTUAL: 'Antes de comprar sistema, vale fechar o ralo que já dá pra ver — e medir três números.',
}

const NAO_FAZER = {
  PACOTE_COMPLETO: 'Não aumentar anúncio isolado. Não contratar mais uma secretária para "informar valores".',
  COMERCIAL: 'Não colocar anúncio em cima do processo atual. Não delegar o fechamento para quem só manda tabela.',
  IA_AUTOMACAO: 'Não instalar bot de tabela. Não subir verba de anúncio antes do fluxo segurar o lead.',
  TRAFEGO: 'Não anunciar "resultado bonito" sem oferta e próximo passo. Não mudar o roteiro que já fecha.',
  CONSULTORIA: 'Não anunciar agora: multiplica "quanto custa?" em cima de preço frágil. Não criar promoção para "girar".',
  DIAGNOSTICO_PONTUAL: 'Não contratar pacote nem tráfego. Não trocar de ferramenta antes de medir.',
}

const FASE_2 = {
  PACOTE_COMPLETO: 'Com roteiro rodando e IA cobrindo o fora de hora, escalar verba com oferta de conversão.',
  COMERCIAL: 'Depois que a taxa de fechamento estiver medida e estável, tráfego de conversão para dar volume.',
  IA_AUTOMACAO: 'Tráfego de conversão só quando o fluxo estiver qualificando e marcando sem despachar tabela.',
  TRAFEGO: 'Com volume entrando, IA no fora de hora e follow-up automático para não perder o que o anúncio traz.',
  CONSULTORIA: 'Com tabela, protocolo e regra de desconto prontos, processo comercial e depois tráfego.',
  DIAGNOSTICO_PONTUAL: 'Com os três números na mão, decidir entre IA avulsa, comercial ou pacote.',
}

export function rotear(a, scores, subscores, flags, gaps) {
  const has = (x) => flags.includes(x)
  const orc = a.roteamento.orcamento
  const trafego_proibido_passo_1 = FLAGS_PROIBEM_TRAFEGO.some(has)
  const funcaoQuebrada = has('funcao_comercial_inexistente') || has('vendedora_fantasia')
  const whatsappRalo = has('lead_21h_morto') || has('followup_inexistente') || has('whatsapp_sem_dono')

  let principal = null
  let complementar = null
  let regra = null

  // Regra 1 — sem função comercial + sem captação + fôlego pra investir
  if (funcaoQuebrada && gaps.gap_captacao && em(orc, ORCAMENTO_ALTO)) {
    principal = 'PACOTE_COMPLETO'
    regra = 1
  }
  // Regra 2 — preço frágil + fecha barato + não é caso de "não chega ninguém"
  else if (
    (has('desconto_habito') || has('preco_por_concorrente') || has('avaliacao_balcao_de_tabela')) &&
    gaps.fecha_barato &&
    !gaps.nao_chega_ninguem
  ) {
    principal = 'CONSULTORIA'
    complementar = gaps.gap_comercial ? 'COMERCIAL' : null
    regra = 2
  }
  // Regra 3 — comercial quebrado, captação ok
  else if (gaps.gap_comercial && !gaps.gap_captacao) {
    principal = 'COMERCIAL'
    complementar = has('lead_21h_morto') || has('followup_inexistente') ? 'IA_AUTOMACAO' : null
    regra = 3
  }
  // Regra 4 — ralo no WhatsApp + orçamento baixo
  else if (
    whatsappRalo &&
    em(orc, ORCAMENTO_BAIXO) &&
    !(gaps.gap_preco_grave && has('funcao_comercial_inexistente'))
  ) {
    principal = 'IA_AUTOMACAO'
    regra = 4
  }
  // Regra 5 — falta volume, comercial aguenta (tráfego não cabe em até R$ 1k/mês)
  else if (
    gaps.gap_captacao &&
    scores.conversao !== null &&
    scores.conversao >= LIMIAR_OK &&
    !trafego_proibido_passo_1 &&
    orc !== 'ate_1k'
  ) {
    principal = 'TRAFEGO'
    complementar = has('lead_21h_morto') ? 'IA_AUTOMACAO' : null
    regra = 5
  }
  // Regra 6 — orçamento até 1k e o caso não cabe em IA
  else if (orc === 'ate_1k') {
    principal = 'DIAGNOSTICO_PONTUAL'
    regra = 6
  }
  // Regra 7 — 2+ eixos abaixo de 55 com fôlego
  else if (gaps.eixos_abaixo_55 >= 2 && em(orc, ORCAMENTO_ALTO)) {
    principal = 'PACOTE_COMPLETO'
    regra = 7
  }
  // Fallback — nenhuma regra bateu. Nunca tráfego quando papel/preço estão quebrados.
  else if (gaps.gap_comercial) {
    principal = 'COMERCIAL'
    complementar = whatsappRalo ? 'IA_AUTOMACAO' : null
    regra = 'fallback_comercial'
  } else if (gaps.gap_captacao) {
    principal = trafego_proibido_passo_1 ? 'COMERCIAL' : 'TRAFEGO'
    complementar = has('lead_21h_morto') ? 'IA_AUTOMACAO' : null
    regra = 'fallback_captacao'
  } else if (whatsappRalo) {
    principal = 'IA_AUTOMACAO'
    regra = 'fallback_whatsapp'
  } else if (gaps.gap_preco) {
    principal = 'CONSULTORIA'
    regra = 'fallback_preco'
  } else if (orc === 'quer_entender_antes' || orc === null) {
    principal = 'DIAGNOSTICO_PONTUAL'
    regra = 'fallback_sem_gap_sem_orcamento'
  } else {
    principal = trafego_proibido_passo_1 ? 'COMERCIAL' : 'TRAFEGO'
    regra = 'fallback_sem_gap'
  }

  // Trava dura: o código decide, o modelo não reabre.
  if (principal === 'TRAFEGO' && trafego_proibido_passo_1) {
    principal = 'COMERCIAL'
    regra = `${regra}+trava_trafego`
  }

  return {
    principal,
    complementar,
    regra,
    trafego_proibido_passo_1,
    copy_gancho: COPY[principal],
    o_que_nao_fazer_agora: NAO_FAZER[principal],
    fase_2: FASE_2[principal],
  }
}

// ---------------------------------------------------------------------------
// Persona
// ---------------------------------------------------------------------------

export function sugerirPersona(a, scores, flags, gaps, oferta) {
  const has = (x) => flags.includes(x)
  const R = a.roteamento
  const L = a.livres
  const problemas = R.problemas || []
  const semGap = Object.values(scores).every((s) => s === null || s >= LIMIAR_GAP)

  if (has('funcao_comercial_inexistente') || has('vendedora_fantasia')) return 'atendimento_no_lugar_de_venda'
  if (has('bot_que_so_manda_tabela')) return 'ferramenta_sem_metodo'
  if (has('desconto_habito') && gaps.fecha_barato) return 'desconto_como_idioma'
  if (R.agenda === 'cheia_caixa_nao_reflete') return 'agenda_cheia_caixa_magro'
  if (
    L.procedimento_mais_vende &&
    L.procedimento_quer_vender &&
    L.procedimento_mais_vende.toLowerCase() !== L.procedimento_quer_vender.toLowerCase() &&
    (problemas.includes('fecha_barato') || has('desconto_habito') || has('vende_sessao_nao_protocolo'))
  ) {
    return 'fecha_barato_sonha_caro'
  }
  if (R.quem_responde_digital === 'secretaria' && has('closer_inexistente')) return 'secretaria_no_front'
  if (R.quem_responde_digital === 'dona' && (has('lead_21h_morto') || has('dona_no_limite'))) return 'dona_no_plantao_21h'
  if (has('preco_no_instagram_sem_qualificar') && (problemas.includes('nao_fecha') || R.agenda === 'folgada')) return 'clinica_quanto_custa'
  if (R.agenda === 'cheia_avaliacao_pouco_fecha' || (!gaps.gap_captacao && gaps.gap_comercial)) return 'avaliacao_que_nao_fecha'
  if (gaps.gap_captacao && has('depende_de_postar')) return 'rainha_do_conteudo_agenda_oca'
  if (gaps.gap_captacao && has('indicacao_nao_sistematizada')) return 'indicacao_cansada'
  if (gaps.gap_captacao) return 'rainha_do_conteudo_agenda_oca'
  if (oferta.principal === 'PACOTE_COMPLETO' || semGap) return 'pronta_para_o_sistema'
  return 'avaliacao_que_nao_fecha'
}

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

export function avaliar(answersBrutas) {
  const { answers: a, missing, invalidas } = normalizar(answersBrutas)
  const { scores, subscores } = calcularScores(a)
  const flags = detectarFlags(a, scores, subscores)
  const gaps = derivarGaps(a, scores, subscores, flags)
  const selos = calcularSelos(a, subscores, flags)
  const oferta = rotear(a, scores, subscores, flags, gaps)
  const persona_sugerida = sugerirPersona(a, scores, flags, gaps, oferta)

  const payload = {
    lead: {
      nome: a.lead.nome,
      papel: a.lead.papel,
      foco: a.lead.foco,
      porte: a.lead.porte,
      objetivo: a.lead.objetivo,
    },
    roteamento: {
      agenda: a.roteamento.agenda,
      problemas: a.roteamento.problemas,
      quem_responde_digital: a.roteamento.quem_responde_digital,
      orcamento: a.roteamento.orcamento,
    },
    scores,
    subscores: {
      preco: subscores.preco,
      papel_comercial: subscores.papel_comercial,
      whatsapp_operacao: subscores.whatsapp_operacao,
    },
    flags,
    respostas_chave: {
      quem_foi_contratada_para: a.categoricas.S1,
      fecha_sozinha_ticket_alto: a.categoricas.S2,
      remuneracao: a.categoricas.S3,
      faixa_remuneracao: a.categoricas.S4,
      lead_21h: a.categoricas.S5,
      procedimento_mais_vende: a.livres.procedimento_mais_vende,
      procedimento_quer_vender: a.livres.procedimento_quer_vender,
    },
    notas_livres: a.livres.notas_livres,
    // Decisão do motor. O prompt do laudo usa isto e não recalcula.
    motor: {
      oferta_principal: oferta.principal,
      oferta_complementar: oferta.complementar,
      regra: oferta.regra,
      trafego_proibido_passo_1: oferta.trafego_proibido_passo_1,
      persona_sugerida,
      persona_titulo: PERSONAS[persona_sugerida],
      selo_preco: selos.selo_preco,
      selo_papel: selos.selo_papel,
    },
  }

  return {
    payload,
    scores,
    subscores,
    flags,
    gaps,
    selos,
    oferta,
    persona_sugerida,
    persona_titulo: PERSONAS[persona_sugerida],
    missing,
    invalidas,
  }
}

// Checagem de saída do LLM: o laudo não pode contrariar o motor.
export function validarLaudo(laudo, resultado) {
  const erros = []
  if (!laudo || typeof laudo !== 'object') return ['laudo não é objeto']
  if (laudo.oferta?.principal !== resultado.oferta.principal) {
    erros.push(`oferta.principal deveria ser ${resultado.oferta.principal}, veio ${laudo.oferta?.principal}`)
  }
  if (laudo.oferta?.principal === 'TRAFEGO' && resultado.oferta.trafego_proibido_passo_1) {
    erros.push('TRAFEGO como passo 1 com flag que proíbe tráfego')
  }
  if (laudo.persona?.id && !(laudo.persona.id in PERSONAS)) {
    erros.push(`persona desconhecida: ${laudo.persona.id}`)
  }
  if (laudo.persona?.id && laudo.persona.titulo !== PERSONAS[laudo.persona.id]) {
    erros.push(`título da persona diferente do canônico: ${laudo.persona.titulo}`)
  }
  if (laudo.selo_preco && laudo.selo_preco !== resultado.selos.selo_preco) {
    erros.push(`selo_preco deveria ser ${resultado.selos.selo_preco}`)
  }
  if (laudo.selo_papel && laudo.selo_papel !== resultado.selos.selo_papel) {
    erros.push(`selo_papel deveria ser ${resultado.selos.selo_papel}`)
  }
  return erros
}
