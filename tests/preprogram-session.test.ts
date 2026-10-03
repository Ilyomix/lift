import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildResearchTemplates, configurePlan, DEFAULT_GOAL, prescribeSession } from '../src/lib/program'

test('trying a new plan before Monday keeps introductory effort without altering imported foundation sessions', () => {
  const exercises = buildResearchTemplates().UPPER.exercises
  try {
    configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-10-05', foundation: null })
    for (const date of ['2026-10-03', '2026-10-05']) {
      assert.ok(prescribeSession(exercises, date, null).every(p => p.rir === '3'))
    }
    assert.ok(prescribeSession(exercises, '2026-10-12', null).every(p => p.rir === '2'))
    configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-10-05', foundation: '2026-09-28' })
    assert.deepEqual(prescribeSession(exercises, '2026-10-03', null).map(p => p.rir), exercises.map(e => e.target.rir))
  } finally {
    configurePlan(DEFAULT_GOAL)
  }
})
