# UI do laudo (camada visual)

O motor em `lib/` não desenha nada. Esta pasta é o card que a clínica printa.

```
ui/laudo.html     landing + card (layout da referência)
ui/laudo.css
ui/laudo.js       radar SVG + barras + badges + SWOT
ui/demo-laudo.json
```

Abrir:

```sh
cd raio-x-clinica/ui
npx --yes serve . -p 4173
```

O quiz, quando existir, chama `renderLaudo(laudoJson)` com a saída do prompt + scores do motor.

Ainda não é o quiz interativo. É o artefato de resultado — a peça que o carrossel promete.
