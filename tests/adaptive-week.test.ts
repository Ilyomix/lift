import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { addDays } from '../src/lib/date'
import { calendarMonth, configurePlan, DEFAULT_GOAL, isRestDay, PERIODS, projectSessions, weekSchedule } from '../src/lib/program'
import type { ActiveWorkout, AppState, Workout } from '../src/lib/types'

const MONDAY = '2026-10-05'
const TODAY = '2026-10-07'
const SUNDAY = '2026-10-11'
const END = '2026-12-23'
const finished = (date: string, id = date): Workout => ({
  id, sessionNumber: 1, type: 'UPPER', date, startedAt: `${date}T10:00:00`,
  completedAt: `${date}T11:00:00`, notes: '', exercises: [],
})
const active = (date = TODAY, id = 'active'): ActiveWorkout => ({
  id, type: 'PUSH', date, startedAt: `${date}T10:00:00`, notes: '', exercises: [], timer: null, timerEndAt: null,
})
const threeDays = (): AppState => ({ ...defaultState(), workouts: [finished(MONDAY), finished('2026-10-06'), finished(TODAY)], nextWorkoutType: 'PULL' })

beforeEach(() => configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null }))
afterEach(() => configurePlan(DEFAULT_GOAL))

test('a missed slot never creates catch-up workouts or retrospective rest', () => {
  const state = defaultState()
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual([week.monday, week.target, week.completed, week.active, week.customized], [MONDAY, 5, 0, 0, false])
  assert.deepEqual(week.planned, ['2026-10-08', '2026-10-09', '2026-10-10'])
  assert.deepEqual(week.rest, [TODAY, SUNDAY])
  assert.deepEqual(week.suggested, week.planned)
  assert.deepEqual(week.adaptedRest, [])
  assert.equal(isRestDay(state, '2026-10-06', TODAY), false)
  assert.deepEqual(weekSchedule(state, '2026-09-30', TODAY).planned, [])
  assert.deepEqual(weekSchedule(state, '2026-09-30', TODAY).rest, [])
})

test('an extra workout offers recovery without changing the saved calendar until accepted', () => {
  const state = threeDays()
  const before = structuredClone(state)
  const periods = structuredClone(PERIODS)
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual([week.target, week.completed, week.active], [5, 3, 0])
  assert.deepEqual(week.planned, ['2026-10-08', '2026-10-09', '2026-10-10'])
  assert.deepEqual(week.suggested, ['2026-10-09', '2026-10-10'])
  assert.deepEqual(week.adaptedRest, ['2026-10-08'])
  assert.equal(isRestDay(state, '2026-10-08', TODAY), false, 'recovery is still only a proposal')
  assert.deepEqual(projectSessions(state, SUNDAY, TODAY).map((x) => x.date), week.planned)
  assert.deepEqual(state, before)
  assert.deepEqual(PERIODS, periods)

  state.weekSchedules = { [MONDAY]: { days: [1, 2, 3, 5, 6], target: 5 } }
  const accepted = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual(accepted.planned, week.suggested)
  assert.deepEqual(accepted.adaptedRest, [])
  assert.equal(accepted.customized, true)
  assert.equal(isRestDay(state, '2026-10-08', TODAY), true)
  assert.deepEqual(projectSessions(state, SUNDAY, TODAY).map((x) => `${x.date}:${x.type}`), ['2026-10-09:PULL', '2026-10-10:LEGS'])
  assert.equal(state.nextWorkoutType, before.nextWorkoutType)
  assert.deepEqual(state.workouts, before.workouts)
  assert.deepEqual(state.schedule, before.schedule)
})

test('keeping six sessions is explicit and does not change another week', () => {
  const state = threeDays()
  state.weekSchedules = { [MONDAY]: { days: [1, 2, 3, 4, 5, 6], target: 6 } }
  const week = weekSchedule(state, TODAY, TODAY)
  assert.equal(week.target, 6)
  assert.equal(week.completed + week.active + week.planned.length, 6)
  assert.deepEqual(week.adaptedRest, [])
  const next = weekSchedule(state, '2026-10-12', TODAY)
  assert.equal(next.customized, false)
  assert.equal(next.target, 5)
  assert.equal(next.planned.length, 5)
})

test('active workouts count once, and reopening history does not advance the rotation', () => {
  const state = threeDays()
  state.workouts.pop()
  state.activeWorkout = active()
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual([week.completed, week.active, week.suggested.length], [2, 1, 2])
  assert.equal(projectSessions(state, SUNDAY, TODAY)[0].type, 'PULL')
  state.workouts.push(finished(TODAY, 'active'))
  assert.equal(weekSchedule(state, TODAY, TODAY).active, 0, 'same id in history is not another session')
  state.activeWorkout.reopened = { completedAt: `${TODAY}T11:00:00` }
  state.nextWorkoutType = 'LEGS'
  assert.equal(projectSessions(state, SUNDAY, TODAY)[0].type, 'LEGS', 'editing a past session does not consume the next type')
})

test('two real workouts on one day consume two sessions, while duplicated ids count once', () => {
  const state = threeDays()
  state.workouts.push(finished(MONDAY, 'second-monday'))
  state.workouts.push(state.workouts[0])
  const week = weekSchedule(state, TODAY, TODAY)
  assert.equal(week.completed, 4)
  assert.deepEqual(week.suggested, ['2026-10-10'])
  assert.deepEqual(week.adaptedRest, ['2026-10-08', '2026-10-09'])
  state.weekSchedules = { [MONDAY]: { days: [1, 2, 3, 6], target: 5 } }
  const chosen = weekSchedule(state, TODAY, TODAY)
  assert.equal(chosen.target, 5, 'a session target is independent from the count of distinct days')
  assert.deepEqual(chosen.planned, ['2026-10-10'])
  assert.deepEqual(chosen.adaptedRest, [])
})

test('empty exceptions mean no training, Sunday is 0, and non-Monday keys have no effect', () => {
  const state = defaultState()
  state.weekSchedules = { [MONDAY]: { days: [], target: 0 }, '2026-10-06': { days: [3], target: 1 } }
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual([week.target, week.customized, week.planned], [0, true, []])
  assert.equal(week.rest.length, 5)
  assert.deepEqual(projectSessions(state, SUNDAY, TODAY), [])
  state.weekSchedules[MONDAY] = { days: [0], target: 1 }
  assert.deepEqual(weekSchedule(state, TODAY, TODAY).planned, [SUNDAY])
  delete state.weekSchedules[MONDAY]
  assert.equal(weekSchedule(state, TODAY, TODAY).customized, false)
})

test('all occupied dates are excluded, not only the first projected day', () => {
  const state = defaultState()
  state.workouts = [finished('2026-10-09')]
  state.activeWorkout = active('2026-10-10')
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual(week.planned, ['2026-10-08'])
  assert.deepEqual(projectSessions(state, SUNDAY, TODAY).map((x) => x.date), week.planned)
  for (const date of ['2026-10-09', '2026-10-10']) assert.equal(isRestDay(state, date, TODAY), false)
})

test('program edges limit available days, while maintenance and goal previews retain their horizons', () => {
  const state = defaultState()
  const endWeek = weekSchedule(state, END, '2026-12-21')
  assert.equal(endWeek.target, 5, 'a partial week does not silently rewrite the selected frequency')
  assert.deepEqual(endWeek.planned, ['2026-12-21', '2026-12-22'])
  assert.deepEqual(endWeek.rest, [END])
  assert.deepEqual(weekSchedule(state, '2026-09-21', '2026-09-20').planned, [])
  assert.deepEqual(weekSchedule(state, '2026-12-28', TODAY).planned, [])
  assert.ok(projectSessions(state, '2026-12-30', '2026-12-21').some((x) => x.date > END), 'GoalSheet can preview extending the current goal')
  configurePlan(null, null, null, null, { start: '2026-09-28', maintenance: true, today: TODAY })
  assert.equal(weekSchedule(state, '2028-06-05', TODAY).planned.length, 5)
})

test('bounded and historical pauses remain distinct from rest and match projection', () => {
  const state = defaultState()
  state.programPause = { active: true, startedAt: `${TODAY}T20:00:00`, plannedEnd: '2026-10-09', history: [] }
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual(week.planned, ['2026-10-10'])
  assert.deepEqual(week.rest, [SUNDAY])
  assert.deepEqual(projectSessions(state, SUNDAY, TODAY).map((x) => x.date), week.planned)
  state.programPause = { active: false, startedAt: null, history: [{ startedAt: '2026-10-08T00:00:00', endedAt: '2026-10-08T23:00:00' }] }
  assert.deepEqual(weekSchedule(state, TODAY, TODAY).planned, ['2026-10-09', '2026-10-10'])
  assert.equal(isRestDay(state, '2026-10-08', TODAY), false)
})

test('an open-ended pause keeps tentative projections without promising training or recovery', () => {
  const state = defaultState()
  state.programPause = { active: true, startedAt: `${TODAY}T20:00:00`, plannedEnd: null, history: [] }
  const week = weekSchedule(state, TODAY, TODAY)
  assert.deepEqual([week.planned, week.rest, week.suggested, week.adaptedRest], [[], [], [], []])
  const tentative = projectSessions(state, SUNDAY, TODAY)
  assert.deepEqual(tentative.map((x) => x.date), ['2026-10-08', '2026-10-09', '2026-10-10'])
  assert.ok(tentative.every((x) => x.tentative))
})

test('calendar rest and projection match saved choices through a year boundary', () => {
  configurePlan('2027-06-30', null, null, null, { start: '2026-09-28', foundation: null })
  const state = defaultState()
  state.weekSchedules = { '2026-12-28': { days: [2, 4, 0], target: 3 } }
  const today = '2026-12-28'
  const week = weekSchedule(state, '2027-01-02', today)
  assert.equal(week.monday, today)
  assert.deepEqual(week.planned, ['2026-12-29', '2026-12-31', '2027-01-03'])
  const projected = projectSessions(state, '2027-01-03', today)
  const cells = calendarMonth(state, '2027-01', projected, today).flatMap((x) => x.cells)
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i)
    assert.equal(cells.find((x) => x.date === date)!.rest, week.rest.includes(date))
  }
  assert.deepEqual(projected.map((x) => x.date), week.planned)
})
