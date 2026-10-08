import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { ExerciseAlternatives } from '../src/components/ExerciseAlternatives'
import { ExerciseSheet } from '../src/components/ExerciseSheet'
import { GoalSheet } from '../src/components/GoalSheet'
import { GymSheet } from '../src/components/GymSheet'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { SetupPicker, SetupSheet } from '../src/components/Setup'
import { SortableExerciseList } from '../src/components/SortableExerciseList'
import { WeekScheduleSheet } from '../src/components/WeekScheduleSheet'
import { Button, DateInput, SheetAction } from '../src/components/ui'
import { defaultState } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { confirmUnsavedChanges, useDiscardConfirmation } from '../src/lib/unsavedChanges'
import { ImportResultSheet, Onboarding } from '../src/screens/Onboarding'
import { TemplateEditor } from '../src/screens/ProgramScreen'
import { MeasureSheet } from '../src/screens/Progress'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const cleanups: (() => void)[] = []
let host: EventTarget & { scrollTo: () => void }

// Run the real drafts/actions while leaving Sheet's portal/animation contract
// to its own tests. Persistent refs and effect cleanup cover onboarding unload.
function mount<P>(component: (props: P) => ReactNode, props: () => P) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const effects: (() => void | (() => void))[] = [], previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useMemo: (callback: () => unknown) => callback(),
      useId: () => 'draft-test',
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
      useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value } },
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
      useEffect(effect: () => void | (() => void), deps: unknown[]) {
        const i = cursor++, before = slots[i] as unknown[] | undefined
        if (!before || deps.some((dep, index) => !Object.is(dep, before[index]))) effects.push(effect)
        slots[i] = deps
      },
    }
    let result: ReactNode
    try { result = component(props()) } finally { internals.H = previous }
    effects.forEach(effect => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup) })
    return result as Element
  }
}
function find(node: ReactNode, predicate: (element: Element) => boolean): Element | undefined {
  for (const item of React.Children.toArray(node)) {
    if (!isValidElement<Record<string, any>>(item)) continue
    if (predicate(item)) return item
    const child = find(item.props.children, predicate)
    if (child) return child
  }
}
const picker = (node: ReactNode, label: string) => find(node, element => element.type === MeasurementPicker && element.props.label === label)!
const field = (node: ReactNode, label: string) => find(node, element => element.props.label === label && typeof element.props.onChange === 'function')!
const eventValue = (value: string) => ({ target: { value } })
const closeImmediately = (action: () => unknown, validate?: () => boolean | Promise<boolean>) => {
  const allowed = validate ? validate() : true
  if (allowed instanceof Promise) return allowed.then(ok => { if (ok) return action() })
  if (allowed) return action()
}
const actions = (node: Element, confirmDiscard: () => boolean | Promise<boolean>) => node.props.children(closeImmediately, async () => confirmDiscard()) as ReactNode
const click = (button: Element) => {
  if (button.props.disabled) return
  return closeImmediately(() => button.props.onClick?.(), typeof button.props.closeSheet === 'function' ? button.props.closeSheet : undefined)
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr'); configurePlan(DEFAULT_GOAL)
  useStore.setState({ state: defaultState(), hasData: false, storage: 'memory', ready: true, lastImport: null })
  host = Object.assign(new EventTarget(), { scrollTo() {} })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: host })
})
afterEach(async () => {
  cleanups.splice(0).forEach(cleanup => cleanup())
  await useStore.getState().flush()
  useStore.setState(originalStore, true); setLang(originalLanguage); configurePlan(DEFAULT_GOAL)
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

test('setup and goal guards become dirty only after a real draft change, including invalid dates', () => {
  let closes = 0
  const setup = mount(SetupSheet, () => ({ onClose: () => closes++ }))
  const initial = find(setup(), e => e.type === SetupPicker)!.props.value
  assert.equal(setup().props.dirty, false)
  find(setup(), e => e.type === SetupPicker)!.props.onChange({ place: 'home', equipment: ['dumbbells'] })
  assert.equal(setup().props.dirty, true)
  find(setup(), e => e.type === SetupPicker)!.props.onChange(initial)
  assert.equal(setup().props.dirty, false)
  const goal = mount(GoalSheet, () => ({ onClose: () => closes++ }))
  const originalDate = find(goal(), e => e.type === DateInput)!.props.value
  field(goal(), 'Date objectif').props.onChange('invalid')
  assert.equal(goal().props.dirty, true)
  assert.equal(goal().props.footer.props.closeSheet(), false)
  goal().props.footer.props.onClick()
  assert.equal(closes, 0)
  field(goal(), 'Date objectif').props.onChange(originalDate)
  assert.equal(goal().props.dirty, false)
})

test('a failed setup write retains its draft and never calls onClose', () => {
  let closes = 0
  const render = mount(SetupSheet, () => ({ onClose: () => closes++ }))
  find(render(), e => e.type === SetupPicker)!.props.onChange({ place: 'home', equipment: [] })
  useStore.setState({ setSetup: () => { throw new Error('write failed') } })
  assert.throws(() => render().props.footer.props.onClick(), /write failed/)
  assert.equal(closes, 0)
  assert.equal(render().props.dirty, true)
})

test('week draft rejects a stale save without closing or losing selected days', () => {
  let closes = 0
  const render = mount(WeekScheduleSheet, () => ({ weekDate: '2026-10-08', onClose: () => closes++ }))
  const initial = useStore.getState().state
  assert.equal(render().props.dirty, false)
  const day = find(render(), e => e.type === 'button' && !e.props.disabled)!
  const label = day.props['aria-label'].split(' : ')[0]
  day.props.onClick()
  assert.equal(render().props.dirty, true)
  const selected = find(render(), e => e.type === 'button' && e.props['aria-label']?.startsWith(label))!.props['aria-pressed']
  useStore.setState({ setWeekSchedule: () => false })
  click(render().props.footer)
  assert.equal(closes, 0)
  assert.equal(useStore.getState().state, initial)
  assert.equal(render().props.dirty, true)
  assert.equal(find(render(), e => e.type === 'button' && e.props['aria-label']?.startsWith(label))!.props['aria-pressed'], selected)
  assert.ok(find(render(), e => e.props.role === 'alert'))
})

test('measurement save errors keep values; approved discard resets the still-mounted form', () => {
  let closes = 0
  const render = mount(MeasureSheet, () => ({ open: true, onClose: () => closes++ }))
  assert.equal(render().props.dirty, false)
  field(render(), 'Date de la mesure').props.onChange('2026-10-07')
  assert.equal(render().props.dirty, true)
  picker(render(), 'Poids').props.onChange('-3')
  assert.equal(render().props.footer.props.closeSheet(), false)
  click(render().props.footer)
  assert.equal(closes, 0)
  picker(render(), 'Poids').props.onChange('81,25')
  useStore.setState({ saveBody: () => { throw new Error('measurement failed') } })
  assert.throws(() => click(render().props.footer), /measurement failed/)
  assert.equal(closes, 0)
  assert.equal(picker(render(), 'Poids').props.value, '81,25')
  render().props.onClose() // Sheet calls this only after its shared guard allows dismissal.
  assert.equal(closes, 1)
  assert.equal(render().props.dirty, false)
  assert.equal(picker(render(), 'Poids').props.value, '')
  assert.equal(field(render(), 'Date de la mesure').props.value, '2026-10-08')
})

test('a successful measurement save persists once and leaves no unsaved draft on reopen', () => {
  let closes = 0
  const render = mount(MeasureSheet, () => ({ open: true, onClose: () => closes++ }))
  picker(render(), 'Bras').props.onChange('35,75')
  click(render().props.footer)
  assert.equal(closes, 1)
  assert.equal(useStore.getState().state.bodyEntries.at(-1)?.arm, 35.75)
  assert.equal(render().props.dirty, false)
})

test('exercise video errors remain dirty; saving or approved discard clears only that draft', async () => {
  let closes = 0
  const render = mount(ExerciseSheet, () => ({ exerciseId: 'chest-press', open: true, onClose: () => closes++ }))
  assert.equal(render().props.dirty, false)
  find(render(), e => e.type === 'input')!.props.onChange(eventValue('invalid'))
  find(render(), e => e.type === 'form')!.props.onSubmit({ preventDefault() {} })
  assert.equal(render().props.dirty, true)
  assert.ok(find(render(), e => e.props.role === 'alert'))
  assert.equal(closes, 0)
  find(render(), e => e.type === 'input')!.props.onChange(eventValue('https://youtu.be/dQw4w9WgXcQ'))
  find(render(), e => e.type === 'form')!.props.onSubmit({ preventDefault() {} })
  assert.equal(render().props.dirty, false)
  find(render(), e => e.type === 'input')!.props.onChange(eventValue('new invalid draft'))
  const remove = actions(find(render(), e => e.type === SheetAction)!, () => false) as Element
  await remove.props.onClick()
  assert.equal(find(render(), e => e.type === 'input')!.props.value, 'new invalid draft')
  assert.equal(useStore.getState().state.exerciseVideos['chest-press'], 'https://youtu.be/dQw4w9WgXcQ', 'cancelled removal keeps saved video and unsaved input')
  render().props.onClose()
  assert.equal(closes, 1)
  assert.equal(render().props.dirty, false)
  assert.equal(useStore.getState().state.exerciseVideos['chest-press'], 'https://youtu.be/dQw4w9WgXcQ')
})

test('replacement checks abandonment before mutation and stays open if replacement is refused', async () => {
  let allowed = false, prompts = 0, closes = 0
  const before = useStore.getState().state
  const render = mount(ExerciseAlternatives, () => ({ exerciseId: 'chest-press', replacement: { kind: 'template' as const, type: 'UPPER' as const, index: 0 }, onReplaced: () => closes++, beforeReplace: async () => { prompts++; return allowed } }))
  const replace = () => find(render(), e => e.type === Button && !e.props.disabled && e.props['aria-label']?.startsWith('Remplacer par'))!
  await click(replace())
  assert.equal(prompts, 1); assert.equal(closes, 0); assert.equal(useStore.getState().state, before)
  allowed = true
  useStore.setState({ replaceTemplateExercise: () => false })
  await click(replace())
  assert.equal(prompts, 2); assert.equal(closes, 0); assert.equal(useStore.getState().state, before)
})

test('replacement waits for the Lift confirmation before changing the exercise and closing', async () => {
  let resolve!: (allowed: boolean) => void
  let changes = 0, closes = 0
  const permission = new Promise<boolean>(done => { resolve = done })
  useStore.setState({ replaceTemplateExercise: () => { changes++; return true } })
  const render = mount(ExerciseAlternatives, () => ({ exerciseId: 'chest-press', replacement: { kind: 'template' as const, type: 'UPPER' as const, index: 0 }, onReplaced: () => closes++, beforeReplace: () => permission }))
  const replace = find(render(), e => e.type === Button && !e.props.disabled && e.props['aria-label']?.startsWith('Remplacer par'))!
  const saving = click(replace)
  await Promise.resolve()
  assert.equal(changes, 0); assert.equal(closes, 0)
  resolve(true)
  await saving
  assert.equal(changes, 1); assert.equal(closes, 1)
})

test('template draft removal uses the Sheet confirmation instead of silently discarding edits', async () => {
  const renderEditor = mount(TemplateEditor, () => ({ type: 'UPPER' as const }))
  find(renderEditor(), e => e.type === SortableExerciseList)!.props.onEdit(0)
  const child = find(renderEditor(), e => typeof e.type === 'function' && e.type.name === 'EditSheet')!
  const render = mount(child.type as (props: any) => ReactNode, () => child.props)
  const initial = useStore.getState().state
  picker(render(), 'Repos').props.onChange('1')
  assert.equal(render().props.dirty, true)
  let prompts = 0
  const footer = actions(render().props.footer, () => { prompts++; return false })
  const remove = find(footer, e => e.props['aria-label'] === 'Retirer l’exercice')!
  await click(remove)
  assert.equal(prompts, 1); assert.equal(useStore.getState().state, initial)
  const save = find(footer, e => e.props.children === 'Enregistrer')!
  assert.equal(save.props.disabled, true)
  assert.equal(save.props.closeSheet(), false)
})

test('a new gym name is guarded before switching gym or place, while creating saves directly', async () => {
  let closes = 0, prompts = 0
  const render = mount(GymSheet, () => ({ onClose: () => closes++ }))
  const content = () => actions(find(render(), e => e.type === SheetAction)!, () => { prompts++; return false })
  find(content(), e => e.type === 'input')!.props.onChange(eventValue('Salle brouillon'))
  assert.equal(render().props.dirty, true)
  const before = useStore.getState().state
  await find(content(), e => e.type === 'button' && e.props['aria-pressed'] !== undefined)!.props.onClick()
  assert.equal(prompts, 1); assert.equal(closes, 0); assert.equal(useStore.getState().state, before)
  find(content(), e => e.type === 'form')!.props.onSubmit({ preventDefault() {} })
  assert.equal(prompts, 1); assert.equal(closes, 1)
  assert.equal(useStore.getState().state.gyms.at(-1)?.name, 'Salle brouillon')
})

test('optional post-import weight guards invalid edits and successful continuation saves exactly once', () => {
  useStore.setState({ lastImport: { changes: [] } })
  const render = mount(ImportResultSheet, () => ({}))
  assert.equal(render().props.dirty, false)
  picker(render(), 'Poids ce matin').props.onChange('-2')
  assert.equal(render().props.dirty, true)
  assert.equal(render().props.footer.props.closeSheet(), false)
  click(render().props.footer)
  assert.ok(useStore.getState().lastImport)
  picker(render(), 'Poids ce matin').props.onChange('81,25')
  click(render().props.footer)
  assert.equal(useStore.getState().lastImport, null)
  assert.equal(useStore.getState().state.bodyEntries.at(-1)?.weight, 81.25)
})

test('onboarding opens the Lift confirmation only after changing its unsaved answers', async () => {
  const render = mount(Onboarding, () => ({}))
  const dialog = mount(() => React.createElement('test-dialog', useDiscardConfirmation()), () => ({}))
  render().props.onStart()
  assert.equal(await confirmUnsavedChanges(), true)
  assert.equal(dialog().props.open, false)
  find(render(), e => e.type === SetupPicker)!.props.onChange({ place: 'home', equipment: [] })
  render()
  const leave = confirmUnsavedChanges()
  assert.equal(dialog().props.open, true)
  dialog().props.resolve(false)
  assert.equal(await leave, false)
  assert.equal(dialog().props.open, false)
})
