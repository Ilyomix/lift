import assert from 'node:assert/strict'
import test from 'node:test'
import { bindSwipeNavigation, excludesSwipeTarget, mainRouteIndex, type SwipeAction, type SwipeContext } from '../src/lib/swipeNavigation'

const point = (identifier: number, clientX: number, clientY: number) => ({ identifier, clientX, clientY })
function fixture(path = '', canGoBack = false) {
  const target = new EventTarget()
  const actions: SwipeAction[] = []
  const context: SwipeContext = { path, left: 0, width: 390, scrollY: 0, canGoBack }
  let excluded = false, blocked = false
  const cleanup = bindSwipeNavigation(target as unknown as Document, {
    context: () => context, excluded: () => excluded, blocked: () => blocked,
    perform: action => actions.push(action),
  })
  const send = (type: string, touches: ReturnType<typeof point>[], time: number, changed = touches, cancelable = true, prevented = false) => {
    const event = new Event(type, { cancelable })
    Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changed }, timeStamp: { value: time } })
    if (prevented) event.preventDefault()
    target.dispatchEvent(event)
    return event.defaultPrevented
  }
  const swipe = (fromX: number, toX: number, dy = 0, duration = 400) => {
    send('touchstart', [point(1, fromX, 100)], 0)
    const claimed = send('touchmove', [point(1, toX, 100 + dy)], duration / 2)
    send('touchend', [], duration, [point(1, toX, 100 + dy)])
    return claimed
  }
  return { actions, context, cleanup, send, swipe, exclude: () => { excluded = true }, block: () => { blocked = true } }
}

test('deliberate swipes follow tab order, including a slow accessible swipe', () => {
  const f = fixture('seance')
  assert.equal(f.swipe(240, 140, 8, 850), true)
  assert.deepEqual(f.actions, [{ type: 'navigate', path: 'calendrier' }])
  f.context.path = 'calendrier'
  f.swipe(140, 240)
  assert.deepEqual(f.actions.at(-1), { type: 'navigate', path: 'seance' })
  f.cleanup()
})

test('tab edges do not wrap and do not claim the gesture', () => {
  const first = fixture(''), last = fixture('plus')
  assert.equal(first.swipe(100, 220), false)
  assert.equal(last.swipe(220, 100), false)
  assert.deepEqual([...first.actions, ...last.actions], [])
  first.cleanup(); last.cleanup()
})

test('progress sub-tabs are main pages, exercise and measurement routes are not', () => {
  for (const path of ['progres', 'progres/corps', 'progres/volume', 'progres/seances']) assert.equal(mainRouteIndex(path), 3)
  for (const path of ['progres/exercice/chest-press', 'progres/corps/mesure', 'plus/programme']) assert.equal(mainRouteIndex(path), -1)
  const f = fixture('progres/seances')
  f.swipe(240, 140)
  assert.deepEqual(f.actions, [{ type: 'navigate', path: 'plus' }])
  f.cleanup()
})

test('program tab follows Calendar navigation while its session sheets keep edge back', () => {
  assert.equal(mainRouteIndex('calendrier/programme'), 2)
  assert.equal(mainRouteIndex('calendrier/programme/PUSH'), -1)
  const program = fixture('calendrier/programme')
  program.swipe(240, 140)
  program.swipe(140, 240)
  assert.deepEqual(program.actions, [{ type: 'navigate', path: 'progres' }, { type: 'navigate', path: 'seance' }])
  const sheet = fixture('calendrier/programme/PUSH', true)
  assert.equal(sheet.swipe(100, 220), false)
  assert.equal(sheet.swipe(30, 130), true)
  assert.deepEqual(sheet.actions, [{ type: 'back' }])
  program.cleanup(); sheet.cleanup()
})

test('secondary pages return only from the inner left edge and only with real history', () => {
  const f = fixture('plus/reglages', true)
  assert.equal(f.swipe(100, 220), false)
  assert.equal(f.swipe(30, 130), true)
  assert.deepEqual(f.actions, [{ type: 'back' }])
  f.context.canGoBack = false
  assert.equal(f.swipe(30, 130), false)
  assert.equal(f.actions.length, 1)
  f.cleanup()
})

test('outer 20 pixels remain reserved to browser/system gestures', () => {
  const f = fixture('seance', true)
  assert.equal(f.swipe(10, 120), false)
  assert.equal(f.swipe(380, 250), false)
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('vertical intent is never reclaimed after it turns horizontal', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 220, 100)], 0)
  assert.equal(f.send('touchmove', [point(1, 217, 125)], 60), false)
  assert.equal(f.send('touchmove', [point(1, 100, 126)], 150), false)
  f.send('touchend', [], 200, [point(1, 100, 126)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('diagonal, short, overlong and reversed gestures cannot navigate', () => {
  const f = fixture('seance')
  assert.equal(f.swipe(220, 140, 70), false)
  f.swipe(220, 175)
  f.swipe(220, 140, 0, 950)
  f.send('touchstart', [point(1, 220, 100)], 0)
  f.send('touchmove', [point(1, 190, 100)], 100)
  assert.equal(f.send('touchmove', [point(1, 300, 100)], 200), false)
  f.send('touchend', [], 300, [point(1, 300, 100)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('adding a second finger cancels and does not rearm when one lifts', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 220, 100)], 0)
  f.send('touchstart', [point(1, 220, 100), point(2, 180, 100)], 40)
  assert.equal(f.send('touchmove', [point(1, 120, 100), point(2, 80, 100)], 80), false)
  f.send('touchend', [point(1, 120, 100)], 100, [point(2, 80, 100)])
  assert.equal(f.send('touchmove', [point(1, 80, 100)], 120), false)
  f.send('touchend', [], 150, [point(1, 80, 100)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('interactive targets, modal opening and browser-owned scrolling keep their gestures', () => {
  const excluded = fixture('seance'); excluded.exclude()
  assert.equal(excluded.swipe(220, 100), false)
  const modal = fixture('seance')
  modal.send('touchstart', [point(1, 220, 100)], 0); modal.block()
  assert.equal(modal.send('touchmove', [point(1, 100, 100)], 100), false)
  const native = fixture('seance')
  native.send('touchstart', [point(1, 220, 100)], 0)
  assert.equal(native.send('touchmove', [point(1, 100, 100)], 100, [], false), false)
  native.send('touchend', [], 200, [point(1, 100, 100)])
  assert.deepEqual([...excluded.actions, ...modal.actions, ...native.actions], [])
  excluded.cleanup(); modal.cleanup(); native.cleanup()
})

test('route, viewport and scroll changes invalidate a pending swipe', () => {
  for (const change of [(c: SwipeContext) => { c.path = 'plus' }, (c: SwipeContext) => { c.width = 320 }, (c: SwipeContext) => { c.scrollY = 15 }]) {
    const f = fixture('seance')
    f.send('touchstart', [point(1, 220, 100)], 0)
    f.send('touchmove', [point(1, 120, 100)], 100)
    change(f.context)
    f.send('touchend', [], 200, [point(1, 120, 100)])
    assert.deepEqual(f.actions, [])
    f.cleanup()
  }
})

test('cancel and unmount remove navigation ownership', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 220, 100)], 0)
  f.send('touchmove', [point(1, 120, 100)], 100)
  f.send('touchcancel', [], 120)
  f.send('touchend', [], 150, [point(1, 120, 100)])
  f.cleanup()
  assert.equal(f.swipe(220, 100), false)
  assert.deepEqual(f.actions, [])
})

test('exclusion uses ancestors for button text, the entire 3D viewport and horizontal scrollers', () => {
  class ElementStub {
    clientWidth = 300
    scrollWidth = 300
    overflowX = 'visible'
    constructor(readonly tagName: string, readonly parentElement: ElementStub | null = null, readonly ignore = false) {}
    closest(selector: string): ElementStub | null {
      const selectors = selector.split(',').map(s => s.trim())
      for (let node: ElementStub | null = this; node; node = node.parentElement) {
        if (selectors.includes(node.tagName.toLowerCase()) || (node.ignore && selectors.includes('[data-swipe-ignore]'))) return node
      }
      return null
    }
  }
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element')
  const originalStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle')
  Object.defineProperty(globalThis, 'Element', { value: ElementStub, configurable: true })
  Object.defineProperty(globalThis, 'getComputedStyle', { value: (node: ElementStub) => ({ overflowX: node.overflowX }), configurable: true })
  try {
    const main = new ElementStub('MAIN')
    const check = (target: ElementStub) => excludesSwipeTarget(target as unknown as EventTarget)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('BUTTON', main))), true)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('A', main))), true)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('DIV', main, true))), true)
    assert.equal(check(new ElementStub('CANVAS', main)), true)
    const scroller = new ElementStub('DIV', main)
    scroller.scrollWidth = 600; scroller.overflowX = 'auto'
    assert.equal(check(new ElementStub('P', scroller)), true)
    assert.equal(check(new ElementStub('P', main)), false)
    assert.equal(check(new ElementStub('P')), true)
  } finally {
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement)
    else Reflect.deleteProperty(globalThis, 'Element')
    if (originalStyle) Object.defineProperty(globalThis, 'getComputedStyle', originalStyle)
    else Reflect.deleteProperty(globalThis, 'getComputedStyle')
  }
})
