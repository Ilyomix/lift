// Visual goal: a look is mostly a body-fat level, then muscle. The app turns the look
// into numbers (target weight, cut length, date) and the chosen zones into volume.
import { addDays, todayISO } from './date'
import { L } from './i18n'
import { infoFor, type MuscleGroup } from './library'
import { buildPeriods, CUT_WEEKS, GOAL_DATE, isValidGoal, MAINTENANCE, MAX_CUT_WEEKS, MIN_CUT_WEEKS, minResumeGoal, PLAN, planShape, PROGRAM_START, ROTATION } from './program'
import { measureSeries, plannedWeightPath, weightStatus } from './stats'
import type { AppState, ISODate, Look, Template, TemplateExercise, VisualGoal, WorkoutType, Zone } from './types'

export interface LookInfo {
  id: Look
  label: string
  /** Body-fat range (%) for men and for women: visual landmarks, not a diagnosis. */
  range: { m: [number, number]; f: [number, number] }
  text: string
  note?: string
}

// Texts are getters: they follow the interface language.
export const LOOKS: LookInfo[] = [
  {
    id: 'athletique', range: { m: [14, 16], f: [22, 24] },
    get label() { return L('Athlétique', 'Athletic') },
    get text() { return L('Silhouette nette, épaules et bras dessinés, haut des abdos esquissé.', 'Clean silhouette, defined shoulders and arms, upper abs starting to show.') },
  },
  {
    id: 'sec', range: { m: [11, 13], f: [19, 21] },
    get label() { return L('Sec', 'Lean') },
    get text() { return L('Abdos visibles en bonne lumière, veines sur les avant-bras.', 'Abs visible in good light, veins on the forearms.') },
  },
  {
    id: 'taille', range: { m: [9, 10], f: [17, 18] },
    get label() { return L('Taillé', 'Ripped') },
    get text() { return L('Abdos nets, obliques et séparations des épaules visibles.', 'Sharp abs, visible obliques and shoulder separation.') },
  },
  {
    id: 'tres-sec', range: { m: [7, 8], f: [14, 15] },
    get label() { return L('Très sec', 'Shredded') },
    get text() { return L('Look de shooting ou de plage, visé pour une date.', 'Photo-shoot or beach look, aimed at for a date.') },
    get note() {
      return L(
        'Se garde quelques semaines autour de la date (la stabilisation du plan), pas toute l’année : faim, énergie, sommeil et libido en pâtissent. Ensuite, on remonte vers « taillé ».',
        'Held for a few weeks around the date (the plan’s stabilization), not all year: hunger, energy, sleep and libido suffer. Afterwards, you ease back up to “ripped”.',
      )
    },
  },
]

export const lookInfo = (id: Look) => LOOKS.find((l) => l.id === id)!

/** A visual goal counts once applied (its cut length is set, 0 when the look is already reached). */
export function goalApplied(vg: VisualGoal | null | undefined): vg is VisualGoal & { cutWeeks: number } {
  return typeof vg?.cutWeeks === 'number'
}

export interface ZoneInfo {
  id: Zone
  label: string
  /** Muscle groups of the zone, in order of preference for the extra set. */
  groups: MuscleGroup[]
}

export const ZONES: ZoneInfo[] = [
  { id: 'epaules', get label() { return L('Épaules', 'Shoulders') }, groups: ['sideDelts', 'rearDelts'] },
  { id: 'pectoraux', get label() { return L('Pectoraux', 'Chest') }, groups: ['chest'] },
  { id: 'dos', get label() { return L('Dos', 'Back') }, groups: ['back'] },
  { id: 'bras', get label() { return L('Bras', 'Arms') }, groups: ['triceps', 'biceps'] },
  { id: 'abdos', get label() { return L('Abdos', 'Abs') }, groups: ['abs'] },
  { id: 'jambes', get label() { return L('Jambes', 'Legs') }, groups: ['quads', 'hams', 'glutes'] },
  { id: 'mollets', get label() { return L('Mollets', 'Calves') }, groups: ['calves'] },
]

/** The report's priorities (the V shape) when no zone is chosen. */
export const DEFAULT_ZONES: Zone[] = ['epaules', 'dos', 'pectoraux']
export const MAX_ZONES = 3

/** "épaules, pectoraux et bras" ("shoulders, chest and arms"), or null without zones. */
export function zonesText(zones: Zone[]): string | null {
  const labels = zones.map((z) => ZONES.find((x) => x.id === z)?.label.toLowerCase()).filter((x): x is string => !!x)
  if (!labels.length) return null
  if (labels.length === 1) return labels[0]
  const head = labels.slice(0, -1).join(', ')
  const last = labels[labels.length - 1]
  return L(`${head} et ${last}`, `${head} and ${last}`)
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
  /** Measured, estimated from the waist (RFM), or from BMI when there is no waist (onboarding). */
  source: 'mesure' | 'tour de taille' | 'imc'
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
  /** The same need before rounding and before the 8-week minimum: negative when the weight is already under the target. */
  need: number
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
  input: { look: Look; bodyFat: BodyFat; sex?: 'm' | 'f'; goal?: ISODate; today?: ISODate; start?: ISODate },
): VisualPlan | null {
  const today = input.today ?? todayISO()
  const programStart = input.start ?? PROGRAM_START
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
  // Weeks of cut at the average pace to reach the heavier end of the target: negative when already under it.
  const need = Math.log(upper / weight) / Math.log(1 - CUT_RATE)
  const needed = weight <= upper ? 0 : Math.ceil(need)
  // Already within the look: no cut, the recomposition runs until the stabilization.
  const cutWeeks = needed === 0 ? 0 : Math.max(8, needed)
  const goal = input.goal ?? GOAL_DATE
  const fits = !planShape(goal, cutWeeks, programStart).shortCut
  let suggestedGoal: ISODate | null = null
  if (!fits) {
    for (let months = 1; months <= 30; months++) {
      const d = new Date(Number(goal.slice(0, 4)), Number(goal.slice(5, 7)) - 1 + months + 1, 0)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (isValidGoal(iso, programStart) && !planShape(iso, cutWeeks, programStart).shortCut) {
        suggestedGoal = iso
        break
      }
    }
  }
  const planGoal = fits ? goal : (suggestedGoal ?? goal)
  const periods = buildPeriods(planGoal, cutWeeks, programStart, null)
  const start = today < programStart ? programStart : today
  const leanMid = lean + MAX_LEAN_GAIN / 2
  const end = (pace: 'prudent' | 'fast'): PaceResult => {
    const w = plannedWeightPath(start, weight, { periods, goal: planGoal }, pace).at(-1)!.value
    const p = Math.max(3, (1 - leanMid / w) * 100)
    return { weight: w, pct: p, look: lookFor(p, sex) }
  }
  const prudent = end('prudent')
  const fast = end('fast')
  return {
    look, range, weight, bodyFat: input.bodyFat, lean, fat, target, cutWeeks, need, fits, suggestedGoal,
    atGoal: { prudent, fast }, reached: prudent.look,
  }
}

/** A cut re-estimated from the latest measurements differs from the plan's by this many weeks before it is worth a word. */
const CUT_DRIFT_WEEKS = 3

/**
 * The cut the plan holds against the one the latest measurements ask for. Its length is set when
 * the goal is applied, from the body fat estimated that day. That estimate follows the waist: a
 * new waist measure can ask for another length (the weight alone barely moves it, since lean mass
 * is a share of it). Before the cut starts, a difference of three weeks or more is worth updating
 * the goal: the cut would start too late, or sooner than needed. At the edge of a look the same
 * three weeks apply: a cut the plan does not have is asked for from three weeks of need, a cut it
 * has is called off from three weeks under the target. Once the cut is under way the pace steers
 * (calorieAdvice). Null when there is nothing to say: no applied look, no recent weigh-in, no way
 * to estimate body fat, a cut already started, or a plan that still fits.
 */
export function cutDrift(state: AppState, today: ISODate = todayISO()): { planned: number; needed: number } | null {
  const vg = state.visualGoal
  if (MAINTENANCE || !goalApplied(vg)) return null
  const ws = weightStatus(state, today)
  if (!ws.current || ws.stale) return null
  const shape = planShape(GOAL_DATE, vg.cutWeeks, PROGRAM_START)
  if (today >= shape.stabStart || (shape.cutWeeks > 0 && today >= shape.cutStart)) return null
  const bodyFat = bodyFatEstimate(state, { override: vg.bodyFat })
  if (!bodyFat) return null
  const plan = visualPlan(state, { look: vg.look, bodyFat, goal: GOAL_DATE, today })
  if (!plan) return null
  // Both lengths as the calendar reads them (planShape): none, or 8 to 40 weeks.
  const weeks = (n: number) => (n <= 0 ? 0 : Math.max(MIN_CUT_WEEKS, Math.min(MAX_CUT_WEEKS, Math.round(n))))
  const planned = weeks(vg.cutWeeks)
  const needed = weeks(plan.cutWeeks)
  if (planned === 0) return plan.need >= CUT_DRIFT_WEEKS ? { planned, needed } : null
  if (needed === 0) return plan.need <= -CUT_DRIFT_WEEKS ? { planned, needed } : null
  return Math.abs(needed - planned) >= CUT_DRIFT_WEEKS ? { planned, needed } : null
}

/**
 * Maintenance mode has no goal date to keep: the date a look needs instead — its cut, then
 * the stabilization — at the end of a month, 8 weeks away at least. Null without a weight.
 */
export function earliestGoalFor(
  state: AppState,
  input: { look: Look; bodyFat: BodyFat; sex?: 'm' | 'f'; today?: ISODate },
): ISODate | null {
  const today = input.today ?? todayISO()
  const min = minResumeGoal(today)
  const [y, m] = min.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const plan = visualPlan(state, { ...input, today, goal: first })
  if (!plan) return null
  return plan.fits ? first : plan.suggestedGoal
}

/**
 * Priority zones → one extra set on one exercise per zone and per session (the report's
 * rule, from block 2): isolation first, the zone's main muscle first. Three zones at most:
 * prioritising everything is prioritising nothing. Chosen zones replace the report's V-shape
 * priorities; the calves rule always stays, and "mollets" adds its set on top of it.
 */
export function tagPriorities(templates: Record<WorkoutType, Template>, zones: Zone[]): Record<WorkoutType, Template> {
  const out = { ...templates }
  for (const type of ROTATION) {
    const tpl = templates[type]
    if (!tpl) continue
    const chosen = new Set<number>()
    for (const zone of zones) {
      const z = ZONES.find((x) => x.id === zone)
      if (!z) continue
      let bestIndex = -1
      let bestKey = Infinity
      for (let i = 0; i < tpl.exercises.length; i++) {
        if (chosen.has(i)) continue
        const e = tpl.exercises[i]
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
    // Without zones, back to the report's tags.
    const report = new Set(zones.length ? [] : PLAN[type].filter((p) => p.tag === 'priority').map((p) => p.id))
    out[type] = {
      ...tpl,
      exercises: tpl.exercises.map((e, i) => {
        const { focus: _f, volumeTag, ...rest } = e
        const tag = volumeTag === 'calves' ? 'calves' : report.has(e.exerciseId) ? 'priority' : undefined
        return { ...rest, ...(tag ? { volumeTag: tag } : {}), ...(chosen.has(i) ? { focus: true } : {}) } as TemplateExercise
      }),
    }
  }
  return out
}

/** Weeks between two dates, for display. */
export const weeksBetween = (a: ISODate, b: ISODate) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / (7 * 86_400_000))

export { CUT_WEEKS, addDays }
