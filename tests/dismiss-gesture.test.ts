import assert from 'node:assert/strict'
import test from 'node:test'
import { bindDismissGesture, createDismissMotion } from '../src/lib/dismissGesture'

const point = (x: number, y: number, id = 1) => ({ clientX: x, clientY: y, identifier: id })
function fixture(allowed = true, height = 400) {
  const target = new EventTarget()
  const drags: number[] = [], releases: boolean[] = []
  const cleanup = bindDismissGesture(target as unknown as HTMLElement, {
    height: () => height,
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

test('a small quick flick returns instead of disappearing, regardless of release speed', () => {
  const f = fixture()
  for (const distance of [48, 60, 100, 119]) f.pull(distance, 80)
  assert.deepEqual(f.releases, [false, false, false, false])
  f.cleanup()
})

test('dismissal requires a substantial pull scaled to the visible panel height', () => {
  for (const [height, threshold] of [[300, 120], [600, 150], [844, 200]]) {
    const f = fixture(true, height)
    f.pull(threshold - 1, 80)
    f.pull(threshold, 800)
    assert.deepEqual(f.releases, [false, true], `height ${height}: quick short pull returns, deliberate long pull closes`)
    f.cleanup()
  }
})

test('pulling back deliberately cancels even while still past the dismissal distance', () => {
  const f = fixture()
  f.send('touchstart', [point(100, 100)], 0)
  f.send('touchmove', [point(100, 300)], 300)
  f.send('touchmove', [point(100, 250)], 400)
  f.send('touchend', [], 450, [point(100, 250)])
  assert.deepEqual(f.releases, [false])
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

test('the first small downward move is owned before Safari can start scrolling', () => {
  const f = fixture()
  f.send('touchstart', [point(100, 100)], 0, undefined, false)
  assert.equal(f.send('touchmove', [point(101, 104)], 16), true)
  assert.deepEqual(f.drags, [4], 'the sheet already follows the finger below the old 12px threshold')
  assert.equal(f.send('touchmove', [point(101, 168)], 64), true)
  f.send('touchend', [], 100, [point(101, 168)])
  assert.deepEqual(f.releases, [false], 'claiming the first move must not make a small pull dismiss')
  f.cleanup()
})

test('a browser-owned move and unmount cannot complete dismissal', () => {
  const f = fixture()
  f.send('touchstart', [point(100, 100)], 0)
  f.send('touchmove', [point(100, 140)], 30)
  f.send('touchmove', [point(100, 240)], 40, undefined, false)
  f.send('touchend', [], 100, [point(100, 240)])
  assert.deepEqual(f.releases, [false])
  f.send('touchstart', [point(100, 100)], 200)
  f.send('touchmove', [point(100, 250)], 230)
  f.cleanup()
  assert.deepEqual(f.releases, [false], 'teardown does not animate or call into an unmounted dialog')
})

// A minimal DOM style/geometry fixture: motion and callbacks are the shipped
// controller, with virtual time instead of frame sleeps or a mirrored solver.
function motionFixture(reduced = false) {
  const node = () => ({
    style: { animation: '', transform: '', transition: '', opacity: '', willChange: '' },
    getBoundingClientRect: () => ({ height: 400 }),
  })
  const panel = node(), backdrop = node()
  let closes = 0
  const motion = createDismissMotion(panel as unknown as HTMLElement, backdrop as unknown as HTMLElement, reduced, () => { closes++ })
  return { panel, backdrop, motion, closes: () => closes }
}

test('pull follows the finger and fades the backdrop; cancellation settles then permits another pull', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture()
  f.motion.drag(80)
  assert.equal(f.panel.style.transform, 'translate3d(0, 80px, 0)')
  assert.equal(f.backdrop.style.opacity, '0.8')
  assert.equal(f.backdrop.style.animation, 'none', 'entry fill must not override interactive opacity')
  assert.equal(f.panel.style.transition, 'none')
  f.motion.release(false)
  assert.equal(f.panel.style.transform, 'translate3d(0, 0px, 0)')
  assert.notEqual(f.panel.style.transition, 'none')
  assert.equal(f.backdrop.style.opacity, '1')
  assert.equal(f.motion.settling, true)
  t.mock.timers.tick(220)
  assert.equal(f.closes(), 0)
  assert.equal(f.motion.settling, false)
  f.motion.drag(60)
  assert.equal(f.panel.style.transform, 'translate3d(0, 60px, 0)')
  f.motion.dispose()
})

test('confirmed dismissal moves the full panel out before closing, without flashing back', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture()
  f.motion.drag(130)
  f.motion.release(true)
  assert.equal(f.panel.style.transform, 'translate3d(0, 400px, 0)')
  assert.equal(f.backdrop.style.opacity, '0')
  assert.equal(f.closes(), 0)
  t.mock.timers.tick(179)
  assert.equal(f.closes(), 0)
  t.mock.timers.tick(1)
  assert.equal(f.closes(), 1)
  assert.equal(f.panel.style.transform, 'translate3d(0, 400px, 0)', 'keep exit position until React unmounts')
  f.motion.dispose()
  assert.equal(f.panel.style.transform, '')
  assert.equal(f.backdrop.style.opacity, '')
})

test('reduced motion has no spatial drag or exit, retaining fade feedback and closure', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture(true)
  f.motion.drag(120)
  assert.equal(f.panel.style.transform, 'none')
  assert.ok(Number(f.panel.style.opacity) < 1)
  f.motion.release(true)
  assert.equal(f.panel.style.transform, 'none')
  assert.equal(f.panel.style.opacity, '0')
  t.mock.timers.tick(100)
  assert.equal(f.closes(), 1)
  f.motion.dispose()
})

test('a short pull restores the panel and backdrop with reduced motion, without closing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture(true)
  f.motion.drag(60)
  f.motion.release(false)
  assert.equal(f.panel.style.transform, 'none')
  assert.equal(f.panel.style.opacity, '1')
  assert.equal(f.backdrop.style.opacity, '1')
  t.mock.timers.tick(100)
  assert.equal(f.motion.settling, false)
  assert.equal(f.closes(), 0)
  f.motion.dispose()
})

test('closing another way during an exit cancels its delayed callback and restores inline styles', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture()
  f.motion.drag(150)
  f.motion.release(true)
  f.motion.dispose()
  t.mock.timers.tick(1000)
  assert.equal(f.closes(), 0)
  assert.deepEqual(f.panel.style, { animation: '', transform: '', transition: '', opacity: '', willChange: '' })
})
