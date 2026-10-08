import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import React, { type ReactElement, type RefObject } from 'react'
import { Segmented } from '../src/components/ui'

const options = [
  { value: 'strength', label: 'Strength', left: 0, width: 80 },
  { value: 'body', label: 'Body', left: 84, width: 100 },
  { value: 'volume', label: 'Volume', left: 188, width: 100 },
  { value: 'workouts', label: 'Workouts', left: 292, width: 110 },
]

// Run the real layout effects after attaching both refs. Geometry changes with
// scrollLeft and viewport width, as it does for a native overflow container.
function mount(t: TestContext, initialScrollLeft = 0) {
  const observers: { observed: Set<unknown>; resize: () => void }[] = []
  const previousObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver')
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: t.mock.fn(function (callback: () => void) {
    const observed = new Set<unknown>()
    const observer = { observed, resize: callback, observe: t.mock.fn((node: unknown) => observed.add(node)), disconnect: t.mock.fn(() => observed.clear()) }
    observers.push(observer)
    return observer
  }) })
  const group = Object.assign(new EventTarget(), {
    scrollLeft: initialScrollLeft,
    clientWidth: 288,
    scrollWidth: 402,
    dataset: {} as Record<string, string>,
    children: [] as unknown[],
    getBoundingClientRect: () => ({ left: 16, right: 16 + group.clientWidth }),
  })
  const buttons = options.map(option => ({
    parentElement: group,
    previousElementSibling: null as unknown,
    nextElementSibling: null as unknown,
    getBoundingClientRect: () => ({
      left: group.getBoundingClientRect().left + option.left - group.scrollLeft,
      right: group.getBoundingClientRect().left + option.left + option.width - group.scrollLeft,
    }),
  }))
  buttons.forEach((button, index) => {
    button.previousElementSibling = buttons[index - 1] ?? null
    button.nextElementSibling = buttons[index + 1] ?? null
  })
  group.children = buttons
  const slots: any[] = []
  const cleanups = new Map<number, () => void>()
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  let selected: typeof buttons[number] | undefined
  t.after(() => {
    cleanups.forEach(cleanup => cleanup())
    if (previousObserver) Object.defineProperty(globalThis, 'ResizeObserver', previousObserver)
    else Reflect.deleteProperty(globalThis, 'ResizeObserver')
  })

  function render(value: string) {
    let cursor = 0
    const effects: (() => void)[] = []
    const previous = internals.H
    internals.H = {
      useRef(initial: unknown) { return slots[cursor++] ??= { current: initial } },
      useLayoutEffect(effect: () => void | (() => void), dependencies: unknown[]) {
        const index = cursor++, previous = slots[index]
        if (!previous || dependencies.some((dependency, i) => !Object.is(dependency, previous[i]))) effects.push(() => {
          cleanups.get(index)?.()
          const cleanup = effect()
          if (cleanup) cleanups.set(index, cleanup)
          else cleanups.delete(index)
        })
        slots[index] = dependencies
      },
    }
    let tree: ReactElement
    try { tree = Segmented({ value, options, onChange() {}, label: 'Progress views' }) }
    finally { internals.H = previous }

    const props = tree.props as { ref: RefObject<unknown>; children: ReactElement<{ ref?: RefObject<unknown> }>[] }
    props.ref.current = group
    for (const button of props.children) {
      if (!button.props.ref) continue
      selected = buttons[options.findIndex(option => option.value === button.key)]
      button.props.ref.current = selected
    }
    effects.forEach(effect => effect())
  }

  function assertVisible(fadeInset = 0) {
    assert.ok(selected)
    const item = selected.getBoundingClientRect(), bounds = group.getBoundingClientRect()
    assert.ok(item.left >= bounds.left + fadeInset, 'selected tab must not be hidden on the left')
    assert.ok(item.right <= bounds.right - fadeInset, 'selected tab must not be hidden on the right')
  }
  function scrollTo(left: number) {
    group.scrollLeft = left
    group.dispatchEvent(new Event('scroll'))
  }
  function resize() {
    assert.equal(observers.length, 1)
    assert.ok(observers[0].observed.has(group), 'observe the scroll viewport')
    assert.ok(buttons.every(button => observers[0].observed.has(button)), 'observe tab-width changes too')
    observers[0].resize()
  }
  const fades = () => ({ left: group.dataset.scrollStart, right: group.dataset.scrollEnd })
  return { group, render, assertVisible, scrollTo, resize, fades }
}

test('selecting a tab hidden on the right scrolls only enough to reveal it', t => {
  const view = mount(t)
  view.render('workouts')
  assert.equal(view.group.scrollLeft, 114)
  view.assertVisible()
})

test('changing selection back to a left-hidden tab restores its visibility', t => {
  const view = mount(t)
  view.render('workouts')
  assert.equal(view.group.scrollLeft, 114)
  view.render('strength')
  assert.equal(view.group.scrollLeft, 0)
  view.assertVisible()
})

test('selecting an already-visible tab preserves the current horizontal position', t => {
  const view = mount(t, 50)
  view.render('body')
  assert.equal(view.group.scrollLeft, 50)
  view.assertVisible()
})

test('an intermediate selected tab stays clear of the fade hiding the next tab', t => {
  const view = mount(t)
  view.render('volume')
  assert.equal(view.group.scrollLeft, 24)
  view.assertVisible(24)
})

test('the beginning indicates hidden content on the right only', t => {
  const view = mount(t)
  view.render('strength')
  assert.deepEqual(view.fades(), { left: 'false', right: 'true' })
})

test('scrolling into the middle indicates hidden content on both sides', t => {
  const view = mount(t)
  view.render('strength')
  view.scrollTo(50)
  assert.deepEqual(view.fades(), { left: 'true', right: 'true' })
})

test('reaching the end indicates hidden content on the left only', t => {
  const view = mount(t)
  view.render('strength')
  view.scrollTo(114)
  assert.deepEqual(view.fades(), { left: 'true', right: 'false' })
})

test('a group without overflow has no hidden-content indicators', t => {
  const view = mount(t)
  view.group.clientWidth = 450
  view.render('strength')
  assert.deepEqual(view.fades(), { left: 'false', right: 'false' })
})

test('resize observations refresh indicators when viewport or tab widths change', t => {
  const view = mount(t)
  view.render('strength')
  assert.deepEqual(view.fades(), { left: 'false', right: 'true' })
  view.group.clientWidth = 450
  view.resize()
  assert.deepEqual(view.fades(), { left: 'false', right: 'false' })
  view.group.scrollWidth = 600
  view.resize()
  assert.deepEqual(view.fades(), { left: 'false', right: 'true' })
})
