// Fixture fictícia: clínica de HOF, secretária no WhatsApp a até R$ 800, só manda tabela,
// lead das 21h morre, desconto crônico, orçamento R$ 3–8k.
// Resultado esperado: PACOTE_COMPLETO (regra 1), tráfego proibido como passo 1,
// persona "Atendimento no lugar de venda".
import { readFileSync } from 'node:fs'

export const exemploSecretariaR500 = JSON.parse(
  readFileSync(new URL('./exemplo.secretaria-r500.json', import.meta.url), 'utf8'),
)

export default exemploSecretariaR500
