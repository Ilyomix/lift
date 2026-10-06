import assert from 'node:assert/strict'
import test from 'node:test'
import { createNavigationHistory } from '../src/lib/navigationHistory'

function fixture(initial = '#/', previousExternal = false) {
  const target = new EventTarget()
  const entries: Array<{ hash: string; state: unknown }> = [...(previousExternal ? [{ hash: 'external-site', state: null }] : []), { hash: initial, state: { other: 'preserved' } }]
  let position = entries.length - 1
  const location = { get hash() { return entries[position].hash } }
  const changed = (pop = false) => {
    if (pop) target.dispatchEvent(new Event('popstate'))
    target.dispatchEvent(new Event('hashchange'))
  }
  const history = {
    get state() { return entries[position].state },
    replaceState(state: unknown, _unused: string, hash?: string) { entries[position] = { hash: hash ?? location.hash, state } },
    pushState(state: unknown, _unused: string, hash: string) { entries.splice(position + 1); entries.push({ hash, state }); position++ },
    back() { if (position > 0) { position--; changed(true) } },
    forward() { if (position < entries.length - 1) { position++; changed(true) } },
  }
  const host = Object.assign(target, { history, location }) as unknown as Window
  const tracker = createNavigationHistory(host)
  const link = (hash: string) => { history.pushState(null, '', hash); changed() }
  return { tracker, history, host, location, link, entries }
}

test('an external previous site is not a Lift back destination', () => {
  const f = fixture('#/plus/reglages', true)
  assert.equal(f.tracker.canGoBack(), false)
  assert.equal(f.tracker.goBack(), false)
  assert.equal(f.location.hash, '#/plus/reglages')
  assert.equal((f.history.state as { other: string }).other, 'preserved')
  f.tracker.dispose()
})

test('normal hash links are recorded and return to the actual previous page', () => {
  const f = fixture('#/calendrier')
  f.link('#/seance/workout-id')
  assert.equal(f.tracker.canGoBack(), true)
  assert.equal(f.tracker.goBack(), true)
  assert.equal(f.location.hash, '#/calendrier')
  assert.equal(f.tracker.canGoBack(), false)
  f.tracker.dispose()
})

test('replace preserves the earlier page instead of adding an entry', () => {
  const f = fixture('#/')
  f.tracker.navigate('#/progres')
  f.tracker.navigate('#/progres/corps', true)
  assert.equal(f.entries.length, 2)
  f.tracker.goBack()
  assert.equal(f.location.hash, '#/')
  f.history.forward()
  assert.equal(f.location.hash, '#/progres/corps')
  assert.equal(f.tracker.canGoBack(), true)
  f.tracker.dispose()
})

test('back/forward traversal and branching preserve actual history', () => {
  const f = fixture('#/')
  f.tracker.navigate('#/calendrier'); f.tracker.navigate('#/plus')
  f.tracker.goBack(); assert.equal(f.location.hash, '#/calendrier')
  f.history.forward(); assert.equal(f.location.hash, '#/plus')
  f.tracker.goBack(); f.tracker.navigate('#/seance')
  f.history.forward(); assert.equal(f.location.hash, '#/seance')
  f.tracker.goBack(); assert.equal(f.location.hash, '#/calendrier')
  f.tracker.goBack(); assert.equal(f.location.hash, '#/')
  assert.equal(f.tracker.goBack(), false)
  f.tracker.dispose()
})

test('same route does not duplicate entries, and reload retains internal history', () => {
  const f = fixture('#/')
  assert.equal(f.tracker.navigate('#/'), false)
  f.link('#/plus'); f.tracker.dispose()
  const resumed = createNavigationHistory(f.host)
  assert.equal(resumed.canGoBack(), true)
  resumed.goBack(); assert.equal(f.location.hash, '#/')
  assert.equal(resumed.canGoBack(), false)
  resumed.dispose()
})

test('replacing a direct-entry route still cannot go back to an external page', () => {
  const f = fixture('#/progres', true)
  f.tracker.navigate('#/progres/volume', true)
  assert.equal(f.tracker.goBack(), false)
  assert.equal(f.entries.length, 2)
  f.tracker.dispose()
})

test('previousHash previews the real destination through normal links, replacement and traversal', () => {
  const f = fixture('#/')
  assert.equal(f.tracker.previousHash(), undefined)
  f.tracker.navigate('#/calendrier')
  assert.equal(f.tracker.previousHash(), '#/')
  f.tracker.navigate('#/calendrier/programme', true)
  assert.equal(f.tracker.previousHash(), '#/', 'replacing a tab does not invent a back destination')
  f.link('#/calendrier/programme/PUSH')
  assert.equal(f.tracker.previousHash(), '#/calendrier/programme')
  assert.equal(f.tracker.position(), 2)
  f.tracker.goBack()
  assert.equal(f.tracker.previousHash(), '#/')
  assert.equal(f.tracker.position(), 1)
  f.history.forward()
  assert.equal(f.tracker.previousHash(), '#/calendrier/programme')
  f.tracker.dispose()
})

test('previousHash survives reload and a new branch drops the old forward destination', () => {
  const f = fixture('#/')
  f.tracker.navigate('#/plus')
  f.link('#/plus/reglages')
  f.tracker.dispose()
  const resumed = createNavigationHistory(f.host)
  assert.equal(resumed.previousHash(), '#/plus')
  resumed.goBack()
  resumed.navigate('#/plus/preuves')
  assert.equal(resumed.previousHash(), '#/plus')
  f.history.forward()
  assert.equal(f.location.hash, '#/plus/preuves')
  resumed.goBack()
  assert.equal(f.location.hash, '#/plus')
  assert.equal(resumed.previousHash(), '#/')
  resumed.dispose()
})

test('replacing a previous tab updates the preview destination of an existing forward entry', () => {
  const f = fixture('#/')
  f.tracker.navigate('#/progres')
  f.tracker.navigate('#/progres/exercice/chest-press')
  f.tracker.goBack()
  f.tracker.navigate('#/progres/corps', true)
  f.history.forward()
  assert.equal(f.location.hash, '#/progres/exercice/chest-press')
  assert.equal(f.tracker.previousHash(), '#/progres/corps', 'the preview must match the route history.back will open')
  f.tracker.goBack()
  assert.equal(f.location.hash, '#/progres/corps')
  f.tracker.dispose()
})
