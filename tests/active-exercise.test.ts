import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { currentExerciseIndex } from '../src/lib/activeExercise'
import { defaultState, makeBackup, normalizeState, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { workoutActivityState } from '../src/lib/native/snapshot'
import { applyNativeRestAction } from '../src/lib/native/restActions'
import { useStore } from '../src/lib/store'

const actions = () => useStore.getState()
const active = () => actions().state.activeWorkout!
const initialLanguage = lang()
beforeEach(() => {
  setLang('fr')
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' })
  actions().startSession('PUSH')
  const state = actions().state
  const exercises = active().exercises.slice(0, 3).map((exercise, i) => ({
    ...exercise, name: `Exercise ${i}`, supersetWithNext: false,
    target: { ...exercise.target, weight: 20 + i, sets: 2, minReps: 10, maxReps: 15, restSeconds: 90, rir: '3' },
    prescription: undefined,
    sets: exercise.sets.slice(0, 2).map(set => ({ ...set, weight: 20 + i, reps: null, cleanReps: null, completed: false })),
  }))
  assert.equal(exercises.length, 3)
  assert.ok(exercises.every(exercise => exercise.sets.length === 2))
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
})
afterEach(async () => { setLang(initialLanguage); await actions().flush() })
const complete = (exercise: number, set: number) => actions().completeSet(exercise, set, { weight: 25, reps: 12 })

test('touch/keyboard focus aligns the rest label without changing its deadline, plan or history', () => {
  actions().startRest(90, 'Previous exercise', 'Exercise 0')
  const before = actions().state
  actions().focusExercise(2)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.equal(workoutActivityState(active(), 'fr')!.exercise, 'Exercise 2')
  assert.deepEqual(active().timer, { ...before.activeWorkout!.timer, next: 'Série 1/2 · Exercise 2' })
  assert.equal(actions().state.workouts, before.workouts)
  assert.equal(actions().state.templates, before.templates)
  assert.equal(active().exercises, before.activeWorkout!.exercises)
  const focused = actions().state
  for (const index of [2, -1, 3, 0.5, NaN, Infinity]) actions().focusExercise(index)
  assert.equal(actions().state, focused, 'same or invalid focus does not save another state')
})

test('logging the final row first keeps the current exercise and announces its actual pending set', () => {
  complete(2, 1)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.equal(active().timer!.next, 'Série 1/2 · Exercise 2')
  assert.equal(workoutActivityState(active(), 'fr')!.setLabel, 'Série 1/2')
  complete(2, 0)
  assert.equal(currentExerciseIndex(active()), 0, 'last exercise wraps to earlier unfinished work')
  assert.equal(active().timer!.next, 'Exercise 0')
  assert.equal(workoutActivityState(active(), 'fr')!.exercise, 'Exercise 0')
})

test('skipping current work advances forward and wraps, excluding completed and skipped exercises', () => {
  complete(1, 0); complete(1, 1)
  actions().focusExercise(2)
  actions().skipExercise(2, true)
  assert.equal(currentExerciseIndex(active()), 0)
  actions().focusExercise(1)
  assert.equal(currentExerciseIndex(active()), 0, 'completed exercises cannot claim focus')
  actions().skipExercise(0, true)
  assert.equal(currentExerciseIndex(active()), -1)
  assert.equal(workoutActivityState(active(), 'en')!.exercise, 'Workout complete')
  actions().skipExercise(2, false)
  assert.equal(currentExerciseIndex(active()), 2)
})

test('duplicate names and IDs keep the selected occurrence and its own load', () => {
  const state = actions().state
  const exercises = [...active().exercises]
  exercises[2] = { ...exercises[0], target: { ...exercises[0].target, weight: 42 }, sets: exercises[0].sets.map(set => ({ ...set, weight: 42 })) }
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
  actions().focusExercise(2)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.match(workoutActivityState(active(), 'en')!.detail, /^42 /)
  complete(2, 0)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.match(workoutActivityState(active(), 'en')!.detail, /^42 /)
  assert.equal(active().exercises[0].sets[0].completed, false)
})

test('focus survives stopped and expired rests, a backup round trip, and invalid imports are discarded', () => {
  complete(2, 0)
  actions().stopRest()
  assert.equal(active().timer, null)
  assert.equal(currentExerciseIndex(active()), 2)
  const restored = parseBackup(JSON.stringify(makeBackup(actions().state, []))).state
  assert.equal(restored.activeWorkout!.activeExerciseIndex, 2)
  assert.equal(currentExerciseIndex(restored.activeWorkout!), 2)
  const expired = normalizeState({ ...restored, activeWorkout: { ...restored.activeWorkout, timer: { endAt: 1, total: 90, label: '', next: 'Exercise 0' } } })
  assert.equal(expired.activeWorkout!.timer, null)
  assert.equal(currentExerciseIndex(expired.activeWorkout!), 2)
  for (const value of [-1, 3, 0.5, '2', NaN, Infinity, null]) {
    const imported = normalizeState({ ...restored, activeWorkout: { ...restored.activeWorkout, activeExerciseIndex: value } })
    assert.equal(imported.activeWorkout!.activeExerciseIndex, undefined)
    assert.equal(currentExerciseIndex(imported.activeWorkout!), 0)
  }
})

test('a legacy rest label resolves until first interaction, including stopping the rest', () => {
  actions().startRest(90, 'Exercise 2', 'Set 1/2 · Exercise 2')
  assert.equal(active().activeExerciseIndex, undefined)
  assert.equal(currentExerciseIndex(active()), 2)
  actions().stopRest()
  assert.equal(active().activeExerciseIndex, 2)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.equal(workoutActivityState(active(), 'en')!.exercise, 'Exercise 2')
})

test('native skip freezes legacy focus before discarding its rest label', () => {
  actions().startRest(90, 'Exercise 2', 'Set 1/2 · Exercise 2')
  const workout = active()
  const skipped = applyNativeRestAction(workout, {
    id: 'native-skip', workoutId: workout.id, expectedRestEndAt: workout.timer!.endAt,
    restEndAt: null, restTotal: 0, action: 'skip',
  })!
  assert.equal(skipped.timer, null)
  assert.equal(skipped.activeExerciseIndex, 2)
  assert.equal(currentExerciseIndex(skipped), 2)
  assert.equal(workoutActivityState(skipped, 'en')!.exercise, 'Exercise 2')
})

test('superset rounds focus the partner without rest, then return to the pending head', () => {
  const state = actions().state
  const exercises = active().exercises.map((exercise, i) => i === 1 ? { ...exercise, supersetWithNext: true } : exercise)
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
  complete(1, 0)
  assert.equal(active().timer, null)
  assert.equal(currentExerciseIndex(active()), 2)
  complete(2, 0)
  assert.equal(currentExerciseIndex(active()), 1)
  assert.equal(active().timer!.label, 'Exercise 1 + Exercise 2')
  assert.equal(active().timer!.next, 'Exercise 1')
  actions().stopRest()
  complete(1, 1)
  assert.equal(active().timer, null)
  assert.equal(currentExerciseIndex(active()), 2)
  complete(2, 1)
  assert.equal(currentExerciseIndex(active()), 0)
  assert.equal(active().timer!.next, 'Exercise 0')
})

test('undoing a completed set restores its exercise focus and keeps live activity in sync', () => {
  complete(2, 0); complete(2, 1)
  assert.equal(currentExerciseIndex(active()), 0)
  complete(2, 1)
  assert.equal(active().exercises[2].sets[1].completed, false)
  assert.equal(currentExerciseIndex(active()), 2)
  assert.equal(workoutActivityState(active(), 'en')!.setLabel, 'Set 2/2')
})
