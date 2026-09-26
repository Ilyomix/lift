// POST { subscription } → the pending end-of-rest notification is dropped.
import { cache, cors, keyOf, readBody, validSubscription } from './_lib.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { subscription } = readBody(req)
  if (!validSubscription(subscription, req)) return res.status(400).json({ error: 'invalid request' })
  await cache.delete(keyOf(subscription.endpoint))
  res.status(200).json({ ok: true })
}
