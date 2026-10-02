import { L, locale } from './i18n'
import { addDays, dayNumber, diffDays, mondayOf, todayISO } from './date'
import { contextAt, GOAL_DATE, PERIODS, PHASES, PROGRAM_START, type Period, type PlannedSession } from './program'
import type { AppState, BodyEntry, ISODate, Workout, WorkoutType } from './types'

export interface Point {
  date: ISODate
  value: number
}

export function measureSeries(entries: BodyEntry[], key: 'weight' | 'waist' | 'arm' | 'chest' | 'shoulders'): Point[] {
  return entries
    .filter((e) => typeof e[key] === 'number' && (e[key] as number) > 0)
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
}

export function weightStatus(state: AppState, today: ISODate = todayISO()): WeightStatus {
  const pts = measureSeries(state.bodyEntries, 'weight')
  if (!pts.length) {
    return { current: null, currentDate: null, isAverage: false, start: null, startDate: null, weeklyChange: null, weeklyChangePct: null, daysSinceLast: null, stale: false }
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
  if (!stale && window.length >= 3 && diffDays(window[0].date, window[window.length - 1].date) >= 7) {
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
export function plannedWeightPath(startDate: ISODate, startWeight: number, plan?: { periods: Period[]; goal: ISODate }, pace: 'prudent' | 'fast' = 'prudent'): Point[] {
  const goal = plan?.goal ?? GOAL_DATE
  const phaseAt = (d: ISODate) => {
    if (!plan) return contextAt(d).phase
    const p = plan.periods.find((x) => d >= x.start && d <= x.end)
    return p ? PHASES[p.phase] : null
  }
  const out: Point[] = [{ date: startDate, value: startWeight }]
  let w = startWeight
  for (let d = startDate; d < goal; ) {
    const next = addDays(d, 7) > goal ? goal : addDays(d, 7)
    const rate = pace === 'fast' ? fastRate(phaseAt(d)?.weeklyRate) : conservativeRate(phaseAt(d)?.weeklyRate)
    w = w * (1 + ((rate / 100) * diffDays(d, next)) / 7)
    out.push({ date: next, value: w })
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
  /** `hold`: the weight asks for fewer calories, and the target is already at the floor. */
  status: 'ok' | 'lower' | 'raise' | 'wait' | 'hold'
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
 * break) and whether the cut had begun before it, so that it resumes there. Null outside a cut.
 */
function cutStretchAt(date: ISODate): { start: ISODate; resumed: boolean } | null {
  const cutting = (p: Period) => p.phase === 'cut' || p.phase === 'cut-end'
  const i = PERIODS.findIndex((p) => date >= p.start && date <= p.end)
  if (i < 0 || !cutting(PERIODS[i])) return null
  let first = i
  while (first > 0 && cutting(PERIODS[first - 1])) first--
  return { start: PERIODS[first].start, resumed: PERIODS.slice(0, first).some(cutting) }
}

/** A loss the report still tolerates in a cut, in % of body weight per week: beyond it, muscle is at risk. */
const CUT_MAX_RATE = 1
/** A target given as one figure (« ≈ −0.5 %/week ») is read with this much on each side. */
const RATE_SLACK = 0.1
/** Calories move by this much at a time. */
const KCAL_STEP = 150
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
 * clearly slow pace is acted on, and the rest waits. The advice needs weigh-ins of the
 * last week, and never goes under the floor (calorieFloor): there it says so, and points
 * at what else can move.
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
        `Dernière pesée il y a ${ws.daysSinceLast} jours : la tendance ne dit plus rien d’aujourd’hui. Pèse-toi quelques matins de suite pour relancer le conseil.`,
        `Last weigh-in ${ws.daysSinceLast} days ago: the trend no longer describes today. Weigh in a few mornings in a row to get advice again.`,
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
        `Calories changées ${days === 0 ? 'aujourd’hui' : `il y a ${days} jours`} : on laisse 2 semaines au poids pour réagir.`,
        `Calories changed ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}: give your weight 2 weeks to respond.`,
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
    const room = Math.max(0, Math.min(KCAL_STEP, Math.floor((target - floor) / 50) * 50))
    if (room >= 50) {
      const stop = room < KCAL_STEP ? L(` Pas plus bas : ${floor} kcal, c’est ${floorText}.`, ` No lower: ${floor} kcal is ${floorText}.`) : ''
      return make(-room, headline, `${why}${L(' : ', ': ')}${how(room)}${stop}`)
    }
    return {
      ...base, status: 'hold', delta: 0, headline: L(`${headline}, calories au plancher`, `${headline}, calories at the floor`),
      detail: L(
        `${why}. Ta cible ne dépasse pas ${floorText} (${floor} kcal) : le conseil ne descend pas plus bas. Pèse tes aliments pendant une semaine, ajoute ~2 000 pas par jour et garde tes protéines.`,
        `${why}. Your target is no higher than ${floorText} (${floor} kcal): the advice goes no lower. Weigh your food for a week, add ~2,000 steps a day and keep your protein.`,
      ),
    }
  }
  if (phase === 'cut' || phase === 'cut-end') {
    // The phase's range, as a loss: 0.5 to 0.7 in the cut, about 0.5 at its end.
    const [a, b] = ctx.phase?.weeklyRate ?? [-0.7, -0.5]
    const single = a === b
    const slow = Math.min(-a, -b) - (single ? RATE_SLACK : 0)
    const brisk = Math.max(-a, -b) + (single ? RATE_SLACK : 0)
    const aim = single ? L(`objectif : environ ${pct(a)}`, `target: about ${pct(a)}`) : L('objectif : −0,5 à −0,7 %/sem', 'target: −0.5 to −0.7%/wk')
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
    if (loss < (mixed ? slow * MIXED_TREND_SHARE : slow)) {
      // In the first weeks of the cut, or of its return after a diet break, the trend still shows what came before: the first step of the deficit.
      return sinceCut < TREND_DAYS && sinceCut <= sinceChange
        ? lower(stretch?.resumed ? L('Reprise de la sèche', 'Back in the cut') : L('Début de sèche', 'Start of the cut'), L(`${pct(rate)} sur les 3 dernières semaines (${aim})`, `${pct(rate)} over the last 3 weeks (${aim})`), less)
        : lower(L('Perte trop lente', 'Loss too slow'), `${pct(rate)} (${aim})`, less)
    }
    if (loss > CUT_MAX_RATE) return make(KCAL_STEP, L('Perte trop rapide', 'Loss too fast'), L(`${pct(rate)} : au-delà de −1 %/sem le muscle est menacé. +150 kcal.`, `${pct(rate)}: beyond −1%/wk, muscle is at risk. +150 kcal.`))
    if (mixed && loss < slow) {
      const days = TREND_DAYS - Math.min(sinceCut, sinceChange)
      return {
        ...base, status: 'wait', delta: 0, headline: L('Rythme à confirmer', 'Pace to be confirmed'),
        detail: L(
          `${pct(rate)} (${aim}), mais la tendance sur 3 semaines compte encore des jours d’avant ${sinceCut <= sinceChange ? (stretch?.resumed ? 'la reprise de la sèche' : 'la sèche') : 'ton dernier changement de calories'} : verdict dans ${days} jour${days > 1 ? 's' : ''}.`,
          `${pct(rate)} (${aim}), but the 3-week trend still counts days from before ${sinceCut <= sinceChange ? (stretch?.resumed ? 'the cut resumed' : 'the cut') : 'your last change of calories'}: verdict in ${days} day${days > 1 ? 's' : ''}.`,
        ),
      }
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

/** Kept for the Progress screen: the cut advice as one sentence. */
export function cutAdvice(state: AppState, today: ISODate = todayISO()): string | null {
  const ctx = contextAt(today)
  if (!ctx.phase || (ctx.phase.id !== 'cut' && ctx.phase.id !== 'cut-end')) return null
  const a = calorieAdvice(state, today)
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
