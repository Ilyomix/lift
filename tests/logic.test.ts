// Logic tests: run with `npm test` (node --test + tsx). Pure functions only, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { setLang } from '../src/lib/i18n'
import { defaultState, normalizeState, parseBackup, upgradeToResearchProgram } from '../src/lib/backup'
import { applyPlanUpdate, globalPrompt, parsePlanUpdate, previewPlanUpdate, sessionPrompt } from '../src/lib/coach'
import { addDays } from '../src/lib/date'
import { buildIcs, icsEventCount } from '../src/lib/ics'
import * as program from '../src/lib/program'
import {
  buildPeriods, configurePlan, contextAt, DEFAULT_GOAL, isValidGoal, milestones, planShape, prescribe, projectSessions, PROGRAM_START,
  reentryForGap, ROTATION, sessionPlan,
} from '../src/lib/program'
import { calorieAdvice, calorieFloor, calorieStepPatch, cutAdvice, goalWeightRange, movingAverage7, plannedWeightPath, proteinTargetFor, restingCalories, TREND_DAYS, weightStatus } from '../src/lib/stats'
import {
  appliedState, applyChange, baselineFor, changeLabel, changesOf, changeState, compareExercise, countedDrop, dropAlert, dropMargin, exerciseHistory, finalizeWorkout, findChange, finishedState,
  heldByEffort, intraSessionAdjust, knownLoads, lastFinished, loadDecision, plannedVolume, previousPerformance, progressionFor, reopenedState, revertedState, sessionEffort, sessionNotes, setScore,
  setsSummary, toppedOut, withoutWorkout,
} from '../src/lib/training'
import { loadAt } from '../src/lib/gyms'
import { infoFor } from '../src/lib/library'
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

test('fewer than five training days: sessions take more sets and the week keeps its volume', () => {
  const MAIN = ['chest', 'back', 'sideDelts', 'triceps', 'biceps', 'quads', 'hams', 'glutes'] as const
  const s = defaultState()
  const slots = (type: 'UPPER' | 'LOWER' | 'PUSH' | 'PULL' | 'LEGS') => program.sessionSlots(s.templates[type].exercises)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  // The multiplier: the plan from five days, 5/4 at four, 5/3 at three and below.
  assert.deepEqual([7, 6, 5, 4].map((d) => program.daysFactorFor(d)), [1, 1, 1, 1.25])
  assert.equal(program.daysFactorFor(3), 5 / 3)
  assert.equal(program.daysFactorFor(2), 5 / 3, 'no further: one session can only use so many sets for a muscle')
  assert.equal(program.daysFactorFor(3, false), 1, 'turned off: the plan’s sessions')

  // A session is scaled as a whole: its total is the nearest whole number, the larger remainders first.
  assert.deepEqual(program.scaledSession(slots('UPPER'), 1), [3, 3, 2, 3, 3, 2, 2, 2])
  // 20 sets become 25: the four exercises of 3 sets go to 4; of those of 2, the one whose muscle has the least (triceps).
  assert.deepEqual(program.scaledSession(slots('UPPER'), 1.25), [4, 4, 2, 4, 4, 3, 2, 2])
  // 18 sets become 23: calves and abs are served before a second quadriceps exercise.
  assert.deepEqual(program.scaledSession(slots('LOWER'), 1.25), [4, 4, 4, 3, 4, 4])
  // Sheets of two sets, or of one, are scaled too (each exercise alone would round to nothing).
  const custom = (sets: number[]) => sets.map((n, i) => ({ exerciseId: `custom-${i}`, muscle: '', sets: n }))
  assert.deepEqual(program.scaledSession(custom([2, 2, 2, 2]), 1.25), [3, 3, 2, 2])
  assert.deepEqual(program.scaledSession(custom([1, 1, 1, 1]), 1.25), [2, 1, 1, 1])
  assert.deepEqual(program.scaledSession(custom([1, 1, 1]), 5 / 3), [2, 2, 1])
  // Equal remainders stay equal whatever the arithmetic says: 2 × 5/3 and 5 × 5/3 both leave a third.
  assert.deepEqual(program.scaledSession(custom([2, 5]), 5 / 3), [4, 8])
  assert.deepEqual(program.scaledSession(custom([1, 4]), 5 / 3), [2, 6])
  // No muscle past about 11 sets in one session: added sets are taken back, never the plan's.
  assert.deepEqual(program.scaledSession(slots('PULL'), 5 / 3), [4, 4, 3, 5, 5, 5, 5], 'back: 4 + 4 + 3 = 11, not 13')
  assert.deepEqual(program.scaledSession(slots('UPPER'), 5 / 3), [5, 5, 3, 5, 5, 3, 4, 3], 'the spare set goes to the biceps, chest is at 11')
  assert.deepEqual(program.scaledSession(slots('PUSH'), 5 / 3), [5, 3, 5, 7, 4, 3], 'triceps: 2.5 + 1.5 + 4 + 3 = 11, not 12')
  assert.deepEqual(program.scaledSession([{ exerciseId: 'chest-press', sets: 12 }], 5 / 3), [12], 'a sheet above the ceiling keeps its sets')
  for (const days of [4, 3, 2]) {
    for (const type of ROTATION) {
      const out = program.scaledSession(slots(type), program.daysFactorFor(days))
      const perMuscle: Record<string, number> = {}
      s.templates[type].exercises.forEach((e, i) => {
        assert.ok(out[i] >= e.target.sets, `${type} ${e.exerciseId}`)
        for (const [g, f] of Object.entries(infoFor(e.exerciseId, e).groups)) perMuscle[g] = (perMuscle[g] ?? 0) + out[i] * (f ?? 0)
      })
      for (const [g, n] of Object.entries(perMuscle)) assert.ok(n <= program.SESSION_MUSCLE_CAP, `${days} days, ${type} ${g} = ${n}`)
    }
  }

  // The week: the plan's volume at four days, about 97 % at three, muscle by muscle in the 10–20 band.
  const five = plannedVolume(s.templates)
  for (const days of [4, 3]) {
    const v = plannedVolume(s.templates, days)
    for (const m of MAIN) {
      assert.ok(v[m] >= 10 && v[m] <= 20, `${days} days, ${m} = ${v[m]}`)
      assert.ok(Math.abs(v[m] - five[m]) <= 1.5, `${days} days, ${m}: ${v[m]} against ${five[m]} at five days`)
    }
  }
  // At four days no muscle is left behind, the small ones included.
  for (const m of [...MAIN, 'rearDelts', 'calves', 'abs'] as const) {
    const ratio = plannedVolume(s.templates, 4)[m] / five[m]
    assert.ok(ratio >= 0.95 && ratio <= 1.08, `${m}: ${Math.round(ratio * 100)} % of the plan at four days`)
  }
  const week = (days: number, keep = true) => program.weekShape(program.templateSets(s.templates), days, keep)
  assert.deepEqual([week(5).sets, week(5).minutes, week(5).share], [[17, 20], [60, 65], 1])
  assert.deepEqual([week(4).sets, week(4).minutes, week(4).share], [[21, 25], [70, 80], 1])
  assert.deepEqual([week(3).sets, week(3).minutes, Math.round(week(3).share * 100)], [[27, 33], [90, 100], 97])
  assert.deepEqual(program.weekShape(program.planSets(), 3), week(3), 'the report’s plan and the default sheets are the same sessions')
  // Below three days, and with the choice turned off, the week holds less; above five days, more.
  assert.equal(Math.round(week(2).share * 100), 64)
  assert.ok(MAIN.every((m) => plannedVolume(s.templates, 2)[m] < 10 && plannedVolume(s.templates, 2)[m] >= 4))
  assert.equal(week(3, false).share, 0.6)
  assert.equal(plannedVolume(s.templates, 3, false).chest, (five.chest * 3) / 5)
  assert.equal(plannedVolume(s.templates, 6).back, five.back * 1.2)
  assert.equal(program.sharePhrase(1), 'le volume prévu')
  assert.equal(program.sharePhrase(0.96), 'environ 96 % du volume prévu')
  assert.deepEqual([program.keepsPlan(0.97), program.keepsPlan(1.03), program.keepsPlan(0.965), program.keepsPlan(1.07)], [true, true, false, false])
  assert.equal(program.sharePhrase(week(3).share), 'environ 97 % du volume prévu', 'three days: close to the plan, and said so')
  assert.equal(program.sharePhrase(week(4).share), 'le volume prévu')
  // Custom exercises: the muscle is read from its label ("abdos" is not a back, rear delts are not side delts).
  assert.deepEqual(['Abdos', 'Abs', 'Dos', 'Deltoïdes postérieurs', 'Rear delts', 'Deltoïdes latéraux', 'Chaîne postérieure'].map((m) => Object.keys(infoFor('custom-x', { muscle: m }).groups)), [['abs'], ['abs'], ['back'], ['rearDelts'], ['rearDelts'], ['sideDelts'], []])
  assert.equal(program.sessionMinutes('UPPER', 20), 65, 'the plan’s session keeps its length')
  assert.equal(program.sessionMinutes('UPPER', 10), 40, 'a deload session is shorter')
  assert.equal(program.sessionMinutes('UPPER', 40), 120, 'a sheet twice as long is not an hour either')

  // In a session: the prescriptions follow the training days of the plan.
  const upper = s.templates.UPPER.exercises
  const origin = { start: '2026-09-28', foundation: '2026-08-10' }
  const setsOf = (date: string, list = upper) => program.prescribeSession(list, date, null).map((p) => p.sets)
  try {
    configurePlan(DEFAULT_GOAL, null, null, null, { ...origin, days: 4 })
    assert.deepEqual(setsOf('2026-10-06'), [4, 4, 2, 4, 4, 3, 2, 2])
    // What the plan asks at five days is kept aside: loads are judged on those sets.
    assert.deepEqual(program.prescribeSession(upper, '2026-10-06', null).map((p) => p.planSets), [3, 3, undefined, 3, 3, 2, undefined, undefined])
    assert.deepEqual(setsOf('2026-11-03'), [2, 2, 1, 2, 2, 2, 1, 1], 'deload: half of the session’s sets')
    // The priority set is scaled with the session: 21 sets become 26.
    const priority = program.prescribeSession(upper, '2026-11-24', null)
    assert.equal(priority.reduce((a, p) => a + p.sets, 0), 26)
    assert.equal(priority[4].sets, 5)
    assert.deepEqual(priority[4].notes, ['+1 série (muscle prioritaire)'])
    // Two drops in a row take one set off what is really done.
    const dropped = upper.map((e, i) => (i === 0 ? { ...e, autoAdjust: { sets: -1, since: '2026-10-06', reason: 'baisse 2 séances de suite' } } : e))
    assert.equal(setsOf('2026-10-13', dropped)[0], 3)
    // The brief for an AI says so, and the calendar event lasts as long as the session.
    assert.match(globalPrompt(s), /Je m’entraîne 4\sjours par semaine : .*×1,25 sur l’ensemble.* la semaine tient le volume prévu/)
    assert.ok(buildIcs(s, { training: true, weighIn: false, waist: false, photos: false, deloads: false, phases: false }, '2026-09-26').includes('DURATION:PT80M'), 'Upper: 25 sets, 80 min')

    configurePlan(DEFAULT_GOAL, null, null, null, { ...origin, days: 3 })
    assert.deepEqual(setsOf('2026-10-06'), [5, 5, 3, 5, 5, 3, 4, 3])
    assert.deepEqual(setsOf('2026-11-03'), [3, 3, 2, 3, 3, 2, 2, 2], 'deload')
    const priority3 = program.prescribeSession(upper, '2026-11-24', null)
    assert.equal(priority3[4].sets, 7, 'priority: (3 + 1) × 5/3, side delts stay under the ceiling')
    assert.deepEqual(priority3[4].notes, ['+2 séries (muscle prioritaire)'])
    configurePlan(DEFAULT_GOAL, null, null, null, { ...origin, days: 2 })
    assert.deepEqual(setsOf('2026-10-06'), [5, 5, 3, 5, 5, 3, 4, 3], 'two days: no more than at three')
    configurePlan(DEFAULT_GOAL, null, null, null, { ...origin, days: 3, keepVolume: false })
    assert.deepEqual(setsOf('2026-10-06'), [3, 3, 2, 3, 3, 2, 2, 2], 'turned off')
    assert.match(globalPrompt(s), /Je m’entraîne 3\sjours par semaine avec les séances de base : .* environ 60 % du volume prévu/)
    configurePlan(DEFAULT_GOAL, null, null, null, { ...origin, days: 6 })
    assert.deepEqual(setsOf('2026-10-06'), [3, 3, 2, 3, 3, 2, 2, 2], 'six days: the plan’s sessions')
  } finally {
    configurePlan(DEFAULT_GOAL)
  }
  assert.deepEqual(setsOf('2026-10-06'), [3, 3, 2, 3, 3, 2, 2, 2], 'five days: the plan')
  assert.ok(program.prescribeSession(upper, '2026-10-06', null).every((p) => !('planSets' in p)), 'five days: nothing added to the prescription')
  assert.deepEqual(program.prescribeSession(upper, '2026-10-06', null)[0], prescribe(upper[0], '2026-10-06', null), 'one exercise or the whole session: the same at five days')
  assert.doesNotMatch(globalPrompt(s), /Je m’entraîne/)

  // Loads: the top of the range is asked of the plan's sets, not of the sets added to keep the volume.
  const five3 = { prescription: { sets: 5, planSets: 3, minReps: 8, maxReps: 12, rir: '1–2', restSeconds: 150, weight: 100, loadFactor: 1, notes: [] } }
  const up = loadDecision(exo([set(100, 12), set(100, 12), set(100, 12), set(100, 10), set(100, 9)], five3))
  assert.deepEqual([up?.kind, up?.weight], ['up', 105])
  assert.match(up!.text, /^3 × 12 atteint/)
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12)], five3))?.weight, 105, 'out of time after the plan’s sets: the load still goes up')
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 11), set(100, 12), set(100, 12)], five3)), null, 'the third set is one of the plan’s')
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12), set(100, 10), set(100, 9)], { prescription: { ...five3.prescription, planSets: undefined } })), null, 'without it, every prescribed set counts')
  // The other rules read the plan's sets too: what happens on the added sets does not move the target.
  assert.equal(loadDecision(exo([set(100, 10), set(100, 9), set(100, 8), set(95, 9), set(95, 9)], five3)), null, 'added sets done lighter: the target stays')
  assert.equal(loadDecision(exo([set(100, 10), set(100, 9), set(100, 8), set(105, 8), set(105, 8)], five3)), null, 'added sets done heavier: the target stays')
  const held = loadDecision(exo([set(105, 9), set(105, 8), set(105, 8), set(100, 9), set(100, 8)], five3))
  assert.deepEqual([held?.kind, held?.weight], ['up', 105], 'a heavier load held on the plan’s sets becomes the target, as at five days')
  const under = loadDecision(exo([set(100, 6), set(100, 5), set(100, 5), set(95, 9), set(95, 8)], five3))
  assert.deepEqual([under?.kind, under?.weight], ['down', 95], 'the plan’s sets under the range: lighter, whatever the added sets did')
  assert.equal(loadDecision(exo([set(100, 12), set(100, 12), set(100, 12), set(100, 10, { flags: ['pain'] }), set(100, 9)], five3)), null, 'pain counts on every set')

  // One session a week is a rhythm, not a break after each of them.
  const only = (days: number[]) => ({ schedule: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, days.includes(d) ? ('UPPER' as const) : null])) })
  assert.deepEqual([[1], [1, 4], [6, 0], [1, 2, 4, 5, 6]].map((d) => program.scheduledGap(only(d))), [7, 4, 6, 2])

  // The choice survives a backup, and is on unless turned off.
  assert.equal(normalizeState({ ...s, prefs: { ...s.prefs, keepWeeklyVolume: false } }).prefs.keepWeeklyVolume, false)
  assert.equal(normalizeState({ ...s, prefs: { theme: 'dark' } }).prefs.keepWeeklyVolume, true)
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
  // A calorie change made by the coach is dated like any other; the same figure, or no figure, dates nothing.
  assert.equal(next.nutritionTargets.caloriesChangedAt, undefined)
  const fed = applyPlanUpdate(s, { ...u, nutritionTargets: { calories: 2200 } }, '2026-10-02')
  assert.deepEqual([fed.nutritionTargets.calories, fed.nutritionTargets.caloriesChangedAt], [2200, '2026-10-02'])
  assert.equal(applyPlanUpdate(s, { ...u, nutritionTargets: { calories: s.nutritionTargets.calories } }, '2026-10-02').nutritionTargets.caloriesChangedAt, undefined)
  // Figures only: a number written as text is read (and dated); a date or a record of the app found in the reply is not taken.
  const loose = applyPlanUpdate(s, { ...u, nutritionTargets: { calories: '2200', proteinMin: 'beaucoup', caloriesChangedAt: '1999-01-01', sizedStep: { at: '2026-10-01', from: 3000, to: 2000 } } as never }, '2026-10-02')
  assert.deepEqual([loose.nutritionTargets.calories, loose.nutritionTargets.proteinMin, loose.nutritionTargets.caloriesChangedAt, loose.nutritionTargets.sizedStep], [2200, s.nutritionTargets.proteinMin, '2026-10-02', undefined])
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

test('the fatigue signal has a margin: a drop counts from one rep per set on average', () => {
  // Mitter 2022: at a fixed load a set moves by about one rep between two weeks; Hopkins 2000: real beyond 1.5–2 times that.
  assert.deepEqual([1, 2, 3, 4, 7].map(dropMargin), [2, 2, 3, 4, 7])
  const reps = (...r: number[]) => exo(r.map((n) => set(100, n)))
  const ref = reps(10, 10, 9)
  // One or two reps lost over three sets: shown, and inside normal variation.
  const dip = compareExercise(reps(10, 9, 9), ref, [], false)
  assert.deepEqual([dip.status, dip.marked, dip.headline, dip.detail], ['down', false, '−1 REP VS DERNIÈRE FOIS', 'Variation normale d’une séance à l’autre.'])
  assert.equal(compareExercise(reps(9, 9, 9), ref, [], false).marked, false)
  // One rep per set: a clear drop.
  const clear = compareExercise(reps(9, 9, 8), ref, [], false)
  assert.deepEqual([clear.status, clear.marked, clear.detail], ['down', true, 'Nette baisse : au-delà de la variation normale.'])
  // The margin follows the sets both sessions have, with two reps as a floor.
  assert.deepEqual([compareExercise(reps(9, 10), ref, [], false).marked, compareExercise(reps(9, 9), ref, [], false).marked], [false, true])
  assert.deepEqual([compareExercise(reps(9), ref, [], false).marked, compareExercise(reps(8), ref, [], false).marked], [false, true])
  const four = reps(10, 10, 9, 9)
  assert.deepEqual([compareExercise(reps(9, 9, 8, 9), four, [], false).marked, compareExercise(reps(9, 9, 8, 8), four, [], false).marked], [false, true])
  // Reps kept in reserve come off first: four reps fewer, two of them explained, is normal variation.
  const rx = { prescription: { sets: 3, minReps: 8, maxReps: 12, rir: '1', restSeconds: 150, weight: 100, loadFactor: 1, notes: [] } }
  const tight = exo([set(100, 10, { rir: 1 }), set(100, 10, { rir: 1 }), set(100, 9, { rir: 1 })], rx)
  const partly = compareExercise(exo([set(100, 9, { rir: 2 }), set(100, 8, { rir: 2 }), set(100, 8, { rir: 1 })], rx), tight, [], false)
  assert.deepEqual([partly.status, partly.marked, partly.deltaCleanReps], ['down', false, -4])
  assert.match(partly.detail, /^Plus de marge gardée .* variation normale\.$/)
  // At different loads a drop is only called beyond the level tolerance: it always counts.
  assert.equal(compareExercise(exo([set(102.5, 8), set(100, 8), set(100, 7)]), exo([set(100, 12), set(100, 11), set(100, 10)]), [], false).marked, true)
  // Progress and equal performance carry no verdict of that kind.
  assert.equal(compareExercise(reps(10, 10, 10), ref, [], false).marked, undefined)

  // Two drops in a row remove a set only when both are clear.
  const s = defaultState()
  const sessions = (list: WorkoutExercise[]) => {
    let ws: Workout[] = []
    let last = finalizeWorkout(ws, workout('m0', '2026-10-05', undefined, [list[0]], 1), s.templates)
    ws = [last.workout]
    for (const [i, ex] of list.slice(1).entries()) {
      last = finalizeWorkout(ws, workout(`m${i + 1}`, addDays('2026-10-05', 7 * (i + 1)), undefined, [ex], i + 2), s.templates)
      ws = [...ws, last.workout]
    }
    return { last, ws }
  }
  const block = (list: number[][]) => sessions(list.map((r) => reps(...r)))
  const alerted = (list: number[][]) => block(list).last.alerts.length
  assert.equal(alerted([[10, 10, 9], [10, 9, 9], [9, 9, 9]]), 0, 'a rep lost twice is normal variation')
  assert.equal(alerted([[10, 10, 9], [9, 9, 9], [9, 8, 8]]), 0, 'two reps lost twice: still under one rep per set')
  assert.equal(alerted([[11, 11, 10], [10, 10, 9], [10, 9, 9]]), 0, 'a clear drop, then a dip')
  assert.equal(alerted([[11, 11, 10], [11, 10, 10], [10, 9, 9]]), 0, 'a dip, then a clear drop: one bad day')
  const tired = block([[11, 11, 10], [10, 10, 9], [9, 9, 8]])
  assert.equal(tired.last.alerts.length, 1)
  assert.match(tired.last.alerts[0], /nette baisse 2 séances de suite/)
  assert.deepEqual(tired.last.changes.filter((c) => c.kind === 'sets').map((c) => [c.from, c.to, c.text]), [[3, 2, 'Nette baisse 2 séances de suite : 1 série de moins jusqu’à la fin du bloc']])
  assert.equal(tired.last.generalDrop, false)
  // On the sheet the set comes off with today's words, whatever the words it was stored with.
  const sheet = applyChange(s.templates, tired.last.changes.find((c) => c.kind === 'sets')!).LOWER.exercises.find((e) => e.exerciseId === 'leg-press')!
  assert.deepEqual([sheet.autoAdjust?.sets, sheet.autoAdjust?.reason], [-1, 'nette baisse 2 séances de suite'])
  assert.ok(prescribe(sheet, '2026-10-20', null).notes.includes('−1 série (nette baisse 2 séances de suite)'))
  assert.ok(prescribe({ ...sheet, autoAdjust: { ...sheet.autoAdjust!, reason: 'down 2 sessions in a row' } }, '2026-10-20', null).notes.includes('−1 série (nette baisse 2 séances de suite)'))
  // The signal belongs to the session of the second drop: left out of the next one, the exercise does not raise it again.
  const skipped = finalizeWorkout(tired.ws, workout('m9', '2026-10-26', undefined, [{ ...reps(9, 9, 8), sets: [], skipped: true }], 4), s.templates)
  assert.deepEqual([skipped.alerts.length, skipped.changes.length], [0, 0])

  // Sessions logged before the margin existed carry no verdict: the reps they kept are measured again.
  const legacy = (ws: Workout[]): Workout[] => ws.map((w) => ({ ...w, exercises: w.exercises.map((e) => { const { marked: _m, ...c } = e.comparison!; return { ...e, comparison: c } }) }))
  const next = (ws: Workout[], r: number[]) => [...ws, finalizeWorkout(ws, workout('m9', '2026-10-19', undefined, [reps(...r)], 3), s.templates).workout]
  const old = legacy(block([[10, 10, 9], [10, 9, 9]]).ws)
  assert.equal(old[1].exercises[0].comparison?.marked, undefined)
  assert.equal(countedDrop(exerciseHistory(old, 'leg-press')[1]), false)
  assert.equal(dropAlert(next(old, [9, 8, 8]), 'leg-press'), null)
  const oldClear = legacy(block([[11, 11, 10], [10, 10, 9]]).ws)
  assert.equal(countedDrop(exerciseHistory(oldClear, 'leg-press')[1]), true)
  assert.ok(dropAlert(next(oldClear, [9, 9, 8]), 'leg-press'))
  const oldLevel = legacy(sessions([reps(12, 11, 10), exo([set(102.5, 8), set(100, 8), set(100, 7)])]).ws)
  assert.equal(oldLevel[1].exercises[0].comparison?.headline, 'NIVEAU ESTIMÉ −7 %')
  assert.equal(countedDrop(exerciseHistory(oldLevel, 'leg-press')[1]), false, 'at different loads it may have been read against the other rep range: not counted')
  assert.equal(dropAlert(next(oldLevel, [6, 6, 5]), 'leg-press'), null)

  // Four sessions without progress whose last two are small dips: a plateau, no longer hidden behind a drop that is none.
  configurePlan(DEFAULT_GOAL)
  const stall = block([[10, 10, 10], [10, 10, 10], [10, 10, 10], [10, 10, 9], [10, 9, 9]])
  assert.deepEqual(sessionNotes(stall.ws, stall.last.workout).plateau, ['Presse à cuisses'])
  const falling = block([[11, 11, 11], [11, 11, 11], [11, 11, 11], [10, 10, 10], [9, 9, 9]])
  assert.deepEqual(sessionNotes(falling.ws, falling.last.workout).plateau, [], 'two clear drops: the set already came off')
})

test('an exercise two sessions have: followed like for like, one load per rep range', () => {
  const base = defaultState().templates
  const sheets = (loads: Partial<Record<Workout['type'], Record<string, number | null>>>) =>
    Object.fromEntries(Object.entries(base).map(([type, t]) => [type, { ...t, exercises: t.exercises.map((e) => (loads[type as Workout['type']]?.[e.exerciseId] !== undefined ? { ...e, target: { ...e.target, weight: loads[type as Workout['type']]![e.exerciseId] } } : e)) }])) as typeof base
  // The exercise as a session builds it: its target is the sheet's load at the gym of the session.
  const live = (tpl: typeof base, type: Workout['type'], id: string, sets: WorkoutSet[], gymId = 'main'): WorkoutExercise => {
    const t = tpl[type].exercises.find((e) => e.exerciseId === id)!
    const weight = loadAt(t, gymId)
    return { ...t, target: { ...t.target, weight }, prescription: { sets: t.target.sets, minReps: t.target.minReps, maxReps: t.target.maxReps, rir: t.target.rir ?? '1–2', restSeconds: t.target.restSeconds, weight, loadFactor: 1, notes: [] }, sets, notes: '', skipped: false, validated: true, comparison: null }
  }
  const of = (tpl: typeof base, type: Workout['type'], id: string) => tpl[type].exercises.find((e) => e.exerciseId === id)!
  const play = (tpl: typeof base, plan: [Workout['type'], string, number, number[]][], gymId?: string) => {
    let ws: Workout[] = []
    const out = plan.map(([type, id, load, r], i) => {
      const date = addDays('2026-10-05', 3 * i)
      const res = finalizeWorkout(ws, { ...workout(`t${i}`, date, gymId, [live(tpl, type, id, r.map((n) => set(load, n)), gymId)], i + 1), type }, tpl)
      ws = [...ws, res.workout]
      return res
    })
    return { out, ws }
  }

  // Lat pulldown: 6–10 heavy in Pull, 8–12 lighter in Upper. One rep per set lost at every session.
  const two = sheets({ PULL: { 'lat-pulldown': 55 }, UPPER: { 'lat-pulldown': 50 } })
  const lat = play(two, [
    ['PULL', 'lat-pulldown', 55, [10, 10, 9]], ['UPPER', 'lat-pulldown', 50, [12, 11, 11]],
    ['PULL', 'lat-pulldown', 55, [9, 9, 8]], ['UPPER', 'lat-pulldown', 50, [11, 10, 10]],
    ['PULL', 'lat-pulldown', 55, [8, 8, 7]], ['UPPER', 'lat-pulldown', 50, [10, 9, 9]],
  ])
  const verdict = (r: ReturnType<typeof finalizeWorkout>) => r.workout.exercises[0].comparison!
  // The first session in each range is its baseline: no verdict between two prescriptions.
  assert.deepEqual([verdict(lat.out[1]).status, verdict(lat.out[1]).detail], ['new-baseline', 'Première séance dans cette fourchette de reps.'])
  // Then each range is compared with itself: Pull with the Pull before, through the Upper session in between.
  assert.deepEqual([verdict(lat.out[2]).status, verdict(lat.out[2]).deltaCleanReps, verdict(lat.out[2]).previousSetReps], ['down', -3, [10, 10, 9]])
  assert.deepEqual([verdict(lat.out[3]).status, verdict(lat.out[3]).previousSetReps], ['down', [12, 11, 11]])
  // Two clear drops in a row in one range: the signal fires there, and the set comes off that session's sheet only.
  assert.deepEqual(lat.out.map((r) => r.alerts.length), [0, 0, 0, 0, 1, 1])
  const cut = lat.out[4].changes.find((c) => c.kind === 'sets')!
  assert.deepEqual([cut.type, cut.also], ['PULL', undefined])
  const afterCut = applyChange(two, cut)
  assert.deepEqual([of(afterCut, 'PULL', 'lat-pulldown').autoAdjust?.sets, of(afterCut, 'UPPER', 'lat-pulldown').autoAdjust], [-1, undefined])
  // previousPerformance: the same range first, the last one anywhere without it.
  assert.equal(previousPerformance(lat.ws, 'lat-pulldown', undefined, 'main', { minReps: 6, maxReps: 10 })?.workout.id, 't4')
  assert.equal(previousPerformance(lat.ws, 'lat-pulldown', undefined, 'main', { minReps: 10, maxReps: 15 })?.workout.id, 't5')
  assert.equal(previousPerformance(lat.ws, 'lat-pulldown', undefined, 'main')?.workout.id, 't5')
  assert.deepEqual(exerciseHistory(lat.ws, 'lat-pulldown', 'main', { minReps: 8, maxReps: 12 }).map((h) => h.workoutId), ['t1', 't3', 't5'])
  // Another range at the same loads is still read on the reps.
  const edited = exo([set(100, 10), set(100, 10), set(100, 10)], { target: { weight: 100, sets: 3, minReps: 6, maxReps: 10, restSeconds: 150, rir: '1–2' } })
  assert.deepEqual([compareExercise(edited, exo([set(100, 10), set(100, 10), set(100, 9)]), [], false).headline, compareExercise({ ...edited, sets: [set(110, 8), set(110, 8), set(110, 7)] }, exo([set(100, 10), set(100, 10), set(100, 9)]), [], false).status], ['+1 REP', 'new-baseline'])
  // The heavy range moves its own load: the other sheet keeps its own.
  const top = play(two, [['PULL', 'lat-pulldown', 55, [10, 10, 10]]]).out[0].changes[0]
  assert.deepEqual([top.kind, top.to, top.also], ['up', 57.5, undefined])
  assert.equal(of(applyChange(two, top), 'UPPER', 'lat-pulldown').target.weight, 50)

  // Leg curl: 10–15 in Lower and in Legs. One exercise in one range has one load.
  const same = sheets({ LOWER: { 'leg-curl': 40 }, LEGS: { 'leg-curl': 40 } })
  const up = play(same, [['LOWER', 'leg-curl', 40, [15, 15, 15]]]).out[0].changes[0]
  assert.deepEqual([up.kind, up.from, up.to, up.also], ['up', 40, 42.5, ['LEGS']])
  const raised = applyChange(same, up)
  assert.deepEqual([of(raised, 'LOWER', 'leg-curl').target.weight, of(raised, 'LEGS', 'leg-curl').target.weight], [42.5, 42.5])
  const undone = applyChange(raised, up, true)
  assert.deepEqual([of(undone, 'LOWER', 'leg-curl').target.weight, of(undone, 'LEGS', 'leg-curl').target.weight], [40, 40])
  // A sheet edited since keeps what was typed, in both directions.
  const typed = sheets({ LOWER: { 'leg-curl': 40 }, LEGS: { 'leg-curl': 47.5 } })
  assert.equal(of(applyChange(typed, up), 'LEGS', 'leg-curl').target.weight, 47.5)
  assert.equal(of(applyChange({ ...raised, LEGS: typed.LEGS }, up, true), 'LEGS', 'leg-curl').target.weight, 47.5)
  // Sheets that were not at the same load each keep their own.
  const apart = sheets({ LOWER: { 'leg-curl': 40 }, LEGS: { 'leg-curl': 45 } })
  assert.equal(play(apart, [['LOWER', 'leg-curl', 40, [15, 15, 15]]]).out[0].changes[0].also, undefined)
  // A trial session sets the starting load of both sheets; two sessions in a row are compared with each other.
  const trial = play(base, [['LOWER', 'leg-curl', 40, [12, 12, 11]], ['LEGS', 'leg-curl', 40, [12, 11, 11]]])
  const start = trial.out[0].changes[0]
  assert.deepEqual([start.kind, start.to, start.also], ['baseline', 40, ['LEGS']])
  assert.equal(of(applyChange(base, start), 'LEGS', 'leg-curl').target.weight, 40)
  assert.deepEqual([verdict(trial.out[1]).status, verdict(trial.out[1]).deltaCleanReps], ['down', -1])
  // At a second gym the machine's load there moves in both sheets, and the first gym's stays.
  const there = Object.fromEntries(Object.entries(same).map(([type, t]) => [type, { ...t, exercises: t.exercises.map((e) => (e.exerciseId === 'leg-curl' ? { ...e, gymLoads: { basic: 30 } } : e)) }])) as typeof base
  const away = play(there, [['LOWER', 'leg-curl', 30, [15, 15, 15]]], 'basic').out[0].changes[0]
  assert.deepEqual([away.gymId, away.from, away.to, away.also], ['basic', 30, 32.5, ['LEGS']])
  const moved = applyChange(there, away)
  assert.deepEqual([loadAt(of(moved, 'LOWER', 'leg-curl'), 'basic'), loadAt(of(moved, 'LEGS', 'leg-curl'), 'basic'), of(moved, 'LEGS', 'leg-curl').target.weight], [32.5, 32.5, 40])
})

test('after the fact: changes can be undone later, the last session corrected, a deleted one leaves no trace', () => {
  configurePlan(DEFAULT_GOAL)
  const base = defaultState()
  const withLoads = (loads: Record<string, number>) =>
    Object.fromEntries(Object.entries(base.templates).map(([type, t]) => [type, { ...t, exercises: t.exercises.map((e) => (loads[e.exerciseId] !== undefined ? { ...e, target: { ...e.target, weight: loads[e.exerciseId] } } : e)) }])) as typeof base.templates
  const of = (tpl: typeof base.templates, type: Workout['type'], id: string) => tpl[type].exercises.find((e) => e.exerciseId === id)!
  const live = (tpl: typeof base.templates, type: Workout['type'], id: string, reps: number[]): WorkoutExercise => {
    const t = of(tpl, type, id)
    return { ...t, prescription: { sets: t.target.sets, minReps: t.target.minReps, maxReps: t.target.maxReps, rir: t.target.rir ?? '1–2', restSeconds: t.target.restSeconds, weight: t.target.weight ?? null, loadFactor: 1, notes: [] }, sets: reps.map((n) => set(t.target.weight ?? null, n)), notes: '', skipped: false, validated: true, comparison: null }
  }
  // The app's own flow: a session in progress, then finished.
  const finish = (st: AppState, id: string, date: string, type: Workout['type'], exercises: [string, number[]][]): AppState =>
    finishedState({ ...st, activeWorkout: { id, type, date, startedAt: `${date}T17:00:00.000Z`, notes: '', timerEndAt: null, timer: null, exercises: exercises.map(([ex, reps]) => live(st.templates, type, ex, reps)), reentry: st.reentry } }, `${date}T18:00:00.000Z`, date)!.state
  const start: AppState = { ...base, templates: withLoads({ 'leg-press': 100, 'leg-curl': 40, 'chest-press': 60 }), nextWorkoutType: 'LOWER' }
  const s1 = finish(start, 'a1', '2026-10-06', 'LOWER', [['leg-press', [12, 12, 12]], ['leg-curl', [12, 12, 11]]])
  const a1 = s1.workouts[0]
  assert.deepEqual([s1.activeWorkout, s1.nextWorkoutType, s1.lastCompletedWorkoutId, s1.completedSessions, a1.sessionNumber, a1.completedAt], [null, 'PUSH', 'a1', 1, 1, '2026-10-06T18:00:00.000Z'])
  // The change is kept with the session, not only on the screen that follows it.
  assert.deepEqual(a1.changes?.map((c) => [c.exerciseId, c.kind, c.from, c.to]), [['leg-press', 'up', 100, 105]])
  assert.equal(of(s1.templates, 'LOWER', 'leg-press').target.weight, 105)
  assert.deepEqual(s1.appliedPlanUpdates.map((u) => [u.updateId, u.summary]), [['auto-a1', 'Ajustement automatique : Presse à cuisses 100 → 105\u202fkg.']])
  assert.deepEqual(finalizeWorkout([], workout('z', '2026-10-06', undefined, [exo([set(100, 10), set(100, 9), set(100, 8)])], 1), base.templates).workout.changes, [], 'a session that changes nothing says so with an empty list')
  const press = a1.changes![0]
  const stateOf = (st: AppState, c = press, source = a1, today = '2026-10-07') => changeState(st.templates, c, source, st.workouts, today)
  assert.equal(stateOf(s1), 'applied')
  assert.deepEqual(findChange(s1.workouts, press.id)?.source.id, 'a1')
  // Undone: the sheet is back, and the change can be applied again.
  const undone = { ...s1, templates: applyChange(s1.templates, press, true) }
  assert.deepEqual([of(undone.templates, 'LOWER', 'leg-press').target.weight, stateOf(undone)], [100, 'open'])
  assert.equal(stateOf({ ...undone, templates: applyChange(undone.templates, press) }), 'applied')
  // A sheet edited since, or an exercise taken out of it: nothing left to undo.
  assert.equal(stateOf({ ...s1, templates: withLoads({ 'leg-press': 110 }) }), 'gone')
  assert.equal(stateOf({ ...s1, templates: { ...s1.templates, LOWER: { ...s1.templates.LOWER, exercises: s1.templates.LOWER.exercises.filter((e) => e.exerciseId !== 'leg-press') } } }), 'gone')
  // Another session since does not replace it, unless it did that exercise again.
  const s2 = finish(s1, 'a2', '2026-10-07', 'UPPER', [['chest-press', [10, 10, 10]]])
  assert.equal(stateOf(s2), 'applied')
  const s3 = finish(s2, 'a3', '2026-10-13', 'LOWER', [['leg-press', [9, 9, 8]]])
  assert.equal(stateOf(s3), 'gone', 'the leg press was done again: its last session has the last word')
  assert.equal(stateOf(s3, s2.workouts[1].changes![0], s2.workouts[1]), 'applied')

  // One set less after two clear drops: undone while the block lasts, gone once it is over.
  let d = start
  for (const [i, reps] of [[11, 11, 10], [10, 10, 9], [9, 9, 8]].entries()) d = finish(d, `d${i}`, addDays('2026-10-06', 7 * i), 'LOWER', [['leg-press', reps]])
  const cut = d.workouts[2].changes!.find((c) => c.kind === 'sets')!
  assert.equal(of(d.templates, 'LOWER', 'leg-press').autoAdjust?.sets, -1)
  assert.equal(changeState(d.templates, cut, d.workouts[2], d.workouts, '2026-10-21'), 'applied')
  assert.equal(changeState(applyChange(d.templates, cut, true), cut, d.workouts[2], d.workouts, '2026-10-21'), 'open')
  assert.equal(changeState(d.templates, cut, d.workouts[2], d.workouts, '2026-11-20'), 'gone', 'the block is over')
  // A set removal the lifter had refused stays refused when the session is corrected, also for a session logged before changes were kept.
  const noCut: AppState = { ...d, templates: applyChange(d.templates, cut, true) }
  const corrected = (st: AppState) => finishedState(reopenedState(st, 'd2')!, '2026-10-21T09:00:00.000Z', '2026-10-21')!.state
  const { changes: _d2, ...d2bare } = d.workouts[2]
  for (const st of [noCut, { ...noCut, workouts: [d.workouts[0], d.workouts[1], d2bare] }]) {
    const after = corrected(st)
    const offered = after.workouts[2].changes!.find((c) => c.kind === 'sets')!
    assert.deepEqual([of(after.templates, 'LOWER', 'leg-press').autoAdjust, changeState(after.templates, offered, after.workouts[2], after.workouts, '2026-10-21')], [undefined, 'open'])
  }
  assert.equal(of(corrected(d).templates, 'LOWER', 'leg-press').autoAdjust?.sets, -1, 'in place, it stays in place')

  // Deleting a session: what it changed and what the sheets still hold goes with it.
  const gone = withoutWorkout(s1, 'a1', '2026-10-07')
  assert.deepEqual([gone.workouts.length, gone.completedSessions, gone.lastCompletedWorkoutId, gone.nextWorkoutType], [0, 0, null, 'LOWER'])
  assert.equal(of(gone.templates, 'LOWER', 'leg-press').target.weight, 100)
  assert.deepEqual(gone.appliedPlanUpdates, [])
  // An older one: its change was replaced since and stays; the rotation is not touched.
  const older = withoutWorkout(s3, 'a1', '2026-10-14')
  assert.deepEqual([older.workouts.map((w) => w.id), older.nextWorkoutType, older.lastCompletedWorkoutId], [['a2', 'a3'], s3.nextWorkoutType, 'a3'])
  assert.equal(of(older.templates, 'LOWER', 'leg-press').target.weight, of(s3.templates, 'LOWER', 'leg-press').target.weight)
  assert.equal(withoutWorkout(s3, 'nope'), s3)
  assert.equal(lastFinished(s3.workouts)?.id, 'a3')

  // Correcting: only the last session finished opens again, with its sets and without its verdicts.
  assert.equal(reopenedState(s3, 'a1'), null, 'later sessions were compared with it')
  const open = reopenedState(s1, 'a1')!
  assert.equal(reopenedState(open, 'a1'), null, 'not while a session is in progress')
  // Nothing has moved yet: the session is still in the history, its change still on the sheet.
  assert.deepEqual([open.workouts.length, open.nextWorkoutType, of(open.templates, 'LOWER', 'leg-press').target.weight], [1, 'PUSH', 105])
  assert.deepEqual([open.activeWorkout!.id, open.activeWorkout!.date, open.activeWorkout!.type, open.activeWorkout!.reopened], ['a1', '2026-10-06', 'LOWER', { completedAt: a1.completedAt }])
  assert.deepEqual(open.activeWorkout!.exercises.map((e) => [e.exerciseId, e.sets.map((x) => x.reps), e.comparison]), [['leg-press', [12, 12, 12], null], ['leg-curl', [12, 12, 11], null]])
  // Dropping the correction (the draft is discarded) leaves everything as it was.
  assert.deepEqual({ ...open, activeWorkout: null }, s1)
  // The last set of leg press was 10, not 12: finished again, the session no longer raises the load.
  const fixed = finishedState({ ...open, activeWorkout: { ...open.activeWorkout!, exercises: open.activeWorkout!.exercises.map((e) => (e.exerciseId === 'leg-press' ? { ...e, sets: [set(100, 12), set(100, 12), set(100, 10)] } : e)) } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  const b1 = fixed.workouts[0]
  assert.deepEqual([fixed.workouts.length, b1.id, b1.sessionNumber, b1.completedAt, b1.changes], [1, 'a1', 1, '2026-10-06T18:00:00.000Z', []])
  assert.deepEqual(b1.exercises[0].sets.map((x) => x.reps), [12, 12, 10])
  assert.equal(of(fixed.templates, 'LOWER', 'leg-press').target.weight, 100)
  assert.deepEqual([fixed.nextWorkoutType, fixed.completedSessions, fixed.lastCompletedWorkoutId, fixed.appliedPlanUpdates.length, fixed.activeWorkout], ['PUSH', 1, 'a1', 0, null], 'the rotation moved the first time, not again')
  // The other way round: a set typed too low is fixed, and the load goes up as it should have.
  const low = finish(start, 'c1', '2026-10-06', 'LOWER', [['leg-press', [12, 12, 2]]])
  assert.equal(of(low.templates, 'LOWER', 'leg-press').target.weight, 100)
  const lowOpen = reopenedState(low, 'c1')!
  const raised = finishedState({ ...lowOpen, activeWorkout: { ...lowOpen.activeWorkout!, exercises: [{ ...lowOpen.activeWorkout!.exercises[0], sets: [set(100, 12), set(100, 12), set(100, 12)] }] } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  assert.deepEqual([of(raised.templates, 'LOWER', 'leg-press').target.weight, raised.workouts[0].changes?.[0].to, raised.appliedPlanUpdates.map((u) => u.updateId)], [105, 105, ['auto-c1']])
  // A raise the lifter had undone stays undone when the corrected session asks for it again.
  const refused = revertedState(s1, press.id, '2026-10-07')
  assert.deepEqual([of(refused.templates, 'LOWER', 'leg-press').target.weight, revertedState(refused, press.id, '2026-10-07') === refused], [100, true])
  const refusedOpen = reopenedState(refused, 'a1')!
  const again = finishedState({ ...refusedOpen, activeWorkout: { ...refusedOpen.activeWorkout!, exercises: refusedOpen.activeWorkout!.exercises.map((e) => (e.exerciseId === 'leg-curl' ? { ...e, sets: [set(40, 12), set(40, 12), set(40, 10)] } : e)) } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  assert.deepEqual([of(again.templates, 'LOWER', 'leg-press').target.weight, again.workouts[0].changes?.map((c) => [c.exerciseId, c.to])], [100, [['leg-press', 105]]])
  assert.deepEqual(again.appliedPlanUpdates, refused.appliedPlanUpdates, 'the plan did not change: neither does its history')
  assert.equal(changeState(again.templates, again.workouts[0].changes![0], again.workouts[0], again.workouts, '2026-10-08'), 'open', 'still there to be applied')
  assert.equal(of(appliedState(again, [again.workouts[0].changes![0].id], '2026-10-08T10:00:00.000Z', '2026-10-08').templates, 'LOWER', 'leg-press').target.weight, 105)
  // A load typed on the sheet since the session stays: the corrected session does not write over it.
  const typed = { ...low, templates: withLoads({ 'leg-press': 110, 'leg-curl': 40, 'chest-press': 60 }) }
  const typedOpen = reopenedState(typed, 'c1')!
  const kept = finishedState({ ...typedOpen, activeWorkout: { ...typedOpen.activeWorkout!, exercises: [{ ...typedOpen.activeWorkout!.exercises[0], sets: [set(100, 12), set(100, 12), set(100, 12)] }] } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  assert.deepEqual([of(kept.templates, 'LOWER', 'leg-press').target.weight, kept.workouts[0].changes?.[0].to, kept.appliedPlanUpdates.length], [110, 105, 0])
  assert.equal(changeState(kept.templates, kept.workouts[0].changes![0], kept.workouts[0], kept.workouts, '2026-10-08'), 'gone')
  // A session finished again without a change is the same session: verdicts, changes, sheets.
  const same = finishedState(reopenedState(s2, 'a2')!, '2026-10-09T09:00:00.000Z', '2026-10-09')!.state
  assert.deepEqual([same.workouts, same.templates, same.nextWorkoutType], [s2.workouts, s2.templates, s2.nextWorkoutType])
  // A return after a break is counted down once, the first time.
  const reentry = program.reentryForGap(10)!
  const r1 = finish({ ...start, reentry }, 'r1', '2026-10-06', 'LOWER', [['leg-curl', [12, 12, 11]]])
  assert.deepEqual([r1.reentry?.sessionsLeft ?? 0, r1.workouts[0].reentry], [reentry.sessionsLeft - 1, reentry])
  const r1again = finishedState(reopenedState(r1, 'r1')!, '2026-10-07T09:00:00.000Z', '2026-10-07')!.state
  assert.deepEqual(r1again.reentry, r1.reentry)
  assert.deepEqual(withoutWorkout(r1, 'r1', '2026-10-07').reentry, reentry, 'deleted, the session gives its turn back')
  // Without automatic loads, a change applied by hand stays applied when the corrected session asks for the same one.
  const manual: AppState = { ...start, prefs: { ...start.prefs, autoLoad: false } }
  const m1 = finish(manual, 'm1', '2026-10-06', 'LOWER', [['leg-press', [12, 12, 12]], ['leg-curl', [15, 15, 15]]])
  assert.deepEqual([of(m1.templates, 'LOWER', 'leg-press').target.weight, m1.workouts[0].changes?.length], [100, 2], 'proposed, not applied')
  const byHand = { ...m1, templates: applyChange(m1.templates, m1.workouts[0].changes![0]) }
  const m1again = finishedState(reopenedState(byHand, 'm1')!, '2026-10-07T09:00:00.000Z', '2026-10-07')!.state
  assert.deepEqual([of(m1again.templates, 'LOWER', 'leg-press').target.weight, of(m1again.templates, 'LOWER', 'leg-curl').target.weight], [105, 40])
  assert.deepEqual(m1again.appliedPlanUpdates, byHand.appliedPlanUpdates, 'applied by hand: no automatic adjustment appears in the history')

  // Applied by hand, a change moves the twin sheets that are still in step, and remembers which: undone, it puts back those only.
  const twins: AppState = { ...manual, templates: withLoads({ 'leg-press': 100, 'leg-curl': 40, 'chest-press': 60 }) }
  const t1 = finish(twins, 't1', '2026-10-06', 'LOWER', [['leg-curl', [15, 15, 15]]])
  const proposal = t1.workouts[0].changes![0]
  assert.deepEqual([proposal.also, of(t1.templates, 'LEGS', 'leg-curl').target.weight], [['LEGS'], 40])
  const both = appliedState(t1, [proposal.id], '2026-10-07T10:00:00.000Z', '2026-10-07')
  assert.deepEqual([of(both.templates, 'LOWER', 'leg-curl').target.weight, of(both.templates, 'LEGS', 'leg-curl').target.weight, both.workouts[0].changes![0].also], [42.5, 42.5, ['LEGS']])
  assert.equal(both.appliedPlanUpdates.at(-1)?.summary, 'Charges mises à jour : Leg curl assis 40 → 42,5 kg.')
  assert.equal(appliedState(both, [proposal.id]), both, 'applied once')
  const backBoth = revertedState(both, proposal.id, '2026-10-07')
  assert.deepEqual([of(backBoth.templates, 'LOWER', 'leg-curl').target.weight, of(backBoth.templates, 'LEGS', 'leg-curl').target.weight], [40, 40])
  // The Legs sheet typed by hand to the same figure before the change was applied is not one the change moved.
  const legs = (st: AppState, patch: Partial<typeof start.templates.LEGS.exercises[number]['target']>): AppState => ({ ...st, templates: { ...st.templates, LEGS: { ...st.templates.LEGS, exercises: st.templates.LEGS.exercises.map((e) => (e.exerciseId === 'leg-curl' ? { ...e, target: { ...e.target, ...patch } } : e)) } } })
  const typedTwin = appliedState(legs(t1, { weight: 42.5 }), [proposal.id], '2026-10-07T10:00:00.000Z', '2026-10-07')
  assert.equal(typedTwin.workouts[0].changes![0].also, undefined)
  const typedBack = revertedState(typedTwin, proposal.id, '2026-10-07')
  assert.deepEqual([of(typedBack.templates, 'LOWER', 'leg-curl').target.weight, of(typedBack.templates, 'LEGS', 'leg-curl').target.weight], [40, 42.5])
  // A twin whose rep range was edited since is another prescription: it keeps its load.
  const otherRange = appliedState(legs(t1, { minReps: 6, maxReps: 10 }), [proposal.id], '2026-10-07T10:00:00.000Z', '2026-10-07')
  assert.deepEqual([of(otherRange.templates, 'LOWER', 'leg-curl').target.weight, of(otherRange.templates, 'LEGS', 'leg-curl').target.weight], [42.5, 40])

  // A session logged before changes were kept: its load change is worked out again, so that correcting or deleting it undoes it.
  const { changes: _kept, ...bare } = a1
  const before: AppState = { ...s1, workouts: [bare] }
  assert.deepEqual(changesOf(before, bare).map((c) => [c.exerciseId, c.from, c.to, c.also]), [['leg-press', 100, 105, undefined]])
  assert.equal(of(withoutWorkout(before, 'a1', '2026-10-07').templates, 'LOWER', 'leg-press').target.weight, 100)
  const beforeOpen = reopenedState(before, 'a1')!
  const beforeFixed = finishedState({ ...beforeOpen, activeWorkout: { ...beforeOpen.activeWorkout!, exercises: beforeOpen.activeWorkout!.exercises.map((e) => (e.exerciseId === 'leg-press' ? { ...e, sets: [set(100, 12), set(100, 12), set(100, 10)] } : e)) } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  assert.deepEqual([of(beforeFixed.templates, 'LOWER', 'leg-press').target.weight, beforeFixed.workouts[0].changes], [100, []])

  // Finished untouched, a correction moves no other sheet: the same change keeps the twins it had the first time.
  const curls = (st: AppState) => [of(st.templates, 'LOWER', 'leg-curl').target.weight, of(st.templates, 'LEGS', 'leg-curl').target.weight]
  const untouched = (st: AppState, id: string) => finishedState(reopenedState(st, id)!, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  const h1 = finish(start, 'h1', '2026-10-06', 'LOWER', [['leg-curl', [15, 15, 15]]])
  assert.deepEqual([curls(h1), h1.workouts[0].changes![0].also], [[42.5, 42.5], ['LEGS']])
  const h1again = untouched(h1, 'h1')
  assert.deepEqual([h1again.workouts, h1again.templates, h1again.appliedPlanUpdates], [h1.workouts, h1.templates, h1.appliedPlanUpdates], 'both sheets come back to where they were, and the history of the plan is not rewritten')
  // A session logged before the two sheets moved together: only its own sheet had been raised.
  const { changes: _h, ...h1bare } = h1.workouts[0]
  const logged = legs({ ...h1, workouts: [h1bare] }, { weight: 40 })
  const loggedAgain = untouched(logged, 'h1')
  assert.deepEqual([curls(loggedAgain), loggedAgain.workouts[0].changes?.map((c) => [c.from, c.to, c.also])], [[42.5, 40], [[40, 42.5, undefined]]])
  // A twin that came into step since the session (typed by hand) is not one that change moved.
  const apart = finish(legs(start, { weight: 45 }), 'h2', '2026-10-06', 'LOWER', [['leg-curl', [15, 15, 15]]])
  assert.deepEqual([curls(apart), apart.workouts[0].changes![0].also], [[42.5, 45], undefined])
  assert.deepEqual(curls(untouched(legs(apart, { weight: 40 }), 'h2')), [42.5, 40])
  // A correction that asks for another change is a new verdict: the sheets in step today follow it.
  const lowered = reopenedState(legs(apart, { weight: 40 }), 'h2')!
  const otherVerdict = finishedState({ ...lowered, activeWorkout: { ...lowered.activeWorkout!, exercises: [{ ...lowered.activeWorkout!.exercises[0], sets: [set(40, 7), set(40, 7), set(40, 6)] }] } }, '2026-10-08T09:00:00.000Z', '2026-10-08')!.state
  assert.deepEqual([otherVerdict.workouts[0].changes?.map((c) => [c.kind, c.from, c.also]), curls(otherVerdict)[0] === curls(otherVerdict)[1]], [[['down', 40, ['LEGS']]], true])
  assert.deepEqual(otherVerdict.appliedPlanUpdates.map((u) => [u.updateId, u.appliedAt]), [['auto-h2', '2026-10-08T09:00:00.000Z']], 'the plan changed: the session’s line in its history is the new one')
  // A twin the change had moved, put back by hand to the load it came from: the correction puts back what was in place, not that twin.
  const byHandBack = untouched(legs(h1, { weight: 40 }), 'h1')
  assert.deepEqual([curls(byHandBack), byHandBack.workouts[0].changes![0].also], [[42.5, 40], undefined])
  assert.deepEqual(curls(revertedState(byHandBack, byHandBack.workouts[0].changes![0].id, '2026-10-08')), [40, 40])

  // The sentence of a change is in the language it was written in; in the other one its figures speak.
  assert.deepEqual([press.lang, press.text], ['fr', '3 × 12 atteint : 105 kg la prochaine fois'])
  assert.equal(changeLabel(press), '100 kg → 105 kg la prochaine fois')
  assert.equal(changeLabel(cut), '1 série de moins jusqu’à la fin du bloc')
  assert.equal(changeLabel({ ...press, kind: 'baseline', from: null }), 'Charge de départ : 105 kg')
  // Bodyweight work starts from the body weight alone: a first added load is a raise.
  assert.deepEqual([changeLabel({ ...press, from: null, to: 2.5 }, 'PDC'), changeLabel({ ...press, kind: 'down', from: 2.5, to: null }, 'PDC')], ['PDC → PDC +2,5\u202fkg la prochaine fois', 'PDC +2,5\u202fkg → PDC la prochaine fois'])

  // Backups keep the changes and drop what is not one.
  const saved = normalizeState(JSON.parse(JSON.stringify({ ...s1, workouts: [{ ...a1, changes: [...a1.changes!, { id: 'x' }, null] }] })))
  assert.deepEqual(saved.workouts[0].changes, a1.changes)
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(fixed))).workouts[0].changes, [], 'an empty list stays one')
  assert.equal(normalizeState(JSON.parse(JSON.stringify(before))).workouts[0].changes, undefined)
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(r1))).workouts[0].reentry, reentry)
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(open))).activeWorkout?.reopened, { completedAt: a1.completedAt })
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

test('calories in a cut: the pace has to stay in the range, on recent weigh-ins, above a floor', () => {
  configurePlan(DEFAULT_GOAL)
  // Forty daily weigh-ins ending on `last`, moving by `pct` % of body weight a week.
  const weighIns = (last: string, pct: number, from = 86) =>
    Array.from({ length: 40 }, (_, i) => ({ id: `w${i}`, date: addDays(last, i - 39), weight: from * (1 + (pct / 100) * (i / 7)), waist: null, arm: null, chest: null, shoulders: null }))
  const base = defaultState()
  const at = (today: string, pct: number, over: Partial<AppState> = {}, last = today) => calorieAdvice({ ...base, bodyEntries: weighIns(last, pct), ...over }, today)
  // The cut (−0.5 to −0.7 %/week): under the range is too slow, since its length was sized on −0.6.
  const slow = at('2027-03-01', -0.4)
  assert.deepEqual([slow.status, slow.delta, slow.headline], ['lower', -150, 'Perte trop lente'])
  assert.match(slow.detail, /^−0,4\d? %\/sem \(objectif : −0,5 à −0,7 %\/sem\) : −150 kcal/)
  assert.deepEqual([at('2027-03-01', -0.6).status, at('2027-03-01', -0.6).headline], ['ok', 'Rythme dans la cible'])
  assert.deepEqual([at('2027-03-01', -0.85).status, at('2027-03-01', -0.85).headline], ['ok', 'Rythme soutenu'])
  assert.deepEqual([at('2027-03-01', -1.2).status, at('2027-03-01', -1.2).delta], ['raise', 150])
  // The end of the cut aims at about −0.5: a tenth on each side.
  assert.deepEqual([at('2027-05-25', -0.45).headline, at('2027-05-25', -0.3).status, at('2027-05-25', -0.7).headline], ['Rythme dans la cible', 'lower', 'Rythme soutenu'])
  assert.match(at('2027-05-25', -0.3).detail, /objectif : environ −0,5 %\/sem/)

  // Weigh-ins older than a week say nothing about today: no advice, and no trend shown.
  const old = at('2027-03-01', 0.5, {}, '2027-02-20')
  assert.deepEqual([old.status, old.headline], ['wait', 'Pesées trop anciennes'])
  assert.match(old.detail, /il y a 9 jours/)
  const ws = weightStatus({ ...base, bodyEntries: weighIns('2027-02-20', 0.5) }, '2027-03-01')
  assert.deepEqual([ws.stale, ws.weeklyChange, ws.daysSinceLast], [true, null, 9])
  assert.equal(weightStatus({ ...base, bodyEntries: weighIns('2027-02-22', 0.5) }, '2027-03-01').stale, false, 'a weigh-in a week ago still counts')
  assert.equal(at('2027-03-01', -0.4, {}, '2027-02-22').status, 'lower')

  // The trend looks back three weeks: until it lies inside the cut and after the last change of calories,
  // only a clearly slow pace is acted on (about 60 % of a new pace shows after two weeks).
  assert.equal(TREND_DAYS, 21)
  const early = at('2027-01-18', -0.4)                                  // day 15 of the cut
  assert.deepEqual([early.status, early.headline], ['wait', 'Rythme à confirmer'])
  assert.match(early.detail, /compte encore des jours d’avant la sèche : verdict dans 7 jours\.$/)
  // (With weigh-ins too sparse to size a step on, the regular one; the sized step has its own test below.)
  const sparse = weighIns('2027-01-18', -0.2).filter((_, i) => (39 - i) % 4 === 0)
  const first = calorieAdvice({ ...base, bodyEntries: sparse }, '2027-01-18')
  assert.deepEqual([first.status, first.delta, first.headline], ['lower', -150, 'Début de sèche'])
  assert.match(first.detail, /^−0,2\d? %\/sem sur les 3 dernières semaines \(objectif : −0,5 à −0,7 %\/sem\) : −150 kcal/)
  assert.equal(at('2027-01-25', -0.4).headline, 'Perte trop lente', 'three weeks in, the trend is the cut’s own')
  // (The sized step of this cut was taken at its start: what follows are the regular steps.)
  const sizedStep = { at: '2027-01-04', from: 2600, to: 2400 }
  const changed = (days: number): Partial<AppState> => ({ nutritionTargets: { ...base.nutritionTargets, caloriesChangedAt: addDays('2027-03-01', -days), sizedStep } })
  assert.equal(at('2027-03-01', -0.4, changed(10)).headline, 'Ajustement récent')
  const waiting = at('2027-03-01', -0.4, changed(15))
  assert.deepEqual([waiting.status, waiting.headline], ['wait', 'Rythme à confirmer'])
  assert.match(waiting.detail, /d’avant ton dernier changement de calories : verdict dans 6 jours\.$/)
  assert.deepEqual([at('2027-03-01', -0.2, changed(15)).headline, at('2027-03-01', -0.4, changed(21)).headline], ['Perte trop lente', 'Perte trop lente'])
  assert.equal(at('2027-03-01', -0.6, changed(15)).headline, 'Rythme dans la cible')
  assert.equal(at('2027-03-01', -1.2, changed(15)).status, 'raise', 'too fast is acted on at once: the trend can only understate it')
  // After the diet break the cut starts again: the week at maintenance is still in the trend, and the words say it resumes.
  const back = at('2027-04-05', -0.4)
  assert.equal(back.headline, 'Rythme à confirmer')
  assert.match(back.detail, /compte encore des jours d’avant la reprise de la sèche : verdict dans 14 jours\.$/)
  assert.deepEqual([at('2027-04-05', -0.2).status, at('2027-04-05', -0.2).delta, at('2027-04-05', -0.2).headline], ['lower', -150, 'Reprise de la sèche'], 'the week at maintenance is in the trend: a regular step')
  // The verdict is read on the pace as it is shown: −0.497 reads −0.5, which is inside the range.
  const shown = calorieAdvice({ ...base, bodyEntries: weighIns('2027-03-01', -0.4864) }, '2027-03-01')
  assert.match(shown.detail, /^−0,5 %\/sem /)
  assert.equal(shown.headline, 'Rythme dans la cible')

  // The floor: the energy spent at rest (Mifflin–St Jeor) from the profile and the weight of the week,
  // and never under the minimum advised without medical supervision.
  const profile = { heightCm: 180, age: 30, sex: 'm' as const }
  assert.equal(Math.round(restingCalories({ weight: 85, ...profile })), 1830)
  // In the cut, the sized step was taken at its start: these are the regular steps that follow (the sized one has its own test).
  const state = (calories: number, cut = true): Partial<AppState> => ({ profile, nutritionTargets: { ...base.nutritionTargets, calories, ...(cut ? { caloriesChangedAt: '2027-01-04', sizedStep } : {}) } })
  assert.deepEqual(calorieFloor({ ...base, ...state(2350), bodyEntries: weighIns('2027-03-01', -0.3) }, '2027-03-01'), { kcal: 1850, from: 'rest' })
  assert.deepEqual(calorieFloor({ ...base, bodyEntries: weighIns('2027-03-01', -0.3) }, '2027-03-01'), { kcal: 1500, from: 'minimum' }, 'no height: the minimum alone')
  assert.deepEqual(calorieFloor({ ...base, profile: { heightCm: 150, age: 60, sex: 'f' }, bodyEntries: weighIns('2027-03-01', 0, 50) }, '2027-03-01'), { kcal: 1200, from: 'minimum' }, 'a resting estimate of 1,000 kcal is not a target')
  assert.deepEqual([at('2027-03-01', -0.3, state(2350)).target, at('2027-03-01', -0.3, state(2350)).floor], [2200, 1850])
  const last = at('2027-03-01', -0.3, state(1950))
  assert.deepEqual([last.status, last.delta, last.target], ['lower', -100, 1850])
  assert.match(last.detail, /−100 kcal .* Pas plus bas : 1850 kcal, c’est ta dépense au repos estimée\.$/)
  const held = at('2027-03-01', -0.3, state(1850))
  assert.deepEqual([held.status, held.delta, held.target, held.headline], ['hold', 0, 1850, 'Perte trop lente, calories au plancher'])
  assert.match(held.detail, /\. Ta cible ne dépasse pas ta dépense au repos estimée \(1850 kcal\) : le conseil ne descend pas plus bas/)
  assert.equal(at('2027-03-01', -0.3, state(1700)).status, 'hold', 'a target typed under the floor is not lowered either')
  // Without a height there is no estimate: the minimum is the floor.
  const bare = at('2027-03-01', -0.3, { nutritionTargets: { ...base.nutritionTargets, calories: 1600, caloriesChangedAt: '2027-01-04', sizedStep } })
  assert.deepEqual([bare.target, bare.floor, bare.floorIs], [1500, 1500, 'minimum'])
  assert.match(bare.detail, /Pas plus bas : 1500 kcal, c’est le minimum conseillé sans suivi médical\.$/)
  // The floor holds in every phase: a rising weight in the recomposition at the floor is not answered with fewer calories.
  assert.equal(at('2026-10-21', 0.5, state(1850, false)).status, 'hold')
  assert.equal(at('2026-10-21', 0.5, state(2350, false)).target, 2200)
  // Calories only go down that far: raising them is never limited.
  assert.equal(at('2027-03-01', -1.2, state(1850)).target, 2000)
})

test('calories in a cut: one step is the plan’s deficit taken at once, behind a question', () => {
  configurePlan(DEFAULT_GOAL)
  const base = defaultState()
  const entry = (date: string, weight: number, i: number) => ({ id: `w${i}`, date, weight, waist: null, arm: null, chest: null, shoulders: null })
  // Weigh-ins over forty days ending on `last`, one every `every` days, moving by `pct` % of body weight a week.
  const weighIns = (last: string, pct: number, from = 86, every = 1) =>
    Array.from({ length: 40 }, (_, i) => entry(addDays(last, i - 39), from * (1 + (pct / 100) * (i / 7)), i)).filter((_, i) => (39 - i) % every === 0)
  const at = (today: string, pct: number, over: Partial<AppState> = {}, from = 86, every = 1) => calorieAdvice({ ...base, bodyEntries: weighIns(today, pct, from, every), ...over }, today)
  const kcal = (calories: number, changed?: string, sizedStep?: { at: string; from: number; to: number }): Partial<AppState> =>
    ({ nutritionTargets: { ...base.nutritionTargets, calories, ...(changed ? { caloriesChangedAt: changed } : {}), ...(sizedStep ? { sizedStep } : {}) } })
  // Status, the step advised outright, the sized step offered on a yes and the regular one on a no.
  const step = (a: ReturnType<typeof calorieAdvice>) => [a.status, a.delta, a.first?.delta ?? null, a.otherwise?.delta ?? null]
  const regular = ['lower', -150, null, null]

  // Day 1 of the cut at a stable weight: nothing is advised before the question; a yes gives the whole deficit (500 kcal at most), a no the regular step.
  const day1 = at('2027-01-04', 0)
  assert.deepEqual([day1.status, day1.delta, day1.target, day1.headline, day1.detail], ['ask', 0, 2350, 'Début de sèche', '0 %/sem sur les 3 dernières semaines (objectif : −0,5 à −0,7 %/sem).'])
  assert.deepEqual([day1.first!.question, day1.first!.delta, day1.first!.target], ['Tes 3 dernières semaines ont-elles été normales ?', -500, 1850])
  assert.equal(day1.first!.hint, 'Normales : tu as mangé et bougé comme aujourd’hui. Ni fêtes, ni vacances, ni régime déjà commencé.')
  assert.equal(day1.first!.detail, 'Le pas complet vise un déficit d’environ 500 kcal par jour. Soit −500 kcal en une fois (glucides ou lipides, jamais les protéines), puis 2 semaines pour que le poids réagisse.')
  assert.deepEqual([day1.otherwise!.delta, day1.otherwise!.target], [-150, 2200])
  assert.equal(day1.otherwise!.detail, 'Ta tendance ne décrit donc pas ta situation d’aujourd’hui. Pour l’instant, un pas ordinaire : −150 kcal (glucides ou lipides, jamais les protéines) ou ~2 000 pas de plus par jour. Le pas complet viendra après 3 semaines normales.')
  // The deficit is the one of the plan's pace (−0.6 %/week at 7,700 kcal per kg): 400 kcal at 60 kg, 450 at 70, capped at 500 above.
  assert.deepEqual([step(at('2027-01-04', 0, {}, 60)), step(at('2027-01-04', 0, {}, 70)), step(at('2027-01-04', 0, {}, 110))], [['ask', 0, -400, -150], ['ask', 0, -450, -150], ['ask', 0, -500, -150]])
  // What the trend already shows is taken off: from the recomposition's pace, half of it is left to do. A weight going up counts as stable.
  const recomp = at('2027-01-04', -0.25)
  assert.deepEqual([step(recomp), recomp.first!.target], [['ask', 0, -250, -150], 2100])
  assert.match(recomp.first!.detail, /^Le pas complet vise un déficit d’environ 500 kcal par jour ; ta tendance en montre déjà environ 250\. Soit −250 kcal en une fois/)
  assert.deepEqual(step(at('2027-01-04', 0.3)), ['ask', 0, -500, -150])
  // Already near the range: the verdict waits for the trend to be the cut's own, as before.
  assert.equal(at('2027-01-04', -0.31).headline, 'Rythme à confirmer')
  // The step has to be worth more than a regular one: with 150 kcal or less to go, the regular advice.
  assert.deepEqual(step(at('2027-03-01', -0.4)), regular)
  assert.deepEqual(step(at('2027-03-01', -0.33)), ['ask', 0, -200, -150])

  // It needs a trend clean of the last calorie change. Up to a week short of it, the advice waits rather than spend a regular step.
  const soon = at('2027-01-04', 0, kcal(2350, '2026-12-20'))
  assert.deepEqual([soon.status, soon.headline], ['wait', 'Rythme à confirmer'])
  assert.match(soon.detail, /d’avant ton dernier changement de calories : verdict dans 6 jours\.$/)
  assert.match(at('2027-01-04', 0, kcal(2350, '2026-12-15')).detail, / : verdict dans 1 jour\.$/)
  assert.deepEqual(step(at('2027-01-04', 0, kcal(2350, '2026-12-14'))), ['ask', 0, -500, -150])
  // After a no and its regular step, the same: two weeks of wait, one more for the trend, then the question again.
  const afterNo = kcal(2200, '2027-01-04')
  assert.equal(at('2027-01-17', 0, afterNo).headline, 'Ajustement récent')
  assert.match(at('2027-01-18', 0, afterNo).detail, / : verdict dans 7 jours\.$/)
  assert.deepEqual([at('2027-01-25', 0, afterNo).headline, step(at('2027-01-25', 0, afterNo)), at('2027-01-25', 0, afterNo).first!.target], ['Perte trop lente', ['ask', 0, -500, -150], 1700])

  // One sized step a cut: once taken, steps are the regular ones, in every stretch of that cut.
  const january = { at: '2027-01-04', from: 2350, to: 1850 }
  assert.deepEqual(step(at('2027-01-25', -0.3, kcal(1850, '2027-01-04', january))), regular)
  assert.deepEqual([step(at('2027-04-26', -0.2)), step(at('2027-04-26', -0.2, kcal(2350, '2027-01-04', january)))], [['ask', 0, -300, -150], regular])
  // The three weeks after the diet break hold a week eaten at maintenance: regular step.
  assert.deepEqual([at('2027-04-05', -0.2).headline, step(at('2027-04-05', -0.2)), step(at('2027-04-18', -0.2)), at('2027-04-19', -0.2).status], ['Reprise de la sèche', regular, regular, 'ask'])
  // The sized step of another cut is not this one's, nor is one dated after today; outside a cut, nothing of the kind.
  assert.deepEqual(step(at('2027-01-04', 0, kcal(2350, undefined, { at: '2026-03-01', from: 2500, to: 2100 }))), ['ask', 0, -500, -150])
  assert.deepEqual(step(at('2027-01-04', 0, kcal(2350, undefined, { at: '2027-02-01', from: 2500, to: 2100 }))), ['ask', 0, -500, -150])
  assert.deepEqual(step(at('2026-11-10', 0.3)), regular)

  // The trend has to be measured well enough: eight weigh-ins in the three weeks, two at least in each.
  assert.deepEqual([step(at('2027-01-04', 0, {}, 86, 3)), step(at('2027-01-04', 0, {}, 86, 4))], [['ask', 0, -500, -150], regular])
  // Weigh-ins on the given days before 4 January, after a month weighed daily (so that only the last three weeks are in question).
  const weeks = (days: number[]) => ({ ...base, bodyEntries: [...Array.from({ length: 30 }, (_, i) => 51 - i), ...days].map((d, i) => entry(addDays('2027-01-04', -d), 86, i)) })
  const read = (st: AppState) => { const ws = weightStatus(st, '2027-01-04'); return [ws.trendWeighIns, ws.trendWeeks, calorieAdvice(st, '2027-01-04').status] }
  assert.deepEqual(read(weeks([0, 3, 7, 10, 14, 17, 20, 21])), [8, 2, 'ask'])
  assert.deepEqual(read(weeks([0, 3, 7, 10, 14, 17, 21])), [7, 2, 'lower'], 'seven weigh-ins are one short')
  assert.deepEqual(read(weeks([0, 1, 2, 3, 4, 5, 7, 14, 15, 16])), [10, 1, 'lower'], 'a week with a single weigh-in')
  assert.deepEqual(read(weeks([0, 15, 16, 17, 18, 19, 20, 21])), [8, 0, 'lower'], 'a week in a row three weeks ago says nothing of now')

  assert.deepEqual(read(weeks(Array.from({ length: 15 }, (_, i) => i + 7))), [22, 0, 'lower'], 'the weeks are the three ending today: a trend that stops a week ago is not sized on')
  // One slow reading is not enough: the reading of two weeks before has to be slow too (the scale has its waves).
  const paced = (today: string, before: number, lately: number) => { let w = 86; return Array.from({ length: 40 }, (_, i) => { w *= 1 + ((i < 26 ? before : lately) / 100) / 7; return entry(addDays(today, i - 39), w, i) }) }
  const blip = calorieAdvice({ ...base, bodyEntries: paced('2027-03-01', -0.6, 0.1) }, '2027-03-01')
  assert.deepEqual([blip.headline, step(blip)], ['Perte trop lente', regular], 'on pace two weeks ago: a regular step')
  assert.deepEqual(step(calorieAdvice({ ...base, bodyEntries: paced('2027-03-01', -0.1, 0.1) }, '2027-03-01')), ['ask', 0, -500, -150])
  assert.deepEqual(step(calorieAdvice({ ...base, bodyEntries: weighIns('2027-01-04', 0).slice(-20) }, '2027-01-04')), regular, 'no reading two weeks ago: a regular step')

  // The floor bounds the step, and says so; with a regular step or less of room, the regular advice.
  const profile = { heightCm: 180, age: 30, sex: 'm' as const }
  const near = at('2027-01-04', 0, { profile, ...kcal(2100) })
  assert.deepEqual([step(near), near.first!.target, near.floor], [['ask', 0, -250, -150], 1850, 1850])
  assert.match(near.first!.detail, /Soit −250 kcal en une fois .* Pas plus bas : 1850 kcal, c’est ta dépense au repos estimée\.$/)
  assert.deepEqual([step(at('2027-01-04', 0, { profile, ...kcal(2000) })), step(at('2027-01-04', 0, { profile, ...kcal(1900) })), at('2027-01-04', 0, { profile, ...kcal(1850) }).status], [regular, ['lower', -50, null, null], 'hold'])

  // The step was read on a trend and on an answer. In the nine weeks after it, a clean trend above the range gives 150 kcal of it back.
  const taken = kcal(1850, '2027-01-04', january)
  const strong = at('2027-01-25', -0.85, taken)
  assert.deepEqual([strong.status, strong.delta, strong.target, strong.headline], ['raise', 150, 2000, 'Pas complet trop fort'])
  assert.match(strong.detail, /^−0,8\d? %\/sem \(objectif : −0,5 à −0,7 %\/sem\) : au-dessus de la fourchette depuis ton pas complet\. \+150 kcal\.$/)
  assert.equal(at('2027-01-24', -0.85, taken).headline, 'Rythme soutenu', 'not while the trend still holds days from before the step')
  assert.deepEqual([at('2027-01-25', -0.65, taken).headline, at('2027-01-25', -0.72, taken).headline], ['Rythme dans la cible', 'Pas complet trop fort'])
  // Again three weeks later if the pace is still above; not after nine weeks, nor once the step is given back or the target went lower.
  const once = kcal(2000, '2027-01-25', january)
  assert.deepEqual([at('2027-02-15', -0.8, once).target, at('2027-03-08', -0.8, once).status, at('2027-03-09', -0.8, once).headline], [2150, 'raise', 'Rythme soutenu'])
  assert.equal(at('2027-02-10', -0.8, once).headline, 'Rythme soutenu', 'not until the trend is clean of the last give-back')
  assert.deepEqual([at('2027-02-20', -0.85, kcal(2300, '2027-01-25', january)).delta, at('2027-02-20', -0.85, kcal(2350, '2027-01-25', january)).headline, at('2027-02-20', -0.85, kcal(1700, '2027-01-25', january)).headline], [50, 'Rythme soutenu', 'Rythme soutenu'])
  // What is left of the step is given back, to the kcal.
  assert.deepEqual([at('2027-02-20', -0.85, kcal(2330, '2027-01-25', january)).delta, at('2027-02-20', -0.85, kcal(2230, '2027-01-25', january)).target], [20, 2350])
  // Without a sized step, a pace between the top of the range and 1 %/week is left alone, as before.
  assert.equal(at('2027-01-25', -0.85, kcal(1850, '2027-01-04')).headline, 'Rythme soutenu')
  // Nor in the three weeks after a diet break, whose week at maintenance is in the trend; at the end of the cut the range stops at −0.6.
  const march = { at: '2027-03-10', from: 2350, to: 1850 }
  assert.deepEqual([at('2027-04-05', -0.85, kcal(1850, '2027-03-10', march)).headline, at('2027-04-19', -0.85, kcal(1850, '2027-03-10', march)).headline], ['Rythme soutenu', 'Pas complet trop fort'])
  const may = { at: '2027-05-01', from: 2350, to: 1850 }
  assert.deepEqual([at('2027-05-25', -0.63, kcal(1850, '2027-05-01', may)).headline, at('2027-05-25', -0.57, kcal(1850, '2027-05-01', may)).headline, at('2027-05-05', -0.66, kcal(1850, '2027-04-10', { ...may, at: '2027-04-10' })).headline], ['Pas complet trop fort', 'Rythme dans la cible', 'Rythme dans la cible'])
  // While the step and the weeks before it are still in the trend, a slow reading adds nothing to it: the trend gets its three weeks.
  const fresh = at('2027-01-18', 0, taken)
  assert.deepEqual([fresh.status, fresh.headline], ['wait', 'Rythme à confirmer'])
  assert.match(fresh.detail, /d’avant ton dernier changement de calories : verdict dans 7 jours\.$/)
  assert.deepEqual(step(at('2027-01-25', 0, taken)), regular)

  // Taking a step: the sized one is recorded with its day and its two ends, the regular one is not.
  assert.deepEqual(calorieStepPatch(base.nutritionTargets, 1850, true, '2027-01-04'), { calories: 1850, sizedStep: { at: '2027-01-04', from: 2350, to: 1850 } })
  assert.deepEqual(calorieStepPatch(base.nutritionTargets, 2200, false, '2027-01-04'), { calories: 2200 })

  // Backups keep the step with its day, and drop what is not one.
  const kept = normalizeState(JSON.parse(JSON.stringify({ ...base, ...taken }))).nutritionTargets
  assert.deepEqual([kept.sizedStep, kept.caloriesChangedAt], [january, '2027-01-04'])
  assert.equal(normalizeState(JSON.parse(JSON.stringify({ ...base, nutritionTargets: { ...base.nutritionTargets, sizedStep: { at: 'soon', from: 1, to: 2 } } }))).nutritionTargets.sizedStep, undefined)
  // Elsewhere the question is not shown as a verdict: one sentence sends to the nutrition screen.
  assert.equal(cutAdvice({ ...base, bodyEntries: weighIns('2027-01-04', 0) }, '2027-01-04'), 'Début de sèche : règle tes calories dans Plus → Nutrition.')
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

test('visual goal: the cut is re-estimated from the latest measurements before it starts', async () => {
  const { bodyFatEstimate, cutDrift, visualPlan } = await import('../src/lib/visual')
  const body = (date: string, weight: number, waist: number | null = null) => ({ id: `b-${date}`, date, weight, waist, arm: null, chest: null, shoulders: null })
  const s0: AppState = { ...defaultState(), profile: { heightCm: 189, age: 33, sex: 'm' }, bodyEntries: [body('2026-09-20', 93, 98)] }
  const p = visualPlan(s0, { look: 'taille', bodyFat: bodyFatEstimate(s0)!, today: '2026-09-27' })!
  assert.equal(p.cutWeeks, 27)
  try {
    // The goal as applied: a 27-week cut starting on 7 December.
    configurePlan(DEFAULT_GOAL, null, p.cutWeeks)
    assert.equal(program.planShape(DEFAULT_GOAL, p.cutWeeks).cutStart, '2026-12-07')
    const applied = (entries: ReturnType<typeof body>[], cutWeeks = p.cutWeeks): AppState => ({ ...s0, bodyEntries: [...s0.bodyEntries, ...entries], visualGoal: { look: 'taille', zones: [], bodyFat: null, cutWeeks } })
    // Same measurements, or a small change: nothing to say.
    assert.equal(cutDrift(applied([body('2026-10-19', 93, 98)]), '2026-10-20'), null)
    assert.equal(cutDrift(applied([body('2026-10-19', 93, 96)]), '2026-10-20'), null, '25 weeks for 27 planned: under three weeks')
    // The waist sets the body fat: three centimetres less ask for a shorter cut, three more for a longer one.
    assert.deepEqual(cutDrift(applied([body('2026-10-19', 92, 95)]), '2026-10-20'), { planned: 27, needed: 24 })
    assert.deepEqual(cutDrift(applied([body('2026-10-19', 96, 101)]), '2026-10-20'), { planned: 27, needed: 30 })
    // No recent weigh-in, no visual goal: nothing can be said.
    assert.equal(cutDrift(applied([body('2026-10-19', 96, 101)]), '2026-11-08'), null, 'last weigh-in three weeks ago')
    assert.equal(cutDrift({ ...applied([body('2026-10-19', 96, 101)]), visualGoal: null }, '2026-10-20'), null)
    // Once the cut is under way the pace steers, not its length.
    assert.equal(cutDrift(applied([body('2026-12-19', 96, 101)]), '2026-12-20'), null)
    // A goal applied when the look was already reached, and a waist that grew since: a cut is needed now.
    configurePlan(DEFAULT_GOAL, null, 0)
    assert.deepEqual(cutDrift(applied([body('2026-10-19', 96, 101)], 0), '2026-10-20'), { planned: 0, needed: 30 })
    configurePlan(DEFAULT_GOAL, null, p.cutWeeks)
    // At the edge of a look the same three weeks apply, on the need before rounding: one centimetre does not flip the plan.
    const edge = (waist: number, cutWeeks: number): AppState => ({ ...s0, profile: { heightCm: 180, age: 33, sex: 'm' }, bodyEntries: [body('2026-10-19', 80, waist)], visualGoal: { look: 'athletique', zones: [], bodyFat: null, cutWeeks } })
    const need = (waist: number) => visualPlan(edge(waist, 0), { look: 'athletique', bodyFat: bodyFatEstimate(edge(waist, 0))!, today: '2026-10-20' })!
    assert.deepEqual([need(79).cutWeeks, need(80).cutWeeks, need(80).need > 0 && need(80).need < 3], [0, 8, true], 'the look is reached at 79 cm, not at 80')
    configurePlan(DEFAULT_GOAL, null, 0)
    assert.equal(cutDrift(edge(80, 0), '2026-10-20'), null, 'a need under three weeks does not ask for a cut the plan has not')
    assert.deepEqual(cutDrift(edge(84, 0), '2026-10-20'), { planned: 0, needed: need(84).cutWeeks })
    configurePlan(DEFAULT_GOAL, null, 8)
    assert.equal(cutDrift(edge(79, 8), '2026-10-20'), null, 'just under the target: the planned cut is not called off')
    assert.deepEqual(cutDrift(edge(74, 8), '2026-10-20'), { planned: 8, needed: 0 })
    // What the plan needs is not judged against today: it fits the calendar or not, as when it was applied.
    configurePlan(DEFAULT_GOAL, null, p.cutWeeks)
    const late = applied([body('2026-12-19', 96, 101)])
    const fresh = visualPlan(late, { look: 'taille', bodyFat: bodyFatEstimate(late)!, today: '2026-12-20' })!
    assert.deepEqual([fresh.cutWeeks, fresh.fits, fresh.suggestedGoal], [30, true, null])
  } finally {
    configurePlan(DEFAULT_GOAL)
  }
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

test('priority zones: asked at the onboarding, and the goal screen says what they change and from when', async () => {
  const { stateFromOnboarding } = await import('../src/lib/onboarding')
  const { prioritySets, prioritySetsStart, tagPriorities } = await import('../src/lib/visual')
  const answers = {
    lang: 'fr' as const, setup: { place: 'gym' as const, equipment: [] }, days: [1, 2, 4, 5, 6], sex: 'm' as const,
    age: 30, heightCm: 178, weight: 80, waist: 86, look: 'sec' as const, goalDate: '2027-07-31',
  }
  // No answer: the report's priorities, as before.
  const plain = stateFromOnboarding(answers, '2026-10-07')
  assert.deepEqual(plain.visualGoal?.zones, [])
  assert.ok(!Object.values(plain.templates).some((t) => t.exercises.some((e) => e.focus)))
  assert.ok(plain.templates.UPPER.exercises.some((e) => e.volumeTag === 'priority'))
  // Zones chosen: stored, tagged in the sessions, and they replace the report's tags.
  const s = stateFromOnboarding({ ...answers, zones: ['bras', 'jambes'] }, '2026-10-07')
  assert.deepEqual(s.visualGoal?.zones, ['bras', 'jambes'])
  assert.deepEqual(s.templates, tagPriorities(plain.templates, ['bras', 'jambes']))
  assert.ok(s.templates.UPPER.exercises.some((e) => e.focus) && s.templates.LEGS.exercises.some((e) => e.focus))
  assert.ok(!Object.values(s.templates).some((t) => t.exercises.some((e) => e.volumeTag === 'priority')))
  // Anything else than three known zones, each once, is dropped.
  const odd = stateFromOnboarding({ ...answers, zones: ['bras', 'bras', 'cou', 'dos', 'abdos', 'mollets'] as never }, '2026-10-07')
  assert.deepEqual(odd.visualGoal?.zones, ['bras', 'dos', 'abdos'])
  // Maintenance mode has no visual goal: nothing tagged.
  assert.equal(stateFromOnboarding({ ...answers, zones: ['bras'], maintenance: true }, '2026-10-07').visualGoal, null)

  // What the zones change: exactly the exercises the sessions tag, one per zone and per session.
  const sets = prioritySets(s.templates, ['bras', 'jambes'])
  const tagged = Object.values(s.templates).flatMap((t) => t.exercises.filter((e) => e.focus).map((e) => `${t.type}:${e.name}`)).sort()
  assert.deepEqual(sets.map((x) => `${x.type}:${x.name}`).sort(), tagged)
  assert.ok(sets.every((x) => x.zone === 'bras' || x.zone === 'jambes'))
  assert.ok(new Set(sets.map((x) => `${x.type}:${x.zone}`)).size === sets.length, 'one exercise per zone and per session')
  // Without zones: the report's priority exercises.
  const report = prioritySets(plain.templates, [])
  assert.deepEqual(report.map((x) => `${x.type}:${x.name}`).sort(), Object.values(plain.templates).flatMap((t) => t.exercises.filter((e) => e.volumeTag === 'priority').map((e) => `${t.type}:${e.name}`)).sort())
  assert.ok(report.length > 0 && report.every((x) => x.zone === null))

  // From when: block 1 adds nothing, block 2 from week 3 if performance rises, the cut from week 1.
  configurePlan(DEFAULT_GOAL)
  const b2 = PERIODS().find((p) => p.id === 'b2')!
  const cut = PERIODS().find((p) => p.kind === 'block' && p.phase === 'cut')!
  const early = prioritySetsStart('2026-10-02')!
  assert.deepEqual([early.date, early.week, early.ifRising, early.running], [addDays(b2.start, 14), 3, true, false])
  assert.equal(early.label, b2.label)
  assert.deepEqual([early.sure?.date, early.sure?.ifRising], [cut.start, false])
  assert.equal(prioritySetsStart(addDays(b2.start, 20))!.running, true)
  const inCut = prioritySetsStart(addDays(cut.start, 3))!
  assert.deepEqual([inCut.date, inCut.week, inCut.ifRising, inCut.running, inCut.sure], [cut.start, 1, false, true, null])
  // The date is the week the prescription really adds the set.
  const lateral = plain.templates.UPPER.exercises.find((e) => e.volumeTag === 'priority')!
  assert.equal(prescribe(lateral, addDays(early.date, -1), null).sets, lateral.target.sets)
  assert.equal(prescribe(lateral, early.date, null).sets, lateral.target.sets + 1)
  assert.equal(prioritySetsStart('2027-06-20'), null, 'the stabilization adds none')
})

test('session length: the clock keeps its leading zero, and the estimate follows the real pace once five sessions are known', async () => {
  const { fmtClock } = await import('../src/lib/format')
  const { sessionPace, sessionDurationMin } = await import('../src/lib/training')
  assert.equal(fmtClock(95), '01:35')
  assert.equal(fmtClock(5649), '01:34:09')
  // A finished session of `sets` sets that took `minutes`.
  const done = (i: number, type: 'UPPER' | 'PUSH', sets: number, minutes: number): Workout => {
    const startedAt = new Date(Date.UTC(2026, 9, 1 + i, 17, 0)).toISOString()
    return {
      id: `w${i}`, sessionNumber: i + 1, type, date: startedAt.slice(0, 10), startedAt, completedAt: new Date(Date.parse(startedAt) + minutes * 60_000).toISOString(), notes: '',
      exercises: [{ exerciseId: 'x', name: 'X', muscle: '', unit: 'kg', target: { sets, minReps: 8, maxReps: 12, weight: 20 }, notes: '', skipped: false, validated: true, comparison: null,
        sets: Array.from({ length: sets }, () => ({ weight: 20, reps: 10, cleanReps: 10, flags: [], note: '', completed: true })) }],
    } as unknown as Workout
  }
  const upper = [0, 1, 2, 3].map((i) => done(i, 'UPPER', 20, 92))
  assert.equal(sessionDurationMin(upper[0]), 92, 'the real length is kept with the session')
  // Four sessions: not enough, the report's length stands.
  assert.equal(sessionPace(upper, 'UPPER'), null)
  assert.equal(program.sessionMinutes('UPPER', 20, sessionPace(upper, 'UPPER')), 65)
  // Five: (92 − 12) / 20 = 4 min a set → 12 + 20 × 4 = 92, shown as 90; a deload of 10 sets, 50.
  const five = [...upper, done(4, 'UPPER', 20, 92)]
  assert.equal(sessionPace(five, 'UPPER'), 4)
  assert.equal(program.sessionMinutes('UPPER', 20, 4), 90)
  assert.equal(program.sessionMinutes('UPPER', 10, 4), 50)
  // Another type has no session of its own yet: the overall pace speaks for it.
  assert.equal(sessionPace(five, 'PUSH'), 4)
  // Three sessions of the type: its own pace, (63 − 12) / 17 = 3.
  const push = [...five, done(5, 'PUSH', 17, 63), done(6, 'PUSH', 17, 63), done(7, 'PUSH', 17, 63)]
  assert.equal(sessionPace(push, 'PUSH'), 3)
  assert.equal(program.sessionMinutes('PUSH', 17, 3), 65)
  assert.equal(sessionPace(push, 'UPPER'), 4)
  // A session left open for hours, or one of a few minutes, says nothing of the pace.
  const noisy = [...five, done(8, 'UPPER', 20, 300), done(9, 'UPPER', 3, 10)]
  assert.equal(sessionPace(noisy, 'UPPER'), 4)
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
    // A change kept with a session logged in French: its exercise is named in English, and its figures speak for its sentence.
    const change = { id: 'c', type: 'LOWER' as const, exerciseId: 'leg-press', name: 'Presse à cuisses', gymId: 'main', date: '2026-10-06', kind: 'up' as const, from: 100, to: 105, text: '3 × 12 atteint : 105 kg la prochaine fois', lang: 'fr' as const }
    const reentry = { ...reentryForGap(10)!, label: 'Reprise après 10 j', advice: 'conseil' }
    const logged = localizeState({ ...defaultState(), workouts: [{ ...workout('w', '2026-10-06', undefined, [], 1), changes: [change], reentry }] }).workouts[0]
    assert.deepEqual([logged.changes?.[0].name, logged.changes?.[0].text, changeLabel(logged.changes![0])], ['Leg press', change.text, '100\u202fkg → 105\u202fkg next time'])
    assert.equal(changeLabel({ ...change, kind: 'sets' }), '1 set fewer until the end of the block')
    assert.deepEqual([logged.reentry?.label, logged.reentry?.sessionsLeft], [reentryForGap(10)!.label, reentry.sessionsLeft])
    assert.notEqual(logged.reentry?.label, reentry.label)
    // The first step of a cut: its question and its sentence.
    const stable = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, date: addDays('2027-01-04', i - 29), weight: 86, waist: null, arm: null, chest: null, shoulders: null }))
    const start = calorieAdvice({ ...defaultState(), bodyEntries: stable }, '2027-01-04')
    assert.deepEqual([start.headline, start.detail, start.first?.question], ['Start of the cut', '0%/wk over the last 3 weeks (target: −0.5 to −0.7%/wk).', 'Were your last 3 weeks normal ones?'])
    assert.equal(start.first?.hint, 'Normal: you ate and moved the way you do today. No holidays, no time off, no diet already started.')
    assert.equal(start.first?.detail, 'The full step aims at a deficit of about 500 kcal a day. That is −500 kcal at once (carbs or fat, never protein), then 2 weeks for your weight to respond.')
    assert.equal(start.otherwise?.detail, 'So your trend does not describe where you are today. For now, a regular step: −150 kcal (carbs or fat, never protein) or ~2,000 more steps a day. The full step will come after 3 normal weeks.')
    const tooStrong = calorieAdvice({ ...defaultState(), bodyEntries: stable.map((e, i) => ({ ...e, date: addDays('2027-01-25', i - 29), weight: 86 * (1 - 0.0085 * (i / 7)) })), nutritionTargets: { ...defaultState().nutritionTargets, calories: 1850, caloriesChangedAt: '2027-01-04', sizedStep: { at: '2027-01-04', from: 2350, to: 1850 } } }, '2027-01-25')
    assert.deepEqual([tooStrong.headline, tooStrong.detail.replace(/^[^(]*/, '')], ['Full step too strong', '(target: −0.5 to −0.7%/wk): above the range since your full step. +150 kcal.'])
    assert.equal(cutAdvice({ ...defaultState(), bodyEntries: stable }, '2027-01-04'), 'Start of the cut: set your calories in More → Nutrition.')
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

test('sources: every rule cites known sources, and guidance is not counted as a study', async () => {
  const { PRINCIPLES, SOURCES, sourceCounts, studyCount } = await import('../src/lib/research')
  for (const p of PRINCIPLES) for (const ref of p.refs) assert.ok(SOURCES[ref], `${p.id} cites ${ref}`)
  const urls = Object.values(SOURCES).map((x) => x.url)
  assert.equal(new Set(urls).size, urls.length, 'one entry per source')
  assert.deepEqual(sourceCounts(), { reported: 31, added: 6, guidance: 1 })
  assert.equal(studyCount(), 37)
  assert.deepEqual(Object.entries(SOURCES).filter(([, x]) => x.guidance).map(([id, x]) => [id, x.added, x.kind]), [['harvard2024', true, 'Recommandation de santé, pas une étude']])
})
