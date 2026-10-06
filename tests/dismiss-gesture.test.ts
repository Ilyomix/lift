import assert from 'node:assert/strict'
import test from 'node:test'
import { bindDismissGesture } from '../src/lib/dismissGesture'

const point = (x: number, y: number, id = 1) => ({ clientX: x, clientY: y, identifier: id })
function fixture(allowed = true) {
  const target = new EventTarget()
  const drags: number[] = [], releases: boolean[] = []
  const cleanup = bindDismissGesture(target as unknown as HTMLElement, {
    canStart: () => allowed, drag: dy => drags.push(dy), release: dismissed => releases.push(dismissed),
  })
  const send = (type: string, touches: ReturnType<typeof point>[], time: number, changed = touches, cancelable = true) => {
    const event = new Event(type, { cancelable })
    Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changed }, timeStamp: { value: time } })
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  const pull = (dy: number, duration = 400, dx = 0) => {
    send('touchstart', [point(100, 100)], 0)
    const claimed = send('touchmove', [point(100 + dx, 100 + dy)], duration / 2)
    send('touchend', [], duration, [point(100 + dx, 100 + dy)])
    return claimed
  }
  return { drags, releases, cleanup, send, pull }
}

test('downward pull dismisses; short pull returns to its original position', () => {
  const f = fixture()
  assert.equal(f.pull(130), true)
  assert.deepEqual(f.releases, [true])
  assert.equal(f.pull(40), true)
  assert.deepEqual(f.releases, [true, false])
  f.cleanup()
})

test('a deliberate downward flick dismisses without needing a long drag', () => {
  const f = fixture()
  f.pull(60, 100)
  assert.deepEqual(f.releases, [true])
  f.cleanup()
})

test('interactive controls or content already scrolled cannot start dismissal', () => {
  const f = fixture(false)
  assert.equal(f.pull(180), false)
  assert.deepEqual(f.releases, [])
  f.cleanup()
})

test('upward and horizontal scroll never turn into dismissal later', () => {
  for (const first of [point(100, 80), point(160, 110)]) {
    const f = fixture()
    f.send('touchstart', [point(100, 100)], 0)
    assert.equal(f.send('touchmove', [first], 60), false)
    assert.equal(f.send('touchmove', [point(100, 250)], 180), false)
    f.send('touchend', [], 300, [point(100, 250)])
    assert.deepEqual(f.releases, [])
    f.cleanup()
  }
})

test('multi-touch, cancellation and reversal reset the panel without closing', () => {
  const f = fixture()
  f.send('touchstart', [point(100, 100)], 0)
  f.send('touchmove', [point(100, 220)], 100)
  f.send('touchmove', [point(100, 240), point(200, 240, 2)], 120)
  f.send('touchend', [], 150, [point(100, 240)])
  assert.deepEqual(f.releases, [false])
  f.send('touchstart', [point(100, 100)], 200)
  f.send('touchmove', [point(100, 220)], 300)
  f.send('touchend', [], 500, [point(100, 110)])
  assert.deepEqual(f.releases, [false, false])
  f.send('touchstart', [point(100, 100)], 600)
  f.send('touchmove', [point(100, 160)], 700)
  f.send('touchcancel', [], 750)
  assert.deepEqual(f.releases, [false, false, false])
  f.cleanup()
})

test('cleanup stops events and cannot dismiss', () => {
  const f = fixture()
  f.cleanup()
  f.pull(200)
  assert.deepEqual(f.releases, [])
})
