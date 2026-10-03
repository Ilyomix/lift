import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setLang } from '../src/lib/i18n'
import { onboardingSession, stateFromOnboarding, type OnboardingAnswers } from '../src/lib/onboarding'
import type { TrainingSetup } from '../src/lib/types'

test('onboarding previews the saved first session for each equipment choice and rhythm, without sample history', () => {
  const setups: TrainingSetup[] = [
    { place: 'gym', equipment: [] },
    { place: 'home', equipment: [] },
    { place: 'home', equipment: ['dumbbells', 'bench'] },
    { place: 'home', equipment: ['bands', 'pullupBar'] },
  ]
  const goals: Pick<OnboardingAnswers, 'maintenance' | 'zones' | 'goalDate'>[] = [
    { maintenance: true, zones: [], goalDate: '2027-07-31' },
    { maintenance: false, zones: ['bras', 'jambes'], goalDate: '2027-07-31' },
    { maintenance: false, zones: ['dos', 'bras', 'abdos'], goalDate: '2026-12-31' },
  ]
  for (const lang of ['fr', 'en'] as const) for (const setup of setups) for (const days of [[1, 4], [1, 3, 5], [1, 2, 4, 5, 6]]) for (const goal of goals) {
    setLang(lang)
    const answers: OnboardingAnswers = { lang, setup, days, sex: 'm', age: 30, heightCm: 178, weight: 80, waist: null, look: 'sec', ...goal }
    const before = structuredClone(answers)
    const preview = onboardingSession(answers, '2026-10-07')
    const state = stateFromOnboarding(answers, '2026-10-07')
    const first = state.templates[state.nextWorkoutType].exercises
    assert.equal(preview.type, state.nextWorkoutType)
    assert.deepEqual(preview.exercises, first)
    assert.deepEqual(answers, before)
    assert.deepEqual(state.workouts, [])
    assert.equal(state.activeWorkout, null)
    assert.equal(state.bodyEntries.length, 1)
    assert.equal(state.bodyEntries[0].weight, answers.weight)
  }
})
