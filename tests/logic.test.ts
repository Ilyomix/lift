// Logic tests: run with `npm test` (node --test + tsx). Pure functions only, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { defaultState, normalizeState, parseBackup, upgradeToResearchProgram } from '../src/lib/backup'
import { applyPlanUpdate, parsePlanUpdate, previewPlanUpdate, sessionPrompt } from '../src/lib/coach'
import { buildIcs, icsEventCount } from '../src/lib/ics'
import {
  contextAt, GOAL_DATE, milestones, PERIODS, prescribe, projectSessions, PROGRAM_START, reentryForGap, ROTATION,
} from '../src/lib/program'
import { goalWeightRange, movingAverage7, plannedWeightPath } from '../src/lib/stats'
import { compareExercise, finalizeWorkout, plannedVolume, progressionFor } from '../src/lib/training'
import type { AppState, Workout, WorkoutExercise } from '../src/lib/types'

const BACKUP = process.env.GOLGOTH_BACKUP

test('periods tile the calendar without gaps from the foundation to the goal', () => {
  for (let i = 1; i < PERIODS.length; i++) {
    const prev = new Date(PERIODS[i - 1].end + 'T12:00:00')
    prev.setDate(prev.getDate() + 1)
    assert.equal(prev.toISOString().slice(0, 10), PERIODS[i].start, `${PERIODS[i - 1].id} → ${PERIODS[i].id}`)
  }
  assert.equal(PERIODS[PERIODS.length - 1].end, GOAL_DATE)
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
  assert.equal(m.at(-1)!.date, GOAL_DATE)
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
