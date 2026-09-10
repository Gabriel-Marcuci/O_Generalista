# Raio-X da Clínica — motor do quiz

Roteador de oferta, não teste "bonito". Cada resposta empurra a clínica para uma das alavancas
(tráfego, comercial, IA, consultoria, pacote completo) e denuncia precificação fraca e time errado.

O LLM não calcula score e não inventa flag. Ele só escreve o laudo em cima do `payload` que sai daqui.

```
raio-x-clinica/
├── lib/
│   ├── questions.js                 # contrato dos IDs (o front grava neste shape)
│   ├── score.js                     # motor: scores, flags, selos, roteamento, persona, payload
│   ├── cli.js                       # node lib/cli.js respostas.json [--payload]
│   ├── exemplo.secretaria-r500.json # fixture fictícia: secretária a até R$ 800 no WhatsApp
│   ├── exemplo.secretaria-r500.js
│   └── score.test.js
├── prompt-laudo.md                  # system prompt que recebe o payload e devolve o laudo em JSON
└── README.md
```

Sem dependência. Node ≥ 20.

```sh
npm test          # 21 testes (node --test)
npm run exemplo   # roda a fixture e imprime o resultado
```

---

## Uso

```js
import { avaliar, validarLaudo } from './lib/score.js'

const r = avaliar(answers)

r.payload            // JSON cru para o prompt do laudo (inclui `motor` com a decisão)
r.scores             // radar 0–100: marca_demanda, captacao, conversao, equipe_sistema
r.subscores          // preco, comercial, papel_comercial, whatsapp_operacao
r.flags              // flags nomeadas (ver lista no prompt)
r.gaps               // gap_captacao, gap_comercial, gap_preco, gap_whatsapp, eixos_abaixo_55...
r.selos              // selo_preco + selo_papel
r.oferta             // principal / complementar / regra / trafego_proibido_passo_1 / copy_gancho / fase_2
r.persona_sugerida   // id da persona (r.persona_titulo tem o título canônico)
r.missing            // perguntas sem resposta
r.invalidas          // respostas fora do contrato (viram null)
```

Depois que o LLM devolver o laudo:

```js
const erros = validarLaudo(laudoJson, r)
if (erros.length) regenerar()   // ex.: veio TRAFEGO com trafego_proibido_passo_1 = true
```

### Shape de `answers`

```js
{
  lead:        { nome, papel, foco, porte?, objetivo? },              // R1, R2
  roteamento:  { agenda, problemas: [máx 2], quem_responde_digital, orcamento }, // R3–R6
  likert:      { P1..P8, C1..C7, CAP1..CAP5, WA1..WA3 },              // 1 a 4
  categoricas: { S1..S6, WA4 },
  livres:      { procedimento_mais_vende, procedimento_quer_vender, notas_livres }
}
```

IDs e textos das perguntas estão em `lib/questions.js`. `answersVazio()` devolve o esqueleto.

---

## Como o radar é montado

| Eixo | Fórmula |
|---|---|
| Marca e demanda | P7 35% + C7 35% + CAP3 30% |
| Captação | CAP1 (invertida) 20% + CAP2 20% + CAP3 25% + CAP4 15% + CAP5 20% |
| Conversão | preço 45% + comercial 55% |
| Equipe e sistema | WhatsApp 45% + papel comercial 55% |

Subscores:

| Subscore | Fórmula |
|---|---|
| Preço | P1 10, P2 20, P3 20, P4 10, P5 5, P6 15, P7 10, P8 10 |
| Comercial | C1 15, C2 20, C3 15, C4 15, C5 10, C6 10, C7 15 |
| WhatsApp | WA1 25, WA2 15, WA3 30, S5 30 (S5: fluxo_marca 100 · auto/manda_valor/depende 33 · ninguém 0) |
| Papel comercial | não é Likert. Começa em 50 e anda com S1–S6 + R5 (`PAPEL_DELTAS`). Secretária + tabela + fixo + até R$ 800 vai a 0. Closer com comissão de protocolo vai a 100. |

Likert 1–4 vira 0 / 33 / 67 / 100. Item em branco é ignorado e o peso é redistribuído.
Eixo sem nenhuma resposta fica `null` (o prompt manda dizer "não respondido", não chutar).

---

## Flags principais

| Flag | Gatilho |
|---|---|
| `funcao_comercial_inexistente` | S1 ∈ {recepção, informar valores} **e** S2 ∈ {tabela, me chama} **e** S3 = fixo sem comissão **e** S4 ≤ R$ 1.500 |
| `vendedora_fantasia` | R5 = secretária **e** S4 = até R$ 800 **e** C2 = 1 **e** R3 ∈ {folgada, avaliação sem fechar} |
| `desconto_habito` | P3 ≤ 2 |
| `preco_por_concorrente` | P2 ≤ 2 |
| `avaliacao_balcao_de_tabela` | P6 ≤ 2 |
| `lead_21h_morto` | S5 ∈ {ninguém responde, manda valor} ou CAP5 ≤ 2 |
| `followup_inexistente` | C3 ≤ 2 ou WA3 ≤ 2 |
| `whatsapp_sem_dono` | R5 = várias sem dono ou WA1 ≤ 2 |
| `bot_que_so_manda_tabela` | WA4 = sim, ou R5 = automático com S5 ∈ {manda valor, auto genérica} |
| `gap_captacao` | score captação < 55 |
| `gap_comercial` | score conversão < 55 ou `funcao_comercial_inexistente` |

Lista completa e o resto dos gatilhos em `detectarFlags()`.

---

## Roteamento (regra de número menor prevalece)

| # | Condição | Oferta |
|---|---|---|
| 1 | função inexistente ou vendedora fantasia **e** gap captação **e** orçamento ≥ 3k | PACOTE_COMPLETO |
| 2 | flag de preço **e** fecha barato / caixa não reflete **e** não é "não chega ninguém" | CONSULTORIA (+ COMERCIAL se gap comercial) |
| 3 | gap comercial **e** captação ok | COMERCIAL (+ IA se lead 21h morto ou follow-up inexistente) |
| 4 | ralo no WhatsApp **e** orçamento ≤ 3k **e** não (preço grave + função inexistente) | IA_AUTOMACAO |
| 5 | gap captação **e** conversão ≥ 65 **e** nada proíbe tráfego **e** orçamento > 1k | TRAFEGO (+ IA se lead 21h morto) |
| 6 | orçamento até 1k | DIAGNOSTICO_PONTUAL |
| 7 | 2+ eixos < 55 **e** orçamento ≥ 3k | PACOTE_COMPLETO |
| — | fallback | COMERCIAL se gap comercial → TRAFEGO/COMERCIAL se gap captação → IA se ralo no WhatsApp → CONSULTORIA se gap preço → DIAGNOSTICO_PONTUAL |

**Trava dura:** com `funcao_comercial_inexistente`, `vendedora_fantasia`, `avaliacao_balcao_de_tabela` ou `desconto_habito`,
TRAFEGO nunca sai como passo 1. O motor troca por COMERCIAL e marca `trafego_proibido_passo_1 = true`.

Ajuste em relação ao texto original: a regra 5 exige orçamento acima de R$ 1k. Sem isso, uma clínica de R$ 1k/mês com captação fraca recebia tráfego antes de cair na regra 6.

---

## Selos

- `selo_preco`: `desconto_como_habito` se P3 ≤ 2 · `tabela_fragil` se P2 ≤ 2, P6 ≤ 2 ou preço < 65 · senão `preco_no_controle`
- `selo_papel`: `funcao_ausente` (função inexistente / vendedora fantasia) · `closer_existente` (S2 = fecha sozinha e S1 ∈ {vender, marcar}) · `dona_vende` (S1 = sou eu ou R5 = dona) · `secretaria_no_comercial` (R5 secretária/consultora ou S1 recepção/informar)

## Personas (12, títulos canônicos em `PERSONAS`)

A ordem de precedência está em `sugerirPersona()`. Função comercial quebrada ganha de tudo → **Atendimento no lugar de venda**.

---

## Fixture: secretária de R$ 500

Camila (fictícia), HOF, secretária no WhatsApp a até R$ 800, só manda tabela, lead das 21h morre, desconto crônico, orçamento R$ 3–8k.

```
marca_demanda     33
captacao          22
conversao         14
equipe_sistema    10
papel_comercial    0
selo_preco        desconto_como_habito
selo_papel        funcao_ausente
persona           atendimento_no_lugar_de_venda
oferta            PACOTE_COMPLETO  (regra 1)
tráfego passo 1   PROIBIDO
```

---

## Versão de 8 minutos

Se o quiz precisar caber no intervalo da dona (~26 toques), use só os IDs em `VERSAO_8_MINUTOS`
(`lib/questions.js`) e deixe o resto em branco. O motor redistribui os pesos. Acima de 32 toques ela abandona.

## Encaixe sem app próprio (semana 1)

1. Typeform/Tally com os IDs de `questions.js` como referência de cada campo.
2. Webhook → planilha/função que monta `answers` e roda `avaliar(answers)`.
3. `r.payload` → `prompt-laudo.md` → JSON do laudo. `validarLaudo()` antes de aceitar.
4. Persistir no mínimo: `scores`, `flags`, `oferta.principal`, `persona_sugerida`, `whatsapp_msg_1`.
5. PDF/template com o laudo, enviado no WhatsApp em até 2h. Só depois automatizar.

Segunda mensagem no WhatsApp pede 3 números (avaliações/semana · % que fecha em 7 dias · ticket médio do último mês). Com isso se decide IA avulsa vs. consultoria vs. completo sem reunião.

Não deixe o front calcular média na mão. Um P2 = 1 tem que entrar com o peso de `PESOS.preco.P2`.
