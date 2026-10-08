import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { defaultState } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { NutritionScreen, NutritionTargetsScreen } from '../src/screens/More'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()

function mount<P>(component: (props: P) => ReactNode, props: () => P) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const effects: (() => void)[] = [], previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useMemo: (callback: () => unknown) => callback(),
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
      useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value } },
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
      useEffect(effect: () => void, deps: unknown[]) {
        const i = cursor++, before = slots[i] as unknown[] | undefined
        if (!before || deps.some((dep, index) => !Object.is(dep, before[index]))) effects.push(effect)
        slots[i] = deps
      },
    }
    let result: ReactNode
    try { result = component(props()) } finally { internals.H = previous }
    effects.forEach(effect => effect())
    return result
  }
}

function find(node: ReactNode, predicate: (element: Element) => boolean): Element | undefined {
  for (const element of React.Children.toArray(node)) {
    if (!isValidElement<Record<string, any>>(element)) continue
    if (predicate(element)) return element
    const child = find(element.props.children, predicate)
    if (child) return child
  }
}
const picker = (tree: ReactNode, label: string) => find(tree, element => element.type === MeasurementPicker && element.props.label === label)!

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  configurePlan(DEFAULT_GOAL)
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' })
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('nutrition quantities retain decimal drafts, reject invalid writes and follow shortcut adjustments', () => {
  const screen = mount(NutritionScreen, () => ({}))
  const counter = () => find(screen(), element => element.props.label === 'Protéines' && typeof element.props.onSet === 'function')!
  const render = mount(counter().type as (props: any) => ReactNode, () => counter().props)
  const control = () => picker(render(), 'Protéines')
  assert.equal(control().props.unit, 'g')
  control().props.onChange('180,5')
  assert.equal(useStore.getState().state.nutritionEntries['2026-10-08'].protein, 180.5)
  assert.equal(control().props.value, '180,5', 'a valid decimal draft is not rewritten by its own store update')
  control().props.onChange('-2')
  assert.equal(control().props.invalid, true)
  assert.equal(useStore.getState().state.nutritionEntries['2026-10-08'].protein, 180.5)
  control().props.onChange('')
  assert.equal(useStore.getState().state.nutritionEntries['2026-10-08'].protein, 0)
  assert.equal(control().props.value, '')
  find(render(), element => element.props['aria-label'] === 'Ajouter 25 g')!.props.onClick()
  render()
  assert.equal(control().props.value, '25', 'a shortcut adjustment replaces the previous local draft')
})

test('nutrition target wheels keep explicit units and save exact manual amounts only after a valid form submission', () => {
  const screen = mount(NutritionTargetsScreen, () => ({}))
  const element = find(screen(), item => typeof item.type === 'function' && item.type.name === 'NutritionTargetForm')!
  const render = mount(element.type as (props: any) => ReactNode, () => element.props)
  const submit = () => find(render(), item => item.type === 'form')!.props.onSubmit({ preventDefault() {} })
  const before = useStore.getState().state.nutritionTargets
  for (const [label, unit] of [['Calories', 'kcal'], ['Créatine', 'g'], ['Protéines min.', 'g'], ['Protéines max.', 'g']]) {
    assert.equal(picker(render(), label).props.unit, unit)
  }
  picker(render(), 'Calories').props.onChange('2345')
  picker(render(), 'Créatine').props.onChange('3,5')
  picker(render(), 'Protéines min.').props.onChange('190')
  picker(render(), 'Protéines max.').props.onChange('180')
  assert.equal(useStore.getState().state.nutritionTargets, before, 'editing remains a draft')
  submit()
  assert.equal(useStore.getState().state.nutritionTargets, before)
  assert.equal(picker(render(), 'Protéines max.').props.invalid, true)
  picker(render(), 'Protéines max.').props.onChange('195,5')
  submit()
  const saved = useStore.getState().state.nutritionTargets
  assert.deepEqual([saved.calories, saved.creatine, saved.proteinMin, saved.proteinMax], [2345, 3.5, 190, 195.5])
})
