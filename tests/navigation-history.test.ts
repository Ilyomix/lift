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
    go(delta: number) { const next = position + delta; if (next >= 0 && next < entries.length) { position = next; changed(true) } },
    back() { this.go(-1) },
    forward() { if (position < entries.length - 1) { position++; changed(true) } },
  }
  const host = Object.assign(target, { history, location }) as unknown as Window
  const tracker = createNavigationHistory(host)
  const settle = async () => { for (let n = 0; n < 5; n++) await Promise.resolve() }
  const link = async (hash: string) => { history.pushState(null, '', hash); changed(); await settle() }
  return { tracker, history, host, location, link, entries, settle }
}

test('an external previous site is not a Lift back destination', async () => {
  const f = fixture('#/plus/reglages', true)
  assert.equal(f.tracker.canGoBack(), false)
  assert.equal(await f.tracker.goBack(), false)
  assert.equal(f.location.hash, '#/plus/reglages')
  assert.equal((f.history.state as { other: string }).other, 'preserved')
  f.tracker.dispose()
})

test('normal hash links are recorded and return to the actual previous page', async () => {
  const f = fixture('#/calendrier')
  await f.link('#/seance/workout-id')
  assert.equal(f.tracker.canGoBack(), true)
  assert.equal(await f.tracker.goBack(), true)
  assert.equal(f.location.hash, '#/calendrier')
  assert.equal(f.tracker.canGoBack(), false)
  f.tracker.dispose()
})

test('replace preserves the earlier page instead of adding an entry', async () => {
  const f = fixture('#/')
  await f.tracker.navigate('#/progres')
  await f.tracker.navigate('#/progres/corps', true)
  assert.equal(f.entries.length, 2)
  await f.tracker.goBack()
  assert.equal(f.location.hash, '#/')
  f.history.forward(); await f.settle()
  assert.equal(f.location.hash, '#/progres/corps')
  assert.equal(f.tracker.canGoBack(), true)
  f.tracker.dispose()
})

test('back/forward traversal and branching preserve actual history', async () => {
  const f = fixture('#/')
  await f.tracker.navigate('#/calendrier'); await f.tracker.navigate('#/plus')
  await f.tracker.goBack(); assert.equal(f.location.hash, '#/calendrier')
  f.history.forward(); await f.settle(); assert.equal(f.location.hash, '#/plus')
  await f.tracker.goBack(); await f.tracker.navigate('#/seance')
  f.history.forward(); await f.settle(); assert.equal(f.location.hash, '#/seance')
  await f.tracker.goBack(); assert.equal(f.location.hash, '#/calendrier')
  await f.tracker.goBack(); assert.equal(f.location.hash, '#/')
  assert.equal(await f.tracker.goBack(), false)
  f.tracker.dispose()
})

test('same route does not duplicate entries, and reload retains internal history', async () => {
  const f = fixture('#/')
  assert.equal(await f.tracker.navigate('#/'), false)
  await f.link('#/plus'); f.tracker.dispose()
  const resumed = createNavigationHistory(f.host)
  assert.equal(resumed.canGoBack(), true)
  await resumed.goBack(); assert.equal(f.location.hash, '#/')
  assert.equal(resumed.canGoBack(), false)
  resumed.dispose()
})

test('replacing a direct-entry route still cannot go back to an external page', async () => {
  const f = fixture('#/progres', true)
  await f.tracker.navigate('#/progres/volume', true)
  assert.equal(await f.tracker.goBack(), false)
  assert.equal(f.entries.length, 2)
  f.tracker.dispose()
})

test('previousHash previews the real destination through normal links, replacement and traversal', async () => {
  const f = fixture('#/')
  assert.equal(f.tracker.previousHash(), undefined)
  await f.tracker.navigate('#/calendrier')
  assert.equal(f.tracker.previousHash(), '#/')
  await f.tracker.navigate('#/calendrier/programme', true)
  assert.equal(f.tracker.previousHash(), '#/', 'replacing a tab does not invent a back destination')
  await f.link('#/calendrier/programme/PUSH')
  assert.equal(f.tracker.previousHash(), '#/calendrier/programme')
  assert.equal(f.tracker.position(), 2)
  await f.tracker.goBack()
  assert.equal(f.tracker.previousHash(), '#/')
  assert.equal(f.tracker.position(), 1)
  f.history.forward(); await f.settle()
  assert.equal(f.tracker.previousHash(), '#/calendrier/programme')
  f.tracker.dispose()
})

test('previousHash survives reload and a new branch drops the old forward destination', async () => {
  const f = fixture('#/')
  await f.tracker.navigate('#/plus')
  await f.link('#/plus/reglages')
  f.tracker.dispose()
  const resumed = createNavigationHistory(f.host)
  assert.equal(resumed.previousHash(), '#/plus')
  await resumed.goBack()
  await resumed.navigate('#/plus/preuves')
  assert.equal(resumed.previousHash(), '#/plus')
  f.history.forward(); await f.settle()
  assert.equal(f.location.hash, '#/plus/preuves')
  await resumed.goBack()
  assert.equal(f.location.hash, '#/plus')
  assert.equal(resumed.previousHash(), '#/')
  resumed.dispose()
})

test('replacing a previous tab updates the preview destination of an existing forward entry', async () => {
  const f = fixture('#/')
  await f.tracker.navigate('#/progres')
  await f.tracker.navigate('#/progres/exercice/chest-press')
  await f.tracker.goBack()
  await f.tracker.navigate('#/progres/corps', true)
  f.history.forward(); await f.settle()
  assert.equal(f.location.hash, '#/progres/exercice/chest-press')
  assert.equal(f.tracker.previousHash(), '#/progres/corps', 'the preview must match the route history.back will open')
  await f.tracker.goBack()
  assert.equal(f.location.hash, '#/progres/corps')
  f.tracker.dispose()
})

test('a replaced calendar tab remains the back preview after forward traversal and reload', async () => {
  const f = fixture('#/calendrier')
  await f.tracker.navigate('#/seance/workout-id')
  await f.tracker.goBack()
  await f.tracker.navigate('#/calendrier/programme', true)
  f.history.forward(); await f.settle()
  f.tracker.dispose()

  const resumed = createNavigationHistory(f.host)
  assert.equal(resumed.previousHash(), '#/calendrier/programme')
  await resumed.goBack()
  assert.equal(f.location.hash, '#/calendrier/programme')
  resumed.dispose()
})
