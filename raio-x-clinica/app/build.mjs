// Empacota o app num único HTML (sem módulos, sem fetch) pra publicar em qualquer lugar
// que aceite um arquivo só: artifact, Notion, e-mail, pen drive.
//
//   node app/build.mjs                       → app/dist/raio-x.html
//   node app/build.mjs saida.html            → caminho custom
//   node app/build.mjs saida.html --artifact → sem <html>/<head>/<body> (pra hosts que embrulham a página)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const args = process.argv.slice(2)
const artifact = args.includes('--artifact')
const out = args.find((a) => !a.startsWith('--')) || join(here, 'dist', 'raio-x.html')

const read = (p) => readFileSync(join(root, p), 'utf8')

// Remove import/export mantendo as declarações. Os módulos não repetem nomes entre si.
function desmodularizar(src) {
  return src
    .replace(/^import[\s\S]*?from\s+'[^']+'\s*;?\s*$/gm, '')
    .replace(/^export default .*$/gm, '')
    .replace(/^export\s+(const|let|var|function|async function|class)\s/gm, '$1 ')
}

const modulos = ['lib/questions.js', 'lib/score.js', 'app/scripts/flow.js', 'app/scripts/app.js']
  .map((p) => `// ---- ${p}\n${desmodularizar(read(p))}`)
  .join('\n\n')

const fixture = read('lib/exemplo.secretaria-r500.json').trim()
const css = read('app/styles/app.css')

let html = read('app/index.html')
html = html.replace(/<link rel="stylesheet" href="styles\/app.css">/, () => `<style>\n${css}\n</style>`)
html = html.replace(
  /<script type="module" src="scripts\/app.js"><\/script>/,
  () => `<script>window.__RAIOX_FIXTURE__ = ${fixture};</script>\n<script>\n${modulos}\n</script>`, // função: evita $$ virar $
)

if (artifact) {
  html = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>|<\/html>|<head>|<\/head>|<body[^>]*>|<\/body>/g, '')
    .replace(/<meta charset="utf-8">\s*|<meta name="viewport"[^>]*>\s*/g, '')
    .trim()
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, html)
console.error(`ok → ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`)
