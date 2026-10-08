import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactNode } from 'react'
import { Button, Sheet } from '../src/components/ui'

const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
const originals = { document: globalThis.document, window: globalThis.window, Element: globalThis.Element, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame }
class Node extends EventTarget {
  nodeType = 1
  style = { animation: '', transform: '', transition: '', opacity: '', willChange: '', overflow: '' }
  animations: { onfinish: (() => void) | null; cancel(): void; frames: Keyframe[] }[] = []
  ownerDocument = { defaultView: { getComputedStyle: () => ({ transform: this.style.transform || 'none', opacity: this.style.opacity || '1' }) } }
  getBoundingClientRect() { return { height: 400 } }
  animate(frames: Keyframe[]) {
    const animation = { frames, onfinish: null as (() => void) | null, cancel() {} }
    this.animations.push(animation)
    return animation
  }
  focus() {}
  querySelector() { return null }
  querySelectorAll() { return [] }
}
let body: Node
beforeEach(() => {
  body = new Node()
  Object.assign(globalThis, {
    document: Object.assign(new EventTarget(), { body, activeElement: new Node() }),
    window: { matchMedia: () => ({ matches: false }) },
    Element: Node,
    requestAnimationFrame: (fn: () => void) => { fn(); return 1 },
    cancelAnimationFrame() {},
  })
})
afterEach(() => Object.assign(globalThis, originals))

function host() {
  const values: any[] = [], effects: { deps: unknown[] | undefined; cleanup?: () => void; run: () => (() => void) | undefined }[] = []
  let cursor = 0, effectCursor = 0
  let pending: (() => void)[] = []
  const panel = new Node(), backdrop = new Node()
  const hooks = {
    useState(initial: unknown) {
      const key = cursor++
      if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial
      return [values[key], (next: unknown) => { values[key] = typeof next === 'function' ? next(values[key]) : next }]
    },
    useRef(initial: unknown) { const key = cursor++; return values[key] ??= { current: initial } },
    useId: () => 'test-title',
    useCallback: (fn: unknown) => { const key = cursor++; return values[key] ??= fn },
    useEffect(run: () => (() => void) | undefined, deps?: unknown[]) {
      const key = effectCursor++, old = effects[key]
      if (!old || !deps || deps.some((v, i) => v !== old.deps?.[i])) pending.push(() => { old?.cleanup?.(); effects[key] = { deps, run, cleanup: run() } })
    },
  }
  function nodes(value: any): void {
    if (!value) return
    if (value.$$typeof === Symbol.for('react.portal')) { nodes(value.children); return }
    for (const item of React.Children.toArray(value)) if (isValidElement<any>(item)) {
      if (item.props.ref) item.props.ref.current = item.props.role === 'dialog' ? panel : backdrop
      nodes(item.props.children)
    }
  }
  let result: any
  const render = (props: Parameters<typeof Sheet>[0]) => {
    const previous = internals.H
    cursor = 0; effectCursor = 0; pending = []
    internals.H = hooks
    try { result = Sheet(props) } finally { internals.H = previous }
    nodes(result)
    pending.forEach(run => run())
    return result
  }
  return {
    panel, backdrop, render,
    context: () => result.children.props.value as (fn: () => unknown) => void,
    finish: () => panel.animations.at(-1)?.onfinish?.(),
    replay: () => { effects.forEach(effect => effect?.cleanup?.()); effects.forEach(effect => { effect.cleanup = effect.run() }) },
    unmount: () => { effects.forEach(effect => effect?.cleanup?.()) },
  }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
function button(close: (fn: () => unknown) => void, props: Parameters<typeof Button>[0]) {
  const previous = internals.H
  internals.H = { useContext: () => close }
  try { return Button(props) } finally { internals.H = previous }
}
const click = (element: ReturnType<typeof Button>) => element.props.onClick({ preventDefault() {} })
const text = (node: ReactNode): string => React.Children.toArray(node).map(item => isValidElement<{ children?: ReactNode }>(item) ? text(item.props.children) : String(item)).join('')

test('external open=false retains the last children and footer until the downward exit finishes', () => {
  const h = host(); let callbacks = 0
  const p = { open: true, onClose: () => callbacks++, title: 'Measure', children: 'wheel', footer: 'actions' }
  h.render(p)
  const exiting = h.render({ ...p, open: false, title: '', children: null, footer: null })
  assert.match(text(exiting.children), /Measure.*wheel.*actions/)
  assert.equal(body.style.overflow, 'hidden')
  assert.deepEqual(h.panel.animations.at(-1)!.frames.at(-1), { transform: 'translate3d(0, 400px, 0)' })
  assert.equal(callbacks, 0)
  h.finish()
  assert.equal(h.render({ ...p, open: false }), null)
  assert.equal(callbacks, 0, 'external state change does not fire onClose twice')
  assert.equal(body.style.overflow, '')
  h.unmount()
})

test('conditional parent action runs once after the animation, while normal buttons stay immediate', async () => {
  const h = host(); let actions = 0, normal = 0
  const p = { open: true, onClose() { throw Error('action owns closure') }, title: 'Week', children: 'days' }
  h.render(p)
  click(button(h.context(), { onClick: () => normal++ }))
  assert.equal(normal, 1)
  const close = button(h.context(), { closeSheet: true, onClick: () => actions++ })
  click(close); click(close)
  assert.equal(actions, 0)
  assert.equal(h.panel.animations.length, 1)
  h.finish(); await tick()
  assert.equal(actions, 1)
  h.unmount()
})

test('failed validation does not start closing or execute the action', () => {
  const h = host(); let actions = 0
  h.render({ open: true, onClose() {}, title: 'Week', children: 'days' })
  click(button(h.context(), { closeSheet: () => false, onClick: () => actions++ }))
  assert.equal(actions, 0)
  assert.equal(h.panel.animations.length, 0)
  h.unmount()
})

test('an asynchronous save refusal restores the same live sheet', async () => {
  const h = host(); let callbacks = 0, resolve!: () => void
  const p = { open: true, onClose: () => callbacks++, title: 'Import', children: 'preview' }
  h.render(p)
  click(button(h.context(), { closeSheet: true, onClick: () => new Promise<void>(done => { resolve = done }) }))
  h.finish(); await tick()
  assert.equal(h.panel.style.transform, 'translate3d(0, 400px, 0)')
  resolve(); await tick()
  assert.ok(h.render(p))
  assert.equal(h.panel.style.transform, '', 'motion cleanup restores the panel if the parent stayed open')
  assert.equal(callbacks, 0)
  h.unmount()
})

test('reopening cancels an old exit and unmount cancels deferred actions', async () => {
  const h = host(); let callbacks = 0, actions = 0
  const p = { open: true, onClose: () => callbacks++, title: 'Picker', children: 'value' }
  h.render(p)
  h.render({ ...p, open: false })
  const old = h.panel.animations.at(-1)!
  h.render(p); h.render(p)
  assert.equal(old.onfinish, null)
  assert.equal(callbacks, 0)
  click(button(h.context(), { closeSheet: true, onClick: () => actions++ }))
  h.unmount(); h.finish(); await tick()
  assert.equal(actions, 0)
})

test('a successful controlled save closes exactly once after React commits the parent state', async () => {
  const frames: (() => void)[] = []
  globalThis.requestAnimationFrame = callback => { frames.push(() => callback(0)); return frames.length }
  const flushFrames = () => frames.splice(0).forEach(frame => frame())
  const h = host()
  const p = { open: true, onClose() {}, title: 'Measure', children: 'wheel' }
  h.render(p); flushFrames()
  click(button(h.context(), { closeSheet: true, onClick: () => { p.open = false } }))
  h.finish(); await tick()
  assert.equal(h.render(p), null)
  flushFrames()
  assert.equal(h.render(p), null)
  assert.equal(h.panel.animations.length, 1, 'no restoration and second exit after a successful save')
  h.unmount()
})

test('repeated taps execute validation and its persistence only once', async () => {
  const h = host(); let saves = 0, actions = 0
  h.render({ open: true, onClose() {}, title: 'Week', children: 'days' })
  const target = button(h.context(), { closeSheet: () => { saves++; return true }, onClick: () => actions++ })
  click(target); click(target)
  assert.equal(saves, 1)
  assert.equal(actions, 0)
  h.finish(); await tick()
  assert.equal(actions, 1)
  h.unmount()
})

test('Escape and scroll lock belong to the top sheet until its exit has completed', () => {
  body.style.overflow = 'auto'
  const parent = host(), child = host()
  let parentClosed = 0, childClosed = 0
  const p = { open: true, onClose: () => parentClosed++, title: 'Parent', children: 'field' }
  const c = { open: true, onClose: () => childClosed++, title: 'Picker', children: 'wheel' }
  const escape = () => { const event = new Event('keydown', { cancelable: true }); Object.defineProperty(event, 'key', { value: 'Escape' }); document.dispatchEvent(event) }
  parent.render(p); child.render(c)
  escape()
  assert.equal(parent.panel.animations.length, 0)
  assert.equal(child.panel.animations.length, 1)
  child.finish(); child.render({ ...c, open: false })
  assert.equal(childClosed, 1)
  assert.equal(parentClosed, 0)
  assert.equal(body.style.overflow, 'hidden')
  escape()
  assert.equal(parent.panel.animations.length, 1)
  child.unmount(); parent.unmount()
  assert.equal(body.style.overflow, 'auto')
})

test('StrictMode effect replay keeps the parent close callback connected', () => {
  const h = host(); let closed = 0
  h.render({ open: true, onClose: () => closed++, title: 'Sheet', children: 'content' })
  h.replay()
  const event = new Event('keydown', { cancelable: true })
  Object.defineProperty(event, 'key', { value: 'Escape' })
  document.dispatchEvent(event)
  h.finish()
  assert.equal(closed, 1)
  h.unmount()
})
