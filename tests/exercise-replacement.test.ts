import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState, makeBackup, normalizeState, parseBackup } from '../src/lib/backup'
import { sessionExercises } from '../src/lib/exerciseReplacement'
import { HOME_GYM, loadAt } from '../src/lib/gyms'
import { LIBRARY } from '../src/lib/library'
import { incrementFor } from '../src/lib/program'
import { roundTo } from '../src/lib/format'
import { useStore } from '../src/lib/store'
import type { AppState, TemplateExercise, Unit, Workout, WorkoutExercise } from '../src/lib/types'

const state = () => useStore.getState().state
const actions = () => useStore.getState()
const entry = (id: string, unit: Unit = LIBRARY[id].unit): TemplateExercise => ({
  exerciseId: id, name: LIBRARY[id].name, muscle: LIBRARY[id].muscle, unit, role: LIBRARY[id].role,
  target: { weight: 70, sets: 3, minReps: 8, maxReps: 12, restSeconds: 120, rir: '2' },
})
function historical(id: string, weight: number, gymId = HOME_GYM, unit: Unit = LIBRARY[id].unit, day = '2026-09-20'): Workout {
  const exercise: WorkoutExercise = { ...entry(id, unit), notes: '', skipped: false, validated: true, comparison: null,
    sets: [{ weight, reps: 10, cleanReps: 10, flags: [], note: '', completed: true, rir: 2 }] }
  return { id: `history-${id}-${gymId}-${day}`, type: 'UPPER', sessionNumber: 1, date: day,
    startedAt: `${day}T12:00:00Z`, completedAt: `${day}T13:00:00Z`, notes: '', gymId, exercises: [exercise] }
}
function seed(patch: Partial<AppState> = {}) {
  const s = defaultState()
  s.templates.UPPER = { ...s.templates.UPPER, exercises: [entry('chest-press'), entry('lat-pulldown')] }
  s.templates.LOWER = { ...s.templates.LOWER, exercises: [entry('leg-press'), entry('leg-curl')] }
  useStore.setState({ ready: true, hasData: false, storage: 'memory', state: { ...s, ...patch }, toast: null })
}
beforeEach(() => seed())
afterEach(async () => { await actions().flush() })

test('one-off choices survive backup and are consumed by only their session type', () => {
  assert(actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session'))
  assert(actions().replacePlannedExercise('LOWER', 0, 'goblet-squat', 'session'))
  assert.equal(state().templates.UPPER.exercises[0].exerciseId, 'chest-press')
  assert.equal(sessionExercises(state(), 'UPPER')[0].exerciseId, 'db-bench-press')
  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.deepEqual(restored.sessionReplacements, state().sessionReplacements)
  useStore.setState({ state: restored })
  actions().startSession('UPPER')
  assert.equal(state().activeWorkout!.exercises[0].exerciseId, 'db-bench-press')
  assert.equal(state().activeWorkout!.exercises[0].replacement?.fromId, 'chest-press')
  assert.equal(state().sessionReplacements?.UPPER, undefined)
  assert.equal(state().sessionReplacements?.LOWER?.[0].exerciseId, 'goblet-squat')
  assert.equal(state().templates.UPPER.exercises[0].exerciseId, 'chest-press')
  const active = state().activeWorkout
  actions().startSession('LOWER')
  assert.equal(state().activeWorkout, active, 'an existing session cannot be overwritten while consuming a draft')
  assert(state().sessionReplacements?.LOWER)
})

test('returning to the original removes one draft, including program scope, while preserving other choices', () => {
  actions().replacePlannedExercise('LOWER', 0, 'goblet-squat', 'session')
  const other = state().sessionReplacements!.LOWER
  actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session')
  assert(actions().replacePlannedExercise('UPPER', 0, 'chest-press', 'session'))
  assert.equal(state().sessionReplacements!.UPPER, undefined)
  assert.equal(state().sessionReplacements!.LOWER, other)
  actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session')
  assert(actions().replacePlannedExercise('UPPER', 0, 'chest-press', 'program'))
  assert.equal(state().sessionReplacements!.UPPER, undefined)
  assert.equal(state().sessionReplacements!.LOWER, other)
  assert.equal(actions().replaceTemplateExercise('UPPER', 0, 'chest-press'), false)
})

test('invalid, duplicate and identical choices are true state no-ops', () => {
  const original = state()
  for (const [index, id] of [[-1, 'db-bench-press'], [1.5, 'db-bench-press'], [99, 'db-bench-press'], [0, 'unknown'], [0, 'constructor'], [0, 'chest-press'], [0, 'lat-pulldown']] as const) {
    assert.equal(actions().replacePlannedExercise('UPPER', index, id, 'session'), false)
    assert.equal(actions().replaceTemplateExercise('UPPER', index, id), false)
    assert.equal(state(), original)
  }
  assert.match(actions().toast!.message, /déjà|already/)
  actions().startSession('UPPER')
  const active = state()
  assert.equal(actions().replaceExercise(0, 'lat-pulldown'), false)
  assert.equal(actions().replaceExercise(0, 'chest-press'), false)
  assert.equal(state(), active)
})

test('backup normalization drops stale, corrupt and duplicate drafts after template changes', () => {
  const base = state()
  const dirty = { ...base, sessionReplacements: {
    UPPER: [{ index: 0, fromId: 'old', exerciseId: 'db-bench-press' }, { index: 0, fromId: 'chest-press', exerciseId: 'lat-pulldown' },
      { index: 0, fromId: 'chest-press', exerciseId: 'db-bench-press' }, { index: 0, fromId: 'chest-press', exerciseId: 'push-up' },
      { index: 1, fromId: 'lat-pulldown', exerciseId: '__proto__' }, { index: Infinity, fromId: 'lat-pulldown', exerciseId: 'pull-up' }],
    INVALID: [{ index: 0, fromId: 'chest-press', exerciseId: 'push-up' }],
  } }
  assert.deepEqual(normalizeState(dirty).sessionReplacements, { UPPER: [{ index: 0, fromId: 'chest-press', exerciseId: 'db-bench-press' }] })
  actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session')
  actions().moveTemplateExercise('UPPER', 0, 1)
  assert.equal(sessionExercises(state(), 'UPPER')[0].exerciseId, 'lat-pulldown')
  assert.equal(normalizeState(state()).sessionReplacements, undefined)
})

test('durable future replacement leaves completed active and historical sessions untouched', () => {
  seed({ workouts: [historical('chest-press', 80)] })
  actions().startSession('UPPER')
  const active = structuredClone(state().activeWorkout!)
  active.exercises[0].sets[0].completed = true
  useStore.setState({ state: { ...state(), activeWorkout: active } })
  const before = state()
  assert.equal(actions().replaceExercise(0, 'db-bench-press', 'program'), false)
  assert.equal(state(), before)
  assert(actions().replaceTemplateExercise('UPPER', 0, 'db-bench-press'))
  assert.equal(state().templates.UPPER.exercises[0].exerciseId, 'db-bench-press')
  assert.equal(state().activeWorkout, active)
  assert.equal(state().workouts, before.workouts)
  assert.equal(normalizeState(state()).templates.UPPER.exercises[0].exerciseId, 'db-bench-press')
})

test('active program scope commits both changes atomically and clears old metadata and unfinished entries', () => {
  actions().startSession('UPPER')
  const active = structuredClone(state().activeWorkout!), old = active.exercises[0]
  Object.assign(old, { technique: 'old technique', nextTarget: 'old target', note: 'old note', notes: 'old session note', skipped: true, skipReason: 'old reason', calibration: true,
    autoAdjust: { sets: -1, since: '2026-10-01', reason: 'old' }, gymLoads: { elsewhere: 999 }, comparisonContext: 'old context', gymTrial: { fromGym: 'old', weight: 999 }, hint: { text: 'old', from: 1, to: 999, sets: [0] } })
  old.sets[0] = { weight: 999, reps: 9, cleanReps: 8, flags: ['pain'], note: 'old', completed: false, rir: 0 }
  useStore.setState({ state: { ...state(), activeWorkout: active } })
  assert(actions().replaceExercise(0, 'db-bench-press', 'program'))
  const changed = state().activeWorkout!.exercises[0]
  assert.equal(state().templates.UPPER.exercises[0].exerciseId, changed.exerciseId)
  assert.equal(changed.unit, 'kg/main'); assert.equal(changed.target.weight, null)
  assert.equal(changed.notes, ''); assert.equal(changed.skipped, false); assert.equal(changed.comparison, null)
  for (const key of ['technique', 'note', 'skipReason', 'calibration', 'autoAdjust', 'gymLoads', 'comparisonContext', 'gymTrial', 'hint', 'replacement'] as const) assert.equal(changed[key], undefined, key)
  assert.notEqual(changed.nextTarget, 'old target')
  assert(changed.sets.every(set => set.weight === null && set.reps === null && set.cleanReps === null && set.note === '' && set.flags.length === 0 && set.rir === null && !set.completed))
  assert.equal(state().activeWorkout!.exercises[1], active.exercises[1])
})

test('program conflicts reject active replacement before either snapshot changes', () => {
  actions().startSession('UPPER')
  actions().replaceTemplateExercise('UPPER', 0, 'push-up')
  const before = state()
  assert.equal(actions().replaceExercise(0, 'db-bench-press', 'program'), false)
  assert.equal(state(), before)
  assert.match(actions().toast!.message, /changé|changed/)
})

test('a reopened session cannot replace the current program even before its sets are completed', () => {
  actions().startSession('UPPER')
  const active = { ...state().activeWorkout!, reopened: { completedAt: '2026-09-20T13:00:00Z' } }
  useStore.setState({ state: { ...state(), activeWorkout: active } })
  const before = state()
  assert.equal(actions().replaceExercise(0, 'db-bench-press', 'program'), false)
  assert.equal(state(), before)
  assert.equal(state().activeWorkout, active)
  assert.equal(state().templates.UPPER.exercises[0].exerciseId, 'chest-press')
})

test('restoring the program original cannot duplicate another slot’s effective one-off choice', () => {
  assert(actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session'))
  assert(actions().replacePlannedExercise('UPPER', 1, 'chest-press', 'session'))
  const before = state()
  assert.deepEqual(sessionExercises(before, 'UPPER').map(ex => ex.exerciseId), ['db-bench-press', 'chest-press'])
  assert.equal(actions().replacePlannedExercise('UPPER', 0, 'chest-press', 'program'), false)
  assert.equal(state(), before)
  assert.equal(actions().replaceTemplateExercise('UPPER', 0, 'chest-press'), false)
  assert.equal(state(), before)
  assert.match(actions().toast!.message, /déjà|already/)
})

test('replacement loads use target history at the same gym and unit, with deload scaling and increment rounding', () => {
  seed({ gymId: 'second', gyms: [{ id: HOME_GYM, name: 'Main' }, { id: 'second', name: 'Second' }], workouts: [
    historical('chest-supported-row', 100, HOME_GYM), historical('chest-supported-row', 37, 'second'),
    historical('chest-supported-row', 500, 'second', 'kg/main', '2026-09-21'),
  ] })
  actions().startSession('UPPER')
  const active = structuredClone(state().activeWorkout!)
  active.exercises[0].prescription!.loadFactor = .7
  useStore.setState({ state: { ...state(), activeWorkout: active } })
  assert(actions().replaceExercise(0, 'chest-supported-row'))
  const changed = state().activeWorkout!.exercises[0], increment = incrementFor(changed)
  const expected = Math.max(increment, roundTo(37 * .7, increment))
  assert.equal(loadAt(changed, 'second'), 37)
  assert.equal(changed.prescription!.weight, expected)
  assert(changed.sets.every(set => set.weight === expected))
  assert.equal(changed.gymTrial, undefined)
})

test('a one-off replacement without local compatible history never imports another unit or gym', () => {
  seed({ workouts: [historical('db-bench-press', 900, HOME_GYM, 'kg'), historical('db-bench-press', 60, 'elsewhere')] })
  actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session')
  actions().startSession('UPPER')
  const ex = state().activeWorkout!.exercises[0]
  assert.equal(ex.target.weight, null)
  assert(ex.sets.every(set => set.weight === null))
})

test('normal sessions share free-weight history between gyms while keeping units and load factors correct', () => {
  seed({ workouts: [historical('db-bench-press', 30, 'elsewhere'), historical('db-bench-press', 900, HOME_GYM, 'kg', '2026-09-21')] })
  const s = state(), exercise = entry('db-bench-press')
  exercise.target.weight = null
  s.templates.UPPER.exercises[0] = exercise
  actions().startSession('UPPER')
  const active = state().activeWorkout!.exercises[0]
  const increment = incrementFor(active), factor = active.prescription!.loadFactor
  const expected = factor < 1 ? Math.max(increment, roundTo(30 * factor, increment)) : 30
  assert.equal(active.prescription!.weight, expected)
  assert(active.sets.every(set => set.weight === expected))
})

test('normal machine sessions do not borrow another gym’s historical load', () => {
  seed({ workouts: [historical('chest-press', 90, 'elsewhere')] })
  state().templates.UPPER.exercises[0].target.weight = null
  actions().startSession('UPPER')
  assert(state().activeWorkout!.exercises[0].sets.every(set => set.weight === null))
})

test('replacement retains the slot dose, priority and superset rules, not exercise-specific adjustments', () => {
  const s = state(), original = s.templates.UPPER.exercises[0]
  original.focus = true; original.volumeTag = 'priority'; original.supersetWithNext = true
  original.autoAdjust = { sets: -1, since: '2026-10-01', reason: 'old fatigue' }
  actions().replacePlannedExercise('UPPER', 0, 'db-bench-press', 'session')
  const next = sessionExercises(state(), 'UPPER')[0]
  assert.deepEqual({ ...next.target, weight: original.target.weight }, original.target)
  assert.equal(next.focus, true); assert.equal(next.volumeTag, 'priority'); assert.equal(next.supersetWithNext, true)
  assert.equal(next.autoAdjust, undefined)
})
