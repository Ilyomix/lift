// The research-based program (report of 26 Sept 2026) and its calendar engine.
import { addDays, diffDays, mondayOf, shiftMonths, todayISO, weekday, isoFromTimestamp, fmtDate } from './date'
import { fmtLoad, roundTo } from './format'
import { loadAt } from './gyms'
import { LIBRARY } from './library'
import { L, lang } from './i18n'
import type {
  AppState, ISODate, Prescription, ReentryInfo, Template, TemplateExercise, TrainingSetup, Workout, WorkoutType,
} from './types'

export const PROGRAM_ID = 'golgoth-research-2026'
export const PROGRAM_REVISION = 3
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
  LOWER: { label: 'Lower', get fr() { return L('Bas du corps', 'Lower body') }, code: 'LO', minutes: 60 },
  PUSH: { label: 'Push', get fr() { return L('Poussée', 'Push') }, code: 'PS', minutes: 60 },
  PULL: { label: 'Pull', get fr() { return L('Tirage', 'Pull') }, code: 'PL', minutes: 65 },
  LEGS: { label: 'Legs', get fr() { return L('Jambes', 'Legs') }, code: 'LG', minutes: 60 },
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
    get nutrition() { return L('Ancien programme : baselines et apprentissage technique.', 'Previous program: baselines and technique learning.') },
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
    get label() { return L('Fêtes · Maintenance', 'Holidays · Maintenance') },
    short: 'Maintenance',
    get nutrition() { return L('Calories à maintenance, 3–4 séances allégées.', 'Maintenance calories, 3–4 lighter sessions.') },
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
    get nutrition() { return L('Une semaine à maintenance : récupération physique et mentale.', 'One week at maintenance: physical and mental recovery.') },
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
    get nutrition() { return L('Remonter progressivement à maintenance. Le look final est atteint ici.', 'Ease back up to maintenance. The final look is reached here.') },
    weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190,
  },
  // Maintenance mode: no goal date, the blocks repeat with no cut and no end.
  upkeep: {
    id: 'upkeep',
    get label() { return L('Entretien', 'Maintenance') },
    get short() { return L('Entretien', 'Maintenance') },
    get nutrition() { return L('Calories à maintenance : poids stable (±0,1 %/sem), les charges continuent de progresser.', 'Maintenance calories: stable weight (±0.1%/wk), loads keep progressing.') },
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
      ? L('Début de la sèche. Volume du bloc précédent maintenu, mollets à 8 séries.', 'Start of the cut. Volume of the previous block kept, calves at 8 sets.')
      : i === 1
        ? L('Garder les charges : c’est le signal principal de préservation musculaire.', 'Keep your loads: it’s the main signal that muscle is being preserved.')
        : L('Si la récupération baisse : −20 % de volume, intensité maintenue.', 'If recovery drops: −20% volume, intensity kept.')
  })
  const last = cut[cut.length - 1]
  if (last && cut.length > 1) {
    last.phase = 'cut-end'
    last.volumeFactor = 0.8
    last.fixedRir = '1–2'
    last.note = L('Volume ~80 % du bloc précédent, RIR 1–2.', 'Volume ~80% of the previous block, RIR 1–2.')
  }
  noteDeloads(out)
  const cutDeloads = out.filter((p) => p.kind === 'deload' && p.phase === 'cut')
  if (cut.length && cutDeloads.length) {
    const mid = diffDays(cut[0].start, (last ?? cut[0]).end) / 2
    const pick = cutDeloads.reduce((a, b) => (Math.abs(diffDays(cut[0].start, b.start) - mid) < Math.abs(diffDays(cut[0].start, a.start) - mid) ? b : a))
    pick.phase = 'diet-break'
    pick.label = L('Décharge + pause diététique', 'Deload + diet break')
    pick.note = L('Calories à maintenance, moitié des séries.', 'Maintenance calories, half the sets.')
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
    out.push({ id: 'fondation', label: L('Fondation', 'Foundation'), short: 'F', kind: 'pre', phase: 'foundation', start: foundation, end: addDays(start, -1), note: L('Ancien programme : baselines et technique.', 'Previous program: baselines and technique.') })
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
        out.push({ id: `d${n}`, label: L('Décharge', 'Deload'), short: 'D', kind: 'deload', phase: id, start: d, end: addDays(d, 6), note: '' })
        d = addDays(d, 7)
      }
    }
  }
  const end = addDays(start, weeks * 7 - 1)
  let cursor = start
  for (const w of christmasWindows(start, end)) {
    if (w.start > cursor) segment(cursor, Math.round(diffDays(cursor, w.start) / 7))
    out.push({ id: `fetes-${w.start.slice(0, 4)}`, label: L('Fêtes', 'Holidays'), short: L('F', 'H'), kind: 'holiday', phase: 'maintenance', start: w.start, end: w.end, volumeFactor: 0.67, note: L('3–4 séances à volume réduit. Une pause ici suit la règle de reprise.', '3–4 sessions at reduced volume. A break here follows the return rule.') })
    cursor = addDays(w.end, 1)
  }
  if (cursor <= end) segment(cursor, Math.round((diffDays(cursor, end) + 1) / 7))
}

/** Building blocks (recomposition, maintenance): the first one learns the split, the next ones add the priority set from W3. */
function noteBuildBlocks(blocks: Period[]) {
  blocks.forEach((p, i) => {
    if (i === 0) p.note = L('Nouveau split. Apprentissage du soulevé de terre roumain et du hip thrust.', 'New split. Learning the Romanian deadlift and the hip thrust.')
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
      ? L('Mêmes exercices, moitié des séries, charges −10 %, RIR 3–4.', 'Same exercises, half the sets, loads −10%, RIR 3–4.')
      : L('Moitié des séries, déficit maintenu.', 'Half the sets, deficit kept.')
  }
}

/** A goal at least 8 weeks and at most 5 years after the program start. */
export function isValidGoal(goal: unknown, start: ISODate = PROGRAM_START): goal is ISODate {
  return typeof goal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(goal) && goal >= addDays(start, MIN_PLAN_WEEKS * 7) && goal <= addDays(start, 5 * 365)
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
  origin: { start?: ISODate | null; foundation?: ISODate | null; maintenance?: boolean; today?: ISODate } = { start: REPORT_START, foundation: REPORT_FOUNDATION },
): void {
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
      date, period, phase, week, weeks, deload: true, title: L('Décharge anticipée', 'Early deload'),
      effort: L('RIR 3–4 · séries ÷ 2', 'RIR 3–4 · sets ÷ 2'),
      effortDetail: L('Décharge avancée après une baisse générale des performances.', 'Deload brought forward after a general drop in performance.'),
      before: false, after: false,
    }
  }
  return {
    date, period, phase, week, weeks, deload: period.kind === 'deload', title,
    effort: effort.short, effortDetail: effort.detail, before: false, after: false,
  }
}

function weekEffort(p: Period, week: number): { short: string; detail: string } {
  if (p.kind === 'deload') return { short: L('RIR 3–4 · séries ÷ 2', 'RIR 3–4 · sets ÷ 2'), detail: L('Semaine de décharge : mêmes exercices, moitié des séries, charges −10 %.', 'Deload week: same exercises, half the sets, loads −10%.') }
  if (p.kind === 'holiday') return { short: L('RIR 2–3 · volume réduit', 'RIR 2–3 · reduced volume'), detail: L('3–4 séances à volume réduit pendant les fêtes.', '3–4 sessions at reduced volume over the holidays.') }
  if (p.kind === 'stabilization') return { short: L('RIR 1–2 · volume −30 %', 'RIR 1–2 · volume −30%'), detail: L('Charges maintenues, volume réduit de 30 %.', 'Loads kept, volume reduced by 30%.') }
  if (p.kind === 'pre') return { short: 'Baselines', detail: L('Ancien programme.', 'Previous program.') }
  if (p.fixedRir) return { short: L(`RIR ${p.fixedRir} · volume 80 %`, `RIR ${p.fixedRir} · volume 80%`), detail: L('Fin de sèche : volume ~80 % du bloc précédent.', 'End of cut: volume ~80% of the previous block.') }
  const weeks = periodWeeks(p)
  if (week === 1) return { short: L('RIR 3 · réintroduction', 'RIR 3 · ramp-up'), detail: L('Semaine 1 du bloc : on garde 3 répétitions en réserve.', 'Week 1 of the block: keep 3 reps in reserve.') }
  if (week === 2) return { short: 'RIR 2', detail: L('Semaine 2 : 2 répétitions en réserve.', 'Week 2: 2 reps in reserve.') }
  if (week >= weeks) return { short: L('RIR 0–1 · dernière semaine', 'RIR 0–1 · last week'), detail: L('Dernière série d’isolation jusqu’à l’échec technique.', 'Last isolation set to technical failure.') }
  return { short: 'RIR 1–2 / 0–1', detail: L('RIR 1–2 en polyarticulaire, 0–1 en isolation.', 'RIR 1–2 on compound lifts, 0–1 on isolation.') }
}

/** Effort target for one exercise on a given date. */
export function effortFor(ex: TemplateExercise, ctx: ProgramContext): string {
  const base = ex.target.rir ?? (ex.role === 'compound' ? '1–2' : '0–1')
  const p = ctx.period
  if (ctx.deload) return '3–4'
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
export const SET_DROP_REASON: [string, string] = ['baisse 2 séances de suite', 'down 2 sessions in a row']

/** An automatic set change stays active until the end of the period in which it was made. */
export function autoAdjustActive(ex: Pick<TemplateExercise, 'autoAdjust'>, date: ISODate): boolean {
  const a = ex.autoAdjust
  if (!a || date < a.since) return false
  const p = periodAt(a.since)
  return !!p && date <= p.end
}

/**
 * Sets, reps, effort and load for one exercise on a given date, all program rules applied.
 * With a gym, the load is the one of that gym (machines differ between gyms).
 * With the session history, the priority set of a building block waits for rising performance
 * (judged as of `today`: a block that has not reached that point keeps the planned set).
 */
export function prescribe(ex: TemplateExercise, date: ISODate, reentry: ReentryInfo | null, gymId?: string, workouts?: Workout[], today: ISODate = todayISO()): Prescription {
  const ctx = contextAt(date)
  const p = ctx.period
  const notes: string[] = []
  let sets = ex.target.sets
  if (p && (ex.volumeTag === 'priority' || ex.focus) && p.priorityFromWeek && ctx.week >= p.priorityFromWeek) {
    if (!p.priorityIfRising || !workouts || risingIn(p, workouts, ex.exerciseId, today)) {
      sets += 1
      notes.push(ex.focus ? L('+1 série (zone prioritaire)', '+1 set (priority area)') : L('+1 série (muscle prioritaire)', '+1 set (priority muscle)'))
    } else {
      notes.push(L('Série prioritaire en attente : pas de progression en début de bloc', 'Priority set on hold: no progress early in the block'))
    }
  }
  if (p?.calves && ex.volumeTag === 'calves') {
    sets += 1
    notes.push(L('+1 série (mollets à 8/semaine)', '+1 set (calves at 8/week)'))
  }
  if (autoAdjustActive(ex, date) && ex.autoAdjust) {
    sets = Math.max(1, sets + ex.autoAdjust.sets)
    const sign = ex.autoAdjust.sets > 0 ? '+' : '−'
    const n = Math.abs(ex.autoAdjust.sets)
    const reason = SET_DROP_REASON.includes(ex.autoAdjust.reason) ? L(...SET_DROP_REASON) : ex.autoAdjust.reason
    notes.push(L(`${sign}${n} série (${reason})`, `${sign}${n} ${n === 1 ? 'set' : 'sets'} (${reason})`))
  }
  if (p?.volumeFactor) sets = Math.max(1, Math.round(sets * p.volumeFactor))
  let loadFactor = 1
  let rir = effortFor(ex, ctx)
  if (ctx.deload) {
    sets = Math.max(1, Math.ceil(ex.target.sets / 2))
    loadFactor = 0.9
    notes.push(L('Décharge : moitié des séries, −10 %', 'Deload: half the sets, −10%'))
  }
  if (reentry && reentry.sessionsLeft > 0) {
    sets = Math.max(1, Math.round(sets * reentry.setsFactor))
    loadFactor = Math.min(loadFactor, reentry.loadFactor)
    rir = reentry.rir
    notes.push(reentry.label)
  }
  const inc = incrementFor(ex)
  const base = gymId === undefined ? (ex.target.weight ?? null) : loadAt(ex, gymId)
  const weight =
    base === null
      ? null
      : loadFactor < 1 && inc > 0
        ? Math.max(inc, roundTo(base * loadFactor, inc))
        : base
  return {
    sets, minReps: ex.target.minReps, maxReps: ex.target.maxReps, rir,
    restSeconds: ex.target.restSeconds, weight, loadFactor, notes,
  }
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
    { id: 'roman-chair-abs', sets: 3, reps: [10, 15], rir: '0–1', rest: 75, note: ['Ou crunch poulie.', 'Or cable crunch.'] },
  ],
  PUSH: [
    { id: 'incline-db-press', sets: 3, reps: [6, 10], rir: '1–2', rest: 150 },
    { id: 'shoulder-press-machine', sets: 2, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'pec-deck', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'priority', note: ['Ou écarté poulie. Étirement contrôlé.', 'Or cable fly. Controlled stretch.'] },
    { id: 'cable-lateral-raise', sets: 4, reps: [12, 20], rir: '0–1', rest: 90 },
    { id: 'triceps-overhead-rope', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'triceps-rope', sets: 2, reps: [10, 15], rir: '0–1', rest: 90 },
  ],
  PULL: [
    { id: 'lat-pulldown', sets: 3, reps: [6, 10], rir: '1–2', rest: 150, note: ['Prise neutre ou large.', 'Neutral or wide grip.'] },
    { id: 'chest-supported-row', sets: 3, reps: [8, 12], rir: '1–2', rest: 120, tag: 'priority' },
    { id: 'cable-pullover', sets: 2, reps: [10, 15], rir: '0–1', rest: 90, note: ['Ou tirage unilatéral.', 'Or single-arm pulldown.'] },
    { id: 'reverse-pec-deck', sets: 3, reps: [12, 20], rir: '0–1', rest: 75, superset: true, note: ['En superset avec les élévations latérales.', 'Superset with the lateral raises.'] },
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
    { id: 'standing-calf-raise', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'calves' },
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
    return L(`Séance d’essai : trouve une charge pour ${minReps}–${maxReps} reps à RIR 3.`, `Trial session: find a load for ${minReps}–${maxReps} reps at RIR 3.`)
  }
  return L(`${fmtLoad(weight, ex.unit)} · viser ${sets} × ${minReps}–${maxReps} propres, puis augmenter.`, `${fmtLoad(weight, ex.unit)} · aim for ${sets} × ${minReps}–${maxReps} clean reps, then go heavier.`)
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
    const exercises: TemplateExercise[] = sessionItems(type, setup).map((item) => {
      const info = LIBRARY[item.id]
      const carried = old?.[type]?.exercises.find((e) => e.exerciseId === item.id) ?? oldAll.find((e) => e.exerciseId === item.id)
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
    })
    out[type] = { type, label: TYPE_META[type].label, configured: true, exercises }
  }
  return out
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

export interface PlannedSession {
  date: ISODate
  type: WorkoutType
  tentative: boolean
}

/** Rotation laid on the weekly schedule. A missed session shifts the rotation, it is never skipped. */
export function projectSessions(state: AppState, to: ISODate = GOAL_DATE, from: ISODate = todayISO()): PlannedSession[] {
  const out: PlannedSession[] = []
  let start = from < PROGRAM_START ? PROGRAM_START : from
  if (state.workouts.some((w) => w.date === start) || state.activeWorkout?.date === start) start = addDays(start, 1)
  let tentative = false
  const pause = state.programPause
  if (pause.active) {
    if (pause.plannedEnd && pause.plannedEnd >= start) start = addDays(pause.plannedEnd, 1)
    else if (!pause.plannedEnd) {
      tentative = true
      if (start <= from) start = addDays(from, 1)
    }
  }
  let type = state.nextWorkoutType
  if (state.activeWorkout) type = nextInRotation(state.activeWorkout.type)
  const training = Object.values(state.schedule).some(Boolean) ? state.schedule : DEFAULT_SCHEDULE
  for (let d = start, i = 0; d <= to && i < 500; d = addDays(d, 1), i++) {
    if (!training[weekday(d)]) continue
    out.push({ date: d, type, tentative })
    type = nextInRotation(type)
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
  const paused = pauseDays(state, today)
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
        paused: paused.has(date),
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
  const active = state.activeWorkout && inPlan(state.activeWorkout.date) ? state.activeWorkout : null
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
      advice: L('Charges −5 à −10\u00a0% et RIR\u00a02–\u20603 pendant 2 séances, puis retour au bloc en cours.', 'Loads −5 to −10% and RIR\u00a02–\u20603 for 2 sessions, then back to the current block.'),
    }
  }
  if (days <= 21) {
    return {
      sessionsLeft: 5, days, setsFactor: 0.7, loadFactor: 1, rir: '3', label: L(`Reprise après ${days} j`, `Return after ${days} days`),
      advice: L('Une semaine comme une semaine 1 : RIR\u00a03, −30\u00a0% de séries. Les gains reviennent vite.', 'One week run like week 1: RIR\u00a03, sets −30%. Gains come back quickly.'),
    }
  }
  return {
    sessionsLeft: 10, days, setsFactor: 0.7, loadFactor: 0.9, rir: '3', label: L(`Remise en route (${days} j)`, `Restart (${days} days)`),
    advice: L('Deux semaines de remise en route : RIR\u00a03, −30\u00a0% de séries, charges −10\u00a0%.', 'Two restart weeks: RIR\u00a03, sets −30%, loads −10%.'),
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
