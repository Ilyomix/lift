const KEY = '__liftNavigation'
type Entry = { id: string; index: number; previousHash?: string }
type Host = Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>

function entry(value: unknown): Entry | undefined {
  const candidate = (value as Record<string, unknown> | null)?.[KEY] as Partial<Entry> | undefined
  return candidate && typeof candidate.id === 'string' && Number.isInteger(candidate.index) && candidate.index! >= 0
    ? candidate as Entry : undefined
}

const fresh = (index: number, previousHash?: string): Entry => ({ id: `${Date.now()}-${Math.random()}`, index, previousHash })

/** Track only Lift entries. history.length also counts unrelated sites. */
export function createNavigationHistory(host: Host) {
  const stateWith = (next: Entry) => ({ ...(host.history.state ?? {}), [KEY]: next })
  let current = entry(host.history.state) ?? fresh(0)
  let hash = host.location.hash
  const hashes = new Map<number, string>([[current.index, hash]])
  if (current.previousHash !== undefined) hashes.set(current.index - 1, current.previousHash)
  if (!entry(host.history.state)) host.history.replaceState(stateWith(current), '')

  const changed = () => {
    const known = entry(host.history.state)
    if (known && known.id !== current.id) current = known // Back/Forward traversal.
    else if (host.location.hash !== hash) {
      // A normal #/ link creates an entry without going through navigate().
      current = fresh(current.index + 1, hash)
      host.history.replaceState(stateWith(current), '')
    }
    hash = host.location.hash
    hashes.set(current.index, hash)
  }
  host.addEventListener('hashchange', changed)
  host.addEventListener('popstate', changed)

  return {
    canGoBack: () => current.index > 0,
    previousHash: () => hashes.get(current.index - 1) ?? current.previousHash,
    position: () => entry(host.history.state)?.index ?? current.index,
    navigate(target: string, replace = false) {
      if (target === host.location.hash) return false
      if (!replace) {
        current = fresh(current.index + 1, hash)
        for (const key of hashes.keys()) if (key >= current.index) hashes.delete(key)
      }
      if (replace) host.history.replaceState(stateWith(current), '', target)
      else host.history.pushState(stateWith(current), '', target)
      hash = host.location.hash
      hashes.set(current.index, hash)
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
