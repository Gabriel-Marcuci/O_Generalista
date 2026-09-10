import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  avaliar,
  mediaPonderada,
  normalizar,
  validarLaudo,
  PESOS,
  FLAGS_PROIBEM_TRAFEGO,
  PERSONAS,
  LIMIAR_GAP,
} from './score.js'
import { QUESTOES, answersVazio, LIKERT_PONTOS } from './questions.js'
import { exemploSecretariaR500 } from './exemplo.secretaria-r500.js'

// -- helpers ---------------------------------------------------------------

function todosLikert(valor) {
  return Object.fromEntries(Object.keys(QUESTOES.likert).map((k) => [k, valor]))
}

function base(overrides = {}) {
  const a = answersVazio()
  a.lead = { nome: 'Teste', papel: 'dona_atende', foco: 'facial', porte: null, objetivo: null }
  a.roteamento = { agenda: 'oscila', problemas: [], quem_responde_digital: 'dona', orcamento: 'de_1k_a_3k' }
  a.likert = todosLikert(3)
  a.categoricas = { S1: 'sou_eu', S2: 'sim', S3: 'sou_eu', S4: 'sou_eu', S5: 'depende', S6: 'precisa_qualificar', WA4: 'nao' }
  return {
    ...a,
    ...overrides,
    lead: { ...a.lead, ...(overrides.lead || {}) },
    roteamento: { ...a.roteamento, ...(overrides.roteamento || {}) },
    likert: { ...a.likert, ...(overrides.likert || {}) },
    categoricas: { ...a.categoricas, ...(overrides.categoricas || {}) },
    livres: { ...a.livres, ...(overrides.livres || {}) },
  }
}

// -- contrato --------------------------------------------------------------

test('pesos de cada bloco somam 1', () => {
  for (const [bloco, pesos] of Object.entries(PESOS)) {
    const soma = Object.values(pesos).reduce((s, p) => s + p, 0)
    assert.ok(Math.abs(soma - 1) < 1e-9, `${bloco} soma ${soma}`)
  }
})

test('Likert 1–4 vira 0 / 33 / 67 / 100', () => {
  assert.deepEqual(LIKERT_PONTOS, { 1: 0, 2: 33, 3: 67, 4: 100 })
})

test('media ponderada ignora item em branco e redistribui o peso', () => {
  assert.equal(mediaPonderada([{ valor: 100, peso: 0.2 }, { valor: null, peso: 0.8 }]), 100)
  assert.equal(mediaPonderada([{ valor: 0, peso: 0.5 }, { valor: 100, peso: 0.5 }]), 50)
  assert.equal(mediaPonderada([{ valor: null, peso: 1 }]), null)
})

test('normalizar lista pergunta sem resposta e valor inválido', () => {
  const a = answersVazio()
  a.likert.P1 = 7
  a.categoricas.S1 = 'estagiaria'
  const { missing, invalidas } = normalizar(a)
  assert.ok(missing.includes('roteamento.agenda'))
  assert.ok(missing.includes('likert.P2'))
  assert.ok(invalidas.includes('likert.P1'))
  assert.ok(invalidas.includes('categoricas.S1'))
})

test('normalizar corta problemas em 2', () => {
  const a = base({ roteamento: { problemas: ['pouca_gente', 'nao_fecha', 'fecha_barato'] } })
  assert.equal(normalizar(a).answers.roteamento.problemas.length, 2)
})

test('quiz vazio não quebra: scores nulos, oferta definida', () => {
  const r = avaliar(answersVazio())
  assert.equal(r.scores.conversao, null)
  assert.ok(r.oferta.principal)
  assert.ok(r.missing.length > 0)
})

// -- fixture: secretária de R$ 500 -----------------------------------------

test('fixture secretária R$ 500: PACOTE_COMPLETO pela regra 1, tráfego proibido', () => {
  const r = avaliar(exemploSecretariaR500)

  assert.deepEqual(r.missing, [])
  assert.deepEqual(r.invalidas, [])

  for (const [eixo, s] of Object.entries(r.scores)) {
    assert.ok(s < LIMIAR_GAP, `${eixo}=${s} deveria estar abaixo de ${LIMIAR_GAP}`)
  }
  assert.equal(r.subscores.papel_comercial, 0)

  assert.ok(r.flags.includes('funcao_comercial_inexistente'))
  assert.ok(r.flags.includes('vendedora_fantasia'))
  assert.ok(r.flags.includes('secretaria_informa_preco'))
  assert.ok(r.flags.includes('desconto_habito'))
  assert.ok(r.flags.includes('preco_por_concorrente'))
  assert.ok(r.flags.includes('lead_21h_morto'))
  assert.ok(r.flags.includes('followup_inexistente'))
  assert.ok(r.flags.includes('gap_captacao'))
  assert.ok(r.flags.includes('gap_comercial'))
  assert.ok(r.flags.includes('orcamento_3k_8k'))

  assert.equal(r.selos.selo_preco, 'desconto_como_habito')
  assert.equal(r.selos.selo_papel, 'funcao_ausente')
  assert.equal(r.persona_sugerida, 'atendimento_no_lugar_de_venda')
  assert.equal(r.persona_titulo, 'Atendimento no lugar de venda')

  assert.equal(r.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(r.oferta.complementar, null)
  assert.equal(r.oferta.regra, 1)
  assert.equal(r.oferta.trafego_proibido_passo_1, true)

  assert.equal(r.payload.motor.oferta_principal, 'PACOTE_COMPLETO')
  assert.equal(r.payload.respostas_chave.faixa_remuneracao, 'ate_800')
})

test('papel comercial: closer com comissão de protocolo vai a 100', () => {
  const r = avaliar(base({
    roteamento: { quem_responde_digital: 'consultora' },
    categoricas: { S1: 'vender_protocolo', S2: 'sim', S3: 'fixo_protocolo', S4: '1500_3000_var', S5: 'fluxo_marca', S6: 'vendida_com_processo' },
  }))
  assert.equal(r.subscores.papel_comercial, 100)
  assert.equal(r.selos.selo_papel, 'closer_existente')
  assert.ok(!r.flags.includes('closer_inexistente'))
})

// -- roteamento ------------------------------------------------------------

test('regra 2: desconto + caixa não reflete → CONSULTORIA, tráfego proibido', () => {
  const r = avaliar(base({
    roteamento: { agenda: 'cheia_caixa_nao_reflete', problemas: ['fecha_barato'], orcamento: 'de_3k_a_8k' },
    likert: { P2: 1, P3: 1 },
  }))
  assert.equal(r.oferta.principal, 'CONSULTORIA')
  assert.equal(r.oferta.regra, 2)
  assert.equal(r.oferta.trafego_proibido_passo_1, true)
  assert.equal(r.persona_sugerida, 'desconto_como_idioma')
  assert.equal(r.selos.selo_preco, 'desconto_como_habito')
})

test('regra 3: comercial quebrado, captação ok → COMERCIAL (+ IA se follow-up morto)', () => {
  const r = avaliar(base({
    roteamento: { agenda: 'cheia_avaliacao_pouco_fecha', problemas: ['nao_fecha'] },
    likert: {
      C1: 1, C2: 1, C3: 1, C4: 1, C5: 1, C6: 1, C7: 3,
      P1: 3, P2: 3, P3: 3, P4: 3, P5: 3, P6: 3, P7: 3, P8: 3,
      CAP1: 1, CAP2: 4, CAP3: 4, CAP4: 4, CAP5: 4,
    },
    categoricas: { S2: 'nao_me_chama' },
  }))
  assert.ok(!r.flags.includes('gap_captacao'))
  assert.ok(r.flags.includes('gap_comercial'))
  assert.equal(r.oferta.principal, 'COMERCIAL')
  assert.equal(r.oferta.complementar, 'IA_AUTOMACAO')
  assert.equal(r.oferta.regra, 3)
  assert.equal(r.persona_sugerida, 'avaliacao_que_nao_fecha')
})

test('regra 4: lead 21h morto + orçamento baixo → só IA', () => {
  const r = avaliar(base({
    roteamento: { orcamento: 'de_1k_a_3k', quem_responde_digital: 'dona' },
    likert: { ...todosLikert(3), C3: 3, WA3: 3 },
    categoricas: { S5: 'ninguem_responde' },
  }))
  assert.ok(r.flags.includes('lead_21h_morto'))
  assert.equal(r.oferta.principal, 'IA_AUTOMACAO')
  assert.equal(r.oferta.complementar, null)
  assert.equal(r.oferta.regra, 4)
  assert.equal(r.persona_sugerida, 'dona_no_plantao_21h')
})

test('regra 5: captação baixa, conversão ≥ 65, papel ok → TRAFEGO', () => {
  const r = avaliar(base({
    roteamento: { agenda: 'folgada', problemas: ['pouca_gente'], orcamento: 'de_3k_a_8k', quem_responde_digital: 'consultora' },
    likert: { ...todosLikert(4), CAP1: 4, CAP2: 1, CAP3: 1, CAP4: 1, CAP5: 3 },
    categoricas: { S1: 'vender_protocolo', S2: 'sim', S3: 'fixo_protocolo', S4: '1500_3000_var', S5: 'fluxo_marca', S6: 'vendida_com_processo' },
  }))
  assert.ok(r.flags.includes('gap_captacao'))
  assert.ok(r.scores.conversao >= 65)
  assert.equal(r.oferta.principal, 'TRAFEGO')
  assert.equal(r.oferta.regra, 5)
  assert.equal(r.oferta.trafego_proibido_passo_1, false)
  assert.equal(r.persona_sugerida, 'rainha_do_conteudo_agenda_oca')
})

test('regra 6: até 1k sem ralo de WhatsApp → DIAGNOSTICO_PONTUAL', () => {
  const r = avaliar(base({
    roteamento: { orcamento: 'ate_1k', agenda: 'folgada', problemas: ['pouca_gente'] },
    likert: { ...todosLikert(3), CAP2: 1, CAP3: 1, CAP4: 1 },
    categoricas: { S5: 'fluxo_marca' },
  }))
  assert.equal(r.oferta.principal, 'DIAGNOSTICO_PONTUAL')
  assert.equal(r.oferta.regra, 6)
})

test('regra 7: dois eixos abaixo de 55 com fôlego, sem flag de função → PACOTE_COMPLETO', () => {
  const r = avaliar(base({
    roteamento: { orcamento: 'acima_8k', agenda: 'oscila', problemas: ['pouca_gente', 'nao_fecha'], quem_responde_digital: 'consultora' },
    likert: { ...todosLikert(2), P3: 3, P6: 3, C3: 3, WA1: 3, WA3: 3, CAP5: 3 },
    categoricas: { S1: 'marcar_avaliacao', S2: 'so_marca', S3: 'fixo_avaliacao', S4: '1500_3000_var', S5: 'fluxo_marca', S6: 'precisa_qualificar' },
  }))
  assert.ok(!r.flags.includes('funcao_comercial_inexistente'))
  assert.ok(r.gaps.eixos_abaixo_55 >= 2)
  assert.equal(r.oferta.principal, 'PACOTE_COMPLETO')
  assert.equal(r.oferta.regra, 7)
})

test('nunca TRAFEGO como passo 1 com flag que proíbe tráfego', () => {
  // Captação baixa, conversão alta, mas P6 = avaliação balcão de tabela.
  const r = avaliar(base({
    roteamento: { agenda: 'folgada', problemas: ['pouca_gente'], orcamento: 'de_3k_a_8k', quem_responde_digital: 'consultora' },
    likert: { ...todosLikert(4), P6: 1, CAP2: 1, CAP3: 1, CAP4: 1 },
    categoricas: { S1: 'vender_protocolo', S2: 'sim', S3: 'fixo_protocolo', S4: '1500_3000_var', S5: 'fluxo_marca', S6: 'vendida_com_processo' },
  }))
  assert.ok(r.flags.includes('avaliacao_balcao_de_tabela'))
  assert.equal(r.oferta.trafego_proibido_passo_1, true)
  assert.notEqual(r.oferta.principal, 'TRAFEGO')
})

test('flag bot de tabela → persona ferramenta_sem_metodo', () => {
  const r = avaliar(base({ categoricas: { WA4: 'sim' }, likert: { ...todosLikert(3), P3: 3 } }))
  assert.ok(r.flags.includes('bot_que_so_manda_tabela'))
  assert.equal(r.persona_sugerida, 'ferramenta_sem_metodo')
})

test('mais vende ≠ quer vender + fecha barato → fecha_barato_sonha_caro', () => {
  const r = avaliar(base({
    roteamento: { agenda: 'oscila', problemas: ['fecha_barato'], orcamento: 'de_1k_a_3k' },
    likert: { ...todosLikert(3), P3: 3, P4: 1 },
    livres: { procedimento_mais_vende: 'peeling', procedimento_quer_vender: 'HOF' },
  }))
  assert.equal(r.persona_sugerida, 'fecha_barato_sonha_caro')
})

test('item em branco redistribui peso em vez de zerar o eixo', () => {
  const completo = avaliar(base({ likert: { ...todosLikert(4) } }))
  const semP5 = avaliar(base({ likert: { ...todosLikert(4), P5: null } }))
  assert.equal(completo.subscores.preco, 100)
  assert.equal(semP5.subscores.preco, 100)
  assert.ok(semP5.missing.includes('likert.P5'))
})

test('personas do motor batem com os títulos canônicos do prompt', () => {
  assert.equal(Object.keys(PERSONAS).length, 12)
  assert.equal(PERSONAS.clinica_quanto_custa, 'Clínica de “quanto custa?”')
})

test('validarLaudo pega TRAFEGO indevido e persona errada', () => {
  const r = avaliar(exemploSecretariaR500)
  const errado = { oferta: { principal: 'TRAFEGO' }, persona: { id: 'guru', titulo: 'x' } }
  const erros = validarLaudo(errado, r)
  assert.ok(erros.some((e) => e.includes('TRAFEGO')))
  assert.ok(erros.some((e) => e.includes('persona desconhecida')))

  const certo = {
    oferta: { principal: 'PACOTE_COMPLETO' },
    persona: { id: 'atendimento_no_lugar_de_venda', titulo: 'Atendimento no lugar de venda' },
    selo_preco: 'desconto_como_habito',
    selo_papel: 'funcao_ausente',
  }
  assert.deepEqual(validarLaudo(certo, r), [])
})

test('FLAGS_PROIBEM_TRAFEGO é a lista do prompt', () => {
  assert.deepEqual(FLAGS_PROIBEM_TRAFEGO, [
    'funcao_comercial_inexistente',
    'vendedora_fantasia',
    'avaliacao_balcao_de_tabela',
    'desconto_habito',
  ])
})
