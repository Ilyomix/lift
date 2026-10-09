import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { deferredFocus } from '../src/lib/activeExercise'
import { defaultState, normalizeState } from '../src/lib/backup'
import { addDays, todayISO } from '../src/lib/date'
import { lang, setLang } from '../src/lib/i18n'
import { normalizePostponed, POSTPONE_DAYS, postponedFor } from '../src/lib/postponed'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { finishedState } from '../src/lib/training'
import { useStore } from '../src/lib/store'
import { SessionScreen } from '../src/screens/Session'
import type { ActiveWorkout, AppState, PostponedExercise, WorkoutExercise } from '../src/lib/types'

const initial = useStore.getInitialState()
const originalStore = useStore.getState()
const originalState = initial.state
const originalLanguage = lang()
const actions = () => useStore.getState()
const state = () => actions().state
const active = () => state().activeWorkout!
const ROW = 'low-cable-row' // UPPER only: no twin sheet to follow it.
const rowIndex = () => active().exercises.findIndex(e => e.exerciseId === ROW)

beforeEach(() => {
  setLang('en')
  configurePlan(DEFAULT_GOAL)
  // Store actions run normally, but this fixture never writes browser storage.
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory', toast: null })
})

afterEach(async () => {
  await actions().flush()
  initial.state = originalState
  useStore.setState({ ...originalStore, state: originalState }, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('a taken machine moves the exercise to the next workout of any type, which takes it at its end', () => {
  actions().startSession('UPPER')
  const upper = active().id
  const index = rowIndex()
  assert.ok(index >= 0)
  actions().focusExercise(index)
  assert.equal(actions().postponeExercise(index), true)
  const moved = active().exercises[index]
  assert.equal(moved.skipped, true)
  assert.equal(moved.skipReason, 'Moved to next workout')
  assert.notEqual(active().activeExerciseIndex, index, 'the workout goes on with another exercise')
  assert.deepEqual(state().postponed!.map(item => [item.exercise.exerciseId, item.fromType, item.fromWorkoutId]), [[ROW, 'UPPER', upper]])
  assert.equal(state().postponed![0].exercise.supersetWithNext, undefined)
  assert.equal('sets' in state().postponed![0].exercise, false, 'the move keeps the plan, not the logged sets')

  // Restored, it stays in this workout and nothing moves.
  actions().skipExercise(index, false)
  assert.equal(active().exercises[index].skipped, false)
  assert.equal(state().postponed, undefined)
  assert.equal('postponed' in state(), false)

  assert.equal(actions().postponeExercise(index), true)
  assert.ok(actions().finishSession())
  assert.equal(state().postponed?.length, 1, 'the move waits for the next workout')

  actions().startSession('LOWER')
  const last = active().exercises.at(-1)!
  assert.equal(last.exerciseId, ROW)
  assert.deepEqual(last.postponedFrom, { type: 'UPPER', date: todayISO() })
  assert.ok(last.sets.length > 0 && last.prescription)
  assert.equal(active().exercises.length, state().templates.LOWER.exercises.length + 1)
  // Discarding the workout that took it in leaves the move waiting.
  actions().discardSession()
  assert.equal(state().postponed?.length, 1)

  actions().startSession('LOWER')
  assert.equal(active().exercises.at(-1)!.exerciseId, ROW)
  assert.ok(actions().finishSession())
  assert.equal(state().postponed, undefined, 'the move is used up once the next workout is finished')
  actions().startSession('PUSH')
  assert.ok(!active().exercises.some(e => e.exerciseId === ROW))
})

test('a workout discarded or deleted takes its moves with it; logged sets and corrections cannot move', () => {
  actions().startSession('UPPER')
  assert.equal(actions().postponeExercise(rowIndex()), true)
  actions().discardSession()
  assert.equal(state().postponed, undefined)

  actions().startSession('UPPER')
  const index = rowIndex()
  actions().completeSet(0, 0, { weight: 50, reps: 10 })
  assert.equal(actions().postponeExercise(0), false, 'sets already logged stay with this workout')
  assert.equal(actions().postponeExercise(index), true)
  const id = actions().finishSession()!
  assert.equal(state().postponed?.length, 1)
  actions().deleteWorkout(id)
  assert.equal(state().postponed, undefined)

  actions().startSession('UPPER')
  actions().completeSet(0, 0, { weight: 50, reps: 10 })
  const finished = actions().finishSession()!
  assert.equal(actions().reopenWorkout(finished), true)
  assert.equal(actions().postponeExercise(rowIndex()), false, 'a correction does not reach the next workout')
  assert.equal(state().postponed, undefined)
})

test('moves wait a week at most, once per exercise, and never double an exercise already planned', () => {
  const s = defaultState()
  const today = '2026-10-12'
  const row = s.templates.UPPER.exercises.find(e => e.exerciseId === ROW)!
  const curl = s.templates.LOWER.exercises.find(e => e.exerciseId === 'leg-curl')!
  s.postponed = [
    { exercise: row, fromType: 'UPPER', fromDate: today, fromWorkoutId: 'a' },
    { exercise: curl, fromType: 'LOWER', fromDate: today, fromWorkoutId: 'b' },
  ]
  assert.deepEqual(postponedFor(s, today, s.templates.LEGS.exercises).map(c => c.exercise.exerciseId), [ROW], 'LEGS already holds the leg curl')
  assert.deepEqual(postponedFor(s, addDays(today, POSTPONE_DAYS), []).map(c => c.exercise.exerciseId), [ROW, 'leg-curl'])
  assert.deepEqual(postponedFor(s, addDays(today, POSTPONE_DAYS + 1), []), [])
  assert.deepEqual(postponedFor(s, today, [], 'a').map(c => c.exercise.exerciseId), ['leg-curl'], 'a workout never takes its own moves')
  // The sheet as it stands now wins over the day's copy.
  s.templates.UPPER.exercises = s.templates.UPPER.exercises.map(e => e.exerciseId === ROW ? { ...e, target: { ...e.target, weight: 60 } } : e)
  assert.equal(postponedFor(s, today)[0].exercise.target.weight, 60)
})

test('a carried exercise moves the load of its own sheet, not the one of the workout it was done in', () => {
  const date = '2026-10-13'
  const before = defaultState()
  before.templates.UPPER.exercises = before.templates.UPPER.exercises.map(e => e.exerciseId === ROW ? { ...e, target: { ...e.target, weight: 50 } } : e)
  const sheet = before.templates.UPPER.exercises.find(e => e.exerciseId === ROW)!
  const carried = (postponedFrom?: WorkoutExercise['postponedFrom']): WorkoutExercise => ({
    ...sheet, notes: '', skipped: false, validated: false, comparison: null, ...(postponedFrom ? { postponedFrom } : {}),
    prescription: { ...sheet.target, rir: '2', weight: 50, loadFactor: 1, notes: [] },
    sets: Array.from({ length: sheet.target.sets }, () => ({ weight: 50, reps: 12, cleanReps: 12, rir: 2, flags: [], note: '', completed: true })),
  })
  const workout = (exercise: WorkoutExercise): ActiveWorkout => ({
    id: 'lower', type: 'LOWER', date, startedAt: `${date}T10:00:00Z`, notes: '', timer: null, timerEndAt: null, exercises: [exercise],
  })
  const done = finishedState({ ...before, activeWorkout: workout(carried({ type: 'UPPER', date: '2026-10-12' })) }, `${date}T11:00:00Z`, date)!
  const change = done.result.changes.find(c => c.exerciseId === ROW)!
  assert.equal(change.type, 'UPPER')
  assert.equal(done.state.templates.UPPER.exercises.find(e => e.exerciseId === ROW)!.target.weight, 52.5)
  assert.deepEqual(done.state.templates.LOWER, before.templates.LOWER)
  assert.equal(done.state.nextWorkoutType, 'PUSH', 'the rotation follows the workout done')
  // The same sets without the move: the exercise is no sheet's, nothing moves.
  const loose = finishedState({ ...before, activeWorkout: workout(carried()) }, `${date}T11:00:00Z`, date)!
  assert.deepEqual(loose.result.changes, [])
})

test('doing it later skips to the next exercise outside its superset, and comes back after the others', () => {
  const exercise = (name: string, pending: boolean, supersetWithNext = false): WorkoutExercise => ({
    exerciseId: name, name, muscle: '', unit: 'kg', target: { weight: null, sets: 1, minReps: 8, maxReps: 12, restSeconds: 90 },
    notes: '', skipped: false, validated: false, comparison: null, ...(supersetWithNext ? { supersetWithNext } : {}),
    sets: [{ weight: null, reps: pending ? null : 10, cleanReps: pending ? null : 10, flags: [], note: '', completed: !pending }],
  })
  const w = (exercises: WorkoutExercise[]) => ({ exercises } as ActiveWorkout)
  assert.equal(deferredFocus(w([exercise('a', true), exercise('b', true, true), exercise('c', true), exercise('d', true)]), 1), 3)
  assert.equal(deferredFocus(w([exercise('a', true), exercise('b', true, true), exercise('c', true), exercise('d', false)]), 2), 0)
  assert.equal(deferredFocus(w([exercise('a', false), exercise('b', true), exercise('c', false)]), 1), -1)

  actions().startSession('UPPER')
  const index = rowIndex()
  actions().focusExercise(index)
  const next = actions().deferExercise(index)
  assert.ok(next > index)
  assert.equal(active().activeExerciseIndex, next)
  assert.equal(active().exercises[index].skipped, false, 'the exercise stays in the workout')
  // Everything else done: the focus comes back to it.
  for (const [i, ex] of active().exercises.entries()) {
    if (i === index) continue
    ex.sets.forEach((_, set) => actions().completeSet(i, set, { weight: 20, reps: 10 }))
  }
  assert.equal(active().activeExerciseIndex, index)
  assert.equal(actions().deferExercise(index), -1)
})

test('backups keep well-formed moves only, one per exercise', () => {
  const row = JSON.parse(JSON.stringify(defaultState().templates.UPPER.exercises.find(e => e.exerciseId === ROW)!))
  const good: PostponedExercise = { exercise: row, fromType: 'UPPER', fromDate: '2026-10-12', fromWorkoutId: 'w1' }
  const later = { ...good, fromDate: '2026-10-13', fromWorkoutId: 'w2' }
  const kept = normalizePostponed([null, 'x', { ...good, fromType: 'ARMS' }, { ...good, fromDate: '12/10/2026' }, { ...good, exercise: { ...row, target: { ...row.target, sets: 0 } } }, good, later])
  assert.deepEqual(kept, [later])
  assert.equal(normalizePostponed({}), undefined)
  assert.equal(normalizePostponed([]), undefined)
  const sets = { ...row, sets: [], supersetWithNext: true, unit: 'lbs' }
  assert.deepEqual(Object.keys(normalizePostponed([{ ...good, exercise: sets }])![0].exercise).filter(k => k === 'sets' || k === 'supersetWithNext'), [])
  assert.equal(normalizePostponed([{ ...good, exercise: sets }])![0].exercise.unit, 'kg')
  const restored: AppState = normalizeState(JSON.parse(JSON.stringify({ ...defaultState(), postponed: [good] })))
  assert.deepEqual(restored.postponed, [good])
  assert.equal('postponed' in normalizeState(JSON.parse(JSON.stringify(defaultState()))), false)
})

const textOf = (html: string) => html.replace(/<[^>]*>/g, '')
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => ({
  attributes: match[1], name: match[1].match(/aria-label="([^"]+)"/)?.[1] ?? textOf(match[2]),
}))
function render() {
  initial.state = state()
  return renderToStaticMarkup(createElement(SessionScreen))
}

test('the machine-taken shortcut is offered at the gym in both languages, not at home or in a correction', () => {
  actions().startSession('UPPER')
  const name = active().exercises[0].name
  assert.ok(buttons(render()).some(button => button.name === `Machine taken: ${name}` && /aria-haspopup="dialog"/.test(button.attributes)))
  setLang('fr')
  assert.ok(buttons(render()).some(button => button.name === `Machine occupée : ${active().exercises[0].name}`))
  setLang('en')
  useStore.setState({ state: { ...state(), settings: { ...state().settings, setup: { place: 'home', equipment: [] } } } })
  assert.ok(!buttons(render()).some(button => button.name.startsWith('Machine taken')))
  useStore.setState({ state: { ...state(), settings: { ...state().settings, setup: { place: 'gym', equipment: [] } }, activeWorkout: { ...active(), reopened: { completedAt: null } } } })
  assert.ok(!buttons(render()).some(button => button.name.startsWith('Machine taken')))
})

test('the next workout preview lists a moved exercise at its end, with a way to leave it out', () => {
  actions().startSession('UPPER')
  const name = active().exercises[rowIndex()].name
  actions().postponeExercise(rowIndex())
  actions().finishSession()
  const html = render()
  const text = textOf(html)
  assert.ok(text.includes(name))
  assert.match(text, /Moved from Upper/)
  const drop = buttons(html).find(button => button.name === `Don’t add ${name} to this workout`)
  assert.ok(drop)
  assert.match(text, /Moved exercises join the end of your next workout/)
  actions().dropPostponed(ROW)
  assert.equal(state().postponed, undefined)
  assert.doesNotMatch(textOf(render()), /Moved from/)
})
