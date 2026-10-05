// POST { subscription, lang?: "fr" | "en" } → an immediate test notification.
import { cors, readBody, send, validSubscription } from './_lib.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { subscription, lang } = readBody(req)
  if (!validSubscription(subscription, req)) return res.status(400).json({ error: 'invalid request' })
  try {
    // Older clients omit lang; keep their French fallback. Never echo arbitrary copy.
    const english = lang === 'en'
    await send(subscription, { title: english ? 'Lift test' : 'Test Lift', body: english ? 'Test notification received.' : 'Notification de test reçue.', tag: 'golgoth-test', at: Date.now(), url: './' })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: 'push service', status: e?.statusCode ?? null })
  }
}
