import assert from 'node:assert/strict'
import test from 'node:test'
import { goBack, isDirectRouteChange, navigate } from '../src/lib/router'

test('tab switches are direct only for their own event; later swipes, links and Back remain animated', () => {
  const host = new EventTarget()
  const entries: Array<{ hash: string; state: unknown }> = [{ hash: '#/', state: null }]
  let position = 0
  const location = { get hash() { return entries[position].hash } }
  const history = {
    get state() { return entries[position].state },
    replaceState(state: unknown, _title: string, hash?: string) { entries[position] = { hash: hash ?? location.hash, state } },
    pushState(state: unknown, _title: string, hash: string) { entries.splice(position + 1); entries.push({ hash, state }); position++ },
    back() {
      if (!position) return
      position--
      host.dispatchEvent(new Event('popstate'))
      host.dispatchEvent(new Event('hashchange'))
    },
  }
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousHashEvent = Object.getOwnPropertyDescriptor(globalThis, 'HashChangeEvent')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(host, { history, location, scrollTo() {} }) })
  Object.defineProperty(globalThis, 'HashChangeEvent', { configurable: true, value: class extends Event {} })
  const changes: Array<{ hash: string; direct: boolean }> = []
  host.addEventListener('hashchange', event => changes.push({ hash: location.hash, direct: isDirectRouteChange(event) }))
  try {
    navigate('seance', { transition: 'none' })
    navigate('plus/reglages')
    assert.equal(goBack(), true)
    assert.deepEqual(changes, [
      { hash: '#/seance', direct: true },
      { hash: '#/plus/reglages', direct: false },
      { hash: '#/seance', direct: false },
    ])
    navigate('calendrier', { transition: 'none' })
    const count = entries.length
    navigate('calendrier/programme', { replace: true, transition: 'none' })
    assert.equal(entries.length, count, 'a segmented tab still replaces the current history entry')
    assert.equal(changes.at(-1)?.direct, true)
    assert.equal(goBack(), true)
    assert.deepEqual(changes.at(-1), { hash: '#/seance', direct: false })
    navigate('calendrier') // Same call used by an actual swipe.
    assert.deepEqual(changes.at(-1), { hash: '#/calendrier', direct: false })
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    if (previousHashEvent) Object.defineProperty(globalThis, 'HashChangeEvent', previousHashEvent)
    else Reflect.deleteProperty(globalThis, 'HashChangeEvent')
  }
})
