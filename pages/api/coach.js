export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { trades } = req.body
  if (!trades || !trades.length) return res.status(400).json({ error: 'No trades' })

  const MISTAKES_LIST = [
    'Moví mi stop loss más lejos','Quité el stop loss','Entré sin confirmación',
    'Entré tarde (FOMO)','Entré antes de tiempo','Entré fuera de mi zona',
    'Entré sin ver el contexto (tendencia / estructura)',
  ]

  const summary = trades.slice(0, 40).map(t =>
    `Fecha:${t.date} Dir:${t.direction} PnL:${t.pnl}$ Sesión:${t.session} Emoción:${t.emotion} SiguióPlan:${t.followed_plan} Errores:${(t.mistakes||[]).map(i=>MISTAKES_LIST[i]||i).join(',')} Razones:${(t.entry_reasons||[]).join(',')} Notas:${t.notes}`
  ).join('\n')

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `Eres un coach de trading especializado en MNQ. Lucid 25K: stop $50, target mínimo $75 (R:R 1.5:1), pérdida diaria máx $150, MLL $1000, 1-3 trades/día, 1-2 contratos. Estrategia: zonas 1H/30min, confirmación volumen 1min. Sesión principal 15:45-17:30h España. Objetivo evaluación $1250. Feedback directo y accionable. Estructura: 1) Qué va bien, 2) Qué falla, 3) Una cosa concreta a mejorar esta semana. Máx 300 palabras.`,
        messages: [{ role: 'user', content: `Analiza estos trades:\n\n${summary}` }],
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text || 'Sin respuesta.'
    res.status(200).json({ result: text })
  } catch (e) {
    res.status(500).json({ error: 'Error al conectar con el coach.' })
  }
}
