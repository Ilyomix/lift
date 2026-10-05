import { cutLossPct, KCAL_PER_KG, CUT_MAX_DEFICIT } from './energy'
import { L, locale } from './i18n'
import { addDays, dayNumber, diffDays, mondayOf, todayISO } from './date'
import { contextAt, GOAL_DATE, PERIODS, PHASES, PROGRAM_START, type Period, type PlannedSession } from './program'
import type { AppState, BodyEntry, ISODate, NutritionTargets, Workout, WorkoutType } from './types'

export interface Point {
  date: ISODate
  value: number
}

export function measureSeries(entries: BodyEntry[], key: 'weight' | 'waist' | 'arm' | 'chest' | 'shoulders'): Point[] {
  return entries
    .filter((e) => typeof e[key] === 'number' && Number.isFinite(e[key]) && (e[key] as number) > 0)
    .map((e) => ({ date: e.date, value: e[key] as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** 7-day moving average: mean of the weigh-ins within the 7 days ending on each weigh-in date. */
export function movingAverage7(points: Point[]): Point[] {
  return points.map((p) => {
    const from = addDays(p.date, -6)
    const win = points.filter((q) => q.date >= from && q.date <= p.date)
    return { date: p.date, value: win.reduce((a, q) => a + q.value, 0) / win.length }
  })
}

/** Days after which the last weigh-in no longer describes the current trend. */
export const STALE_WEIGH_IN_DAYS = 7
/** The weight trend is read on the 7-day average over this many days. */
export const TREND_DAYS = 21

export interface WeightStatus {
  current: number | null
  currentDate: ISODate | null
  isAverage: boolean
  start: number | null
  startDate: ISODate | null
  /** kg per week over the last 3 weeks of the 7-day average, when enough data and the weigh-ins are recent */
  weeklyChange: number | null
  weeklyChangePct: number | null
  daysSinceLast: number | null
  /** The last weigh-in is more than a week old: the weight shown is an old one, and there is no trend to act on. */
  stale: boolean
  /** Weigh-ins of the three weeks the trend is read on, and the fewest any one of the three weeks ending today holds. */
  trendWeighIns: number
  trendWeeks: number
}

export function weightStatus(state: AppState, today: ISODate = todayISO()): WeightStatus {
  const daily = new Map<string, number[]>()
  for (const p of measureSeries(state.bodyEntries, 'weight')) {
    if (p.date > today) continue
    daily.set(p.date, [...(daily.get(p.date) ?? []), p.value])
  }
  const pts = [...daily].map(([date, values]) => ({ date, value: values.reduce((a, b) => a + b, 0) / values.length }))
  if (!pts.length) {
    return { current: null, currentDate: null, isAverage: false, start: null, startDate: null, weeklyChange: null, weeklyChangePct: null, daysSinceLast: null, stale: false, trendWeighIns: 0, trendWeeks: 0 }
  }
  const ma = movingAverage7(pts)
  const last = pts[pts.length - 1]
  const recent = pts.filter((p) => p.date >= addDays(last.date, -6)).length
  const current = recent >= 3 ? ma[ma.length - 1].value : last.value
  const daysSinceLast = diffDays(last.date, today)
  const stale = daysSinceLast > STALE_WEIGH_IN_DAYS
  const window = ma.filter((p) => p.date >= addDays(last.date, -TREND_DAYS))
  let weeklyChange: number | null = null
  // The trend is the one of the three weeks before the last weigh-in: once that is old, it is no longer today's.
  if (!stale && window.length >= 6 && diffDays(window[0].date, window[window.length - 1].date) >= 14) {
    const slope = regressionSlope(window.map((p) => ({ x: dayNumber(p.date), y: p.value })))
    weeklyChange = slope * 7
  }
  return {
    current,
    currentDate: last.date,
    isAverage: recent >= 3,
    start: pts[0].value,
    startDate: pts[0].date,
    weeklyChange,
    weeklyChangePct: weeklyChange !== null && current ? (weeklyChange / current) * 100 : null,
    daysSinceLast,
    stale,
    trendWeighIns: window.length,
    trendWeeks: Math.min(...[0, 1, 2].map((k) => pts.filter((p) => p.date <= today && Math.floor(diffDays(p.date, today) / 7) === k).length)),
  }
}

export function regressionSlope(pts: { x: number; y: number }[]): number {
  const n = pts.length
  if (n < 2) return 0
  const mx = pts.reduce((a, p) => a + p.x, 0) / n
  const my = pts.reduce((a, p) => a + p.y, 0) / n
  let num = 0
  let den = 0
  for (const p of pts) {
    num += (p.x - mx) * (p.y - my)
    den += (p.x - mx) ** 2
  }
  return den === 0 ? 0 : num / den
}

/** The bound of a phase's weekly-rate range closest to zero: the least aggressive plan. */
function conservativeRate(rate: [number, number] | null | undefined): number {
  if (!rate) return 0
  if (rate[0] <= 0 && rate[1] >= 0) return 0
  return Math.abs(rate[0]) < Math.abs(rate[1]) ? rate[0] : rate[1]
}

/** The most negative bound: the fastest loss the phase allows. */
function fastRate(rate: [number, number] | null | undefined): number {
  if (!rate) return 0
  return Math.min(rate[0], rate[1])
}

/**
 * Planned body-weight path from a starting weight: each phase at the least
 * aggressive end of its recommended weekly rate, compounded until the goal date.
 * A draft plan (another goal date) can be passed to preview it.
 */
export function plannedWeightPath(startDate: ISODate, startWeight: number, plan?: { periods: Period[]; goal: ISODate; minimumWeight?: number }, pace: 'prudent' | 'fast' = 'prudent'): Point[] {
  const goal = plan?.goal ?? GOAL_DATE
  const phaseAt = (d: ISODate) => {
    if (!plan) return contextAt(d).phase
    const p = plan.periods.find((x) => d >= x.start && d <= x.end)
    return p ? PHASES[p.phase] : null
  }
  const out: Point[] = [{ date: startDate, value: startWeight }]
  let w = startWeight
  // Resolve each date's phase: weekly sampling used to apply a cut across a diet break.
  for (let d = startDate, days = 0; d < goal && days < 2000; days++) {
    const next = addDays(d, 1)
    const phase = phaseAt(d)
    let rate = pace === 'fast' ? fastRate(phase?.weeklyRate) : conservativeRate(phase?.weeklyRate)
    if ((phase?.id === 'cut' || phase?.id === 'cut-end') && rate < 0) rate = -cutLossPct(w, -rate)
    const floor = Math.min(startWeight, plan?.minimumWeight ?? 0)
    w = Math.max(floor, w * (1 + rate / 700))
    if ((days + 1) % 7 === 0 || next === goal) out.push({ date: next, value: w })
    d = next
  }
  return out
}

/** Goal band: user-defined, or ±1 kg around the end of the planned path. */
export function goalWeightRange(state: AppState, today: ISODate = todayISO()): { min: number; max: number; computed: boolean; end: number | null } | null {
  const ws = weightStatus(state, today)
  const start = today < PROGRAM_START ? PROGRAM_START : today
  const end = ws.current ? plannedWeightPath(start, ws.current).at(-1)!.value : null
  if (state.goals.targetWeightMin > 0 && state.goals.targetWeightMax > 0) {
    return { min: state.goals.targetWeightMin, max: state.goals.targetWeightMax, computed: false, end }
  }
  if (end === null) return null
  return { min: Math.round(end - 1), max: Math.round(end + 1), computed: true, end }
}

export function phaseRateLabel(date: ISODate): string {
  const ctx = contextAt(date)
  const rate = ctx.phase?.weeklyRate
  if (!rate) return ''
  const f = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString(locale())}`
  return rate[0] === rate[1]
    ? L(`${f(rate[0])} %/sem`, `${f(rate[0])}%/wk`)
    : L(`${f(rate[0])} à ${f(rate[1])} %/sem`, `${f(rate[0])} to ${f(rate[1])}%/wk`)
}

export interface DayStatus {
  date: ISODate
  done: Workout[]
  planned: WorkoutType | null
  isToday: boolean
  paused: boolean
}

export function weekStrip(state: AppState, planned: PlannedSession[], paused: Set<ISODate>, today: ISODate = todayISO()): DayStatus[] {
  const monday = mondayOf(today)
  const byDate = new Map(planned.map((p) => [p.date, p.type]))
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    return {
      date,
      done: state.workouts.filter((w) => w.date === date),
      planned: byDate.get(date) ?? null,
      isToday: date === today,
      paused: paused.has(date),
    }
  })
}

export function sessionsThisWeek(workouts: Workout[], today: ISODate = todayISO()): number {
  const monday = mondayOf(today)
  const end = addDays(monday, 6)
  return workouts.filter((w) => w.date >= monday && w.date <= end).length
}

/** Average sessions per week over the last 4 weeks (only weeks that already started). */
export function recentPace(workouts: Workout[], today: ISODate = todayISO()): number {
  const from = addDays(mondayOf(today), -21)
  const n = workouts.filter((w) => w.date >= from && w.date <= today).length
  const weeks = Math.max(1, (diffDays(from, today) + 1) / 7)
  return n / weeks
}

export function nutritionFor(state: AppState, date: ISODate) {
  return state.nutritionEntries[date] ?? { date, calories: 0, protein: 0, creatine: 0 }
}

const CUT_PHASES = new Set(['cut', 'cut-end', 'diet-break'])

/** Protein per kg implied by the report's ranges at its reference weight (93 kg): 180–190 g, then 185–200 g in the cut. */
const PROTEIN_PER_KG = { base: [180 / 93, 190 / 93], cut: [185 / 93, 200 / 93] } as const

const round5 = (x: number) => Math.round(x / 5) * 5

/** 7-day average weight around a date (the weigh-ins of the 7 days ending that day, else the closest before). */
export function weightAt(state: Pick<AppState, 'bodyEntries'>, date: ISODate): number | null {
  const pts = measureSeries(state.bodyEntries, 'weight').filter((p) => p.date <= date)
  if (!pts.length) return null
  const win = pts.filter((p) => p.date >= addDays(date, -6))
  const use = win.length ? win : pts.slice(-1)
  return use.reduce((a, p) => a + p.value, 0) / use.length
}

export interface ProteinTarget {
  min: number
  max: number
  /** Weight the range was computed from (7-day average), when it follows the weight. */
  weight: number | null
  perKg: [number, number] | null
}

/**
 * Protein range of the day. Adaptive (default): ≈ 2 g/kg of the 7-day average weight,
 * with the report's ratios (Morton 2018: gains plateau near 1.6 g/kg, 2.2 upper bound;
 * Helms 2014: keep it high in a deficit). During the cut it never drops below its level
 * at the start of the cut. Without weigh-ins, or when turned off: the fixed targets.
 */
export function proteinTargetFor(state: AppState, date: ISODate): ProteinTarget {
  const ctx = contextAt(date)
  const cut = !!ctx.phase && CUT_PHASES.has(ctx.phase.id)
  const fixed = (): ProteinTarget =>
    cut && ctx.phase
      ? { min: Math.max(state.nutritionTargets.proteinMin, ctx.phase.proteinMin), max: Math.max(state.nutritionTargets.proteinMax, ctx.phase.proteinMax), weight: null, perKg: null }
      : { min: state.nutritionTargets.proteinMin, max: state.nutritionTargets.proteinMax, weight: null, perKg: null }
  if (state.nutritionTargets.adaptive === false) return fixed()
  const w = weightAt(state, date)
  if (!w) return fixed()
  const [a, b] = cut ? PROTEIN_PER_KG.cut : PROTEIN_PER_KG.base
  let min = round5(a * w)
  let max = round5(b * w)
  if (cut) {
    const start = PERIODS.find((p) => CUT_PHASES.has(p.phase))?.start
    const w0 = start ? weightAt(state, start) : null
    if (w0) {
      min = Math.max(min, round5(a * w0))
      max = Math.max(max, round5(b * w0))
    }
  }
  return { min, max, weight: w, perKg: [a, b] }
}

export interface CalorieAdvice {
  /**
   * `hold`: the weight asks for fewer calories, and the target is already at the floor.
   * `ask`: the sized step of a cut, which depends on an answer (`first`, `otherwise`): nothing is advised before it.
   */
  status: 'ok' | 'lower' | 'raise' | 'wait' | 'hold' | 'ask'
  /** kcal to add (negative: remove). */
  delta: number
  target: number
  headline: string
  detail: string
  /** Weekly change of the 7-day average, in % of body weight. */
  ratePct: number | null
  waist: 'down' | 'up' | 'flat' | null
  /** Lowest target the advice goes to (calorieFloor). */
  floor: number
  /** What sets that floor: the energy spent at rest, or the minimum advised without medical supervision. */
  floorIs: 'rest' | 'minimum'
  /**
   * With `ask`: the sized step of the cut, the plan's deficit taken at once. It is read on the
   * trend, which only describes today if the last three weeks were eaten and moved through as
   * today is: the screen asks, offers this step on a yes and the regular one (`otherwise`) on a no.
   */
  first?: { question: string; hint: string; delta: number; target: number; detail: string }
  otherwise?: { delta: number; target: number; detail: string }
}

/** Energy spent at rest (Mifflin–St Jeor 1990) from weight, height, age and sex: within about 10 % for most people. */
export function restingCalories(a: { weight: number; heightCm: number; age: number; sex: 'm' | 'f' }): number {
  return 10 * a.weight + 6.25 * a.heightCm - 5 * (a.age || 30) + (a.sex === 'm' ? 5 : -161)
}

/** Calories under which eating less is a matter for a health professional: general guidance for adults (Harvard Health Publishing, 2024). */
const MIN_CALORIES = { m: 1500, f: 1200 } as const

/**
 * Lowest calorie target the app advises: the energy spent at rest, estimated from the profile and
 * the weight of the week (rounded up to 50 kcal), and never under the minimum advised without
 * medical supervision. A guard, not a finding. The advice follows the scale; when the scale stops
 * answering, the cause is rarely a target still too high (portions, weekends, water), and each
 * step down would lead to a target nobody should eat at. Without a height, the minimum alone.
 */
export function calorieFloor(state: Pick<AppState, 'bodyEntries' | 'profile'>, today: ISODate = todayISO()): { kcal: number; from: 'rest' | 'minimum' } {
  const sex = state.profile.sex ?? 'm'
  const weight = weightAt(state, today)
  const rest = weight && state.profile.heightCm ? Math.ceil(restingCalories({ weight, heightCm: state.profile.heightCm, age: state.profile.age, sex }) / 50) * 50 : 0
  return rest >= MIN_CALORIES[sex] ? { kcal: rest, from: 'rest' } : { kcal: MIN_CALORIES[sex], from: 'minimum' }
}

/**
 * The stretch of cut a date is in: its first day (after the recomposition, the holidays or a diet
 * break), whether the cut had begun before it, so that it resumes there, and the day the cut began.
 * Null outside a cut.
 */
function cutStretchAt(date: ISODate): { start: ISODate; resumed: boolean; began: ISODate } | null {
  const cutting = (p: Period) => p.phase === 'cut' || p.phase === 'cut-end'
  const i = PERIODS.findIndex((p) => date >= p.start && date <= p.end)
  if (i < 0 || !cutting(PERIODS[i])) return null
  let first = i
  while (first > 0 && cutting(PERIODS[first - 1])) first--
  const began = PERIODS.slice(0, first).find(cutting)?.start
  return { start: PERIODS[first].start, resumed: !!began, began: began ?? PERIODS[first].start }
}

/** A loss the report still tolerates in a cut, in % of body weight per week: beyond it, muscle is at risk. */
const CUT_MAX_RATE = 1
/** A target given as one figure (« ≈ −0.5 %/week ») is read with this much on each side. */
const RATE_SLACK = 0.1
/** Calories move by this much at a time. */
const KCAL_STEP = 150
/**
 * Energy of a kilogram of body weight lost, by the usual rule of thumb (3,500 kcal per pound). A
 * starting point: under about 30 kg of body fat the same deficit takes off more weight (Hall
 * 2008), and the verdicts that follow are read on the scale, not on this figure.
 */
// Shared with the goal projection (energy.ts).
/** The deficit the report allows a cut, in kcal a day: about 500 already wipes out lean mass gains (Murphy 2022). */
// Shared with the goal projection (energy.ts).
/**
 * Weigh-ins the three-week trend needs for a step to be sized on it: one every three days, and
 * at least two in each of the three weeks (eight in a row three weeks ago say nothing of now).
 * The sparser the weigh-ins, the coarser the measure of the current balance: simulated with a
 * scale noise of 0.3 to 0.5 kg that does not last from one day to the next, it is off by 65 to
 * 110 kcal a day (one standard deviation) when weighed daily, 105 to 175 every three days.
 */
const SIZED_WEIGH_INS = 8
const SIZED_WEEKLY = 2
/**
 * A step is sized on a slow reading only if the reading of two weeks before was slow too: one
 * low reading can come from the scale (water that comes and goes over a month, a few heavy days).
 */
const SIZED_CONFIRM_DAYS = 14
/** Days after a sized step during which a pace above the range gives part of it back: three readings of the three-week trend. */
const SIZED_CHECK_DAYS = 63

/** kcal a day behind a weekly change of `pct` % of body weight. */
const kcalPerDay = (pct: number, weight: number) => ((pct / 100) * weight * KCAL_PER_KG) / 7

/**
 * Share of a new pace the trend shows two weeks after it changed (measured on weightStatus with
 * daily weigh-ins: 54 to 60 % on days 14 and 15, 96 % on day 22). Until the trend lies inside the
 * cut and after the last change of calories, a loss is only called too slow under that share of
 * the limit: in the cut, −0.3 %/week instead of −0.5.
 */
const MIXED_TREND_SHARE = 0.6

function waistTrend(state: AppState, today: ISODate): 'down' | 'up' | 'flat' | null {
  const pts = measureSeries(state.bodyEntries, 'waist').filter((p) => p.date >= addDays(today, -35) && p.date <= today)
  if (pts.length < 2 || diffDays(pts[0].date, pts[pts.length - 1].date) < 14) return null
  const d = pts[pts.length - 1].value - pts[0].value
  return d <= -1 ? 'down' : d >= 1 ? 'up' : 'flat'
}

/**
 * Calorie target from the trend of the 7-day average weight against the phase's
 * planned rate (±150 kcal steps, then two weeks for the weight to answer). In the
 * recomposition the waist is a second signal: stable weight with a shrinking waist
 * means it works. Body weight never moves training loads.
 * In a cut the loss has to stay inside the phase's range: slower than its bottom
 * (−0.5 %/week) asks for fewer calories, since the length of the cut was sized on the
 * middle of the range. That verdict needs a trend measured inside the cut and after the
 * last change of calories: for the three weeks the trend still holds older days, only a
 * clearly slow pace is acted on, and the rest waits. One step a cut is not 150 kcal but
 * the plan's deficit taken at once (the middle of the range at 7,700 kcal per kg, 500 kcal
 * a day at most, less what the trend shows): the plan counts on its pace from the first
 * day. It needs a trend that can size it (weighed often enough, slow two weeks ago already,
 * clean of the last calorie change) and three normal weeks, which the screen asks about
 * (status `ask`); 150 kcal of it go back when the pace then shows it overshot.
 * The advice needs weigh-ins of the last week, and never goes under the floor
 * (calorieFloor): there it says so, and points at what else can move.
 */
export function calorieAdvice(state: AppState, today: ISODate = todayISO()): CalorieAdvice {
  const target = state.nutritionTargets.calories
  const ctx = contextAt(today)
  const phase = ctx.phase?.id ?? 'recomp'
  const ws = weightStatus(state, today)
  const rate = ws.weeklyChangePct
  const waist = waistTrend(state, today)
  const { kcal: floor, from: floorIs } = calorieFloor(state, today)
  const base = { target, ratePct: rate, waist, floor, floorIs }
  const changed = state.nutritionTargets.caloriesChangedAt
  if (ws.stale) {
    return {
      ...base, status: 'wait', delta: 0, headline: L('Pesées trop anciennes', 'Weigh-ins too old'),
      detail: L(
        `Dernière pesée il y a ${ws.daysSinceLast} jours : la tendance ne reflète plus ta situation actuelle. Pèse-toi quelques matins de suite pour relancer le conseil.`,
        `Last weigh-in ${ws.daysSinceLast} days ago: the trend no longer reflects your current weight. Weigh in a few mornings in a row to get advice again.`,
      ),
    }
  }
  if (rate === null) {
    return {
      ...base, status: 'wait', delta: 0, headline: L('Pas encore assez de pesées', 'Not enough weigh-ins yet'),
      detail: L('Pèse-toi chaque matin, à jeun : il faut environ 2 semaines de moyenne pour ajuster les calories.', 'Weigh yourself every morning on an empty stomach: it takes about 2 weeks of averages to adjust calories.'),
    }
  }
  if (changed && diffDays(changed, today) < 14) {
    const days = diffDays(changed, today)
    return {
      ...base, status: 'wait', delta: 0, headline: L('Ajustement récent', 'Recent adjustment'),
      detail: L(
        `Cible de calories modifiée ${days === 0 ? 'aujourd’hui' : `il y a ${days} jours`} : on laisse 2 semaines au poids pour réagir.`,
        `Calorie target changed ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}: give your weight 2 weeks to respond.`,
      ),
    }
  }
  const pct = (x: number) => {
    const v = `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString(locale(), { maximumFractionDigits: 2 })}`
    return L(`${v} %/sem`, `${v}%/wk`)
  }
  const make = (delta: number, headline: string, detail: string): CalorieAdvice => ({ ...base, status: delta < 0 ? 'lower' : delta > 0 ? 'raise' : 'ok', delta, target: target + delta, headline, detail })
  const floorText = floorIs === 'rest' ? L('ta dépense au repos estimée', 'your estimated energy at rest') : L('le minimum conseillé sans suivi médical', 'the minimum advised without medical supervision')
  // Fewer calories, as far as the floor allows: a full step, what is left above it, or nothing.
  const lower = (headline: string, why: string, how: (kcal: number) => string): CalorieAdvice => {
    const cutting = phase === 'cut' || phase === 'cut-end'
    const deficitRoom = cutting && ws.current ? Math.max(0, CUT_MAX_DEFICIT - kcalPerDay(Math.max(0, -rate), ws.current)) : Infinity
    const room = Math.max(0, Math.min(KCAL_STEP, Math.floor((target - floor) / 50) * 50, Math.floor(deficitRoom / 50) * 50))
    if (cutting && deficitRoom < KCAL_STEP && room < 50 && target > floor) return {
      ...base, status: 'hold', delta: 0, headline: L('Déficit estimé déjà suffisant', 'Estimated deficit already sufficient'),
      detail: L('La tendance suggère un déficit proche du plafond de planification. Ne réduis pas davantage : réévalue la durée et les mesures, pas seulement les calories.', 'The trend suggests a deficit near the planning limit. Do not reduce further: reassess timing and measurements, not just calories.'),
    }
    if (room >= 50) {
      const stop = room < KCAL_STEP && target - room <= floor ? L(` Pas plus bas : ${floor} kcal, c’est ${floorText}.`, ` No lower: ${floor} kcal is ${floorText}.`) : room < KCAL_STEP ? L(' Ajustement limité par le budget de déficit estimé.', ' Adjustment capped by the estimated deficit budget.') : ''
      return make(-room, headline, `${why}${L(' : ', ': ')}${how(room)}${stop}`)
    }
    return {
      ...base, status: 'hold', delta: 0, headline: L(`${headline}, calories au plancher`, `${headline}, calories at the floor`),
      detail: L(
        `${why}. Ta cible ne dépasse pas ${floorText} (${floor} kcal) : le conseil ne descend pas plus bas. Vérifie les mesures et la récupération ; demande un avis professionnel avant d’accentuer le déficit.`,
        `${why}. Your target is no higher than ${floorText} (${floor} kcal): the advice goes no lower. Check measurements and recovery; seek professional advice before increasing the deficit.`,
      ),
    }
  }
  if (phase === 'cut' || phase === 'cut-end') {
    // The phase's range, as a loss: 0.5 to 0.7 in the cut, about 0.5 at its end.
    const [a, b] = ctx.phase?.weeklyRate ?? [-0.7, -0.5]
    const single = a === b
    const slow = cutLossPct(ws.current ?? 0, Math.min(-a, -b) - (single ? RATE_SLACK : 0))
    const brisk = Math.max(-a, -b) + (single ? RATE_SLACK : 0)
    const capped = slow < Math.min(-a, -b) - (single ? RATE_SLACK : 0) - 1e-9
    const aim = capped ? L(`objectif ajusté au budget : environ ${pct(-slow)}`, `budget-adjusted target: about ${pct(-slow)}`) : single ? L(`objectif : environ ${pct(a)}`, `target: about ${pct(a)}`) : L('objectif : −0,5 à −0,7 %/sem', 'target: −0.5 to −0.7%/wk')
    // Judged as it is shown: to the hundredth.
    const loss = Math.round(-rate * 100) / 100
    // The trend still holds days from before the cut, or from before the last change of calories.
    const stretch = cutStretchAt(today)
    const sinceCut = diffDays(stretch?.start ?? addDays(today, -TREND_DAYS), today)
    const sinceChange = changed ? diffDays(changed, today) : TREND_DAYS
    const mixed = Math.min(sinceCut, sinceChange) < TREND_DAYS
    const less = (kcal: number) => L(
      `−${kcal} kcal (glucides ou lipides, jamais les protéines) ou ~2 000 pas de plus par jour.`,
      `−${kcal} kcal (carbs or fat, never protein) or ~2,000 more steps a day.`,
    )
    // A trend that still holds days from before the cut or the last change: the verdict waits for it.
    const pending = (days: number, before: string, beforeEn: string): CalorieAdvice => ({
      ...base, status: 'wait', delta: 0, headline: L('Rythme à confirmer', 'Pace to be confirmed'),
      detail: L(
        `${pct(rate)} (${aim}), mais la tendance sur 3 semaines compte encore des jours d’avant ${before} : nouveau point dans ${days} jour${days > 1 ? 's' : ''}.`,
        `${pct(rate)} (${aim}), but the 3-week trend still counts days from before ${beforeEn}: next check-in in ${days} day${days > 1 ? 's' : ''}.`,
      ),
    })
    // The sized step of this cut, once taken.
    const sized = state.nutritionTargets.sizedStep
    const taken = sized && stretch && sized.at >= stretch.began && sized.at <= today ? sized : null
    if (loss < (mixed ? slow * MIXED_TREND_SHARE : slow)) {
      // In the first weeks of the cut, or of its return after a diet break, the trend still shows what came before: the first step of the deficit.
      const starting = sinceCut < TREND_DAYS && sinceCut <= sinceChange
      const headline = !starting ? L('Perte trop lente', 'Loss too slow') : stretch?.resumed ? L('Reprise de la sèche', 'Back in the cut') : L('Début de sèche', 'Start of the cut')
      const why = starting ? L(`${pct(rate)} sur les 3 dernières semaines (${aim})`, `${pct(rate)} over the last 3 weeks (${aim})`) : `${pct(rate)} (${aim})`
      const regular = lower(headline, why, less)
      // The sized step is still in the trend, with the weeks before it: nothing is added to it until the trend is clean.
      if (taken && changed === taken.at && sinceChange < TREND_DAYS) return pending(TREND_DAYS - sinceChange, 'ton dernier changement de calories', 'your last change of calories')
      // The plan counts on its pace from the first day, and 150 kcal at a time takes weeks to get there.
      // One step a cut is the plan's whole deficit, when the trend can size it: weighed often enough, slow
      // two weeks ago already, and not in the three weeks after a diet break (a week eaten at maintenance,
      // which no date records). What else changed in those weeks is not known here: the step comes with a question.
      const weight = ws.current
      const slowBefore = () => {
        const then = addDays(today, -SIZED_CONFIRM_DAYS)
        const before = weightStatus({ ...state, bodyEntries: state.bodyEntries.filter((e) => e.date <= then) }, then).weeklyChangePct
        return before !== null && Math.round(-before * 100) / 100 < slow
      }
      if (stretch && !taken && !(starting && stretch.resumed) && weight && ws.trendWeighIns >= SIZED_WEIGH_INS && ws.trendWeeks >= SIZED_WEEKLY && slowBefore()) {
        const round50 = (x: number) => Math.round(x / 50) * 50
        // The middle of the range, as far as the report's ceiling allows; less what the trend already shows.
        const planned = Math.min(CUT_MAX_DEFICIT, round50(kcalPerDay((-a - b) / 2, weight)))
        const shown = Math.max(0, round50(kcalPerDay(loss, weight)))
        const room = Math.max(0, Math.floor((target - floor) / 50) * 50)
        const step = Math.min(planned - shown, room)
        if (step > KCAL_STEP) {
          // A calorie change in the last three weeks: the trend will be clean of it within a week, and the step is worth the wait.
          if (sinceChange < TREND_DAYS) return pending(TREND_DAYS - sinceChange, 'ton dernier changement de calories', 'your last change of calories')
          const stop = step < planned - shown ? L(` Pas plus bas : ${floor} kcal, c’est ${floorText}.`, ` No lower: ${floor} kcal is ${floorText}.`) : ''
          return {
            ...base, status: 'ask', delta: 0, headline, detail: `${why}.`,
            first: {
              question: L('Tes 3 dernières semaines ont-elles été normales ?', 'Were your last 3 weeks typical for you?'),
              hint: L('Normales : tu as mangé et bougé comme aujourd’hui. Ni fêtes, ni vacances, ni régime déjà commencé.', 'Normal: you ate and moved the way you do today. No holidays, no time off, no diet already started.'),
              delta: -step,
              target: target - step,
              detail: L(
                `L’ajustement complet vise un déficit d’environ ${planned} kcal par jour${shown ? ` ; ta tendance en montre déjà environ ${shown}` : ''}. Soit −${step} kcal en une fois (glucides ou lipides, jamais les protéines), puis 2 semaines pour que le poids réagisse.${stop}`,
                `The full adjustment aims at a deficit of about ${planned} kcal a day${shown ? `; your trend already shows about ${shown}` : ''}. That is −${step} kcal at once (carbs or fat, never protein), then 2 weeks for your weight to respond.${stop}`,
              ),
            },
            otherwise: {
              delta: regular.delta,
              target: regular.target,
              detail: L(
                `Ta tendance ne décrit donc pas ta situation d’aujourd’hui. Pour l’instant, un ajustement habituel : ${less(-regular.delta)} L’ajustement complet viendra après 3 semaines normales.`,
                `So your trend does not describe where you are today. For now, a regular adjustment: ${less(-regular.delta)} The full adjustment will come after 3 normal weeks.`,
              ),
            },
          }
        }
      }
      return regular
    }
    if (loss > CUT_MAX_RATE) return make(KCAL_STEP, L('Perte trop rapide', 'Loss too fast'), L(`${pct(rate)} : au-delà de −1 %/sem le muscle est menacé. +150 kcal.`, `${pct(rate)}: beyond −1%/wk, muscle is at risk. +150 kcal.`))
    if (mixed && loss < slow) {
      return sinceCut <= sinceChange
        ? pending(TREND_DAYS - sinceCut, stretch?.resumed ? 'la reprise de la sèche' : 'la sèche', stretch?.resumed ? 'the cut resumed' : 'the cut')
        : pending(TREND_DAYS - sinceChange, 'ton dernier changement de calories', 'your last change of calories')
    }
    // The sized step was read on a trend, which can under-read, and on an answer, which can be wrong. In the
    // nine weeks that follow, each time the trend is clean of the last change and above the range, 150 kcal
    // of the step go back (elsewhere a pace between the top of the range and 1 %/week is left alone).
    if (taken && target >= taken.to && target < taken.from && !mixed && diffDays(taken.at, today) <= SIZED_CHECK_DAYS && loss > brisk) {
      const back = Math.min(KCAL_STEP, taken.from - target)
      return make(back, L('Ajustement trop important', 'Adjustment too large'), L(`${pct(rate)} (${aim}) : au-dessus de la fourchette depuis ton ajustement complet. +${back} kcal.`, `${pct(rate)} (${aim}): above the range since your full adjustment. +${back} kcal.`))
    }
    if (loss > brisk) return make(0, L('Rythme soutenu', 'Brisk pace'), L(`${pct(rate)} (${aim}) : tolérable jusqu’à −1 %/sem, ne baisse pas davantage les calories.`, `${pct(rate)} (${aim}): tolerable up to −1%/wk, do not lower calories any further.`))
    return make(0, L('Rythme dans la cible', 'Pace on target'), L(`${pct(rate)} (${aim}) : ne change rien.`, `${pct(rate)} (${aim}): change nothing.`))
  }
  if (phase === 'recomp' || phase === 'foundation') {
    if (rate > 0.15) return lower(L('Poids en hausse', 'Weight going up'), L(`${pct(rate)} alors que la recomposition vise un poids stable`, `${pct(rate)} while the recomposition aims for a stable weight`), (kcal) => L(`−${kcal} kcal.`, `−${kcal} kcal.`))
    if (rate < -0.5) return make(KCAL_STEP, L('Perte trop rapide pour une recomposition', 'Loss too fast for a recomposition'), L(`${pct(rate)} : +150 kcal pour garder l’énergie à l’entraînement.`, `${pct(rate)}: +150 kcal to keep your energy up for training.`))
    if (waist === 'up') return lower(L('Tour de taille en hausse', 'Waist going up'), L('Poids stable, tour de taille +1 cm ou plus en un mois', 'Stable weight, waist +1 cm or more in a month'), (kcal) => L(`−${kcal} kcal.`, `−${kcal} kcal.`))
    if (waist === 'down') return make(0, L('Recomposition en marche', 'Recomposition working'), L('Poids stable et tour de taille en baisse : ne change rien.', 'Stable weight and a shrinking waist: change nothing.'))
    return make(0, L('Dans la cible', 'On target'), L(`${pct(rate)} pour un poids stable à −0,25 %/sem : ne change rien.`, `${pct(rate)} for a stable weight to −0.25%/wk: change nothing.`))
  }
  // Holidays, diet break, stabilization: hold the weight.
  if (rate > 0.3) return lower(L('Poids en hausse', 'Weight going up'), L(`${pct(rate)} pendant une phase de maintien`, `${pct(rate)} during a maintenance phase`), (kcal) => L(`−${kcal} kcal.`, `−${kcal} kcal.`))
  if (rate < -0.3) return make(KCAL_STEP, L('Poids en baisse', 'Weight going down'), L(`${pct(rate)} pendant une phase de maintien : +150 kcal.`, `${pct(rate)} during a maintenance phase: +150 kcal.`))
  return make(0, L('Poids stable', 'Stable weight'), L(`${pct(rate)} : phase de maintien respectée.`, `${pct(rate)}: maintenance phase on track.`))
}

/** What taking a step of the advice changes in the calorie targets: the sized one is kept with its day and its two ends. */
export function calorieStepPatch(targets: NutritionTargets, to: number, sized: boolean, today: ISODate = todayISO()): Partial<NutritionTargets> {
  return { calories: to, ...(sized ? { sizedStep: { at: today, from: targets.calories, to } } : {}) }
}

/** Kept for the Progress screen: the cut advice as one sentence. */
export function cutAdvice(state: AppState, today: ISODate = todayISO()): string | null {
  const ctx = contextAt(today)
  if (!ctx.phase || (ctx.phase.id !== 'cut' && ctx.phase.id !== 'cut-end')) return null
  const a = calorieAdvice(state, today)
  // The sized step of the cut is settled on the nutrition screen, after its question.
  if (a.status === 'ask') return L(`${a.headline} : ajuste tes calories dans Plus → Réglages → Cibles nutritionnelles.`, `${a.headline}: adjust your calories in More → Settings → Nutrition targets.`)
  return `${a.headline}. ${a.detail}`
}

export function nutritionDays(state: AppState, days: number, today: ISODate = todayISO()) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1)
    const e = state.nutritionEntries[date]
    return { date, calories: e?.calories ?? 0, protein: e?.protein ?? 0, creatine: e?.creatine ?? 0, logged: !!e && (e.calories > 0 || e.protein > 0 || e.creatine > 0) }
  })
}

export function currentPhaseLabel(today: ISODate = todayISO()): string {
  const ctx = contextAt(today)
  if (ctx.before) return L('Avant programme', 'Before the program')
  if (ctx.after) return L('Programme terminé', 'Program complete')
  return ctx.phase ? ctx.phase.label : ''
}

export function periodsTimeline() {
  const start = PERIODS[0].start
  const total = diffDays(start, GOAL_DATE) + 1
  return PERIODS.map((p) => ({
    ...p,
    offset: diffDays(start, p.start) / total,
    width: (diffDays(p.start, p.end) + 1) / total,
    phaseLabel: PHASES[p.phase].short,
  }))
}
