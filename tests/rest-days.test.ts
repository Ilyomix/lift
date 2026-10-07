import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { calendarMonth, configurePlan, DEFAULT_GOAL, isPausedDay, isRestDay, pauseDays, projectSessions, scheduleFromDays } from '../src/lib/program'
import { weekStrip } from '../src/lib/stats'
import type { ActiveWorkout, AppState, Workout } from '../src/lib/types'

const TODAY = '2026-10-07' // Wednesday: rest in the default schedule.
const END = '2026-12-23' // Wednesday as well.
const active = (date = TODAY): ActiveWorkout => ({
  id: 'active', type: 'UPPER', date, startedAt: `${date}T12:00:00`, notes: '',
  timerEndAt: null, timer: null, exercises: [],
})
const finished = (date = TODAY): Workout => ({
  id: 'finished', sessionNumber: 1, type: 'UPPER', date, startedAt: `${date}T10:00:00`,
  completedAt: `${date}T11:00:00`, notes: '', exercises: [],
})

beforeEach(() => configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null }))
afterEach(() => configurePlan(DEFAULT_GOAL))

test('rest means a non-training day today or ahead, never missing historical data', () => {
  const state = defaultState()
  assert.equal(isRestDay(state, TODAY, TODAY), true)
  assert.equal(isRestDay(state, '2026-10-11', TODAY), true)
  assert.equal(isRestDay(state, '2026-10-08', TODAY), false, 'Thursday is a training day')
  assert.equal(isRestDay(state, '2026-10-06', TODAY), false, 'unlogged past training is not rest')
  assert.equal(isRestDay(state, '2026-10-04', TODAY), false, 'past schedule is not reconstructed')
})

test('rest respects plan bounds and an open-ended maintenance plan', () => {
  const state = defaultState()
  assert.equal(isRestDay(state, '2026-09-27', '2026-09-20'), false, 'before the program')
  assert.equal(isRestDay(state, END, TODAY), true, 'the last day is included')
  assert.equal(isRestDay(state, '2026-12-27', TODAY), false, 'after the dated goal')
  configurePlan(null, null, null, null, { start: '2026-09-28', maintenance: true, today: TODAY })
  assert.equal(isRestDay(state, '2028-06-04', TODAY), true, 'maintenance has no artificial end date')
})

test('custom days and the empty-schedule fallback match the existing projection', () => {
  const state = defaultState()
  state.schedule = scheduleFromDays([1, 3, 5])
  assert.equal(isRestDay(state, TODAY, TODAY), false)
  assert.equal(isRestDay(state, '2026-10-08', TODAY), true)
  state.schedule = scheduleFromDays([])
  assert.equal(isRestDay(state, TODAY, TODAY), true)
  assert.equal(isRestDay(state, '2026-10-08', TODAY), false)
})

test('a finished or active workout takes precedence over scheduled rest', () => {
  const state = defaultState()
  state.activeWorkout = active()
  assert.equal(isRestDay(state, TODAY, TODAY), false)
  assert.equal(isRestDay(state, '2026-10-11', TODAY), true, 'another date is unchanged')
  state.activeWorkout = null
  state.workouts = [finished()]
  assert.equal(isRestDay(state, TODAY, TODAY), false)
})

test('an active pause applies immediately and an undated pause also blocks future rest', () => {
  const state = defaultState()
  state.programPause = { active: true, startedAt: `${TODAY}T20:00:00`, plannedEnd: null, history: [] }
  assert.equal(pauseDays(state, TODAY).has(TODAY), false, 'the historical 12 h rule is unchanged')
  assert.equal(isRestDay(state, TODAY, TODAY), false)
  assert.equal(isRestDay(state, '2026-10-11', TODAY), false)
  const assertPauseViews = (date: string, expected: boolean) => {
    const calendar = calendarMonth(state, '2026-10', [], TODAY).flatMap((week) => week.cells)
    const week = weekStrip(state, [], pauseDays(state, TODAY), TODAY)
    assert.equal(isPausedDay(state, date, TODAY), expected, 'day-sheet helper')
    assert.equal(calendar.find((day) => day.date === date)!.paused, expected, 'calendar cell')
    assert.equal(week.find((day) => day.date === date)!.paused, expected, 'home week')
  }
  assertPauseViews(TODAY, true)
  assertPauseViews('2026-10-11', true)
  state.programPause.plannedEnd = '2026-10-11'
  assert.equal(isRestDay(state, '2026-10-11', TODAY), false, 'last paused day is inclusive')
  assert.equal(isRestDay(state, '2026-10-14', TODAY), true, 'a recovery day after the planned return')
  state.programPause.startedAt = '2026-10-09T12:00:00'
  assertPauseViews(TODAY, false)
  assertPauseViews('2026-10-08', false)
  assertPauseViews('2026-10-09', true)
  assertPauseViews('2026-10-11', true)
  assert.equal(isPausedDay(state, '2026-10-12', TODAY), false, 'after the planned pause end')
})

test('recorded pauses remain distinct from rest without changing pause history', () => {
  const state = defaultState()
  state.programPause = { active: false, startedAt: null, history: [{ startedAt: `${TODAY}T00:00:00`, endedAt: `${TODAY}T13:00:00` }] }
  const before = structuredClone(state)
  assert.equal(isRestDay(state, TODAY, TODAY), false)
  assert.equal(isRestDay(state, '2026-10-11', TODAY), true)
  assert.deepEqual(state, before)
})

test('calendar and home week share rest flags and expose the active workout', () => {
  const state = defaultState()
  const planned = projectSessions(state, '2026-10-11', TODAY)
  assert.equal(planned[0].date, '2026-10-08', 'next workout is tomorrow, not today')
  const week = weekStrip(state, planned, pauseDays(state, TODAY), TODAY)
  const calendar = calendarMonth(state, '2026-10', planned, TODAY).flatMap((w) => w.cells)
  for (const day of week) assert.equal(day.rest, calendar.find((c) => c.date === day.date)!.rest)
  assert.equal(week.find((d) => d.date === TODAY)!.rest, true)
  assert.equal(week.find((d) => d.date === '2026-10-06')!.rest, false)
  state.activeWorkout = active()
  const running = weekStrip(state, projectSessions(state, '2026-10-11', TODAY), pauseDays(state, TODAY), TODAY)
  assert.equal(running.find((d) => d.date === TODAY)!.active, 'UPPER')
  assert.equal(running.find((d) => d.date === TODAY)!.rest, false)
  assert.equal(running.find((d) => d.date === '2026-10-08')!.active, null)
  const current = calendarMonth(state, '2026-10', [], TODAY).flatMap((w) => w.cells).find((d) => d.date === TODAY)!
  assert.equal(current.active, true)
  assert.equal(current.rest, false)
})

test('rest classification leaves projection, rotation and state unchanged', () => {
  const state: AppState = { ...defaultState(), nextWorkoutType: 'PULL' }
  const before = structuredClone(state)
  const projected = projectSessions(state, '2026-10-11', TODAY)
  weekStrip(state, projected, pauseDays(state, TODAY), TODAY)
  calendarMonth(state, '2026-10', projected, TODAY)
  assert.deepEqual(projectSessions(state, '2026-10-11', TODAY), projected)
  assert.deepEqual(state, before)
})
