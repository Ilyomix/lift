import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultState } from '../src/lib/backup'
import { workoutsBefore } from '../src/lib/comparability'
import { setLang } from '../src/lib/i18n'
import { useStore } from '../src/lib/store'
import { exerciseHistory, finalizeWorkout } from '../src/lib/training'
import { SessionScreen } from '../src/screens/Session'
import type { Workout } from '../src/lib/types'

afterEach(() => setLang('fr'))

function workout(n: number, date: string, reps = 8): Workout {
  const target = { weight: 20, sets: 2, minReps: 8, maxReps: 12, restSeconds: 90, rir: '2' }
  return {
    id: `chronology-${n}`, type: 'UPPER', date, sessionNumber: n, startedAt: '', completedAt: '', notes: '',
    exercises: [{ exerciseId: 'triceps-overhead-rope', name: 'Triceps', muscle: 'Triceps', unit: 'kg', target,
      prescription: { ...target, loadFactor: 1, notes: [] },
      sets: Array.from({ length: 2 }, () => ({ weight: 20, reps, cleanReps: reps, rir: 2, flags: [], note: '', completed: true })),
      notes: '', skipped: false, validated: true, comparison: null }],
  }
}

test('an undated session number includes earlier same-day workouts but excludes future dates', () => {
  const history = [workout(1, '2026-10-05'), workout(2, '2026-10-07'), workout(3, '2026-10-09')]
  assert.deepEqual(workoutsBefore(history, { id: 'new', date: '2026-10-07' }).map(w => w.id), [history[0].id, history[1].id])
})

test('a reopened workout without a session number retains its stored same-day boundary', () => {
  const history = [workout(1, '2026-10-05'), workout(2, '2026-10-07'), workout(3, '2026-10-07'), workout(4, '2026-10-07')]
  assert.deepEqual(workoutsBefore(history, { id: history[2].id, date: '2026-10-07' }).map(w => w.id), [history[0].id, history[1].id])
  assert.deepEqual(workoutsBefore(history, { id: history[2].id, date: '2026-10-05' }).map(w => w.id), [history[0].id], 'the corrected date is respected')
})

test('a backdated active workout shows only its earlier reference and pain history', () => {
  const original = useStore.getState()
  const initial = useStore.getInitialState()
  const originalInitial = { ...initial }
  try {
    setLang('en')
    const state = defaultState()
    const earlier = workout(1, '2026-10-05')
    const future = workout(2, '2026-10-09', 12)
    future.exercises[0].sets[0].flags = ['pain']
    state.workouts = [earlier, future]
    state.activeWorkout = {
      ...workout(3, '2026-10-07'), id: 'new-active', timer: null, timerEndAt: null,
      exercises: earlier.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s, reps: null, cleanReps: null, completed: false })) })),
    }
    useStore.setState({ state, ready: true, hasData: false, storage: 'memory' })
    Object.assign(initial, useStore.getState())
    const html = renderToStaticMarkup(createElement(SessionScreen))
    assert.match(html, /17 clean reps/)
    assert.doesNotMatch(html, /25 clean reps|Pain flagged last time/)
  } finally {
    Object.assign(initial, originalInitial)
    useStore.setState(original, true)
  }
})

test('records compare the same unit and declared conditions, without erasing earlier history', () => {
  for (const scenario of ['unit', 'context'] as const) {
    const history: Workout[] = []
    for (const [i, weight] of [80, 20, 25].entries()) {
      const input = workout(i + 1, `2026-10-0${i + 5}`, 10)
      const ex = input.exercises[0]
      ex.unit = scenario === 'unit' && i > 0 ? 'kg/main' : 'kg'
      ex.comparisonContext = scenario === 'context' ? i === 0 ? 'Machine A' : i === 1 ? ' Machine B ' : 'machine b' : ''
      ex.target.weight = weight
      ex.prescription!.weight = weight
      ex.sets = ex.sets.map(s => ({ ...s, weight }))
      const original = structuredClone(input)
      const result = finalizeWorkout(history, input)
      assert.deepEqual(input, original)
      history.push(result.workout)
    }
    assert.equal(history[1].exercises[0].comparison!.isRecord, false, `${scenario}: changed conditions establish a new reference`)
    assert.equal(history[2].exercises[0].comparison!.isRecord, true, `${scenario}: 25 beats the comparable 20, not the unrelated 80`)
    const points = exerciseHistory(history, 'triceps-overhead-rope')
    assert.equal(points.length, 3, 'all raw history remains available')
    if (scenario === 'context') assert.deepEqual(points.map(p => p.comparisonContext), ['machine a', 'machine b', 'machine b'])
    const lower = structuredClone(history[2])
    lower.id = 'lower'; lower.date = '2026-10-08'; lower.sessionNumber = 4
    lower.exercises[0].sets = lower.exercises[0].sets.map(s => ({ ...s, weight: 22.5 }))
    assert.equal(finalizeWorkout(history, lower).workout.exercises[0].comparison!.isRecord, false, 'a lower result does not get a record')
  }
})
