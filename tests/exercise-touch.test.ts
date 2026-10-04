import assert from 'node:assert/strict'
import test from 'node:test'
import { bindTwoFingerRotation } from '../src/lib/exerciseTouch'

const point = (identifier: number, clientX: number, clientY: number) => ({ identifier, clientX, clientY })

function fixture() {
  const element = Object.assign(new EventTarget(), { clientWidth: 400 })
  const rotations: number[][] = []
  const active: boolean[] = []
  const cleanup = bindTwoFingerRotation(element as unknown as HTMLElement, (x, y) => rotations.push([x, y]), value => active.push(value))
  const send = (type: string, touches: ReturnType<typeof point>[], cancelable = true) => {
    const event = new Event(type, { cancelable })
    Object.defineProperty(event, 'targetTouches', { value: touches })
    element.dispatchEvent(event)
    return event.defaultPrevented
  }
  return { rotations, active, cleanup, send }
}

test('one finger leaves native scrolling untouched', () => {
  const f = fixture()
  assert.equal(f.send('touchstart', [point(1, 10, 20)]), false)
  assert.equal(f.send('touchmove', [point(1, 10, 120)]), false)
  assert.deepEqual(f.rotations, [])
  assert.deepEqual(f.active, [])
  f.cleanup()
})

test('two fingers rotate around their center without native page scrolling', () => {
  const f = fixture()
  assert.equal(f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)]), true)
  assert.equal(f.send('touchmove', [point(2, 70, 60), point(1, 30, 60)]), true)
  assert.equal(f.rotations.length, 1)
  assert.ok(Math.abs(f.rotations[0][0] + Math.PI / 20) < 1e-10)
  assert.ok(Math.abs(f.rotations[0][1] + Math.PI / 10) < 1e-10)
  assert.deepEqual(f.active, [true])
  f.cleanup()
})

test('lifting one finger stops rotating and releases scrolling', () => {
  const f = fixture()
  f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)])
  assert.equal(f.send('touchend', [point(1, 20, 40)]), false)
  assert.equal(f.send('touchmove', [point(1, 20, 100)]), false)
  assert.deepEqual(f.rotations, [])
  assert.deepEqual(f.active, [true, false])
  f.cleanup()
})

test('a scroll already owned by the browser cannot become a rotation', () => {
  const f = fixture()
  assert.equal(f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)], false), false)
  assert.equal(f.send('touchmove', [point(1, 50, 40), point(2, 90, 40)], false), false)
  assert.deepEqual(f.rotations, [])
  f.cleanup()
})

test('finger replacement resets the center instead of jumping the model', () => {
  const f = fixture()
  f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)])
  f.send('touchmove', [point(1, 20, 40), point(3, 200, 40)])
  assert.deepEqual(f.rotations, [])
  f.send('touchmove', [point(1, 30, 40), point(3, 210, 40)])
  assert.equal(f.rotations.length, 1)
  assert.ok(Math.abs(f.rotations[0][0] + Math.PI / 20) < 1e-10)
  f.cleanup()
})

test('cancellation and cleanup release the gesture listeners', () => {
  const f = fixture()
  f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)])
  f.send('touchcancel', [])
  assert.deepEqual(f.active, [true, false])
  f.cleanup()
  assert.equal(f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)]), false)
  assert.equal(f.send('touchmove', [point(1, 30, 40), point(2, 70, 40)]), false)
  assert.deepEqual(f.rotations, [])
})

// WebGL context loss can unbind the canvas in the middle of a gesture.
test('cleanup during rotation clears the active state', () => {
  const f = fixture()
  f.send('touchstart', [point(1, 20, 40), point(2, 60, 40)])
  f.cleanup()
  assert.deepEqual(f.active, [true, false])
  assert.equal(f.send('touchmove', [point(1, 30, 40), point(2, 70, 40)]), false)
  assert.deepEqual(f.rotations, [])
})
