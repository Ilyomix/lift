import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { addDays } from '../src/lib/date'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { dropAlert, finalizeWorkout, sessionNotes } from '../src/lib/training'
import { upgradeTrainingDiagnostics } from '../src/lib/trainingMigration'
import type { Workout, WorkoutType } from '../src/lib/types'

beforeEach(() => configurePlan(DEFAULT_GOAL))

const exerciseId = 'triceps-overhead-rope'
const range = { minReps: 8, maxReps: 12 }
function workout(n: number, type: WorkoutType, reps = 10): Workout {
  const target = { weight: 20, sets: 2, ...range, restSeconds: 90, rir: '2' }
  return {
    id: `split-${n}`, type, date: addDays('2026-10-05', n - 1), sessionNumber: n,
    startedAt: '', completedAt: '', periodId: 'b1', notes: '',
    exercises: [{
      exerciseId, name: 'Triceps', muscle: 'Triceps', unit: 'kg', target,
      prescription: { ...target, loadFactor: 1, notes: [] },
      sets: Array.from({ length: 2 }, () => ({ weight: 20, reps, cleanReps: reps, rir: 2, completed: true, flags: [], note: '' })),
      notes: '', skipped: false, validated: true, comparison: null,
    }],
  }
}

test('one drop in each split never removes a set; two drops in the same split still do', () => {
  const history: Workout[] = []
  const templates = defaultState().templates
  for (const input of [workout(1, 'UPPER'), workout(2, 'PUSH'), workout(3, 'UPPER', 7), workout(4, 'PUSH', 7)]) {
    const result = finalizeWorkout(history, input, templates)
    history.push(result.workout)
    assert.equal(result.alerts.length, 0, input.id)
    assert.equal(result.changes.filter(c => c.kind === 'sets').length, 0, input.id)
  }
  assert.equal(dropAlert(history, exerciseId, undefined, range), null)
  const secondUpperDrop = finalizeWorkout(history, workout(5, 'UPPER', 4), templates)
  history.push(secondUpperDrop.workout)
  assert.equal(secondUpperDrop.alerts.length, 1)
  assert.equal(secondUpperDrop.changes.filter(c => c.kind === 'sets' && c.type === 'UPPER').length, 1)
  assert.ok(dropAlert(history, exerciseId, undefined, range))
  assert.equal(dropAlert(history, exerciseId, undefined, range, 'PUSH'), null)

  history.push(finalizeWorkout(history, workout(6, 'PUSH', 9), templates).workout)
  assert.equal(dropAlert(history, exerciseId, undefined, range), null, 'default follows the latest matching workout type')
  assert.ok(dropAlert(history, exerciseId, undefined, range, 'UPPER'), 'an explicit type keeps its own history')
})

test('plateaus require four judged workouts in the same split, independently of the other split', () => {
  const history: Workout[] = []
  for (let n = 1; n <= 9; n++) {
    const type = n % 2 ? 'UPPER' : 'PUSH'
    const result = finalizeWorkout(history, workout(n, type, n === 8 ? 12 : 10))
    history.push(result.workout)
    const notes = sessionNotes(history, result.workout)
    assert.deepEqual(notes.plateau, n === 9 ? ['Triceps'] : [], `workout ${n}, ${type}`)
  }
})

test('migration removes a split-mixed reduction while preserving a justified reduction and raw data', () => {
  const state = defaultState()
  state.progressRevision = 3
  for (const input of [workout(1, 'UPPER'), workout(2, 'PUSH'), workout(3, 'UPPER', 7), workout(4, 'PUSH', 7), workout(5, 'UPPER', 4)]) {
    state.workouts.push(finalizeWorkout(state.workouts, input, state.templates).workout)
  }
  const push = state.workouts[3]
  push.changes = [{ id: 'legacy-mixed-reduction', type: 'PUSH', exerciseId, name: 'Triceps', gymId: 'home', date: push.date, kind: 'sets', from: 3, to: 2, text: '1 série de moins' }]
  for (const [type, date] of [['PUSH', push.date], ['UPPER', state.workouts[4].date]] as const) {
    state.templates[type].exercises.find(ex => ex.exerciseId === exerciseId)!.autoAdjust = { sets: -1, since: date, reason: 'baisse 2 séances de suite' }
  }
  const original = structuredClone(state)
  const migrated = upgradeTrainingDiagnostics(state)
  assert.equal(migrated.templates.PUSH.exercises.find(ex => ex.exerciseId === exerciseId)!.autoAdjust, undefined)
  assert.deepEqual(migrated.workouts[3].changes, [])
  assert.deepEqual(migrated.templates.UPPER, original.templates.UPPER, 'a justified same-split reduction stays')
  assert.deepEqual(migrated.workouts[4].changes, original.workouts[4].changes)
  assert.deepEqual(migrated.workouts.map(w => w.exercises.map(({ comparison: _, ...ex }) => ex)), original.workouts.map(w => w.exercises.map(({ comparison: _, ...ex }) => ex)))
  assert.deepEqual(migrated.templates.PUSH.exercises.map(ex => ex.target), original.templates.PUSH.exercises.map(ex => ex.target))
  assert.deepEqual(state, original)
  assert.equal(upgradeTrainingDiagnostics(migrated), migrated)
})

test('migration validates each same-day workout and preserves a justified daily adjustment', () => {
  const state = defaultState()
  state.progressRevision = 3
  for (const [i, reps] of [10, 7, 4, 4].entries()) {
    const input = workout(i + 1, 'UPPER', reps)
    if (i > 0) input.date = '2026-10-06'
    state.workouts.push(finalizeWorkout(state.workouts, input, state.templates).workout)
  }
  const validChange = state.workouts[2].changes!.find(c => c.kind === 'sets')!
  assert.ok(validChange, 'the second drop in the later workout justifies a reduction')
  for (const index of [1, 3]) {
    const w = state.workouts[index]
    w.changes = [{ ...validChange, id: `${w.id}-legacy-invalid`, date: w.date }]
  }
  state.templates.UPPER.exercises.find(ex => ex.exerciseId === exerciseId)!.autoAdjust = {
    sets: -1, since: '2026-10-06', reason: 'baisse 2 séances de suite',
  }
  const original = structuredClone(state)
  const migrated = upgradeTrainingDiagnostics(state)
  assert.deepEqual(migrated.workouts[1].changes, [], 'the first drop cannot borrow support from a later workout')
  assert.deepEqual(migrated.workouts[2].changes, original.workouts[2].changes, 'the exact workout that caused two drops stays justified')
  assert.deepEqual(migrated.workouts[3].changes, [], 'a later stable workout cannot borrow support from the earlier two drops')
  assert.deepEqual(migrated.templates.UPPER, original.templates.UPPER, 'any justified workout that day supports the existing adjustment')
  assert.deepEqual(migrated.workouts.map(w => w.exercises.map(({ comparison: _, ...ex }) => ex)), original.workouts.map(w => w.exercises.map(({ comparison: _, ...ex }) => ex)))
  assert.deepEqual(state, original)
  assert.equal(upgradeTrainingDiagnostics(migrated), migrated)
})

test('repeated pain remains visible across workout types', () => {
  const upper = workout(1, 'UPPER')
  const push = workout(2, 'PUSH')
  upper.exercises[0].sets[0].flags = ['pain']
  push.exercises[0].sets[0].flags = ['pain']
  const notes = sessionNotes([upper, push], push)
  assert.deepEqual(notes.pain, ['Triceps'])
  assert.deepEqual(notes.painAgain, ['Triceps'])
})

test('backdated workout notes cannot use later workouts for plateau or repeated pain', () => {
  const history: Workout[] = []
  for (let n = 1; n <= 5; n++) history.push(finalizeWorkout(history, workout(n, 'UPPER')).workout)
  assert.deepEqual(sessionNotes(history, history[4]).plateau, ['Triceps'])
  assert.deepEqual(sessionNotes(history, history[1]).plateau, [], 'later stable performances cannot create an earlier plateau')

  const backdated = workout(6, 'UPPER')
  backdated.date = '2026-10-04'
  backdated.exercises[0].sets[0].flags = ['pain']
  history[4].exercises[0].sets[0].flags = ['pain']
  assert.deepEqual(sessionNotes(history, backdated), { pain: ['Triceps'], painAgain: [], plateau: [] }, 'a new backdated workout also has no later reference')
})
