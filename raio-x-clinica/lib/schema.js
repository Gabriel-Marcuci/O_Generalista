/**
 * Schema Zod do shape `answers`.
 * Enums saem de QUESTOES — se mudar a pergunta, o schema acompanha.
 */
import { z } from 'zod'
import { QUESTOES } from './questions.js'

const keys = (obj) => Object.keys(obj)
const enumOf = (obj) => z.enum(/** @type {[string, ...string[]]} */ (keys(obj)))

export const LikertValor = z.number().int().min(1).max(4)
export const LikertValorOpcional = z.union([LikertValor, z.null()]).optional()

const likertShape = Object.fromEntries(
  keys(QUESTOES.likert).map((k) => [k, LikertValorOpcional]),
)

const categoricasShape = Object.fromEntries(
  keys(QUESTOES.categoricas).map((k) => [
    k,
    z.union([enumOf(QUESTOES.categoricas[k].opcoes), z.null()]).optional(),
  ]),
)

export const LeadSchema = z.object({
  nome: z.string().trim().min(1, 'nome obrigatório').max(80),
  papel: enumOf(QUESTOES.lead.papel.opcoes),
  foco: enumOf(QUESTOES.lead.foco.opcoes),
  porte: enumOf(QUESTOES.lead.porte.opcoes).nullable().optional(),
  objetivo: enumOf(QUESTOES.lead.objetivo.opcoes).nullable().optional(),
})

export const RoteamentoSchema = z.object({
  agenda: enumOf(QUESTOES.roteamento.agenda.opcoes),
  problemas: z
    .array(enumOf(QUESTOES.roteamento.problemas.opcoes))
    .max(QUESTOES.roteamento.problemas.max ?? 2)
    .default([]),
  quem_responde_digital: enumOf(QUESTOES.roteamento.quem_responde_digital.opcoes),
  orcamento: enumOf(QUESTOES.roteamento.orcamento.opcoes),
})

export const LivresSchema = z
  .object({
    procedimento_mais_vende: z.string().max(120).optional().default(''),
    procedimento_quer_vender: z.string().max(120).optional().default(''),
    notas_livres: z.string().max(1000).optional().default(''),
  })
  .default({})

export const AnswersSchema = z
  .object({
    lead: LeadSchema,
    roteamento: RoteamentoSchema,
    likert: z.object(likertShape).partial().default({}),
    categoricas: z.object(categoricasShape).partial().default({}),
    livres: LivresSchema,
  })
  .strict()

export function parseAnswers(input) {
  return AnswersSchema.safeParse(input)
}

export function formatZodError(parsed) {
  if (parsed.success) return null
  return parsed.error.issues.map((i) => ({
    path: i.path.join('.') || '(raiz)',
    message: i.message,
    code: i.code,
  }))
}
