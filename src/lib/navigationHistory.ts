const KEY = '__liftNavigation'
type Entry = { id: string; index: number }
type Host = Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>

function entry(value: unknown): Entry | undefined {
  const candidate = (value as Record<string, unknown> | null)?.[KEY] as Partial<Entry> | undefined
  return candidate && typeof candidate.id === 'string' && Number.isInteger(candidate.index) && candidate.index! >= 0
    ? candidate as Entry : undefined
}

const fresh = (index: number): Entry => ({ id: `${Date.now()}-${Math.random()}`, index })

/** Track only Lift entries. history.length also counts unrelated sites. */
export function createNavigationHistory(host: Host) {
  const stateWith = (next: Entry) => ({ ...(host.history.state ?? {}), [KEY]: next })
  let current = entry(host.history.state) ?? fresh(0)
  let hash = host.location.hash
  if (!entry(host.history.state)) host.history.replaceState(stateWith(current), '')

  const changed = () => {
    const known = entry(host.history.state)
    if (known && known.id !== current.id) current = known // Back/Forward traversal.
    else if (host.location.hash !== hash) {
      // A normal #/ link creates an entry without going through navigate().
      current = fresh(current.index + 1)
      host.history.replaceState(stateWith(current), '')
    }
    hash = host.location.hash
  }
  host.addEventListener('hashchange', changed)
  host.addEventListener('popstate', changed)

  return {
    canGoBack: () => current.index > 0,
    navigate(target: string, replace = false) {
      if (target === host.location.hash) return false
      if (!replace) current = fresh(current.index + 1)
      if (replace) host.history.replaceState(stateWith(current), '', target)
      else host.history.pushState(stateWith(current), '', target)
      hash = host.location.hash
      return true
    },
    goBack() {
      if (current.index === 0) return false
      host.history.back()
      return true
    },
    dispose() {
      host.removeEventListener('hashchange', changed)
      host.removeEventListener('popstate', changed)
    },
  }
}
