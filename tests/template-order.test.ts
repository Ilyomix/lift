import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SortableExerciseList } from '../src/components/SortableExerciseList'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { sessionExercises } from '../src/lib/exerciseReplacement'
import { lang, setLang } from '../src/lib/i18n'
import { buildResearchTemplates } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { WORKOUT_TYPES, type TrainingSetup, type Workout } from '../src/lib/types'

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

test('restoring default order restores every gym template without rebuilding its exercises', () => {
  for (const type of WORKOUT_TYPES) {
    const original = state().templates[type].exercises
    const before = state()
    useStore.setState({ state: { ...before, templates: { ...before.templates, [type]: { ...before.templates[type], exercises: [...original].reverse() } } } })
    actions().resetTemplateOrder(type)
    const restored = state().templates[type].exercises
    assert.deepEqual(restored, original)
    restored.forEach((exercise, index) => assert.equal(exercise, original[index]))
  }
})

test('restoring home order follows the actual available equipment, including omitted slots', () => {
  const setups: TrainingSetup[] = [
    { place: 'home', equipment: [] },
    { place: 'home', equipment: ['dumbbells', 'bench', 'bands', 'pullupBar'] },
  ]
  for (const setup of setups) {
    const canonical = buildResearchTemplates(undefined, [], setup)
    const before = state()
    useStore.setState({ state: { ...before, settings: { ...before.settings, setup }, templates: canonical } })
    for (const type of WORKOUT_TYPES) {
      const original = canonical[type].exercises
      const current = state()
      useStore.setState({ state: { ...current, templates: { ...current.templates, [type]: { ...current.templates[type], exercises: [...original].reverse() } } } })
      actions().resetTemplateOrder(type)
      assert.deepEqual(state().templates[type].exercises, original)
      state().templates[type].exercises.forEach((exercise, index) => assert.equal(exercise, original[index]))
    }
  }
})

test('reset keeps durable alternatives, extra exercises and each duplicate prescription through backup', () => {
  const first = state().templates.UPPER.exercises[0]
  const second = state().templates.UPPER.exercises[1]
  assert(actions().replaceTemplateExercise('UPPER', 0, 'db-bench-press'))
  const alternative = {
    ...state().templates.UPPER.exercises[0],
    target: { weight: 32.5, sets: 4, minReps: 9, maxReps: 14, restSeconds: 105, rir: '3' },
    technique: 'User setup note', note: 'User instruction', focus: true,
  }
  actions().addTemplateExercise('UPPER', 'band-curl')
  const extra = state().templates.UPPER.exercises.at(-1)!
  const repeated = { ...first, target: { ...first.target, weight: 25, minReps: 15, maxReps: 20 }, gymLoads: { other: 30 } }
  const before = state()
  useStore.setState({ state: { ...before, templates: { ...before.templates, UPPER: { ...before.templates.UPPER, exercises: [alternative, repeated, second, extra, first] } } } })
  actions().resetTemplateOrder('UPPER')
  const expected = [repeated, first, second, alternative, extra]
  const restored = state().templates.UPPER.exercises
  assert.deepEqual(restored, expected, 'known exercises sort stably; extras remain in their relative order at the end')
  restored.forEach((exercise, index) => assert.equal(exercise, expected[index]))
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state(), []))).state.templates.UPPER.exercises, JSON.parse(JSON.stringify(expected)))
})

test('reset changes only the future template, leaving the active workout and history untouched', () => {
  actions().startSession('UPPER')
  const active = state().activeWorkout!
  const historical: Workout = { ...active, completedAt: '2026-10-01T12:00:00Z', sessionNumber: 1 }
  const base = state()
  useStore.setState({ state: { ...base, workouts: [historical], templates: { ...base.templates, UPPER: { ...base.templates.UPPER, exercises: [...base.templates.UPPER.exercises].reverse() } } } })
  const before = state()
  actions().resetTemplateOrder('UPPER')
  assert.equal(state().activeWorkout, active)
  assert.equal(state().workouts, before.workouts)
  assert.equal(state().workouts[0], historical)
  for (const type of WORKOUT_TYPES.filter(type => type !== 'UPPER')) assert.equal(state().templates[type], before.templates[type])
  assert.equal(state().nextWorkoutType, before.nextWorkoutType)
})

test('reset remaps a one-workout alternative by occurrence when its original ID is repeated', () => {
  const base = state()
  const first = base.templates.UPPER.exercises[0]
  const second = base.templates.UPPER.exercises[1]
  const repeated = { ...first, target: { ...first.target, sets: 4, minReps: 15, maxReps: 20 } }
  useStore.setState({ state: { ...base, templates: { ...base.templates, UPPER: { ...base.templates.UPPER, exercises: [second, first, repeated] } } } })
  assert(actions().replacePlannedExercise('UPPER', 2, 'db-bench-press', 'session'))
  assert(actions().replacePlannedExercise('LOWER', 0, 'goblet-squat', 'session'))
  const other = structuredClone(state().sessionReplacements!.LOWER)
  actions().resetTemplateOrder('UPPER')
  assert.equal(state().templates.UPPER.exercises[0], first)
  assert.equal(state().templates.UPPER.exercises[1], repeated)
  assert.deepEqual(state().sessionReplacements!.UPPER, [{ index: 1, fromId: first.exerciseId, exerciseId: 'db-bench-press' }])
  assert.deepEqual(state().sessionReplacements!.LOWER, other)
  const effective = sessionExercises(state(), 'UPPER')
  assert.deepEqual(effective.map(exercise => exercise.exerciseId), ['chest-press', 'db-bench-press', 'lat-pulldown'])
  assert.equal(effective[1].target.sets, 4)
  assert.equal(effective[1].target.minReps, 15)
  assert.equal(effective[1].target.maxReps, 20)
  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.deepEqual(restored.sessionReplacements, state().sessionReplacements)
})

test('reset is a state no-op for canonical order and an empty template, preserving pending choices', () => {
  assert(actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session'))
  const canonical = state()
  actions().resetTemplateOrder('UPPER')
  assert.equal(state(), canonical)
  const empty = { ...state(), templates: { ...state().templates, UPPER: { ...state().templates.UPPER, exercises: [] } }, sessionReplacements: undefined }
  useStore.setState({ state: empty })
  actions().resetTemplateOrder('UPPER')
  assert.equal(state(), empty)
})

test('reset restores the canonical PULL superset and its next-set behavior', () => {
  const original = state().templates.PULL.exercises
  const pairedIndex = original.findIndex(exercise => exercise.supersetWithNext)
  assert.equal(original[pairedIndex].exerciseId, 'reverse-pec-deck')
  assert.equal(original[pairedIndex + 1].exerciseId, 'lateral-raise')
  actions().reorderTemplateExercise('PULL', pairedIndex, original.length - 1)
  actions().resetTemplateOrder('PULL')
  assert.deepEqual(state().templates.PULL.exercises, original)
  actions().startSession('PULL')
  const exercises = state().activeWorkout!.exercises
  assert.equal(exercises[pairedIndex].supersetWithNext, true)
  assert.equal(exercises[pairedIndex + 1].exerciseId, 'lateral-raise')
  actions().completeSet(pairedIndex, 0, { weight: 20, reps: 15 })
  assert.equal(state().activeWorkout!.exercises[pairedIndex].sets[0].completed, true)
  assert.equal(state().activeWorkout!.timer, null, 'first superset exercise flows into its partner instead of starting rest')
  assert.ok(actions().toast!.message.includes(exercises[pairedIndex + 1].name))
})

test('a custom superset keeps its actual partner when moved after the canonical exercises', () => {
  const index = state().templates.PULL.exercises.findIndex(exercise => exercise.exerciseId === 'reverse-pec-deck')
  assert(actions().replaceTemplateExercise('PULL', index, 'db-rear-delt-fly'))
  actions().addTemplateExercise('PULL', 'band-curl')
  const before = state().templates.PULL.exercises
  const head = before[index], partner = before[index + 1], extra = before.at(-1)!
  assert.equal(head.supersetWithNext, true)
  assert.equal(partner.exerciseId, 'lateral-raise')
  actions().resetTemplateOrder('PULL')
  const expected = [...before.filter(exercise => exercise !== head && exercise !== partner && exercise !== extra), head, partner, extra]
  const restored = state().templates.PULL.exercises
  assert.deepEqual(restored, expected, 'the custom pair stays together; its first exercise must not become paired with the unrelated extra')
  restored.forEach((exercise, i) => assert.equal(exercise, expected[i]))
  const pairedIndex = restored.indexOf(head)
  actions().startSession('PULL')
  const exercises = state().activeWorkout!.exercises
  actions().completeSet(pairedIndex, 0, { weight: 10, reps: 15 })
  assert.equal(state().activeWorkout!.exercises[pairedIndex].sets[0].completed, true)
  assert.equal(state().activeWorkout!.timer, null)
  assert.ok(actions().toast!.message.includes(exercises[pairedIndex + 1].name))
  assert.equal(exercises[pairedIndex + 1].exerciseId, 'lateral-raise')
  const canonical = state()
  actions().resetTemplateOrder('PULL')
  assert.equal(state(), canonical, 'custom groups must also have an idempotent default order')
})

test('a canonical superset head keeps a substituted partner instead of pairing with the next ranked exercise', () => {
  const original = state().templates.PULL.exercises
  const index = original.findIndex(exercise => exercise.exerciseId === 'lateral-raise')
  assert(actions().replaceTemplateExercise('PULL', index, 'band-lateral-raise'))
  const head = state().templates.PULL.exercises[index - 1]
  const partner = state().templates.PULL.exercises[index]
  assert.equal(head.exerciseId, 'reverse-pec-deck')
  assert.equal(head.supersetWithNext, true)
  actions().reorderTemplateExercise('PULL', 0, original.length - 1)
  actions().resetTemplateOrder('PULL')
  const restored = state().templates.PULL.exercises
  const pairedIndex = restored.indexOf(head)
  assert.equal(restored[pairedIndex + 1], partner, 'band lateral raise stays paired; preacher curl must not become the partner')
  assert.deepEqual(restored, original.map((exercise, i) => i === index ? partner : exercise))
  actions().startSession('PULL')
  actions().completeSet(pairedIndex, 0, { weight: 20, reps: 15 })
  assert.equal(state().activeWorkout!.exercises[pairedIndex].sets[0].completed, true)
  assert.equal(state().activeWorkout!.timer, null)
  assert.ok(actions().toast!.message.includes(partner.name))
  const canonical = state()
  actions().resetTemplateOrder('PULL')
  assert.equal(state(), canonical)
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
