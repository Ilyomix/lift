import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { useStore } from '../src/lib/store'

const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
const initialStore = useStore.getState()
const oldPhoto = { id: 'old', date: '2026-10-07', name: 'old.jpg', dataUrl: 'data:image/jpeg;base64,b2xk' }
const newPhoto = { ...oldPhoto, id: 'new', dataUrl: 'data:image/jpeg;base64,bmV3' }
let databases: Map<string, Map<string, unknown>>
let fail: (database: string, operation: string) => boolean
let holdNextStateWrite: boolean
let held: (() => void) | undefined
const connections: Array<{ onclose?: () => void }> = []

beforeEach(() => {
  fail = () => false; holdNextStateWrite = false; held = undefined
  const state = defaultState()
  state.profile.heightCm = 175
  databases = new Map([['golgoth', new Map([['state', state]])], ['golgoth-photos', new Map([[oldPhoto.id, oldPhoto]])]])
  useStore.setState({ ...initialStore, ready: true, hasData: true, state, photos: [oldPhoto], storage: 'idb', toast: null })
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open(name: string) {
      const db = { onclose: undefined as (() => void) | undefined, transaction() {
        const staged = new Map(databases.get(name))
        let aborted = false
        const tx = { error: null as DOMException | null, oncomplete: undefined as (() => void) | undefined, onabort: undefined as (() => void) | undefined,
          abort() { aborted = true },
        }
        let scheduled = false
        const schedule = (operation: string) => {
          if (fail(name, operation)) { aborted = true; tx.error = new DOMException('Injected storage failure', 'QuotaExceededError') }
          if (scheduled) return
          scheduled = true
          const complete = () => { if (aborted) tx.onabort?.(); else { databases.set(name, staged); tx.oncomplete?.() } }
          if (name === 'golgoth' && operation === 'put' && holdNextStateWrite) { holdNextStateWrite = false; held = complete }
          else queueMicrotask(complete)
        }
        const store = { transaction: tx,
          clear() { staged.clear(); schedule('clear') },
          put(value: unknown, key: string) { staged.set(key, structuredClone(value)); schedule('put') },
          delete(key: string) { staged.delete(key); schedule('delete') },
        }
        return { objectStore: () => store }
      } }
      connections.push(db)
      const request = { result: db, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  } })
})
afterEach(async () => {
  held?.(); await useStore.getState().flush()
  for (const db of connections) db.onclose?.()
  connections.length = 0
  useStore.setState(initialStore, true)
  if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB)
  else Reflect.deleteProperty(globalThis, 'indexedDB')
})

test('state persistence failure during import restores old photos and reports failure', async () => {
  const oldState = useStore.getState().state
  const incoming = defaultState(); incoming.profile.heightCm = 190
  fail = (db, operation) => db === 'golgoth' && operation === 'put'
  const result = await useStore.getState().importBackup(parseBackup(JSON.stringify(makeBackup(incoming, [newPhoto]))), { upgrade: false })
  assert.equal(result, false)
  assert.equal(useStore.getState().state, oldState)
  assert.deepEqual(useStore.getState().photos, [oldPhoto])
  assert.deepEqual([...databases.get('golgoth-photos')!.values()], [oldPhoto])
  assert.deepEqual(databases.get('golgoth')!.get('state'), oldState)
  assert.equal(useStore.getState().toast?.tone, 'bad')
})

test('failed data deletion stays visible and can be retried', async () => {
  const oldState = useStore.getState().state
  fail = (db, operation) => db === 'golgoth-photos' && operation === 'clear'
  assert.equal(await useStore.getState().resetAll(), false)
  assert.equal(useStore.getState().hasData, true)
  assert.equal(useStore.getState().state, oldState)
  assert.deepEqual(databases.get('golgoth')!.get('state'), oldState)
  assert.equal(useStore.getState().toast?.tone, 'bad')
  fail = () => false
  assert.equal(await useStore.getState().resetAll(), true)
  assert.equal(useStore.getState().hasData, false)
  assert.equal(databases.get('golgoth')!.size, 0)
  assert.equal(databases.get('golgoth-photos')!.size, 0)
})

test('deletion waits for an in-flight save, then removes it permanently', async () => {
  holdNextStateWrite = true
  const saving = useStore.getState().flush()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(held)
  const resetting = useStore.getState().resetAll()
  await new Promise(resolve => setImmediate(resolve))
  held!(); held = undefined
  await Promise.all([saving, resetting])
  assert.equal(useStore.getState().hasData, false)
  assert.equal(databases.get('golgoth')!.size, 0, 'the old state must not be resurrected by the pending save')
})

test('successful deletion after a storage failure confirms empty persistent storage', async () => {
  useStore.setState({ storage: 'memory' })
  assert.equal(await useStore.getState().resetAll(), true)
  assert.equal(useStore.getState().hasData, false)
  assert.equal(useStore.getState().storage, 'idb', 'App must show onboarding, not the unreadable-storage guard')
  assert.equal(databases.get('golgoth')!.size, 0)
  assert.equal(databases.get('golgoth-photos')!.size, 0)
})

test('failed photo deletion retains the photo and shows an error', async () => {
  fail = (db, operation) => db === 'golgoth-photos' && operation === 'delete'
  await useStore.getState().deletePhoto(oldPhoto.id)
  assert.deepEqual(useStore.getState().photos, [oldPhoto])
  assert.equal(useStore.getState().toast?.tone, 'bad')
})

test('failed compensation keeps the original photos available for export and warns honestly', async () => {
  let stateFailed = false
  fail = (db, operation) => {
    if (db === 'golgoth' && operation === 'put') { stateFailed = true; return true }
    return stateFailed && db === 'golgoth-photos'
  }
  const original = useStore.getState().state
  const incoming = defaultState(); incoming.profile.heightCm = 190
  assert.equal(await useStore.getState().importBackup(parseBackup(JSON.stringify(makeBackup(incoming, [newPhoto]))), { upgrade: false }), false)
  assert.equal(useStore.getState().state, original)
  assert.deepEqual(useStore.getState().exportBackup().photos, [oldPhoto])
  assert.match(useStore.getState().toast?.message ?? '', /export/i)
})

test('an import waits for an earlier flush and cannot be overwritten by it', async () => {
  holdNextStateWrite = true
  const saving = useStore.getState().flush()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(held)
  const incoming = defaultState(); incoming.profile.heightCm = 190
  const importing = useStore.getState().importBackup(parseBackup(JSON.stringify(makeBackup(incoming, [newPhoto]))), { upgrade: false })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(useStore.getState().state.profile.heightCm, 175)
  held!(); held = undefined
  const [_, result] = await Promise.all([saving, importing])
  assert.equal(result, true)
  assert.equal((databases.get('golgoth')!.get('state') as any).profile.heightCm, 190)
})
