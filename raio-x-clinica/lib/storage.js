/**
 * Persistência em disco, sem dependência.
 *
 * Raiz dos dados: RAIOX_DATA_DIR ou <raio-x-clinica>/data (gitignored).
 *
 *   appendJsonl('leads.jsonl', obj)   → uma linha JSON por registro
 *   salvarJson('laudos', id, obj)     → data/laudos/<id>.json
 *   lerJson('laudos', id)             → objeto ou null
 *   novoId()                          → 10 chars base36 (crypto)
 *
 * Ids passam por ID_RE antes de tocar o disco. Nada de path traversal.
 */
import { randomBytes } from 'node:crypto'
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ID_RE = /^[a-z0-9]{8,16}$/

const raizPadrao = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')

/** Raiz atual dos dados (lida a cada chamada — testes podem trocar a env). */
export function dataDir() {
  return process.env.RAIOX_DATA_DIR || raizPadrao
}

function garantirPasta(pasta) {
  mkdirSync(pasta, { recursive: true })
  return pasta
}

/** Nome de arquivo/pasta seguro: só letras, dígitos, ponto, traço e underscore. */
function nomeSeguro(nome, rotulo) {
  if (typeof nome !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(nome) || nome.startsWith('.')) {
    throw new Error(`${rotulo} inválido: ${String(nome)}`)
  }
  return nome
}

export function validarId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error('id inválido')
  return id
}

/** 10 chars base36 a partir de bytes aleatórios do crypto. */
export function novoId() {
  // 8 bytes → inteiro grande → base36; completa/corta para 10 chars.
  const n = BigInt('0x' + randomBytes(8).toString('hex'))
  return n.toString(36).padStart(10, '0').slice(-10)
}

export function appendJsonl(arquivo, obj) {
  nomeSeguro(arquivo, 'arquivo')
  const pasta = garantirPasta(dataDir())
  const caminho = join(pasta, arquivo)
  appendFileSync(caminho, JSON.stringify(obj) + '\n', 'utf8')
  return caminho
}

export function salvarJson(pastaNome, id, obj) {
  nomeSeguro(pastaNome, 'pasta')
  validarId(id)
  const pasta = garantirPasta(join(dataDir(), pastaNome))
  const final = join(pasta, `${id}.json`)
  // Escreve num temporário e renomeia: leitura nunca vê arquivo pela metade.
  const tmp = join(pasta, `.${id}.${process.pid}.tmp`)
  writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8')
  renameSync(tmp, final)
  return final
}

export function lerJson(pastaNome, id) {
  nomeSeguro(pastaNome, 'pasta')
  if (typeof id !== 'string' || !ID_RE.test(id)) return null
  try {
    return JSON.parse(readFileSync(join(dataDir(), pastaNome, `${id}.json`), 'utf8'))
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
}
