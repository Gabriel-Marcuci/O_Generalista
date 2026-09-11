// Conteúdo do Raio-X da Clínica: ordem das perguntas no chat, mensagens do guia,
// condecorações, personas, SWOT e notas por eixo.
// O motor (lib/score.js) decide score, flags e oferta. Aqui só mora texto e sequência.

import { QUESTOES } from '../../lib/questions.js'
import { PERSONAS, LIMIAR_GAP, LIMIAR_OK } from '../../lib/score.js'

// Ajuste aqui. WhatsApp em branco = o botão de contato não aparece.
export const CONFIG = {
  guia: 'Gabriel',
  guiaIniciais: 'G',
  marca: 'Raio-X da Clínica',
  whatsapp: '', // ex: '5511999999999'
  duracao: '8 minutos',
}

export const SECOES = {
  perfil: 'Perfil',
  agenda: 'Agenda e problema',
  preco: 'Preço',
  comercial: 'Comercial',
  captacao: 'Captação',
  whatsapp: 'WhatsApp',
  papel: 'Quem vende',
  extra: 'Bônus',
}

export const LIKERT_OPCOES = [
  { valor: 1, label: 'Não acontece / não sei' },
  { valor: 2, label: 'Às vezes, no improviso' },
  { valor: 3, label: 'Acontece, mas sem controle' },
  { valor: 4, label: 'É regra da clínica' },
]

const ICON = {
  marca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 15.7 7 18.4l1.1-5.6L4 8.9l5.6-.7z"/></svg>',
  captacao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>',
  conversao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/></svg>',
  equipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 13.6c3 0 5.5 2.4 5.5 5.4"/></svg>',
}

export const EIXOS = [
  { id: 'marca_demanda', label: 'Marca', radar: 'MARCA', longo: 'Marca e demanda', icon: ICON.marca },
  { id: 'captacao', label: 'Captação', radar: 'CAPTAÇÃO', longo: 'Captação', icon: ICON.captacao },
  { id: 'conversao', label: 'Conversão', radar: 'CONVERSÃO', longo: 'Conversão comercial', icon: ICON.conversao },
  { id: 'equipe_sistema', label: 'Equipe', radar: 'EQUIPE', longo: 'Equipe e sistema', icon: ICON.equipe },
]

// Faixas semafóricas alinhadas aos limiares do motor (55 = gap, 65 = ok).
export function faixa(score) {
  if (score === null || score === undefined) return 'none'
  if (score >= LIMIAR_OK) return 'top'
  if (score >= LIMIAR_GAP) return 'good'
  if (score >= 40) return 'mid'
  return 'low'
}

// As cores das faixas vivem no CSS (cada tema define as suas). O JS só lê.
const COR_PADRAO = { top: '#FFFFFF', good: '#A1A1A6', mid: '#FF9F0A', low: '#FF453A', none: 'rgba(255,255,255,.18)' }
const VAR_FAIXA = { top: '--tier-top', good: '--tier-good', mid: '--tier-mid', low: '--tier-low', none: '--hairline-strong' }

export function corFaixa(f, root = document.documentElement) {
  const v = getComputedStyle(root).getPropertyValue(VAR_FAIXA[f] || '--tier-good').trim()
  return v || COR_PADRAO[f] || COR_PADRAO.good
}

// ---------------------------------------------------------------------------
// Perguntas na ordem do chat (versão 8 minutos + bônus)
// ---------------------------------------------------------------------------

function q(grupo, id, extra = {}) {
  const def = QUESTOES[grupo][id]
  const tipo = extra.tipo || (grupo === 'likert' ? 'likert' : def.tipo === 'multi' ? 'multi' : def.tipo === 'texto' ? 'texto' : 'opcao')
  return {
    grupo,
    id,
    tipo,
    max: def.max,
    opcional: !!def.opcional || !!extra.opcional,
    prompt: extra.prompt || def.texto,
    placeholder: extra.placeholder || '',
    secao: extra.secao || 'perfil',
    opcoes: def.opcoes || null,
  }
}

export const PERGUNTAS = [
  q('lead', 'nome', { prompt: 'Pra começar: como você se chama?', placeholder: 'Ex: Camila', secao: 'perfil' }),
  q('lead', 'papel', { secao: 'perfil' }),
  q('lead', 'foco', { prompt: 'O que a clínica mais faz hoje?', secao: 'perfil' }),

  q('roteamento', 'agenda', { secao: 'agenda' }),
  q('roteamento', 'problemas', { prompt: 'Qual é o principal problema agora? Pode marcar até 2.', secao: 'agenda' }),
  q('roteamento', 'quem_responde_digital', { secao: 'agenda' }),
  q('roteamento', 'orcamento', { prompt: 'Quanto a clínica consegue investir por mês pra resolver isso de verdade? Não é pra constranger. É pra eu não te empurrar pacote se o caso pede só uma peça.', secao: 'agenda' }),

  q('likert', 'P2', { secao: 'preco' }),
  q('likert', 'P3', { secao: 'preco' }),
  q('likert', 'P4', { secao: 'preco' }),
  q('likert', 'P6', { secao: 'preco' }),
  q('likert', 'P7', { secao: 'preco' }),

  q('likert', 'C1', { secao: 'comercial' }),
  q('likert', 'C2', { secao: 'comercial' }),
  q('likert', 'C3', { secao: 'comercial' }),
  q('likert', 'C7', { secao: 'comercial' }),

  q('likert', 'CAP1', { secao: 'captacao' }),
  q('likert', 'CAP2', { secao: 'captacao' }),
  q('likert', 'CAP3', { secao: 'captacao' }),

  q('likert', 'WA1', { secao: 'whatsapp' }),
  q('likert', 'WA3', { secao: 'whatsapp' }),

  q('categoricas', 'S1', { secao: 'papel' }),
  q('categoricas', 'S2', { secao: 'papel' }),
  q('categoricas', 'S3', { secao: 'papel' }),
  q('categoricas', 'S4', { secao: 'papel' }),
  q('categoricas', 'S5', { secao: 'papel' }),
  q('categoricas', 'S6', { secao: 'papel' }),

  q('livres', 'procedimento_mais_vende', { prompt: 'Bônus, vale ouro no laudo: qual procedimento vocês mais vendem hoje?', placeholder: 'Ex: limpeza de pele', secao: 'extra', opcional: true }),
  q('livres', 'procedimento_quer_vender', { prompt: 'E qual vocês mais queriam vender?', placeholder: 'Ex: bioestimulador', secao: 'extra', opcional: true }),
]

export const OBRIGATORIAS = PERGUNTAS.filter((p) => !p.opcional)

// ---------------------------------------------------------------------------
// Mensagens do guia
// ---------------------------------------------------------------------------

export const MENSAGENS_INTRO = [
  `Oi. Eu sou o ${CONFIG.guia}. Nos próximos ${CONFIG.duracao} a gente acha onde a sua clínica perde dinheiro entre o "oi" no WhatsApp e o protocolo pago.`,
  'Não tem resposta certa. Tem o que acontece na sua clínica numa terça-feira às 21h.',
]

// Depois da resposta. String, ou função (valor, answers, resultado) → string | null.
export const MENSAGENS_DEPOIS = {
  nome: 'Fechado, {nome}. Repara no laudo ao lado: cada resposta preenche um pedaço dele em tempo real.<span data-onboarding-result></span>',
  foco: 'Agora quatro perguntas de contexto. Elas não pontuam. Elas decidem o filme.',
  orcamento: 'Contexto pronto. Agora o bloco que costuma doer: preço. Escala de 1 a 4.',
  P3: (v) => (v <= 2 ? 'Desconto virou idioma. Anúncio agora só traria mais gente treinada a pechinchar.' : null),
  P6: (v) => (v <= 2 ? 'Avaliação como balcão de tabela: a pessoa entra pra ouvir preço e sai comparando com a vizinha.' : null),
  P7: 'Preço fechado. Agora o comercial: do primeiro "oi" até o fechamento.',
  C2: (v) => (v === 1 ? 'Sem esse número a clínica voa no escuro. Ninguém conserta o que não mede.' : v === 4 ? 'Você mede. Isso já te separa da maioria das clínicas que eu vejo.' : null),
  C3: (v) => (v <= 2 ? '"Vou pensar" sem data marcada é lead morto com educação.' : null),
  C7: 'Captação em três toques.',
  CAP3: 'Dois toques sobre a operação do WhatsApp.',
  WA3: 'Último bloco, o decisivo: quem responde o digital da clínica foi contratada pra quê?',
  S4: (v) => (v === 'ate_800' ? 'Até R$ 800 paga atendimento. Não paga venda. Isso vai aparecer no laudo.' : v === 'sou_eu' ? 'Você é o comercial. Então o laudo vai olhar pro seu horário, não pro seu salário.' : null),
  S6: 'Bloco fechado. Duas perguntas abertas, opcionais, e o laudo sai.',
}

export const MENSAGENS_TRANSICAO_LEAD = [
  'Pronto. O radar, os selos e as condecorações já estão no card.',
  'A parte que vale dinheiro é o resto do laudo: o SWOT da clínica, a oferta certa pro seu caso e a mensagem que eu mandaria pra você. Isso eu entrego no WhatsApp.',
  'Onde te mando?',
]

export const ANALISE_FRASES = [
  'Lendo suas respostas…',
  'Cruzando preço com papel comercial…',
  'Checando se tráfego cabe agora…',
  'Roteando a oferta…',
]

// ---------------------------------------------------------------------------
// Condecorações (18). when(a, r) recebe answers normalizadas e o resultado do motor.
// ---------------------------------------------------------------------------

const L = (a, id) => a.likert[id]
const S = (a, id) => a.categoricas[id]


// Ícones de linha (24x24, stroke currentColor). Sem emoji: o card é sóbrio.
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`
const ICONE = {
  margem: I('<path d="M6 18 18 6"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'),
  cheio: I('<path d="M12 3 4 9l8 12 8-12z"/><path d="M4 9h16"/>'),
  protocolo: I('<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  avaliacao: I('<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3h6v3H9z"/><path d="M9 13l2 2 4-4"/>'),
  conversa: I('<path d="M20 14a3 3 0 0 1-3 3H9l-4 3V7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3z"/>'),
  roteiro: I('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h5.5" transform="translate(0,-2)"/>'),
  medir: I('<path d="M4 18V9M10 18V5M16 18v-6M22 18h-20"/>'),
  agendaFollow: I('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13v3l2 1"/>'),
  espelho: I('<rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/><path d="M12 3v18"/>'),
  base: I('<path d="M3 20h18M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/>'),
  origem: I('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z"/>'),
  alvo: I('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>'),
  relogio: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  automatico: I('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>'),
  closer: I('<path d="M4 12.5 8 9l3.5 2.5L16 7l4 3"/><path d="M4 19h16"/><circle cx="8" cy="9" r="1.6"/>'),
  comissao: I('<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2A3 3 0 0 0 9.6 11c0 2.6 5 1.4 5 4a3 3 0 0 1-5 1.9M12 7v10"/>'),
  noite: I('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>'),
  metodo: I('<path d="M12 4 3 8.5 12 13l9-4.5z"/><path d="M6.5 10.8V15c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-4.2"/>'),
}

export const BADGES = [
  { id: 'preco_por_margem', icon: ICONE.margem, nome: 'Preço por margem', blurb: 'Tabela feita com custo e posicionamento, não olhando a concorrente.', when: (a) => L(a, 'P2') === 4 },
  { id: 'valor_cheio', icon: ICONE.cheio, nome: 'Valor cheio', blurb: 'Desconto é exceção com regra, não idioma.', when: (a) => L(a, 'P3') >= 3 },
  { id: 'protocolo_nao_sessao', icon: ICONE.protocolo, nome: 'Protocolo, não sessão', blurb: 'O produto principal é plano, não sessão avulsa.', when: (a) => L(a, 'P4') === 4 },
  { id: 'avaliacao_com_processo', icon: ICONE.avaliacao, nome: 'Avaliação com processo', blurb: 'Preço só entra depois do plano.', when: (a) => L(a, 'P6') === 4 },
  { id: 'conteudo_que_abre_conversa', icon: ICONE.conversa, nome: 'Conteúdo que abre conversa', blurb: 'O Instagram fala de problema e resultado, não só de tabela.', when: (a) => L(a, 'P7') >= 3 },
  { id: 'roteiro_do_oi_ao_pix', icon: ICONE.roteiro, nome: 'Roteiro do oi ao pix', blurb: 'O atendimento não depende do humor de quem pegou o celular.', when: (a) => L(a, 'C1') >= 3 },
  { id: 'mede_a_taxa', icon: ICONE.medir, nome: 'Mede a taxa', blurb: 'Sabe quantas conversas viram avaliação e quantas viram protocolo.', when: (a) => L(a, 'C2') === 4 },
  { id: 'followup_com_data', icon: ICONE.agendaFollow, nome: 'Follow-up com data', blurb: '"Vou pensar" entra numa sequência, não no limbo.', when: (a) => L(a, 'C3') >= 3 },
  { id: 'uma_clinica_so', icon: ICONE.espelho, nome: 'Uma clínica só', blurb: 'Anúncio, recepção e avaliação prometem a mesma coisa.', when: (a) => L(a, 'C7') >= 3 },
  { id: 'agenda_sem_depender_do_post', icon: ICONE.base, nome: 'Agenda sem depender do post', blurb: 'Sete dias sem postar e a agenda não sente.', when: (a) => L(a, 'CAP1') !== null && L(a, 'CAP1') <= 2 },
  { id: 'sabe_a_origem', icon: ICONE.origem, nome: 'Sabe a origem', blurb: 'Cada paciente da semana tem canal registrado.', when: (a) => L(a, 'CAP2') === 4 },
  { id: 'anuncio_com_proximo_passo', icon: ICONE.alvo, nome: 'Anúncio com próximo passo', blurb: 'Post e anúncio pedem avaliação, não só mostram resultado bonito.', when: (a) => L(a, 'CAP3') >= 3 },
  { id: 'cobertura_real', icon: ICONE.relogio, nome: 'Cobertura real', blurb: 'O WhatsApp tem horário de cobertura, não "quando der".', when: (a) => L(a, 'WA1') >= 3 },
  { id: 'followup_automatico', icon: ICONE.automatico, nome: 'Follow-up automático', blurb: 'Ninguém precisa lembrar de cobrar o "vou pensar".', when: (a) => L(a, 'WA3') >= 3 },
  { id: 'closer_de_verdade', icon: ICONE.closer, nome: 'Closer de verdade', blurb: 'Alguém conduz protocolo de ticket alto sem te chamar.', when: (a) => S(a, 'S2') === 'sim' },
  { id: 'comissao_por_protocolo', icon: ICONE.comissao, nome: 'Comissão por protocolo', blurb: 'Quem vende ganha quando fecha, não quando despacha.', when: (a) => S(a, 'S3') === 'fixo_protocolo' },
  { id: 'lead_21h_vivo', icon: ICONE.noite, nome: 'Lead das 21h vivo', blurb: 'Fora de hora tem fluxo que segura a conversa e marca.', when: (a) => S(a, 'S5') === 'fluxo_marca' },
  { id: 'lead_e_venda', icon: ICONE.metodo, nome: 'Lead é venda', blurb: 'A clínica trata lead como alguém a ser vendido com ética e processo.', when: (a) => S(a, 'S6') === 'vendida_com_processo' },
]

// ---------------------------------------------------------------------------
// Personas: flavor determinístico (o texto completo vem do laudo via LLM)
// ---------------------------------------------------------------------------

export const PERSONA_FLAVOR = {
  rainha_do_conteudo_agenda_oca: 'Posta todo dia, a agenda sente quando para. Falta oferta e próximo passo no que sai.',
  clinica_quanto_custa: 'O Instagram educa o público a perguntar preço. A conversa nasce no balcão de tabela.',
  avaliacao_que_nao_fecha: 'Gente chega. Avaliação acontece. O protocolo não sai. O ralo é a conversa, não o tráfego.',
  secretaria_no_front: 'Quem responde o digital foi montada pra atender, não pra vender. Lead pede preço e some.',
  dona_no_plantao_21h: 'Você é o comercial 24h. O que chega fora do horário morre até a manhã seguinte.',
  desconto_como_idioma: 'A clínica fecha. Fecha barato. Anúncio agora treina mais gente a negociar.',
  indicacao_cansada: 'A agenda vive de indicação sem sistema. Quando a indicação para, para tudo.',
  fecha_barato_sonha_caro: 'Vende o procedimento de entrada e sonha com o de ticket alto. O comercial atrai a paciente errada.',
  ferramenta_sem_metodo: 'Já teve robô. Ele mandava tabela em escala. Falta o método, não a ferramenta.',
  pronta_para_o_sistema: 'Os quatro eixos aguentam volume. O próximo passo é sistema, não remendo.',
  atendimento_no_lugar_de_venda: 'Tem alguém no WhatsApp. Não tem comercial. A cadeira foi precificada como secretária e cobrada como closer.',
  agenda_cheia_caixa_magro: 'A agenda lota e o caixa não reflete. O problema é preço e protocolo, não paciente.',
}

export const PERSONA_TITULOS = PERSONAS

export const OFERTA_TITULOS = {
  CONSULTORIA: 'Consultoria de oferta e preço',
  COMERCIAL: 'Processo comercial',
  IA_AUTOMACAO: 'IA de atendimento',
  TRAFEGO: 'Tráfego de conversão',
  PACOTE_COMPLETO: 'Pacote completo',
  DIAGNOSTICO_PONTUAL: 'Diagnóstico pontual',
}

export const SELO_PRECO = {
  preco_no_controle: { label: 'Preço no controle', tom: 'top' },
  tabela_fragil: { label: 'Tabela frágil', tom: 'mid' },
  desconto_como_habito: { label: 'Desconto como hábito', tom: 'low' },
}

export const SELO_PAPEL = {
  closer_existente: { label: 'Closer existente', tom: 'top' },
  dona_vende: { label: 'Dona vende', tom: 'mid' },
  secretaria_no_comercial: { label: 'Secretária no comercial', tom: 'mid' },
  funcao_ausente: { label: 'Função comercial ausente', tom: 'low' },
}

// ---------------------------------------------------------------------------
// Tradução das flags em frase de clínica
// ---------------------------------------------------------------------------

export const FLAG_FRASE = {
  funcao_comercial_inexistente: 'A clínica contratou atendimento, não venda: fixo baixo, sem comissão, só informa valor',
  vendedora_fantasia: 'O cargo no discurso é comercial; o contrato é recepção remota',
  secretaria_informa_preco: 'Secretária informa preço no lugar de qualificar',
  closer_inexistente: 'Ninguém fecha protocolo de ticket alto sem chamar a dona',
  dona_e_o_comercial: 'A dona é o comercial da clínica',
  remuneracao_sem_comissao: 'Quem responde o digital não ganha nada quando fecha',
  salario_comercial_abaixo_1500: 'Cadeira comercial remunerada como recepção',
  papel_digital_sem_dono: 'O WhatsApp tem várias mãos e nenhum dono',
  desconto_habito: 'Desconto é regra, não exceção',
  preco_por_concorrente: 'Preço definido olhando a concorrente, não a margem',
  nao_sabe_custo_do_protocolo: 'Custo real do protocolo desconhecido',
  vende_sessao_nao_protocolo: 'Vende sessão avulsa como produto principal',
  avaliacao_balcao_de_tabela: 'Avaliação funciona como balcão de tabela',
  preco_no_instagram_sem_qualificar: 'O conteúdo educa o público a perguntar só "quanto custa?"',
  caixa_confundido_com_receita: 'Pacote parcelado tratado como faturamento do mês',
  lead_21h_morto: 'Lead fora do horário morre até o dia seguinte',
  followup_inexistente: 'Follow-up depende de alguém lembrar',
  whatsapp_sem_dono: 'Sem horário de cobertura real no WhatsApp',
  bot_que_so_manda_tabela: 'Já teve robô, e ele só mandava tabela',
  historico_se_perde_no_celular: 'Histórico do lead se perde quando troca o celular',
  gap_captacao: 'Captação abaixo do mínimo pra encher agenda',
  depende_de_postar: 'Se parar de postar sete dias, a agenda sente',
  nao_sabe_origem_do_paciente: 'Não sabe o canal de origem de cada paciente',
  indicacao_nao_sistematizada: 'Indicação sem pedido e sem registro',
  conteudo_sem_proximo_passo: 'Post e anúncio sem oferta e sem próximo passo',
  gap_comercial: 'Conversão abaixo do mínimo pra aguentar volume',
  nao_mede_taxa_de_fechamento: 'Não mede quantas avaliações viram protocolo',
  avaliacao_sem_roteiro: 'Avaliação sem roteiro do "oi" ao fechamento',
  profissional_e_venda_misturados: 'Quem executa e quem vende se atrapalham',
  no_show_ignorado: 'No-show de avaliação sem medição e sem recuperação',
  mensagem_anuncio_diferente_da_recepcao: 'Uma clínica no Instagram, outra no balcão',
}

const FLAGS_CONTEXTO = new Set([
  'agenda_folgada', 'agenda_oscila', 'cheia_de_avaliacao_pouco_fechamento', 'cheia_caixa_nao_reflete', 'dona_no_limite',
  'orcamento_ate_1k', 'orcamento_1k_3k', 'orcamento_3k_8k', 'orcamento_acima_8k', 'quer_entender_antes',
])

export function flagsTraduzidas(flags) {
  return flags.filter((f) => !FLAGS_CONTEXTO.has(f) && FLAG_FRASE[f]).map((f) => FLAG_FRASE[f])
}

// ---------------------------------------------------------------------------
// Notas por eixo (1 frase, determinística)
// ---------------------------------------------------------------------------

export function notaEixo(id, r) {
  const has = (f) => r.flags.includes(f)
  const s = r.scores[id]
  if (s === null) return null
  switch (id) {
    case 'marca_demanda':
      if (has('preco_no_instagram_sem_qualificar')) return 'O conteúdo abre conversa de preço, não de problema.'
      if (has('mensagem_anuncio_diferente_da_recepcao')) return 'O que o Instagram promete não é o que a recepção fala.'
      if (has('conteudo_sem_proximo_passo')) return 'Falta oferta e próximo passo no que sai.'
      return s >= LIMIAR_OK ? 'Mensagem alinhada do post ao balcão.' : 'Marca comunica, mas ainda não puxa avaliação.'
    case 'captacao':
      if (has('depende_de_postar') && has('gap_captacao')) return 'A agenda depende de postar. Sem sistema por trás.'
      if (has('nao_sabe_origem_do_paciente')) return 'Sem saber a origem, não dá pra escalar o canal certo.'
      if (has('gap_captacao')) return 'Entra pouca gente, ou entra gente de preço.'
      return s >= LIMIAR_OK ? 'Captação aguenta receber volume.' : 'Captação existe, mas sem controle de canal.'
    case 'conversao':
      if (has('funcao_comercial_inexistente')) return 'Sem função comercial, o lead vira tabela enviada.'
      if (has('desconto_habito')) return 'Fecha, mas fecha barato. Desconto virou idioma.'
      if (has('avaliacao_balcao_de_tabela')) return 'A avaliação entrega preço antes do plano.'
      if (has('nao_mede_taxa_de_fechamento')) return 'Vocês não medem a taxa de fechamento.'
      return s >= LIMIAR_OK ? 'Processo que fecha e mede.' : 'Conversa existe, mas sem roteiro fechando.'
    case 'equipe_sistema':
      if (has('funcao_comercial_inexistente')) return 'A cadeira comercial não existe. Existe atendimento.'
      if (has('lead_21h_morto') && has('followup_inexistente')) return 'Lead fora de hora morre e ninguém cobra o "vou pensar".'
      if (has('lead_21h_morto')) return 'O ralo está no intervalo entre o "oi" e a avaliação.'
      if (has('dona_e_o_comercial')) return 'A dona segura o comercial. Não escala.'
      return s >= LIMIAR_OK ? 'Papel definido e WhatsApp com sistema.' : 'Papel comercial pouco definido.'
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// SWOT determinístico (pré-laudo). O laudo do LLM substitui isto na fase 2.
// ---------------------------------------------------------------------------

export function swotDeterministico(r, a) {
  const has = (f) => r.flags.includes(f)
  const forcas = []
  const fraquezas = flagsTraduzidas(r.flags).slice(0, 4)
  const oportunidades = []
  const alertas = []

  for (const e of EIXOS) {
    if (r.scores[e.id] !== null && r.scores[e.id] >= LIMIAR_OK) forcas.push(`${e.longo} acima do mínimo pra receber volume`)
  }
  if (L(a, 'C2') === 4) forcas.push('Mede conversas, avaliações e protocolos fechados')
  if (L(a, 'P6') === 4) forcas.push('Avaliação com processo: preço só depois do plano')
  if (S(a, 'S2') === 'sim') forcas.push('Existe quem fecha ticket alto sem chamar a dona')
  if (L(a, 'P3') >= 3) forcas.push('Vende no valor cheio na maior parte dos fechamentos')
  if (L(a, 'C3') >= 3) forcas.push('"Vou pensar" entra em follow-up com data')
  if (!forcas.length) forcas.push('A dona respondeu com honestidade. Isso é o primeiro ativo do laudo.')

  const o = r.oferta.principal
  if (o === 'PACOTE_COMPLETO') oportunidades.push('Anúncio de conversão + roteiro + IA no fora de hora, juntos', 'Separar recepção (agenda) de closer (qualifica e conduz)')
  if (o === 'COMERCIAL') oportunidades.push('Roteiro do primeiro "oi" ao fechamento, com quem conduz definido', 'Avaliação que descobre orçamento e decisão antes do menu')
  if (o === 'IA_AUTOMACAO') oportunidades.push('IA que qualifica e marca avaliação no fora de hora, sem despachar tabela', 'Follow-up do "vou pensar" que não depende de memória')
  if (o === 'TRAFEGO') oportunidades.push('Volume certo em cima de um comercial que já aguenta', 'Anúncio com oferta e próximo passo, não resultado bonito')
  if (o === 'CONSULTORIA') oportunidades.push('Reescrever oferta: protocolo acima de sessão, preço depois do plano', 'Tabela, regra de desconto e quem autoriza')
  if (o === 'DIAGNOSTICO_PONTUAL') oportunidades.push('Medir três números antes de comprar qualquer sistema', 'Fechar o ralo mais barato primeiro')
  if (has('dona_e_o_comercial')) oportunidades.push('Mesmo com a dona no comercial: script, horário e meta')
  if (r.oferta.complementar === 'IA_AUTOMACAO') oportunidades.push('IA segura o fora de hora; humano fecha o ticket alto')

  if (r.oferta.trafego_proibido_passo_1) alertas.push('Mais tráfego agora multiplica o "quanto custa?"')
  if (has('remuneracao_sem_comissao') && has('salario_comercial_abaixo_1500')) alertas.push('Sem comissão e com fixo baixo, a pessoa otimiza pra despachar conversa, não pra fechar')
  if (has('bot_que_so_manda_tabela') || has('secretaria_informa_preco')) alertas.push('IA que só manda valor reproduz a secretária, em escala')
  if (has('caixa_confundido_com_receita')) alertas.push('Caixa de pacote parcelado não é receita do mês')
  if (has('dona_no_limite')) alertas.push('Encher mais a agenda agora quebra a dona antes de quebrar o caixa')
  if (has('lead_21h_morto')) alertas.push('Cada lead das 21h que morre é anúncio pago pra ninguém')
  if (!alertas.length) alertas.push('Não escalar verba antes de medir taxa de fechamento por 30 dias')

  return {
    forcas: forcas.slice(0, 4),
    fraquezas,
    oportunidades: oportunidades.slice(0, 4),
    alertas: alertas.slice(0, 4),
  }
}

export const NUMEROS_PEDIR = ['Avaliações por semana', '% que fecha em 7 dias', 'Ticket médio do último mês']
