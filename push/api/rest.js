// POST { subscription, endAt, token, title, body } → the notification is sent at endAt.
// A newer call for the same subscription (rest adjusted) or /api/cancel supersedes it.
import { waitUntil } from '@vercel/functions'
import { cache, cors, keyOf, readBody, selfHost, send, sleep, text, validSubscription } from './_lib.js'

const HOP = 270_000 // stay well under the 300 s limit, then hand over to a fresh invocation

export default async function handler(req, res) {
  if (cors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { subscription, endAt, token, title, body, hop } = readBody(req)
  if (!validSubscription(subscription, req) || typeof endAt !== 'number' || typeof token !== 'string' || token.length > 80) {
    return res.status(400).json({ error: 'invalid request' })
  }
  const now = Date.now()
  if (endAt < now - 10_000 || endAt > now + 30 * 60_000) return res.status(400).json({ error: 'endAt out of range' })
  const key = keyOf(subscription.endpoint)
  if (!hop) await cache.set(key, { token, endAt }, { ttl: 3600, name: 'rest' })
  const payload = {
    title: text(title, 'Repos terminé', 80),
    body: text(body, 'Série suivante.', 160),
    tag: 'golgoth-rest',
    at: endAt,
    url: './#/seance',
  }
  waitUntil(run({ host: selfHost(req), key, subscription, endAt, token, payload }))
  res.status(202).json({ ok: true, in: Math.max(0, endAt - now) })
}

async function current(key, token) {
  const v = await cache.get(key)
  return !!v && typeof v === 'object' && v.token === token
}

async function run({ host, key, subscription, endAt, token, payload }) {
  const wait = endAt - Date.now()
  if (wait > HOP) {
    await sleep(HOP)
    if (!(await current(key, token))) return
    await fetch(`https://${host}/api/rest`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ subscription, endAt, token, title: payload.title, body: payload.body, hop: true }),
    }).catch(() => undefined)
    return
  }
  await sleep(wait)
  if (!(await current(key, token))) return
  try {
    await send(subscription, payload)
  } catch (e) {
    console.error('push failed', e?.statusCode, e?.body)
  }
  if (await current(key, token)) await cache.delete(key)
}
