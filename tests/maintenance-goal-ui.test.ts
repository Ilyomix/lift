import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { ZonePicker } from '../src/components/ZonePicker'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { GOAL_PHOTO_ID, useStore } from '../src/lib/store'
import { tagPriorities } from '../src/lib/visual'
import { VisualGoalScreen } from '../src/screens/Goal'

const originalStore = useStore.getState(), originalLanguage = lang()
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalHashEvent = Object.getOwnPropertyDescriptor(globalThis, 'HashChangeEvent')
const location = { hash: '#/objectif' }
const history = {
  state: {} as unknown,
  replaceState(value: unknown, _unused: string, hash?: string) { this.state = value; if (hash) location.hash = hash },
  pushState(value: unknown, _unused: string, hash: string) { this.state = value; location.hash = hash },
}
const host = Object.assign(new EventTarget(), { location, history, scrollTo() {} })
type Element = ReactElement<Record<string, any>>

// As in week-schedule-ui, exercise the actual hooks/actions without a DOM renderer.
function mount() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useMemo: (callback: () => unknown) => callback(),
      useRef: (current: unknown) => ({ current }),
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
    }
    try { return VisualGoalScreen() } finally { internals.H = previous }
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
const action = (tree: ReactNode, label: string) => find(tree, e => e.props.onClick && e.props.children === label)!
const field = (tree: ReactNode, label: string) => find(find(tree, e => e.props.label === label)?.props.children, e => typeof e.props.onChange === 'function')!

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  const base = defaultState()
  useStore.setState({ state: { ...base, settings: { ...base.settings, maintenance: true }, bodyEntries: [], visualGoal: null }, hasData: false, storage: 'memory', ready: true, photos: [] })
  configurePlan(DEFAULT_GOAL, null, null, null, { maintenance: true, today: '2026-10-08' })
  location.hash = '#/objectif'
  Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
  Object.defineProperty(globalThis, 'HashChangeEvent', { configurable: true, value: Event })
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
  if (originalHashEvent) Object.defineProperty(globalThis, 'HashChangeEvent', originalHashEvent)
  else Reflect.deleteProperty(globalThis, 'HashChangeEvent')
})

test('maintenance screen saves priorities without weight, height or a dated plan and restores them on reopening', () => {
  const render = mount(), before = useStore.getState().state
  find(render(), element => element.type === ZonePicker)!.props.onChange(['bras', 'jambes'])
  const save = action(render(), 'Enregistrer les préférences')
  assert.ok(save)
  assert.equal(save.props.disabled, false, 'missing measurements must not block visual preferences')
  assert.equal(action(render(), 'Appliquer ce plan'), undefined)
  assert.equal(useStore.getState().state, before, 'editing a draft alone does not persist anything')
  save.props.onClick()
  const saved = useStore.getState().state
  assert.equal(saved.settings.maintenance, true)
  assert.equal(saved.settings, before.settings)
  assert.equal(saved.goals, before.goals)
  assert.equal(saved.nutritionTargets, before.nutritionTargets)
  assert.deepEqual(saved.bodyEntries, [])
  assert.deepEqual(saved.visualGoal?.zones, ['bras', 'jambes'])
  assert.equal(saved.visualGoal?.cutWeeks, undefined)
  assert.deepEqual(saved.templates, tagPriorities(before.templates, ['bras', 'jambes']))
  assert.equal(location.hash, '#/plus/reglages/objectifs')
  useStore.setState({ state: parseBackup(JSON.stringify(makeBackup(saved, []))).state })
  const reopened = mount()()
  assert.deepEqual(find(reopened, element => element.type === ZonePicker)!.props.value, ['bras', 'jambes'])
  assert.equal(action(reopened, 'Enregistrer les préférences').props.disabled, false)
})

test('cancelling or rejecting a maintenance draft leaves saved criteria and the reference photo untouched', () => {
  const before = { ...useStore.getState().state,
    profile: { heightCm: 178, age: 32, sex: 'm' as const },
    visualGoal: { look: 'sec' as const, zones: ['dos'] as ['dos'], bodyFat: 18, photoId: GOAL_PHOTO_ID },
  }
  useStore.setState({ state: before, photos: [{ id: GOAL_PHOTO_ID, date: '2026-10-08', name: 'reference', dataUrl: 'data:image/png;base64,test' }] })
  const render = mount()
  field(render(), 'Taille (cm)').props.onChange('231')
  const save = action(render(), 'Enregistrer les préférences')
  assert.equal(save.props.disabled, true)
  save.props.onClick()
  assert.equal(useStore.getState().state, before)
  const reopened = mount()()
  assert.equal(field(reopened, 'Taille (cm)').props.value, '178', 'discarding the old component abandons its draft')
  assert.deepEqual(find(reopened, element => element.type === ZonePicker)!.props.value, ['dos'])
  assert.equal(find(reopened, e => e.type === 'img')!.props.src, 'data:image/png;base64,test')
})

test('resetting preferences leaves the old draft screen before reopening with cleared priorities', () => {
  const base = useStore.getState().state
  const before = { ...base,
    goals: { ...base.goals, targetWeightMin: 70, targetWeightMax: 72 },
    visualGoal: { look: 'sec' as const, zones: ['dos'] as ['dos'], bodyFat: 18, photoId: GOAL_PHOTO_ID },
  }
  useStore.setState({ state: before })
  const reset = action(mount()(), 'Réinitialiser les préférences')
  assert.ok(reset)
  reset.props.onClick()
  assert.equal(location.hash, '#/plus/reglages/objectifs', 'reset leaves the component holding the old unsaved selections')
  assert.equal(useStore.getState().state.goals, before.goals)
  assert.equal(useStore.getState().state.visualGoal?.photoId, GOAL_PHOTO_ID)
  assert.equal(useStore.getState().state.visualGoal?.look, 'taille')
  const reopened = mount()()
  assert.deepEqual(find(reopened, element => element.type === ZonePicker)!.props.value, [])
  assert.equal(field(reopened, 'Taux de gras mesuré (%), facultatif').props.value, '')
  action(reopened, 'Enregistrer les préférences').props.onClick()
  assert.deepEqual(useStore.getState().state.visualGoal?.zones, [], 'a subsequent save does not resurrect the cleared criteria')
  assert.equal(useStore.getState().state.visualGoal?.bodyFat, null)
  assert.equal(useStore.getState().state.visualGoal?.look, 'taille', 'saving the reopened screen keeps the default physique, not the removed one')
})
