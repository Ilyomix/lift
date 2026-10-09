import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultState, normalizeState } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, sessionPlan, weekSchedule } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { exerciseHistory, finishedState, reopenedState } from '../src/lib/training'
import { WORKOUT_TYPES, type AppState, type Workout, type WorkoutExercise } from '../src/lib/types'
import { ExerciseDetail, ProgressScreen } from '../src/screens/Progress'

const initial = useStore.getInitialState()
const originalState = initial.state
const originalLanguage = lang()
const today = '2026-10-07'

beforeEach(() => {
  setLang('en')
  configurePlan('2026-12-23', null, null, null, { start: '2026-09-28', foundation: null })
})
afterEach(() => {
  initial.state = originalState
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

function exercise(weight: number, id = 'chest-press'): WorkoutExercise {
  return {
    exerciseId: id, name: id, muscle: 'Chest', unit: id === 'db-bench-press' ? 'kg/main' : 'kg',
    target: { weight, sets: 1, minReps: 8, maxReps: 12, rir: '2', restSeconds: 120 },
    sets: [{ weight, reps: 10, cleanReps: 10, rir: 2, flags: [], completed: true, note: '' }],
    notes: '', skipped: false, validated: true, comparison: null,
  }
}

function workout(n: number, date: string, gymId = 'gym-a', weight = 40, id = 'chest-press'): Workout {
  return {
    id: `synthetic-${n}`, sessionNumber: n, type: 'UPPER', date,
    startedAt: `${date}T10:00:00Z`, completedAt: `${date}T11:00:00Z`,
    gymId, notes: '', exercises: [exercise(weight, id)],
  }
}

function state(workouts: Workout[], gymId = 'gym-a'): AppState {
  const result = defaultState()
  for (const type of WORKOUT_TYPES) result.templates[type].exercises = []
  result.templates.UPPER.exercises = [workouts[0].exercises[0]]
  return {
    ...result, workouts, completedSessions: workouts.length, nextWorkoutType: 'LOWER', gymId,
    gyms: [{ id: 'gym-a', name: 'Gym A' }, { id: 'gym-b', name: 'Gym B' }, { id: 'gym-c', name: 'Gym C' }],
  }
}

// SSR reads Zustand's initial snapshot. These fixtures never invoke storage or UI actions.
function overview(s: AppState) {
  initial.state = s
  return renderToStaticMarkup(createElement(ProgressScreen, { tab: 'force' }))
}
function detail(s: AppState, id = 'chest-press') {
  initial.state = s
  return renderToStaticMarkup(createElement(ExerciseDetail, { id }))
}
const text = (html: string) => html.replace(/<[^>]*>/g, '')
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
const gymButton = (html: string, label: string) => buttons(html).find(button => text(button[2]) === label)

test('reopening or finishing a correction does not add another planned session to the hero or cycle', () => {
  for (const maintenance of [false, true]) {
    configurePlan('2026-12-23', null, null, null, { start: '2026-09-28', foundation: null, maintenance, today })
    const s = state([workout(1, '2026-10-05'), workout(2, '2026-10-06')])
    const before = sessionPlan(s, today)
    const opened = reopenedState(s, 'synthetic-2')!
    assert.deepEqual(sessionPlan(opened, today), before)
    assert.equal(weekSchedule(opened, today, today).active, 0)
    assert.deepEqual(sessionPlan(finishedState(opened, `${today}T12:00:00Z`, today)!.state, today), before)
  }
})

test('a genuinely new active workout still occupies one planned slot, but an id already in history never does', () => {
  const s = state([workout(1, '2026-10-05')])
  const before = sessionPlan(s, today)
  s.activeWorkout = { ...workout(2, today), timer: null, timerEndAt: null }
  const active = sessionPlan(s, today)
  assert.equal(active.done, before.done)
  assert.equal(active.planned, before.planned + 1, 'today is a rest day, so this adds one real workout')
  s.workouts.push(workout(2, today))
  const withoutDraft = sessionPlan({ ...s, activeWorkout: null }, today)
  assert.deepEqual(sessionPlan(s, today), withoutDraft)
})

test('machine overview never advertises cross-gym progress and keeps both gyms accessible in detail', () => {
  const s = state([workout(1, '2026-10-05', 'gym-a', 40), workout(2, '2026-10-06', 'gym-b', 80)])
  const before = structuredClone(s)
  const html = overview(s)
  assert.doesNotMatch(html, /\+100%/)
  assert.match(text(html), /Gym A · 40/)
  assert.doesNotMatch(text(html), /Gym B · 80/)
  assert.doesNotMatch(html, /<svg[^>]*width="64"/, 'no fake two-point machine sparkline')
  const full = detail(s)
  assert.match(gymButton(full, 'Gym A')![1], /aria-pressed="true"/)
  assert.match(gymButton(full, 'Gym B')![1], /aria-pressed="false"/)
  assert.deepEqual(s, before, 'reading progress does not mutate the history or gym selection')
})

test('overview and detail prefer the current gym, otherwise the last chronologically used gym', () => {
  const s = state([
    workout(1, '2026-10-03', 'gym-a', 40), workout(2, '2026-10-04', 'gym-b', 80),
    workout(3, '2026-10-05', 'gym-b', 100), workout(4, '2026-10-06', 'gym-a', 44),
  ], 'gym-b')
  assert.match(text(overview(s)), /Gym B · 100/)
  assert.match(text(overview(s)), /\+25%/)
  assert.match(gymButton(detail(s), 'Gym B')![1], /aria-pressed="true"/)
  s.gymId = 'gym-c'
  assert.match(text(overview(s)), /Gym A · 44/)
  assert.match(text(overview(s)), /\+10%/)
  assert.match(gymButton(detail(s), 'Gym A')![1], /aria-pressed="true"/)
})

test('free-weight progress remains shared across gyms', () => {
  const s = state([workout(1, '2026-10-05', 'gym-a', 20, 'db-bench-press'), workout(2, '2026-10-06', 'gym-b', 25, 'db-bench-press')])
  const html = overview(s)
  assert.match(text(html), /\+25%/)
  assert.doesNotMatch(text(html), /Gym [AB] ·/)
  assert.equal(gymButton(detail(s, 'db-bench-press'), 'Gym A'), undefined)
})

test('unordered imports are normalized chronologically before progress and gym fallback selection', () => {
  const s = normalizeState(state([
    workout(3, '2026-10-06', 'gym-a', 44), workout(1, '2026-10-03', 'gym-a', 40), workout(2, '2026-10-04', 'gym-b', 80),
  ], 'gym-c'))
  assert.deepEqual(s.workouts.map(workout => workout.id), ['synthetic-1', 'synthetic-2', 'synthetic-3'])
  assert.deepEqual(exerciseHistory(s.workouts, 'chest-press').map(point => point.workoutId), ['synthetic-1', 'synthetic-2', 'synthetic-3'])
  assert.match(text(overview(s)), /Gym A · 44/)
  assert.match(text(overview(s)), /\+10%/)
})

test('curves and deltas separate units and named conditions without removing older history rows', () => {
  for (const variant of ['unit', 'context']) {
    const workouts = [
      workout(1, '2026-10-03', 'gym-a', 400), workout(2, '2026-10-04', 'gym-a', 40),
      workout(3, '2026-10-05', 'gym-a', 100), workout(4, '2026-10-06', 'gym-a', 44),
    ]
    workouts.forEach((workout, index) => {
      const compatible = index % 2 === 1
      if (variant === 'unit') workout.exercises[0].unit = compatible ? 'kg/main' : 'kg'
      else workout.exercises[0].comparisonContext = compatible ? (index === 1 ? 'Machine B' : ' machine b ') : 'Machine A'
    })
    const s = state(workouts)
    const before = structuredClone(s)
    const summary = overview(s)
    assert.match(text(summary), /\+10%/)
    const sparkline = summary.match(/<svg\b[^>]*width="64"[^>]*>([\s\S]*?)<\/svg>/)![1]
    const path = sparkline.match(/<path\b[^>]*d="([^"]+)"/)![1]
    assert.equal((path.match(/L/g) ?? []).length, 1, 'two compatible points, not four mixed points')
    const full = detail(s)
    assert.match(text(full), /4\sworkouts · \+10%/)
    assert.match(text(full), /All workouts remain in the history below/)
    const historyRows = buttons(full).filter(button => /#\d/.test(text(button[2])))
    assert.equal(historyRows.length, 4)
    assert.ok(historyRows.some(row => /400\skg(\/hand)? × 10/.test(text(row[2]))))
    assert.ok(historyRows.some(row => /100\skg(\/hand)? × 10/.test(text(row[2]))))
    if (variant === 'unit') assert.match(text(full), /Estimated 1RM \(kg\/hand\)/)
    else {
      assert.match(text(full), /machine a/)
      assert.match(text(full), /machine b/)
    }
    assert.deepEqual(s, before)
  }
})


test('unlogged loads never create a zero performance or hide the raw workout history', () => {
  const first = workout(1, '2026-10-03', 'gym-a', 40)
  const missing = workout(2, '2026-10-04', 'gym-a', 40)
  missing.exercises[0].sets[0].weight = null
  const s = state([first, missing])
  const before = structuredClone(s)
  assert.doesNotMatch(text(overview(s)), /[−–-]100%/)
  const full = detail(s)
  assert.doesNotMatch(text(full), /[−–-]100%/)
  assert.equal(buttons(full).filter(button => /#\d/.test(text(button[2]))).length, 2)
  const missingOverview = text(overview(state([missing])))
  assert.doesNotMatch(missingOverview, /No performance recorded yet/)
  assert.doesNotMatch(missingOverview, /Not done yet/)
  const onlyMissing = detail(state([missing]))
  assert.match(text(onlyMissing), /Log a load/)
  assert.equal(buttons(onlyMissing).filter(button => /#\d/.test(text(button[2]))).length, 1)
  assert.doesNotMatch(text(onlyMissing), /No workouts at this gym/)
  assert.deepEqual(s, before)
})
