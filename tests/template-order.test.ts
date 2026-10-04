import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SortableExerciseList } from '../src/components/SortableExerciseList'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { useStore } from '../src/lib/store'
import type { Workout } from '../src/lib/types'

const state = () => useStore.getState().state
const actions = () => useStore.getState()
const originalLanguage = lang()
beforeEach(() => useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' }))
afterEach(async () => { setLang(originalLanguage); await actions().flush() })

test('dropping across several positions saves the exact order and targets through a backup round trip', () => {
  const original = state().templates.UPPER.exercises
  assert.ok(original.length >= 4)
  actions().reorderTemplateExercise('UPPER', 0, 3)
  const expected = [original[1], original[2], original[3], original[0], ...original.slice(4)]
  assert.deepEqual(state().templates.UPPER.exercises, expected)
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state(), []))).state.templates.UPPER.exercises, JSON.parse(JSON.stringify(expected)))
  actions().reorderTemplateExercise('UPPER', 3, 0)
  assert.deepEqual(state().templates.UPPER.exercises, original)
})

test('reordering the future plan leaves the active workout, history and other templates untouched', () => {
  actions().startSession('UPPER')
  const active = state().activeWorkout!
  const historical: Workout = { ...active, completedAt: '2026-10-01T12:00:00Z', sessionNumber: 1 }
  useStore.setState({ state: { ...state(), workouts: [historical] } })
  const before = state()
  actions().reorderTemplateExercise('UPPER', 2, 0)
  assert.equal(state().activeWorkout, active)
  assert.equal(state().workouts, before.workouts)
  assert.equal(state().workouts[0], historical)
  assert.equal(state().templates.LOWER, before.templates.LOWER)
})

test('repeated exercises keep their own prescriptions when moved, and invalid drops do nothing', () => {
  const base = state()
  const first = base.templates.UPPER.exercises[0]
  const repeated = { ...first, target: { ...first.target, weight: 25, minReps: 15, maxReps: 20 } }
  const middle = base.templates.UPPER.exercises[1]
  useStore.setState({ state: { ...base, templates: { ...base.templates, UPPER: { ...base.templates.UPPER, exercises: [first, middle, repeated] } } } })
  actions().reorderTemplateExercise('UPPER', 2, 0)
  assert.deepEqual(state().templates.UPPER.exercises, [repeated, first, middle])
  assert.equal(state().templates.UPPER.exercises[0], repeated)
  for (const [from, to] of [[0, 0], [-1, 1], [0, -1], [3, 0], [0, 3], [0.5, 1], [0, Infinity]]) {
    const before = state()
    actions().reorderTemplateExercise('UPPER', from, to)
    assert.equal(state(), before)
  }
})

test('a drop does not attach a one-session alternative to the wrong exercise slot', () => {
  assert.ok(actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session'))
  actions().reorderTemplateExercise('UPPER', 0, 3)
  assert.equal(state().sessionReplacements?.UPPER, undefined)
})

test('the actual list renders one named, touch-safe keyboard handle per occurrence in both languages', () => {
  const first = state().templates.UPPER.exercises[0]
  const exercises = [first, { ...first, target: { ...first.target, sets: 4 } }]
  for (const language of ['fr', 'en'] as const) {
    setLang(language)
    const html = renderToStaticMarkup(createElement(SortableExerciseList, { exercises, inSession: [3, 4], onEdit() {}, onMove() {} }))
    const handles = [...html.matchAll(/<button\b([^>]*)>/g)].filter((match) => match[1].includes('aria-roledescription='))
    assert.equal(handles.length, 2)
    for (const handle of handles) {
      assert.match(handle[1], /touch-none/)
      assert.match(handle[1], /h-11 w-11/)
      assert.match(handle[1], /aria-describedby=/)
      assert.match(handle[1], language === 'fr' ? /aria-label="Déplacer / : /aria-label="Move /)
      assert.match(handle[1], /aria-disabled="false"/)
      assert.doesNotMatch(handle[1], /\sdisabled(?:=|\s|$)/)
    }
    assert.doesNotMatch(html, /aria-label="(?:Monter|Descendre|Move up|Move down)"/)
    assert.match(html, /role="list"/)
    assert.equal((html.match(/role="listitem"/g) ?? []).length, 2)
  }
})
