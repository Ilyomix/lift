import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultState } from '../src/lib/backup'
import { workoutActivityState } from '../src/lib/native/snapshot'
import { latestSync } from '../src/lib/native/sync'
import { applyNativeRestAction, matchesRestNotification, type NativeRestAction } from '../src/lib/native/restActions'
import type { ActiveWorkout, WorkoutExercise } from '../src/lib/types'

function fixture(): ActiveWorkout {
  const e = defaultState().templates.PUSH.exercises[0]
  const exercise: WorkoutExercise = {
    ...e, unit: 'kg', name: 'Chest Press', skipped: false, validated: false, notes: '', comparison: null,
    target: { weight: 40, sets: 3, minReps: 10, maxReps: 15, restSeconds: 120, rir: '2' },
    sets: Array.from({ length: 3 }, (_, i) => ({ weight: i === 1 ? 42 : 40, reps: null, cleanReps: null, flags: [], note: '', completed: i === 0 })),
  }
  return { id: 'workout-1', type: 'PUSH', date: '2026-10-03', startedAt: '2026-10-03T02:00:00Z', notes: '', timerEndAt: null,
    timer: { endAt: 100000, total: 120, label: 'Chest Press', next: 'Série 2/3 · Chest Press' }, exercises: [exercise] }
}

test('native tracking translates every generated workout label in French and English', () => {
  const a = fixture()
  const fr = workoutActivityState(a, 'fr', 1000)!
  const en = workoutActivityState(a, 'en', 1000)!
  assert.equal(fr.setLabel, 'Série 2/3')
  assert.equal(en.setLabel, 'Set 2/3')
  assert.equal(fr.restLabel, 'Repos')
  assert.equal(en.restLabel, 'Rest')
  assert.equal(fr.progressLabel, 'séries')
  assert.equal(en.progressLabel, 'sets')
  assert.equal(fr.readyLabel, 'À toi')
  assert.equal(en.readyLabel, 'Go')
  assert.equal(en.detail, '42 kg · 10–15 reps · RIR 2')
  assert.equal(en.restEndAt, 100000)
  assert.equal(en.expiresAt, 1000 + 8 * 3600000)
})

test('bodyweight labels and completed workouts follow the selected language', () => {
  const a = fixture()
  a.exercises[0].unit = 'PDC'
  assert.match(workoutActivityState(a, 'fr')!.detail, /^PDC \+ 42 kg/)
  assert.match(workoutActivityState(a, 'en')!.detail, /^BW \+ 42 kg/)
  a.exercises[0].sets.forEach(s => s.completed = true)
  assert.equal(workoutActivityState(a, 'fr')!.exercise, 'Séance terminée')
  assert.equal(workoutActivityState(a, 'en')!.exercise, 'Workout complete')
})

test('skipped exercises do not inflate native progress, and corrections never start activities', () => {
  const a = fixture()
  a.exercises.push({ ...a.exercises[0], skipped: true })
  const s = workoutActivityState(a, 'en')!
  assert.equal(s.completedSets, 1)
  assert.equal(s.totalSets, 3)
  assert.equal(workoutActivityState(null, 'en'), null)
  a.reopened = { completedAt: '2026-10-03T02:00:00Z' }
  assert.equal(workoutActivityState(a, 'en'), null)
})

test('native next exercise follows an out-of-order rest and current prescription', () => {
  const a = fixture()
  a.exercises.push({ ...a.exercises[0], name: 'Row', prescription: { sets: 3, minReps: 8, maxReps: 12, rir: '1–2', weight: 50, restSeconds: 180, loadFactor: 1, notes: [] } })
  a.timer!.next = 'Set 2/3 · Row'
  const s = workoutActivityState(a, 'en')!
  assert.equal(s.exercise, 'Row')
  assert.match(s.detail, /8–12 reps · RIR 1–2/)
})

test('native queue coalesces pending updates and ends after a slow in-flight update', async () => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const sent: Array<string | null> = []
  const submit = latestSync<string | null>(async value => { sent.push(value); if (value === 'start') await gate }, assert.fail)
  submit('start'); submit('rest'); submit('adjust'); submit(null)
  assert.deepEqual(sent, ['start'])
  release()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sent, ['start', null])
})

test('native queue recovers from a rejected update', async () => {
  const errors: unknown[] = []
  const sent: number[] = []
  const submit = latestSync<number>(async value => { sent.push(value); if (value === 1) throw new Error('disabled') }, e => errors.push(e))
  submit(1); submit(2)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sent, [1, 2])
  assert.equal(errors.length, 1)
})

 test('per-hand loads translate independently of stored unit names', () => {
  const a = fixture()
  a.exercises[0].unit = 'kg/main'
  assert.match(workoutActivityState(a, 'fr')!.detail, /^42 kg\/main/)
  assert.match(workoutActivityState(a, 'en')!.detail, /^42 kg\/hand/)
})

test('decimal loads follow the selected locale', () => {
  const a = fixture()
  a.exercises[0].sets[1].weight = 42.5
  assert.match(workoutActivityState(a, 'fr')!.detail, /^42,5 kg/)
  assert.match(workoutActivityState(a, 'en')!.detail, /^42\.5 kg/)
})

test('native rest results are idempotent and old actions cannot change a later rest', () => {
  const current = fixture()
  const action: NativeRestAction = { id: '1', workoutId: current.id, expectedRestEndAt: 100000, restEndAt: 130000, restTotal: 150, action: 'add30' }
  const updated = applyNativeRestAction(current, action)!
  assert.equal(updated.timer!.endAt, 130000)
  assert.equal(applyNativeRestAction(updated, action), updated)
  assert.equal(applyNativeRestAction(updated, { ...action, restEndAt: null, action: 'skip' }), updated)
  assert.equal(applyNativeRestAction(current, { ...action, workoutId: 'another-workout' }), current)
  assert.equal(applyNativeRestAction(current, { ...action, restEndAt: NaN }), current)
})

test('queued native rest actions recover in order across a save before acknowledgement', () => {
  const first: NativeRestAction = { id: '1', workoutId: 'workout-1', expectedRestEndAt: 100000, restEndAt: 130000, restTotal: 150, action: 'add30' }
  const second: NativeRestAction = { ...first, id: '2', expectedRestEndAt: 130000, restEndAt: 160000, restTotal: 180 }
  const persisted = applyNativeRestAction(fixture(), first)!
  const replayed = applyNativeRestAction(persisted, first)!
  const updated = applyNativeRestAction(replayed, second)!
  assert.equal(updated.timer!.endAt, 160000)
  const stopped = applyNativeRestAction(updated, { ...second, id: '3', expectedRestEndAt: 160000, restEndAt: null, action: 'skip' })!
  assert.equal(stopped.timer, null)
  assert.equal(stopped.timerEndAt, null)
})

test('notification actions require the same current workout and exact rest deadline', () => {
  const workout = fixture()
  assert.equal(matchesRestNotification(workout, { workoutId: workout.id, restEndAt: 100000 }), true)
  assert.equal(matchesRestNotification(workout, { workoutId: workout.id, restEndAt: 99000 }), false)
  assert.equal(matchesRestNotification(workout, { workoutId: 'old', restEndAt: 100000 }), false)
  assert.equal(matchesRestNotification(workout, { workoutId: workout.id, restEndAt: '100000' }), false)
  assert.equal(matchesRestNotification(null, {}), false)
})
