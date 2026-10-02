// Logic tests: run with `npm test` (node --test + tsx). Pure functions only, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { setLang } from '../src/lib/i18n'
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
  applyChange, baselineFor, compareExercise, exerciseHistory, finalizeWorkout, heldByEffort, intraSessionAdjust, knownLoads, loadDecision, plannedVolume,
  progressionFor, sessionEffort, sessionNotes, setScore, setsSummary, toppedOut,
} from '../src/lib/training'
import { loadAt } from '../src/lib/gyms'
import type { AppState, Workout, WorkoutExercise, WorkoutSet } from '../src/lib/types'

// Tests read the French wording (the app's original language).
setLang('fr')

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
  assert.equal(next.appliedPlanUpdates.at(-1)!.source, 'coach')
  // Updates recorded under the former source name are read back as coach updates.
  const legacy = normalizeState({ ...next, appliedPlanUpdates: [{ ...next.appliedPlanUpdates.at(-1)!, source: 'claude' }] })
  assert.equal(legacy.appliedPlanUpdates[0].source, 'coach')
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

test('effort: a set pushed past the planned RIR counts for fewer reps, and never lowers a load', () => {
  const rx = { sets: 3, minReps: 8, maxReps: 12, rir: '3', restSeconds: 150, weight: 100, loadFactor: 1, notes: [] }
  const week1 = { prescription: rx }
  const all = (w: number, reps: number, rir: number | null) => [0, 1, 2].map(() => set(w, reps, { rir }))
  // The top of the range reached at failure, in a week planned at RIR 3: the load stays.
  const pushed = exo(all(100, 12, 0), week1)
  assert.equal(loadDecision(pushed), null)
  assert.equal(heldByEffort(pushed), true)
  // One rep short of the plan, or no effort logged: the reps count as they are.
  assert.equal(loadDecision(exo(all(100, 12, 2), week1))?.weight, 105)
  assert.equal(loadDecision(exo(all(100, 12, null), week1))?.weight, 105)
  assert.equal(heldByEffort(exo(all(100, 12, null), week1)), false)
  // Above the range even once brought back to the planned effort: the load goes up.
  assert.equal(loadDecision(exo(all(100, 14, 0), week1))?.weight, 105)
  // Later in the block, the plan itself asks for that effort.
  assert.equal(loadDecision(exo(all(100, 12, 0)))?.weight, 105)
  // A set flagged as a failure is a set at RIR 0.
  assert.equal(loadDecision(exo([0, 1, 2].map(() => set(100, 12, { flags: ['failure'] })), week1)), null)

  // A heavier load held only at failure: the target is what the planned effort allows, not the load itself.
  const jump = loadDecision(exo(all(120, 8, 0), week1))
  assert.deepEqual([jump?.kind, jump?.weight], ['up', 110])
  assert.match(jump!.text, /RIR 0 .* RIR 3/)
  assert.equal(loadDecision(exo(all(120, 8, 3), week1))?.weight, 120, 'held at the planned effort: adopted as it is')
  assert.equal(loadDecision(exo(all(105, 8, 0), week1)), null, 'no heavier than the target once brought back to the planned effort')
  // The case that showed the gap: a chest press taken from 60 to 80 kg, 3 × 6 at failure, with RIR 3 planned.
  const chest = exo(all(80, 6, 0), {
    exerciseId: 'chest-press',
    target: { weight: 60, sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
    prescription: { ...rx, minReps: 6, maxReps: 10, weight: 60 },
  })
  assert.equal(loadDecision(chest)?.weight, 75)

  // Effort never makes a load lighter: bottom of the range at failure, nothing moves.
  assert.equal(loadDecision(exo(all(100, 8, 0), week1)), null)
  // A trial session keeps a load that holds the range at the planned effort.
  const trial = { target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 150 }, prescription: { ...rx, weight: null } }
  assert.equal(baselineFor(exo(all(70, 12, 0), trial))?.weight, 70, 'top of the range at failure: no step up')
  assert.equal(baselineFor(exo(all(70, 12, 3), trial))?.weight, 75)
  assert.equal(baselineFor(exo(all(70, 8, 0), trial))?.weight, 65, 'bottom of the range at failure: one step lighter')

  // The session summary counts the sets pushed past the plan.
  const w = workout('e', '2026-10-06', undefined, [pushed, exo(all(100, 10, 3), week1), exo(all(100, 10, null), week1)], 1)
  assert.deepEqual(sessionEffort(w), { pushed: 3, logged: 6, planned: '3' })
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

test('progression starts from the load really lifted, not from the target', () => {
  const top = (w: number) => [set(w, 12), set(w, 12), set(w, 12)]
  // Target 100 kg, every set done at 120 kg at the top of the range: one step above 120, not above 100.
  const heavy = loadDecision(exo(top(120)))
  assert.deepEqual([heavy?.kind, heavy?.weight], ['up', 125])
  assert.equal(progressionFor(exo(top(120)))?.weight, 125)
  // Mixed loads: one step above the lightest…
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(105, 12)]))?.weight, 105)
  // …unless the load taken during the session, and held, is heavier.
  assert.equal(loadDecision(exo([set(100, 12), set(120, 12), set(120, 12)]))?.weight, 120)
  // Pain on any set of the exercise: the load does not go up, whichever rule would raise it.
  assert.equal(loadDecision(exo([set(100, 12, { flags: ['pain'] }), set(105, 10), set(105, 10)])), null)
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12), set(100, 12, { flags: ['pain'] })])), null)
  assert.equal(loadDecision(exo([set(100, 9, { flags: ['pain'] }), set(90, 10), set(90, 10)]))?.weight, 90, 'a lighter load is still adopted')
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12), set(100, 8, { flags: ['pain'] }), set(90, 10), set(90, 10)])), null, 'mastered but painful: the load stays, back-off sets do not lower it')
  // A lighter load taken to the top of the range, one step under the target: the target stands.
  assert.equal(loadDecision(exo([set(95, 12), set(95, 12), set(95, 12)])), null)
  assert.equal(loadDecision(exo([set(90, 12), set(90, 12), set(90, 12)]))?.weight, 90)
  assert.equal(loadDecision(exo([set(100, 4), set(100, 4), set(95, 12), set(95, 12)]))?.weight, 95, 'failed at the target: the lighter load mastered is adopted')
})

test('a machine whose loads fall off the standard grid gets its own loads back', () => {
  const press = (weight: number, sets: WorkoutSet[], rir = '1–2') => exo(sets, {
    exerciseId: 'chest-press',
    target: { weight, sets: 3, minReps: 6, maxReps: 10, restSeconds: 150 },
    prescription: { sets: 3, minReps: 6, maxReps: 10, rir, restSeconds: 150, weight, loadFactor: 1, notes: [] },
  })
  const top = (w: number) => [set(w, 10), set(w, 10), set(w, 10)]
  const under = (w: number) => [set(w, 4), set(w, 4), set(w, 3)]
  // Loads on the 2.5 kg grid: the grid, as before.
  assert.equal(loadDecision(press(60, top(60)), [55, 60, 65])?.weight, 62.5)
  // Loads logged on this machine are off the grid: the next one it really has.
  const own = [60, 66.8, 76.8, 80]
  assert.equal(loadDecision(press(60, top(60)), own)?.weight, 66.8)
  assert.equal(loadDecision(press(66.8, top(66.8)), own)?.weight, 70, 'no known load within reach: the standard step')
  assert.equal(loadDecision(press(66.8, under(66.8)), own)?.weight, 60, 'lighter: the load below on the machine')
  // A known load closer than a quarter of a step is the same load, not a step.
  assert.equal(loadDecision(press(62.5, under(62.5)), [62.3, 62.5])?.weight, 60)
  assert.equal(loadDecision(press(60, top(60)), [60, 60.4])?.weight, 62.5)
  // The load brought back to the planned effort is the machine's heaviest that does not exceed the estimate…
  const forced = [set(80, 6, { rir: 0 }), set(80, 6, { rir: 0 }), set(80, 6, { rir: 0 })]
  assert.equal(loadDecision(press(60, forced, '3'), own)?.weight, 66.8)
  assert.equal(loadDecision(press(60, forced, '3'))?.weight, 75)
  // …so it never hands back the load that was forced.
  const db = exo([set(22.5, 9, { rir: 0 }), set(22.5, 9, { rir: 0 })], {
    exerciseId: 'incline-db-press', unit: 'kg/main',
    target: { weight: 20, sets: 2, minReps: 8, maxReps: 12, restSeconds: 120 },
    prescription: { sets: 2, minReps: 8, maxReps: 12, rir: '3', restSeconds: 120, weight: 20, loadFactor: 1, notes: [] },
  })
  assert.equal(loadDecision(db, [17.5, 20, 22.5]), null)
  // In session too; and several steps at once keep the standard arithmetic on standard loads.
  const pending = { ...set(60, 0), completed: false, reps: null, cleanReps: null }
  assert.equal(intraSessionAdjust(press(60, [set(60, 14), pending, pending]), 0, own)?.weight, 66.8)
  assert.equal(intraSessionAdjust(press(60, [set(60, 14), pending, pending]), 0)?.weight, 62.5)
  assert.equal(intraSessionAdjust(press(70, [set(70, 1), { ...pending, weight: 70 }, { ...pending, weight: 70 }]), 0)?.weight, 62.5)
  assert.equal(intraSessionAdjust(exo([set(150, 3), { ...pending, weight: 150 }]), 0)?.weight, 135)
  // The loads come from the history, per gym for a machine; a load seen on a single set does not count.
  const ws = [
    workout('k1', '2026-10-01', undefined, [exo([set(100, 10), set(102.3, 10), set(102.3, 9), { ...set(110, 0), completed: false }])], 1),
    workout('k2', '2026-10-08', 'basic', [exo([set(90, 10), set(90, 10)])], 2),
    workout('k3', '2026-10-09', undefined, [exo([set(100, 10), set(106, 8)])], 3),
  ]
  assert.deepEqual(knownLoads(ws, 'leg-press', 'main'), [100, 102.3])
  assert.deepEqual(knownLoads(ws, 'leg-press', 'basic'), [90])
  // finalizeWorkout uses them: 102.3 has been used here, so the top of the range at 100 leads to it.
  const done = finalizeWorkout(ws, workout('k4', '2026-10-15', undefined, [exo([set(100, 12), set(100, 12), set(100, 12)])], 4), defaultState().templates)
  assert.equal(done.changes.find((c) => c.exerciseId === 'leg-press')?.to, 102.3)
})

test('sessions stay comparable when a load or the number of sets changes', () => {
  const before = exo([set(100, 12), set(100, 11), set(100, 10)])
  // Same loads, one set fewer than last time: compared on the sets both sessions have.
  const fewer = compareExercise(exo([set(100, 10), set(100, 10)]), before, [], false)
  assert.deepEqual([fewer.status, fewer.deltaCleanReps], ['down', -3])
  assert.match(fewer.detail, /2 séries communes \(2 contre 3/)
  const more = compareExercise(exo([set(100, 12), set(100, 12), set(100, 10), set(100, 9)]), before, [], false)
  assert.deepEqual([more.status, more.headline], ['progress', '+1 REP'])
  // Different loads and clearly weaker: a drop, read on the estimated level.
  const weaker = compareExercise(exo([set(102.5, 8), set(100, 8), set(100, 7)]), before, [], false)
  assert.deepEqual([weaker.status, weaker.headline], ['down', 'NIVEAU ESTIMÉ −7 %'])
  // Different loads at the same level: no verdict, as before.
  const same = compareExercise(exo([set(105, 12), set(100, 11), set(100, 10)]), before, [], false)
  assert.deepEqual([same.status, same.headline], ['load-change', 'CHARGE SUPÉRIEURE'])
  // Every set heavier is a progression step: fewer reps are expected, never a drop.
  const step = compareExercise(exo([set(105, 9), set(105, 9), set(105, 8)]), exo([set(100, 12), set(100, 12), set(100, 12)]), [], false)
  assert.deepEqual([step.status, step.headline], ['load-change', 'CHARGE SUPÉRIEURE'])
  // …as long as the heavier load holds the range: a collapse under it is a drop.
  assert.equal(compareExercise(exo([set(102.5, 4), set(102.5, 4), set(102.5, 3)]), exo([set(100, 12), set(100, 12), set(100, 12)]), [], false).status, 'down')

  // The fatigue signal sees two drops in a row through a load change, and removes a set.
  const s = defaultState()
  let ws: Workout[] = []
  const run = (id: string, date: string, ex: WorkoutExercise, n: number, deload = false) => {
    const r = finalizeWorkout(ws, { ...workout(id, date, undefined, [ex], n), deload }, s.templates)
    ws = [...ws, r.workout]
    return r
  }
  run('f1', '2026-10-05', exo([set(100, 12), set(100, 11), set(100, 10)]), 1)
  assert.equal(run('f2', '2026-10-12', exo([set(102.5, 8), set(100, 8), set(100, 7)]), 2).workout.exercises[0].comparison?.status, 'down')
  const third = run('f3', '2026-10-19', exo([set(100, 6), set(100, 6), set(100, 5)]), 3)
  assert.equal(third.alerts.length, 1)
  assert.ok(third.changes.some((c) => c.kind === 'sets' && c.exerciseId === 'leg-press'))
  // Sparse schedule: the same exercise every 17 days, other sessions in between: still compared.
  const sparse = (id: string, date: string, n: number): Workout => ({ ...workout(id, date, undefined, [exo([set(40, 10)], { exerciseId: 'ez-curl' })], n), type: 'UPPER' })
  ws = [...ws, sparse('g1', '2026-10-24', 31), sparse('g2', '2026-10-29', 32)]
  const later = run('f3b', '2026-11-05', exo([set(100, 5), set(100, 5), set(100, 4)]), 33)
  assert.equal(later.workout.exercises[0].comparison?.status, 'down', '17 days since the last leg press, but no break in training')
  // Two empty weeks are a break: no verdict.
  const afterBreak = finalizeWorkout(ws.filter((x) => !x.id.startsWith('g') && x.id !== 'f3b'), workout('f3c', '2026-11-05', undefined, [exo([set(100, 5), set(100, 5), set(100, 4)])], 34), s.templates)
  assert.equal(afterBreak.workout.exercises[0].comparison?.headline, 'APRÈS UNE PAUSE')
  // A deload in between starts the comparison again.
  run('f4', '2026-11-09', exo([set(90, 8), set(90, 8)]), 35, true)
  const after = run('f5', '2026-11-16', exo([set(100, 6), set(100, 6), set(100, 5)]), 36)
  assert.equal(after.workout.exercises[0].comparison?.headline, 'APRÈS SÉANCE ALLÉGÉE')
  assert.equal(after.alerts.length, 0)
})

test('a drop is only called when the plan or the effort does not explain it', () => {
  const rx = (rir: string, loadFactor = 1, weight = 100) => ({ prescription: { sets: 3, minReps: 8, maxReps: 12, rir, restSeconds: 150, weight, loadFactor, notes: [] } })
  const hard = exo([set(100, 10), set(100, 10), set(100, 9)], rx('1'))
  // Back after a break, on lightened loads, exactly as prescribed: not a measure, and not a reference for the next one.
  const back = exo([set(92.5, 10), set(92.5, 10), set(92.5, 10)], rx('2–3', 0.925, 92.5))
  assert.equal(compareExercise(back, hard, [], false).headline, 'SÉANCE ALLÉGÉE')
  assert.equal(compareExercise(hard, back, [], false).headline, 'APRÈS SÉANCE ALLÉGÉE')
  // The plan asks for more in reserve than last time (first week of a block, holidays): the reps it costs are not a drop…
  const eased = compareExercise(exo([set(100, 8), set(100, 8), set(100, 7)], rx('3')), hard, [], false)
  assert.deepEqual([eased.status, eased.headline], ['stable', 'MOINS DE REPS, PLUS DE MARGE'])
  // …beyond what it explains, they are.
  assert.equal(compareExercise(exo([set(100, 6), set(100, 6), set(100, 5)], rx('3')), hard, [], false).status, 'down')
  // The effort logged says more than the plan: at failure, nothing was kept in reserve.
  const forced = exo([set(100, 8, { rir: 0 }), set(100, 8, { rir: 0 }), set(100, 7, { rir: 0 })], rx('3'))
  assert.equal(compareExercise(forced, hard, [], false).status, 'down')
  // Reps kept in reserve on purpose, at the same planned effort: read against the reserve logged last time.
  const tight = exo([set(100, 10, { rir: 1 }), set(100, 10, { rir: 1 }), set(100, 9, { rir: 1 })], rx('1'))
  const spared = exo([set(100, 9, { rir: 3 }), set(100, 9, { rir: 3 }), set(100, 8, { rir: 3 })], rx('1'))
  assert.equal(compareExercise(spared, tight, [], false).status, 'stable')
  // Against a session where no effort was logged, the same plan excuses nothing.
  assert.equal(compareExercise(spared, hard, [], false).status, 'down')
  // Reserve logged on both sides is compared with itself: the same RIR every time excuses nothing.
  const logged = (reps: number) => exo([set(100, reps, { rir: 2 }), set(100, reps, { rir: 2 }), set(100, reps, { rir: 2 })], rx('0–1'))
  assert.equal(compareExercise(logged(13), logged(14), [], false).status, 'down')
  assert.equal(compareExercise(exo([set(100, 9, { rir: 3 }), set(100, 9, { rir: 3 }), set(100, 9, { rir: 3 })], rx('0–1')), logged(10), [], false).status, 'stable')
  // Nothing logged: only what the plans ask for counts, and only when today's asks for more reserve.
  const block = exo([set(100, 11), set(100, 10), set(100, 10)], rx('1'))
  assert.equal(compareExercise(exo([set(100, 9), set(100, 9)], rx('2–3')), block, [], false).headline, 'MOINS DE REPS, PLUS DE MARGE')
  assert.equal(compareExercise(exo([set(100, 10), set(100, 9), set(100, 9)], rx('1–2')), exo([set(100, 10), set(100, 10), set(100, 10)], rx('1–2')), [], false).status, 'down')
  // Two weeks or more without any session since: the last one is no longer a reference.
  assert.equal(compareExercise(exo([set(100, 9), set(100, 8)], rx('3')), hard, [], false, false, 17).headline, 'APRÈS UNE PAUSE')
  assert.equal(compareExercise(exo([set(100, 8), set(100, 8), set(100, 8)], rx('1')), hard, [], false, false, 9).status, 'down')
  // Logging the effort one session out of two is no standing excuse: without an eased plan, nothing is spared.
  const drop = exo([set(100, 9, { rir: 1 }), set(100, 9, { rir: 1 }), set(100, 8, { rir: 1 })], rx('0–1'))
  assert.equal(compareExercise(drop, exo([set(100, 10), set(100, 10), set(100, 9)], rx('0–1')), [], false).status, 'down')
  assert.equal(compareExercise(exo([set(100, 8), set(100, 8), set(100, 7)], rx('0–1')), drop, [], false).status, 'down')
  // An eased plan, and the reserve logged today matches it: the reps it costs are excused.
  assert.equal(compareExercise(exo([set(100, 8, { rir: 3 }), set(100, 8, { rir: 3 }), set(100, 7, { rir: 3 })], rx('3')), hard, [], false).status, 'stable')
  // A plan that asks for more effort never turns equal reps into a drop.
  assert.equal(compareExercise(exo([set(100, 10), set(100, 10), set(100, 9)], rx('0–1')), exo([set(100, 10), set(100, 10), set(100, 9)], rx('3')), [], false).status, 'stable')
  // At different loads too: a lighter holiday session with reps in hand is not a drop, a weaker one at failure is.
  const holiday = exo([set(95, 10), set(95, 10)], rx('2–3'))
  assert.equal(compareExercise(holiday, hard, [], false).status, 'load-change')
  const weak = exo([set(95, 9, { rir: 0 }), set(95, 9, { rir: 0 })], rx('2–3'))
  assert.equal(compareExercise(weak, hard, [], false).status, 'down')
})

test('bodyweight work: added load is proposed at the top of the range and tracked', () => {
  const dips = (sets: WorkoutSet[], lest: number | null = null, rir = '1–2') => exo(sets, {
    exerciseId: 'dips', name: 'Dips', unit: 'PDC',
    target: { weight: lest, sets: 2, minReps: 8, maxReps: 12, restSeconds: 120 },
    prescription: { sets: 2, minReps: 8, maxReps: 12, rir, restSeconds: 120, weight: lest, loadFactor: 1, notes: [] },
  })
  // Top of the range at body weight: 2.5 kg added next time.
  const first = loadDecision(dips([set(null, 12), set(null, 12)]))
  assert.deepEqual([first?.kind, first?.weight], ['up', 2.5])
  assert.match(first!.text, /^2 × 12 atteint : PDC \+2,5\skg la prochaine fois$/)
  assert.equal(loadDecision(dips([set(null, 12), set(null, 9)])), null, 'not at the top yet')
  // With added load: one more step; under the range: one step less, down to none.
  assert.equal(loadDecision(dips([set(2.5, 12), set(2.5, 12)], 2.5))?.weight, 5)
  assert.equal(loadDecision(dips([set(5, 6), set(5, 5)], 5))?.weight, 2.5)
  assert.equal(loadDecision(dips([set(2.5, 6), set(2.5, 5)], 2.5))?.weight, 0)
  assert.equal(loadDecision(dips([set(null, 6), set(null, 5)])), null, 'nothing to take off at body weight')
  // The added load is what was typed: body weight alone when the proposal was not followed, and the target goes back to none.
  const ignored = loadDecision(dips([set(null, 11), set(null, 10)], 2.5))
  assert.deepEqual([ignored?.kind, ignored?.weight], ['down', 0])
  assert.equal(loadDecision(dips([set(null, 12), set(null, 12)], 2.5)), null, 'top of the range again without it: the proposal stands')
  // Added load taken during the session and held: it becomes the target; held only by forcing, it does not.
  assert.equal(loadDecision(dips([set(5, 9), set(5, 8)]))?.weight, 5)
  assert.equal(loadDecision(dips([set(5, 8, { rir: 0 }), set(5, 8, { rir: 0 })], null, '3')), null)
  // Effort counts as for any load.
  assert.equal(loadDecision(dips([set(null, 12, { rir: 0 }), set(null, 12, { rir: 0 })], null, '3')), null)
  // Bands and floor work take no load: nothing to raise, the top of the range is only pointed out.
  const pushups = exo([set(null, 25), set(null, 25), set(null, 25)], {
    exerciseId: 'push-up', unit: 'PDC',
    target: { weight: null, sets: 3, minReps: 8, maxReps: 25, restSeconds: 90 },
    prescription: { sets: 3, minReps: 8, maxReps: 25, rir: '1–2', restSeconds: 90, weight: null, loadFactor: 1, notes: [] },
  })
  assert.equal(loadDecision(pushups), null)
  assert.equal(toppedOut(pushups), true)
  assert.equal(toppedOut(dips([set(null, 12), set(null, 12)])), false, 'dips take added load instead')
  // Added load counts in the level and shows in the summary of the sets.
  assert.ok(setScore(set(2.5, 11), 'PDC') > setScore(set(null, 12), 'PDC'))
  assert.equal(setScore(set(null, 12), 'PDC'), 12)
  assert.equal(setsSummary([set(null, 12), set(2.5, 10)], 'PDC'), 'PDC×12 · PDC+2,5×10')
  assert.equal(compareExercise(dips([set(2.5, 11), set(2.5, 10)], 2.5), dips([set(null, 12), set(null, 12)]), [], false).detail, 'Lest différent de la dernière fois.')
  // The decision is written in the template; back to none is stored as no load.
  const s = defaultState()
  const change = { id: 'c', type: 'UPPER' as const, exerciseId: 'dips', name: 'Dips', gymId: 'main', date: '2026-10-06', kind: 'up' as const, from: null, to: 2.5, text: '' }
  const loaded = applyChange(s.templates, change)
  assert.equal(loaded.UPPER.exercises.find((e) => e.exerciseId === 'dips')!.target.weight, 2.5)
  assert.equal(prescribe(loaded.UPPER.exercises.find((e) => e.exerciseId === 'dips')!, '2026-10-13', null).weight, 2.5)
  assert.equal(applyChange(loaded, { ...change, kind: 'down', from: 2.5, to: 0 }).UPPER.exercises.find((e) => e.exerciseId === 'dips')!.target.weight, null)
})

test('the priority set of a building block waits for rising performance', () => {
  configurePlan(DEFAULT_GOAL)
  const s = defaultState()
  const lat = s.templates.UPPER.exercises.find((e) => e.exerciseId === 'lateral-raise')!
  const session = (id: string, date: string, status: 'progress' | 'stable' | 'down' | 'load-change', n: number, headline = ''): Workout => ({
    ...workout(id, date, undefined, [{ ...exo([set(6, 15)], { exerciseId: 'lateral-raise', unit: 'kg/main' }), comparison: { status, headline, chargeValidated: false, isRecord: false } as WorkoutExercise['comparison'] }], n),
    type: 'UPPER',
  })
  // Block 2 runs from 9 Nov; its third week starts on the 23rd.
  const w3 = '2026-11-24'
  const at = (workouts: Workout[], date = w3, today = date) => prescribe(lat, date, null, undefined, workouts, today)
  assert.equal(prescribe(lat, w3, null).sets, 4, 'without the history (plan projections): the set is there')
  const held = at([])
  assert.equal(held.sets, 3)
  assert.ok(held.notes.some((n) => n.startsWith('Série prioritaire en attente')))
  assert.equal(at([session('r1', '2026-11-10', 'progress', 1), session('r2', '2026-11-17', 'stable', 2)]).sets, 4)
  assert.equal(at([session('r1', '2026-11-10', 'load-change', 1, 'CHARGE SUPÉRIEURE')]).sets, 4, 'a heavier load is progress')
  assert.equal(at([session('r1', '2026-11-10', 'load-change', 1, 'RÉPARTITION DES CHARGES MODIFIÉE')]).sets, 3)
  assert.equal(at([session('r1', '2026-11-10', 'down', 1), session('r2', '2026-11-17', 'progress', 2)]).sets, 3, 'as many drops as progress')
  assert.equal(at([session('r0', '2026-10-20', 'progress', 1)]).sets, 3, 'progress in the previous block does not count')
  // Decided on weeks 1 and 2: what happens from week 3 on does not take the set away.
  assert.equal(at([session('r1', '2026-11-10', 'progress', 1), session('r3', '2026-11-24', 'down', 3)], '2026-12-01').sets, 4)
  // Looking ahead from before week 3 (calendar, plan): nothing can be said yet, the planned set shows.
  assert.equal(at([], w3, '2026-11-12').sets, 4)
  // In the cut, the set is the volume kept from the previous block: no condition.
  assert.equal(at([], '2027-01-05').sets, 4)
})

test('session notes: pain that comes back, and a plateau outside the cut', () => {
  configurePlan(DEFAULT_GOAL)
  const s = defaultState()
  let ws: Workout[] = []
  const run = (id: string, date: string, sets: WorkoutSet[], n: number, deload = false) => {
    const r = finalizeWorkout(ws, { ...workout(id, date, undefined, [exo(sets)], n), deload }, s.templates)
    ws = [...ws, r.workout]
    return r.workout
  }
  const flat = (reps = 10) => [set(100, reps), set(100, reps), set(100, reps)]
  // Pain: named once, then flagged as coming back.
  const hurt = () => [set(100, 10), set(100, 10, { flags: ['pain'] }), set(100, 10)]
  const p1 = run('n1', '2026-10-05', hurt(), 1)
  assert.deepEqual(sessionNotes(ws, p1), { pain: ['Presse à cuisses'], painAgain: [], plateau: [] })
  const p2 = run('n2', '2026-10-12', hurt(), 2)
  assert.deepEqual(sessionNotes(ws, p2).painAgain, ['Presse à cuisses'])
  // Plateau: four sessions in a row with nothing gained.
  ws = []
  run('q1', '2026-10-05', flat(), 1)
  run('q2', '2026-10-08', flat(), 2)
  run('q3', '2026-10-12', flat(), 3)
  assert.deepEqual(sessionNotes(ws, run('q4', '2026-10-15', flat(), 4)).plateau, [], 'the first session is a baseline, not a stall')
  assert.deepEqual(sessionNotes(ws, run('q5', '2026-10-19', flat(), 5)).plateau, ['Presse à cuisses'])
  assert.deepEqual(sessionNotes(ws, run('q6', '2026-10-22', [set(100, 11), set(100, 10), set(100, 10)], 6)).plateau, [], 'one more rep ends it')
  // A record set right after a deload is progress, even though that session has no verdict.
  ws = []
  run('d1', '2026-10-05', flat(), 1)
  run('d2', '2026-10-12', flat(), 2)
  run('d3', '2026-10-19', flat(), 3)
  run('d4', '2026-11-03', [set(90, 8), set(90, 8)], 4, true)
  run('d5', '2026-11-10', flat(11), 5)
  run('d6', '2026-11-12', flat(11), 6)
  assert.deepEqual(sessionNotes(ws, run('d7', '2026-11-16', flat(11), 7)).plateau, [])
  // During the cut, holding the loads is the goal: no plateau.
  ws = []
  for (const [i, d] of ['2027-01-05', '2027-01-08', '2027-01-12', '2027-01-15'].entries()) run(`c${i}`, d, flat(), i + 1)
  assert.deepEqual(sessionNotes(ws, run('c5', '2027-01-19', flat(), 5)).plateau, [])
})

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

// ───────────────────────── Visual goal ─────────────────────────

test('visual goal: waist-based body fat, target weight, cut length', async () => {
  const { relativeFatMass, bodyFatEstimate, visualPlan, tagPriorities } = await import('../src/lib/visual')
  assert.equal(Math.round(relativeFatMass(189, 98)), 25)
  const s: AppState = { ...defaultState(), profile: { heightCm: 189, age: 33, sex: 'm' }, bodyEntries: [{ id: 'w', date: '2026-09-20', weight: 93, waist: 98, arm: null, chest: null, shoulders: null }] }
  const bf = bodyFatEstimate(s)!
  assert.equal(bf.source, 'tour de taille')
  const p = visualPlan(s, { look: 'taille', bodyFat: bf, today: '2026-09-27' })!
  assert.ok(p.target[0] > 75 && p.target[1] < 80, p.target.join('–'))
  assert.ok(p.cutWeeks > 23, 'a leaner look asks for a longer cut')
  assert.equal(p.fits, true)
  assert.ok(p.atGoal.fast.weight < p.atGoal.prudent.weight)
  const measured = bodyFatEstimate(s, { override: 18 })!
  assert.equal(measured.source, 'mesure')
  // The plan follows the cut length of an applied look, and the base plan comes back without it.
  assert.equal(planShape(DEFAULT_GOAL, p.cutWeeks).cutWeeks, p.cutWeeks)
  assertTiled(buildPeriods(DEFAULT_GOAL, p.cutWeeks), DEFAULT_GOAL)
  // Zones: one exercise per zone and per session.
  const t = tagPriorities(s.templates, ['epaules', 'bras'])
  const upper = t.UPPER.exercises.filter((e) => e.focus).map((e) => e.exerciseId)
  assert.deepEqual(upper, ['lateral-raise', 'triceps-overhead-rope'])
  assert.ok(!Object.values(t).some((x) => x.exercises.some((e) => e.volumeTag === 'priority')), 'zones replace the V-shape tags')
  const back = tagPriorities(t, [])
  assert.deepEqual(back.UPPER.exercises.filter((e) => e.volumeTag === 'priority').map((e) => e.exerciseId), ['lateral-raise'], 'report tags restored')
  assert.ok(!Object.values(back).some((x) => x.exercises.some((e) => e.focus)), 'no zone left')
  assert.ok(back.LOWER.exercises.some((e) => e.volumeTag === 'calves'), 'calves rule untouched')
  // Calves as a zone: the extra set comes on top of the calves rule.
  const calfPress = tagPriorities(s.templates, ['mollets']).LOWER.exercises.find((e) => e.exerciseId === 'calf-press')!
  assert.equal(calfPress.volumeTag, 'calves')
  assert.equal(calfPress.focus, true)
  configurePlan(DEFAULT_GOAL)
  const firstCut = PERIODS().find((x) => x.kind === 'block' && x.phase === 'cut')!
  assert.equal(prescribe(calfPress, firstCut.start, null).sets, calfPress.target.sets + 2)
})

test('visual goal: half-kilo targets, looks reached, block notes follow the zones', async () => {
  const { bodyFatEstimate, lookFor, reachesLook, visualPlan, zonesText } = await import('../src/lib/visual')
  const s: AppState = { ...defaultState(), profile: { heightCm: 189, age: 33, sex: 'm' }, bodyEntries: [{ id: 'w', date: '2026-09-20', weight: 93, waist: 98, arm: null, chest: null, shoulders: null }] }
  const p = visualPlan(s, { look: 'taille', bodyFat: bodyFatEstimate(s)!, today: '2026-09-27' })!
  assert.ok(p.target.every((x) => Number.isInteger(x * 2)), `targets in 0.5 kg steps: ${p.target.join('–')}`)
  // 8.6 % reads as 9 %: taillé, not très sec; 14.7 % is athlétique.
  assert.equal(lookFor(8.6, 'm')?.id, 'taille')
  assert.equal(lookFor(14.7, 'm')?.id, 'athletique')
  assert.equal(lookFor(19, 'm'), null)
  assert.equal(p.reached?.id, p.atGoal.prudent.look?.id)
  assert.ok(reachesLook(lookFor(8, 'm'), 'taille') && !reachesLook(lookFor(12, 'm'), 'taille'))
  assert.equal(zonesText(['epaules', 'pectoraux', 'bras']), 'épaules, pectoraux et bras')
  assert.equal(zonesText(['dos']), 'dos')
  assert.equal(zonesText([]), null)
  configurePlan(DEFAULT_GOAL, null, p.cutWeeks, zonesText(['epaules', 'bras']))
  assert.equal(PERIODS().find((x) => x.id === 'b2')?.note, '+1 série sur épaules et bras à partir de S3, si les performances montent.')
  configurePlan(DEFAULT_GOAL)
  assert.equal(PERIODS().find((x) => x.id === 'b2')?.note, '+1 série sur deltoïdes latéraux, dos et pectoraux à partir de S3, si les performances montent.')
})

test('onboarding: a new user starts this week, with the goal and the sessions chosen', async () => {
  const { stateFromOnboarding, onboardingPreview } = await import('../src/lib/onboarding')
  const { programStartFor, defaultGoalFor, sessionItems } = program
  assert.equal(programStartFor('2026-10-07'), '2026-10-05', 'a Wednesday starts that week')
  assert.equal(programStartFor('2026-10-10'), '2026-10-12', 'a Saturday starts next Monday')
  assert.equal(defaultGoalFor('2026-09-28'), '2027-06-30', 'the report’s dates come back')
  const answers = {
    lang: 'fr' as const, setup: { place: 'gym' as const, equipment: [] }, days: [1, 3, 5], sex: 'm' as const,
    age: 30, heightCm: 178, weight: 80, waist: 86, look: 'sec' as const, goalDate: '2027-07-31',
  }
  const preview = onboardingPreview(answers, '2026-10-07')
  assert.equal(preview.start, '2026-10-05')
  assert.ok(preview.plan && preview.plan.cutWeeks >= 8, 'a cut sized from the waist')
  const s = stateFromOnboarding(answers, '2026-10-07')
  assert.equal(s.settings.programStart, '2026-10-05')
  assert.equal(s.settings.foundationStart, null)
  assert.equal(s.settings.goalDate, '2027-07-31')
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].filter((d) => s.schedule[d]), [1, 3, 5])
  assert.equal(s.bodyEntries[0].weight, 80)
  assert.ok(s.nutritionTargets.calories > 1800 && s.nutritionTargets.calories < 3200, String(s.nutritionTargets.calories))
  assert.equal(typeof s.visualGoal?.cutWeeks, 'number')
  // The plan of this user: no foundation, first block on the start, goal on the chosen date.
  configurePlan(s.settings.goalDate, null, s.visualGoal!.cutWeeks, null, { start: s.settings.programStart, foundation: null })
  assert.equal(PERIODS()[0].kind, 'block')
  assert.equal(PERIODS()[0].start, '2026-10-05')
  assertTiled(PERIODS(), '2027-07-31')
  configurePlan(DEFAULT_GOAL)
  assert.equal(PERIODS()[0].id, 'fondation', 'the report’s data keeps its foundation')
  // Already lean: no cut, recomposition until the stabilization.
  const lean = onboardingPreview({ ...answers, waist: 74, look: 'athletique' }, '2026-10-07')
  assert.equal(lean.plan?.cutWeeks, 0)
  assert.equal(lean.shape.cutWeeks, 0)
  assert.ok(sessionItems('UPPER').length === 8)
})

test('home training: each gym exercise becomes the best version the equipment allows', async () => {
  const { sessionItems, doableAt, buildResearchTemplates } = program
  const ids = (setup: { place: 'home'; equipment: ('dumbbells' | 'bench' | 'pullupBar' | 'bands')[] }, t: 'UPPER' | 'LOWER' | 'PULL') => sessionItems(t, setup).map((i) => i.id)
  assert.deepEqual(ids({ place: 'home', equipment: ['dumbbells', 'bench'] }, 'UPPER'), [
    'db-bench-press', 'one-arm-db-row', 'incline-db-press', 'inverted-row', 'lateral-raise', 'db-overhead-extension', 'db-curl', 'close-grip-push-up',
  ])
  const bare = ids({ place: 'home', equipment: [] }, 'UPPER')
  assert.deepEqual(bare, ['push-up', 'inverted-row', 'feet-elevated-push-up', 'doorframe-row', 'close-grip-push-up'])
  assert.ok(ids({ place: 'home', equipment: ['pullupBar'] }, 'PULL').includes('pull-up'))
  assert.ok(ids({ place: 'home', equipment: [] }, 'LOWER').includes('bulgarian-split-squat'))
  // Every home choice is doable with the equipment, and no id repeats within a session.
  for (const equipment of [[], ['dumbbells'], ['bands'], ['dumbbells', 'bench', 'pullupBar', 'bands']] as const) {
    const setup = { place: 'home' as const, equipment: [...equipment] }
    const tpl = buildResearchTemplates(undefined, [], setup)
    for (const t of Object.values(tpl)) {
      const list = t.exercises.map((e) => e.exerciseId)
      assert.equal(new Set(list).size, list.length, `${t.type} ${equipment.join('+')}: no duplicates`)
      for (const id of list) assert.ok(doableAt(id, setup), `${id} with ${equipment.join('+') || 'bodyweight'}`)
      assert.ok(list.length >= 3, `${t.type} with ${equipment.join('+') || 'bodyweight'} keeps a session`)
    }
  }
  // Bodyweight versions use their own rep ranges.
  const push = buildResearchTemplates(undefined, [], { place: 'home', equipment: [] }).UPPER.exercises.find((e) => e.exerciseId === 'push-up')!
  assert.deepEqual([push.target.minReps, push.target.maxReps], [8, 25])
  assert.equal(push.unit, 'PDC')
})

test('English: labels, dates, plurals and stored names follow the language', async () => {
  const { setLang: set } = await import('../src/lib/i18n')
  const { fmtDate } = await import('../src/lib/date')
  const { plural, fmtLoad } = await import('../src/lib/format')
  const { LOOKS } = await import('../src/lib/visual')
  const { localizeState } = await import('../src/lib/localize')
  set('en')
  try {
    assert.equal(fmtDate('2027-06-30', { long: true, year: true }), '30 June 2027')
    assert.equal(fmtDate('2026-10-01'), '1 Oct')
    assert.equal(plural(1, 'week', 'weeks'), '1 week')
    assert.equal(plural(0, 'week', 'weeks'), '0 weeks')
    assert.equal(fmtLoad(null, 'PDC'), 'BW')
    assert.equal(LOOKS.find((l) => l.id === 'taille')?.label, 'Ripped')
    assert.equal(program.TYPE_META.UPPER.fr, 'Upper body')
    configurePlan('2027-06-30')
    assert.ok(!/Bloc |Sèche|Décharge/.test(PERIODS().map((p) => p.label).join(' ')), 'periods rebuilt in English')
    const en = localizeState(defaultState())
    assert.equal(en.templates.UPPER.exercises.find((e) => e.exerciseId === 'lat-pulldown')?.name, 'Lat pulldown')
    assert.equal(en.gyms[0].name, 'My gym')
  } finally {
    set('fr')
    configurePlan(DEFAULT_GOAL)
  }
  assert.equal(fmtDate('2026-10-01'), '1er oct.')
  assert.equal(localizeState(defaultState()).templates.UPPER.exercises.find((e) => e.exerciseId === 'lat-pulldown')?.name, 'Tirage vertical')
})

// ───────────────────────── Maintenance mode ─────────────────────────

test('maintenance mode: blocks and deloads with no cut, no stabilization and no end date', () => {
  const { buildMaintenancePeriods, maintenanceHorizon } = program
  assert.equal(maintenanceHorizon('2026-09-28', '2026-09-28'), '2028-01-02', 'to the end of next year’s holidays')
  assert.equal(maintenanceHorizon('2027-12-30', '2026-09-28'), '2029-01-07')
  const p = buildMaintenancePeriods('2026-09-28', null, '2028-01-02')
  assertTiled(p, '2028-01-02')
  assert.ok(p.every((x) => x.phase === 'upkeep' || x.kind === 'holiday'), 'no recomposition, no cut')
  assert.ok(!p.some((x) => x.kind === 'stabilization'))
  assert.deepEqual(p.filter((x) => x.kind === 'holiday').map((x) => x.id), ['fetes-2026', 'fetes-2027'])
  // Until the first holidays, the same blocks as the report's recomposition.
  const report = buildPeriods(DEFAULT_GOAL, 23, '2026-09-28', null).filter((x) => x.end < '2026-12-21').map((x) => [x.id, x.start, x.end])
  assert.deepEqual(p.filter((x) => x.end < '2026-12-21').map((x) => [x.id, x.start, x.end]), report)
  // Blocks last 4 to 6 weeks, each one but the last before the holidays followed by a deload.
  for (let i = 0; i < p.length; i++) {
    const x = p[i]
    if (x.kind !== 'block') continue
    const weeks = program.periodWeeks(x)
    assert.ok(weeks >= 4 && weeks <= 6, `${x.id}: ${weeks} weeks`)
    assert.ok(p[i + 1].kind === 'deload' || p[i + 1].kind === 'holiday', `${x.id} → ${p[i + 1].id}`)
  }
  // Extending the plan by a year never moves the blocks already laid out.
  const longer = buildMaintenancePeriods('2026-09-28', null, '2029-01-07')
  assert.deepEqual(longer.slice(0, p.length).map((x) => [x.id, x.start, x.end]), p.map((x) => [x.id, x.start, x.end]))
})

test('maintenance mode: live plan, cycle count, no goal milestone, back to a dated plan', () => {
  try {
    configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-09-28', foundation: null, maintenance: true, today: '2026-10-14' })
    assert.equal(program.MAINTENANCE, true)
    assert.equal(GOAL_DATE(), '2028-01-02', 'the plan ends where the calendar is laid out')
    const ctx = contextAt('2026-10-14')
    assert.equal(ctx.phase?.id, 'upkeep')
    assert.equal(ctx.title, 'Bloc 1 · S3')
    assert.ok(!milestones('2026-10-14').some((m) => m.kind === 'goal'))
    assert.ok(!PERIODS().some((p) => p.phase === 'cut' || p.kind === 'stabilization'))
    // The hero counts the current cycle: block 1 and its deload.
    const s: AppState = {
      ...defaultState(),
      settings: { ...defaultState().settings, programStart: '2026-09-28', foundationStart: null, maintenance: true },
      workouts: [workout('old', '2026-08-20', undefined, [], 1), workout('a', '2026-09-29', undefined, [], 2)],
    }
    const plan = sessionPlan(s, '2026-10-14')
    assert.deepEqual(plan.cycle, { start: '2026-09-28', end: '2026-11-08', label: 'Bloc 1' })
    assert.equal(plan.done, 1, 'only the sessions of the cycle')
    assert.equal(plan.total, plan.done + plan.planned)
    assert.ok(plan.planned >= 15 && plan.planned <= 20, String(plan.planned))
    assert.deepEqual(plan.segments.map((x) => x.kind), ['block', 'deload'])
    // In the deload, the cycle is still block 1 + its deload; after it, block 2.
    assert.equal(sessionPlan(s, '2026-11-04').cycle?.label, 'Bloc 1')
    assert.equal(sessionPlan(s, '2026-11-10').cycle?.label, 'Bloc 2')
    // Stable weight asked: gaining 0.5 %/week asks for fewer calories.
    const entries = Array.from({ length: 21 }, (_, i) => ({ id: `w${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, weight: 80 + i * 0.06, waist: null, arm: null, chest: null, shoulders: null }))
    assert.equal(calorieAdvice({ ...s, bodyEntries: entries }, '2026-10-21').status, 'lower')
    assert.equal(goalWeightRange({ ...s, bodyEntries: entries.slice(-1) }, '2026-10-21')?.computed, true)
    // The ics export has no goal day.
    assert.ok(!buildIcs(s, { training: true, weighIn: false, waist: false, photos: false, deloads: true, phases: true }, '2026-10-14').includes('golgoth-goal@'))
  } finally {
    configurePlan(DEFAULT_GOAL)
  }
  assert.equal(program.MAINTENANCE, false)
  assert.equal(GOAL_DATE(), DEFAULT_GOAL)
  assert.ok(PERIODS().some((p) => p.kind === 'stabilization'), 'back to a dated plan')
})

test('maintenance mode: onboarding without a goal date, and backups keep the mode', async () => {
  const { stateFromOnboarding, onboardingPreview } = await import('../src/lib/onboarding')
  const answers = {
    lang: 'fr' as const, setup: { place: 'gym' as const, equipment: [] }, days: [1, 2, 4, 5, 6], sex: 'm' as const,
    age: 30, heightCm: 178, weight: 80, waist: 86, look: 'sec' as const, goalDate: '2027-07-31',
  }
  const dated = onboardingPreview(answers, '2026-10-07')
  const preview = onboardingPreview({ ...answers, maintenance: true }, '2026-10-07')
  assert.equal(preview.plan, null)
  assert.equal(preview.shape, null)
  assert.ok(preview.calories > dated.calories, 'maintenance calories, no deficit')
  assert.equal(preview.until, '2026-11-08', 'first block of a start on 5 October: 5 weeks')
  assert.ok(preview.sessions >= 20 && preview.sessions <= 30, String(preview.sessions))
  const s = stateFromOnboarding({ ...answers, maintenance: true }, '2026-10-07')
  assert.equal(s.settings.maintenance, true)
  assert.equal(s.settings.goalDate, '2027-07-31', 'kept for later')
  assert.equal(s.visualGoal, null)
  assert.equal(s.nutritionTargets.calories, preview.calories)
  assert.equal(normalizeState(JSON.parse(JSON.stringify(s))).settings.maintenance, true)
  assert.equal(normalizeState(JSON.parse(JSON.stringify(stateFromOnboarding(answers, '2026-10-07')))).settings.maintenance, undefined)
  // Leaving maintenance offers the date kept from before, or nine months out once it is too close.
  assert.equal(program.resumeGoalFor('2027-07-31', '2026-10-07', '2026-10-05'), '2027-07-31')
  assert.equal(program.resumeGoalFor('2026-11-15', '2026-10-07', '2026-10-05'), '2027-07-31')
})

test('maintenance mode: a look brings back the date it needs, not an arbitrary one', async () => {
  const { earliestGoalFor, visualPlan } = await import('../src/lib/visual')
  const s: AppState = {
    ...defaultState(),
    profile: { heightCm: 180, age: 31, sex: 'm' },
    bodyEntries: [{ id: 'b', date: '2026-09-28', weight: 82, waist: 88, arm: null, chest: null, shoulders: null }],
  }
  try {
    configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-09-28', foundation: null, maintenance: true, today: '2026-09-28' })
    const bodyFat = { pct: 20, source: 'mesure' as const }
    const lean = earliestGoalFor(s, { look: 'sec', bodyFat, today: '2026-09-28' })!
    const ripped = earliestGoalFor(s, { look: 'taille', bodyFat, today: '2026-09-28' })!
    assert.ok(lean >= '2026-11-23', lean)
    assert.ok(ripped > lean, `${ripped} after ${lean}: a leaner look needs a longer cut`)
    assert.equal(visualPlan(s, { look: 'taille', bodyFat, today: '2026-09-28', start: '2026-09-28', goal: ripped })!.fits, true)
  } finally {
    configurePlan(DEFAULT_GOAL)
  }
})
