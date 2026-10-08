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
export function createNavigationHistory(host: Host, confirmLeave: () => boolean | Promise<boolean> = () => true) {
  const stateWith = (next: Entry) => ({ ...(host.history.state ?? {}), [KEY]: next })
  let current = entry(host.history.state) ?? fresh(0)
  let hash = host.location.hash
  const hashes = new Map<number, string>([[current.index, hash]])
  if (current.previousHash !== undefined) hashes.set(current.index - 1, current.previousHash)
  if (!entry(host.history.state)) host.history.replaceState(stateWith(current), '')
  let approvedId: string | undefined
  let approvedIndex: number | undefined
  let restoring: { id: string; done: Promise<void>; finish: () => void } | undefined
  let suppressHash: string | undefined
  let busy = false, disposed = false
  const waitForRestoration = async () => { while (restoring) await restoring.done }

  const restore = (from: Entry) => {
    if (restoring) return restoring.done
    let finish!: () => void
    const done = new Promise<void>(resolve => { finish = resolve })
    restoring = { id: current.id, done, finish }
    host.history.go(current.index - from.index)
    return done
  }
  const changed = (event: Event) => {
    if (disposed) return
    const known = entry(host.history.state)
    const target = host.location.hash
    // Browser Back/Forward changes the URL before dispatching these events.
    // Restore that entry before showing the asynchronous Lift confirmation;
    // React continues to read only the confirmed route throughout the choice.
    if (restoring) {
      event.stopImmediatePropagation()
      if (known?.id === restoring.id) {
        const { finish } = restoring
        restoring = undefined
        suppressHash = target
        finish()
      }
      return
    }
    if (event.type === 'hashchange' && suppressHash === target) {
      suppressHash = undefined
      event.stopImmediatePropagation()
      return
    }
    suppressHash = undefined
    if (known?.id === current.id && target === hash) return
    const next = known && known.id !== current.id ? known : fresh(current.index + 1, hash)
    const approved = approvedId === next.id || approvedIndex === next.index
    if (target !== hash && !approved) {
      event.stopImmediatePropagation()
      // Index raw hash links as well, preserving their Forward destination.
      if (!known || known.id === current.id) host.history.replaceState(stateWith(next), '')
      const restored = restore(next)
      if (busy) return
      busy = true
      const delta = next.index - current.index
      void (async () => {
        try {
          const allowed = await confirmLeave()
          await restored
          await waitForRestoration()
          if (!allowed || disposed) return
          approvedId = next.id
          host.history.go(delta)
        } finally { busy = false }
      })()
      return
    }
    approvedId = undefined; approvedIndex = undefined
    if (known && known.id !== current.id) {
      current = { ...known, previousHash: hashes.get(known.index - 1) ?? known.previousHash }
      if (current.previousHash !== known.previousHash) host.history.replaceState(stateWith(current), '')
    } else if (target !== hash) {
      current = next
      for (const key of hashes.keys()) if (key >= current.index) hashes.delete(key)
      host.history.replaceState(stateWith(current), '')
    }
    hash = target
    hashes.set(current.index, hash)
  }
  host.addEventListener('hashchange', changed, true)
  host.addEventListener('popstate', changed, true)

  return {
    canGoBack: () => current.index > 0,
    previousHash: () => hashes.get(current.index - 1) ?? current.previousHash,
    position: () => current.index,
    currentHash: () => hash,
    async navigate(target: string, replace = false) {
      if (busy || restoring || approvedId !== undefined || approvedIndex !== undefined || target === hash || disposed) return false
      busy = true
      try {
        if (!await confirmLeave() || disposed) return false
        await waitForRestoration()
        if (disposed) return false
        suppressHash = undefined
        if (!replace) {
          current = fresh(current.index + 1, hash)
          for (const key of hashes.keys()) if (key >= current.index) hashes.delete(key)
        }
        if (replace) host.history.replaceState(stateWith(current), '', target)
        else host.history.pushState(stateWith(current), '', target)
        hash = host.location.hash
        hashes.set(current.index, hash)
        return true
      } finally { busy = false }
    },
    async goBack() {
      if (busy || restoring || approvedId !== undefined || approvedIndex !== undefined || current.index === 0 || disposed) return false
      busy = true
      try {
        if (((hashes.get(current.index - 1) ?? current.previousHash) !== hash && !await confirmLeave()) || disposed) return false
        await waitForRestoration()
        if (disposed) return false
        approvedIndex = current.index - 1
        suppressHash = undefined
        host.history.back()
        return true
      } finally { busy = false }
    },
    dispose() {
      disposed = true
      host.removeEventListener('hashchange', changed, true)
      host.removeEventListener('popstate', changed, true)
    },
  }
}
