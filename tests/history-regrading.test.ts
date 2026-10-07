import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { finishedState, reopenedState, withoutWorkout } from '../src/lib/training'
import { TRAINING_REVISION } from '../src/lib/trainingMigration'
import type { AppState } from '../src/lib/types'

beforeEach(() => configurePlan(DEFAULT_GOAL))

function base(): AppState {
  const state = defaultState()
  state.progressRevision = TRAINING_REVISION
  state.templates.LOWER.exercises.find(ex => ex.exerciseId === 'leg-press')!.target.weight = 100
  return state
}

function finish(state: AppState, id: string, date: string, reps: number[]): AppState {
  const template = state.templates.LOWER.exercises.find(ex => ex.exerciseId === 'leg-press')!
  return finishedState({ ...state, activeWorkout: {
    id, type: 'LOWER', date, startedAt: `${date}T10:00:00Z`, notes: '', timer: null, timerEndAt: null, periodId: 'b1',
    exercises: [{ ...template, prescription: { ...template.target, weight: 100, rir: '2', loadFactor: 1, notes: [] },
      sets: reps.map(n => ({ weight: 100, reps: n, cleanReps: n, rir: 2, flags: [], note: '', completed: true })),
      notes: '', skipped: false, validated: false, comparison: null }],
  } }, `${date}T11:00:00Z`, date)!.state
}

test('deleting a baseline regrades later history and removes only unsupported volume reductions', () => {
  let state = base()
  for (const [i, reps] of [[11, 11, 10], [10, 10, 9], [9, 9, 8]].entries()) {
    state = finish(state, `w${i}`, `2026-10-${String(6 + i * 7).padStart(2, '0')}`, reps)
  }
  const target = state.templates.LOWER.exercises.find(ex => ex.exerciseId === 'leg-press')!
  assert.equal(target.autoAdjust?.sets, -1)
  const last = state.workouts[2]
  const original = structuredClone(state)
  const updated = withoutWorkout(state, 'w1', '2026-10-21')
  const after = updated.workouts.find(w => w.id === last.id)!
  assert.equal(after.exercises[0].comparison!.status, 'deload', 'the remaining reference is now separated by a two-week break')
  assert.equal(after.changes!.some(c => c.kind === 'sets'), false)
  assert.equal(updated.templates.LOWER.exercises.find(ex => ex.exerciseId === 'leg-press')!.autoAdjust, undefined)
  assert.deepEqual(updated.templates.LOWER.exercises.find(ex => ex.exerciseId === 'leg-press')!.target, target.target)
  assert.deepEqual(after.exercises[0].sets, last.exercises[0].sets)
  assert.deepEqual(state, original)
})

test('backdated additions and corrections refresh subsequent comparisons without changing logged sets', () => {
  for (const correction of [false, true]) {
    let state = finish(base(), 'later', '2026-10-13', [11, 11, 11])
    if (correction) {
      state = finish(state, 'earlier', '2026-10-20', [10, 10, 10])
      state = reopenedState(state, 'earlier')!
      state.activeWorkout!.date = '2026-10-06'
      state = finishedState(state, '2026-10-21T11:00:00Z', '2026-10-21')!.state
    } else {
      state = finish(state, 'earlier', '2026-10-06', [10, 10, 10])
    }
    const later = state.workouts.find(w => w.id === 'later')!
    assert.equal(later.exercises[0].comparison!.status, 'progress', correction ? 'redated correction' : 'backdated addition')
    assert.equal(later.exercises[0].comparison!.deltaCleanReps, 3)
    assert.deepEqual(later.exercises[0].sets.map(s => s.reps), [11, 11, 11])
  }
})
