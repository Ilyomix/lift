// First run: the onboarding answers become a complete state (plan, sessions, targets).
import { defaultState } from './backup'
import { addDays, todayISO, weekday } from './date'
import { HOME_GYM } from './gyms'
import { detectLang, L } from './i18n'
import { buildMaintenancePeriods, buildResearchTemplates, maintenanceHorizon, planShape, programStartFor, scheduleFromDays, type PlanShape } from './program'
import type { AppState, ISODate, Look, TrainingSetup } from './types'
import { relativeFatMass, tagPriorities, visualPlan, type BodyFat, type VisualPlan } from './visual'

export interface OnboardingAnswers {
  lang: 'fr' | 'en'
  setup: TrainingSetup
  /** Weekdays with a session, 0 = Sunday. */
  days: number[]
  sex: 'm' | 'f'
  age: number
  heightCm: number
  weight: number
  waist: number | null
  look: Look
  /** Kept in maintenance mode: offered again if the user sets a goal later. */
  goalDate: ISODate
  /** Maintenance mode: no goal date and no look — blocks and deloads with no end, calories at maintenance. */
  maintenance?: boolean
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const round = (x: number, step: number) => Math.round(x / step) * step

/** Body fat from BMI, age and sex (Deurenberg 1991), the fallback without a waist measure: ± ~4 points. */
export function bmiBodyFat(weight: number, heightCm: number, age: number, sex: 'm' | 'f'): number {
  const bmi = weight / (heightCm / 100) ** 2
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'm' ? 1 : 0) - 5.4
}

/** Waist first (RFM, closer to DXA), BMI otherwise. */
export function onboardingBodyFat(a: Pick<OnboardingAnswers, 'weight' | 'heightCm' | 'age' | 'sex' | 'waist'>, today: ISODate = todayISO()): BodyFat | null {
  if (!a.heightCm || !a.weight) return null
  if (a.waist) return { pct: clamp(relativeFatMass(a.heightCm, a.waist, a.sex), 4, 50), source: 'tour de taille', waist: a.waist, waistDate: today }
  if (!a.age) return null
  return { pct: clamp(bmiBodyFat(a.weight, a.heightCm, a.age, a.sex), 4, 50), source: 'imc' }
}

/** Maintenance: resting expenditure (Mifflin–St Jeor 1990) × activity from the sessions per week. */
export function maintenanceCalories(a: Pick<OnboardingAnswers, 'weight' | 'heightCm' | 'age' | 'sex' | 'days'>): number {
  const bmr = 10 * a.weight + 6.25 * a.heightCm - 5 * (a.age || 30) + (a.sex === 'm' ? 5 : -161)
  const factor = a.days.length <= 3 ? 1.375 : a.days.length <= 5 ? 1.55 : 1.725
  return round(bmr * factor, 50)
}

export interface OnboardingPreview {
  start: ISODate
  bodyFat: BodyFat | null
  /** The look's plan; null in maintenance mode. */
  plan: VisualPlan | null
  /** Recomposition and cut weeks; null in maintenance mode. */
  shape: PlanShape | null
  calories: number
  firstSession: ISODate
  /** Sessions until `until`: the goal date, or the end of the first block in maintenance mode. */
  sessions: number
  until: ISODate
}

/** Sessions on the chosen days from the first one to the goal date. */
function countSessions(from: ISODate, to: ISODate, days: number[]): { first: ISODate; count: number } {
  let first = ''
  let count = 0
  for (let d = from, i = 0; d <= to && i < 2000; d = addDays(d, 1), i++) {
    if (!days.includes(weekday(d))) continue
    if (!first) first = d
    count++
  }
  return { first: first || from, count }
}

/** What the answers give: start, body fat, plan shape, target, calories, sessions. */
export function onboardingPreview(a: OnboardingAnswers, today: ISODate = todayISO()): OnboardingPreview {
  const start = programStartFor(today)
  const bodyFat = onboardingBodyFat(a, today)
  const from = today < start ? start : today
  if (a.maintenance) {
    // No cut: calories at maintenance, and the first block shows the rhythm.
    const firstBlock = buildMaintenancePeriods(start, null, maintenanceHorizon(today, start)).find((p) => p.kind === 'block')!
    const { first, count } = countSessions(from, firstBlock.end, a.days)
    return { start, bodyFat, plan: null, shape: null, calories: maintenanceCalories(a), firstSession: first, sessions: count, until: firstBlock.end }
  }
  const probe = draftState(a, today, start)
  const plan = bodyFat ? visualPlan(probe, { look: a.look, bodyFat, sex: a.sex, goal: a.goalDate, today, start }) : null
  const shape = planShape(a.goalDate, plan ? plan.cutWeeks : 23, start)
  const maintenance = maintenanceCalories(a)
  // Maintenance during a recomposition (a slight deficit), a moderate deficit when the cut starts right away.
  const calories = round(maintenance - (shape.recompWeeks === 0 && shape.cutWeeks > 0 ? 400 : 150), 50)
  const { first, count } = countSessions(from, a.goalDate, a.days)
  return { start, bodyFat, plan, shape, calories, firstSession: first, sessions: count, until: a.goalDate }
}

function draftState(a: OnboardingAnswers, today: ISODate, start: ISODate): AppState {
  const base = defaultState()
  return {
    ...base,
    templates: buildResearchTemplates(undefined, [], a.setup),
    schedule: scheduleFromDays(a.days),
    goals: { ...base.goals, sessionsPerWeek: a.days.length },
    bodyEntries: [{ id: `body-${today}`, date: today, weight: a.weight, waist: a.waist, arm: null, chest: null, shoulders: null }],
    profile: { heightCm: a.heightCm, age: a.age, sex: a.sex },
    settings: { goalDate: a.goalDate, ...(a.maintenance ? { maintenance: true } : {}), programStart: start, foundationStart: null, setup: a.setup },
    gyms: [{ id: HOME_GYM, name: a.setup.place === 'home' ? L('Maison', 'Home') : L('Ma salle', 'My gym') }],
    gymId: HOME_GYM,
    prefs: { ...base.prefs, lang: a.lang === detectLang() ? 'auto' : a.lang },
  }
}

/** The complete first state: sessions for the setup, the visual goal applied, targets from the body. */
export function stateFromOnboarding(a: OnboardingAnswers, today: ISODate = todayISO()): AppState {
  const preview = onboardingPreview(a, today)
  const s = draftState(a, today, preview.start)
  const w = a.weight
  const withTargets: AppState = {
    ...s,
    nutritionTargets: { ...s.nutritionTargets, calories: preview.calories, proteinMin: round(1.95 * w, 5), proteinMax: round(2.05 * w, 5), adaptive: true },
    meta: { ...s.meta, createdAt: new Date().toISOString() },
  }
  if (!preview.plan) return withTargets
  return {
    ...withTargets,
    visualGoal: { look: a.look, zones: [], bodyFat: null, cutWeeks: preview.plan.cutWeeks },
    goals: { ...withTargets.goals, targetWeightMin: preview.plan.target[0], targetWeightMax: preview.plan.target[1] },
    templates: tagPriorities(withTargets.templates, []),
  }
}
