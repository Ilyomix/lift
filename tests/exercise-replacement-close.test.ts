import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { ExerciseAlternatives } from '../src/components/ExerciseAlternatives'
import { ExerciseSheet } from '../src/components/ExerciseSheet'
import { Button } from '../src/components/ui'
import { SessionScreen } from '../src/screens/Session'
import { defaultState } from '../src/lib/backup'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'

type Element = ReactElement<Record<string, any>>
const original = useStore.getState()
const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
function mount(render: () => ReactNode) {
  const slots: any[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useSyncExternalStore: (_: unknown, get: () => unknown) => get(),
      useDebugValue() {}, useEffect() {},
      useId: () => 'alternatives',
      useMemo: (fn: () => unknown) => fn(),
      useCallback: (fn: unknown) => fn,
      useRef(value: unknown) { return slots[cursor++] ??= { current: value } },
      useState(value: unknown) {
        const index = cursor++
        if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
        return [slots[index], (next: unknown) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
      },
    }
    try { return render() } finally { internals.H = previous }
  }
}
function find(node: ReactNode, predicate: (element: Element) => boolean): Element | undefined {
  for (const item of React.Children.toArray(node)) {
    if (!isValidElement<Record<string, any>>(item)) continue
    if (predicate(item)) return item
    const found = find(item.props.children, predicate)
    if (found) return found
  }
}
afterEach(async () => { await useStore.getState().flush(); useStore.setState(original, true); configurePlan(DEFAULT_GOAL) })

test('a planned replacement mutates only after the old keyed exercise sheet exits and still closes it', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  configurePlan(DEFAULT_GOAL)
  useStore.setState({ state: { ...defaultState(), bodyEntries: [], nextWorkoutType: 'UPPER' }, storage: 'memory', ready: true, hasData: false })
  const route = mount(SessionScreen)() as Element
  const preview = mount(() => (route.type as (props: unknown) => ReactNode)(route.props))
  const list = find(preview(), element => element.type === 'ol')!
  find(list, element => element.type === 'button')!.props.onClick()
  const originalSheet = find(preview(), element => element.type === ExerciseSheet)!
  assert.ok(originalSheet)
  let allow = false, pendingAction: (() => unknown) | undefined, closing: Promise<void> | undefined
  let phase = 'idle'
  const render = mount(() => ExerciseAlternatives({
    exerciseId: originalSheet.props.exerciseId, replacement: originalSheet.props.replacement,
    onReplaced: originalSheet.props.onClose, beforeReplace: async () => allow,
  }))
  const choice = find(render(), element => element.type === Button && !!element.props.closeSheet && !element.props.disabled)!
  const before = useStore.getState().state
  const mutations: string[] = [], changedKeys: (string | null | undefined)[] = []
  const stop = useStore.subscribe((next, previous) => {
    if (next.state !== previous.state) {
      mutations.push(phase)
      changedKeys.push(find(preview(), element => element.type === ExerciseSheet)?.key)
    }
  })
  const previous = internals.H
  internals.H = { useContext: () => (action: () => unknown, validate?: () => boolean | Promise<boolean>) => {
    phase = 'validation'
    closing = Promise.resolve(validate?.() ?? true).then(valid => { if (valid) { phase = 'exiting'; pendingAction = action } })
  } }
  let button: ReturnType<typeof Button>
  try { button = Button(choice.props) } finally { internals.H = previous }
  try {
    button.props.onClick({ preventDefault() {} }); await closing
    assert.equal(useStore.getState().state, before, 'refusing discard never replaces the exercise')
    assert.equal(pendingAction, undefined)
    allow = true
    button.props.onClick({ preventDefault() {} }); await closing
    assert.equal(useStore.getState().state, before, 'validation and the exit must not change the keyed parent')
    assert.equal(find(preview(), element => element.type === ExerciseSheet)?.key, originalSheet.key)
    assert.ok(pendingAction)
    phase = 'exit-completed'; pendingAction!()
    assert.deepEqual(mutations, ['exit-completed'])
    assert.notEqual(changedKeys[0], originalSheet.key, 'the real SessionPreview key changes on replacement')
    assert.equal(find(preview(), element => element.type === ExerciseSheet), undefined, 'onReplaced still closes the parent after its key changes')
    assert.equal(useStore.getState().state.workouts, before.workouts)
  } finally { stop() }
})
