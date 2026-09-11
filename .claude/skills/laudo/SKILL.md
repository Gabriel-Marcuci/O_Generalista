---
name: laudo
description: Gera o Laudo Raio-X da Clínica a partir das respostas do quiz. Roda o motor (raio-x-clinica/lib/score.js), pega o payload e escreve o laudo em JSON seguindo raio-x-clinica/prompt-laudo.md. Use quando o usuário pedir "/laudo", "gera o laudo", "roda o raio-x", "diagnóstico da clínica" ou colar respostas do quiz.
---

# /laudo — Raio-X da Clínica

O código decide. Você escreve.

## Passos

1. **Pegar as respostas.** O usuário passa um arquivo JSON no shape de `raio-x-clinica/lib/questions.js` ou cola as respostas em texto. Se colar em texto, monte o JSON com os IDs do contrato e mostre antes de rodar. Pergunta sem resposta fica `null`.

2. **Rodar o motor.**
   ```sh
   node raio-x-clinica/lib/cli.js <arquivo>.json --payload
   ```
   Se `missing` tiver as roteadoras (R3–R6) ou S1–S5 em branco, avise: o roteamento perde precisão.

3. **Escrever o laudo.** Ler `raio-x-clinica/prompt-laudo.md` e produzir o JSON de saída com o `payload` como entrada. Regras que não se negociam:
   - `oferta.principal`, `persona`, `selo_preco` e `selo_papel` iguais ao `motor`.
   - Nunca TRAFEGO como passo 1 se `motor.trafego_proibido_passo_1 = true`.
   - Nenhum número que a clínica não informou. Se não mediu, "vocês não medem".
   - Nenhum elogio a eixo com score < 55.
   - Sem a palavra "dentista". HOF é linha de procedimento.

4. **Salvar** em `saidas/laudos/<nome>-<data>.json` e mostrar ao usuário a `whatsapp_msg_1` separada, pronta pra copiar.

## Compliance

Clínica de estética é nicho regulado. O laudo fala de processo comercial, não de resultado clínico. Nada de promessa de resultado de procedimento no `frase_share` nem na mensagem de WhatsApp.
