/** Serialise native mutations: a slow update must never recreate a finished session. */
export function latestSync<T>(send: (value: T) => Promise<void>, failed: (error: unknown) => void) {
  let pending: { value: T } | undefined
  let running = false
  async function drain() {
    running = true
    while (pending) {
      const next = pending
      pending = undefined
      try { await send(next.value) } catch (error) { failed(error) }
    }
    running = false
  }
  return (value: T) => {
    pending = { value }
    if (!running) void drain()
  }
}
