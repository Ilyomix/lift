// Visual goal: a look is mostly a body-fat level, then muscle. The app turns the look
// into numbers (target weight, cut length, date) and the chosen zones into volume.
import { addDays, todayISO } from './date'
import { infoFor, type MuscleGroup } from './library'
import { buildPeriods, CUT_WEEKS, GOAL_DATE, isValidGoal, PLAN, planShape, PROGRAM_START, ROTATION } from './program'
import { measureSeries, plannedWeightPath, weightStatus } from './stats'
import type { AppState, ISODate, Look, Template, WorkoutType, Zone } from './types'

export interface LookInfo {
  id: Look
  label: string
  /** Body-fat range (%) for men and for women: visual landmarks, not a diagnosis. */
  range: { m: [number, number]; f: [number, number] }
  text: string
  note?: string
}

export const LOOKS: LookInfo[] = [
  { id: 'athletique', label: 'Athlétique', range: { m: [14, 16], f: [22, 24] }, text: 'Silhouette nette, épaules et bras dessinés, haut des abdos esquissé.' },
  { id: 'sec', label: 'Sec', range: { m: [11, 13], f: [19, 21] }, text: 'Abdos visibles en bonne lumière, veines sur les avant-bras.' },
  { id: 'taille', label: 'Taillé', range: { m: [9, 10], f: [17, 18] }, text: 'Abdos nets, obliques et séparations des épaules visibles.' },
  { id: 'tres-sec', label: 'Très sec', range: { m: [7, 8], f: [14, 15] }, text: 'Look de shooting ou de plage, tenu quelques semaines.', note: 'Difficile à maintenir : énergie, sommeil et libido baissent. À viser pour une date, pas comme état durable.' },
]

export const lookInfo = (id: Look) => LOOKS.find((l) => l.id === id)!

export interface ZoneInfo {
  id: Zone
  label: string
  /** Muscle groups of the zone, in order of preference for the extra set. */
  groups: MuscleGroup[]
}

export const ZONES: ZoneInfo[] = [
  { id: 'epaules', label: 'Épaules', groups: ['sideDelts', 'rearDelts'] },
  { id: 'pectoraux', label: 'Pectoraux', groups: ['chest'] },
  { id: 'dos', label: 'Dos', groups: ['back'] },
  { id: 'bras', label: 'Bras', groups: ['triceps', 'biceps'] },
  { id: 'abdos', label: 'Abdos', groups: ['abs'] },
  { id: 'jambes', label: 'Jambes', groups: ['quads', 'hams', 'glutes'] },
  { id: 'mollets', label: 'Mollets', groups: ['calves'] },
]

/** The report's priorities (the V shape) when no zone is chosen. */
export const DEFAULT_ZONES: Zone[] = ['epaules', 'dos', 'pectoraux']
export const MAX_ZONES = 3

/** "épaules, pectoraux et bras", or null without zones. */
export function zonesText(zones: Zone[]): string | null {
  const labels = zones.map((z) => ZONES.find((x) => x.id === z)?.label.toLowerCase()).filter((x): x is string => !!x)
  if (!labels.length) return null
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

/**
 * Relative fat mass (Woolcott & Bergman 2018, validated against DXA):
 * 64 − 20 × height / waist, + 12 for women. A population estimate: a few points off
 * for one person, but it moves with the waist, which is what matters here.
 */
export function relativeFatMass(heightCm: number, waistCm: number, sex: 'm' | 'f' = 'm'): number {
  return 64 - (20 * heightCm) / waistCm + (sex === 'f' ? 12 : 0)
}

export interface BodyFat {
  pct: number
  source: 'mesure' | 'tour de taille'
  waist?: number
  waistDate?: ISODate
}

export function bodyFatEstimate(
  state: Pick<AppState, 'bodyEntries' | 'profile'>,
  opts: { override?: number | null; heightCm?: number; sex?: 'm' | 'f' } = {},
): BodyFat | null {
  if (typeof opts.override === 'number' && opts.override > 0) return { pct: opts.override, source: 'mesure' }
  const waist = measureSeries(state.bodyEntries, 'waist').at(-1)
  const height = opts.heightCm ?? state.profile.heightCm
  if (!waist || !height) return null
  const pct = Math.min(50, Math.max(4, relativeFatMass(height, waist.value, opts.sex ?? state.profile.sex ?? 'm')))
  return { pct, source: 'tour de taille', waist: waist.value, waistDate: waist.date }
}

/** Average loss rate used to size the cut: the middle of the report's −0.5 to −0.7 %/week. */
const CUT_RATE = 0.006
/** Lean mass a trained lifter can add over a recomposition then a cut, at best (expert opinion). */
const MAX_LEAN_GAIN = 2

export interface VisualPlan {
  look: LookInfo
  range: [number, number]
  weight: number
  bodyFat: BodyFat
  lean: number
  fat: number
  target: [number, number]
  /** Weeks of cut needed at −0.6 %/week to reach the heavier end of the target. */
  cutWeeks: number
  /** Whether that cut fits before the goal date; otherwise the earliest date that allows it. */
  fits: boolean
  suggestedGoal: ISODate | null
  /** Weight, body fat and look reached at the goal date, cautious and brisk paces of the plan. */
  atGoal: { prudent: PaceResult; fast: PaceResult }
  /** Look reached at the goal date at the cautious pace. */
  reached: LookInfo | null
}

export interface PaceResult {
  weight: number
  pct: number
  look: LookInfo | null
}

/** The leanest look reached once rounded: 8.6 % reads as 9 %, so "taillé", not "très sec". */
export function lookFor(pct: number, sex: 'm' | 'f'): LookInfo | null {
  return [...LOOKS].reverse().find((l) => pct < l.range[sex][1] + 0.5) ?? null
}

/** Whether a reached look is at least as lean as the one aimed at. */
export function reachesLook(reached: LookInfo | null, aimed: Look): boolean {
  return !!reached && LOOKS.findIndex((l) => l.id === reached.id) >= LOOKS.findIndex((l) => l.id === aimed)
}

/** Half-kilo steps: what the app stores and shows as the target. */
const half = (x: number) => Math.round(x * 2) / 2

export function visualPlan(
  state: AppState,
  input: { look: Look; bodyFat: BodyFat; sex?: 'm' | 'f'; goal?: ISODate; today?: ISODate },
): VisualPlan | null {
  const today = input.today ?? todayISO()
  const ws = weightStatus(state, today)
  if (!ws.current) return null
  const sex = input.sex ?? state.profile.sex ?? 'm'
  const look = lookInfo(input.look)
  const range = look.range[sex]
  const weight = ws.current
  const lean = weight * (1 - input.bodyFat.pct / 100)
  const fat = weight - lean
  const upper = (lean + MAX_LEAN_GAIN) / (1 - range[1] / 100)
  const target: [number, number] = [half(lean / (1 - range[0] / 100)), half(upper)]
  const needed = weight <= upper ? 0 : Math.ceil(Math.log(upper / weight) / Math.log(1 - CUT_RATE))
  const cutWeeks = Math.max(8, needed)
  const goal = input.goal ?? GOAL_DATE
  const fits = !planShape(goal, cutWeeks).shortCut
  let suggestedGoal: ISODate | null = null
  if (!fits) {
    for (let months = 1; months <= 30; months++) {
      const d = new Date(Number(goal.slice(0, 4)), Number(goal.slice(5, 7)) - 1 + months + 1, 0)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (isValidGoal(iso) && !planShape(iso, cutWeeks).shortCut) {
        suggestedGoal = iso
        break
      }
    }
  }
  const planGoal = fits ? goal : (suggestedGoal ?? goal)
  const periods = buildPeriods(planGoal, cutWeeks)
  const start = today < PROGRAM_START ? PROGRAM_START : today
  const leanMid = lean + MAX_LEAN_GAIN / 2
  const end = (pace: 'prudent' | 'fast'): PaceResult => {
    const w = plannedWeightPath(start, weight, { periods, goal: planGoal }, pace).at(-1)!.value
    const p = Math.max(3, (1 - leanMid / w) * 100)
    return { weight: w, pct: p, look: lookFor(p, sex) }
  }
  const prudent = end('prudent')
  const fast = end('fast')
  return {
    look, range, weight, bodyFat: input.bodyFat, lean, fat, target, cutWeeks, fits, suggestedGoal,
    atGoal: { prudent, fast }, reached: prudent.look,
  }
}

/**
 * Priority zones → one extra set on one exercise per zone and per session (the report's
 * rule, from block 2): isolation first, the zone's main muscle first. Three zones at most:
 * prioritising everything is prioritising nothing.
 */
export function tagPriorities(templates: Record<WorkoutType, Template>, zones: Zone[]): Record<WorkoutType, Template> {
  const out = { ...templates }
  for (const type of ROTATION) {
    const tpl = templates[type]
    if (!tpl) continue
    const chosen = new Set<number>()
    if (zones.length) {
      for (const zone of zones) {
        const z = ZONES.find((x) => x.id === zone)
        if (!z) continue
        let bestIndex = -1
        let bestKey = Infinity
        for (let i = 0; i < tpl.exercises.length; i++) {
          const e = tpl.exercises[i]
          if (chosen.has(i) || e.volumeTag === 'calves') continue
          const info = infoFor(e.exerciseId, e)
          const rank = z.groups.findIndex((g) => info.groups[g] === 1)
          if (rank < 0) continue
          const key = rank * 100 + (info.role === 'isolation' ? 0 : 50) + i
          if (key < bestKey) {
            bestKey = key
            bestIndex = i
          }
        }
        if (bestIndex >= 0) chosen.add(bestIndex)
      }
    } else {
      // Back to the report's tags.
      const report = new Set(PLAN[type].filter((p) => p.tag === 'priority').map((p) => p.id))
      tpl.exercises.forEach((e, i) => report.has(e.exerciseId) && chosen.add(i))
    }
    out[type] = {
      ...tpl,
      exercises: tpl.exercises.map((e, i) => {
        if (e.volumeTag === 'calves') return e
        if (chosen.has(i)) return { ...e, volumeTag: 'priority' as const }
        const { volumeTag: _v, ...rest } = e
        return rest
      }),
    }
  }
  return out
}

/** Weeks between two dates, for display. */
export const weeksBetween = (a: ISODate, b: ISODate) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / (7 * 86_400_000))

export { CUT_WEEKS, addDays }
