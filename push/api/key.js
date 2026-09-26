// GET → the VAPID public key the app subscribes with (and which cache backs the rests).
import { cors } from './_lib.js'

function cacheMode() {
  const ctx = globalThis[Symbol.for('@vercel/request-context')]?.get?.() ?? {}
  if (ctx.cache) return 'runtime'
  return process.env.RUNTIME_CACHE_ENDPOINT && process.env.RUNTIME_CACHE_HEADERS ? 'runtime-env' : 'memory'
}

export default function handler(req, res) {
  if (cors(req, res)) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) return res.status(503).json({ error: 'not configured' })
  res.status(200).json({ publicKey, cache: cacheMode() })
}
