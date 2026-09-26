import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const snapshot = () => window.location.hash

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '')
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = `#/${path.replace(/^\/+/, '')}`
  if (opts.replace) window.history.replaceState(null, '', target)
  else window.location.hash = target
  if (opts.replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
  window.scrollTo({ top: 0 })
}

export function back(fallback: string) {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, { replace: true })
}
