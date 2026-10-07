import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { scheduledExercises } from '../src/lib/exerciseReplacement'
import { configurePlan, DEFAULT_GOAL, PERIODS, prescribeSession, projectSessions } from '../src/lib/program'

afterEach(() => configurePlan(DEFAULT_GOAL))

test('dated workout details retain their prescription and scope temporary alternatives to one occurrence', () => {
  configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-09-28', foundation: null })
  const state = defaultState()
  const today = '2026-10-11'
  const projection = projectSessions(state, DEFAULT_GOAL, today)
  const upper = projection.filter(item => item.type === 'UPPER')
  const first = upper[0], later = upper[1]
  state.sessionReplacements = { UPPER: [{ index: 0, fromId: state.templates.UPPER.exercises[0].exerciseId, exerciseId: 'db-bench-press' }] }
  const exercises = scheduledExercises(state, 'UPPER', first.date, projection)
  assert.equal(exercises[0].exerciseId, 'db-bench-press')
  assert.equal(scheduledExercises(state, 'UPPER', later.date, projection)[0].exerciseId, state.templates.UPPER.exercises[0].exerciseId)
  const onDate = prescribeSession(exercises, first.date, state.reentry, state.gymId, state.workouts, today)
  const now = prescribeSession(exercises, today, state.reentry, state.gymId, state.workouts, today)
  assert.notEqual(onDate[0].rir, now[0].rir, 'tomorrow crosses the effort boundary; showing today would mislead')
  const deload = PERIODS.find(period => period.kind === 'deload')!
  const lighter = prescribeSession(exercises, deload.start, state.reentry, state.gymId, state.workouts, today)
  assert.ok(lighter[0].sets < onDate[0].sets, 'the selected deload date uses reduced sets')
})
