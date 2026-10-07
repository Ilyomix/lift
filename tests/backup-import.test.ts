import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { useStore } from '../src/lib/store'

test('a failed photo transaction leaves the existing backup intact and import can be retried', async () => {
  const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  const originalStore = useStore.getState()
  const oldState = defaultState()
  const oldWorkout = { id: 'old-workout', date: '2026-10-06', type: 'UPPER' as const, sessionNumber: 1, startedAt: '', completedAt: '', notes: '', exercises: [] }
  oldState.workouts = [oldWorkout]
  const oldPhoto = { id: 'original', date: '2026-10-07', name: 'original.png', dataUrl: 'data:image/png;base64,original' }
  const photos = [0, 1].map(i => ({ ...oldPhoto, id: `import-${i}`, dataUrl: `data:image/png;base64,import-${i}` }))
  const imported = { ...defaultState(), profile: { ...oldState.profile, heightCm: 190 } }
  const backup = parseBackup(JSON.stringify(makeBackup(imported, photos)))
  const databases = new Map([
    ['golgoth', new Map<string, unknown>([['state', oldState]])],
    ['golgoth-photos', new Map<string, unknown>([[oldPhoto.id, oldPhoto]])],
  ])
  const connections: Array<{ onclose?: () => void }> = []
  let failPhotoWrite = true
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open(name: string) {
      const db = {
        onclose: undefined as (() => void) | undefined,
        transaction() {
          const staged = new Map(databases.get(name))
          let aborted = false
          const transaction = { error: null as DOMException | null,
            oncomplete: undefined as (() => void) | undefined, onabort: undefined as (() => void) | undefined,
            abort() { aborted = true },
          }
          const store = { transaction, clear() { staged.clear() }, put(value: unknown, key: string) {
            if (name === 'golgoth-photos' && key === 'import-1' && failPhotoWrite) {
              transaction.error = new DOMException('Photo storage full', 'QuotaExceededError')
              aborted = true
            } else staged.set(key, structuredClone(value))
          } }
          queueMicrotask(() => {
            if (aborted) transaction.onabort?.()
            else { databases.set(name, staged); transaction.oncomplete?.() }
          })
          return { objectStore: () => store }
        },
      }
      connections.push(db)
      const request = { result: db, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  } })
  const lastFinish = { workout: oldWorkout, changes: [], alerts: [], records: [], generalDrop: false }
  useStore.setState({ ready: true, hasData: true, storage: 'idb', state: oldState, photos: [oldPhoto], toast: null, lastFinish })
  try {
    const failed = await useStore.getState().importBackup(backup, { upgrade: false })
    assert.deepEqual([...databases.get('golgoth-photos')!.values()], [oldPhoto], 'clear and writes roll back together')
    assert.equal(failed, false)
    assert.equal(useStore.getState().state, oldState)
    assert.equal(useStore.getState().lastFinish, lastFinish)
    assert.deepEqual(useStore.getState().photos, [oldPhoto])
    assert.deepEqual(databases.get('golgoth')!.get('state'), oldState)
    assert.equal(useStore.getState().toast?.tone, 'bad')

    failPhotoWrite = false
    assert.equal(await useStore.getState().importBackup(backup, { upgrade: false }), true)
    assert.equal(useStore.getState().state.profile.heightCm, 190)
    assert.equal(useStore.getState().lastFinish, null, 'the previous workout summary must not leak into the imported data')
    assert.equal(useStore.getState().toast, null)
    assert.deepEqual(useStore.getState().photos, photos)
    assert.deepEqual([...databases.get('golgoth-photos')!.values()], photos)
    assert.deepEqual(databases.get('golgoth')!.get('state'), useStore.getState().state)
  } finally {
    for (const db of connections) db.onclose?.()
    useStore.setState(originalStore, true)
    if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB)
    else Reflect.deleteProperty(globalThis, 'indexedDB')
  }
})
