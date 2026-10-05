import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExerciseAlternatives, type ExerciseReplacementTarget } from '../src/components/ExerciseAlternatives'
import { SessionScreen } from '../src/screens/Session'
import { defaultState } from '../src/lib/backup'
import { lang, setLang, type Lang } from '../src/lib/i18n'
import { LIBRARY } from '../src/lib/library'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { WORKOUT_TYPES, type AppState, type TemplateExercise, type WorkoutExercise } from '../src/lib/types'

// Zustand's server renderer reads its initial snapshot, not getState(). Replace
// only that in-memory fixture; no store action, browser database or timer runs.
const initial = useStore.getInitialState()
const original = initial.state
const originalLanguage = lang()
let state: AppState
beforeEach(() => {
  setLang('en')
  configurePlan(DEFAULT_GOAL)
  state = defaultState()
  for (const type of WORKOUT_TYPES) state.templates[type].exercises = []
  initial.state = state
})
afterEach(() => {
  initial.state = original
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

function exercise(id: string): TemplateExercise {
  const info = LIBRARY[id]
  return {
    exerciseId: id, name: info.name, muscle: info.muscle, unit: info.unit, role: info.role,
    target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 120, rir: '2' },
  }
}

function activeExercise(id: string, completed = false): WorkoutExercise {
  return {
    ...exercise(id), notes: '', skipped: false, validated: false, comparison: null,
    sets: [{ weight: null, reps: completed ? 10 : null, cleanReps: completed ? 10 : null, flags: [], note: '', completed, rir: null }],
  }
}

function active(completed = false) {
  state.templates.UPPER.exercises = [exercise('chest-press')]
  state.activeWorkout = {
    id: 'ui-fixture', type: 'UPPER', date: '2026-10-03', startedAt: '2026-10-03T09:00:00Z',
    notes: '', timerEndAt: null, timer: null, exercises: [activeExercise('chest-press', completed)],
  }
}

function render(replacement?: ExerciseReplacementTarget, exerciseId = 'chest-press') {
  return renderToStaticMarkup(createElement(ExerciseAlternatives, { exerciseId, replacement }))
}

// Inspect the real rendered controls, including their accessible names and
// disabled state. This deliberately does not inspect component source text.
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
const textOf = (html: string) => html.replace(/<[^>]*>/g, '')
const replacementButtons = (html: string) => buttons(html).filter(button => /aria-label="(?:Replace with |Remplacer par )/.test(button[1]))
const disabled = (attributes: string) => /\bdisabled(?:=|\s|$)/.test(attributes)
const scopeButton = (html: string, label: string) => buttons(html).find(button => textOf(button[2]) === label)

test('planned exercise exposes replacements before opening any demo, with explicit FR/EN session and program scope', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    state.templates.UPPER.exercises = [exercise('chest-press')]
    const html = render({ kind: 'planned', type: 'UPPER', index: 0 })
    const replace = replacementButtons(html)
    assert.equal(state.activeWorkout, null)
    assert.ok(replace.length >= 5)
    assert.ok(replace.every(button => !disabled(button[1])))
    assert.doesNotMatch(html, /<canvas\b/, 'choosing does not require opening a 3D demo')
    const session = scopeButton(html, locale === 'fr' ? 'Cette séance' : 'This workout')
    const program = scopeButton(html, locale === 'fr' ? 'Garder au programme' : 'Keep in program')
    assert.ok(session && program)
    assert.match(session[1], /aria-pressed="true"/)
    assert.match(program[1], /aria-pressed="false"/)
    assert.match(html, locale === 'fr' ? /Ton programme reste le même/ : /Your program stays the same/)
  }
})

test('session preview renders the persisted one-session choice without changing the program sheet', () => {
  state.templates.UPPER.exercises = [exercise('chest-press'), exercise('lat-pulldown')]
  state.sessionReplacements = { UPPER: [{ index: 0, fromId: 'chest-press', exerciseId: 'db-bench-press' }] }
  const before = structuredClone(state)
  const html = renderToStaticMarkup(createElement(SessionScreen))
  assert.ok(textOf(html).includes(LIBRARY['db-bench-press'].name))
  assert.ok(!textOf(html).includes(LIBRARY['chest-press'].name))
  assert.ok(scopeButton(html, 'Start Upper'))
  assert.deepEqual(state, before, 'rendering never persists a choice or consumes its draft')
})

test('program edit names its permanent scope and disables an alternative already in another slot', () => {
  state.templates.UPPER.exercises = [exercise('chest-press'), exercise('db-bench-press')]
  const html = render({ kind: 'template', type: 'UPPER', index: 0 })
  assert.match(html, /For future workouts of this type\. Recorded workouts stay unchanged\./)
  assert.equal(scopeButton(html, 'This workout'), undefined)
  const duplicate = replacementButtons(html).find(button => button[1].includes(`Replace with ${LIBRARY['db-bench-press'].name}`))
  assert.ok(duplicate && disabled(duplicate[1]))
  assert.match(html, /Already in this workout plan/)
  assert.ok(replacementButtons(html).some(button => !disabled(button[1])))
})

test('a one-session duplicate is detected against effective drafts rather than only the permanent sheet', () => {
  state.templates.UPPER.exercises = [exercise('chest-press'), exercise('dips')]
  state.sessionReplacements = { UPPER: [{ index: 1, fromId: 'dips', exerciseId: 'db-bench-press' }] }
  const html = render({ kind: 'planned', type: 'UPPER', index: 0 })
  const duplicate = replacementButtons(html).find(button => button[1].includes(`Replace with ${LIBRARY['db-bench-press'].name}`))
  assert.ok(duplicate && disabled(duplicate[1]))
  assert.match(html, /Already in this workout/)
})

test('program replacement disables an alternative reserved by another slot’s one-session draft', () => {
  state.templates.UPPER.exercises = [exercise('chest-press'), exercise('dips')]
  state.sessionReplacements = { UPPER: [{ index: 1, fromId: 'dips', exerciseId: 'db-bench-press' }] }
  const html = render({ kind: 'template', type: 'UPPER', index: 0 })
  const duplicate = replacementButtons(html).find(button => button[1].includes(`Replace with ${LIBRARY['db-bench-press'].name}`))
  assert.ok(duplicate && disabled(duplicate[1]))
})

test('details without a slot distinguish repeated occurrences by workout type and position', () => {
  state.templates.UPPER.exercises = [exercise('chest-press'), exercise('lat-pulldown'), exercise('chest-press')]
  state.templates.PUSH.exercises = [exercise('chest-press')]
  const html = render()
  assert.match(html, /Workout to change/)
  const options = [...html.matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)]
  assert.deepEqual(options.map(option => option[2]), ['Program · Upper · 01', 'Program · Upper · 03', 'Program · Push · 01'])
  assert.equal(new Set(options.map(option => option[1].match(/value="([^"]+)"/)?.[1])).size, 3)
  assert.equal((render({ kind: 'planned', type: 'UPPER', index: 2 }).match(/<select\b/g) ?? []).length, 0, 'an explicit slot does not get silently replaced by the first matching occurrence')
})

test('a historical exercise with no current occurrence remains browseable without a guessed mutation target', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    const html = render()
    assert.equal(replacementButtons(html).length, 0)
    assert.doesNotMatch(html, /<select\b/)
    assert.ok(buttons(html).some(button => /aria-label="(?:View demo: |Voir la démonstration : )/.test(button[1])))
    assert.match(html, locale === 'fr' ? /n’est plus dans ton programme actuel/ : /no longer in your current program/)
  }
})

test('logged sets lock the current exercise while exposing future-program scope; reopened history cannot change that program', () => {
  active(true)
  const html = render({ kind: 'active', index: 0 })
  assert.match(html, /role="status"[^>]*>Sets are already logged/)
  assert.ok(replacementButtons(html).length > 0)
  assert.ok(replacementButtons(html).every(button => disabled(button[1])))
  assert.ok(scopeButton(html, 'Future workouts'))
  state.activeWorkout!.reopened = { completedAt: '2026-10-02T10:00:00Z' }
  const reopened = render({ kind: 'active', index: 0 })
  assert.equal(scopeButton(reopened, 'Future workouts'), undefined)
  assert.ok(replacementButtons(reopened).every(button => disabled(button[1])))
})
