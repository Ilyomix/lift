import assert from 'node:assert/strict'
import test from 'node:test'
import { createNavigationHistory } from '../src/lib/navigationHistory'

function fixture() {
  const events = new EventTarget()
  const entries: Array<{ hash: string; state: unknown }> = [{ hash: '#/', state: { other: 'kept' } }]
  const queue: Array<() => void> = []
  let position = 0, guarded = false, prompts = 0, resolve: ((allowed: boolean) => void) | undefined
  const location = { get hash() { return entries[position].hash } }
  const change = () => { events.dispatchEvent(new Event('popstate')); events.dispatchEvent(new Event('hashchange')) }
  const history = {
    get state() { return entries[position].state },
    pushState(state: unknown, _title: string, hash: string) { entries.splice(position + 1); entries.push({ hash, state }); position++ },
    replaceState(state: unknown, _title: string, hash?: string) { entries[position] = { hash: hash ?? location.hash, state } },
    go(delta: number) { queue.push(() => { const next = position + delta; if (next >= 0 && next < entries.length) { position = next; change() } }) },
    back() { this.go(-1) }, forward() { this.go(1) },
  }
  const host = Object.assign(events, { history, location }) as unknown as Window
  const tracker = createNavigationHistory(host, () => {
    if (!guarded) return true
    prompts++
    return new Promise<boolean>(done => { resolve = done })
  })
  const visible: string[] = []
  events.addEventListener('hashchange', () => visible.push(location.hash))
  return {
    entries, history, tracker, location, visible,
    get prompts() { return prompts },
    block(value = true) { guarded = value; prompts = 0; visible.length = 0 },
    answer(value: boolean) { const done = resolve; resolve = undefined; done?.(value) },
    tick() { queue.shift()?.() },
    async flush() { for (let n = 0; n < 8; n++) { while (queue.length) queue.shift()!(); await Promise.resolve() } },
    link(hash: string) { history.pushState(null, '', hash); events.dispatchEvent(new Event('hashchange')) },
  }
}

test('programmatic navigation waits for the Lift choice; duplicate requests never perform a second action', async () => {
  const f = fixture()
  await f.tracker.navigate('#/plus/objectif')
  f.block()
  assert.equal(await f.tracker.navigate('#/plus/objectif'), false)
  assert.equal(f.prompts, 0)
  const next = f.tracker.navigate('#/calendrier')
  assert.equal(f.location.hash, '#/plus/objectif')
  assert.equal(await f.tracker.goBack(), false, 'one pending destination owns the confirmation')
  assert.equal(f.prompts, 1)
  f.answer(false); assert.equal(await next, false)
  assert.equal(f.entries.length, 2)
  const back = f.tracker.goBack()
  f.answer(true); assert.equal(await back, true)
  assert.equal(await f.tracker.goBack(), false, 'a repeated tap cannot schedule a second Back while the approved browser traversal is queued')
  await f.flush()
  assert.equal(f.location.hash, '#/')
  assert.equal(f.prompts, 2, 'approved Back does not confirm again on popstate')
  f.tracker.dispose()
})

test('browser Back restores the original entry before choice and replays only after acceptance, retaining Forward', async () => {
  const f = fixture()
  await f.tracker.navigate('#/calendrier'); await f.tracker.navigate('#/plus/objectif')
  f.block()
  f.history.back(); f.tick()
  assert.equal(f.location.hash, '#/calendrier', 'browser moved before the queued restoration')
  assert.equal(f.tracker.currentHash(), '#/plus/objectif')
  assert.deepEqual(f.visible, [])
  await f.flush()
  assert.equal(f.location.hash, '#/plus/objectif', 'the browser is restored while the Lift dialog is still open')
  assert.equal(f.tracker.position(), 2)
  assert.deepEqual(f.visible, [])
  f.answer(false); await f.flush()
  assert.equal(f.location.hash, '#/plus/objectif')
  assert.equal(f.entries.length, 3)
  f.history.back(); await f.flush()
  assert.equal(f.prompts, 2)
  f.history.back(); await f.flush()
  assert.equal(f.prompts, 2, 'another browser Back while choosing reuses the first pending destination')
  assert.equal(f.location.hash, '#/plus/objectif')
  f.answer(true); await f.flush()
  assert.equal(f.location.hash, '#/calendrier')
  assert.deepEqual(f.visible, ['#/calendrier'], 'only the approved traversal reaches React')
  f.block(false); f.history.forward(); await f.flush()
  assert.equal(f.location.hash, '#/plus/objectif')
  assert.equal(f.tracker.previousHash(), '#/calendrier')
  f.tracker.dispose()
})

test('browser Forward cancellation retains both directions and replacement previews', async () => {
  const f = fixture()
  await f.tracker.navigate('#/calendrier'); await f.tracker.navigate('#/progres')
  await f.tracker.goBack(); await f.flush()
  await f.tracker.navigate('#/calendrier/programme', true)
  f.block(); f.history.forward(); await f.flush()
  assert.equal(f.location.hash, '#/calendrier/programme')
  assert.deepEqual(f.visible, [])
  f.answer(false); await f.flush()
  f.history.forward(); await f.flush()
  f.answer(true); await f.flush()
  assert.equal(f.location.hash, '#/progres')
  assert.equal(f.tracker.previousHash(), '#/calendrier/programme')
  f.block(false); f.history.back(); await f.flush()
  assert.equal(f.location.hash, '#/calendrier/programme')
  f.tracker.dispose()
})

test('raw hash links restore the draft and remain reachable by Forward after refusal', async () => {
  const f = fixture()
  await f.tracker.navigate('#/plus/objectif')
  f.block(); f.link('#/progres/corps'); await f.flush()
  assert.equal(f.location.hash, '#/plus/objectif')
  assert.equal(f.tracker.currentHash(), '#/plus/objectif')
  assert.deepEqual(f.visible, [])
  f.answer(false); await f.flush()
  f.history.forward(); await f.flush()
  f.answer(true); await f.flush()
  assert.equal(f.location.hash, '#/progres/corps')
  assert.equal(f.tracker.previousHash(), '#/plus/objectif')
  f.tracker.dispose()
})
