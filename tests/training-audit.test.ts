import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultState } from '../src/lib/backup'
import { addDays } from '../src/lib/date'
import { cutDaysNeeded, cutLossPct, KCAL_PER_KG, CUT_MAX_DEFICIT } from '../src/lib/energy'
import { effortSummary, effortTarget, recordedRir } from '../src/lib/effort'
import { setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, buildPeriods } from '../src/lib/program'
import { calorieAdvice, plannedWeightPath, weightStatus } from '../src/lib/stats'
import { compareExercise, finalizeWorkout, intraSessionAdjust, loadDecision, previousPerformance, progressionFor } from '../src/lib/training'
import { upgradeTrainingDiagnostics } from '../src/lib/trainingMigration'
import { localizeComparison } from '../src/lib/trainingMessages'
import { visualPlan } from '../src/lib/visual'
import { EffortGuidance, EffortReport } from '../src/components/EffortGuidance'
import type { AppState, Workout, WorkoutExercise, WorkoutSet } from '../src/lib/types'

setLang('fr')
afterEach(() => { setLang('fr'); configurePlan(DEFAULT_GOAL) })
const set = (weight = 40, reps = 10, rir: number | null = 2): WorkoutSet => ({ weight, reps, cleanReps: reps, rir, flags: [], completed: true, note: '' })
function exercise(id = 'pec-deck', reps = [10, 10, 10], weight = 40, rir: number | null = 2): WorkoutExercise {
  return { exerciseId: id, name: id, muscle: '', unit: 'kg', target: { weight, sets: 3, minReps: 8, maxReps: 12, restSeconds: 120, rir: '1–2' }, prescription: { weight, sets: 3, minReps: 8, maxReps: 12, restSeconds: 120, rir: '2', loadFactor: 1, notes: [] }, sets: reps.map((r) => set(weight, r, rir)), notes: '', skipped: false, validated: true, comparison: null }
}
function workout(n: number, exercises: WorkoutExercise[]): Workout {
  return { id: `synthetic-${n}`, date: addDays('2026-10-05', (n - 1) * 3), sessionNumber: n, type: 'PUSH', startedAt: '', completedAt: '', exercises, notes: '', periodId: 'b1', deload: false }
}
function measured(entries: [string, number][]): AppState {
  return { ...defaultState(), profile: { heightCm: 180, age: 35, sex: 'm' }, bodyEntries: entries.map(([date, weight], i) => ({ id: `synthetic-weight-${i}`, date, weight, waist: null, arm: null, chest: null, shoulders: null })) }
}

test('dated RIR wins; failure flags override contradictory input; missing RIR stays unknown', () => {
  const ex = exercise()
  ex.prescription!.rir = '3'
  assert.equal(effortTarget(ex), '3')
  assert.equal(recordedRir({ ...set(), rir: 4, flags: ['failure'] }), 0)
  assert.equal(recordedRir(set(40, 10, null)), null)
  for (const invalid of [-1, 12, NaN, Infinity]) assert.equal(recordedRir(set(40, 10, invalid)), null)
  ex.sets = [set(40, 10, 0), set(40, 10, null), set(40, 10, 3), set(40, 8, 1)]
  assert.deepEqual(effortSummary([ex]), { completed: 4, logged: 3, failures: 1, belowTarget: 2, extra: 1 })
})

test('optional bonus sets count in volume but cannot validate a heavier load', () => {
  const ex = exercise('chest-press', [10, 10, 10])
  ex.sets.push(set(60, 12), set(60, 12))
  assert.equal(loadDecision(ex), null)
  const done = finalizeWorkout([], workout(1, [ex])).workout.exercises[0]
  assert.equal(done.comparison!.volume, 2640)
  assert.equal(done.sets.length, 5)
  const prev = exercise('chest-press')
  assert.equal(compareExercise(ex, prev, [], false).deltaCleanReps, 0)
})

test('pain on an extra set blocks progression and failure cannot masquerade as easy work', () => {
  const ex = exercise('chest-press', [12, 12, 12])
  ex.sets.push({ ...set(40, 12), flags: ['pain'] })
  assert.equal(progressionFor(ex), null)
  const hard = exercise('chest-press', [12, 0, 0])
  hard.sets[0] = { ...set(40, 12, 4), flags: ['failure'] }
  hard.sets[1].completed = false
  hard.sets[2].completed = false
  assert.equal(intraSessionAdjust(hard, 0), null)
})

test('range preference never resurrects an old machine through a documented context boundary', () => {
  const old = exercise('pec-deck', [10, 10, 10], 60)
  const changed = exercise('pec-deck', [10, 11], 25)
  changed.comparisonContext = 'Machine B'
  changed.target = { ...changed.target, maxReps: 15 }
  changed.prescription = { ...changed.prescription!, maxReps: 15 }
  const ws = [workout(1, [old]), workout(2, [changed])]
  const current = exercise('pec-deck', [10, 10, 10], 25)
  assert.equal(previousPerformance(ws, 'pec-deck', undefined, undefined, current.target)?.workout.id, ws[1].id)
  const result = finalizeWorkout(ws, workout(3, [current]))
  assert.equal(result.workout.exercises[0].comparison!.contextReason, 'conditions-changed')
  assert.equal(result.workout.exercises[0].comparison!.marked, false)
  assert.equal(result.generalDrop, false)
  assert.equal(result.changes.length, 0)
})

test('identical named machine context can be compared; changed rest or range cannot trigger fatigue', () => {
  const before = exercise(); before.comparisonContext = 'Machine B'
  const now = exercise('pec-deck', [11, 10, 10]); now.comparisonContext = 'Machine B'
  assert.equal(compareExercise(now, before, [], false).status, 'progress')
  now.prescription!.restSeconds = 60
  assert.equal(compareExercise(now, before, [], false).contextReason, 'rest-changed')
  now.prescription!.restSeconds = 120; now.prescription!.maxReps = 15
  assert.equal(compareExercise(now, before, [], false).contextReason, 'rep-range-changed')
})

test('fatigue after additional overlapping exercises is contextual, not an automatic deload', () => {
  const a = workout(1, [exercise('triceps-rope')])
  const b = workout(2, [exercise('triceps-overhead-rope'), exercise('triceps-rope', [7, 7, 7])])
  const result = finalizeWorkout([a], b)
  const c = result.workout.exercises[1].comparison!
  assert.equal(c.contextReason, 'preceding-work-changed')
  assert.equal(c.marked, false)
  assert.equal(result.generalDrop, false)
})

test('backdated edits and unordered imports never compare against future sessions', () => {
  const first = workout(1, [exercise()])
  const current = workout(2, [exercise('pec-deck', [11, 11, 11])])
  const future = workout(3, [exercise('pec-deck', [16, 16, 16])])
  const r = finalizeWorkout([future, first, current], current)
  assert.deepEqual(r.workout.exercises[0].comparison!.previousSetReps, [10, 10, 10])
  assert.equal(r.workout.exercises[0].comparison!.status, 'progress')
  assert.equal(previousPerformance([future, current, first], 'pec-deck', current.id)?.workout.id, first.id)
})

test('migration regrades diagnostics once, preserving raw observations and load targets', () => {
  const state = defaultState()
  const a = workout(1, [exercise('shoulder-press-machine')])
  const b = workout(2, [exercise('shoulder-press-machine', [8, 8, 8])])
  const c = workout(3, [exercise('shoulder-press-machine', [6, 6, 6])])
  c.exercises[0].prescription!.restSeconds = 60
  state.workouts = [a, b, c]
  const item = state.templates.PUSH.exercises.find((e) => e.exerciseId === 'shoulder-press-machine')!
  item.autoAdjust = { sets: -1, since: c.date, reason: 'baisse 2 séances de suite' }
  const raw = JSON.stringify(state)
  const result = upgradeTrainingDiagnostics(state)
  assert.equal(JSON.stringify(state), raw)
  assert.deepEqual(result.workouts.map((w) => w.exercises.map((e) => e.sets)), state.workouts.map((w) => w.exercises.map((e) => e.sets)))
  assert.deepEqual(result.templates.PUSH.exercises.find((e) => e.exerciseId === item.exerciseId)!.target, item.target)
  assert.equal(result.templates.PUSH.exercises.find((e) => e.exerciseId === item.exerciseId)!.autoAdjust, undefined)
  assert.equal(upgradeTrainingDiagnostics(result), result)
})

test('effort UI and persisted diagnostic reasons switch FR to EN to FR', () => {
  const ex = exercise(); ex.prescription!.rir = '3'; ex.sets.push(set())
  for (const language of ['fr', 'en', 'fr'] as const) {
    setLang(language)
    const html = renderToStaticMarkup(createElement(EffortGuidance, { exercise: ex }))
    assert.match(html, language === 'en' ? /Today’s instruction/ : /Consigne du jour/)
    assert.match(html, language === 'en' ? /about 3 repetitions still possible/ : /environ 3 répétitions encore possibles/)
    const report = renderToStaticMarkup(createElement(EffortReport, { exercises: [ex] }))
    assert.match(report, language === 'en' ? /extra set/ : /supplémentaire/)
    const prev = exercise(); prev.prescription!.restSeconds = 60
    const c = compareExercise(ex, prev, [], false)
    const stored = JSON.parse(JSON.stringify(c))
    assert.match(localizeComparison(stored).detail, language === 'en' ? /^Prescribed rest/ : /^Repos prescrit/)
  }
})

test('weight trend excludes future dates, duplicate-day inflation and sparse measurements', () => {
  const sparse = measured([['2026-09-01', 85], ['2026-09-29', 88], ['2026-10-02', 87], ['2027-01-01', 110]])
  assert.equal(weightStatus(sparse, '2026-10-03').current, 87)
  assert.equal(weightStatus(sparse, '2026-10-03').weeklyChange, null)
  assert.equal(calorieAdvice(sparse, '2026-10-03').status, 'wait')
  const duplicate = measured(Array.from({ length: 20 }, () => ['2026-10-02', 87] as [string, number]))
  assert.equal(weightStatus(duplicate, '2026-10-03').trendWeighIns, 1)
})

test('shared energy budget bounds both daily forecasts and cut estimates', () => {
  assert.ok(cutLossPct(110, 0.6) < 0.5)
  const goal = '2027-03-28'
  const cut = buildPeriods(goal, 8, '2027-01-04', null)
  const state = measured([['2027-01-04', 110]])
  const path = plannedWeightPath('2027-01-04', 110, { periods: cut, goal })
  for (let i = 1; i < path.length; i++) {
    const days = (Date.parse(path[i].date) - Date.parse(path[i - 1].date)) / 86400000
    assert.ok((path[i - 1].value - path[i].value) * KCAL_PER_KG <= CUT_MAX_DEFICIT * days + 1e-6)
  }
  const plan = visualPlan(state, { look: 'sec', bodyFat: { pct: 20, source: 'mesure' }, start: '2027-01-04', today: '2027-01-04', goal: '2028-06-30' })!
  assert.deepEqual(plan.target, [99, 101])
  assert.ok(plan.cutWeeks * 7 >= cutDaysNeeded(110, 88 / 0.87))
  assert.ok(Math.abs(plan.atGoal.prudent.pct - (1 - plan.lean / plan.atGoal.prudent.weight) * 100) < 1e-9)
})

test('forecast respects mid-week phase boundaries and stops at its target band', () => {
  const p = buildPeriods('2027-06-30', 12, '2027-01-04', null)
  const base = p[0]
  const periods = [
    { ...base, start: '2027-01-04', end: '2027-01-05', phase: 'cut' as const },
    { ...base, start: '2027-01-06', end: '2027-01-10', phase: 'diet-break' as const },
  ]
  const end = plannedWeightPath('2027-01-04', 100, { periods, goal: '2027-01-11' }).at(-1)!.value
  assert.ok(Math.abs(end - (100 - 2 * 500 / 7700)) < 1e-9)
  const stopped = plannedWeightPath('2027-01-04', 100, { periods: p, goal: '2027-06-30', minimumWeight: 99 }).at(-1)!.value
  assert.equal(stopped, 99)
})

test('stale or invalid body data cannot produce a precise visual plan', () => {
  const s = measured([['2026-09-01', 85]])
  assert.equal(visualPlan(s, { look: 'sec', bodyFat: { pct: 20, source: 'mesure' }, today: '2026-10-03' }), null)
  assert.equal(visualPlan(s, { look: 'sec', bodyFat: { pct: NaN, source: 'mesure' }, today: '2026-09-01' }), null)
})
