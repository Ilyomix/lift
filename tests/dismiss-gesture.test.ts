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

test('subpixel downward jitter does not capture a following upward or horizontal scroll', () => {
  for (const next of [point(100, 80), point(160, 100)]) {
    const f = fixture()
    f.send('touchstart', [point(100, 100)], 0)
    assert.equal(f.send('touchmove', [point(100, 100.5)], 8), false)
    assert.equal(f.send('touchmove', [next], 24), false)
    assert.equal(f.send('touchmove', [point(100, 250)], 80), false, 'native scrolling is never reclaimed after direction is established')
    assert.equal(f.send('touchend', [], 100, [point(100, 250)]), false)
    assert.deepEqual(f.drags, [])
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

test('a deliberate small downward move is owned after initial touch jitter', () => {
  const f = fixture()
  f.send('touchstart', [point(100, 100)], 0, undefined, false)
  assert.equal(f.send('touchmove', [point(100, 99.5)], 8), false)
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

// Drive the browser animation's completion explicitly: elapsed wall time alone
// must never unmount a panel that has not completed its rendered exit.
function motionFixture(reduced = false) {
  const node = () => {
    const animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; onfinish: (() => void) | null; cancelled: boolean; cancel: () => void }[] = []
    const style = { animation: '', transform: '', transition: '', opacity: '', willChange: '' }
    return {
      style, animations,
      ownerDocument: { defaultView: { getComputedStyle: () => ({ transform: style.transform || 'none', opacity: style.opacity || '1' }) } },
      getBoundingClientRect: () => ({ height: 400 }),
      animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
        const animation = { frames, options, onfinish: null as (() => void) | null, cancelled: false, cancel() { this.cancelled = true } }
        animations.push(animation)
        return animation
      },
    }
  }
  const panel = node(), backdrop = node()
  let closes = 0
  const motion = createDismissMotion(panel as unknown as HTMLElement, backdrop as unknown as HTMLElement, reduced, () => { closes++ })
  const finish = () => panel.animations.at(-1)!.onfinish?.()
  return { panel, backdrop, motion, finish, closes: () => closes }
}

test('pull follows the finger; cancellation returns before another pull is allowed', () => {
  const f = motionFixture()
  f.motion.drag(80)
  assert.equal(f.panel.style.transform, 'translate3d(0, 80px, 0)')
  assert.equal(f.backdrop.style.opacity, '0.8')
  f.motion.release(false)
  assert.deepEqual(f.panel.animations[0].frames, [{ transform: 'translate3d(0, 80px, 0)' }, { transform: 'translate3d(0, 0px, 0)' }])
  assert.equal(f.motion.settling, true)
  f.finish()
  assert.equal(f.closes(), 0)
  assert.equal(f.motion.settling, false)
  f.motion.drag(60)
  assert.equal(f.panel.style.transform, 'translate3d(0, 60px, 0)')
  f.motion.dispose()
})

test('dismissal waits for the rendered exit, not a wall-clock timeout', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = motionFixture()
  f.motion.drag(130)
  f.motion.release(true)
  assert.deepEqual(f.panel.animations[0].frames, [{ transform: 'translate3d(0, 130px, 0)' }, { transform: 'translate3d(0, 400px, 0)' }])
  assert.equal(f.backdrop.style.opacity, '0')
  t.mock.timers.tick(1000)
  assert.equal(f.closes(), 0, 'a busy frame must not turn the exit into an abrupt unmount')
  f.finish()
  assert.equal(f.closes(), 1)
  assert.equal(f.panel.style.transform, 'translate3d(0, 400px, 0)', 'exit endpoint persists until React unmounts')
  f.motion.dispose()
  assert.equal(f.panel.style.transform, '')
})

test('a button closes from the current position and duplicate requests do not restart the exit', () => {
  const f = motionFixture()
  f.motion.release(true)
  f.motion.release(true)
  assert.equal(f.panel.animations.length, 1)
  assert.deepEqual(f.panel.animations[0].frames, [{ transform: 'none' }, { transform: 'translate3d(0, 400px, 0)' }])
  assert.equal(f.closes(), 0)
  f.finish()
  assert.equal(f.closes(), 1)
  f.motion.dispose()
})

test('Reduce Motion fades without spatial movement and closes on completion', () => {
  const f = motionFixture(true)
  f.motion.drag(120)
  assert.equal(f.panel.style.transform, 'none')
  const opacity = f.panel.style.opacity
  f.motion.release(true)
  assert.deepEqual(f.panel.animations[0].frames, [{ opacity }, { opacity: '0' }])
  assert.equal(f.panel.style.transform, 'none')
  assert.equal(f.closes(), 0)
  f.finish()
  assert.equal(f.closes(), 1)
  f.motion.dispose()
})

test('a short pull returns with Reduce Motion and does not close', () => {
  const f = motionFixture(true)
  f.motion.drag(60)
  f.motion.release(false)
  f.finish()
  assert.equal(f.panel.style.opacity, '1')
  assert.equal(f.backdrop.style.opacity, '1')
  assert.equal(f.motion.settling, false)
  assert.equal(f.closes(), 0)
  f.motion.dispose()
})

test('a close button can interrupt a returning panel, while disposal cancels all callbacks', () => {
  const f = motionFixture()
  f.motion.drag(60)
  f.motion.release(false)
  const returning = f.panel.animations[0]
  f.motion.release(true)
  assert.equal(returning.cancelled, true)
  assert.equal(returning.onfinish, null)
  assert.equal(f.panel.animations.length, 2)
  f.motion.dispose()
  f.finish()
  assert.equal(f.closes(), 0)
  assert.ok(f.panel.animations.every(a => a.cancelled))
  assert.deepEqual(f.panel.style, { animation: '', transform: '', transition: '', opacity: '', willChange: '' })
})
