import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { PageActions, Segmented, Toggle } from '../src/components/ui'
import { ZonePicker } from '../src/components/ZonePicker'
import { defaultState } from '../src/lib/backup'
import { setLang, lang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { navigate } from '../src/lib/router'
import { useStore } from '../src/lib/store'
import { confirmUnsavedChanges, useDiscardConfirmation } from '../src/lib/unsavedChanges'
import { VisualGoalScreen } from '../src/screens/Goal'
import { NutritionTargetsScreen, NutritionScreen, MoreScreen } from '../src/screens/More'
import { PauseScreen, RemindersScreen } from '../src/screens/Calendar'
import { SettingsScreen } from '../src/screens/Settings'
import { MeasureSheet } from '../src/screens/Progress'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()
const originals = new Map(['window', 'HashChangeEvent'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const cleanups: (() => void)[] = []
let prompts = 0
const location = { hash: '#/' }
const history = {
  state: null as unknown,
  replaceState(state: unknown, _title: string, hash?: string) { this.state = state; if (hash) location.hash = hash },
  pushState(state: unknown, _title: string, hash: string) { this.state = state; location.hash = hash },
}
const host = Object.assign(new EventTarget(), { location, history, scrollTo() {}, confirm() { throw new Error('Page drafts must use the Lift dialog') } })
function dialogState() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previous = internals.H
  internals.H = { useSyncExternalStore: (_: unknown, get: () => unknown) => get() }
  try { return useDiscardConfirmation() } finally { internals.H = previous }
}
async function resolveAction<T>(pending: T | Promise<T>, expectPrompt = false, accept = false) {
  const dialog = dialogState()
  assert.equal(dialog.open, expectPrompt)
  if (dialog.open) { prompts++; dialog.resolve(accept) }
  return await pending
}
const confirm = (expectPrompt = false, accept = false) => resolveAction(confirmUnsavedChanges(), expectPrompt, accept)

function mount(render: () => ReactNode) {
  const slots: any[] = []
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  return () => {
    let cursor = 0
    const effects: (() => void)[] = [], previous = internals.H
    internals.H = {
      useCallback: (value: unknown) => value,
      useMemo: (compute: () => unknown) => compute(),
      useId: () => 'draft-form',
      useRef(value: unknown) { return slots[cursor++] ??= { current: value } },
      useSyncExternalStore: (_: unknown, get: () => unknown) => get(),
      useDebugValue() {},
      useState(value: unknown) {
        const index = cursor++
        if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value
        return [slots[index], (next: unknown) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
      },
      useEffect(effect: () => void | (() => void), deps: unknown[]) {
        const index = cursor++, previous = slots[index]
        if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) effects.push(() => {
          const cleanup = effect(); if (cleanup) cleanups.push(cleanup)
        })
        slots[index] = deps
      },
    }
    let tree: ReactNode
    try { tree = render() } finally { internals.H = previous }
    effects.forEach(effect => effect())
    return tree
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
const child = (tree: ReactNode, name: string) => find(tree, element => typeof element.type === 'function' && element.type.name === name)!
const click = (tree: ReactNode, label: string) => find(tree, element => !!element.props.onClick && element.props.children === label)!
const picker = (tree: ReactNode, label: string) => find(tree, element => element.type === MeasurementPicker && element.props.label === label)!
const actions = (tree: ReactNode) => find(tree, element => element.type === PageActions)!
const submit = (tree: ReactNode) => find(tree, element => element.type === 'form')!.props.onSubmit({ preventDefault() {} })
beforeEach(async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
  Object.defineProperty(globalThis, 'HashChangeEvent', { configurable: true, value: Event })
  await navigate(''); prompts = 0
  setLang('fr'); configurePlan(DEFAULT_GOAL)
  useStore.setState({ state: { ...defaultState(), bodyEntries: [], visualGoal: null }, ready: true, storage: 'memory', hasData: false, photos: [] })
})
afterEach(async () => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  await useStore.getState().flush(); useStore.setState(originalStore, true)
  setLang(originalLanguage); configurePlan(DEFAULT_GOAL)
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

test('physique draft stays local through measurements; its dirty action can save without enough data for a plan', async () => {
  const render = mount(VisualGoalScreen)
  assert.equal(actions(render()).props.visible, false)
  find(render(), element => element.type === ZonePicker)!.props.onChange(['bras'])
  assert.equal(actions(render()).props.visible, true)
  assert.equal(await confirm(true), false)
  click(render(), 'Compléter mes mesures').props.onClick()
  assert.equal(find(render(), element => element.type === MeasureSheet)!.props.open, true)
  find(render(), element => element.type === MeasureSheet)!.props.onClose()
  assert.deepEqual(find(render(), element => element.type === ZonePicker)!.props.value, ['bras'])
  assert.equal(useStore.getState().state.visualGoal, null)
  const before = useStore.getState().state
  await click(render(), 'Enregistrer les préférences').props.onClick()
  assert.deepEqual(useStore.getState().state.visualGoal?.zones, ['bras'])
  assert.equal(useStore.getState().state.goals, before.goals)
  assert.equal(useStore.getState().state.settings, before.settings)
  assert.equal(await confirm(), true, 'successful save acknowledges the page before its navigation')
  assert.equal(prompts, 1)
})

test('nutrition save uses its portal form, keeps invalid drafts guarded, and rearms after another edit', async () => {
  const page = mount(NutritionTargetsScreen), form = child(page(), 'NutritionTargetForm')
  const render = mount(() => (form.type as (props: any) => ReactNode)(form.props))
  assert.equal(actions(render()).props.visible, false)
  picker(render(), 'Calories').props.onChange('-1')
  assert.equal(actions(render()).props.visible, true)
  const submitButton = find(render(), element => element.props.type === 'submit')!
  assert.equal(submitButton.props.form, find(render(), element => element.type === 'form')!.props.id)
  submit(render())
  assert.equal(await confirm(true), false, 'invalid Save must not acknowledge the draft')
  picker(render(), 'Calories').props.onChange('2345')
  submit(render()); render()
  assert.equal(useStore.getState().state.nutritionTargets.calories, 2345)
  assert.equal(actions(render()).props.visible, false)
  assert.equal(await confirm(), true)
  picker(render(), 'Calories').props.onChange('2450'); render()
  assert.equal(await confirm(true), false, 'a fresh draft after Save must prompt again')
})

test('target modes retain draft state while missing measurements open locally, including invalid targets', async () => {
  const route = SettingsScreen({ section: 'objectifs' })
  const page = mount(() => (route.type as (props: any) => ReactNode)(route.props))
  const form = child(page(), 'TargetMeasurements')
  const render = mount(() => (form.type as (props: any) => ReactNode)(form.props))
  assert.equal(actions(render()).props.visible, false)
  click(render(), 'Compléter mes mesures').props.onClick()
  assert.equal(find(render(), element => element.type === MeasureSheet)!.props.open, true)
  find(render(), element => element.type === MeasureSheet)!.props.onClose()
  find(render(), element => element.type === Segmented)!.props.onChange('custom')
  picker(render(), 'Poids minimum').props.onChange('96')
  picker(render(), 'Poids maximum').props.onChange('93')
  const before = useStore.getState().state.goals
  submit(render())
  assert.equal(useStore.getState().state.goals, before)
  assert.equal(await confirm(true), false)
  picker(render(), 'Poids maximum').props.onChange('97')
  submit(render()); render()
  assert.equal(useStore.getState().state.goals.targetWeightMin, 96)
  assert.equal(await confirm(), true)
  assert.equal(actions(render()).props.visible, false)
})

test('pause choices are drafts until explicit Start, which leaves without a second warning', async () => {
  const render = mount(PauseScreen), before = useStore.getState().state.programPause
  assert.equal(await confirm(), true)
  click(render(), 'Maladie').props.onClick(); render()
  assert.equal(await confirm(true), false)
  assert.equal(useStore.getState().state.programPause, before)
  await click(render(), 'Démarrer la pause').props.onClick()
  assert.equal(useStore.getState().state.programPause.active, true)
  assert.equal(useStore.getState().state.programPause.reason, 'maladie')
  assert.equal(await confirm(), true)
  assert.equal(prompts, 1)
})

test('More and workout settings no longer duplicate Program or daily measurement routes', async () => {
  assert.equal(find(MoreScreen(), element => ['progres/corps/mesure', 'calendrier/programme'].includes(element.props.to)), undefined)
  const route = SettingsScreen({ section: 'seances' })
  const render = mount(() => (route.type as (props: any) => ReactNode)(route.props))
  assert.equal(find(render(), element => element.props.to === 'calendrier/programme'), undefined)
})


test('invalid nutrition entry cannot disappear on a date change, while valid totals autosave without a warning', async () => {
  const page = mount(NutritionScreen)
  const counter = () => find(page(), element => element.props.label === 'Protéines' && typeof element.props.onSet === 'function')!
  const render = mount(() => (counter().type as (props: any) => ReactNode)(counter().props))
  picker(render(), 'Protéines').props.onChange('-2'); render()
  const key = counter().key
  await resolveAction(find(page(), element => element.props.label === 'Jour précédent')!.props.onClick(), true)
  assert.equal(counter().key, key)
  assert.equal(prompts, 1)
  picker(render(), 'Protéines').props.onChange('180,5'); render()
  assert.equal(await confirm(), true)
  await resolveAction(find(page(), element => element.props.label === 'Jour précédent')!.props.onClick())
  assert.notEqual(counter().key, key)
  assert.equal(useStore.getState().state.nutritionEntries['2026-10-08'].protein, 180.5)
  assert.equal(prompts, 1)
})

test('reminder export options are guarded only after an unexported change', async () => {
  const render = mount(RemindersScreen)
  const training = () => find(render(), element => element.type === Toggle && element.props.label === 'Séances')!
  render(); assert.equal(await confirm(), true)
  training().props.onChange(false); render()
  assert.equal(await confirm(true), false)
  training().props.onChange(true); render()
  assert.equal(await confirm(), true)
})

test('switching gym rename preserves a refused draft and saving a different form does not acknowledge it', async () => {
  const base = useStore.getState().state
  useStore.setState({ state: { ...base, gyms: [...base.gyms, { id: 'second', name: 'Autre salle' }] } })
  const route = SettingsScreen({ section: 'materiel' })
  const page = mount(() => (route.type as (props: any) => ReactNode)(route.props))
  const element = child(page(), 'GymManager')
  const render = mount(() => (element.type as (props: any) => ReactNode)(element.props))
  await resolveAction(find(render(), element => element.props.label === `Renommer ${base.gyms[0].name}`)!.props.onClick())
  const name = () => find(render(), element => element.props['aria-label'] === 'Nom de la salle')!
  name().props.onChange({ target: { value: 'Brouillon salle' } }); render()
  await resolveAction(find(render(), element => element.props.label === 'Renommer Autre salle')!.props.onClick(), true)
  assert.equal(name().props.value, 'Brouillon salle')
  find(render(), element => element.props['aria-label'] === 'Nom de la nouvelle salle')!.props.onChange({ target: { value: 'Nouvelle salle' } })
  const add = find(render(), element => element.type === 'form' && !!find(element.props.children, input => input.props['aria-label'] === 'Nom de la nouvelle salle'))!
  add.props.onSubmit({ preventDefault() {} }); render()
  assert.equal(await confirm(true), false, 'saving Add does not discard Rename')
  submit(render()); render()
  assert.equal(useStore.getState().state.gyms[0].name, 'Brouillon salle')
  assert.equal(await confirm(), true)
})


test('opening program duration protects targets and remounts only after discard is accepted', async () => {
  const route = SettingsScreen({ section: 'objectifs' })
  const page = mount(() => (route.type as (props: any) => ReactNode)(route.props))
  const element = child(page(), 'TargetMeasurements')
  const render = mount(() => (element.type as (props: any) => ReactNode)(element.props))
  find(render(), item => item.type === Segmented)!.props.onChange('custom')
  picker(render(), 'Poids minimum').props.onChange('75'); render()
  const openDuration = () => find(page(), item => item.props.label === 'Durée du programme')!.props.onClick()
  await resolveAction(openDuration(), true)
  assert.equal(child(page(), 'GoalSheet'), undefined)
  assert.equal(child(page(), 'TargetMeasurements').key, element.key)
  assert.equal(picker(render(), 'Poids minimum').props.value, '75')
  await resolveAction(openDuration(), true, true)
  assert.ok(child(page(), 'GoalSheet'))
  assert.notEqual(child(page(), 'TargetMeasurements').key, element.key, 'discarding really resets the stale form before mode changes')
  assert.equal(useStore.getState().state.goals.targetWeightMin, 0)
})
