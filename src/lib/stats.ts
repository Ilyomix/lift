import { addDays, dayNumber, diffDays, mondayOf, todayISO } from './date'
import { contextAt, GOAL_DATE, PERIODS, PHASES, type PlannedSession } from './program'
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
 */
export function plannedWeightPath(startDate: ISODate, startWeight: number): Point[] {
  const out: Point[] = [{ date: startDate, value: startWeight }]
  let w = startWeight
  for (let d = startDate; d < GOAL_DATE; ) {
    const next = addDays(d, 7) > GOAL_DATE ? GOAL_DATE : addDays(d, 7)
    const rate = conservativeRate(contextAt(d).phase?.weeklyRate)
    w = w * (1 + ((rate / 100) * diffDays(d, next)) / 7)
    out.push({ date: next, value: w })
    d = next
  }
  return out
}

/** Goal band: user-defined, or ±1 kg around the end of the planned path. */
export function goalWeightRange(state: AppState, today: ISODate = todayISO()): { min: number; max: number; computed: boolean; end: number | null } | null {
  const ws = weightStatus(state, today)
  const start = today < PERIODS[1].start ? PERIODS[1].start : today
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

export function proteinTargetFor(state: AppState, date: ISODate): { min: number; max: number } {
  const ctx = contextAt(date)
  if (ctx.phase && (ctx.phase.id === 'cut' || ctx.phase.id === 'cut-end' || ctx.phase.id === 'diet-break')) {
    return { min: Math.max(state.nutritionTargets.proteinMin, ctx.phase.proteinMin), max: Math.max(state.nutritionTargets.proteinMax, ctx.phase.proteinMax) }
  }
  return { min: state.nutritionTargets.proteinMin, max: state.nutritionTargets.proteinMax }
}

export function nutritionDays(state: AppState, days: number, today: ISODate = todayISO()) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1)
    const e = state.nutritionEntries[date]
    return { date, calories: e?.calories ?? 0, protein: e?.protein ?? 0, creatine: e?.creatine ?? 0, logged: !!e && (e.calories > 0 || e.protein > 0 || e.creatine > 0) }
  })
}

/** Cut rule of the program: adjust calories from the 2-week weight trend. */
export function cutAdvice(state: AppState, today: ISODate = todayISO()): string | null {
  const ctx = contextAt(today)
  if (!ctx.phase || (ctx.phase.id !== 'cut' && ctx.phase.id !== 'cut-end')) return null
  const ws = weightStatus(state, today)
  if (ws.weeklyChangePct === null) return 'Pèse-toi chaque matin : il faut 2 semaines de moyenne pour ajuster les calories.'
  const loss = -ws.weeklyChangePct
  if (loss < 0.3) return 'Perte < 0,3 %/sem : retire ~150 kcal (glucides ou lipides, jamais les protéines) ou ajoute ~2 000 pas/jour.'
  if (loss > 1) return 'Perte > 1 %/sem : rajoute ~150 kcal pour préserver le muscle.'
  return 'Rythme dans la cible : ne change rien.'
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
