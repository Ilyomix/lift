// The research-based program (report of 26 Sept 2026) and its calendar engine.
import { addDays, diffDays, mondayOf, todayISO, weekday, isoFromTimestamp, fmtDate } from './date'
import { fmtLoad, roundTo } from './format'
import { LIBRARY } from './library'
import type {
  AppState, ISODate, Prescription, ReentryInfo, Template, TemplateExercise, Workout, WorkoutType,
} from './types'

export const PROGRAM_ID = 'golgoth-research-2026'
export const PROGRAM_REVISION = 3
export const FOUNDATION_START: ISODate = '2026-08-10'
export const PROGRAM_START: ISODate = '2026-09-28'
export const GOAL_DATE: ISODate = '2027-06-30'
export const TOTAL_SESSIONS = 220
export const ROTATION: WorkoutType[] = ['UPPER', 'LOWER', 'PUSH', 'PULL', 'LEGS']

export const TYPE_META: Record<WorkoutType, { label: string; fr: string; code: string; minutes: number }> = {
  UPPER: { label: 'Upper', fr: 'Haut du corps', code: 'UP', minutes: 65 },
  LOWER: { label: 'Lower', fr: 'Bas du corps', code: 'LO', minutes: 60 },
  PUSH: { label: 'Push', fr: 'Poussée', code: 'PS', minutes: 60 },
  PULL: { label: 'Pull', fr: 'Tirage', code: 'PL', minutes: 65 },
  LEGS: { label: 'Legs', fr: 'Jambes', code: 'LG', minutes: 60 },
}

/** Mon UPPER · Tue LOWER · Wed rest · Thu PUSH · Fri PULL · Sat LEGS · Sun rest */
export const DEFAULT_SCHEDULE: Record<number, WorkoutType | null> = {
  0: null, 1: 'UPPER', 2: 'LOWER', 3: null, 4: 'PUSH', 5: 'PULL', 6: 'LEGS',
}

// ───────────────────────── Phases & periods ─────────────────────────

export type PhaseId = 'foundation' | 'recomp' | 'maintenance' | 'cut' | 'diet-break' | 'cut-end' | 'stabilization'
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

export const PHASES: Record<PhaseId, Phase> = {
  foundation: { id: 'foundation', label: 'Fondation', short: 'Fondation', nutrition: 'Ancien programme : baselines et apprentissage technique.', weeklyRate: null, proteinMin: 180, proteinMax: 190 },
  recomp: { id: 'recomp', label: 'Phase 1 · Recomposition', short: 'Recomposition', nutrition: 'Poids stable à −0,25 %/sem · ~2 350 kcal à ajuster selon ta moyenne 7 jours.', weeklyRate: [-0.25, 0], proteinMin: 180, proteinMax: 190 },
  maintenance: { id: 'maintenance', label: 'Fêtes · Maintenance', short: 'Maintenance', nutrition: 'Calories à maintenance, 3–4 séances allégées.', weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190 },
  cut: { id: 'cut', label: 'Phase 2 · Sèche', short: 'Sèche', nutrition: '−0,5 à −0,7 %/sem · déficit ≤ 500 kcal/j.', weeklyRate: [-0.7, -0.5], proteinMin: 185, proteinMax: 200 },
  'diet-break': { id: 'diet-break', label: 'Pause diététique', short: 'Pause diét.', nutrition: 'Une semaine à maintenance : récupération physique et mentale.', weeklyRate: [-0.1, 0.1], proteinMin: 185, proteinMax: 200 },
  'cut-end': { id: 'cut-end', label: 'Fin de sèche', short: 'Fin de sèche', nutrition: 'Rythme ≈ −0,5 %/sem.', weeklyRate: [-0.5, -0.5], proteinMin: 185, proteinMax: 200 },
  stabilization: { id: 'stabilization', label: 'Phase 3 · Stabilisation', short: 'Stabilisation', nutrition: 'Remonter progressivement à maintenance. Le look final est atteint ici.', weeklyRate: [-0.1, 0.1], proteinMin: 180, proteinMax: 190 },
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
  calves?: boolean
  fixedRir?: string
}

export const PERIODS: Period[] = [
  { id: 'fondation', label: 'Fondation', short: 'F', kind: 'pre', phase: 'foundation', start: FOUNDATION_START, end: '2026-09-27', note: 'Ancien programme : 26 séances, baselines et technique.' },
  { id: 'b1', label: 'Bloc 1', short: 'B1', kind: 'block', phase: 'recomp', start: '2026-09-28', end: '2026-11-01', note: 'Nouveau split. Apprentissage du soulevé de terre roumain et du hip thrust.' },
  { id: 'd1', label: 'Décharge', short: 'D', kind: 'deload', phase: 'recomp', start: '2026-11-02', end: '2026-11-08', note: 'Mêmes exercices, moitié des séries, charges −10 %, RIR 3–4.' },
  { id: 'b2', label: 'Bloc 2', short: 'B2', kind: 'block', phase: 'recomp', start: '2026-11-09', end: '2026-12-20', priorityFromWeek: 3, note: '+1 série sur deltoïdes latéraux, dos et pectoraux à partir de S3.' },
  { id: 'fetes', label: 'Fêtes', short: 'F', kind: 'holiday', phase: 'maintenance', start: '2026-12-21', end: '2027-01-03', volumeFactor: 0.67, note: '3–4 séances à volume réduit. Une pause ici suit la règle de reprise.' },
  { id: 'b3', label: 'Bloc 3', short: 'B3', kind: 'block', phase: 'cut', start: '2027-01-04', end: '2027-02-07', priorityFromWeek: 1, calves: true, note: 'Début de la sèche. Volume du bloc 2 maintenu, mollets à 8 séries.' },
  { id: 'd3', label: 'Décharge', short: 'D', kind: 'deload', phase: 'cut', start: '2027-02-08', end: '2027-02-14', note: 'Moitié des séries, déficit maintenu.' },
  { id: 'b4', label: 'Bloc 4', short: 'B4', kind: 'block', phase: 'cut', start: '2027-02-15', end: '2027-03-21', priorityFromWeek: 1, calves: true, note: 'Garder les charges : c’est le signal principal de préservation musculaire.' },
  { id: 'd4', label: 'Décharge + pause diététique', short: 'D', kind: 'deload', phase: 'diet-break', start: '2027-03-22', end: '2027-03-28', note: 'Calories à maintenance, moitié des séries.' },
  { id: 'b5', label: 'Bloc 5', short: 'B5', kind: 'block', phase: 'cut', start: '2027-03-29', end: '2027-05-02', priorityFromWeek: 1, calves: true, note: 'Si la récupération baisse : −20 % de volume, intensité maintenue.' },
  { id: 'd5', label: 'Décharge', short: 'D', kind: 'deload', phase: 'cut', start: '2027-05-03', end: '2027-05-09', note: 'Moitié des séries.' },
  { id: 'b6', label: 'Bloc 6', short: 'B6', kind: 'block', phase: 'cut-end', start: '2027-05-10', end: '2027-06-13', priorityFromWeek: 1, calves: true, volumeFactor: 0.8, fixedRir: '1–2', note: 'Volume ~80 % du bloc 5, RIR 1–2.' },
  { id: 'stab', label: 'Stabilisation', short: 'S', kind: 'stabilization', phase: 'stabilization', start: '2027-06-14', end: GOAL_DATE, calves: true, volumeFactor: 0.7, fixedRir: '1–2', note: 'Volume −30 %, charges maintenues.' },
]

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
      title: after ? 'Programme terminé' : 'Avant programme',
      effort: '', effortDetail: '', before: !after, after,
    }
  }
  const week = weekIn(period, date)
  const weeks = periodWeeks(period)
  const phase = PHASES[period.phase]
  let title = period.label
  if (period.kind === 'block') title = `${period.label} · S${week}`
  if (period.kind === 'holiday' || period.kind === 'stabilization') title = `${period.label} · S${week}/${weeks}`
  const effort = weekEffort(period, week)
  return {
    date, period, phase, week, weeks, deload: period.kind === 'deload', title,
    effort: effort.short, effortDetail: effort.detail, before: false, after: false,
  }
}

function weekEffort(p: Period, week: number): { short: string; detail: string } {
  if (p.kind === 'deload') return { short: 'RIR 3–4 · séries ÷ 2', detail: 'Semaine de décharge : mêmes exercices, moitié des séries, charges −10 %.' }
  if (p.kind === 'holiday') return { short: 'RIR 2–3 · volume réduit', detail: '3–4 séances à volume réduit pendant les fêtes.' }
  if (p.kind === 'stabilization') return { short: 'RIR 1–2 · volume −30 %', detail: 'Charges maintenues, volume réduit de 30 %.' }
  if (p.kind === 'pre') return { short: 'Baselines', detail: 'Ancien programme.' }
  if (p.fixedRir) return { short: `RIR ${p.fixedRir} · volume 80 %`, detail: 'Fin de sèche : volume ~80 % du bloc 5.' }
  const weeks = periodWeeks(p)
  if (week === 1) return { short: 'RIR 3 · réintroduction', detail: 'Semaine 1 du bloc : on garde 3 répétitions en réserve.' }
  if (week === 2) return { short: 'RIR 2', detail: 'Semaine 2 : 2 répétitions en réserve.' }
  if (week >= weeks) return { short: 'RIR 0–1 · dernière semaine', detail: 'Dernière série d’isolation jusqu’à l’échec technique.' }
  return { short: 'RIR 1–2 / 0–1', detail: 'RIR 1–2 en polyarticulaire, 0–1 en isolation.' }
}

/** Effort target for one exercise on a given date. */
export function effortFor(ex: TemplateExercise, ctx: ProgramContext): string {
  const base = ex.target.rir ?? (ex.role === 'compound' ? '1–2' : '0–1')
  const p = ctx.period
  if (!p || p.kind === 'pre') return base
  if (p.kind === 'deload') return '3–4'
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

/** Sets, reps, effort and load for one exercise on a given date, all program rules applied. */
export function prescribe(ex: TemplateExercise, date: ISODate, reentry: ReentryInfo | null): Prescription {
  const ctx = contextAt(date)
  const p = ctx.period
  const notes: string[] = []
  let sets = ex.target.sets
  if (p && ex.volumeTag === 'priority' && p.priorityFromWeek && ctx.week >= p.priorityFromWeek) {
    sets += 1
    notes.push('+1 série (muscle prioritaire)')
  }
  if (p?.calves && ex.volumeTag === 'calves') {
    sets += 1
    notes.push('+1 série (mollets à 8/semaine)')
  }
  if (p?.volumeFactor) sets = Math.max(1, Math.round(sets * p.volumeFactor))
  let loadFactor = 1
  let rir = effortFor(ex, ctx)
  if (ctx.deload) {
    sets = Math.max(1, Math.ceil(ex.target.sets / 2))
    loadFactor = 0.9
    notes.push('Décharge : moitié des séries, −10 %')
  }
  if (reentry && reentry.sessionsLeft > 0) {
    sets = Math.max(1, Math.round(sets * reentry.setsFactor))
    loadFactor = Math.min(loadFactor, reentry.loadFactor)
    rir = reentry.rir
    notes.push(reentry.label)
  }
  const inc = incrementFor(ex)
  const weight =
    ex.target.weight === null || ex.target.weight === undefined
      ? null
      : loadFactor < 1 && inc > 0
        ? Math.max(inc, roundTo(ex.target.weight * loadFactor, inc))
        : ex.target.weight
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
  note?: string
  superset?: boolean
  tag?: 'priority' | 'calves'
}

export const PLAN: Record<WorkoutType, PlanItem[]> = {
  UPPER: [
    { id: 'chest-press', sets: 3, reps: [6, 10], rir: '1–2', rest: 150 },
    { id: 'lat-pulldown', sets: 3, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'incline-db-press', sets: 2, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'low-cable-row', sets: 3, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'lateral-raise', sets: 3, reps: [12, 20], rir: '0–1', rest: 90, tag: 'priority', note: 'Haltères ou poulie.' },
    { id: 'triceps-overhead-rope', sets: 2, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'ez-curl', sets: 2, reps: [8, 12], rir: '0–1', rest: 90 },
    { id: 'dips', sets: 2, reps: [8, 12], rir: '1–2', rest: 90, note: 'Si les épaules sont OK, sinon pushdown corde.' },
  ],
  LOWER: [
    { id: 'leg-press', sets: 3, reps: [8, 12], rir: '1–2', rest: 150, note: 'Amplitude profonde.' },
    { id: 'leg-curl', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'hip-thrust', sets: 3, reps: [8, 12], rir: '1–2', rest: 120, note: 'Machine ou barre.' },
    { id: 'leg-extension', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, note: 'Insister sur le bas du mouvement.' },
    { id: 'calf-press', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'calves', note: 'Ou mollets debout. Pause 1–2 s en étirement.' },
    { id: 'roman-chair-abs', sets: 3, reps: [10, 15], rir: '0–1', rest: 75, note: 'Ou crunch poulie.' },
  ],
  PUSH: [
    { id: 'incline-db-press', sets: 3, reps: [6, 10], rir: '1–2', rest: 150 },
    { id: 'shoulder-press-machine', sets: 2, reps: [8, 12], rir: '1–2', rest: 120 },
    { id: 'pec-deck', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'priority', note: 'Ou écarté poulie. Étirement contrôlé.' },
    { id: 'cable-lateral-raise', sets: 4, reps: [12, 20], rir: '0–1', rest: 90 },
    { id: 'triceps-overhead-rope', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'triceps-rope', sets: 2, reps: [10, 15], rir: '0–1', rest: 90 },
  ],
  PULL: [
    { id: 'lat-pulldown', sets: 3, reps: [6, 10], rir: '1–2', rest: 150, note: 'Prise neutre ou large.' },
    { id: 'chest-supported-row', sets: 3, reps: [8, 12], rir: '1–2', rest: 120, tag: 'priority' },
    { id: 'cable-pullover', sets: 2, reps: [10, 15], rir: '0–1', rest: 90, note: 'Ou tirage unilatéral.' },
    { id: 'reverse-pec-deck', sets: 3, reps: [12, 20], rir: '0–1', rest: 75, superset: true, note: 'En superset avec les élévations latérales.' },
    { id: 'lateral-raise', sets: 3, reps: [12, 20], rir: '0–1', rest: 75 },
    { id: 'preacher-curl', sets: 3, reps: [8, 12], rir: '0–1', rest: 90, note: 'Ou curl haltères assis.' },
    { id: 'roman-chair-abs', sets: 3, reps: [10, 15], rir: '0–1', rest: 60 },
  ],
  LEGS: [
    { id: 'hack-squat', sets: 3, reps: [6, 10], rir: '1–2', rest: 150, note: 'Ou Smith squat, ou presse pieds bas.' },
    { id: 'romanian-deadlift', sets: 3, reps: [8, 10], rir: '2', rest: 150 },
    { id: 'leg-extension', sets: 3, reps: [10, 15], rir: '0–1', rest: 90 },
    { id: 'leg-curl', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, note: 'Assis, ou allongé pour varier.' },
    { id: 'back-extension-45', sets: 2, reps: [10, 15], rir: '1', rest: 90, note: 'Orientée fessiers.' },
    { id: 'standing-calf-raise', sets: 3, reps: [10, 15], rir: '0–1', rest: 90, tag: 'calves' },
  ],
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
    return `Séance d’essai : trouve une charge pour ${minReps}–${maxReps} reps à RIR 3.`
  }
  return `${fmtLoad(weight, ex.unit)} · viser ${sets} × ${minReps}–${maxReps} propres, puis augmenter.`
}

/** Builds the research program, carrying loads and machine-setup notes over from the previous templates. */
export function buildResearchTemplates(
  old?: Partial<Record<WorkoutType, Template>>,
  workouts: Workout[] = [],
): Record<WorkoutType, Template> {
  const out = {} as Record<WorkoutType, Template>
  const oldAll = Object.values(old ?? {}).flatMap((t) => t?.exercises ?? [])
  for (const type of ROTATION) {
    const exercises: TemplateExercise[] = PLAN[type].map((item) => {
      const info = LIBRARY[item.id]
      const carried = old?.[type]?.exercises.find((e) => e.exerciseId === item.id) ?? oldAll.find((e) => e.exerciseId === item.id)
      const unit = info.unit
      const weight = unit === 'PDC' ? null : (carried?.target?.weight ?? lastWorkingWeight(workouts, item.id) ?? null)
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
        note: item.note,
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
  if (state.workouts.some((w) => w.date === start)) start = addDays(start, 1)
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
      caption = period.kind === 'block' ? `${period.label} · S${weekIn(period, mid)}` : period.label
    } else if (mid > GOAL_DATE) caption = 'Après l’objectif'
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
        isGoal: date === GOAL_DATE,
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
  for (const p of PERIODS) {
    if (p.start < from || p.kind === 'pre') continue
    const phaseChange = PERIODS.find((q) => q.end === addDays(p.start, -1))?.phase !== p.phase
    const title = p.id === 'b3' ? 'Début de la sèche' : p.id === 'b1' ? 'Début du programme' : p.label
    out.push({ date: p.start, title, detail: p.note, kind: phaseChange && p.id !== 'd4' ? 'phase' : p.kind })
  }
  if (GOAL_DATE >= from) out.push({ date: GOAL_DATE, title: 'Objectif Summer body', detail: 'Fin du programme.', kind: 'goal' })
  return out
}

// ───────────────────────── Pauses & re-entry ─────────────────────────

/** Re-entry rules after a break (report: Ogasawara 2013, Coleman 2024; thresholds are expert opinion). */
export function reentryForGap(days: number): ReentryInfo | null {
  if (days < 7) return null
  if (days <= 13) {
    return { sessionsLeft: 2, days, setsFactor: 1, loadFactor: 0.925, rir: '2–3', label: `Reprise après ${days} j`, advice: 'Charges −5 à −10 % et RIR 2–3 pendant 2 séances, puis retour au bloc en cours.' }
  }
  if (days <= 21) {
    return { sessionsLeft: 5, days, setsFactor: 0.7, loadFactor: 1, rir: '3', label: `Reprise après ${days} j`, advice: 'Une semaine comme une semaine 1 : RIR 3, −30 % de séries. Les gains reviennent vite.' }
  }
  return { sessionsLeft: 10, days, setsFactor: 0.7, loadFactor: 0.9, rir: '3', label: `Remise en route (${days} j)`, advice: 'Deux semaines de remise en route : RIR 3, −30 % de séries, charges −10 %.' }
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
