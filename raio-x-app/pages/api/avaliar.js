import { avaliar } from '../../lib/score.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Apenas POST' })
  }

  try {
    const resultado = avaliar(req.body)
    res.status(200).json(resultado)
  } catch (e) {
    res.status(400).json({ erro: e.message })
  }
}
