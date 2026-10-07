import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { appliedState, changeState, finishedState, revertedState } from '../src/lib/training'
import type { AppState, WorkoutType } from '../src/lib/types'

beforeEach(() => configurePlan(DEFAULT_GOAL))

const exerciseId = 'leg-curl'
const load = (state: AppState, type: WorkoutType) => state.templates[type].exercises.find(e => e.exerciseId === exerciseId)!.target.weight
function state(legsWeight: number): AppState {
  const base = defaultState()
  for (const [type, weight] of [['LOWER', 40], ['LEGS', legsWeight]] as const) {
    base.templates[type].exercises = base.templates[type].exercises.map(e => e.exerciseId === exerciseId ? { ...e, target: { ...e.target, weight } } : e)
  }
  return base
}
function finish(before: AppState, type: WorkoutType, id: string, date: string, reps: number): AppState {
  const exercise = before.templates[type].exercises.find(e => e.exerciseId === exerciseId)!
  const workout = {
    id, type, date, startedAt: `${date}T10:00:00Z`, notes: '', timer: null, timerEndAt: null,
    exercises: [{
      ...exercise, notes: '', skipped: false, validated: false, comparison: null,
      prescription: { ...exercise.target, rir: '2', weight: exercise.target.weight ?? null, loadFactor: 1, notes: [] },
      sets: Array.from({ length: exercise.target.sets }, () => ({ weight: exercise.target.weight ?? null, reps, cleanReps: reps, rir: 2, flags: [], note: '', completed: true })),
    }],
  }
  return finishedState({ ...before, activeWorkout: workout }, `${date}T11:00:00Z`, date)!.state
}

test('a later independent split keeps the original load adjustment available to undo and reapply', () => {
  const lower = finish(state(45), 'LOWER', 'lower', '2026-10-06', 15)
  const original = lower.workouts[0]
  const change = original.changes![0]
  assert.equal(change.also, undefined, 'the different LEGS load was never moved')
  assert.deepEqual([load(lower, 'LOWER'), load(lower, 'LEGS')], [42.5, 45])
  const later = finish(lower, 'LEGS', 'legs', '2026-10-07', 12)
  assert.equal(changeState(later.templates, change, original, later.workouts, '2026-10-07'), 'applied')
  const undone = revertedState(later, change.id, '2026-10-07')
  assert.deepEqual([load(undone, 'LOWER'), load(undone, 'LEGS')], [40, 45])
  const reapplied = appliedState(undone, [change.id], '2026-10-07T12:00:00Z', '2026-10-07')
  assert.deepEqual([load(reapplied, 'LOWER'), load(reapplied, 'LEGS')], [42.5, 45])
})

test('a later workout on the same or genuinely shared sheet still supersedes its load adjustment', () => {
  for (const type of ['LOWER', 'LEGS'] as const) {
    const lower = finish(state(40), 'LOWER', 'lower', '2026-10-06', 15)
    const original = lower.workouts[0]
    const change = original.changes![0]
    assert.deepEqual(change.also, ['LEGS'])
    const later = finish(lower, type, 'later', '2026-10-07', 12)
    assert.equal(changeState(later.templates, change, original, later.workouts, '2026-10-07'), 'gone', type)
    assert.equal(revertedState(later, change.id, '2026-10-07'), later)
    assert.deepEqual([load(later, 'LOWER'), load(later, 'LEGS')], [42.5, 42.5])
  }
})

// The real store path matters here: unchecking a completed set used to retain its derived load.
const { useStore } = await import('../src/lib/store')
function prepareActive() {
  const base = defaultState()
  const exercise = base.templates.LOWER.exercises.find(e => e.exerciseId === 'leg-press')!
  useStore.setState({ ready: true, hasData: false, storage: 'memory', state: {
    ...base, prefs: { ...base.prefs, autoLoad: true, push: false },
    activeWorkout: {
      id: 'active', type: 'LOWER', date: '2026-10-07', startedAt: '2026-10-07T10:00:00Z', notes: '', timer: null, timerEndAt: null,
      exercises: [{ ...exercise, notes: '', skipped: false, validated: false, comparison: null,
        target: { ...exercise.target, weight: 100, minReps: 8, maxReps: 12, sets: 4 },
        prescription: { ...exercise.target, weight: 100, minReps: 8, maxReps: 12, sets: 4, rir: '2', loadFactor: 1, notes: [] },
        sets: Array.from({ length: 4 }, () => ({ weight: 100, reps: null, cleanReps: null, rir: 2, flags: [], note: '', completed: false })),
      }],
    },
  } })
}
const actions = () => useStore.getState()
const activeExercise = () => actions().state.activeWorkout!.exercises[0]
const toggle = (index: number) => actions().completeSet(0, index, { weight: 100, reps: null })

test('correcting the adjustment source restores only pending untouched loads before recomputing', async () => {
  prepareActive()
  try {
    actions().updateSet(0, 0, { reps: 2 })
    toggle(0)
    assert.equal(activeExercise().hint?.sourceSet, 0)
    assert.deepEqual(activeExercise().sets.map(s => s.weight), [100, 90, 90, 90])
    actions().updateSet(0, 2, { weight: 95 }) // Manually chosen next load.
    actions().updateSet(0, 3, { reps: 10 })
    toggle(3) // Work can be logged out of order; the recorded load must stay.
    toggle(0)
    assert.equal(activeExercise().hint, undefined)
    assert.deepEqual(activeExercise().sets.map(s => s.weight), [100, 100, 95, 90])
    actions().updateSet(0, 0, { reps: 10 })
    toggle(0)
    assert.equal(activeExercise().hint, undefined)
    assert.deepEqual(activeExercise().sets.map(s => s.weight), [100, 100, 95, 90])
    assert.equal(activeExercise().sets[3].completed, true)
  } finally { await actions().flush() }
})

test('unchecking another set or a legacy adjustment with no source does not revoke the suggestion', async () => {
  for (const legacy of [false, true]) {
    prepareActive()
    try {
      actions().updateSet(0, 0, { reps: 10 }); toggle(0)
      actions().updateSet(0, 1, { reps: 2 }); toggle(1)
      assert.equal(activeExercise().hint?.sourceSet, 1, 'source follows the validated row, not exercise order')
      if (legacy) {
        const { sourceSet: _source, ...hint } = activeExercise().hint!
        const state = actions().state
        useStore.setState({ state: { ...state, activeWorkout: { ...state.activeWorkout!, exercises: [{ ...activeExercise(), hint }] } } })
      }
      const hint = activeExercise().hint
      toggle(legacy ? 1 : 0)
      assert.equal(activeExercise().hint, hint)
      assert.deepEqual(activeExercise().sets.map(s => s.weight), [100, 100, 90, 90])
    } finally { await actions().flush() }
  }
})

test('deleting an earlier session discards the cached finish summary and uses recalculated history', async () => {
  const first = finish(state(45), 'LOWER', 'first', '2026-10-06', 10)
  const later = finish(first, 'LOWER', 'later', '2026-10-07', 11).workouts.find(w => w.id === 'later')!
  useStore.setState({ ready: true, hasData: false, storage: 'memory', lastFinish: null, state: {
    ...first, prefs: { ...first.prefs, push: false }, activeWorkout: { ...later, timer: null, timerEndAt: null },
  } })
  try {
    assert.equal(actions().finishSession(), 'later')
    assert.equal(actions().lastFinish!.workout.exercises[0].comparison!.status, 'progress')
    actions().deleteWorkout('first')
    assert.equal(actions().lastFinish, null)
    assert.equal(actions().state.workouts.length, 1)
    assert.equal(actions().state.workouts[0].exercises[0].comparison!.status, 'new-baseline')
  } finally { await actions().flush() }
})
