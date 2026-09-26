// Test sink standing in for a push service: records when each push arrives.
// POST /api/echo?id=… (from web-push) · GET /api/echo?id=… → the arrival times.
import { cache, cors } from './_lib.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  const id = String(req.query?.id ?? '').slice(0, 40)
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return res.status(400).json({ error: 'id' })
  const key = `echo-${id}`
  if (req.method === 'POST') {
    const list = (await cache.get(key)) ?? []
    await cache.set(key, [...(Array.isArray(list) ? list : []), Date.now()].slice(-20), { ttl: 900, name: 'echo' })
    return res.status(201).end()
  }
  res.status(200).json({ id, received: (await cache.get(key)) ?? [] })
}
