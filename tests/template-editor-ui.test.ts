import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { SortableExerciseList } from '../src/components/SortableExerciseList'
import { Button, SheetAction } from '../src/components/ui'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, takesLest } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { TemplateEditor } from '../src/screens/ProgramScreen'

type Element = ReactElement<Record<string, any>>
const originalStore = useStore.getState(), originalLanguage = lang()
const state = () => useStore.getState().state

// Reach the private edit sheet through the public template route and its actual
// selection/save handlers, without rendering a browser-only portal.
function mount(render: () => Element) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
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
const field = (node: ReactNode, label: string) => find(node, e => e.type === MeasurementPicker && e.props.label === label)!
const editSheet = (node: ReactNode) => find(node, e => typeof e.type === 'function' && e.type.name === 'EditSheet')
const close = (action: () => void, validate?: () => boolean) => { if (!validate || validate()) action() }
const save = (sheet: Element) => {
  const footer = sheet.props.footer as Element
  const contents = footer.type === SheetAction ? footer.props.children(close, () => true) : footer
  return find(contents, e => e.type === Button && e.props.variant === 'primary')!
}
const submit = (sheet: Element) => {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previous = internals.H
  internals.H = { useContext: () => close }
  try { Button(save(sheet).props).props.onClick?.({ preventDefault() {} } as any) } finally { internals.H = previous }
}

function openEditor(index: number) {
  const route = mount(() => TemplateEditor({ type: 'UPPER' }))
  find(route(), e => e.type === SortableExerciseList)!.props.onEdit(index)
  const sheet = editSheet(route())!
  assert.ok(sheet, 'selecting an exercise opens its editor')
  return { route, render: mount(() => (sheet.type as (props: unknown) => Element)(sheet.props)) }
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' })
  configurePlan(DEFAULT_GOAL)
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('template exercise editor rejects invalid load/rest drafts and persists valid load, rest and bodyweight added load', () => {
  const weightedIndex = state().templates.UPPER.exercises.findIndex(ex => ex.unit !== 'PDC')
  const bodyweightIndex = state().templates.UPPER.exercises.findIndex(takesLest)
  assert.ok(weightedIndex >= 0 && bodyweightIndex >= 0, 'fixture has weighted and loadable bodyweight exercises')
  const before = state(), original = before.templates.UPPER.exercises[weightedIndex]
  const { route, render } = openEditor(weightedIndex)

  for (const invalid of ['-1', 'bad']) {
    field(render(), 'Charge').props.onChange(invalid)
    assert.equal(field(render(), 'Charge').props.invalid, true)
    assert.equal(save(render()).props.disabled, true)
    submit(render())
    assert.equal(state(), before, 'even a forced save cannot persist an invalid load')
    assert.ok(editSheet(route()), 'failed save leaves the editor open')
  }
  field(render(), 'Charge').props.onChange('22,5')
  for (const invalid of ['', '12,5', '14', 'bad']) {
    field(render(), 'Repos').props.onChange(invalid)
    assert.equal(field(render(), 'Repos').props.invalid, true)
    assert.equal(save(render()).props.disabled, true)
    submit(render())
    assert.equal(state(), before, 'invalid rest cannot modify the exercise or other state')
  }
  field(render(), 'Repos').props.onChange('135')
  assert.equal(save(render()).props.disabled, false)
  submit(render())
  assert.equal(editSheet(route()), undefined, 'successful save closes the selected exercise')
  assert.deepEqual(state().templates.UPPER.exercises[weightedIndex].target, {
    ...original.target, weight: 22.5, restSeconds: 135,
  })
  assert.equal(state().workouts, before.workouts, 'editing targets does not rewrite history')

  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  useStore.setState({ state: restored })
  const reopened = openEditor(weightedIndex).render()
  assert.equal(field(reopened, 'Charge').props.value, '22,5')
  assert.equal(field(reopened, 'Repos').props.value, '135')

  const bodyweightBefore = state(), bodyweightOriginal = bodyweightBefore.templates.UPPER.exercises[bodyweightIndex]
  const bodyweight = openEditor(bodyweightIndex)
  assert.equal(field(bodyweight.render(), 'Charge'), undefined, 'bodyweight exposes added load rather than total bodyweight')
  assert.equal(field(bodyweight.render(), 'Lest').props.unit, 'kg')
  field(bodyweight.render(), 'Lest').props.onChange('-2')
  assert.equal(save(bodyweight.render()).props.disabled, true)
  submit(bodyweight.render())
  assert.equal(state(), bodyweightBefore)
  field(bodyweight.render(), 'Lest').props.onChange('7,5')
  assert.equal(save(bodyweight.render()).props.disabled, false)
  submit(bodyweight.render())
  assert.equal(editSheet(bodyweight.route()), undefined)
  const saved = state().templates.UPPER.exercises[bodyweightIndex]
  assert.equal(saved.unit, 'PDC')
  assert.deepEqual(saved.target, { ...bodyweightOriginal.target, weight: 7.5 })
  const bodyweightRestored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.equal(bodyweightRestored.templates.UPPER.exercises[bodyweightIndex].target.weight, 7.5)
})
