import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { useStore } from '../src/lib/store'

for (const failedDatabase of ['golgoth', 'golgoth-photos']) {
  test(`init keeps a distinguishable loading error when ${failedDatabase} is unreadable`, async () => {
    const indexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
    const original = useStore.getState()
    const saved = defaultState(); saved.profile.heightCm = 185
    const connections: Array<{ onclose?: () => void }> = []
    let writes = 0
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
      open(name: string) {
        const db = { onclose: undefined as (() => void) | undefined, transaction(mode: string, type: string) {
          if (type === 'readwrite') writes++
          if (name === failedDatabase) throw new DOMException('Temporarily unavailable', 'InvalidStateError')
          return { objectStore() { return { get() {
            const request = { result: saved, onsuccess: undefined as (() => void) | undefined }
            queueMicrotask(() => request.onsuccess?.()); return request
          } } } }
        } }
        connections.push(db)
        const request = { result: db, onsuccess: undefined as (() => void) | undefined }
        queueMicrotask(() => request.onsuccess?.()); return request
      },
    } })
    useStore.setState({ ready: false, hasData: false, storage: 'idb' })
    try {
      await useStore.getState().init()
      assert.equal(useStore.getState().ready, true)
      assert.equal(useStore.getState().storage, 'memory', 'App must render retry/error, not treat this as a confirmed empty profile')
      assert.equal(useStore.getState().hasData, false)
      assert.equal(writes, 0)
      assert.equal(saved.profile.heightCm, 185)
    } finally {
      for (const db of connections) db.onclose?.()
      useStore.setState(original, true)
      if (indexedDB) Object.defineProperty(globalThis, 'indexedDB', indexedDB); else Reflect.deleteProperty(globalThis, 'indexedDB')
    }
  })
}
