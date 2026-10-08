import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { defaultState } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, takesLest } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { SessionScreen } from '../src/screens/Session'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()
const active = () => useStore.getState().state.activeWorkout!
function mount(render: () => Element) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {}, useEffect() {}, useMemo: (factory: () => unknown) => factory(),
      useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value } },
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
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
const named = (element: Element, name: string) => typeof element.type === 'function' && element.type.name === name
const renderElement = (element: Element) => (element.type as (props: unknown) => Element)(element.props)

// Walk the actual route and selected logger; private components remain private.
function mountLoad(index: number) {
  const route = mount(SessionScreen)
  const session = mount(() => renderElement(route()))
  const logger = mount(() => renderElement(find(session(), e => named(e, 'ExerciseLogger') && e.props.index === index)!))
  const row = mount(() => renderElement(find(logger(), e => named(e, 'SetRow') && e.props.setIndex === 0)!))
  const load = mount(() => renderElement(find(row(), e => named(e, 'NumField') && e.props.unit === 'kg')!))
  return {
    row,
    picker: () => {
      const picker = load()
      assert.equal(picker.type, MeasurementPicker)
      return picker
    },
    log: () => find(row(), e => e.type === 'button' && e.props['aria-label'] === 'Valider la série 1')!,
  }
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  const state = defaultState()
  useStore.setState({ state: { ...state, prefs: { ...state.prefs, autoLoad: false } }, ready: true, hasData: false, storage: 'memory' })
  configurePlan(DEFAULT_GOAL)
  useStore.getState().startSession('UPPER')
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('invalid load drafts cannot log the saved old load; valid decimal and zero bodyweight load remain usable', () => {
  const index = active().exercises.findIndex(ex => ex.unit !== 'PDC')
  assert.ok(index >= 0)
  useStore.getState().updateSet(index, 0, { weight: 20, reps: 10 })
  const form = mountLoad(index)
  for (const invalid of ['-5', 'abc', '1000']) {
    form.picker().props.onChange(invalid)
    assert.equal(form.picker().props.value, invalid)
    assert.equal(form.picker().props.invalid, true)
    assert.equal(active().exercises[index].sets[0].weight, 20)
    assert.equal(form.log().props.disabled, true)
    assert.ok(find(form.row(), e => e.props.role === 'alert'))
    form.log().props.onClick()
    assert.equal(active().exercises[index].sets[0].completed, false, 'forced handler cannot log a hidden previous load')
  }
  form.picker().props.onBlur()
  assert.equal(form.picker().props.value, '20', 'desktop blur restores the persisted load')
  assert.equal(form.picker().props.invalid, false)
  assert.equal(form.log().props.disabled, false)
  form.picker().props.onChange('22,5')
  assert.equal(form.picker().props.value, '22,5')
  assert.equal(form.picker().props.invalid, false)
  assert.equal(active().exercises[index].sets[0].weight, 22.5)
  form.log().props.onClick()
  assert.equal(active().exercises[index].sets[0].completed, true)
  assert.equal(active().exercises[index].sets[0].weight, 22.5)

  const bodyweightIndex = active().exercises.findIndex(takesLest)
  assert.ok(bodyweightIndex >= 0)
  useStore.getState().updateSet(bodyweightIndex, 0, { weight: 5, reps: 8 })
  const bodyweight = mountLoad(bodyweightIndex)
  bodyweight.picker().props.onChange('-1')
  assert.equal(bodyweight.log().props.disabled, true)
  bodyweight.picker().props.onChange('0')
  assert.equal(bodyweight.picker().props.invalid, false)
  assert.equal(bodyweight.picker().props.value, '0')
  assert.equal(bodyweight.log().props.disabled, false)
  bodyweight.log().props.onClick()
  assert.equal(active().exercises[bodyweightIndex].unit, 'PDC')
  assert.equal(active().exercises[bodyweightIndex].sets[0].weight, 0)
  assert.equal(active().exercises[bodyweightIndex].sets[0].completed, true)
})
