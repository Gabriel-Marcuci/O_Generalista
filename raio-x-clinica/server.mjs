/**
 * Dev local: npm run dev - ou node server.mjs
 *
 *   http://127.0.0.1:8787/app/           quiz + laudo ao vivo
 *   POST http://127.0.0.1:8787/api/avaliar
 *
 * Serve os arquivos estáticos desta pasta (app/, lib/, ui/) e a API.
 */
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeListener } from './api/avaliar.js'

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

function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
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

createServer((req, res) => {
  if (req.url.startsWith('/api/')) return nodeListener(req, res)
  serveStatic(req, res)
}).listen(port, () => {
  console.error(`Raio-X  app  http://127.0.0.1:${port}/app/`)
  console.error(`Raio-X  API  POST http://127.0.0.1:${port}/api/avaliar`)
})
