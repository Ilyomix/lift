import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState, normalizeState } from '../src/lib/backup'
import { configurePlan, DEFAULT_GOAL, isValidGoal, PERIODS, prescribeSession } from '../src/lib/program'
import { proteinTargetFor } from '../src/lib/stats'
import { lang, setLang } from '../src/lib/i18n'
import { averageRir, baselineFor, compareExercise, exerciseHistory, finalizeWorkout, intraSessionAdjust, knownLoads, strengthSummary } from '../src/lib/training'
import { TRAINING_REVISION, upgradeTrainingDiagnostics } from '../src/lib/trainingMigration'
import { localizeComparison } from '../src/lib/trainingMessages'
import { todayISO } from '../src/lib/date'
import { useStore } from '../src/lib/store'
import type { Workout } from '../src/lib/types'

beforeEach(() => configurePlan(DEFAULT_GOAL))
afterEach(() => configurePlan(DEFAULT_GOAL))

test('a lighter prescription cannot raise small loads or add weight to unloaded bodyweight work', () => {
  const state = defaultState()
  const deload = PERIODS.find(p => p.kind === 'deload')!.start
  const regular = PERIODS.find(p => p.kind === 'block')!.start
  const exercises = [state.templates.UPPER.exercises.find(ex => ex.exerciseId === 'lateral-raise')!, state.templates.UPPER.exercises.find(ex => ex.exerciseId === 'dips')!]
  for (const template of exercises) for (const weight of [0, 0.5, 1, 2, 2.5, 20]) {
    const ex = { ...template, target: { ...template.target, weight } }
    const before = structuredClone(ex)
    for (const prescription of [
      prescribeSession([ex], deload, null)[0],
      prescribeSession([ex], regular, { sessionsLeft: 2, days: 10, setsFactor: 1, loadFactor: 0.9, rir: '3', label: '', advice: '' })[0],
    ]) {
      assert.ok(prescription.loadFactor < 1)
      assert.ok(prescription.weight! <= weight, `${ex.exerciseId}: reduced ${weight} must not become ${prescription.weight}`)
      assert.ok(prescription.weight! >= 0)
    }
    assert.deepEqual(ex, before, 'prescribing does not edit the template')
  }
})

function performance(n: number, weight: number, unit: 'kg' | 'kg/main', comparisonContext: string): Workout {
  return { id: `summary-${n}`, date: `2026-10-${String(n).padStart(2, '0')}`, type: 'UPPER', sessionNumber: n,
    startedAt: '', completedAt: '', notes: '', exercises: [{
      exerciseId: 'chest-press', name: 'Chest press', muscle: 'Chest', role: 'compound', unit, comparisonContext,
      target: { weight, sets: 2, minReps: 8, maxReps: 12, restSeconds: 120, rir: '2' },
      sets: Array.from({ length: 2 }, () => ({ weight, reps: 10, cleanReps: 10, completed: true, flags: [], note: '', rir: 2 })),
      skipped: false, validated: true, comparison: null, notes: '',
    }] }
}

test('the strength summary compares one unit and normalized machine context at a time', () => {
  for (const axis of ['unit', 'machine'] as const) {
    const workouts = [
      performance(1, 80, 'kg', axis === 'machine' ? 'machine A' : ''),
      performance(2, 20, axis === 'unit' ? 'kg/main' : 'kg', axis === 'machine' ? ' Machine B ' : ''),
      performance(3, 22, axis === 'unit' ? 'kg/main' : 'kg', axis === 'machine' ? 'machine b' : ''),
    ]
    if (axis === 'unit') for (const workout of workouts) workout.exercises[0].exerciseId = 'romanian-deadlift'
    const before = structuredClone(workouts)
    const summary = strengthSummary(workouts, defaultState().templates)
    assert.equal(summary.lifts, 1)
    assert.ok(Math.abs(summary.avg! - 0.1) < 1e-9, `${axis}: expected +10% in comparable history, got ${summary.avg}`)
    assert.deepEqual(workouts, before)
  }
})

test('a fixed protein target remains fixed in every phase, including a cut', () => {
  const state = defaultState()
  state.nutritionTargets = { ...state.nutritionTargets, adaptive: false, proteinMin: 100, proteinMax: 110 }
  const before = structuredClone(state)
  for (const period of PERIODS) {
    assert.deepEqual(proteinTargetFor(state, period.start), { min: 100, max: 110, weight: null, perKg: null }, period.phase)
  }
  state.nutritionTargets.adaptive = true
  for (const period of PERIODS) {
    assert.deepEqual(proteinTargetFor(state, period.start), { min: 100, max: 110, weight: null, perKg: null }, `no weigh-ins: ${period.phase}`)
  }
  state.nutritionTargets.adaptive = false
  assert.deepEqual(state, before)
})

test('average reserve uses the recorded effort rules and only completed work', () => {
  const workout = performance(1, 20, 'kg', '')
  workout.exercises[0].sets[0].flags = ['failure']
  workout.exercises[0].sets[0].rir = 3
  workout.exercises[0].sets[1].rir = 2
  const skipped = structuredClone(workout.exercises[0])
  skipped.skipped = true
  skipped.sets.forEach(set => { set.flags = []; set.rir = 8 })
  workout.exercises.push(skipped)
  workout.exercises[0].sets.push({ ...workout.exercises[0].sets[1], reps: 0, rir: 10 })
  workout.exercises[0].sets.push({ ...workout.exercises[0].sets[1], rir: 11 })
  const before = structuredClone(workout)
  assert.equal(averageRir(workout), 1)
  assert.deepEqual(workout, before)
})

test('goal dates must exist on the calendar, including when loaded from settings', () => {
  for (const date of ['2027-02-29', '2030-02-31', '2027-04-31', '2027-13-01']) assert.equal(isValidGoal(date), false, date)
  assert.equal(isValidGoal('2028-02-29'), true)
  assert.equal(isValidGoal('2027-02-28'), true)
  const state = defaultState()
  state.settings.goalDate = '2030-02-31'
  assert.notEqual(normalizeState(state).settings.goalDate, '2030-02-31')
})

test('a failed trial below the usual equipment increment never increases its starting load', () => {
  const exercise = performance(1, 0.5, 'kg', '').exercises[0]
  exercise.exerciseId = 'lateral-raise'
  exercise.target.weight = null
  exercise.sets.forEach(set => { set.reps = set.cleanReps = 1 })
  assert.equal(baselineFor(exercise)?.weight, 0.5)
})

test('equipment increments use loads from the current unit and normalized conditions', () => {
  const previous = performance(1, 20.5, 'kg', 'Machine A')
  const current = performance(2, 22.5, 'kg', ' Machine B ').exercises[0]
  const compatible = performance(3, 21.2, 'kg', 'machine b')
  const otherUnit = performance(4, 19.1, 'kg/main', 'machine b')
  const inputs = [previous, compatible, otherUnit]
  const before = structuredClone(inputs)
  assert.deepEqual(knownLoads(inputs, current.exerciseId, 'main', current), [21.2])
  current.sets[0].reps = current.sets[0].cleanReps = 5
  current.sets[1].completed = false
  assert.equal(intraSessionAdjust(current, 0, knownLoads([previous], current.exerciseId, 'main', current))?.weight, 20)
  assert.deepEqual(inputs, before)
})

test('missing loads retain the log but cannot become an estimated drop, a record or a strength trend', () => {
  const previous = performance(1, 80, 'kg', '')
  const missing = performance(2, 80, 'kg', '')
  missing.exercises[0].sets.forEach(set => { set.weight = null })
  const next = performance(3, 82.5, 'kg', '')
  const old = structuredClone([previous, missing, next])
  const compare = compareExercise(missing.exercises[0], previous.exercises[0], exerciseHistory([previous], 'chest-press'), false)
  assert.equal(compare.marked, false)
  assert.equal(compare.isRecord, false)
  assert.match(compare.headline, /COMPARAISON INDISPONIBLE|COMPARISON UNAVAILABLE/)
  assert.equal(compareExercise(next.exercises[0], missing.exercises[0], exerciseHistory([missing], 'chest-press'), false).isRecord, false)
  const history = exerciseHistory([previous, next, missing], 'chest-press')
  assert.equal(history.length, 3, 'the missing-load session remains in raw history')
  assert.equal(history.find(h => h.workoutId === missing.id)!.bestSet, null)
  assert.equal(strengthSummary([previous, missing], defaultState().templates).avg, null)
  assert.ok(Math.abs(strengthSummary([previous, missing, next], defaultState().templates).avg! - 0.03125) < 1e-9)
  assert.deepEqual([previous, missing, next], old)
  const bodyweight = structuredClone(missing.exercises[0])
  bodyweight.unit = 'PDC'
  assert.equal(exerciseHistory([{ ...missing, exercises: [bodyweight] }], 'chest-press')[0].best, 10, 'unloaded bodyweight work is still a measured result')
  const different = structuredClone(next)
  different.exercises[0].unit = 'kg/main'
  assert.equal(finalizeWorkout([missing], different).workout.exercises[0].comparison!.contextReason, 'unit-changed', 'a missing previous load cannot hide incompatible equipment')
  const originalLanguage = lang()
  try {
    setLang('fr')
    const french = localizeComparison(compare)
    assert.equal(french.headline, 'COMPARAISON INDISPONIBLE')
    setLang('en')
    assert.equal(localizeComparison(french).headline, 'COMPARISON UNAVAILABLE')
    assert.match(localizeComparison(french).detail, /^A load is missing/)
  } finally { setLang(originalLanguage) }
})

test('revision five recalculates missing-load diagnostics without altering recorded loads or targets', () => {
  const state = defaultState()
  const prior = performance(1, 80, 'kg', '')
  const missing = performance(2, 80, 'kg', '')
  missing.exercises[0].sets.forEach(set => { set.weight = null })
  const legacy = finalizeWorkout([prior], missing).workout
  legacy.exercises[0].comparison = { ...legacy.exercises[0].comparison!, status: 'down', marked: true, headline: 'ESTIMATED LEVEL −91%' }
  state.workouts = [prior, legacy]
  state.progressRevision = 4
  const observed = state.workouts.map(w => w.exercises.map(ex => structuredClone(ex.sets)))
  const targets = structuredClone(state.templates)
  const updated = upgradeTrainingDiagnostics(state)
  assert.equal(TRAINING_REVISION, 5)
  assert.equal(updated.progressRevision, 5)
  assert.equal(updated.workouts[1].exercises[0].comparison!.marked, false)
  assert.deepEqual(updated.workouts.map(w => w.exercises.map(ex => ex.sets)), observed)
  assert.deepEqual(updated.templates, targets)
})

test('starting a deload uses the same bounded small load as its prescription', async () => {
  const original = useStore.getState()
  try {
    const state = defaultState()
    state.prefs.push = false
    const template = state.templates.UPPER.exercises.find(ex => ex.exerciseId === 'lateral-raise')!
    template.target.weight = 0.5
    state.templates.UPPER.exercises = [template]
    state.manualDeload = { start: todayISO(), end: todayISO() }
    useStore.setState({ state, ready: true, hasData: false, storage: 'memory' })
    useStore.getState().update(s => s)
    useStore.getState().startSession('UPPER')
    const exercise = useStore.getState().state.activeWorkout!.exercises[0]
    assert.equal(exercise.prescription!.loadFactor, 0.9)
    assert.equal(exercise.prescription!.weight, 0.5)
    assert.ok(exercise.sets.every(set => set.weight === 0.5))
    assert.equal(template.target.weight, 0.5)
  } finally { await useStore.getState().flush(); useStore.setState(original, true) }
})

test('an active backdated workout cannot borrow equipment increments from future or incompatible logs', async () => {
  const original = useStore.getState()
  try {
    for (const kind of ['future', 'unit', 'machine'] as const) {
      const state = defaultState()
      const old = performance(kind === 'future' ? 3 : 1, 20.5, kind === 'unit' ? 'kg/main' : 'kg', kind === 'machine' ? 'Machine A' : 'Machine B')
      const current = performance(2, 22.5, 'kg', 'Machine B')
      current.exercises[0].sets.forEach(set => { set.completed = false; set.reps = set.cleanReps = 5 })
      state.workouts = [old]
      state.activeWorkout = { ...current, timer: null, timerEndAt: null, reopened: { completedAt: null } }
      state.prefs.autoLoad = true
      state.prefs.push = false
      useStore.setState({ state, ready: true, hasData: false, storage: 'memory' })
      useStore.getState().completeSet(0, 0, { weight: 22.5, reps: 5 })
      const result = useStore.getState().state
      assert.equal(result.activeWorkout!.exercises[0].sets[1].weight, 20, kind)
      assert.deepEqual(result.workouts, [old])
    }
  } finally { await useStore.getState().flush(); useStore.setState(original, true) }
})
