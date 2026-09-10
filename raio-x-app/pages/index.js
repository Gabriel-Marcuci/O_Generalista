import { useState } from 'react'
import styles from '../styles/Home.module.css'

const QUESTOES = {
  R1: { texto: 'Qual descreve melhor o seu papel hoje?', opcoes: { dona_atende: 'Sou dona/sócia e também atendo', dona_nao_atende: 'Sou dona/sócia e quase não atendo mais', profissional_responsavel: 'Sou a profissional responsável', gestao_atendimento: 'Cuido da gestão/atendimento' } },
  R2: { texto: 'O que a clínica mais faz?', opcoes: { facial: 'Estética facial', hof: 'Harmonização / HOF', corporal: 'Corporal', facial_corporal: 'Facial + corporal', misto: 'Um pouco de tudo' } },
  R3: { texto: 'Como está a agenda neste momento?', opcoes: { folgada: 'Folgada — preciso de mais paciente', oscila: 'Oscila: um mês cheia, outro morta', cheia_avaliacao_pouco_fecha: 'Cheia de avaliação, pouco procedimento fechado', cheia_caixa_nao_reflete: 'Cheia de procedimento, mas o caixa não reflete', cheia_no_limite: 'Cheia e eu estou no limite' } },
  R4: { texto: 'Qual é o principal problema agora? (máx. 2)', tipo: 'multi', opcoes: { pouca_gente: 'Pouca gente chegando', nao_fecha: 'Chega gente e não fecha', fecha_barato: 'Fecha barato / dá muito desconto', paciente_some: 'Paciente some depois da primeira sessão', whatsapp_nao_da_conta: 'Eu (ou a equipe) não dou conta do WhatsApp', nao_sei_priorizar: 'Não sei o que priorizar' } },
  R5: { texto: 'Quem responde o Instagram/WhatsApp na maior parte do tempo?', opcoes: { dona: 'Eu, a dona/profissional', secretaria: 'Secretária / recepção', consultora: '"Vendedora" / consultora', varias_sem_dono: 'Várias pessoas, sem dono', automatico: 'Ferramenta / resposta automática' } },
  R6: { texto: 'Quanto consegue investir por mês para resolver isso?', opcoes: { ate_1k: 'Até R$ 1.000', de_1k_a_3k: 'R$ 1.000 a R$ 3.000', de_3k_a_8k: 'R$ 3.000 a R$ 8.000', acima_8k: 'Acima de R$ 8.000', quer_entender_antes: 'Quero entender antes de falar em valor' } },
}

const LIKERT = [
  { id: 'P3', texto: 'Na última semana, a clínica vendeu no valor cheio na maior parte dos fechamentos. Desconto foi exceção, com regra.' },
  { id: 'P6', texto: 'Avaliação não é "consulta grátis para ouvir preço". Tem processo, e o valor só entra depois do plano.' },
  { id: 'C2', texto: 'Eu sei, em número, quantas conversas viram avaliação e quantas avaliações viram protocolo pago nos últimos 30 dias.' },
  { id: 'C3', texto: 'Quem diz "vou pensar" entra numa sequência de follow-up com data. Não fica no limbo.' },
  { id: 'CAP3', texto: 'Anúncio/post tem oferta e próximo passo (avaliação), não só resultado bonito.' },
  { id: 'WA3', texto: 'Follow-up não depende de alguém lembrar.' },
]

const CATEGORICAS = [
  { id: 'S1', texto: 'A pessoa que responde o digital foi contratada para quê?', opcoes: { recepcao: 'Receber paciente', informar_valores: 'Responder e informar valores', marcar_avaliacao: 'Qualificar e marcar avaliação', vender_protocolo: 'Vender protocolo (meta e comissão)', sou_eu: 'Sou eu' } },
  { id: 'S4', texto: 'Faixa de remuneração dessa pessoa?', opcoes: { ate_800: 'Até R$ 800', '800_1500': 'R$ 800 a R$ 1.500', '1500_3000_var': 'R$ 1.500 a R$ 3.000+', acima: 'Acima disso', sou_eu: 'Sou eu' } },
  { id: 'S5', texto: 'Se entra lead às 21h pedindo preço, o que acontece?', opcoes: { ninguem_responde: 'Ninguém responde até o dia seguinte', auto_generica: 'Resposta automática genérica', manda_valor: 'Alguém manda valor e para', fluxo_marca: 'Há fluxo que marca avaliação', depende: 'Depende do dia' } },
]

export default function Home() {
  const [passo, setPasso] = useState(0) // 0: intro, 1-6: roteadoras, 7: likert, 8: categoricas, 9: resultado
  const [nome, setNome] = useState('')
  const [respostas, setRespostas] = useState({
    lead: { nome: '', papel: null, foco: null },
    roteamento: { agenda: null, problemas: [], quem_responde_digital: null, orcamento: null },
    likert: Object.fromEntries(LIKERT.map(q => [q.id, null])),
    categoricas: Object.fromEntries(CATEGORICAS.map(q => [q.id, null])),
    livres: { procedimento_mais_vende: '', procedimento_quer_vender: '', notas_livres: '' },
  })
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const handleResposta = (campo, valor) => {
    if (passo <= 6) {
      const chave = Object.keys(QUESTOES)[passo - 1]
      if (QUESTOES[chave].tipo === 'multi') {
        const arr = respostas.roteamento[campo] || []
        const novo = arr.includes(valor) ? arr.filter(x => x !== valor) : [...arr, valor]
        setRespostas({ ...respostas, roteamento: { ...respostas.roteamento, [campo]: novo } })
      } else {
        setRespostas({ ...respostas, roteamento: { ...respostas.roteamento, [campo]: valor } })
      }
    } else if (passo <= 12) {
      setRespostas({ ...respostas, likert: { ...respostas.likert, [campo]: valor } })
    } else {
      setRespostas({ ...respostas, categoricas: { ...respostas.categoricas, [campo]: valor } })
    }
  }

  const handleProximo = async () => {
    if (passo === 0) {
      if (!nome.trim()) { setErro('Coloque seu nome'); return }
      setRespostas({ ...respostas, lead: { ...respostas.lead, nome } })
      setPasso(1)
    } else if (passo <= 6) {
      const chave = Object.keys(QUESTOES)[passo - 1]
      const val = respostas.roteamento[chave.toLowerCase()]
      if (!val || (Array.isArray(val) && val.length === 0)) { setErro('Escolha uma opção'); return }
      setPasso(passo + 1)
    } else if (passo <= 12) {
      setPasso(passo + 1)
    } else if (passo <= 15) {
      setPasso(passo + 1)
    } else if (passo === 16) {
      setErro('')
      setLoading(true)
      try {
        const res = await fetch('/api/avaliar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(respostas),
        })
        if (!res.ok) throw new Error(`Erro ${res.status}`)
        const data = await res.json()
        setResultado(data)
        setPasso(17)
      } catch (e) {
        setErro(`Erro: ${e.message}`)
      } finally {
        setLoading(false)
      }
    }
    setErro('')
  }

  const handleAnterior = () => {
    if (passo > 0) setPasso(passo - 1)
  }

  // Intro
  if (passo === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>Raio-X da Clínica</h1>
          <p>Diagnóstico comercial de clínicas de estética, HOF e corporal.</p>
          <p>O teste não é bonito — é um roteador de oferta. Cada resposta empurra você para uma alavanca (tráfego, comercial, IA, consultoria ou pacote).</p>
          <input type="text" placeholder="Seu primeiro nome" value={nome} onChange={e => setNome(e.target.value)} className={styles.input} />
          {erro && <p className={styles.erro}>{erro}</p>}
          <button onClick={handleProximo} className={styles.btn}>Começar</button>
        </div>
      </div>
    )
  }

  // Roteadoras (R1–R6)
  if (passo >= 1 && passo <= 6) {
    const idx = passo - 1
    const chave = Object.keys(QUESTOES)[idx]
    const q = QUESTOES[chave]
    const respKey = chave.toLowerCase()
    const selecionada = respostas.roteamento[respKey] || (q.tipo === 'multi' ? [] : null)

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.progress}>{passo} de 16</div>
          <h2>{q.texto}</h2>
          <div className={styles.opcoes}>
            {Object.entries(q.opcoes).map(([k, v]) => (
              <label key={k} className={styles.opcao}>
                <input
                  type={q.tipo === 'multi' ? 'checkbox' : 'radio'}
                  name={respKey}
                  value={k}
                  checked={q.tipo === 'multi' ? selecionada.includes(k) : selecionada === k}
                  onChange={() => handleResposta(respKey, k)}
                />
                {v}
              </label>
            ))}
          </div>
          {erro && <p className={styles.erro}>{erro}</p>}
          <div className={styles.botoes}>
            <button onClick={handleAnterior} className={styles.btnSecundario}>Anterior</button>
            <button onClick={handleProximo} className={styles.btn}>Próximo</button>
          </div>
        </div>
      </div>
    )
  }

  // Likert (escala 1–4)
  if (passo >= 7 && passo <= 12) {
    const idx = passo - 7
    const q = LIKERT[idx]

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.progress}>{passo} de 16</div>
          <h2>{q.texto}</h2>
          <div className={styles.likert}>
            {[1, 2, 3, 4].map(val => (
              <label key={val} className={styles.likertLabel}>
                <input
                  type="radio"
                  name={q.id}
                  value={val}
                  checked={respostas.likert[q.id] === val}
                  onChange={() => handleResposta(q.id, val)}
                />
                {val === 1 && 'Não acontece'}
                {val === 2 && 'Às vezes'}
                {val === 3 && 'Acontece, mas sem controle'}
                {val === 4 && 'É regra'}
              </label>
            ))}
          </div>
          <div className={styles.botoes}>
            <button onClick={handleAnterior} className={styles.btnSecundario}>Anterior</button>
            <button onClick={handleProximo} className={styles.btn}>Próximo</button>
          </div>
        </div>
      </div>
    )
  }

  // Categoricas
  if (passo >= 13 && passo <= 15) {
    const idx = passo - 13
    const q = CATEGORICAS[idx]
    const selecionada = respostas.categoricas[q.id] || null

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.progress}>{passo} de 16</div>
          <h2>{q.texto}</h2>
          <div className={styles.opcoes}>
            {Object.entries(q.opcoes).map(([k, v]) => (
              <label key={k} className={styles.opcao}>
                <input
                  type="radio"
                  name={q.id}
                  value={k}
                  checked={selecionada === k}
                  onChange={() => handleResposta(q.id, k)}
                />
                {v}
              </label>
            ))}
          </div>
          <div className={styles.botoes}>
            <button onClick={handleAnterior} className={styles.btnSecundario}>Anterior</button>
            <button onClick={handleProximo} className={styles.btn}>Próximo</button>
          </div>
        </div>
      </div>
    )
  }

  // Revisão
  if (passo === 16) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>Pronto para analisar?</h2>
          <p>Seus dados vão para o motor. Sem armazenar nada.</p>
          <div className={styles.botoes}>
            <button onClick={handleAnterior} className={styles.btnSecundario}>Voltar</button>
            <button onClick={handleProximo} disabled={loading} className={styles.btn}>
              {loading ? 'Analisando...' : 'Gerar laudo'}
            </button>
          </div>
          {erro && <p className={styles.erro}>{erro}</p>}
        </div>
      </div>
    )
  }

  // Resultado
  if (passo === 17 && resultado) {
    const { motor, scores } = resultado
    const ofertaTitulos = { CONSULTORIA: 'Consultoria', COMERCIAL: 'Comercial', IA_AUTOMACAO: 'IA + Automação', TRAFEGO: 'Tráfego', PACOTE_COMPLETO: 'Pacote Completo', DIAGNOSTICO_PONTUAL: 'Diagnóstico Pontual' }

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1>{motor.persona_titulo}</h1>
          <div className={styles.radar}>
            <p><strong>Marca & demanda:</strong> {scores.marca_demanda}</p>
            <p><strong>Captação:</strong> {scores.captacao}</p>
            <p><strong>Conversão:</strong> {scores.conversao}</p>
            <p><strong>Equipe & sistema:</strong> {scores.equipe_sistema}</p>
          </div>
          <div className={styles.oferta}>
            <h2>Próximo passo: {ofertaTitulos[motor.oferta_principal]}</h2>
          </div>
          <button onClick={() => { setPasso(0); setNome(''); setResultado(null); }} className={styles.btn}>Refazer</button>
        </div>
      </div>
    )
  }

  return <div className={styles.container}><p>Carregando...</p></div>
}
