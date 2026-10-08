import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { onboardingPreview, onboardingSession, stateFromOnboarding, type OnboardingAnswers } from '../src/lib/onboarding'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { goalApplied, tagPriorities } from '../src/lib/visual'

const TODAY = '2026-10-08'
const answers: OnboardingAnswers = {
  lang: 'fr', setup: { place: 'gym', equipment: [] }, days: [1, 2, 4, 5, 6],
  sex: 'f', age: 31, heightCm: 165, weight: 65, waist: 75,
  look: 'athletique', zones: ['bras', 'jambes'], goalDate: '2027-07-31', maintenance: true,
}
const preferences = { look: 'sec' as const, zones: ['dos', 'bras'] as const, bodyFat: 22, heightCm: 170, sex: 'f' as const }
const state = () => useStore.getState().state
const actions = () => useStore.getState()

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T12:00:00Z`) })
  const base = defaultState()
  useStore.setState({ state: {
    ...base,
    settings: { ...base.settings, maintenance: true },
    goals: { ...base.goals, targetWeightMin: 64, targetWeightMax: 66, targetWaist: 74 },
    profile: { heightCm: 165, age: 31, sex: 'f' },
    visualGoal: { look: 'athletique', zones: ['jambes'], bodyFat: 24, photoId: 'goal-reference' },
    workouts: [{ id: 'completed', date: TODAY, type: 'UPPER', sessionNumber: 1, startedAt: `${TODAY}T09:00:00Z`, completedAt: `${TODAY}T10:00:00Z`, notes: '', exercises: [] }],
    activeWorkout: { id: 'active', date: TODAY, type: 'LOWER', startedAt: `${TODAY}T11:00:00Z`, notes: '', exercises: [], timer: null, timerEndAt: null },
  }, ready: true, hasData: false, storage: 'memory' })
})
afterEach(async () => { await actions().flush(); configurePlan(DEFAULT_GOAL) })

test('maintenance onboarding preserves physical preferences and priorities through backup without creating a cut', () => {
  const preview = onboardingPreview(answers, TODAY)
  const saved = stateFromOnboarding(answers, TODAY)
  const baseline = stateFromOnboarding({ ...answers, zones: [] }, TODAY)
  const reloaded = parseBackup(JSON.stringify(makeBackup(saved, []))).state
  for (const s of [saved, reloaded]) {
    assert.equal(s.settings.maintenance, true)
    assert.equal(s.settings.goalDate, answers.goalDate)
    assert.deepEqual(s.visualGoal, { look: 'athletique', zones: ['bras', 'jambes'], bodyFat: null, ...(s === reloaded ? { photoId: undefined, cutWeeks: undefined } : {}) })
    assert.equal(goalApplied(s.visualGoal), false)
    assert.deepEqual(s.profile, { heightCm: 165, age: 31, sex: 'f' })
    assert.equal(s.bodyEntries[0].weight, 65)
    assert.equal(s.bodyEntries[0].waist, 75)
    assert.equal(s.nutritionTargets.calories, preview.calories)
    assert.equal(s.goals.targetWeightMin, baseline.goals.targetWeightMin)
    assert.equal(s.goals.targetWeightMax, baseline.goals.targetWeightMax)
  }
  assert.deepEqual(saved.templates, tagPriorities(baseline.templates, ['bras', 'jambes']))
  assert.deepEqual(onboardingSession(answers, TODAY).exercises, saved.templates[saved.nextWorkoutType].exercises)
  assert.equal(preview.plan, null)
})

test('maintenance preferences save independently of the dated plan and remain available after switching modes', () => {
  const before = state()
  assert.equal(actions().saveVisualPreferences({ ...preferences, zones: [...preferences.zones] }), true)
  assert.deepEqual(state().profile, { heightCm: 170, age: 31, sex: 'f' })
  assert.deepEqual(state().visualGoal, { look: 'sec', zones: ['dos', 'bras'], bodyFat: 22, photoId: 'goal-reference' })
  assert.equal(goalApplied(state().visualGoal), false)
  assert.deepEqual(state().templates, tagPriorities(before.templates, ['dos', 'bras']))
  for (const key of ['settings', 'goals', 'nutritionTargets', 'bodyEntries', 'workouts', 'activeWorkout', 'schedule', 'nextWorkoutType', 'appliedPlanUpdates'] as const) {
    assert.equal(state()[key], before[key], `${key} remains untouched`)
  }
  const reloaded = parseBackup(JSON.stringify(makeBackup(state(), []))).state
  assert.equal(reloaded.settings.maintenance, true)
  assert.deepEqual(reloaded.visualGoal?.zones, ['dos', 'bras'])
  assert.equal(reloaded.visualGoal?.look, 'sec')
  assert.equal(reloaded.visualGoal?.bodyFat, 22)
  assert.equal(goalApplied(reloaded.visualGoal), false)
  assert.deepEqual(reloaded.profile, state().profile)
  assert.deepEqual(reloaded.goals, before.goals)
  useStore.setState({ state: reloaded })
  actions().setGoalDate('2027-08-31')
  assert.equal(state().settings.maintenance, undefined)
  assert.deepEqual(state().visualGoal, reloaded.visualGoal, 'switching to a dated goal offers the saved preferences again')
  assert.deepEqual(state().profile, reloaded.profile)
})

test('invalid maintenance criteria are rejected without losing previously saved values', () => {
  const valid = { ...preferences, zones: [...preferences.zones] }
  for (const patch of [
    { heightCm: NaN }, { heightCm: 119 }, { heightCm: 231 }, { bodyFat: NaN }, { bodyFat: 3 }, { bodyFat: 51 },
    { look: 'unknown' }, { sex: 'unknown' }, { zones: ['cou'] }, { zones: ['bras', 'dos', 'jambes', 'abdos'] }, { zones: null },
  ]) {
    const before = state()
    assert.equal(actions().saveVisualPreferences({ ...valid, ...patch } as never), false)
    assert.equal(state(), before)
  }
  assert.equal(actions().saveVisualPreferences({ ...valid, heightCm: 0, bodyFat: null, zones: ['bras', 'bras'] }), true)
  assert.equal(state().profile.heightCm, 0, 'unknown height does not block choosing priorities')
  assert.deepEqual(state().visualGoal?.zones, ['bras'])
  useStore.setState({ state: { ...state(), settings: { ...state().settings, maintenance: false } } })
  const before = state()
  assert.equal(actions().saveVisualPreferences(valid), false, 'a stale maintenance action cannot replace an active dated plan')
  assert.equal(state(), before)
})

test('clearing maintenance preferences preserves manual physical targets, calories and reference photo', () => {
  const before = state()
  actions().clearVisualGoal()
  assert.equal(state().settings, before.settings)
  assert.equal(state().goals, before.goals)
  assert.equal(state().nutritionTargets, before.nutritionTargets)
  assert.equal(state().workouts, before.workouts)
  assert.equal(state().activeWorkout, before.activeWorkout)
  assert.equal(state().visualGoal?.photoId, 'goal-reference')
  assert.equal(state().visualGoal?.look, 'taille', 'keeping a photo must not keep the removed physique choice')
  assert.deepEqual(state().visualGoal?.zones, [])
  assert.equal(state().visualGoal?.bodyFat, null)
  assert.deepEqual(state().templates, tagPriorities(before.templates, []))
})
