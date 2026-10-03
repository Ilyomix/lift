import { isNative } from './native/bridge'
// End-of-rest notifications through a push server: they arrive with the phone locked,
// when the page itself is asleep. The server only stores a subscription for the length
// of a rest (a one-hour cache entry), never an account or personal data.
import { L } from './i18n'

export const PUSH_API = 'https://golgoth-push.vercel.app/api'
const SUB_KEY = 'golgoth-push-subscription'

export type PushState = 'on' | 'off' | 'denied' | 'unsupported' | 'needs-install'

export function pushSupported(): boolean {
  return !isNative() && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

let registration: ServiceWorkerRegistration | null = null
let publicKey: string | null = null
let preparing: Promise<void> | null = null

/**
 * Resolves the service worker and the server key ahead of time: on iOS the
 * subscription must start inside the tap, with nothing awaited before it.
 */
export function preparePush(): Promise<void> {
  if (!pushSupported()) return Promise.resolve()
  preparing ??= (async () => {
    try {
      registration = await navigator.serviceWorker.ready
      const r = await fetch(`${PUSH_API}/key`, { cache: 'no-store' })
      if (r.ok) publicKey = ((await r.json()) as { publicKey?: string }).publicKey ?? null
    } catch {
      /* offline: retried on the next call */
    } finally {
      if (!publicKey) preparing = null
    }
  })()
  return preparing
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function stored(): PushSubscriptionJSON | null {
  try {
    const raw = localStorage.getItem(SUB_KEY)
    return raw ? (JSON.parse(raw) as PushSubscriptionJSON) : null
  } catch {
    return null
  }
}

function store(sub: PushSubscriptionJSON | null) {
  try {
    if (sub) localStorage.setItem(SUB_KEY, JSON.stringify(sub))
    else localStorage.removeItem(SUB_KEY)
  } catch {
    /* private mode: push works for this session only */
  }
}

let current: PushSubscriptionJSON | null = null

export function pushReady(): boolean {
  return !!(current ?? stored())
}

/**
 * Must be called from a tap, with preparePush() done beforehand: WebKit only lets
 * pushManager.subscribe() prompt inside the gesture, so it is the first call made.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (!registration || !publicKey) {
    await preparePush()
    if (!registration || !publicKey) throw new Error(L('Serveur de notifications injoignable. Vérifie ta connexion et réessaie.', 'Notification server unreachable. Check your connection and try again.'))
  }
  const options = { userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }
  let sub: PushSubscription
  try {
    sub = await registration.pushManager.subscribe(options)
  } catch (e) {
    if (Notification.permission === 'denied') return 'denied'
    // Subscribed earlier with another server key: start over.
    const old = await registration.pushManager.getSubscription()
    if (!old) throw e
    await old.unsubscribe()
    sub = await registration.pushManager.subscribe(options)
  }
  current = sub.toJSON()
  store(current)
  return 'on'
}

export async function disablePush(): Promise<void> {
  const sub = current ?? stored()
  current = null
  store(null)
  try {
    const reg = registration ?? (await navigator.serviceWorker.ready)
    await (await reg.pushManager.getSubscription())?.unsubscribe()
  } catch {
    /* already gone */
  }
  if (sub) void post('cancel', { subscription: sub })
}

function post(path: string, body: unknown): Promise<Response | null> {
  // text/plain keeps the request "simple": no CORS preflight, one round trip.
  return fetch(`${PUSH_API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), keepalive: true }).catch(() => null)
}

/** Schedules the end-of-rest notification; a new call replaces the previous one. */
export function scheduleRestPush(endAt: number, title: string, body: string): void {
  if (isNative()) return
  const subscription = current ?? stored()
  if (!subscription) return
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
  void post('rest', { subscription, endAt, token, title, body })
}

export function cancelRestPush(): void {
  if (isNative()) return
  const subscription = current ?? stored()
  if (!subscription) return
  void post('cancel', { subscription })
}

/** A test notification a few seconds from now, to lock the phone and check. */
export function testPush(delaySeconds = 8): boolean {
  if (isNative()) return false
  const subscription = current ?? stored()
  if (!subscription) return false
  const token = `test-${Date.now().toString(36)}`
  void post('rest', {
    subscription,
    endAt: Date.now() + delaySeconds * 1000,
    token,
    title: L('Test Lift', 'Lift test'),
    body: L('Les fins de repos arriveront comme ça, écran verrouillé.', 'End-of-rest alerts will arrive like this, with the screen locked.'),
  })
  return true
}
