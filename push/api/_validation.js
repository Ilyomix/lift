// Pure request-boundary checks. No network, cache, or credentials.
const ORIGINS = new Set(['https://ilyomix.github.io', 'http://localhost:5173', 'http://localhost:4173'])
// Push services of Safari/iOS, Chrome, Firefox and Edge. Anything else is refused.
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/]

export function cors(req, res) {
  const origin = req.headers.origin
  if (origin && !ORIGINS.has(origin)) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(403).end()
    return true
  }
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
  let b = req.body
  if (!b) return {}
  if (typeof b === 'string') {
    try {
      b = JSON.parse(b)
    } catch {
      return {}
    }
  }
  else if (Buffer.isBuffer(b)) {
    try {
      b = JSON.parse(b.toString('utf8'))
    } catch {
      return {}
    }
  }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : {}
}

export function selfHost() {
  // Headers belong to the request, not to our deployment configuration. They
  // must not turn the echo allowance or long-rest handoff into an arbitrary URL.
  const configured = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'golgoth-push.vercel.app'
  try {
    const url = new URL(`https://${configured}`)
    if (!url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash) return url.host
  } catch { /* use the known production deployment */ }
  return 'golgoth-push.vercel.app'
}

export function validSubscription(sub, req) {
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string') return false
  let url
  try {
    url = new URL(sub.endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false
  // The deployment's own /api/echo is a test sink used to check timings end to end.
  const own = req && url.host === selfHost(req) && url.pathname === '/api/echo'
  if (!own && !PUSH_HOSTS.some((re) => re.test(url.hostname))) return false
  const k = sub.keys
  return !!k && typeof k.p256dh === 'string' && typeof k.auth === 'string' && k.p256dh.length < 200 && k.auth.length < 64
}
