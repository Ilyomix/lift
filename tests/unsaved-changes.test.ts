import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React from 'react'
import { confirmUnsavedChanges, useDiscardConfirmation, useUnsavedChanges } from '../src/lib/unsavedChanges'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
let host: EventTarget, doc: EventTarget
const cleanups: Array<() => void> = []
const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
function dialog() {
  const previous = internals.H
  internals.H = { useSyncExternalStore: (_subscribe: unknown, snapshot: () => boolean) => snapshot() }
  try { return useDiscardConfirmation() } finally { internals.H = previous }
}
function mount(initial = false) {
  let dirty = initial, mounted = false, cursor = 0
  const refs: Array<{ current: unknown }> = []
  const render = () => {
    cursor = 0
    const previous = internals.H
    internals.H = {
      useRef(value: unknown) { return refs[cursor++] ?? (refs[cursor - 1] = { current: value }) },
      useEffect(effect: () => () => void) { if (!mounted) cleanups.push(effect()) },
    }
    try { return useUnsavedChanges(dirty) }
    finally { internals.H = previous; mounted = true }
  }
  return { render, set(next: boolean) { dirty = next; return render() } }
}
beforeEach(() => {
  host = Object.assign(new EventTarget(), { confirm() { throw Error('native confirmation must never be used') } })
  doc = new EventTarget()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc })
})
afterEach(() => {
  dialog().resolve(false)
  cleanups.splice(0).forEach(cleanup => cleanup())
  for (const [name, descriptor] of [['window', originalWindow], ['document', originalDocument]] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

test('dirty refs are current; concurrent requests share one Lift dialog and refusal keeps both drafts', async () => {
  const a = mount(), b = mount(true)
  a.render(); const bApi = b.render(); a.set(true)
  const first = confirmUnsavedChanges(), second = bApi.confirm()
  assert.equal(first, second)
  assert.equal(dialog().open, true)
  dialog().resolve(false)
  assert.deepEqual(await Promise.all([first, second]), [false, false])
  assert.equal(dialog().open, false)
  const allowed = confirmUnsavedChanges()
  dialog().resolve(true)
  assert.equal(await allowed, true)
  assert.equal(await confirmUnsavedChanges(), true)
  assert.equal(dialog().open, false, 'accepted drafts do not trigger a second confirmation')
})

test('successful save acknowledges only its own draft; fresh edits and failed actions rearm it', async () => {
  const a = mount(true), b = mount(true)
  const api = a.render(); b.render()
  api.discard()
  assert.equal(await api.confirm(), true)
  const other = confirmUnsavedChanges()
  assert.equal(dialog().open, true)
  dialog().resolve(true); assert.equal(await other, true)
  a.set(false); a.set(true)
  const fresh = confirmUnsavedChanges()
  dialog().resolve(false); assert.equal(await fresh, false)
  api.discard(); assert.equal(await api.confirm(), true)
  api.rearm()
  const failed = api.confirm()
  assert.equal(dialog().open, true)
  dialog().resolve(false); assert.equal(await failed, false)
})

test('pending measurement commits before checking dirty state and clean drafts need no dialog', async () => {
  const form = mount(), api = form.render()
  assert.equal(await api.confirm(), true)
  assert.equal(dialog().open, false)
  doc.addEventListener('lift:commit-measurements', () => form.set(true), { once: true })
  const answer = confirmUnsavedChanges()
  assert.equal(dialog().open, true)
  dialog().resolve(false)
  assert.equal(await answer, false)
})

test('document unload never opens a native alert or a fake asynchronous prompt', () => {
  mount(true).render()
  const event = new Event('beforeunload', { cancelable: true })
  host.dispatchEvent(event)
  assert.equal(event.defaultPrevented, false)
  assert.equal(dialog().open, false)
})
