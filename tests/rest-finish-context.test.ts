import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { finishedState, reopenedState } from '../src/lib/training'
import type { AppState } from '../src/lib/types'

beforeEach(() => configurePlan(DEFAULT_GOAL))

function inProgress(date: string): AppState {
  const state = defaultState()
  const exercise = state.templates.UPPER.exercises[0]
  return {
    ...state,
    activeWorkout: {
      id: 'current', type: 'UPPER', date, startedAt: `${date}T22:30:00Z`,
      notes: '', timerEndAt: null, timer: null,
      exercises: [{ ...exercise, notes: '', skipped: false, validated: true, comparison: null,
        sets: [{ weight: 20, reps: 8, cleanReps: 8, rir: 2, flags: [], note: '', completed: true }] }],
    },
  }
}

test('finishing on scheduled rest requests a choice once, using the workout date even across midnight', () => {
  for (const [date, finishDate, expected] of [
    ['2026-10-07', '2026-10-07', true],
    ['2026-10-07', '2026-10-08', true],
    ['2026-10-08', '2026-10-08', false],
  ] as const) {
    const before = inProgress(date)
    const snapshot = structuredClone(before)
    const done = finishedState(before, `${finishDate}T23:30:00Z`, finishDate)!
    assert.equal(done.result.trainedOnRestDay, expected, `${date} finished ${finishDate}`)
    assert.equal('trainedOnRestDay' in done.result.workout, false, 'not stored on the workout')
    assert.equal('trainedOnRestDay' in done.state, false, 'not persisted on app state')
    assert.deepEqual(before, snapshot, 'checking the schedule never rewrites history')
    const reopened = reopenedState(done.state, done.result.workout.id)!
    assert.equal(finishedState(reopened, `${finishDate}T23:40:00Z`, finishDate)!.result.trainedOnRestDay, false,
      'correcting the completed workout does not ask again')
  }
})

test('a paused program is not treated as a scheduled rest day', () => {
  const state = inProgress('2026-10-07')
  state.programPause = { active: true, startedAt: '2026-10-06T12:00:00Z', plannedEnd: null, history: [] }
  assert.equal(finishedState(state, '2026-10-07T23:30:00Z', '2026-10-07')!.result.trainedOnRestDay, false)
})
