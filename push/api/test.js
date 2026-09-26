// POST { subscription } → an immediate test notification.
import { cors, readBody, send, validSubscription } from './_lib.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { subscription } = readBody(req)
  if (!validSubscription(subscription, req)) return res.status(400).json({ error: 'invalid request' })
  try {
    await send(subscription, { title: 'Golgoth', body: 'Notifications activées.', tag: 'golgoth-test', at: Date.now(), url: './' })
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: 'push service', status: e?.statusCode ?? null })
  }
}
