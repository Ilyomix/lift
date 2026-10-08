import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { Segmented, Toggle } from '../src/components/ui'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { SettingsScreen } from '../src/screens/Settings'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()
const state = () => useStore.getState().state

// Exercise private settings components through their public route, without
// exporting production internals or depending on browser-only sheet portals.
function mount(render: () => Element) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useEffect() {},
      useId: () => "target-form-test",
      useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value } },
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
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
const text = (node: ReactNode): string => React.Children.toArray(node).map(item => isValidElement<{ children?: ReactNode }>(item) ? text(item.props.children) : String(item)).join('')
const mode = (node: ReactNode) => find(node, e => e.type === Segmented && e.props.label === 'Cible de poids')!
const waist = (node: ReactNode) => find(node, e => e.type === Toggle && e.props.label === 'Cible de tour de taille')!
const field = (node: ReactNode, label: string) => find(node, e => e.type === MeasurementPicker && e.props.label === label)!
const save = (node: ReactNode) => find(node, e => e.props.type === 'submit')!
const submit = (node: ReactNode) => find(node, e => e.type === 'form')!.props.onSubmit({ preventDefault() {} })

function mountTargets() {
  const route = SettingsScreen({ section: 'objectifs' })
  const goal = mount(() => (route.type as (props: unknown) => Element)(route.props))()
  const target = find(goal, e => typeof e.type === 'function' && e.type.name === 'TargetMeasurements')!
  assert.ok(target, 'goal settings route exposes target measurements')
  return mount(() => (target.type as (props: unknown) => Element)(target.props))
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  const base = defaultState()
  useStore.setState({ state: {
    ...base,
    settings: { ...base.settings, maintenance: true },
    goals: { ...base.goals, targetWeightMin: 64, targetWeightMax: 66, targetWaist: 74 },
    bodyEntries: [{ id: 'weight', date: '2026-10-08', weight: 79, waist: 88, arm: null, chest: null, shoulders: null }],
  }, ready: true, hasData: false, storage: 'memory' })
  configurePlan(DEFAULT_GOAL, null, null, null, { maintenance: true, today: '2026-10-08' })
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('program estimate ignores the saved custom range, stays draft until saved and persists automatic targets', () => {
  const render = mountTargets(), before = state()
  assert.equal(mode(render()).props.value, 'custom')
  mode(render()).props.onChange('program')
  waist(render()).props.onChange(false)
  assert.equal(state(), before, 'switching controls is not a save')
  assert.match(text(render()), /78–80 kg/, 'preview is based on 79 kg, not the old 64–66 kg target')
  assert.equal(field(render(), 'Poids minimum'), undefined)
  const cancelled = mountTargets()()
  assert.equal(mode(cancelled).props.value, 'custom')
  assert.equal(field(cancelled, 'Poids minimum').props.value, '64')
  assert.equal(waist(cancelled).props.checked, true)

  assert.equal(save(render()).props.disabled, false)
  submit(render())
  assert.deepEqual(state().goals, { ...before.goals, targetWeightMin: 0, targetWeightMax: 0, targetWaist: null })
  assert.equal(state().bodyEntries, before.bodyEntries)
  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  useStore.setState({ state: restored })
  const reopened = mountTargets()()
  assert.equal(mode(reopened).props.value, 'program')
  assert.equal(waist(reopened).props.checked, false)
  assert.equal(field(reopened, 'Tour de taille'), undefined)
  assert.equal(save(reopened).props.disabled, true)
})

test('custom target requires both valid weights in order and optional waist is persisted only when enabled', () => {
  useStore.setState({ state: { ...state(), bodyEntries: [], goals: { ...state().goals, targetWeightMin: 0, targetWeightMax: 0, targetWaist: null } } })
  const render = mountTargets(), before = state()
  mode(render()).props.onChange('custom')
  assert.equal(save(render()).props.disabled, true, 'no measurements means no implicit custom numbers')
  field(render(), 'Poids minimum').props.onChange('76,5')
  assert.equal(save(render()).props.disabled, true, 'maximum is required too')
  field(render(), 'Poids maximum').props.onChange('78')
  assert.equal(save(render()).props.disabled, false)
  field(render(), 'Poids minimum').props.onChange('90')
  assert.equal(save(render()).props.disabled, true)
  submit(render())
  assert.equal(state(), before, 'invalid submit cannot overwrite targets')
  field(render(), 'Poids minimum').props.onChange('bad')
  assert.equal(save(render()).props.disabled, true)
  field(render(), 'Poids minimum').props.onChange('76,5')
  waist(render()).props.onChange(true)
  assert.equal(save(render()).props.disabled, true, 'enabled waist target needs a value')
  field(render(), 'Tour de taille').props.onChange('83,5')
  assert.equal(save(render()).props.disabled, false)
  waist(render()).props.onChange(false)
  submit(render())
  assert.deepEqual(state().goals, { ...before.goals, targetWeightMin: 76.5, targetWeightMax: 78, targetWaist: null })
  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.deepEqual(restored.goals, state().goals)
})

test('manual target values outside the displayed ranges stay invalid and never clamp or save', () => {
  const render = mountTargets(), before = state()
  for (const [label, invalid, valid] of [
    ['Poids minimum', '34.9', '35'],
    ['Poids maximum', '250.1', '250'],
    ['Tour de taille', '49.9', '50'],
    ['Tour de taille', '200.1', '200'],
  ]) {
    field(render(), label).props.onChange(invalid)
    assert.equal(field(render(), label).props.value, invalid)
    assert.equal(save(render()).props.disabled, true)
    submit(render())
    assert.equal(state(), before)
    field(render(), label).props.onChange(valid)
  }
  assert.equal(save(render()).props.disabled, false)
  submit(render())
  assert.deepEqual(state().goals, { ...before.goals, targetWeightMin: 35, targetWeightMax: 250, targetWaist: 200 })
})

test('target weight wheels follow the other draft bound without hiding or saving invalid manual values', () => {
  const render = mountTargets(), before = state()
  const minimum = () => field(render(), 'Poids minimum').props
  const maximum = () => field(render(), 'Poids maximum').props
  assert.deepEqual([minimum().min, minimum().max, maximum().min, maximum().max], [35, 66, 64, 250])
  assert.equal(minimum().strictBounds, true)
  assert.equal(maximum().strictBounds, true)

  minimum().onChange('96')
  maximum().onChange('93')
  assert.deepEqual([minimum().max, maximum().min], [93, 96], 'each wheel offers a way to restore the order')
  assert.equal(maximum().value, '93', 'the existing invalid value stays visible for correction')
  assert.equal(maximum().invalid, true)
  assert.equal(save(render()).props.disabled, true)
  submit(render())
  assert.equal(state(), before)

  minimum().onChange('bad')
  assert.equal(maximum().min, 35, 'an invalid companion cannot make the other wheel invalid')
  minimum().onChange('96,25')
  maximum().onChange('250.1')
  assert.equal(minimum().max, 250, 'an out-of-range companion does not widen the valid range')
  maximum().onChange('96,25')
  assert.deepEqual([minimum().max, maximum().min], [96.25, 96.25])
  assert.equal(maximum().value, '96,25', 'exact manual precision is retained')
  assert.equal(save(render()).props.disabled, false)
  submit(render())
  assert.deepEqual([state().goals.targetWeightMin, state().goals.targetWeightMax], [96.25, 96.25])
})
