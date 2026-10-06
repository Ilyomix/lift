import assert from 'node:assert/strict'
import test from 'node:test'
import { bindSwipeNavigation, excludesSwipeTarget, mainRouteIndex, type SwipeAction, type SwipeContext, type SwipeRelease } from '../src/lib/swipeNavigation'

const point = (identifier: number, clientX: number, clientY: number) => ({ identifier, clientX, clientY })
function fixture(path = '', canGoBack = false) {
  const target = new EventTarget()
  const actions: SwipeAction[] = []
  const previews: SwipeAction[] = []
  const drags: number[] = [], releases: SwipeRelease[] = []
  let cancellations = 0
  const context: SwipeContext = { path, left: 0, width: 390, scrollY: 0, canGoBack }
  let excluded = false, blocked = false
  const cleanup = bindSwipeNavigation(target as unknown as Document, {
    context: () => context, excluded: () => excluded, blocked: () => blocked,
    perform: (action, release) => { actions.push(action); releases.push(release) },
    drag: (offset, action) => { drags.push(offset); previews.push(action) }, cancel: () => { cancellations++ },
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
  return { actions, drags, previews, releases, get cancellations() { return cancellations }, context, cleanup, send, swipe, exclude: () => { excluded = true }, block: () => { blocked = true } }
}

test('the first small horizontal move is claimed before the browser takes scrolling ownership', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 240, 100)], 0, undefined, false)
  assert.equal(f.send('touchmove', [point(1, 234, 101)], 20), true,
    'prevent the default action of the first clearly horizontal move, not only later large moves')
  f.send('touchmove', [point(1, 210, 100)], 50)
  f.send('touchmove', [point(1, 170, 100)], 100)
  f.send('touchend', [], 150, [point(1, 155, 100)])
  assert.deepEqual(f.drags, [-6, -30, -70])
  assert.deepEqual(f.previews, Array(3).fill({ type: 'navigate', path: 'calendrier' }))
  assert.deepEqual(f.releases, [{ offset: -85, width: 390 }])
  assert.equal(f.cancellations, 0, 'successful release must not snap back before navigating')
  f.cleanup()
})

test('a short claimed drag follows all the way back, cancels once and suppresses its click', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 240, 100)], 0)
  f.send('touchmove', [point(1, 200, 100)], 50)
  f.send('touchmove', [point(1, 236, 100)], 100)
  f.send('touchmove', [point(1, 240, 100)], 120)
  assert.equal(f.send('touchend', [], 150, [point(1, 240, 100)]), true)
  assert.deepEqual(f.drags, [-40, -4, 0])
  assert.equal(f.cancellations, 1)
  assert.deepEqual(f.actions, [])
  f.cleanup()
  assert.equal(f.cancellations, 1)
})

test('claimed drag cancellation clears visual ownership on interruption and unmount', () => {
  for (const interrupt of [
    (f: ReturnType<typeof fixture>) => f.send('touchcancel', [], 150),
    (f: ReturnType<typeof fixture>) => f.send('touchstart', [point(1, 200, 100), point(2, 180, 100)], 150),
    (f: ReturnType<typeof fixture>) => { f.context.path = 'plus'; f.send('touchend', [], 150, [point(1, 100, 100)]) },
    (f: ReturnType<typeof fixture>) => f.cleanup(),
  ]) {
    const f = fixture('seance')
    f.send('touchstart', [point(1, 240, 100)], 0)
    f.send('touchmove', [point(1, 200, 100)], 50)
    interrupt(f)
    assert.equal(f.cancellations, 1)
    assert.deepEqual(f.actions, [])
    f.cleanup()
    assert.equal(f.cancellations, 1)
  }
})

test('deliberate swipes follow tab order, including a slow accessible swipe', () => {
  const f = fixture('seance')
  assert.equal(f.swipe(240, 140, 8, 1800), true)
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

test('passive non-cancelable touchstart can lead to a deliberate cancelable swipe', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 108, 100)], 0, undefined, false)
  assert.equal(f.send('touchmove', [point(1, 280, 100)], 160), true)
  assert.equal(f.send('touchend', [], 300, [point(1, 280, 100)]), true)
  assert.deepEqual(f.actions, [{ type: 'navigate', path: '' }])
  f.cleanup()
})

test('non-cancelable movement after a passive start still belongs to the browser', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 108, 100)], 0, undefined, false)
  assert.equal(f.send('touchmove', [point(1, 280, 100)], 160, undefined, false), false)
  f.send('touchend', [], 300, [point(1, 280, 100)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('progress sub-tabs are main pages, exercise and measurement routes are not', () => {
  for (const path of ['progres', 'progres/corps', 'progres/volume', 'progres/seances']) assert.equal(mainRouteIndex(path), 3)
  for (const path of ['progres/exercice/chest-press', 'progres/corps/mesure', 'plus/programme']) assert.equal(mainRouteIndex(path), -1)
  const f = fixture('progres/seances')
  f.swipe(240, 140)
  assert.deepEqual(f.actions, [{ type: 'navigate', path: 'plus' }])
  f.cleanup()
})

test('program tab follows Calendar navigation while its editor supports back from the page', () => {
  assert.equal(mainRouteIndex('calendrier/programme'), 2)
  assert.equal(mainRouteIndex('calendrier/programme/PUSH'), -1)
  const program = fixture('calendrier/programme')
  program.swipe(240, 140)
  program.swipe(140, 240)
  assert.deepEqual(program.actions, [{ type: 'navigate', path: 'progres' }, { type: 'navigate', path: 'seance' }])
  const sheet = fixture('calendrier/programme/PUSH', true)
  assert.equal(sheet.swipe(100, 220), true)
  assert.deepEqual(sheet.actions, [{ type: 'back' }])
  program.cleanup(); sheet.cleanup()
})

test('secondary pages return from any content area and only with real history', () => {
  const f = fixture('plus/reglages', true)
  f.send('touchstart', [point(1, 100, 100)], 0)
  f.send('touchmove', [point(1, 106, 100)], 25)
  assert.deepEqual(f.previews, [{ type: 'back' }], 'destination is known while the finger is still down')
  assert.deepEqual(f.actions, [], 'preview does not navigate before release')
  f.send('touchcancel', [], 40)
  assert.equal(f.swipe(100, 220), true)
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

test('diagonal, short and reversed gestures cannot navigate', () => {
  const f = fixture('seance')
  assert.equal(f.swipe(220, 140, 70), false)
  f.swipe(220, 175)
  f.send('touchstart', [point(1, 220, 100)], 0)
  f.send('touchmove', [point(1, 190, 100)], 100)
  assert.equal(f.send('touchmove', [point(1, 300, 100)], 200), false)
  f.send('touchend', [], 300, [point(1, 300, 100)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('a stationary hold and an ambiguous small diagonal do not claim a gesture', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 220, 100)], 0)
  assert.equal(f.send('touchmove', [point(1, 220, 100)], 1000), false)
  assert.equal(f.send('touchmove', [point(1, 216, 104)], 1100), false)
  assert.deepEqual(f.drags, [])
  assert.equal(f.send('touchmove', [point(1, 213, 130)], 1200), false)
  assert.equal(f.send('touchmove', [point(1, 100, 130)], 1400), false)
  f.send('touchend', [], 1500, [point(1, 100, 130)])
  assert.deepEqual(f.actions, [])
  f.cleanup()
})

test('a claimed drag remains interactive after a pause and can still be cancelled', () => {
  const f = fixture('seance')
  f.send('touchstart', [point(1, 240, 100)], 0)
  assert.equal(f.send('touchmove', [point(1, 200, 100)], 50), true)
  assert.equal(f.send('touchmove', [point(1, 170, 100)], 1600), true)
  assert.equal(f.send('touchmove', [point(1, 235, 100)], 2200), true)
  assert.equal(f.send('touchend', [], 2500, [point(1, 235, 100)]), true)
  assert.deepEqual(f.drags, [-40, -70, -5])
  assert.deepEqual(f.actions, [])
  assert.equal(f.cancellations, 1)
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
    touchAction = 'auto'
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
  Object.defineProperty(globalThis, 'getComputedStyle', { value: (node: ElementStub) => ({ overflowX: node.overflowX, touchAction: node.touchAction }), configurable: true })
  try {
    const main = new ElementStub('MAIN')
    const check = (target: ElementStub) => excludesSwipeTarget(target as unknown as EventTarget)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('BUTTON', main))), false)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('A', main))), false)
    assert.equal(check(new ElementStub('SPAN', new ElementStub('DIV', main, true))), true)
    assert.equal(check(new ElementStub('CANVAS', main)), true)
    assert.equal(check(new ElementStub('INPUT', main)), true)
    assert.equal(check(new ElementStub('SELECT', main)), true)
    const reorderHandle = new ElementStub('BUTTON', main)
    reorderHandle.touchAction = 'none'
    assert.equal(check(new ElementStub('SVG', reorderHandle)), true, 'a sortable grip owns touch even though it is an ordinary button')
    const chart = new ElementStub('RECT', new ElementStub('SVG', main))
    chart.touchAction = 'pan-y'
    assert.equal(check(chart), true, 'horizontal chart scrubbing must not change tabs')
    const scroller = new ElementStub('DIV', main)
    scroller.scrollWidth = 600; scroller.overflowX = 'auto'
    assert.equal(check(new ElementStub('P', scroller)), true)
    assert.equal(check(new ElementStub('P', main)), false)
    main.touchAction = 'pan-y'
    assert.equal(check(new ElementStub('P', main)), false,
      'a page that permits native vertical panning must still allow app horizontal navigation')
    assert.equal(check(chart), true, 'the chart still owns its own horizontal scrubbing')
    main.touchAction = 'pan-y pinch-zoom'
    assert.equal(check(new ElementStub('P', main)), false, 'pinch zoom can remain allowed on the page')
    const pageSection = new ElementStub('DIV', main)
    pageSection.touchAction = 'pan-y'
    assert.equal(check(new ElementStub('SPAN', pageSection)), false)
    assert.equal(check(new ElementStub('P')), true)
  } finally {
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement)
    else Reflect.deleteProperty(globalThis, 'Element')
    if (originalStyle) Object.defineProperty(globalThis, 'getComputedStyle', originalStyle)
    else Reflect.deleteProperty(globalThis, 'getComputedStyle')
  }
})
