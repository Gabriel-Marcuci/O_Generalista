/**
 * Dev local: npm run dev - ou node server.mjs
 * POST http://127.0.0.1:8787/api/avaliar
 */
import { createServer } from 'node:http'
import { nodeListener } from './api/avaliar.js'

const port = Number(process.env.PORT || 8787)
createServer(nodeListener).listen(port, () => {
  console.error(`Raio-X POST http://127.0.0.1:${port}/api/avaliar`)
})
