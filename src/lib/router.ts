import { useSyncExternalStore } from 'react'
import { createNavigationHistory } from './navigationHistory'

let history: ReturnType<typeof createNavigationHistory> | undefined
const navigationHistory = () => history ??= createNavigationHistory(window)
// Event-local intent: a tab tap must not change future Back/Forward transitions.
const directChanges = new WeakSet<Event>()
export const isDirectRouteChange = (event: Event) => directChanges.has(event)

function subscribe(cb: () => void) {
  navigationHistory()
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const snapshot = () => window.location.hash

/** Invalid or incomplete URL escapes must not prevent Lift from rendering. */
export function decodeRouteHash(hash: string): string[] {
  try {
    return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  } catch (error) {
    if (error instanceof URIError) return []
    throw error
  }
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '')
  return decodeRouteHash(hash)
}

export function navigate(path: string, opts: { replace?: boolean; transition?: 'none' } = {}) {
  const target = `#/${path.replace(/^\/+/, '')}`
  if (navigationHistory().navigate(target, opts.replace)) {
    const event = new HashChangeEvent('hashchange')
    if (opts.transition === 'none') directChanges.add(event)
    window.dispatchEvent(event)
  }
  window.scrollTo({ top: 0 })
}

export function back(fallback: string) {
  if (!goBack()) navigate(fallback, { replace: true })
}

export const canGoBack = () => navigationHistory().canGoBack()
export const goBack = () => navigationHistory().goBack()
export const navigationPosition = () => navigationHistory().position()
export const previousRoute = () => {
  const hash = navigationHistory().previousHash()
  return hash === undefined ? undefined : decodeRouteHash(hash).join('/')
}
