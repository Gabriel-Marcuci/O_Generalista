// Contrato dos IDs do quiz Raio-X da Clínica.
// O front grava as respostas exatamente neste shape. O motor (score.js) lê daqui.
//
// Shape de `answers`:
// {
//   lead:        { nome, papel, foco, porte?, objetivo? },
//   roteamento:  { agenda, problemas: [..máx 2], quem_responde_digital, orcamento },
//   likert:      { P1..P8, C1..C7, CAP1..CAP5, WA1..WA3 }   // 1 a 4
//   categoricas: { S1..S6, WA4 },
//   livres:      { procedimento_mais_vende, procedimento_quer_vender, notas_livres }
// }

export const LIKERT_ESCALA = {
  1: 'não acontece / não sei',
  2: 'às vezes, no improviso',
  3: 'acontece, mas sem controle',
  4: 'é regra da clínica',
}

// Likert 1–4 vira 0 / 33 / 67 / 100.
export const LIKERT_PONTOS = { 1: 0, 2: 33, 3: 67, 4: 100 }

export const QUESTOES = {
  lead: {
    nome: { tipo: 'texto', texto: 'Seu primeiro nome' },
    papel: {
      id: 'R1',
      tipo: 'opcao',
      texto: 'Qual descreve melhor o seu papel hoje?',
      opcoes: {
        dona_atende: 'Sou dona/sócia e também atendo',
        dona_nao_atende: 'Sou dona/sócia e quase não atendo mais',
        profissional_responsavel: 'Sou a profissional responsável pela clínica',
        gestao_atendimento: 'Cuido da gestão/atendimento (não faço procedimento)',
      },
    },
    foco: {
      id: 'R2',
      tipo: 'opcao',
      texto: 'O que a clínica mais faz hoje?',
      opcoes: {
        facial: 'Estética facial',
        hof: 'Harmonização / HOF',
        corporal: 'Corporal',
        facial_corporal: 'Facial + corporal',
        misto: 'Um pouco de tudo',
      },
    },
    porte: {
      tipo: 'opcao',
      opcional: true,
      texto: 'Porte da clínica',
      opcoes: {
        sozinha: 'Só eu',
        uma_unidade_pequena: 'Uma unidade pequena',
        clinica_com_equipe: 'Clínica com equipe',
        expansao: 'Em expansão / mais de uma unidade',
      },
    },
    objetivo: {
      tipo: 'opcao',
      opcional: true,
      texto: 'Objetivo principal nos próximos 6 meses',
      opcoes: {
        encher_agenda: 'Encher a agenda',
        subir_ticket: 'Subir o ticket',
        parar_de_atender_sozinha: 'Parar de atender sozinha',
        segunda_unidade: 'Abrir a segunda unidade',
        padronizar_equipe: 'Padronizar a equipe',
      },
    },
  },

  roteamento: {
    agenda: {
      id: 'R3',
      tipo: 'opcao',
      texto: 'Como está a agenda neste momento?',
      opcoes: {
        folgada: 'Folgada — preciso de mais paciente',
        oscila: 'Oscila: um mês cheia, outro morta',
        cheia_avaliacao_pouco_fecha: 'Cheia de avaliação, pouco procedimento fechado',
        cheia_caixa_nao_reflete: 'Cheia de procedimento, mas o caixa não reflete',
        cheia_no_limite: 'Cheia e eu estou no limite',
      },
    },
    problemas: {
      id: 'R4',
      tipo: 'multi',
      max: 2,
      texto: 'Qual é o principal problema agora? (máx. 2)',
      opcoes: {
        pouca_gente: 'Pouca gente chegando',
        nao_fecha: 'Chega gente e não fecha',
        fecha_barato: 'Fecha barato / dá muito desconto',
        paciente_some: 'Paciente some depois da primeira sessão',
        whatsapp_nao_da_conta: 'Eu (ou a equipe) não dou conta do WhatsApp',
        nao_sei_priorizar: 'Não sei o que priorizar',
      },
    },
    quem_responde_digital: {
      id: 'R5',
      tipo: 'opcao',
      texto: 'Quem responde o Instagram/WhatsApp da clínica na maior parte do tempo?',
      opcoes: {
        dona: 'Eu, a dona/profissional',
        secretaria: 'Secretária / recepção',
        consultora: '"Vendedora" / consultora',
        varias_sem_dono: 'Várias pessoas, sem dono',
        automatico: 'Ferramenta / resposta automática',
      },
    },
    orcamento: {
      id: 'R6',
      tipo: 'opcao',
      texto: 'Quanto a clínica consegue investir por mês para resolver isso de verdade?',
      opcoes: {
        ate_1k: 'Até R$ 1.000',
        de_1k_a_3k: 'R$ 1.000 a R$ 3.000',
        de_3k_a_8k: 'R$ 3.000 a R$ 8.000',
        acima_8k: 'Acima de R$ 8.000',
        quer_entender_antes: 'Quero entender o que faz sentido antes de falar em valor',
      },
    },
  },

  // Escala 1–4. `invertida: true` = concordar é ruim (4 vira 0).
  likert: {
    // Precificação
    P1: { bloco: 'preco', texto: 'Eu sei o custo real de cada protocolo (produto + tempo da profissional + taxa + ocupação da sala), não só o preço de tabela.' },
    P2: { bloco: 'preco', texto: 'O preço foi definido por margem e posicionamento — não por "olhei a concorrente e cobrei R$ 50 a menos".' },
    P3: { bloco: 'preco', texto: 'Na última semana, a clínica vendeu no valor cheio na maior parte dos fechamentos. Desconto foi exceção, com regra.' },
    P4: { bloco: 'preco', texto: 'A gente vende protocolo / plano, não sessão isolada como produto principal.' },
    P5: { bloco: 'preco', texto: 'Eu sei qual foi o menor preço que aceitamos nos últimos 30 dias — e quem autorizou.' },
    P6: { bloco: 'preco', texto: 'Avaliação não é "consulta grátis para ouvir preço". Tem processo, e o valor só entra depois do plano.' },
    P7: { bloco: 'preco', texto: 'No Instagram, a clínica não educa o público a perguntar só "quanto custa?". O conteúdo abre conversa de problema e resultado.' },
    P8: { bloco: 'preco', texto: 'Pacote parcelado não é tratado como faturamento do mês. Eu separo caixa recebido de sessão a realizar.' },

    // Comercial
    C1: { bloco: 'comercial', texto: 'Existe um roteiro de atendimento do primeiro "oi" até o fechamento. Não depende do humor de quem pegou o celular.' },
    C2: { bloco: 'comercial', texto: 'Eu sei, em número, quantas conversas viram avaliação e quantas avaliações viram protocolo pago nos últimos 30 dias.' },
    C3: { bloco: 'comercial', texto: 'Quem diz "vou pensar / vou conversar em casa" entra numa sequência de follow-up com data. Não fica no limbo.' },
    C4: { bloco: 'comercial', texto: 'A avaliação descobre orçamento, urgência e decisão antes de abrir um menu de 12 procedimentos.' },
    C5: { bloco: 'comercial', texto: 'A profissional que executa e a pessoa que vende não se atrapalham: está claro quem conduz a parte comercial.' },
    C6: { bloco: 'comercial', texto: 'No-show de avaliação é medido e tem recuperação (lembrete + reposição).' },
    C7: { bloco: 'comercial', texto: 'O anúncio/post promete a mesma coisa que a recepção fala e que a avaliação entrega. Não tem uma clínica no Instagram e outra no balcão.' },

    // Captação
    CAP1: { bloco: 'captacao', invertida: true, texto: 'Se parar de postar 7 dias, a agenda sente.' },
    CAP2: { bloco: 'captacao', texto: 'Sei o canal de cada paciente da semana (Instagram, Google, indicação, anúncio).' },
    CAP3: { bloco: 'captacao', texto: 'Anúncio/post tem oferta e próximo passo (avaliação), não só resultado bonito.' },
    CAP4: { bloco: 'captacao', texto: 'Indicação tem pedido + registro; não é "as pacientes indicam naturalmente".' },
    CAP5: { bloco: 'captacao', texto: 'Lead fora do horário não morre até as 9h do dia seguinte.' },

    // Operação do WhatsApp
    WA1: { bloco: 'whatsapp', texto: 'Existe horário de cobertura real do WhatsApp (não "quando der").' },
    WA2: { bloco: 'whatsapp', texto: 'Histórico do lead não se perde quando troca o celular.' },
    WA3: { bloco: 'whatsapp', texto: 'Follow-up não depende de alguém lembrar.' },
  },

  categoricas: {
    S1: {
      bloco: 'papel',
      texto: 'A pessoa que responde o digital hoje foi contratada para quê?',
      opcoes: {
        recepcao: 'Receber paciente na porta / agenda / telefone',
        informar_valores: 'Responder mensagem e "informar valores"',
        marcar_avaliacao: 'Qualificar e marcar avaliação',
        vender_protocolo: 'Vender protocolo (tem meta e comissão)',
        sou_eu: 'Sou eu fazendo tudo',
      },
    },
    S2: {
      bloco: 'papel',
      texto: 'Essa pessoa pode conduzir uma conversa de protocolo de ticket alto sem te chamar?',
      opcoes: {
        sim: 'Sim, fecha sozinha',
        so_marca: 'Só marca avaliação',
        so_tabela: 'Só manda tabela / lista de preços',
        nao_me_chama: 'Não; qualquer dúvida volta para mim',
      },
    },
    S3: {
      bloco: 'papel',
      texto: 'Como essa pessoa é remunerada?',
      opcoes: {
        fixo_sem_comissao: 'Salário fixo baixo, sem comissão de venda',
        fixo_avaliacao: 'Fixo + comissão por avaliação marcada',
        fixo_protocolo: 'Fixo + comissão por protocolo fechado',
        so_comissao: 'Só comissão',
        sou_eu: 'Não se aplica (sou eu)',
      },
    },
    S4: {
      bloco: 'papel',
      texto: 'Qual é a faixa de remuneração dessa função hoje?',
      opcoes: {
        ate_800: 'Até R$ 800',
        '800_1500': 'R$ 800 a R$ 1.500',
        '1500_3000_var': 'R$ 1.500 a R$ 3.000 + variável',
        acima: 'Acima disso + variável',
        sou_eu: 'Sou eu; não tem cadeira comercial',
      },
    },
    S5: {
      bloco: 'papel',
      texto: 'Se entra um lead perguntando preço de um protocolo mais caro às 21h, o que acontece?',
      opcoes: {
        ninguem_responde: 'Ninguém responde até o dia seguinte',
        auto_generica: 'Resposta automática genérica',
        manda_valor: 'Alguém manda valor e para',
        fluxo_marca: 'Há um fluxo que segura a conversa e marca avaliação',
        depende: 'Depende do dia',
      },
    },
    S6: {
      bloco: 'papel',
      texto: 'No digital, a clínica trata o lead como:',
      opcoes: {
        quer_informacao: 'Pessoa que "quer informação"',
        precisa_qualificar: 'Pessoa que precisa ser qualificada',
        vendida_com_processo: 'Pessoa que precisa ser vendida com ética e processo',
        nao_pensamos: 'Ainda não pensamos assim',
      },
    },
    WA4: {
      bloco: 'whatsapp',
      texto: 'A clínica já tentou robô no WhatsApp e ele só mandava preço, sem qualificar?',
      opcoes: {
        sim: 'Sim',
        nao: 'Não / nunca tentamos',
      },
    },
  },

  livres: {
    procedimento_mais_vende: { tipo: 'texto', opcional: true, texto: 'Qual procedimento vocês mais vendem?' },
    procedimento_quer_vender: { tipo: 'texto', opcional: true, texto: 'E qual vocês mais queriam vender?' },
    notas_livres: { tipo: 'texto', opcional: true, texto: 'Algo mais que a gente precise saber?' },
  },
}

// Versão "8 minutos" (~26 toques). Se o quiz precisar caber no intervalo da dona,
// mantém estes e deixa o resto em branco — o motor redistribui os pesos.
export const VERSAO_8_MINUTOS = {
  roteamento: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'],
  likert: ['P2', 'P3', 'P4', 'P6', 'P7', 'C1', 'C2', 'C3', 'C7', 'CAP1', 'CAP2', 'CAP3', 'WA1', 'WA3'],
  categoricas: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
}

export function answersVazio() {
  return {
    lead: { nome: '', papel: null, foco: null, porte: null, objetivo: null },
    roteamento: { agenda: null, problemas: [], quem_responde_digital: null, orcamento: null },
    likert: Object.fromEntries(Object.keys(QUESTOES.likert).map((k) => [k, null])),
    categoricas: Object.fromEntries(Object.keys(QUESTOES.categoricas).map((k) => [k, null])),
    livres: { procedimento_mais_vende: '', procedimento_quer_vender: '', notas_livres: '' },
  }
}
