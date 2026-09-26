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

export interface WeightStatus {
  current: number | null
  currentDate: ISODate | null
  isAverage: boolean
  start: number | null
  startDate: ISODate | null
  /** kg per week over the last 3 weeks of the 7-day average, when enough data */
  weeklyChange: number | null
  weeklyChangePct: number | null
  daysSinceLast: number | null
}

export function weightStatus(state: AppState, today: ISODate = todayISO()): WeightStatus {
  const pts = measureSeries(state.bodyEntries, 'weight')
  if (!pts.length) {
    return { current: null, currentDate: null, isAverage: false, start: null, startDate: null, weeklyChange: null, weeklyChangePct: null, daysSinceLast: null }
  }
  const ma = movingAverage7(pts)
  const last = pts[pts.length - 1]
  const recent = pts.filter((p) => p.date >= addDays(last.date, -6)).length
  const current = recent >= 3 ? ma[ma.length - 1].value : last.value
  const window = ma.filter((p) => p.date >= addDays(last.date, -21))
  let weeklyChange: number | null = null
  if (window.length >= 3 && diffDays(window[0].date, window[window.length - 1].date) >= 7) {
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
    daysSinceLast: diffDays(last.date, today),
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

/**
 * Planned body-weight path from a starting weight: each phase at the least
 * aggressive end of its recommended weekly rate, compounded until the goal date.
 * A draft plan (another goal date) can be passed to preview it.
 */
export function plannedWeightPath(startDate: ISODate, startWeight: number, plan?: { periods: Period[]; goal: ISODate }): Point[] {
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
    const rate = conservativeRate(phaseAt(d)?.weeklyRate)
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
  const f = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('fr-FR')}`
  return rate[0] === rate[1] ? `${f(rate[0])} %/sem` : `${f(rate[0])} à ${f(rate[1])} %/sem`
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
  status: 'ok' | 'lower' | 'raise' | 'wait'
  /** kcal to add (negative: remove). */
  delta: number
  target: number
  headline: string
  detail: string
  /** Weekly change of the 7-day average, in % of body weight. */
  ratePct: number | null
  waist: 'down' | 'up' | 'flat' | null
}

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
 */
export function calorieAdvice(state: AppState, today: ISODate = todayISO()): CalorieAdvice {
  const target = state.nutritionTargets.calories
  const ctx = contextAt(today)
  const phase = ctx.phase?.id ?? 'recomp'
  const ws = weightStatus(state, today)
  const rate = ws.weeklyChangePct
  const waist = waistTrend(state, today)
  const base = { target, ratePct: rate, waist }
  const changed = state.nutritionTargets.caloriesChangedAt
  if (rate === null) {
    return { ...base, status: 'wait', delta: 0, headline: 'Pas encore assez de pesées', detail: 'Pèse-toi chaque matin, à jeun : il faut environ 2 semaines de moyenne pour ajuster les calories.' }
  }
  if (changed && diffDays(changed, today) < 14) {
    return { ...base, status: 'wait', delta: 0, headline: 'Ajustement récent', detail: `Calories changées ${diffDays(changed, today) === 0 ? 'aujourd’hui' : `il y a ${diffDays(changed, today)} jours`} : on laisse 2 semaines au poids pour réagir.` }
  }
  const pct = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %/sem`
  const make = (delta: number, headline: string, detail: string): CalorieAdvice => ({ ...base, status: delta < 0 ? 'lower' : delta > 0 ? 'raise' : 'ok', delta, target: target + delta, headline, detail })
  if (phase === 'cut' || phase === 'cut-end') {
    if (-rate < 0.3) return make(-150, 'Perte trop lente', `${pct(rate)} pour −0,5 à −0,7 visés : −150 kcal (glucides ou lipides, jamais les protéines) ou ~2 000 pas de plus par jour.`)
    if (-rate > 1) return make(150, 'Perte trop rapide', `${pct(rate)} : au-delà de −1 %/sem le muscle est menacé. +150 kcal.`)
    return make(0, 'Rythme dans la cible', `${pct(rate)} pour −0,5 à −0,7 visés : ne change rien.`)
  }
  if (phase === 'recomp' || phase === 'foundation') {
    if (rate > 0.15) return make(-150, 'Poids en hausse', `${pct(rate)} alors que la recomposition vise un poids stable : −150 kcal.`)
    if (rate < -0.5) return make(150, 'Perte trop rapide pour une recomposition', `${pct(rate)} : +150 kcal pour garder l’énergie à l’entraînement.`)
    if (waist === 'up') return make(-150, 'Tour de taille en hausse', 'Poids stable mais tour de taille +1 cm ou plus en un mois : −150 kcal.')
    if (waist === 'down') return make(0, 'Recomposition en marche', 'Poids stable et tour de taille en baisse : ne change rien.')
    return make(0, 'Dans la cible', `${pct(rate)} pour un poids stable à −0,25 %/sem : ne change rien.`)
  }
  // Holidays, diet break, stabilization: hold the weight.
  if (rate > 0.3) return make(-150, 'Poids en hausse', `${pct(rate)} pendant une phase de maintien : −150 kcal.`)
  if (rate < -0.3) return make(150, 'Poids en baisse', `${pct(rate)} pendant une phase de maintien : +150 kcal.`)
  return make(0, 'Poids stable', `${pct(rate)} : phase de maintien respectée.`)
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
  if (ctx.before) return 'Avant programme'
  if (ctx.after) return 'Programme terminé'
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
