import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { back, goBack, navigate } from '../src/lib/router'
import { useDiscardConfirmation, useUnsavedChanges } from '../src/lib/unsavedChanges'

test('router Back refuses once without fallback or scrolling, and saved changes leave without a prompt', async () => {
  const originals = new Map(['window', 'document', 'HashChangeEvent'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const events = new EventTarget(), entries: Array<{ hash: string; state: unknown }> = [{ hash: '#/', state: null }]
  let index = 0, top = 440
  const location = { get hash() { return entries[index].hash } }
  const history = {
    get state() { return entries[index].state },
    pushState(state: unknown, _title: string, hash: string) { entries.splice(index + 1); entries.push({ hash, state }); index++ },
    replaceState(state: unknown, _title: string, hash?: string) { entries[index] = { hash: hash ?? location.hash, state } },
    back() { if (index) { index--; events.dispatchEvent(new Event('popstate')); events.dispatchEvent(new Event('hashchange')) } },
  }
  const host = Object.assign(events, { history, location, confirm() { throw Error('native alert') }, scrollTo(value: { top: number }) { top = value.top } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: new EventTarget() })
  Object.defineProperty(globalThis, 'HashChangeEvent', { configurable: true, value: Event })
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previous = internals.H
  const dialog = () => {
    const previous = internals.H
    internals.H = { useSyncExternalStore: (_subscribe: unknown, snapshot: () => boolean) => snapshot() }
    try { return useDiscardConfirmation() } finally { internals.H = previous }
  }
  let cleanup = () => {}
  try {
    await navigate('plus/objectif')
    internals.H = { useRef: (current: unknown) => ({ current }), useEffect(effect: () => () => void) { cleanup = effect() } }
    const guard = useUnsavedChanges(true)
    internals.H = previous
    top = 440
    const leaving = back('plus')
    assert.equal(dialog().open, true)
    assert.equal(location.hash, '#/plus/objectif')
    dialog().resolve(false); assert.equal(await leaving, false)
    assert.equal(entries.length, 2)
    assert.equal(top, 440)
    const tab = navigate('calendrier')
    dialog().resolve(false); await tab
    assert.equal(top, 440, 'a refused tab change must not reset scroll')
    await navigate('plus/objectif')
    assert.equal(dialog().open, false, 'the same route does not abandon its draft')
    guard.discard()
    await navigate('progres')
    assert.equal(location.hash, '#/progres')
    assert.equal(dialog().open, false)
    assert.equal(await goBack(), true)
    assert.equal(location.hash, '#/plus/objectif')
    assert.equal(await goBack(), true)
    guard.rearm()
    const fallback = back('plus')
    assert.equal(dialog().open, true)
    dialog().resolve(false); assert.equal(await fallback, false)
    assert.equal(location.hash, '#/')
  } finally {
    internals.H = previous
    cleanup()
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
