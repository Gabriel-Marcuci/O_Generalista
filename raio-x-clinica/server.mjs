/**
 * Dev local / produção simples: npm start (ou npm run dev)
 *
 *   http://127.0.0.1:8787/app/           quiz + laudo ao vivo
 *   http://127.0.0.1:8787/l/<id>         laudo salvo (link público)
 *   POST /api/avaliar    motor puro
 *   POST /api/lead       grava lead + webhook
 *   POST /api/laudo      laudo comentado pelo modelo
 *   POST /api/salvar     salva laudo → /l/<id>
 *   GET  /api/laudo/:id  lê laudo salvo
 *
 * Serve os arquivos estáticos desta pasta (app/, lib/, ui/) e a API.
 * Variáveis: PORT, ANTHROPIC_API_KEY, LAUDO_MODEL, LEAD_WEBHOOK_URL, RAIOX_DATA_DIR (ver .env.example).
 */
import { createServer } from 'node:http'
import { createReadStream, statSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeListener as avaliar } from './api/avaliar.js'
import { nodeListener as lead } from './api/lead.js'
import { nodeListener as laudo } from './api/laudo.js'
import { nodeListener as salvar } from './api/salvar.js'
import { ID_RE } from './lib/storage.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT || 8787)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
}

function serveStatic(req, res, pathname) {
  let path = pathname
  if (path === '/') path = '/app/'
  if (path.endsWith('/')) path += 'index.html'
  const file = normalize(join(root, path))
  if (!file.startsWith(root)) { res.writeHead(403); return res.end() }
  let st
  try { st = statSync(file) } catch { res.writeHead(404); return res.end('não encontrado') }
  if (st.isDirectory()) { res.writeHead(301, { location: path + '/' }); return res.end() }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
  createReadStream(file).pipe(res)
}

/**
 * GET /l/:id → app/index.html. Os assets do index são relativos (styles/, scripts/),
 * então injeta <base href="/app/"> pra eles resolverem certo fora de /app/.
 * O frontend lê o id em location.pathname e busca GET /api/laudo/:id.
 */
function serveLaudoPublico(res) {
  let html
  try { html = readFileSync(join(root, 'app', 'index.html'), 'utf8') } catch {
    res.writeHead(404); return res.end('app/index.html não encontrado')
  }
  if (!/<base\s/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, (m) => `${m}\n<base href="/app/">`)
  }
  res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' })
  res.end(html)
}

function notFoundApi(res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: false, erro: 'rota_inexistente' }))
}

export function rotear(req, res) {
  let pathname
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname) } catch {
    res.writeHead(400); return res.end('URL inválida')
  }

  if (pathname === '/api/avaliar') return avaliar(req, res)
  if (pathname === '/api/lead') return lead(req, res)
  if (pathname === '/api/salvar') return salvar(req, res)
  if (pathname === '/api/laudo' || pathname.startsWith('/api/laudo/')) return laudo(req, res)
  if (pathname.startsWith('/api/')) return notFoundApi(res)

  const publico = /^\/l\/([^/]+)\/?$/.exec(pathname)
  if (publico) {
    if (!ID_RE.test(publico[1])) { res.writeHead(404); return res.end('não encontrado') }
    return serveLaudoPublico(res)
  }

  serveStatic(req, res, pathname)
}

createServer(rotear).listen(port, () => {
  console.error(`Raio-X  app    http://127.0.0.1:${port}/app/`)
  console.error(`Raio-X  API    POST /api/avaliar · /api/lead · /api/laudo · /api/salvar   GET /api/laudo/:id · /l/:id`)
  console.error(`Raio-X  laudo  ${process.env.ANTHROPIC_API_KEY ? 'chave ok' : 'sem ANTHROPIC_API_KEY (POST /api/laudo → 503)'} · webhook ${process.env.LEAD_WEBHOOK_URL ? 'ligado' : 'desligado'}`)
})
