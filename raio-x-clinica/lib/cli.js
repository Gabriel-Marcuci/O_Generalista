#!/usr/bin/env node
// Uso: node lib/cli.js respostas.json            → imprime o resultado completo
//      node lib/cli.js respostas.json --payload  → imprime só o payload pro prompt do laudo
//      cat respostas.json | node lib/cli.js      → lê do stdin
import { readFileSync } from 'node:fs'
import { avaliar } from './score.js'

const args = process.argv.slice(2)
const soPayload = args.includes('--payload')
const arquivo = args.find((x) => !x.startsWith('--'))

const bruto = arquivo ? readFileSync(arquivo, 'utf8') : readFileSync(0, 'utf8')
const answers = JSON.parse(bruto)
const r = avaliar(answers)

if (soPayload) {
  process.stdout.write(JSON.stringify(r.payload, null, 2) + '\n')
} else {
  const { payload, ...resto } = r
  process.stdout.write(JSON.stringify({ ...resto, payload }, null, 2) + '\n')
}
