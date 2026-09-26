// Logic tests: run with `npm test` (node --test + tsx). Pure functions only, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { defaultState, normalizeState, parseBackup, upgradeToResearchProgram } from '../src/lib/backup'
import { applyPlanUpdate, parsePlanUpdate, previewPlanUpdate, sessionPrompt } from '../src/lib/coach'
import { buildIcs, icsEventCount } from '../src/lib/ics'
import * as program from '../src/lib/program'
import {
  buildPeriods, configurePlan, contextAt, DEFAULT_GOAL, isValidGoal, milestones, planShape, prescribe, projectSessions, PROGRAM_START,
  reentryForGap, ROTATION, sessionPlan,
} from '../src/lib/program'
import { calorieAdvice, goalWeightRange, movingAverage7, plannedWeightPath, proteinTargetFor } from '../src/lib/stats'
import {
  applyChange, baselineFor, compareExercise, exerciseHistory, finalizeWorkout, intraSessionAdjust, loadDecision, plannedVolume, progressionFor,
} from '../src/lib/training'
import { loadAt } from '../src/lib/gyms'
import type { AppState, Workout, WorkoutExercise, WorkoutSet } from '../src/lib/types'

// Live bindings: the plan follows configurePlan().
const PERIODS = () => program.PERIODS
const GOAL_DATE = () => program.GOAL_DATE

const BACKUP = process.env.GOLGOTH_BACKUP

function assertTiled(periods: ReturnType<typeof buildPeriods>, goal: string) {
  for (let i = 1; i < periods.length; i++) {
    const prev = new Date(periods[i - 1].end + 'T12:00:00')
    prev.setDate(prev.getDate() + 1)
    assert.equal(prev.toISOString().slice(0, 10), periods[i].start, `${periods[i - 1].id} → ${periods[i].id}`)
  }
  assert.equal(periods[periods.length - 1].end, goal)
}

test('periods tile the calendar without gaps from the foundation to the goal', () => {
  assertTiled(PERIODS(), GOAL_DATE())
})

test('the default goal rebuilds the report calendar exactly', () => {
  const p = buildPeriods(DEFAULT_GOAL)
  const at = (id: string) => p.find((x) => x.id === id)!
  assert.deepEqual([at('b1').start, at('b1').end], ['2026-09-28', '2026-11-01'])
  assert.deepEqual([at('d1').start, at('b2').start, at('b2').end], ['2026-11-02', '2026-11-09', '2026-12-20'])
  assert.deepEqual([at('fetes-2026').start, at('fetes-2026').end], ['2026-12-21', '2027-01-03'])
  assert.equal(at('b3').start, '2027-01-04')
  assert.equal(at('b3').phase, 'cut')
  assert.equal(p.find((x) => x.phase === 'diet-break')!.start, '2027-03-22')
  assert.deepEqual([at('b6').start, at('b6').end, at('b6').phase], ['2027-05-10', '2027-06-13', 'cut-end'])
  assert.deepEqual([at('stab').start, at('stab').end], ['2027-06-14', '2027-06-30'])
  assert.equal(planShape(DEFAULT_GOAL).cutWeeks, 23)
})

test('a later goal lengthens the recomposition; an earlier one shortens the cut', () => {
  for (const goal of ['2027-09-30', '2027-03-31', '2027-02-28', '2026-12-15', '2028-06-30']) {
    assertTiled(buildPeriods(goal), goal)
  }
  const late = planShape('2027-09-30')
  assert.equal(late.cutWeeks, 23)
  assert.ok(late.recompWeeks > planShape(DEFAULT_GOAL).recompWeeks)
  const early = planShape('2027-02-28')
  assert.equal(early.shortCut, true)
  assert.ok(early.cutWeeks < 23)
  assert.equal(isValidGoal('2026-10-15'), false, 'less than 8 weeks after the start')
  assert.equal(isValidGoal('2027-06-30'), true)
  configurePlan('2027-09-30')
  assert.equal(GOAL_DATE(), '2027-09-30')
  assert.equal(PERIODS().at(-1)!.end, '2027-09-30')
  configurePlan(DEFAULT_GOAL)
  assert.equal(GOAL_DATE(), DEFAULT_GOAL)
})

test('an early deload overrides the block for its 7 days', () => {
  configurePlan(DEFAULT_GOAL, { start: '2026-10-13', end: '2026-10-19' })
  const s = defaultState()
  const press = { ...s.templates.UPPER.exercises[0], target: { ...s.templates.UPPER.exercises[0].target, weight: 60 } }
  assert.equal(contextAt('2026-10-14').deload, true)
  assert.equal(prescribe(press, '2026-10-14', null).weight, 55)
  assert.equal(contextAt('2026-10-20').deload, false)
  configurePlan(DEFAULT_GOAL, null)
})

test('block effort follows the report: S1 RIR 3, S2 RIR 2, S3 per exercise, last week 0–1', () => {
  const s = defaultState()
  const iso = s.templates.UPPER.exercises.find((e) => e.exerciseId === 'lateral-raise')!
  const press = s.templates.UPPER.exercises.find((e) => e.exerciseId === 'chest-press')!
  assert.equal(prescribe(iso, '2026-09-28', null).rir, '3')
  assert.equal(prescribe(iso, '2026-10-05', null).rir, '2')
  assert.equal(prescribe(iso, '2026-10-12', null).rir, '0–1')
  assert.equal(prescribe(press, '2026-10-12', null).rir, '1–2')
  assert.equal(prescribe(iso, '2026-10-26', null).rir, '0–1')
  assert.equal(prescribe(press, '2026-10-26', null).rir, '1')
})

test('deload halves sets and takes 10 % off the load', () => {
  const s = defaultState()
  const press = { ...s.templates.UPPER.exercises[0], target: { ...s.templates.UPPER.exercises[0].target, weight: 60 } }
  const rx = prescribe(press, '2026-11-03', null)
  assert.equal(contextAt('2026-11-03').deload, true)
  assert.equal(rx.sets, 2)
  assert.equal(rx.weight, 55)
  assert.equal(rx.rir, '3–4')
})

test('priority muscles gain a set from block 2 week 3, calves from block 3', () => {
  const s = defaultState()
  const lat = s.templates.UPPER.exercises.find((e) => e.exerciseId === 'lateral-raise')!
  const calf = s.templates.LOWER.exercises.find((e) => e.exerciseId === 'calf-press')!
  assert.equal(prescribe(lat, '2026-11-10', null).sets, 3)
  assert.equal(prescribe(lat, '2026-11-24', null).sets, 4)
  assert.equal(prescribe(calf, '2026-11-24', null).sets, 3)
  assert.equal(prescribe(calf, '2027-01-05', null).sets, 4)
})

test('planned weekly volume sits in the 10–20 evidence band for the main muscles', () => {
  const v = plannedVolume(defaultState().templates)
  for (const m of ['chest', 'back', 'sideDelts', 'triceps', 'biceps', 'quads', 'hams', 'glutes'] as const) {
    assert.ok(v[m] >= 10 && v[m] <= 20, `${m} = ${v[m]}`)
  }
})

test('re-entry after a pause follows the report thresholds', () => {
  assert.equal(reentryForGap(5), null)
  assert.equal(reentryForGap(8)?.rir, '2–3')
  assert.equal(reentryForGap(16)?.setsFactor, 0.7)
  assert.equal(reentryForGap(30)?.sessionsLeft, 10)
})

test('projection lays the rotation on the weekly schedule and a missed day shifts it', () => {
  const s: AppState = { ...defaultState(), nextWorkoutType: 'UPPER' }
  const plan = projectSessions(s, '2026-10-04', '2026-09-26')
  assert.deepEqual(plan.map((p) => `${p.date}:${p.type}`), ['2026-09-28:UPPER', '2026-09-29:LOWER', '2026-10-01:PUSH', '2026-10-02:PULL', '2026-10-03:LEGS'])
  const late = projectSessions(s, '2026-10-02', '2026-09-29')
  assert.equal(late[0].type, 'UPPER', 'a missed Monday is not skipped')
})

test('the plan path lands in the report band (82–84 kg from 93 kg)', () => {
  const end = plannedWeightPath('2026-09-28', 93).at(-1)!.value
  assert.ok(end > 82 && end < 84.5, String(end))
  const ma = movingAverage7([{ date: '2026-09-01', value: 93 }, { date: '2026-09-02', value: 92 }])
  assert.equal(ma[1].value, 92.5)
})

test('comparison: same loads compare clean reps, record detection works', () => {
  const ex = (reps: number[]): WorkoutExercise => ({
    exerciseId: 'leg-press', name: 'Presse', muscle: '', unit: 'kg',
    target: { weight: 100, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 },
    sets: reps.map((r) => ({ weight: 100, reps: r, cleanReps: r, flags: [], note: '', completed: true })),
    notes: '', skipped: false, validated: true, comparison: null,
  })
  const c = compareExercise(ex([10, 10, 9]), ex([10, 9, 8]), [], false)
  assert.equal(c.status, 'progress')
  assert.equal(c.deltaCleanReps, 2)
  const p = progressionFor(ex([12, 12, 12]))
  assert.equal(p?.weight, 105)
})

test('coach update: parse a fenced JSON reply, preview, apply', () => {
  const s = defaultState()
  const reply = 'Belle séance.\n```json\n{"type":"golgoth-plan-update","version":1,"summary":"Test","changes":[{"template":"PUSH","exerciseId":"incline-db-press","target":{"weight":22}},{"template":"PUSH","exerciseId":"cable-fly","action":"add","name":"Écarté poulie","unit":"kg","target":{"sets":2}},{"template":"UPPER","exerciseId":"dips","action":"remove"}]}\n```'
  const u = parsePlanUpdate(reply)
  assert.equal(u.changes.length, 3)
  assert.equal(previewPlanUpdate(s, u).map((p) => p.kind).join(','), 'update,add,remove')
  const next = applyPlanUpdate(s, u)
  assert.equal(next.templates.PUSH.exercises.find((e) => e.exerciseId === 'incline-db-press')!.target.weight, 22)
  assert.ok(next.templates.PUSH.exercises.some((e) => e.exerciseId === 'cable-fly'))
  assert.ok(!next.templates.UPPER.exercises.some((e) => e.exerciseId === 'dips'))
  assert.equal(next.appliedPlanUpdates.at(-1)!.source, 'claude')
})

test('ics export is valid RFC 5545 with folded lines', () => {
  const s = defaultState()
  const ics = buildIcs(s, { training: true, weighIn: true, waist: true, photos: true, deloads: true, phases: true }, '2026-09-26')
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'))
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line)
  assert.equal(icsEventCount(ics), 5 + 3 + 4 + 5)
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20270630T235959'))
})

test('milestones start with the program start', () => {
  const m = milestones('2026-09-26')
  assert.equal(m[0].date, PROGRAM_START)
  assert.equal(m.at(-1)!.date, GOAL_DATE())
  assert.ok(m.some((x) => x.title === 'Début de la sèche' && x.date === '2027-01-04'))
})

test('legacy backup: import, upgrade, finish a session', { skip: !BACKUP || !existsSync(BACKUP) }, () => {
  const parsed = parseBackup(readFileSync(BACKUP!, 'utf8'))
  assert.equal(parsed.legacy, true)
  assert.equal(parsed.state.workouts.length, 26)
  assert.equal(parsed.photos.length, 2, 'duplicate photo removed')
  const { state, changes } = upgradeToResearchProgram(parsed.state)
  assert.ok(changes.some((c) => c.kind === 'added' && c.name === 'Hip thrust'))
  assert.equal(state.nextWorkoutType, 'UPPER')
  assert.equal(state.activeWorkout, null, 'empty draft dropped')
  assert.equal(state.templates.UPPER.exercises.find((e) => e.exerciseId === 'chest-press')!.target.weight, 60)
  assert.equal(state.templates.LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!.target.weight, 130)
  assert.equal(state.templates.LOWER.exercises.find((e) => e.exerciseId === 'hip-thrust')!.target.weight, null)
  assert.ok(state.templates.LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!.technique?.includes('siège 4'))
  for (const t of ROTATION) assert.ok(state.templates[t].exercises.length >= 6)
  const withWeight: AppState = { ...state, bodyEntries: [...state.bodyEntries, { id: 'w', date: '2026-09-26', weight: 93, waist: null, arm: null, chest: null, shoulders: null }] }
  const g = goalWeightRange(withWeight, '2026-09-26')!
  assert.equal(`${g.min}–${g.max}`, '82–84')
  const w: Workout = {
    id: 'x', sessionNumber: 27, type: 'UPPER', date: '2026-09-28', startedAt: '2026-09-28T16:00:00Z', completedAt: '2026-09-28T17:05:00Z', notes: '',
    exercises: state.templates.UPPER.exercises.map((e) => ({ ...e, sets: [{ weight: e.target.weight, reps: 10, cleanReps: 10, flags: [], note: '', completed: true }], notes: '', skipped: false, validated: false, comparison: null })),
  }
  const r = finalizeWorkout(state.workouts, w)
  assert.equal(r.workout.exercises.length, 8)
  assert.ok(sessionPrompt(state, r.workout).includes('golgoth-plan-update'))
})

test('normalizeState is total on garbage', () => {
  const s = normalizeState({ workouts: [{ type: 'NOPE' }, null], templates: 3, bodyEntries: 'x' })
  assert.equal(s.workouts.length, 0)
  assert.equal(Object.keys(s.templates).length, 5)
})

// ───────────────────────── Automatic loads ─────────────────────────

const set = (weight: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({ weight, reps, cleanReps: reps, flags: [], note: '', completed: true, rir: null, ...extra })
const exo = (sets: WorkoutSet[], over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: 'leg-press', name: 'Presse à cuisses', muscle: '', unit: 'kg',
  target: { weight: 100, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150, rir: '1–2' },
  prescription: { sets: 3, minReps: 8, maxReps: 12, rir: '1–2', restSeconds: 150, weight: 100, loadFactor: 1, notes: [] },
  sets, notes: '', skipped: false, validated: true, comparison: null, ...over,
})

test('loads go up at the top of the range, down under the bottom, and follow an in-session change', () => {
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12)]))?.kind, 'up')
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12)]))?.weight, 105, 'leg press: 5 kg steps')
  const down = loadDecision(exo([set(100, 6), set(100, 5), set(100, 5)]))
  assert.equal(down?.kind, 'down')
  assert.equal(down?.weight, 95)
  assert.equal(loadDecision(exo([set(100, 10), set(100, 9), set(100, 8)])), null, 'inside the range: nothing moves')
  const moved = loadDecision(exo([set(100, 5), set(90, 9), set(90, 8)]))
  assert.deepEqual([moved?.kind, moved?.weight], ['down', 90])
  const deload = exo([set(90, 12), set(90, 12)], { prescription: { sets: 2, minReps: 8, maxReps: 12, rir: '3–4', restSeconds: 150, weight: 90, loadFactor: 0.9, notes: [] } })
  assert.equal(loadDecision(deload), null, 'deload weeks never move the target')
})

test('a trial session sets the starting load', () => {
  const trial = exo([set(60, 14), set(70, 11), set(80, 6)], { target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 } })
  assert.equal(baselineFor(trial)?.weight, 70)
  const easy = exo([set(70, 12), set(70, 12)], { target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 } })
  assert.equal(baselineFor(easy)?.weight, 75)
})

test('in session: far above the range → heavier next sets, far below → lighter', () => {
  const pending = { ...set(100, 0), completed: false, reps: null, cleanReps: null }
  assert.equal(intraSessionAdjust(exo([set(100, 16), pending, pending]), 0)?.weight, 105)
  assert.equal(intraSessionAdjust(exo([set(100, 19), pending, pending]), 0)?.weight, 110)
  assert.equal(intraSessionAdjust(exo([set(100, 5), pending, pending]), 0)?.weight, 95)
  assert.equal(intraSessionAdjust(exo([set(100, 12, { rir: 5 }), pending]), 0)?.weight, 105, 'top of the range with lots in reserve')
  assert.equal(intraSessionAdjust(exo([set(100, 10), pending, pending]), 0), null)
  assert.equal(intraSessionAdjust(exo([set(100, 16), set(100, 15)]), 1), null, 'no set left to adjust')
})

test('two drops in a row remove one set until the end of the block', () => {
  const s = defaultState()
  const t = s.templates.LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!
  const adjusted = { ...t, autoAdjust: { sets: -1, since: '2026-10-06', reason: 'baisse 2 séances de suite' } }
  assert.equal(prescribe(adjusted, '2026-10-13', null).sets, t.target.sets - 1)
  assert.equal(prescribe(adjusted, '2026-11-10', null).sets, t.target.sets, 'next block: back to the plan')
})

// ───────────────────────── Gyms ─────────────────────────

function workout(id: string, date: string, gymId: string | undefined, exercises: WorkoutExercise[], n: number): Workout {
  return { id, sessionNumber: n, type: 'LOWER', date, startedAt: `${date}T17:00:00Z`, completedAt: `${date}T18:00:00Z`, notes: '', exercises, gymId }
}

test('machines are compared within one gym, free weights across gyms', () => {
  const press = (w: number, reps: number) => exo([set(w, reps), set(w, reps), set(w, reps)])
  const db = (w: number) => exo([set(w, 10)], { exerciseId: 'incline-db-press', unit: 'kg/main' })
  const ws = [
    workout('a', '2026-10-01', undefined, [press(130, 10), db(24)], 1),
    workout('b', '2026-10-08', 'basic', [press(90, 10), db(24)], 2),
  ]
  assert.equal(exerciseHistory(ws, 'leg-press', 'main').length, 1)
  assert.equal(exerciseHistory(ws, 'leg-press', 'basic').length, 1)
  assert.equal(exerciseHistory(ws, 'incline-db-press', 'basic').length, 2, 'dumbbells weigh the same everywhere')
  const next = workout('c', '2026-10-15', 'basic', [press(90, 11)], 3)
  const s = defaultState()
  const r = finalizeWorkout(ws, next, s.templates)
  assert.equal(r.workout.exercises[0].comparison?.status, 'progress', 'compared with the same gym (90 kg), not 130 kg')
})

test('a load learnt in a second gym does not touch the first one', () => {
  const s = defaultState()
  const templates = { ...s.templates, LOWER: { ...s.templates.LOWER, exercises: s.templates.LOWER.exercises.map((e) => (e.exerciseId === 'leg-press' ? { ...e, target: { ...e.target, weight: 130 } } : e)) } }
  const trial = exo([set(90, 10), set(90, 10), set(90, 9)], { target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 } })
  const r = finalizeWorkout([], workout('t', '2026-10-15', 'basic', [trial], 1), templates)
  const c = r.changes.find((x) => x.exerciseId === 'leg-press')!
  assert.deepEqual([c.kind, c.gymId, c.to], ['baseline', 'basic', 90])
  const after = applyChange(templates, c)
  const lp = after.LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!
  assert.equal(loadAt(lp, 'basic'), 90)
  assert.equal(loadAt(lp, 'main'), 130)
  const reverted = applyChange(after, c, true)
  assert.equal(loadAt(reverted.LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!, 'basic'), null)
})

// ───────────────────────── Sessions to the goal & nutrition ─────────────────────────

test('session plan: done + planned sessions, grouped by period', () => {
  const s: AppState = { ...defaultState(), nextWorkoutType: 'UPPER' }
  const plan = sessionPlan(s, '2026-09-26')
  assert.equal(plan.done, 0)
  assert.equal(plan.total, plan.planned)
  assert.equal(plan.segments.reduce((a, x) => a + x.done + x.planned, 0), plan.total)
  assert.ok(plan.total > 180 && plan.total < 205, String(plan.total))
  const four: AppState = { ...s, schedule: { 0: null, 1: 'UPPER', 2: 'LOWER', 3: null, 4: 'PUSH', 5: 'PULL', 6: null } }
  assert.ok(sessionPlan(four, '2026-09-26').total < plan.total, 'fewer training days, fewer sessions')
})

test('protein follows the 7-day average weight', () => {
  const s = defaultState()
  const withWeight: AppState = { ...s, bodyEntries: [{ id: 'a', date: '2026-10-10', weight: 90, waist: null, arm: null, chest: null, shoulders: null }] }
  const p = proteinTargetFor(withWeight, '2026-10-12')
  assert.deepEqual([p.min, p.max], [175, 185])
  const fixed = proteinTargetFor({ ...withWeight, nutritionTargets: { ...withWeight.nutritionTargets, adaptive: false } }, '2026-10-12')
  assert.deepEqual([fixed.min, fixed.max], [180, 190])
})

test('calories: rising weight in recomposition asks for less, no data asks to wait', () => {
  const s = defaultState()
  assert.equal(calorieAdvice(s, '2026-10-20').status, 'wait')
  const entries = Array.from({ length: 21 }, (_, i) => ({ id: `w${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, weight: 93 + i * 0.05, waist: null, arm: null, chest: null, shoulders: null }))
  const a = calorieAdvice({ ...s, bodyEntries: entries }, '2026-10-21')
  assert.equal(a.status, 'lower')
  assert.equal(a.target, s.nutritionTargets.calories - 150)
  const recent = calorieAdvice({ ...s, bodyEntries: entries, nutritionTargets: { ...s.nutritionTargets, caloriesChangedAt: '2026-10-15' } }, '2026-10-21')
  assert.equal(recent.status, 'wait', 'two weeks between changes')
})
