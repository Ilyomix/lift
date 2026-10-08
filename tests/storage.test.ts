import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { setLang } from '../src/lib/i18n'
import { useStore } from '../src/lib/store'

// Fault injection at the IndexedDB boundary: the real store and idb-keyval code
// run, while a suspended database connection can reject transaction creation.
const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
let opens = 0
let writes = 0
let failures = 0
let failureName = 'InvalidStateError'
let persisted: unknown
let beforeComplete: (() => void) | undefined
let afterComplete: (() => void) | undefined
const connections: Array<{ onclose?: () => void }> = []

beforeEach(() => {
  for (const db of connections) db.onclose?.()
  connections.length = 0
  opens = writes = failures = 0
  failureName = 'InvalidStateError'
  persisted = undefined
  beforeComplete = undefined
  afterComplete = undefined
  setLang('en')
  useStore.setState({ ready: true, hasData: true, storage: 'idb', state: defaultState(), toast: null })
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      opens++
      const db = {
        onclose: undefined as (() => void) | undefined,
        transaction() {
          writes++
          if (failures > 0) {
            failures--
            throw new DOMException('Injected storage failure.', failureName)
          }
          const transaction = { oncomplete: undefined as (() => void) | undefined }
          return {
            objectStore() {
              return { transaction, put(value: unknown) {
                const snapshot = structuredClone(value)
                queueMicrotask(() => {
                  beforeComplete?.()
                  persisted = snapshot
                  transaction.oncomplete?.()
                  afterComplete?.()
                })
              } }
            },
          }
        },
      }
      connections.push(db)
      const request = { result: db, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  } })
})

afterEach(() => {
  if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB)
  else Reflect.deleteProperty(globalThis, 'indexedDB')
})

test('preparing a backup does not claim that an export completed', () => {
  const previousExport = '2026-09-01T09:00:00.000Z'
  useStore.setState({ state: { ...defaultState(), meta: { ...defaultState().meta, lastBackupAt: previousExport } }, photos: [] })
  const backup = useStore.getState().exportBackup()
  assert.ok(backup.exportedAt)
  assert.equal(useStore.getState().state.meta.lastBackupAt, previousExport)
})

test('a suspended IndexedDB connection is reopened and the save retried once', async () => {
  failures = 1
  await useStore.getState().flush()
  assert.equal(opens, 2)
  assert.equal(writes, 2)
  assert.deepEqual(persisted, useStore.getState().state)
  assert.equal(useStore.getState().storage, 'idb')
  assert.equal(useStore.getState().toast, null)
})

test('failed saves remain retryable and preserve the latest edits on foreground recovery', async () => {
  failures = 2
  await useStore.getState().flush()
  assert.equal(writes, 2, 'persistent failures must not start an unbounded retry loop')
  assert.equal(persisted, undefined)
  assert.equal(useStore.getState().storage, 'memory')
  assert.equal(useStore.getState().toast?.message, 'Saving is unavailable. Export a backup before closing Lift.')

  const latest = { ...useStore.getState().state, completedSessions: 7 }
  useStore.setState({ state: latest })
  await useStore.getState().flush() // Same operation the foreground listener invokes.
  assert.deepEqual(persisted, latest)
  assert.equal(useStore.getState().storage, 'idb')
  assert.equal(useStore.getState().toast, null, 'successful recovery clears the obsolete storage warning')
})

test('quota errors are reported without reopening repeatedly and can recover after space is freed', async () => {
  failures = 1
  failureName = 'QuotaExceededError'
  await useStore.getState().flush()
  assert.equal(opens, 1)
  assert.equal(writes, 1)
  assert.equal(useStore.getState().storage, 'memory')
  await useStore.getState().flush()
  assert.deepEqual(persisted, useStore.getState().state)
  assert.equal(useStore.getState().storage, 'idb')
})

test('an edit during an in-flight write is saved before concurrent flush callers resolve', async () => {
  const latest = { ...useStore.getState().state, completedSessions: 9 }
  beforeComplete = () => {
    beforeComplete = undefined
    useStore.setState({ state: latest })
  }
  await Promise.all([useStore.getState().flush(), useStore.getState().flush()])
  assert.equal(writes, 2)
  assert.deepEqual(persisted, latest)
})


test('nutrition edits start saving immediately, without a debounce or foreground flush', async () => {
  useStore.getState().setNutrition('2026-10-08', { calories: 1234 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal((persisted as any)?.nutritionEntries['2026-10-08']?.calories, 1234)
  assert.equal(writes, 1)
})

test('immediate updates coalesce into the in-flight save without losing the final value', async () => {
  beforeComplete = () => {
    beforeComplete = undefined
    useStore.getState().setNutrition('2026-10-08', { calories: 2345 })
    useStore.getState().setNutrition('2026-10-08', { protein: 151 })
  }
  useStore.getState().setNutrition('2026-10-08', { calories: 1234 })
  await new Promise(resolve => setImmediate(resolve))
  const nutrition = (persisted as any)?.nutritionEntries['2026-10-08']
  assert.equal(nutrition?.calories, 2345)
  assert.equal(nutrition?.protein, 151)
  assert.equal(writes, 2, 'burst edits share the second write rather than racing separate transactions')
})


test('an edit queued between transaction completion and writer cleanup is not lost', async () => {
  afterComplete = () => {
    afterComplete = undefined
    let remaining = 2
    const hop = () => remaining-- > 0 ? queueMicrotask(hop)
      : useStore.getState().setNutrition('2026-10-08', { calories: 2345 })
    queueMicrotask(hop)
  }
  useStore.getState().setNutrition('2026-10-08', { calories: 1234 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(useStore.getState().state.nutritionEntries['2026-10-08'].calories, 2345)
  assert.equal((persisted as any)?.nutritionEntries['2026-10-08']?.calories, 2345)
  assert.equal(writes, 2)
})
