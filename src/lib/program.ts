// The research-based program (report of 26 Sept 2026) and its calendar engine.
import { addDays, diffDays, mondayOf, shiftMonths, todayISO, weekday, isoFromTimestamp, fmtDate } from './date'
import { fmtLoad, roundTo } from './format'
import { loadAt } from './gyms'
import { infoFor, LIBRARY } from './library'
import { L, lang } from './i18n'
import type {
  AppState, ISODate, Prescription, ReentryInfo, Template, TemplateExercise, TrainingSetup, Workout, WorkoutType,
} from './types'

export const PROGRAM_ID = 'golgoth-research-2026'
export const PROGRAM_REVISION = 5
/** Program start of the report (26 Sept 2026), for the data it was written for. New users start the week they sign up. */
export const REPORT_START: ISODate = '2026-09-28'
/** First logged session of the report's data: the previous program, shown as a foundation phase. */
export const REPORT_FOUNDATION: ISODate = '2026-08-10'
/** Goal date of the report. Other users choose theirs at onboarding. */
export const DEFAULT_GOAL: ISODate = '2027-06-30'

// Live plan origin (ES module live bindings), set by configurePlan() from the user's data.
export let PROGRAM_START: ISODate = REPORT_START
/** Start of the calendar: the foundation (sessions logged before the program) or the program start. */
export let FOUNDATION_START: ISODate = REPORT_FOUNDATION
let FOUNDATION: ISODate | null = REPORT_FOUNDATION

/** Default goal for a program start: the end of the month nine months later (the report: 28 Sept → 30 June). */
export function defaultGoalFor(start: ISODate): ISODate {
  const d = shiftMonths(start, 9)
  const [y, m] = d.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

/** Program start for someone who signs up on a given day: that week's Monday, or next Monday at the weekend. */
export function programStartFor(day: ISODate): ISODate {
  const wd = weekday(day)
  return wd === 0 || wd === 6 ? mondayOf(addDays(day, 7)) : mondayOf(day)
}
/** Length of the cut in the report (4 Jan → 13 Jun 2027), deload weeks included. */
export const CUT_WEEKS = 23
/** Shortest plan accepted, counted from the program start. */
export const MIN_PLAN_WEEKS = 8
export const TOTAL_SESSIONS = 220
export const ROTATION: WorkoutType[] = ['UPPER', 'LOWER', 'PUSH', 'PULL', 'LEGS']

/** `fr` is the description of the session, in the current language (the property keeps its historical name). */
export const TYPE_META: Record<WorkoutType, { label: string; fr: string; code: string; minutes: number }> = {
  UPPER: { label: 'Upper', get fr() { return L('Haut du corps', 'Upper body') }, code: 'UP', minutes: 65 },
  LOWER: { label: 'Lower', get fr() { return L('Bas du corps', 'Lower body') }, code: 'LO', minutes: 65 },
  PUSH: { label: 'Push', get fr() { return L('Poussée', 'Push') }, code: 'PS', minutes: 70 },
  PULL: { label: 'Pull', get fr() { return L('Tirage', 'Pull') }, code: 'PL', minutes: 70 },
  LEGS: { label: 'Legs', get fr() { return L('Jambes', 'Legs') }, code: 'LG', minutes: 70 },
}

// ───────────────────────── Fewer than five days ─────────────────────────
// The plan is written for five sessions a week. Gains follow the weekly number of hard sets
// per muscle, and at equal volume the number of sessions makes no detectable difference
// (Pelland 2025, Schoenfeld 2019, Ramos-Campo 2024): with fewer days the rotation stays the
// same and each session takes the sets of the missing ones. Past about 11 sets for a muscle
// in one session no further gain is detected (Remmert 2025, a preprint): added sets stop
// there, and the sets are never scaled for fewer than three days. Below that, and where
// that ceiling bites, the week holds less than the plan.

/** Sessions a week the plan is written for. */
export const PLAN_DAYS = 5
/** Fewest days the sets are scaled for. */
const MIN_SCALED_DAYS = 3
/** Sets for one muscle in one session (direct 1, indirect 0.5) past which adding sets is not worth it. */
export const SESSION_MUSCLE_CAP = 11
/** Warm-up and moving between stations, in the length of a session (minutes). */
export const SESSION_OVERHEAD_MIN = 12

// Set by configurePlan() from the weekly schedule and the user's choice (ES module live bindings).
/** Training days per week. */
export let WEEK_DAYS = PLAN_DAYS
/** Whether a week of fewer than five sessions keeps the plan's weekly volume (longer sessions). */
export let KEEP_WEEKLY_VOLUME = true

/** Sets multiplier for a number of training days: 1 from five days, 5/4 at four, 5/3 at three or fewer. */
export function daysFactorFor(days: number, keep = true): number {
  if (!keep || days >= PLAN_DAYS) return 1
  return PLAN_DAYS / Math.max(MIN_SCALED_DAYS, days)
}

/** Sets multiplier of the current plan. */
export function daysFactor(): number {
  return daysFactorFor(WEEK_DAYS, KEEP_WEEKLY_VOLUME)
}

/** An exercise of a session with its sets: what the scaling reads (the muscles come from the library). */
export interface SessionSlot {
  exerciseId: string
  sets: number
  name?: string
  muscle?: string
  unit?: TemplateExercise['unit']
}

/**
 * Sets of a session scaled by a factor, exercise by exercise.
 * The session total is the nearest whole number, shared out by largest remainder: 3 sets become
 * 4 at ×1.25 before 2 sets become 3. Between equal remainders, the set goes to the exercise whose
 * main muscle has the fewest sets in the session so far (the earlier exercise on a tie), so that
 * no muscle is left out. Then no muscle goes past SESSION_MUSCLE_CAP sets in the session: added
 * sets are taken back, on direct work first, where the most were added (the later exercise on a
 * tie). An exercise never gets fewer sets than given.
 */
export function scaledSession(slots: SessionSlot[], factor: number = daysFactor()): number[] {
  const given = slots.map((x) => x.sets)
  if (factor === 1) return given
  const groups = slots.map((x) => infoFor(x.exerciseId, x).groups as Record<string, number | undefined>)
  const exact = given.map((n) => n * factor)
  const out = exact.map((x) => Math.floor(x + 1e-9))
  const total = (m: string) => out.reduce((a, n, i) => a + n * (groups[i][m] ?? 0), 0)
  // Main muscle of an exercise: the one it works most (the first listed on a tie).
  const main = groups.map((g) => Object.keys(g).reduce<string | null>((best, m) => (best === null || (g[m] ?? 0) > (g[best] ?? 0) ? m : best), null))
  const crowd = (i: number) => (main[i] === null ? out[i] : total(main[i] as string))

  const rest = exact.map((x, i) => x - out[i])
  const served = new Set<number>()
  for (let left = Math.round(exact.reduce((a, b) => a + b, 0)) - out.reduce((a, b) => a + b, 0); left > 0; left--) {
    const open = rest.map((r, i) => ({ i, r })).filter((x) => !served.has(x.i) && x.r > 1e-9)
    if (!open.length) break
    const top = Math.max(...open.map((x) => x.r))
    // Remainders are compared with a tolerance: 2 × 5/3 and 5 × 5/3 leave the same third.
    const pick = open.filter((x) => x.r >= top - 1e-9).reduce((best, x) => (crowd(x.i) < crowd(best.i) - 1e-9 ? x : best))
    out[pick.i] += 1
    served.add(pick.i)
  }

  const muscles = [...new Set(groups.flatMap((g) => Object.keys(g)))]
  for (let guard = 0; guard < 500; guard++) {
    let pick = -1
    for (const m of muscles) {
      if (total(m) <= SESSION_MUSCLE_CAP + 1e-9) continue
      for (let i = 0; i < out.length; i++) {
        const share = groups[i][m] ?? 0
        if (share <= 0 || out[i] <= given[i]) continue
        const best = pick < 0 ? null : { share: groups[pick][m] ?? 0, added: out[pick] - given[pick] }
        const added = out[i] - given[i]
        if (!best || share > best.share || (share === best.share && added >= best.added)) pick = i
      }
      if (pick >= 0) break
    }
    if (pick < 0) break
    out[pick] -= 1
  }
  return out
}

/** Whether a share of the plan's weekly volume counts as the plan itself: within 3 %. */
export function keepsPlan(share: number): boolean {
  return share >= 0.97 - 1e-9 && share <= 1.03 + 1e-9
}

/** A share of the plan's weekly volume in words: "the planned volume" within 3 %, else "about N% of the planned volume". */
export function sharePhrase(share: number): string {
  return keepsPlan(share) ? L('le volume prévu', 'the planned volume') : L(`environ ${Math.round(share * 100)} % du volume prévu`, `about ${Math.round(share * 100)}% of the planned volume`)
}

/**
 * Length of a session from its number of sets (rounded to 5 min): the report's session of that
 * type, with its own number of sets, is the yardstick; warm-up and moving around stay fixed.
 * With the lifter's own pace (minutes per set, from the sessions already done — sessionPace),
 * the estimate is theirs instead of the report's.
 */
export function sessionMinutes(type: WorkoutType, sets: number, pace?: number | null): number {
  if (pace && pace > 0) return Math.max(15, Math.round((SESSION_OVERHEAD_MIN + sets * pace) / 5) * 5)
  const base = TYPE_META[type].minutes
  const planned = PLAN[type].reduce((a, item) => a + item.sets, 0)
  if (planned <= 0 || sets === planned) return base
  return Math.max(15, Math.round((SESSION_OVERHEAD_MIN + ((base - SESSION_OVERHEAD_MIN) * sets) / planned) / 5) * 5)
}

/** Mon UPPER · Tue LOWER · Wed rest · Thu PUSH · Fri PULL · Sat LEGS · Sun rest */
export const DEFAULT_SCHEDULE: Record<number, WorkoutType | null> = {
  0: null, 1: 'UPPER', 2: 'LOWER', 3: null, 4: 'PUSH', 5: 'PULL', 6: 'LEGS',
}

// ───────────────────────── Phases & periods ─────────────────────────

export type PhaseId = 'foundation' | 'recomp' | 'maintenance' | 'cut' | 'diet-break' | 'cut-end' | 'stabilization' | 'upkeep'
export type PeriodKind = 'pre' | 'block' | 'deload' | 'holiday' | 'stabilization'

export interface Phase {
  id: PhaseId
  label: string
  short: string
  nutrition: string
  /** Planned weekly change of body weight, in % (min, max). */
  weeklyRate: [number, number] | null
  proteinMin: number
  proteinMax: number
}

// Texts are getters: they follow the interface language.
export const PHASES: Record<PhaseId, Phase> = {
  foundation: {
    id: 'foundation',
    get label() { return L('Fondation', 'Foundation') },
    get short() { return L('Fondation', 'Foundation') },
    get nutrition() { return L('Ancien programme : références et apprentissage technique.', 'Previous program: baselines and technique learning.') },
    weeklyRate: null, proteinMin: 180, proteinMax: 190,
  },
  recomp: {
    id: 'recomp',
    label: 'Phase 1 · Recomposition',
    short: 'Recomposition',
    get nutrition() { return L('Poids stable à −0,25 %/sem · calories ajustées sur ta moyenne 7 jours.', 'Stable weight to −0.25%/wk · calories adjusted to your 7-day average.') },
    weeklyRate: [-0.25, 0], proteinMin: 180, proteinMax: 190,
  },
  maintenance: {
    id: 'maintenance',
    get label() { return L('Fêtes · Maintien', 'Holidays · Maintenance') },
    get short() { return L('Maintien', 'Maintenance') },
    get nutrition() { return L('Calories de maintien, 3–4 séances allégées.', 'Maintenance calories, 3–4 lighter workouts.') },
    weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190,
  },
  cut: {
    id: 'cut',
    get label() { return L('Phase 2 · Sèche', 'Phase 2 · Cut') },
    get short() { return L('Sèche', 'Cut') },
    get nutrition() { return L('−0,5 à −0,7 %/sem · déficit ≤ 500 kcal/j.', '−0.5 to −0.7%/wk · deficit ≤ 500 kcal/day.') },
    weeklyRate: [-0.7, -0.5], proteinMin: 185, proteinMax: 200,
  },
  'diet-break': {
    id: 'diet-break',
    get label() { return L('Pause diététique', 'Diet break') },
    get short() { return L('Pause diét.', 'Diet break') },
    get nutrition() { return L('Une semaine aux calories de maintien : récupération physique et mentale.', 'One week at maintenance: physical and mental recovery.') },
    weeklyRate: [-0.1, 0.1], proteinMin: 185, proteinMax: 200,
  },
  'cut-end': {
    id: 'cut-end',
    get label() { return L('Fin de sèche', 'End of cut') },
    get short() { return L('Fin de sèche', 'End of cut') },
    get nutrition() { return L('Rythme ≈ −0,5 %/sem.', 'Pace ≈ −0.5%/wk.') },
    weeklyRate: [-0.5, -0.5], proteinMin: 185, proteinMax: 200,
  },
  stabilization: {
    id: 'stabilization',
    get label() { return L('Phase 3 · Stabilisation', 'Phase 3 · Stabilization') },
    get short() { return L('Stabilisation', 'Stabilization') },
    get nutrition() { return L('Remonter progressivement aux calories de maintien.', 'Ease back up to maintenance.') },
    weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190,
  },
  // Maintenance mode: no goal date, the blocks repeat with no cut and no end.
  upkeep: {
    id: 'upkeep',
    get label() { return L('Entretien', 'Maintenance') },
    get short() { return L('Entretien', 'Maintenance') },
    get nutrition() { return L('Calories de maintien : poids stable (±0,1 %/sem), les charges continuent de progresser.', 'Maintenance calories: stable weight (±0.1%/wk), loads keep progressing.') },
    weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190,
  },
}

export interface Period {
  id: string
  label: string
  short: string
  kind: PeriodKind
  phase: PhaseId
  start: ISODate
  end: ISODate
  note: string
  volumeFactor?: number
  /** Priority muscles get +1 set from this week of the block on. */
  priorityFromWeek?: number
  /** The report adds that set only "if performance is going up": the first weeks of the block decide. */
  priorityIfRising?: boolean
  calves?: boolean
  fixedRir?: string
}

// ───────────────────────── Plan generator ─────────────────────────
// The calendar is rebuilt from the goal date with the report's rules: a ~2.5-week
// stabilization ends on the goal, a 23-week cut precedes it, and the recomposition
// fills the time left since the program start. Blocks last about five weeks and are
// followed by a deload week, except the last block of a run (holidays, the next phase
// or the stabilization take that role). Christmas weeks become a maintenance period.

export interface Chunk {
  weeks: number
  deload: boolean
}

export function layBlocks(weeks: number): Chunk[] {
  if (weeks <= 0) return []
  const k = Math.max(1, Math.round(weeks / 6))
  const build = weeks - (k - 1)
  const base = Math.floor(build / k)
  const extra = build - base * k
  return Array.from({ length: k }, (_, i) => ({ weeks: base + (i >= k - extra ? 1 : 0), deload: i < k - 1 }))
}

function christmasWindows(from: ISODate, to: ISODate): { start: ISODate; end: ISODate }[] {
  const out: { start: ISODate; end: ISODate }[] = []
  for (let y = Number(from.slice(0, 4)) - 1; y <= Number(to.slice(0, 4)); y++) {
    const start = mondayOf(`${y}-12-24`)
    const end = addDays(mondayOf(`${y + 1}-01-01`), 6)
    if (end >= from && start <= to) out.push({ start: start < from ? from : start, end: end > to ? to : end })
  }
  return out
}

export interface PlanShape {
  recompWeeks: number
  cutWeeks: number
  cutStart: ISODate
  stabStart: ISODate
  shortCut: boolean
}

/** Shortest and longest cut a visual goal may ask for (weeks, deloads included). */
export const MIN_CUT_WEEKS = 8
export const MAX_CUT_WEEKS = 40

/** Muscles of the extra set, in the blocks' notes: the report's V shape unless a visual goal chose zones. */
const defaultPriorityText = () => L('deltoïdes latéraux, dos et pectoraux', 'side delts, back and chest')
// Set again by configurePlan() on every sync, in the language of that moment.
let PRIORITY_TEXT = defaultPriorityText()

/**
 * Weeks of recomposition and of cut before the stabilization that ends on the goal.
 * The cut lasts 23 weeks (the report) unless a visual goal asks for another length.
 */
export function planShape(goal: ISODate, wantedCut: number = CUT_WEEKS, start: ISODate = PROGRAM_START): PlanShape {
  let stabStart = mondayOf(addDays(goal, -16))
  if (stabStart <= start) stabStart = addDays(start, 7)
  const available = Math.max(0, Math.round(diffDays(start, stabStart) / 7))
  // No cut when the look is already reached: recomposition until the stabilization.
  const wanted = wantedCut <= 0 ? 0 : Math.max(MIN_CUT_WEEKS, Math.min(MAX_CUT_WEEKS, Math.round(wantedCut)))
  const cutWeeks = Math.min(wanted, available)
  const recompWeeks = available - cutWeeks
  return { recompWeeks, cutWeeks, cutStart: addDays(start, recompWeeks * 7), stabStart, shortCut: cutWeeks < wanted }
}

export function buildPeriods(
  goal: ISODate,
  wantedCut: number = CUT_WEEKS,
  start: ISODate = PROGRAM_START,
  foundation: ISODate | null = FOUNDATION,
): Period[] {
  const shape = planShape(goal, wantedCut, start)
  const out: Period[] = []
  // Labels and notes are written in the current language: configurePlan() rebuilds the plan when it changes.
  pushFoundation(out, start, foundation)
  const counter = { n: 0 }
  layPhase(out, counter, start, shape.recompWeeks, 'recomp')
  layPhase(out, counter, shape.cutStart, shape.cutWeeks, 'cut')
  out.push({ id: 'stab', label: L('Stabilisation', 'Stabilization'), short: 'S', kind: 'stabilization', phase: 'stabilization', start: shape.stabStart, end: goal, calves: true, volumeFactor: 0.7, fixedRir: '1–2', note: L('Volume −30 %, charges maintenues.', 'Volume −30%, loads kept.') })

  noteBuildBlocks(out.filter((p) => p.kind === 'block' && p.phase === 'recomp'))
  const cut = out.filter((p) => p.kind === 'block' && p.phase === 'cut')
  cut.forEach((p, i) => {
    p.priorityFromWeek = 1
    p.calves = true
    p.note = i === 0
      ? L('Début de la sèche. Volume du bloc précédent maintenu, mollets à 12 séries.', 'Start of the cut. Volume of the previous block kept, calves at 12 sets.')
      : i === 1
        ? L('Garder les charges : c’est le signal principal de préservation musculaire.', 'Keep your loads: it’s the main signal that muscle is being preserved.')
        : L('Si la récupération baisse : −20 % de volume, intensité maintenue.', 'If recovery drops: −20% volume, intensity kept.')
  })
  const last = cut[cut.length - 1]
  if (last && cut.length > 1) {
    last.phase = 'cut-end'
    last.volumeFactor = 0.8
    last.fixedRir = '1–2'
    last.note = L('Volume ~80 % du bloc précédent, 1–2 répétitions en réserve.', 'Volume ~80% of the previous block, 1–2 reps in reserve.')
  }
  noteDeloads(out)
  const cutDeloads = out.filter((p) => p.kind === 'deload' && p.phase === 'cut')
  if (cut.length && cutDeloads.length) {
    const mid = diffDays(cut[0].start, (last ?? cut[0]).end) / 2
    const pick = cutDeloads.reduce((a, b) => (Math.abs(diffDays(cut[0].start, b.start) - mid) < Math.abs(diffDays(cut[0].start, a.start) - mid) ? b : a))
    pick.phase = 'diet-break'
    pick.label = L('Semaine allégée + pause diététique', 'Deload + diet break')
    pick.note = L('Calories de maintien, moitié des séries.', 'Maintenance calories, half the sets.')
  }
  return out
}

/**
 * Maintenance mode: no goal date. Blocks of about five weeks and their deloads follow
 * each other from the program start, Christmas weeks at maintenance, with no cut and
 * no stabilization. Each stretch between two Christmases is laid out on its own, so the
 * blocks already planned never move when the plan is extended by a year.
 */
export function buildMaintenancePeriods(
  start: ISODate = PROGRAM_START,
  foundation: ISODate | null = FOUNDATION,
  until: ISODate = maintenanceHorizon(todayISO(), start),
): Period[] {
  const out: Period[] = []
  pushFoundation(out, start, foundation)
  layPhase(out, { n: 0 }, start, Math.max(1, Math.round((diffDays(start, until) + 1) / 7)), 'upkeep')
  noteBuildBlocks(out.filter((p) => p.kind === 'block' && p.phase === 'upkeep'))
  noteDeloads(out)
  return out
}

/** How far the open-ended plan is laid out: to the end of next year's holidays (12 to 24 months ahead). */
export function maintenanceHorizon(today: ISODate = todayISO(), start: ISODate = PROGRAM_START): ISODate {
  const ref = today > start ? today : start
  const y = Number(ref.slice(0, 4)) + 1
  return addDays(mondayOf(`${y + 1}-01-01`), 6)
}

function pushFoundation(out: Period[], start: ISODate, foundation: ISODate | null) {
  if (foundation && foundation < start) {
    out.push({ id: 'fondation', label: L('Fondation', 'Foundation'), short: 'F', kind: 'pre', phase: 'foundation', start: foundation, end: addDays(start, -1), note: L('Ancien programme : références et technique.', 'Previous program: baselines and technique.') })
  }
}

/** Blocks and deloads of one phase over a number of weeks, the Christmas weeks set aside as holidays. */
function layPhase(out: Period[], counter: { n: number }, start: ISODate, weeks: number, id: PhaseId) {
  if (weeks <= 0) return
  const segment = (from: ISODate, w: number) => {
    let d = from
    for (const c of layBlocks(w)) {
      const n = ++counter.n
      out.push({ id: `b${n}`, label: L(`Bloc ${n}`, `Block ${n}`), short: `B${n}`, kind: 'block', phase: id, start: d, end: addDays(d, c.weeks * 7 - 1), note: '' })
      d = addDays(d, c.weeks * 7)
      if (c.deload) {
        out.push({ id: `d${n}`, label: L('Semaine allégée', 'Deload'), short: 'D', kind: 'deload', phase: id, start: d, end: addDays(d, 6), note: '' })
        d = addDays(d, 7)
      }
    }
  }
  const end = addDays(start, weeks * 7 - 1)
  let cursor = start
  for (const w of christmasWindows(start, end)) {
    if (w.start > cursor) segment(cursor, Math.round(diffDays(cursor, w.start) / 7))
    out.push({ id: `fetes-${w.start.slice(0, 4)}`, label: L('Fêtes', 'Holidays'), short: L('F', 'H'), kind: 'holiday', phase: 'maintenance', start: w.start, end: w.end, volumeFactor: 0.67, note: L('3–4 séances à volume réduit. Une pause ici suit la règle de reprise.', '3–4 workouts at reduced volume. A break here follows the return rule.') })
    cursor = addDays(w.end, 1)
  }
  if (cursor <= end) segment(cursor, Math.round((diffDays(cursor, end) + 1) / 7))
}

/** Building blocks (recomposition, maintenance): the first one is for finding loads and technique, the next ones add the priority set from W3. */
function noteBuildBlocks(blocks: Period[]) {
  blocks.forEach((p, i) => {
    if (i === 0) p.note = L('Prise en main : trouve tes charges de départ et prends tes repères techniques. Pas encore de série prioritaire.', 'Getting started: find your starting loads and get comfortable with the technique. No priority set yet.')
    else {
      p.priorityFromWeek = 3
      p.priorityIfRising = true
      p.note = L(`+1 série sur ${PRIORITY_TEXT} à partir de S3, si les performances montent.`, `+1 set for ${PRIORITY_TEXT} from W3, if performance is going up.`)
    }
  })
}

function noteDeloads(out: Period[]) {
  for (const p of out) {
    if (p.kind !== 'deload') continue
    p.note = p.phase === 'recomp' || p.phase === 'upkeep'
      ? L('Mêmes exercices, moitié des séries, charges −10 %, 3–4 répétitions en réserve.', 'Same exercises, half the sets, loads −10%, 3–4 reps in reserve.')
      : L('Moitié des séries, déficit maintenu.', 'Half the sets, deficit kept.')
  }
}

/** A goal at least 8 weeks and at most 5 years after the program start. */
export function isValidGoal(goal: unknown, start: ISODate = PROGRAM_START): goal is ISODate {
  return typeof goal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(goal) && addDays(goal, 0) === goal && goal >= addDays(start, MIN_PLAN_WEEKS * 7) && goal <= addDays(start, 5 * 365)
}

// Live plan: rebuilt when the goal date or the cut length changes (ES module live bindings).
/** End of the plan: the goal date, or in maintenance mode the end of the calendar laid out so far. */
export let GOAL_DATE: ISODate = DEFAULT_GOAL
export let CUT_LENGTH: number = CUT_WEEKS
/** Maintenance mode: no goal date, blocks and deloads with no cut and no end. */
export let MAINTENANCE = false
export let PERIODS: Period[] = buildPeriods(DEFAULT_GOAL)
let MANUAL_DELOAD: { start: ISODate; end: ISODate } | null = null
let PLAN_LANG = lang()

export function configurePlan(
  goal: ISODate | null | undefined,
  manualDeload: { start: ISODate; end: ISODate } | null = null,
  cutWeeks: number | null | undefined = null,
  priorities: string | null | undefined = null,
  origin: { start?: ISODate | null; foundation?: ISODate | null; maintenance?: boolean; today?: ISODate; days?: number; keepVolume?: boolean } = { start: REPORT_START, foundation: REPORT_FOUNDATION },
): void {
  WEEK_DAYS = typeof origin.days === 'number' && origin.days >= 1 ? Math.min(7, Math.round(origin.days)) : PLAN_DAYS
  KEEP_WEEKLY_VOLUME = origin.keepVolume !== false
  const start = origin.start && /^\d{4}-\d{2}-\d{2}$/.test(origin.start) ? origin.start : REPORT_START
  const foundation = origin.foundation && origin.foundation < start ? origin.foundation : null
  const maintenance = !!origin.maintenance
  const g = maintenance ? maintenanceHorizon(origin.today ?? todayISO(), start) : isValidGoal(goal, start) ? goal : defaultGoalFor(start)
  const c = typeof cutWeeks === 'number' && Number.isFinite(cutWeeks) ? cutWeeks : CUT_WEEKS
  const t = priorities || defaultPriorityText()
  // Period labels and notes are written at build time: a language change rebuilds them too.
  const lg = lang()
  if (g !== GOAL_DATE || c !== CUT_LENGTH || t !== PRIORITY_TEXT || start !== PROGRAM_START || foundation !== FOUNDATION || lg !== PLAN_LANG || maintenance !== MAINTENANCE) {
    PLAN_LANG = lg
    PROGRAM_START = start
    FOUNDATION = foundation
    FOUNDATION_START = foundation ?? start
    GOAL_DATE = g
    CUT_LENGTH = c
    PRIORITY_TEXT = t
    MAINTENANCE = maintenance
    PERIODS = maintenance ? buildMaintenancePeriods(start, foundation, g) : buildPeriods(g, c, start, foundation)
  }
  MANUAL_DELOAD = manualDeload
}

/**
 * Goal date offered when leaving maintenance mode: the one kept from before while it is
 * still at least 8 weeks away, else nine months after this week (the default plan length).
 */
export function resumeGoalFor(saved: ISODate | null | undefined, today: ISODate = todayISO(), start: ISODate = PROGRAM_START): ISODate {
  const min = addDays(today, MIN_PLAN_WEEKS * 7)
  if (saved && saved >= min && isValidGoal(saved, start)) return saved
  const d = defaultGoalFor(programStartFor(today))
  const max = addDays(start, 5 * 365)
  return d > max ? max : d
}

/** Earliest goal date when leaving maintenance: 8 weeks from today, room for a real plan. */
export function minResumeGoal(today: ISODate = todayISO(), start: ISODate = PROGRAM_START): ISODate {
  const a = addDays(today, MIN_PLAN_WEEKS * 7)
  const b = addDays(start, MIN_PLAN_WEEKS * 7)
  return a > b ? a : b
}

export function manualDeloadAt(date: ISODate): boolean {
  return !!MANUAL_DELOAD && date >= MANUAL_DELOAD.start && date <= MANUAL_DELOAD.end
}

export function periodAt(date: ISODate): Period | null {
  return PERIODS.find((p) => date >= p.start && date <= p.end) ?? null
}

export function periodWeeks(p: Period): number {
  return Math.ceil((diffDays(p.start, p.end) + 1) / 7)
}

export function weekIn(p: Period, date: ISODate): number {
  return Math.floor(diffDays(p.start, date) / 7) + 1
}

export interface ProgramContext {
  date: ISODate
  period: Period | null
  phase: Phase | null
  week: number
  weeks: number
  deload: boolean
  /** e.g. "Bloc 1 · S3" */
  title: string
  /** e.g. "RIR 1–2 · volume normal" */
  effort: string
  effortDetail: string
  before: boolean
  after: boolean
}

export function contextAt(date: ISODate): ProgramContext {
  const period = periodAt(date)
  if (!period) {
    const after = date > GOAL_DATE
    return {
      date, period: null, phase: null, week: 0, weeks: 0, deload: false,
      title: after ? L('Programme terminé', 'Program complete') : L('Avant programme', 'Before the program'),
      effort: '', effortDetail: '', before: !after, after,
    }
  }
  const week = weekIn(period, date)
  const weeks = periodWeeks(period)
  const phase = PHASES[period.phase]
  let title = period.label
  if (period.kind === 'block') title = L(`${period.label} · S${week}`, `${period.label} · W${week}`)
  if (period.kind === 'holiday' || period.kind === 'stabilization') title = L(`${period.label} · S${week}/${weeks}`, `${period.label} · W${week}/${weeks}`)
  const effort = weekEffort(period, week)
  if (manualDeloadAt(date) && period.kind !== 'deload') {
    return {
      date, period, phase, week, weeks, deload: true, title: L('Semaine allégée anticipée', 'Early deload'),
      effort: L('3–4 répétitions en réserve · séries ÷ 2', '3–4 reps in reserve · sets ÷ 2'),
      effortDetail: L('Semaine allégée avancée après une baisse générale des performances.', 'Deload brought forward after a general drop in performance.'),
      before: false, after: false,
    }
  }
  return {
    date, period, phase, week, weeks, deload: period.kind === 'deload', title,
    effort: effort.short, effortDetail: effort.detail, before: false, after: false,
  }
}

function weekEffort(p: Period, week: number): { short: string; detail: string } {
  if (p.kind === 'deload') return { short: L('3–4 répétitions en réserve · séries ÷ 2', '3–4 reps in reserve · sets ÷ 2'), detail: L('Semaine allégée : mêmes exercices, moitié des séries, charges −10 %.', 'Deload week: same exercises, half the sets, loads −10%.') }
  if (p.kind === 'holiday') return { short: L('2–3 répétitions en réserve · volume réduit', '2–3 reps in reserve · reduced volume'), detail: L('3–4 séances à volume réduit pendant les fêtes.', '3–4 workouts at reduced volume over the holidays.') }
  if (p.kind === 'stabilization') return { short: L('1–2 répétitions en réserve · volume −30 %', '1–2 reps in reserve · volume −30%'), detail: L('Charges maintenues, volume réduit de 30 %.', 'Loads kept, volume reduced by 30%.') }
  if (p.kind === 'pre') return { short: L('Références', 'Baselines'), detail: L('Ancien programme.', 'Previous program.') }
  if (p.fixedRir) return { short: L(`${p.fixedRir} répétitions en réserve · volume 80 %`, `${p.fixedRir} reps in reserve · volume 80%`), detail: L('Fin de sèche : volume ~80 % du bloc précédent.', 'End of cut: volume ~80% of the previous block.') }
  const weeks = periodWeeks(p)
  if (week === 1) return { short: L('3 répétitions en réserve · réintroduction', '3 reps in reserve · ramp-up'), detail: L('Semaine 1 du bloc : on garde 3 répétitions en réserve.', 'Week 1 of the block: keep 3 reps in reserve.') }
  if (week === 2) return { short: L('2 répétitions en réserve', '2 reps in reserve'), detail: L('Semaine 2 : 2 répétitions en réserve.', 'Week 2: 2 reps in reserve.') }
  if (week >= weeks) return { short: L('0–1 répétition en réserve · dernière semaine', '0–1 rep in reserve · last week'), detail: L('Dernière série d’isolation jusqu’à l’échec technique.', 'Last isolation set to technical failure.') }
  return { short: L('1–2 / 0–1 répétitions en réserve', '1–2 / 0–1 reps in reserve'), detail: L('Garde 1–2 répétitions en réserve en polyarticulaire, 0–1 en isolation.', 'Keep 1–2 reps in reserve on compound lifts, 0–1 on isolation.') }
}

/** Effort target for one exercise on a given date. */
export function effortFor(ex: TemplateExercise, ctx: ProgramContext): string {
  const base = ex.target.rir ?? (ex.role === 'compound' ? '1–2' : '0–1')
  const p = ctx.period
  if (ctx.deload) return '3–4'
  // A new plan can be tried before its first Monday. Keep the introductory
  // effort shown during onboarding; imported foundation workouts keep theirs.
  if (ctx.before && FOUNDATION === null) return '3'
  if (!p || p.kind === 'pre') return base
  if (p.kind === 'holiday') return '2–3'
  if (p.fixedRir) return p.fixedRir
  if (ctx.week === 1) return '3'
  if (ctx.week === 2) return '2'
  if (ctx.week >= ctx.weeks) return ex.role === 'compound' ? '1' : '0–1'
  return base
}

export function incrementFor(ex: { exerciseId: string; unit: TemplateExercise['unit'] }): number {
  const info = LIBRARY[ex.exerciseId]
  if (info) return info.increment
  return ex.unit === 'kg/main' ? 2 : ex.unit === 'PDC' ? 0 : 2.5
}

/**
 * The step a load moves by. Plates of 1.25 kg make 2.5 kg the smallest jump on a barbell or a
 * plate-loaded machine: their usual 5 kg step only applies from 100 kg, where it stays within
 * 5 % of the load. Under that, 5 kg was a jump of 25 % at 20 kg, far from the program's 2.5 %.
 */
export function loadStep(ex: { exerciseId: string; unit: TemplateExercise['unit'] }, load: number): number {
  const inc = incrementFor(ex)
  return ex.unit === 'kg' && inc === 5 && load < 100 ? 2.5 : inc
}

/**
 * Bodyweight exercises that take added load (belt, plate, dumbbell: dips, pull-ups…).
 * Their load is the added weight: none (null or 0) until the top of the range is reached.
 */
export function takesLest(ex: { exerciseId: string; unit: TemplateExercise['unit'] }): boolean {
  return ex.unit === 'PDC' && incrementFor(ex) > 0
}

/**
 * "If performance is going up": in the weeks of the block before the priority set, the
 * exercise progressed at least once (more reps, a validated load or a heavier one), and
 * more often than it dropped. Until those weeks are over, the plan shows the set.
 */
function risingIn(p: Period, workouts: Workout[], exerciseId: string, today: ISODate): boolean {
  const from = p.priorityFromWeek ?? 1
  if (today < addDays(p.start, (from - 1) * 7)) return true
  let ups = 0
  let downs = 0
  for (const w of workouts) {
    if (w.date < p.start || w.date > p.end || weekIn(p, w.date) >= from) continue
    const c = w.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped)?.comparison
    if (!c) continue
    if (c.status === 'progress' || c.chargeValidated || (c.status === 'load-change' && /^(CHARGE SUP|HEAVIER LOAD)/.test(c.headline))) ups++
    else if (c.status === 'down') downs++
  }
  return ups > 0 && ups > downs
}

/** Reason of the automatic one-set cut (training.ts), French then English: stored in the templates, shown in the current language. */
export const SET_DROP_REASON: [string, string] = ['nette baisse 2 séances de suite', 'clear drop 2 sessions in a row']
/** The same reason as it was stored before the signal had a margin: still recognized, and shown with today's words. */
const SET_DROP_REASONS = [...SET_DROP_REASON, 'baisse 2 séances de suite', 'down 2 sessions in a row']

/** An automatic set change stays active until the end of the period in which it was made. */
export function autoAdjustActive(ex: Pick<TemplateExercise, 'autoAdjust'>, date: ISODate): boolean {
  const a = ex.autoAdjust
  if (!a || date < a.since) return false
  const p = periodAt(a.since)
  return !!p && date <= p.end
}

/**
 * Sets, reps, effort and load for every exercise of a session on a given date, all program rules applied.
 * With a gym, the load is the one of that gym (machines differ between gyms).
 * With the session history, the priority set of a building block waits for rising performance
 * (judged as of `today`: a block that has not reached that point keeps the planned set).
 * With fewer than five training days, the sets of the session are scaled to keep the weekly
 * volume (scaledSession); `planSets` keeps what the plan asks at five days, which is what the
 * load progression is judged on.
 */
export function prescribeSession(exercises: TemplateExercise[], date: ISODate, reentry: ReentryInfo | null, gymId?: string, workouts?: Workout[], today: ISODate = todayISO()): Prescription[] {
  const ctx = contextAt(date)
  const p = ctx.period
  const factor = daysFactor()
  // The sheet's sets, plus the sets the period adds (priority muscles, calves).
  const extra = exercises.map((ex) => {
    let priority: 'set' | 'hold' | null = null
    if (p && (ex.volumeTag === 'priority' || ex.focus) && p.priorityFromWeek && ctx.week >= p.priorityFromWeek) {
      priority = !p.priorityIfRising || !workouts || risingIn(p, workouts, ex.exerciseId, today) ? 'set' : 'hold'
    }
    return { priority, calves: !!p?.calves && ex.volumeTag === 'calves' }
  })
  const sheet = exercises.map((ex) => ex.target.sets)
  const planned = exercises.map((ex, i) => ex.target.sets + (extra[i].priority === 'set' ? 1 : 0) + (extra[i].calves ? 1 : 0))
  const slot = (sets: number[]): SessionSlot[] => exercises.map((ex, i) => ({ exerciseId: ex.exerciseId, name: ex.name, muscle: ex.muscle, unit: ex.unit, sets: sets[i] }))
  // Fewer than five days: the week keeps its volume, the session takes more sets.
  const scaledSheet = scaledSession(slot(sheet), factor)
  const scaledPlanned = scaledSession(slot(planned), factor)

  return exercises.map((ex, i) => {
    const notes: string[] = []
    const priority = extra[i].priority === 'set' ? (ex.focus ? L('zone prioritaire', 'priority area') : L('muscle prioritaire', 'priority muscle')) : null
    const calves = extra[i].calves ? L('mollets à 12 séries/semaine', 'calves at 12 sets/week') : null
    if (extra[i].priority === 'hold') notes.push(L('Série prioritaire en attente : pas de progression en début de bloc', 'Priority set on hold: no progress early in the block'))
    if (factor === 1) {
      for (const why of [priority, calves]) if (why) notes.push(L(`+1 série (${why})`, `+1 set (${why})`))
    } else if (priority || calves) {
      // Scaled with the rest of the session, within the ceiling per muscle: what is really added here.
      const added = scaledPlanned[i] - scaledSheet[i]
      const why = [priority, calves].filter(Boolean).join(', ')
      if (added > 0) notes.push(L(`+${added} série${added > 1 ? 's' : ''} (${why})`, `+${added} ${added === 1 ? 'set' : 'sets'} (${why})`))
    }
    // The same rules on the session's sets and on the plan's sets at five days.
    const through = (sets: number, deloadFrom: number): number => {
      // One set less after two drops in a row is one set less than what was really done.
      if (autoAdjustActive(ex, date) && ex.autoAdjust) sets = Math.max(1, sets + ex.autoAdjust.sets)
      if (p?.volumeFactor) sets = Math.max(1, Math.round(sets * p.volumeFactor))
      if (ctx.deload) sets = Math.max(1, Math.ceil(deloadFrom / 2))
      if (reentry && reentry.sessionsLeft > 0) sets = Math.max(1, Math.round(sets * reentry.setsFactor))
      return sets
    }
    const sets = through(scaledPlanned[i], scaledSheet[i])
    const planSets = Math.min(sets, through(planned[i], sheet[i]))
    if (autoAdjustActive(ex, date) && ex.autoAdjust) {
      const sign = ex.autoAdjust.sets > 0 ? '+' : '−'
      const n = Math.abs(ex.autoAdjust.sets)
      const reason = SET_DROP_REASONS.includes(ex.autoAdjust.reason) ? L(...SET_DROP_REASON) : ex.autoAdjust.reason
      notes.push(L(`${sign}${n} série (${reason})`, `${sign}${n} ${n === 1 ? 'set' : 'sets'} (${reason})`))
    }
    let loadFactor = 1
    let rir = effortFor(ex, ctx)
    if (ctx.deload) {
      loadFactor = 0.9
      notes.push(L('Semaine allégée : moitié des séries, −10 %', 'Deload: half the sets, −10%'))
    }
    if (reentry && reentry.sessionsLeft > 0) {
      loadFactor = Math.min(loadFactor, reentry.loadFactor)
      rir = reentry.rir
      notes.push(reentry.label)
    }
    const base = gymId === undefined ? (ex.target.weight ?? null) : loadAt(ex, gymId)
    const inc = loadStep(ex, base ?? 0)
    const weight =
      base === null
        ? null
        : loadFactor < 1 && inc > 0
          ? Math.min(base, Math.max(inc, roundTo(base * loadFactor, inc)))
          : base
    return {
      sets, minReps: ex.target.minReps, maxReps: ex.target.maxReps, rir,
      restSeconds: ex.target.restSeconds, weight, loadFactor, notes,
      ...(planSets < sets ? { planSets } : {}),
    }
  })
}

/** One exercise on its own (a session of one): prescribeSession() is the one that knows the whole session. */
export function prescribe(ex: TemplateExercise, date: ISODate, reentry: ReentryInfo | null, gymId?: string, workouts?: Workout[], today: ISODate = todayISO()): Prescription {
  return prescribeSession([ex], date, reentry, gymId, workouts, today)[0]
}

// ───────────────────────── Research templates ─────────────────────────

interface PlanItem {
  id: string
  sets: number
  reps: [number, number]
  rir: string
  rest: number
  /** Program note, French then English. */
  note?: string | [string, string]
  superset?: boolean
  tag?: 'priority' | 'calves'
}

// Revisions 4 and 5: the report left abs, calves and rear delts at 6 weekly sets, under the 10 its
// own volume rule starts at. They come to 10: abs and calves over three sessions rather than two
// (4 + 3 + 3), rear delts with 4 + 3 direct sets on top of their share of the rows. At equal weekly
// volume the split changes nothing for growth, and no exercise runs to five sets in a row.
export const PLAN: Record<WorkoutType, PlanItem[]> = {
  UPPER: [
    { id: 'chest-press', sets: 3, reps: [6, 10], rir: '1–2', rest: 150 },
    { id: 'lat-pulldown', sets: 3, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'incline-db-press', sets: 2, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'low-cable-row', sets: 3, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'lateral-raise', sets: 3, reps: [12, 20], rir: '0–1', rest: 90, tag: 'priority', note: ['Haltères ou poulie.', 'Dumbbells or cable.'] },
    { id: 'triceps-overhead-rope', sets: 2, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'ez-curl', sets: 2, reps: [8, 12], rir: '0–1', rest: 90 },
    { id: 'dips', sets: 2, reps: [8, 12], rir: '1–2', rest: 90, note: ['Si les épaules sont OK, sinon pushdown corde.', 'If your shoulders are OK; otherwise rope pushdown.'] },
  ],
  LOWER: [
    { id: 'leg-press', sets: 3, reps: [8, 12], rir: '1–2', rest: 150, note: ['Amplitude profonde.', 'Deep range of motion.'] },
    { id: 'leg-curl', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'hip-thrust', sets: 3, reps: [8, 12], rir: '1–2', rest: 120, note: ['Machine ou barre.', 'Machine or barbell.'] },
    { id: 'leg-extension', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, note: ['Insister sur le bas du mouvement.', 'Focus on the bottom of the movement.'] },
    { id: 'calf-press', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'calves', note: ['Ou mollets debout. Pause 1–2 s en étirement.', 'Or standing calf raise. 1–2 s pause in the stretch.'] },
    { id: 'roman-chair-abs', sets: 4, reps: [10, 15], rir: '0–1', rest: 75, note: ['Ou crunch poulie.', 'Or cable crunch.'] },
  ],
  PUSH: [
    { id: 'incline-db-press', sets: 3, reps: [6, 10], rir: '1–2', rest: 150 },
    { id: 'shoulder-press-machine', sets: 2, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'pec-deck', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'priority', note: ['Ou écarté poulie. Étirement contrôlé.', 'Or cable fly. Controlled stretch.'] },
    { id: 'cable-lateral-raise', sets: 4, reps: [12, 20], rir: '0–1', rest: 90 },
    { id: 'reverse-pec-deck', sets: 3, reps: [12, 20], rir: '0–1', rest: 75 },
    { id: 'triceps-overhead-rope', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'triceps-rope', sets: 2, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'standing-calf-raise', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
  ],
  PULL: [
    { id: 'lat-pulldown', sets: 3, reps: [6, 10], rir: '1–2', rest: 150, note: ['Prise neutre ou large.', 'Neutral or wide grip.'] },
    { id: 'chest-supported-row', sets: 3, reps: [8, 12], rir: '1–2', rest: 120, tag: 'priority' },
    { id: 'cable-pullover', sets: 2, reps: [10, 15], rir: '0–1', rest: 90, note: ['Ou tirage unilatéral.', 'Or single-arm pulldown.'] },
    { id: 'reverse-pec-deck', sets: 4, reps: [12, 20], rir: '0–1', rest: 75, superset: true, note: ['En superset avec les élévations latérales.', 'Superset with the lateral raises.'] },
    { id: 'lateral-raise', sets: 3, reps: [12, 20], rir: '0–1', rest: 75 },
    { id: 'preacher-curl', sets: 3, reps: [8, 12], rir: '0–1', rest: 90, note: ['Ou curl haltères assis.', 'Or seated dumbbell curl.'] },
    { id: 'roman-chair-abs', sets: 3, reps: [10, 15], rir: '0–1', rest: 60 },
  ],
  LEGS: [
    { id: 'hack-squat', sets: 3, reps: [6, 10], rir: '1–2', rest: 150, note: ['Ou Smith squat, ou presse pieds bas.', 'Or Smith squat, or leg press with feet low.'] },
    { id: 'romanian-deadlift', sets: 3, reps: [8, 10], rir: '2', rest: 150 },
    { id: 'leg-extension', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'leg-curl', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, note: ['Assis, ou allongé pour varier.', 'Seated, or lying for variety.'] },
    { id: 'back-extension-45', sets: 2, reps: [10, 15], rir: '1', rest: 90, note: ['Orientée fessiers.', 'Glute-focused.'] },
    { id: 'standing-calf-raise', sets: 4, reps: [10, 15], rir: '0–1', rest: 90, tag: 'calves' },
    { id: 'roman-chair-abs', sets: 3, reps: [10, 15], rir: '0–1', rest: 60 },
  ],
}

/** Program note of an exercise in a gym session (the report's wording), in the current language. */
export function planNote(type: WorkoutType, exerciseId: string): string | undefined {
  const note = PLAN[type]?.find((p) => p.id === exerciseId)?.note
  if (note === undefined) return undefined
  return typeof note === 'string' ? note : L(note[0], note[1])
}

// ───────────────────────── Home training ─────────────────────────
// Each gym exercise of the report has home versions, best first; the first one the
// equipment allows is used. Body weight is always available; a slot with no possible
// version is dropped (the rest of the session keeps its volume).

export const HOME_SLOTS: Record<string, string[]> = {
  'chest-press': ['db-bench-press', 'db-floor-press', 'push-up'],
  'incline-db-press': ['incline-db-press', 'feet-elevated-push-up', 'push-up'],
  'pec-deck': ['db-fly', 'band-fly', 'push-up'],
  dips: ['close-grip-push-up', 'push-up'],
  'lat-pulldown': ['pull-up', 'band-pulldown', 'one-arm-db-row', 'inverted-row'],
  'low-cable-row': ['one-arm-db-row', 'band-row', 'inverted-row', 'doorframe-row'],
  'chest-supported-row': ['one-arm-db-row', 'band-row', 'inverted-row', 'doorframe-row'],
  'cable-pullover': ['db-pullover', 'band-straight-arm-pulldown'],
  'reverse-pec-deck': ['db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise'],
  'shoulder-press-machine': ['db-shoulder-press', 'pike-push-up'],
  'lateral-raise': ['lateral-raise', 'band-lateral-raise'],
  'cable-lateral-raise': ['lateral-raise', 'band-lateral-raise'],
  'triceps-overhead-rope': ['db-overhead-extension', 'band-overhead-extension', 'close-grip-push-up'],
  'triceps-rope': ['band-pushdown', 'db-skull-crusher', 'close-grip-push-up'],
  'ez-curl': ['db-curl', 'band-curl', 'chin-up'],
  'preacher-curl': ['incline-db-curl', 'db-curl', 'band-curl', 'chin-up'],
  'leg-press': ['goblet-squat', 'bulgarian-split-squat'],
  'hack-squat': ['bulgarian-split-squat', 'goblet-squat'],
  'leg-extension': ['sissy-squat'],
  'leg-curl': ['sliding-leg-curl', 'nordic-curl'],
  'romanian-deadlift': ['db-romanian-deadlift', 'single-leg-rdl'],
  'hip-thrust': ['db-hip-thrust', 'single-leg-hip-thrust'],
  'back-extension-45': ['single-leg-hip-thrust'],
  'calf-press': ['single-leg-calf-raise'],
  'standing-calf-raise': ['single-leg-calf-raise'],
  'roman-chair-abs': ['hanging-leg-raise', 'reverse-crunch', 'crunch'],
}

/** Whether the equipment allows an exercise (gym machines never do). */
export function doableAt(id: string, setup: TrainingSetup): boolean {
  if (setup.place === 'gym') return true
  const info = LIBRARY[id]
  if (!info?.requires) return false
  return info.requires.every((e) => setup.equipment.includes(e))
}

/** The report's session for a training setup: at home, each exercise becomes the best version the equipment allows. */
export function sessionItems(type: WorkoutType, setup: TrainingSetup = { place: 'gym', equipment: [] }): PlanItem[] {
  if (setup.place === 'gym') return PLAN[type]
  const used = new Set<string>()
  const out: (PlanItem & { from: string })[] = []
  for (const item of PLAN[type]) {
    const id = (HOME_SLOTS[item.id] ?? []).find((c) => !used.has(c) && doableAt(c, setup))
    if (!id) continue
    used.add(id)
    out.push({ ...item, id, from: item.id, reps: LIBRARY[id].reps ?? item.reps, note: undefined })
  }
  // A superset keeps its partner only if both exercises made it, one after the other.
  return out.map((item, i) => {
    const { from, ...rest } = item
    if (!item.superset) return rest
    const partner = PLAN[type][PLAN[type].findIndex((p) => p.id === from) + 1]?.id
    return out[i + 1]?.from === partner ? rest : { ...rest, superset: undefined }
  })
}

/** Original indices in program order; keep extra exercises and repeated occurrences stable. */
export function defaultExerciseOrder(type: WorkoutType, exercises: TemplateExercise[], setup?: TrainingSetup): number[] {
  const ranks = new Map(sessionItems(type, setup).map((item, index) => [item.id, index]))
  const groups: number[][] = []
  for (let index = 0; index < exercises.length; index++) {
    const group = [index]
    while (exercises[index].supersetWithNext && index + 1 < exercises.length) group.push(++index)
    // An alternative has no saved program slot. Preserve its current pairing
    // whether it replaces the head or partner, rather than changing rest.
    if (group.some(i => !ranks.has(exercises[i].exerciseId))) groups.push(group)
    else groups.push(...group.map(i => [i]))
  }
  return groups.sort((a, b) =>
    (ranks.get(exercises[a[0]].exerciseId) ?? ranks.size) - (ranks.get(exercises[b[0]].exerciseId) ?? ranks.size)).flat()
}

const SETUP_NOTE = /si[eè]ge|rep[eè]re|technogym|initial load|r[eé]glage|pieds|poign[ée]e|dossier/i

function lastWorkingWeight(workouts: Workout[], id: string): number | null {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const ex = workouts[i].exercises.find((e) => e.exerciseId === id && !e.skipped)
    const weights = ex?.sets.filter((s) => s.completed && typeof s.weight === 'number').map((s) => s.weight as number) ?? []
    if (weights.length) return Math.max(...weights)
  }
  return null
}

export function nextTargetText(ex: Pick<TemplateExercise, 'unit' | 'target'>): string {
  const { weight, sets, minReps, maxReps } = ex.target
  if (ex.unit !== 'PDC' && (weight === null || weight === undefined)) {
    return L(`Séance d’essai : trouve une charge pour ${minReps}–${maxReps} répétitions avec 3 répétitions en réserve.`, `Trial workout: find a load for ${minReps}–${maxReps} reps with 3 reps in reserve.`)
  }
  return L(`${fmtLoad(weight, ex.unit)} · viser ${sets} × ${minReps}–${maxReps} répétitions propres, puis augmenter.`, `${fmtLoad(weight, ex.unit)} · aim for ${sets} × ${minReps}–${maxReps} clean reps, then go heavier.`)
}

/** Builds the research program, carrying loads and machine-setup notes over from the previous templates. */
export function buildResearchTemplates(
  old?: Partial<Record<WorkoutType, Template>>,
  workouts: Workout[] = [],
  setup: TrainingSetup = { place: 'gym', equipment: [] },
): Record<WorkoutType, Template> {
  const out = {} as Record<WorkoutType, Template>
  const oldAll = Object.values(old ?? {}).flatMap((t) => t?.exercises ?? [])
  for (const type of ROTATION) {
    const exercises: TemplateExercise[] = sessionItems(type, setup).map((item) =>
      sheetExercise(item, old?.[type]?.exercises.find((e) => e.exerciseId === item.id) ?? oldAll.find((e) => e.exerciseId === item.id), workouts))
    out[type] = { type, label: TYPE_META[type].label, configured: true, exercises }
  }
  return out
}

/** A plan item as a line of a session sheet, with the load and the machine-setup note of the same exercise elsewhere. */
function sheetExercise(item: PlanItem, carried: TemplateExercise | undefined, workouts: Workout[]): TemplateExercise {
  const info = LIBRARY[item.id]
  const unit = info.unit
  const weight = unit === 'PDC' ? (takesLest({ exerciseId: item.id, unit }) ? carried?.target?.weight ?? null : null) : (carried?.target?.weight ?? lastWorkingWeight(workouts, item.id) ?? null)
  const technique = carried?.technique && SETUP_NOTE.test(carried.technique) ? carried.technique : undefined
  const ex: TemplateExercise = {
    exerciseId: item.id,
    name: info.name,
    muscle: info.muscle,
    unit,
    role: info.role,
    bodyweight: unit === 'PDC' || undefined,
    target: { weight, sets: item.sets, minReps: item.reps[0], maxReps: item.reps[1], restSeconds: item.rest, rir: item.rir },
    technique,
    note: item.note === undefined ? undefined : typeof item.note === 'string' ? item.note : L(item.note[0], item.note[1]),
    supersetWithNext: item.superset || undefined,
    volumeTag: item.tag,
  }
  ex.nextTarget = nextTargetText(ex)
  return ex
}

/** What a revision changed in the sheets: the sets an exercise went from and to, or a slot it added (from null). */
type SheetChange = { type: WorkoutType; id: string; from: number | null; to: number }
const REVISIONS: Record<number, SheetChange[]> = {
  // Abs, calves and rear delts to 10 weekly sets, on the two sessions they had (plus rear delts on Push).
  4: [
    { type: 'LOWER', id: 'calf-press', from: 3, to: 5 },
    { type: 'LOWER', id: 'roman-chair-abs', from: 3, to: 5 },
    { type: 'PUSH', id: 'reverse-pec-deck', from: null, to: 2 },
    { type: 'PULL', id: 'reverse-pec-deck', from: 3, to: 5 },
    { type: 'PULL', id: 'roman-chair-abs', from: 3, to: 5 },
    { type: 'LEGS', id: 'standing-calf-raise', from: 3, to: 5 },
  ],
  // The same 10 sets over three sessions: nothing at five sets in a row.
  5: [
    { type: 'LOWER', id: 'calf-press', from: 5, to: 3 },
    { type: 'LOWER', id: 'roman-chair-abs', from: 5, to: 4 },
    { type: 'PUSH', id: 'reverse-pec-deck', from: 2, to: 3 },
    { type: 'PULL', id: 'reverse-pec-deck', from: 5, to: 4 },
    { type: 'PULL', id: 'roman-chair-abs', from: 5, to: 3 },
    { type: 'LEGS', id: 'standing-calf-raise', from: 5, to: 4 },
    { type: 'PUSH', id: 'standing-calf-raise', from: null, to: 3 },
    { type: 'LEGS', id: 'roman-chair-abs', from: null, to: 3 },
  ],
}

/**
 * Brings sheets written by an earlier revision of the program to the current one, one revision
 * after the other, touching only what each changed: an exercise still at the sets the plan gave
 * it takes the new number (a number the lifter or the coach changed is left alone), and a new
 * slot is added where the plan puts it. Everything else — loads, notes, replaced exercises,
 * priorities — stays.
 */
export function upgradeSheets(
  templates: Record<WorkoutType, Template>,
  revision: number,
  setup: TrainingSetup = { place: 'gym', equipment: [] },
  workouts: Workout[] = [],
): Record<WorkoutType, Template> {
  const out = { ...templates }
  const all = Object.values(templates).flatMap((t) => t?.exercises ?? [])
  const changes = Object.entries(REVISIONS).filter(([n]) => Number(n) > revision).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([, list]) => list)
  for (const change of changes) {
    const tpl = out[change.type]
    const index = PLAN[change.type].findIndex((p) => p.id === change.id)
    const item = PLAN[change.type][index]
    if (!tpl || !item) continue
    // The gym exercise or any of its home versions.
    const ids = [change.id, ...(HOME_SLOTS[change.id] ?? [])]
    if (change.from !== null) {
      const at = tpl.exercises.findIndex((e) => ids.includes(e.exerciseId) && e.target.sets === change.from)
      if (at < 0) continue
      const ex = { ...tpl.exercises[at], target: { ...tpl.exercises[at].target, sets: change.to } }
      ex.nextTarget = nextTargetText(ex)
      out[change.type] = { ...tpl, exercises: tpl.exercises.map((e, i) => (i === at ? ex : e)) }
    } else {
      const id = setup.place === 'gym' ? change.id : (HOME_SLOTS[change.id] ?? []).find((c) => doableAt(c, setup) && !tpl.exercises.some((e) => e.exerciseId === c))
      if (!id || tpl.exercises.some((e) => ids.includes(e.exerciseId))) continue
      const ex = sheetExercise({ ...item, id, sets: change.to, ...(id === change.id ? {} : { reps: LIBRARY[id].reps ?? item.reps, note: undefined }) }, all.find((e) => e.exerciseId === id), workouts)
      const at = Math.min(index, tpl.exercises.length)
      out[change.type] = { ...tpl, exercises: [...tpl.exercises.slice(0, at), ex, ...tpl.exercises.slice(at)] }
    }
  }
  return out
}

// ───────────────────────── A week of sessions ─────────────────────────

/** What a week of `days` sessions looks like: sets and length of the sessions, share of the plan's weekly volume. */
export interface WeekShape {
  days: number
  /** Sets multiplier applied to each session. */
  factor: number
  /** Weekly sets against the plan at five days (1 = the plan). */
  share: number
  /** Fewest and most sets among the five sessions. */
  sets: [number, number]
  /** Shortest and longest session, in minutes. */
  minutes: [number, number]
}

/** The exercises of a session sheet as scaledSession() reads them. */
export function sessionSlots(exercises: TemplateExercise[]): SessionSlot[] {
  return exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, muscle: e.muscle, unit: e.unit, sets: e.target.sets }))
}

/** The sessions as weekShape() reads them: from the user's sheets… */
export function templateSets(templates: Record<WorkoutType, Template>): Record<WorkoutType, SessionSlot[]> {
  return Object.fromEntries(ROTATION.map((t) => [t, sessionSlots(templates[t]?.exercises ?? [])])) as Record<WorkoutType, SessionSlot[]>
}

/** …or from the report's plan, before the user has any. */
export function planSets(): Record<WorkoutType, SessionSlot[]> {
  return Object.fromEntries(ROTATION.map((t) => [t, PLAN[t].map((item) => ({ exerciseId: item.id, sets: item.sets }))])) as Record<WorkoutType, SessionSlot[]>
}

export function weekShape(sessions: Record<WorkoutType, SessionSlot[]> = planSets(), days: number = WEEK_DAYS, keep: boolean = KEEP_WEEKLY_VOLUME): WeekShape {
  const factor = daysFactorFor(days, keep)
  let base = 0
  let scaled = 0
  const sets: number[] = []
  const minutes: number[] = []
  for (const type of ROTATION) {
    const b = sessions[type].reduce((a, e) => a + e.sets, 0)
    const n = scaledSession(sessions[type], factor).reduce((a, x) => a + x, 0)
    base += b
    scaled += n
    sets.push(n)
    minutes.push(sessionMinutes(type, n))
  }
  return {
    days, factor,
    share: base ? (scaled * days) / (base * PLAN_DAYS) : 0,
    sets: [Math.min(...sets), Math.max(...sets)],
    minutes: [Math.min(...minutes), Math.max(...minutes)],
  }
}

// ───────────────────────── Calendar engine ─────────────────────────

/** Weekdays with a session (0 = Sunday), from the weekly schedule. */
export function trainingDays(state: Pick<AppState, 'schedule'>): number[] {
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => !!state.schedule[d])
  return days.length ? days : [0, 1, 2, 3, 4, 5, 6].filter((d) => !!DEFAULT_SCHEDULE[d])
}

/** Weekly schedule from the training days: the rotation laid on them, Monday first. */
export function scheduleFromDays(days: number[]): Record<number, WorkoutType | null> {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d))
  const out: Record<number, WorkoutType | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  order.forEach((d, i) => (out[d] = ROTATION[i % ROTATION.length]))
  return out
}

/** Longest stretch between two training days of the weekly schedule, in days (7 with a single day a week). */
export function scheduledGap(state: Pick<AppState, 'schedule'>): number {
  const days = trainingDays(state).sort((a, b) => a - b)
  return Math.max(...days.map((d, i) => ((days[(i + 1) % days.length] - d + 7) % 7) || 7))
}

export function nextInRotation(t: WorkoutType): WorkoutType {
  return ROTATION[(ROTATION.indexOf(t) + 1) % ROTATION.length]
}

/** Days covered by a pause (only pauses of 12 h or more count). */
export function pauseDays(state: Pick<AppState, 'programPause'>, until: ISODate = todayISO()): Set<ISODate> {
  const days = new Set<ISODate>()
  const add = (from: string, to: string) => {
    if (new Date(to).getTime() - new Date(from).getTime() < 12 * 3600_000) return
    let d = isoFromTimestamp(from)
    const end = isoFromTimestamp(to)
    for (let i = 0; d <= end && i < 400; i++) {
      days.add(d)
      d = addDays(d, 1)
    }
  }
  for (const h of state.programPause.history) add(h.startedAt, h.endedAt)
  const p = state.programPause
  if (p.active && p.startedAt) {
    const end = p.plannedEnd && p.plannedEnd > until ? p.plannedEnd : until
    add(p.startedAt, new Date(`${end}T23:59:00`).toISOString())
  }
  return days
}

/** Recorded pause days plus the current pause, effective immediately and into its planned future. */
export function isPausedDay(state: Pick<AppState, 'programPause'>, date: ISODate, today: ISODate = todayISO()): boolean {
  if (pauseDays(state, today).has(date)) return true
  const pause = state.programPause
  return date >= today && pause.active
    && (!pause.startedAt || date >= isoFromTimestamp(pause.startedAt))
    && (!pause.plannedEnd || date <= pause.plannedEnd || date === today)
}

export interface WeekSchedule {
  monday: ISODate
  target: number
  completed: number
  active: number
  /** Actual future slots from the saved schedule, never changed silently by the suggestion. */
  planned: ISODate[]
  rest: ISODate[]
  /** Future slots suggested to stay within the weekly target, pending the user's choice. */
  suggested: ISODate[]
  /** Planned dates the suggestion would free for recovery; not yet actual rest days. */
  adaptedRest: ISODate[]
  customized: boolean
}

/** A correction already counts in history; only an additional session consumes another slot. */
function additionalActive(state: Pick<AppState, 'activeWorkout' | 'workouts'>): AppState['activeWorkout'] {
  const active = state.activeWorkout
  return active && !active.reopened && !state.workouts.some((w) => w.id === active.id) ? active : null
}

function scheduledWeek(state: AppState, weekDate: ISODate, today: ISODate, end: ISODate | null, projectTentativePause = false): WeekSchedule {
  const monday = mondayOf(weekDate)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = dates[6]
  const override = state.weekSchedules?.[monday]
  const customized = !!override && Array.isArray(override.days)
  const days = customized
    ? [...new Set(override.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : trainingDays(state)
  const target = customized && Number.isInteger(override.target) && override.target >= 0 ? override.target : days.length
  const workouts = state.workouts.filter((w) => w.date >= monday && w.date <= sunday)
  const completed = new Set(workouts.map((w) => w.id)).size
  const running = additionalActive(state)
  const active = running && running.date >= monday && running.date <= sunday ? 1 : 0
  const occupied = new Set(workouts.map((w) => w.date))
  if (running) occupied.add(running.date)
  const eligible = dates.filter((date) => {
    if (date < today || date < PROGRAM_START || (end && date > end) || occupied.has(date)) return false
    if (!isPausedDay(state, date, today)) return true
    // Keep the existing tentative outlook during an open-ended pause. These are
    // projections only: the public week summary never labels paused days as rest.
    return projectTentativePause && state.programPause.active && !state.programPause.plannedEnd && date > today
  })
  const planned = eligible.filter((date) => days.includes(weekday(date)))
  const rest = eligible.filter((date) => !days.includes(weekday(date)))
  const remaining = Math.max(0, target - completed - active)
  const excess = Math.max(0, planned.length - remaining)
  return {
    monday, target, completed, active, planned, rest,
    suggested: planned.slice(excess), adaptedRest: planned.slice(0, excess), customized,
  }
}

/** This week's saved choices and optional recovery suggestion. Past days and the program itself never move. */
export function weekSchedule(state: AppState, weekDate: ISODate, today: ISODate = todayISO()): WeekSchedule {
  return scheduledWeek(state, weekDate, today, MAINTENANCE ? null : GOAL_DATE)
}

/** A scheduled recovery day, not a suggestion, unlogged past workout or day outside the plan. */
export function isRestDay(state: AppState, date: ISODate, today: ISODate = todayISO()): boolean {
  return weekSchedule(state, date, today).rest.includes(date)
}

export interface PlannedSession {
  date: ISODate
  type: WorkoutType
  tentative: boolean
}

/** Rotation laid on the weekly schedule. A missed session shifts the rotation, it is never skipped. */
export function projectSessions(state: AppState, to: ISODate = GOAL_DATE, from: ISODate = todayISO()): PlannedSession[] {
  const out: PlannedSession[] = []
  const start = from < PROGRAM_START ? PROGRAM_START : from
  let type = state.nextWorkoutType
  const active = additionalActive(state)
  if (active) type = nextInRotation(active.type)
  // `to` is also used to preview a new goal date in GoalSheet. Keep that explicit
  // horizon while ordinary calendar callers pass the current plan's GOAL_DATE.
  for (let monday = mondayOf(start), i = 0; monday <= to && i < 72; monday = addDays(monday, 7), i++) {
    const week = scheduledWeek(state, monday, start, to, true)
    for (const date of week.planned) {
      const tentative = state.programPause.active && !state.programPause.plannedEnd && isPausedDay(state, date, from)
      out.push({ date, type, tentative })
      type = nextInRotation(type)
    }
  }
  return out
}

export interface CalendarCell {
  date: ISODate
  inMonth: boolean
  isToday: boolean
  done: { id: string; type: WorkoutType }[]
  planned: PlannedSession | null
  active: boolean
  paused: boolean
  rest: boolean
  isGoal: boolean
  isStart: boolean
}

export interface CalendarWeek {
  monday: ISODate
  caption: string
  kind: PeriodKind | 'none'
  cells: CalendarCell[]
}

export function calendarMonth(state: AppState, month: string, planned: PlannedSession[], today: ISODate = todayISO()): CalendarWeek[] {
  const first = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const last = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const byDate = new Map<ISODate, { id: string; type: WorkoutType }[]>()
  for (const w of state.workouts) {
    const list = byDate.get(w.date) ?? []
    list.push({ id: w.id, type: w.type })
    byDate.set(w.date, list)
  }
  const plannedBy = new Map(planned.map((p) => [p.date, p]))
  const weeks: CalendarWeek[] = []
  for (let monday = mondayOf(first); monday <= last; monday = addDays(monday, 7)) {
    const mid = addDays(monday, 3)
    const ctx = contextAt(monday < first ? first : mid)
    const period = ctx.period
    let caption = ''
    if (period) {
      caption = period.kind === 'block' ? L(`${period.label} · S${weekIn(period, mid)}`, `${period.label} · W${weekIn(period, mid)}`) : period.label
    } else if (mid > GOAL_DATE && !MAINTENANCE) caption = L('Après l’objectif', 'After the goal')
    const cells: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i)
      cells.push({
        date,
        inMonth: date >= first && date <= last,
        isToday: date === today,
        done: byDate.get(date) ?? [],
        planned: plannedBy.get(date) ?? null,
        active: !!state.activeWorkout && state.activeWorkout.date === date,
        paused: isPausedDay(state, date, today),
        rest: isRestDay(state, date, today),
        isGoal: !MAINTENANCE && date === GOAL_DATE,
        isStart: date === PROGRAM_START,
      })
    }
    weeks.push({ monday, caption, kind: period?.kind ?? 'none', cells })
  }
  return weeks
}

export interface Milestone {
  date: ISODate
  title: string
  detail: string
  kind: PeriodKind | 'goal' | 'phase'
}

export function milestones(from: ISODate = todayISO()): Milestone[] {
  const out: Milestone[] = []
  const firstBlock = PERIODS.find((p) => p.kind === 'block')
  const firstCut = PERIODS.find((p) => p.kind === 'block' && (p.phase === 'cut' || p.phase === 'cut-end'))
  for (const p of PERIODS) {
    if (p.start < from || p.kind === 'pre') continue
    const title = p === firstBlock ? L('Début du programme', 'Program start') : p === firstCut ? L('Début de la sèche', 'Cut start') : p.label
    const milestone = p === firstBlock || p === firstCut || p.kind === 'stabilization' || p.kind === 'holiday'
    out.push({ date: p.start, title, detail: p.note, kind: milestone ? 'phase' : p.kind })
  }
  if (!MAINTENANCE && GOAL_DATE >= from) out.push({ date: GOAL_DATE, title: L('Objectif', 'Goal'), detail: L('Fin du programme.', 'End of the program.'), kind: 'goal' })
  return out
}

/** Periods that deserve a calendar alert: program start, cut start, holidays, stabilization. */
export function keyPeriods(): { period: Period; title: string }[] {
  const firstBlock = PERIODS.find((p) => p.kind === 'block')
  const firstCut = PERIODS.find((p) => p.kind === 'block' && (p.phase === 'cut' || p.phase === 'cut-end'))
  return PERIODS.filter((p) => p === firstBlock || p === firstCut || p.kind === 'holiday' || p.kind === 'stabilization').map((p) => ({
    period: p,
    title: p === firstBlock ? L('Début du programme', 'Program start') : p === firstCut ? L('Début de la sèche', 'Cut start') : p.label,
  }))
}

// ───────────────────────── Sessions to the goal ─────────────────────────

export interface PlanSegment {
  id: string
  label: string
  kind: PeriodKind
  phase: PhaseId
  done: number
  planned: number
}

export interface SessionPlan {
  done: number
  planned: number
  total: number
  segments: PlanSegment[]
  /** Maintenance mode: the plan counts the current cycle only (a block and its deload, or the holidays). */
  cycle?: { start: ISODate; end: ISODate; label: string }
}

/** Maintenance mode: the cycle around a date — a block with the deload that follows it, or the holidays. */
export function cycleAt(date: ISODate): Period[] {
  const list = PERIODS.filter((p) => p.kind !== 'pre')
  if (!list.length) return []
  let i = list.findIndex((p) => date <= p.end)
  if (i < 0) i = list.length - 1
  const p = list[i]
  if (p.kind === 'deload' && list[i - 1]?.kind === 'block') return [list[i - 1], p]
  if (p.kind === 'block' && list[i + 1]?.kind === 'deload') return [p, list[i + 1]]
  return [p]
}

/**
 * Sessions done since the start plus the sessions planned until the goal date, grouped by period.
 * In maintenance mode there is no goal: the same count over the current cycle.
 */
export function sessionPlan(state: AppState, today: ISODate = todayISO()): SessionPlan {
  const cycle = MAINTENANCE ? cycleAt(today) : []
  const from = cycle.length ? cycle[0].start : null
  const to = cycle.length ? cycle[cycle.length - 1].end : GOAL_DATE
  const periods = cycle.length ? cycle : PERIODS
  const inPlan = (date: ISODate) => !from || (date >= from && date <= to)
  const planned = projectSessions(state, to, today)
  const segs = new Map<string, PlanSegment>(periods.map((p) => [p.id, { id: p.id, label: p.label, kind: p.kind, phase: p.phase, done: 0, planned: 0 }]))
  const bucket = (date: ISODate) => segs.get((periodAt(date) ?? (date < periods[0].start ? periods[0] : periods[periods.length - 1])).id)!
  const workouts = state.workouts.filter((w) => inPlan(w.date))
  const running = additionalActive(state)
  const active = running && inPlan(running.date) ? running : null
  for (const w of workouts) bucket(w.date).done++
  for (const p of planned) bucket(p.date).planned++
  if (active) bucket(active.date).planned++
  const segments = [...segs.values()].filter((s) => s.done + s.planned > 0)
  const done = workouts.length
  const plannedCount = planned.length + (active ? 1 : 0)
  return {
    done, planned: plannedCount, total: done + plannedCount, segments,
    ...(from ? { cycle: { start: from, end: to, label: cycle[0].label } } : {}),
  }
}

// ───────────────────────── Pauses & re-entry ─────────────────────────

/** Re-entry rules after a break (report: Ogasawara 2013, Coleman 2024; thresholds are expert opinion). */
export function reentryForGap(days: number): ReentryInfo | null {
  if (days < 7) return null
  if (days <= 13) {
    return {
      sessionsLeft: 2, days, setsFactor: 1, loadFactor: 0.925, rir: '2–3', label: L(`Reprise après ${days} j`, `Return after ${days} days`),
      advice: L('Charges −5 à −10\u00a0% et 2–3 répétitions en réserve pendant 2 séances, puis retour au bloc en cours.', 'Loads −5 to −10% and 2–3 reps in reserve for 2 workouts, then back to the current block.'),
    }
  }
  if (days <= 21) {
    return {
      sessionsLeft: 5, days, setsFactor: 0.7, loadFactor: 1, rir: '3', label: L(`Reprise après ${days} j`, `Return after ${days} days`),
      advice: L('Une semaine comme une semaine 1 : 3 répétitions en réserve, −30\u00a0% de séries.', 'One week run like week 1: 3 reps in reserve, sets −30%.'),
    }
  }
  return {
    sessionsLeft: 10, days, setsFactor: 0.7, loadFactor: 0.9, rir: '3', label: L(`Remise en route (${days} j)`, `Restart (${days} days)`),
    advice: L('Deux semaines de remise en route : 3 répétitions en réserve, −30\u00a0% de séries, charges −10\u00a0%.', 'Two restart weeks: 3 reps in reserve, sets −30%, loads −10%.'),
  }
}

export function lastTrainingDate(state: Pick<AppState, 'workouts'>): ISODate | null {
  return state.workouts.length ? state.workouts[state.workouts.length - 1].date : null
}

export function gapSinceLastSession(state: Pick<AppState, 'workouts'>, today: ISODate = todayISO()): number {
  const last = lastTrainingDate(state)
  return last ? diffDays(last, today) : 0
}

export function programDayCount(today: ISODate = todayISO()) {
  const total = diffDays(FOUNDATION_START, GOAL_DATE)
  const elapsed = Math.min(total, Math.max(0, diffDays(FOUNDATION_START, today)))
  return { total, elapsed, left: Math.max(0, diffDays(today, GOAL_DATE)) }
}

export function periodRangeLabel(p: Period): string {
  return `${fmtDate(p.start)} – ${fmtDate(p.end)}`
}
