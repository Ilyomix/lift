import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState, makeBackup, normalizeState, normalizeWeekSchedules, parseBackup } from '../src/lib/backup'
import { addDays, weekday } from '../src/lib/date'
import { calendarMonth, configurePlan, DEFAULT_GOAL, isRestDay, pauseDays, projectSessions, weekSchedule } from '../src/lib/program'
import { weekStrip } from '../src/lib/stats'
import { canEditWeekSchedule } from '../src/components/WeekScheduleSheet'
import { useStore } from '../src/lib/store'
import type { ActiveWorkout, Workout } from '../src/lib/types'

const TODAY = '2026-10-07'
const WEEK = '2026-10-05'
const END = '2027-07-31'
const state = () => useStore.getState().state
const actions = () => useStore.getState()
const workout = (id: string, date: string): Workout => ({ id, date, type: 'UPPER', sessionNumber: 1, startedAt: `${date}T10:00:00Z`, completedAt: `${date}T11:00:00Z`, exercises: [], notes: '' })

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T12:00:00Z`) })
  const base = defaultState()
  useStore.setState({ state: { ...base, settings: { ...base.settings, programStart: '2026-09-28', foundationStart: null, goalDate: END } }, hasData: false, storage: 'memory', ready: true })
})
afterEach(async () => { await actions().flush(); configurePlan(DEFAULT_GOAL) })

test('one-week choices survive backup, count same-day workouts separately and preserve all training data', () => {
  const completed = [workout('first', WEEK), workout('second', WEEK)]
  const active: ActiveWorkout = { id: 'active', date: TODAY, type: 'LOWER', startedAt: `${TODAY}T12:00:00Z`, exercises: [], notes: '', timer: null, timerEndAt: null }
  useStore.setState({ state: { ...state(), workouts: completed, activeWorkout: active } })
  const before = state()
  assert.equal(actions().setWeekSchedule(WEEK, [5, 4, 5]), true)
  assert.deepEqual(state().weekSchedules, { [WEEK]: { days: [1, 3, 4, 5], target: 5 } })
  assert.equal(state().workouts, before.workouts)
  assert.equal(state().activeWorkout, before.activeWorkout)
  assert.equal(state().schedule, before.schedule)
  assert.equal(state().goals, before.goals)
  assert.equal(state().settings, before.settings)
  assert.equal(state().templates, before.templates)
  assert.equal(state().nextWorkoutType, before.nextWorkoutType)
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state(), []))).state.weekSchedules, state().weekSchedules)
  assert.equal(actions().setWeekSchedule(WEEK, []), true)
  assert.deepEqual(state().weekSchedules?.[WEEK], { days: [1, 3], target: 3 }, 'empty selection means no remaining sessions, never erase occupied days')
})

test('future empty weeks and resets are explicit and scoped to one week', () => {
  assert.equal(actions().setWeekSchedule('2026-10-12', []), true)
  assert.equal(actions().setWeekSchedule('2026-10-19', [0, 1, 3]), true)
  assert.deepEqual(state().weekSchedules?.['2026-10-12'], { days: [], target: 0 })
  assert.deepEqual(state().weekSchedules?.['2026-10-19'], { days: [1, 3, 0], target: 3 })
  assert.equal(actions().setWeekSchedule('2026-10-12', null), true)
  assert.equal(Object.hasOwn(state().weekSchedules!, '2026-10-12'), false)
  assert.equal(actions().setWeekSchedule('2026-10-19', null), true)
  assert.equal(Object.hasOwn(state(), 'weekSchedules'), false)
  const before = state()
  assert.equal(actions().setWeekSchedule('2026-10-19', null), true)
  assert.equal(state(), before)
})

test('restoring usual days removes moved rest in every view and backup without rewriting the completed rest-day workout', () => {
  const completed = [workout('monday', WEEK), workout('tuesday', '2026-10-06'), workout('rest-day', TODAY)]
  useStore.setState({ state: { ...state(), workouts: completed, nextWorkoutType: 'LOWER' } })
  configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null })
  const baseline = structuredClone(state())
  const expected = projectSessions(state(), '2026-10-11', TODAY)
  assert.equal(actions().setWeekSchedule(WEEK, [5, 6]), true)
  assert.equal(isRestDay(state(), '2026-10-08', TODAY), true)
  assert.equal(projectSessions(state(), '2026-10-11', TODAY)[0].date, '2026-10-09')

  assert.equal(actions().setWeekSchedule(WEEK, null), true)
  assert.deepEqual(state(), baseline, 'reset restores the original state, including every completed workout')
  for (const current of [state(), parseBackup(JSON.stringify(makeBackup(state(), []))).state]) {
    assert.equal(current.weekSchedules, undefined, 'the removed exception must not return on reload')
    const summary = weekSchedule(current, TODAY, TODAY)
    const planned = projectSessions(current, '2026-10-11', TODAY)
    assert.deepEqual(planned, expected)
    assert.equal(summary.customized, false)
    assert.equal(summary.target, 5)
    assert.deepEqual(summary.planned, ['2026-10-08', '2026-10-09', '2026-10-10'])
    assert.deepEqual(summary.adaptedRest, ['2026-10-08'], 'a recovery suggestion is not the saved schedule')
    assert.equal(planned[0].type, 'LOWER', 'resetting weekdays never rewinds the workout rotation')
    const calendar = calendarMonth(current, '2026-10', planned, TODAY).flatMap(week => week.cells)
    const home = weekStrip(current, planned, pauseDays(current, TODAY), TODAY)
    for (const view of [calendar, home]) {
      const restored = view.find(day => day.date === '2026-10-08')!
      assert.equal(restored.rest, false)
      assert.ok(restored.planned)
      const trained = view.find(day => day.date === TODAY)!
      assert.equal(trained.done.length, 1)
      assert.equal(trained.rest, false, 'completed training takes precedence over the usual rest day')
    }
  }
})

test('restoring usual days preserves an active rest-day workout, and discarding it restores rest without a ghost slot', () => {
  const completed = [workout('monday', WEEK), workout('tuesday', '2026-10-06')]
  useStore.setState({ state: { ...state(), workouts: completed, nextWorkoutType: 'LOWER' } })
  configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null })
  const baseline = structuredClone(state())
  actions().startSession('LOWER')
  const active = state().activeWorkout!
  assert.equal(actions().setWeekSchedule(WEEK, [5, 6]), true)
  assert.equal(actions().setWeekSchedule(WEEK, null), true)
  assert.equal(state().activeWorkout, active)
  assert.equal(state().workouts, completed)
  assert.equal(state().nextWorkoutType, 'LOWER')
  assert.equal(isRestDay(state(), TODAY, TODAY), false)
  assert.equal(isRestDay(state(), '2026-10-08', TODAY), false)
  assert.equal(projectSessions(state(), '2026-10-11', TODAY)[0].type, 'PUSH', 'the active workout still occupies its place in the rotation')
  const restored = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.equal(restored.weekSchedules, undefined)
  assert.equal(restored.activeWorkout?.id, active.id)
  assert.equal(weekSchedule(restored, TODAY, TODAY).active, 1)

  actions().discardSession()
  assert.deepEqual(state(), baseline)
  assert.equal(isRestDay(state(), TODAY, TODAY), true)
  assert.equal(projectSessions(state(), '2026-10-11', TODAY)[0].type, 'LOWER')
})

test('a reopened workout is counted once and invalid or retroactive edits leave state untouched', () => {
  const completed = workout('same', WEEK)
  useStore.setState({ state: { ...state(), workouts: [completed], activeWorkout: { ...completed, timer: null, timerEndAt: null, reopened: { completedAt: completed.completedAt } } } })
  assert.equal(actions().setWeekSchedule(WEEK, [4]), true)
  assert.deepEqual(state().weekSchedules?.[WEEK], { days: [1, 4], target: 2 })
  for (const [week, days] of [
    ['2026-09-28', [1]], ['2026-10-06', [4]], ['2026-02-30', []], ['2027-08-02', []], ['2027-07-26', [0]],
    [WEEK, [2]], [WEEK, [-1]], [WEEK, [7]], [WEEK, [1.5]], [WEEK, [NaN]], [WEEK, ['4']], [WEEK, undefined],
  ] as Array<[string, number[]]>) {
    const before = state()
    assert.equal(actions().setWeekSchedule(week, days), false, `${week}: ${days}`)
    assert.equal(state(), before)
  }
  useStore.setState({ state: { ...state(), settings: { ...state().settings, programStart: '2026-10-15' } } })
  assert.equal(actions().setWeekSchedule(WEEK, []), false, 'week fully before the plan')
  assert.equal(actions().setWeekSchedule('2026-10-12', [1]), false, 'selected day before a midweek program start')
  assert.equal(actions().setWeekSchedule('2026-10-12', [4]), true)
})

test('imports accept real Mondays and strict bounded week choices without inventing defaults', () => {
  assert.equal(Object.hasOwn(normalizeState(defaultState()), 'weekSchedules'), false)
  assert.equal(normalizeWeekSchedules([]), undefined)
  assert.deepEqual(normalizeWeekSchedules({
    '2026-10-05': { days: [0, 1, 1, 4], target: 4 },
    '2026-10-12': { days: [], target: 0 },
    '2026-10-06': { days: [1], target: 1 },
    '2026-02-30': { days: [], target: 0 },
    '2026-10-19': { days: [1, 2], target: 1 },
    '2026-10-26': { days: [7], target: 7 },
    '2026-11-02': { days: ['1'], target: 1 },
    '2026-11-09': { days: [1], target: 1.5 },
    '2026-11-16': { days: [], target: -1 },
    '2026-11-23': { days: [], target: 101 },
    '2026-11-30': { days: [], target: '0' },
    '2026-12-07': [1, 2],
  }), { '2026-10-12': { days: [], target: 0 }, '2026-10-05': { days: [1, 4, 0], target: 4 } })
  const many = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [addDays(WEEK, index * 7), { days: [], target: 0 }]))
  const bounded = normalizeWeekSchedules(many)!
  assert.equal(Object.keys(bounded).length, 260)
  assert.ok(Object.hasOwn(bounded, addDays(WEEK, 299 * 7)), 'the newest exceptions are retained')
})

test('maintenance accepts future weeks beyond the old goal within its projected horizon', () => {
  useStore.setState({ state: { ...state(), settings: { ...state().settings, goalDate: '2026-10-11', maintenance: true } } })
  assert.equal(actions().setWeekSchedule('2026-12-07', [1, 4]), true)
  assert.equal(actions().setWeekSchedule('2040-01-02', [1]), false)
})

test('saving cannot promise a slot during a pause, while completed sessions remain recorded', () => {
  const completed = workout('completed-during-pause', TODAY)
  useStore.setState({ state: { ...state(), workouts: [completed], programPause: {
    active: true, startedAt: `${TODAY}T08:00:00Z`, plannedEnd: '2026-10-09', history: [],
  } } })
  const before = state()
  assert.equal(actions().setWeekSchedule(WEEK, [4]), false, 'Thursday is still paused')
  assert.equal(state(), before)
  assert.equal(actions().setWeekSchedule(WEEK, [3, 6]), true, 'a real workout and a slot after the pause are preserved')
  assert.deepEqual(state().weekSchedules?.[WEEK], { days: [3, 6], target: 2 })
  assert.deepEqual(weekSchedule(state(), TODAY, TODAY).planned, ['2026-10-10'])
  useStore.setState({ state: { ...state(), programPause: { ...state().programPause, plannedEnd: null } } })
  assert.equal(actions().setWeekSchedule(WEEK, [6]), false, 'an indefinite pause does not promise a return date')
  assert.equal(actions().setWeekSchedule(WEEK, null), true, 'reset remains available during a pause')
})

test('a correction changing its date keeps historical occupation until it is finished', () => {
  for (const originalDate of [WEEK, '2026-09-28']) {
    const completed = workout('same', originalDate)
    useStore.setState({ state: { ...state(), weekSchedules: undefined, workouts: [completed], activeWorkout: {
      ...completed, date: TODAY, timer: null, timerEndAt: null, reopened: { completedAt: completed.completedAt },
    } } })
    assert.equal(actions().setWeekSchedule(WEEK, [4]), true)
    const count = originalDate === WEEK ? 1 : 0
    assert.deepEqual(state().weekSchedules?.[WEEK], { days: count ? [1, 4] : [4], target: count + 1 })
    const summary = weekSchedule(state(), TODAY, TODAY)
    assert.deepEqual([summary.completed, summary.active, summary.target], [count, 0, count + 1])
    assert.deepEqual(summary.planned, ['2026-10-08'])
    assert.ok(summary.rest.includes(TODAY), 'the draft correction does not occupy another day')
  }
})

test('finishing on rest offers a choice without changing the week until that choice is saved', () => {
  const completed = [workout('monday', WEEK), { ...workout('tuesday', '2026-10-06'), sessionNumber: 2 }]
  useStore.setState({ state: { ...state(), workouts: completed } })
  configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null })
  actions().startSession('UPPER')
  const active = state().activeWorkout!
  const exercise = active.exercises[0]
  useStore.setState({ state: { ...state(), activeWorkout: { ...active, exercises: [{ ...exercise, sets: [{ ...exercise.sets[0], weight: 20, reps: 8, cleanReps: 8, completed: true }] }] } } })
  const id = actions().finishSession()!
  assert.equal(actions().lastFinish?.trainedOnRestDay, true)
  assert.equal(state().weekSchedules, undefined, 'finishing does not silently move rest days')
  const proposal = weekSchedule(state(), TODAY, TODAY)
  assert.deepEqual(proposal.planned, ['2026-10-08', '2026-10-09', '2026-10-10'])
  assert.deepEqual(proposal.suggested, ['2026-10-09', '2026-10-10'])
  const history = state().workouts, rotation = state().nextWorkoutType, settings = state().settings
  assert.equal(actions().setWeekSchedule(WEEK, proposal.suggested.map(weekday)), true)
  assert.equal(state().workouts, history)
  assert.equal(state().nextWorkoutType, rotation)
  assert.equal(state().settings, settings)
  assert.equal(isRestDay(state(), '2026-10-08', TODAY), true)
  assert.deepEqual(projectSessions(state(), '2026-10-11', TODAY).map(({ date, type }) => ({ date, type })), [
    { date: '2026-10-09', type: 'LOWER' }, { date: '2026-10-10', type: 'PUSH' },
  ])
  assert.equal(actions().reopenWorkout(id), true)
  assert.equal(actions().finishSession(), id)
  assert.equal(actions().lastFinish?.trainedOnRestDay, false, 'correcting the same session does not offer another adjustment')
})

test('calendar edit actions follow the same current-week and program bounds as saving', () => {
  configurePlan(END, null, null, null, { start: '2026-10-15', foundation: null })
  assert.equal(canEditWeekSchedule('2026-09-28', TODAY), false)
  assert.equal(canEditWeekSchedule(TODAY, TODAY), false, 'whole week before program start')
  assert.equal(canEditWeekSchedule('2026-10-12', TODAY), true, 'week overlapping program start')
  assert.equal(canEditWeekSchedule('2027-07-26', TODAY), true, 'week overlapping goal date')
  assert.equal(canEditWeekSchedule('2027-08-02', TODAY), false)
  configurePlan(END, null, null, null, { start: '2026-09-28', maintenance: true, today: TODAY })
  assert.equal(canEditWeekSchedule('2026-12-07', TODAY), true)
  assert.equal(canEditWeekSchedule('2040-01-02', TODAY), false)
})
