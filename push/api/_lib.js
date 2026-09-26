// Shared helpers of the Golgoth push server.
import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { getCache } from '@vercel/functions'

const ORIGINS = new Set(['https://ilyomix.github.io', 'http://localhost:5173', 'http://localhost:4173'])
// Push services of Safari/iOS, Chrome, Firefox and Edge. Anything else is refused.
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/]

export const cache = getCache({ namespace: 'golgoth-push' })

export function cors(req, res) {
  const origin = req.headers.origin
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

/** Bodies arrive as text/plain (a "simple" CORS request, no preflight) or JSON. */
export function readBody(req) {
  const b = req.body
  if (!b) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b)
    } catch {
      return {}
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'))
    } catch {
      return {}
    }
  }
  return b
}

export function selfHost(req) {
  return req.headers['x-forwarded-host'] || req.headers.host
}

export function validSubscription(sub, req) {
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string') return false
  let url
  try {
    url = new URL(sub.endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  // The deployment's own /api/echo is a test sink used to check timings end to end.
  const own = req && url.host === selfHost(req) && url.pathname === '/api/echo'
  if (!own && !PUSH_HOSTS.some((re) => re.test(url.hostname))) return false
  const k = sub.keys
  return !!k && typeof k.p256dh === 'string' && typeof k.auth === 'string' && k.p256dh.length < 200 && k.auth.length < 64
}

export const keyOf = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40)

export const text = (x, fallback, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : fallback)

export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)))

let configured = false
export function send(subscription, payload) {
  if (!configured) {
    // Subject: the app's page (a contact URL for the push services), no e-mail address.
    webpush.setVapidDetails('https://ilyomix.github.io/golgoth/', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
    configured = true
  }
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 120, urgency: 'high', topic: 'golgoth-rest' })
}
