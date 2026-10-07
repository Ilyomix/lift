import assert from 'node:assert/strict'
import test from 'node:test'
import { createPageMotion } from '../src/components/SwipeNavigation'
import { navigate } from '../src/lib/router'

test('page motion restores each Back entry and keeps tab previews through push, replace and Forward', () => {
  const names = ['window', 'document', 'Element', 'getComputedStyle', 'MutationObserver', 'HashChangeEvent'] as const
  const globals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  type AnimationStub = { onfinish: (() => void) | null; cancelled: boolean; cancel(): void }
  const animations: AnimationStub[] = []
  const copies: NodeStub[] = []
  class NodeStub {
    marker = ''
    className = 'route-surface'
    inert = false
    scrollTop = 0
    clientWidth = 390
    scrollWidth = 390
    parentElement = null
    children: NodeStub[] = []
    attributes = new Set<string>()
    style = { removeProperty(name: string) { delete (this as Record<string, unknown>)[name] } } as CSSStyleDeclaration
    closest(selector: string) { return selector === '.route-viewport' ? viewport : selector === '.route-surface' ? this : null }
    querySelectorAll() { return [] }
    getBoundingClientRect() { return { left: 0, width: 390 } }
    hasAttribute(name: string) { return this.attributes.has(name) }
    setAttribute(name: string) { this.attributes.add(name) }
    removeAttribute(name: string) { this.attributes.delete(name) }
    cloneNode() { const copy = new NodeStub(); copy.marker = this.marker; return copy }
    append(node: NodeStub) { this.children.push(node) }
    remove() { const index = copies.indexOf(this); if (index >= 0) copies.splice(index, 1) }
    animate() {
      const animation: AnimationStub = { onfinish: null, cancelled: false, cancel() { this.cancelled = true } }
      animations.push(animation)
      return animation
    }
  }
  const viewport = new NodeStub(), screen = new NodeStub()
  const host = new EventTarget()
  const entries: Array<{ hash: string; state: unknown }> = [{ hash: '#/', state: null }]
  let position = 0
  const location = { get hash() { return entries[position].hash } }
  const history = {
    scrollRestoration: 'auto',
    get state() { return entries[position].state },
    replaceState(state: unknown, _title: string, hash?: string) { entries[position] = { hash: hash ?? location.hash, state } },
    pushState(state: unknown, _title: string, hash: string) { entries.splice(position + 1); entries.push({ hash, state }); position++ },
    go(delta: number) {
      position += delta
      host.dispatchEvent(new Event('popstate'))
      host.dispatchEvent(new Event('hashchange'))
    },
    back() { this.go(-1) },
  }
  const win = Object.assign(host, {
    history, location, scrollY: 0,
    scrollTo({ top }: { top: number }) { this.scrollY = top },
    getSelection: () => null,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
  const doc = Object.assign(new EventTarget(), {
    createElement: () => new NodeStub(), body: { append: (node: NodeStub) => copies.push(node) },
    documentElement: new NodeStub(), activeElement: null, querySelector: () => null,
  })
  const values = { window: win, document: doc, Element: NodeStub,
    getComputedStyle: () => ({ touchAction: 'auto', overflowX: 'visible' }),
    MutationObserver: class { observe() {} disconnect() {} }, HashChangeEvent: class extends Event {},
  }
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: values[name] })
  const motion = createPageMotion(screen as unknown as HTMLElement, '')
  const finish = () => { for (const animation of animations.splice(0)) if (!animation.cancelled) animation.onfinish?.() }
  const arrive = (marker = location.hash) => { screen.marker = marker; motion.arrive(location.hash.slice(2)); finish() }
  const push = (path: string, marker?: string) => { navigate(path); arrive(marker) }
  const back = () => { history.back(); arrive() }
  const touch = (type: string, x: number) => {
    const event = new Event(type, { cancelable: true })
    const point = { identifier: 1, clientX: x, clientY: 100 }
    Object.defineProperties(event, { target: { value: screen }, touches: { value: type === 'touchcancel' ? [] : [point] }, changedTouches: { value: [point] } })
    doc.dispatchEvent(event)
  }
  try {
    screen.marker = 'first-home'
    win.scrollY = 120
    push('plus/reglages'); win.scrollY = 240
    push('', 'second-home'); win.scrollY = 900
    push('progres'); win.scrollY = 360
    back(); assert.equal(win.scrollY, 900)
    back(); assert.equal(win.scrollY, 240)
    touch('touchstart', 100); touch('touchmove', 200)
    assert.equal(copies.at(-1)?.children[0].marker, 'first-home', 'Back previews its exact earlier visit')
    assert.equal(copies.at(-1)?.scrollTop, 120)
    touch('touchcancel', 200); finish()
    back(); assert.equal(win.scrollY, 120, 'Back cannot reuse the scroll of a later Home visit')

    history.go(1); arrive()
    win.scrollY = 260
    push('', 'branched-home')
    assert.equal(win.scrollY, 0, 'a new push starts at the top despite an old entry at the same position')
    win.scrollY = 450
    push('progres'); back()
    assert.equal(win.scrollY, 450, 'a branch replaces the discarded entry snapshot')
    back(); assert.equal(win.scrollY, 260)
    back(); assert.equal(win.scrollY, 120)

    push('calendrier'); win.scrollY = 180
    const count = entries.length
    navigate('calendrier/programme', { replace: true, transition: 'none' }); arrive()
    assert.equal(entries.length, count)
    win.scrollY = 340
    push('seance/workout-id'); back()
    assert.equal(win.scrollY, 340)
    navigate('calendrier', { replace: true, transition: 'none' }); arrive('replaced-calendar')
    win.scrollY = 520
    history.go(1); arrive()
    touch('touchstart', 100); touch('touchmove', 200)
    assert.equal(copies.at(-1)?.children[0].marker, 'replaced-calendar', 'Forward keeps the replaced entry as its Back destination')
    assert.equal(copies.at(-1)?.scrollTop, 520)
    touch('touchcancel', 200); finish()
    back(); assert.equal(win.scrollY, 520)
    touch('touchstart', 240); touch('touchmove', 140)
    assert.equal(copies.at(-1)?.children[0].marker, '#/progres', 'adjacent tabs still preview the last visit to that route')
    assert.equal(copies.at(-1)?.scrollTop, 0, 'a tab swipe previews the same top position it opens')
    touch('touchcancel', 140); finish()
  } finally {
    motion.dispose()
    for (const name of names) {
      const descriptor = globals.get(name)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
