import { useSyncExternalStore } from 'react'
import { createNavigationHistory } from './navigationHistory'

let history: ReturnType<typeof createNavigationHistory> | undefined
const navigationHistory = () => history ??= createNavigationHistory(window)

function subscribe(cb: () => void) {
  navigationHistory()
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
  if (navigationHistory().navigate(target, opts.replace)) window.dispatchEvent(new HashChangeEvent('hashchange'))
  window.scrollTo({ top: 0 })
}

export function back(fallback: string) {
  if (!goBack()) navigate(fallback, { replace: true })
}

export const canGoBack = () => navigationHistory().canGoBack()
export const goBack = () => navigationHistory().goBack()
