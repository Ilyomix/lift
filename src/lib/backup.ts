import { todayISO } from './date'
import { DEFAULT_GYMS, HOME_GYM } from './gyms'
import { L } from './i18n'
import {
  buildResearchTemplates, upgradeSheets, DEFAULT_GOAL, DEFAULT_SCHEDULE, defaultGoalFor, isValidGoal, PROGRAM_ID, PROGRAM_REVISION, REPORT_FOUNDATION, REPORT_START,
  ROTATION, TOTAL_SESSIONS, TYPE_META,
} from './program'
import type {
  AppState, AutoChange, Backup, BodyEntry, Equipment, Gym, NutritionEntry, Photo, PlanUpdateRecord, Prefs, ProgramPause, ReentryInfo, Template, TrainingSetup,
  VisualGoal, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from './types'
import { WORKOUT_TYPES } from './types'
import { goalApplied, tagPriorities } from './visual'
import { normalizeSessionReplacements } from './exerciseReplacement'
import { normalizePostponed } from './postponed'

export const BACKUP_VERSION = 1
export const APP_ID = 'golgoth-pwa'

export function defaultState(): AppState {
  const now = new Date().toISOString()
  return {
    version: 2,
    programId: PROGRAM_ID,
    programRevision: PROGRAM_REVISION,
    totalSessions: TOTAL_SESSIONS,
    completedSessions: 0,
    nextWorkoutType: 'UPPER',
    workouts: [],
    templates: buildResearchTemplates(),
    activeWorkout: null,
    lastCompletedWorkoutId: null,
    appliedPlanUpdates: [],
    programPause: { active: false, startedAt: null, plannedEnd: null, history: [] },
    reentry: null,
    nutritionTargets: { calories: 2350, proteinMin: 180, proteinMax: 190, creatine: 5, adaptive: true },
    nutritionEntries: {},
    bodyEntries: [],
    settings: { goalDate: DEFAULT_GOAL, programStart: REPORT_START, foundationStart: REPORT_FOUNDATION, setup: { place: 'gym', equipment: [] } },
    manualDeload: null,
    gyms: DEFAULT_GYMS.map((g) => ({ ...g })),
    gymId: HOME_GYM,
    progressRevision: 1,
    profile: { heightCm: 0, age: 0, sex: 'm' },
    visualGoal: null,
    goals: { targetWeightMin: 0, targetWeightMax: 0, targetWaist: null, sessionsPerWeek: 5 },
    prefs: { theme: 'dark', lang: 'auto', accent: 'orange', autoLoad: true, keepWeeklyVolume: true, push: false, sound: true, notifications: false, wakeLock: true, trainingTime: '18:00', weighInTime: '07:30' },
    schedule: { ...DEFAULT_SCHEDULE },
    exerciseVideos: {},
    meta: { createdAt: now, lastBackupAt: null, importedAt: null },
  }
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null)

/** The sized step of a cut as kept with the calorie targets: its day and the two targets, or nothing. */
function sizedStepOf(x: any): { at: string; from: number; to: number } | undefined {
  const from = num(x?.from)
  const to = num(x?.to)
  return x && typeof x.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.at) && from !== null && to !== null ? { at: x.at, from, to } : undefined
}
const str = (x: unknown, d = ''): string => (typeof x === 'string' ? x : d)
const isType = (x: unknown): x is WorkoutType => typeof x === 'string' && (WORKOUT_TYPES as string[]).includes(x)

function normSet(s: any): WorkoutSet {
  const reps = num(s?.reps)
  return {
    weight: num(s?.weight),
    reps,
    cleanReps: num(s?.cleanReps) ?? reps,
    flags: Array.isArray(s?.flags) ? s.flags.filter((f: unknown) => f === 'failure' || f === 'bad-technique' || f === 'pain') : [],
    note: str(s?.note),
    completed: !!s?.completed,
    rir: num(s?.rir),
  }
}

function normExercise(e: any): WorkoutExercise {
  const t = e?.target ?? {}
  return {
    ...e,
    exerciseId: str(e?.exerciseId, 'exercice'),
    name: str(e?.name, str(e?.exerciseId, L('Exercice', 'Exercise'))),
    muscle: str(e?.muscle),
    unit: e?.unit === 'kg/main' || e?.unit === 'PDC' ? e.unit : 'kg',
    target: {
      weight: num(t.weight),
      sets: num(t.sets) ?? 3,
      minReps: num(t.minReps) ?? 8,
      maxReps: num(t.maxReps) ?? 12,
      restSeconds: num(t.restSeconds) ?? 120,
      rir: typeof t.rir === 'string' ? t.rir : undefined,
    },
    sets: Array.isArray(e?.sets) ? e.sets.map(normSet) : [],
    notes: str(e?.notes),
    skipped: !!e?.skipped,
    validated: !!e?.validated,
    comparison: e?.comparison ?? null,
  }
}

function normWorkout(w: any, i: number): Workout | null {
  if (!w || !isType(w.type) || typeof w.date !== 'string') return null
  return {
    id: str(w.id, `workout-${i}`),
    sessionNumber: num(w.sessionNumber) ?? i + 1,
    type: w.type,
    date: w.date.slice(0, 10),
    startedAt: str(w.startedAt, `${w.date}T12:00:00.000Z`),
    completedAt: typeof w.completedAt === 'string' ? w.completedAt : null,
    notes: str(w.notes),
    exercises: Array.isArray(w.exercises) ? w.exercises.map(normExercise) : [],
    periodId: typeof w.periodId === 'string' ? w.periodId : undefined,
    week: num(w.week) ?? undefined,
    deload: !!w.deload,
    gymId: typeof w.gymId === 'string' && w.gymId ? w.gymId : undefined,
    // An empty list is kept: it says the session changed nothing, where no list says it was logged before changes were kept.
    ...(Array.isArray(w.changes) ? { changes: normChanges(w.changes) } : {}),
    ...(w.reentry === null || isReentry(w.reentry) ? { reentry: w.reentry } : {}),
  }
}

const CHANGE_KINDS = ['up', 'down', 'baseline', 'sets']

/** The changes a session made to the plan: kept when they are complete, dropped otherwise (a session without them is still a session). */
function normChanges(raw: any): AutoChange[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c: any) => c && typeof c.id === 'string' && isType(c.type) && typeof c.exerciseId === 'string' && CHANGE_KINDS.includes(c.kind) && typeof c.date === 'string')
    .map((c: any) => ({
      id: c.id, type: c.type, exerciseId: c.exerciseId, name: str(c.name, c.exerciseId), gymId: str(c.gymId, HOME_GYM), date: c.date.slice(0, 10),
      kind: c.kind, from: num(c.from), to: num(c.to), text: str(c.text),
      ...(c.lang === 'fr' || c.lang === 'en' ? { lang: c.lang } : {}),
      ...(Array.isArray(c.also) && c.also.some(isType) ? { also: c.also.filter(isType) } : {}),
    }))
}

function isReentry(r: any): r is ReentryInfo {
  return !!r && typeof r === 'object' && typeof r.sessionsLeft === 'number' && typeof r.setsFactor === 'number' && typeof r.loadFactor === 'number' && typeof r.rir === 'string'
}

function normGyms(raw: any): Gym[] {
  const list: Gym[] = Array.isArray(raw)
    ? raw.filter((g: any) => typeof g?.id === 'string' && g.id && typeof g?.name === 'string').map((g: any) => ({ id: g.id, name: g.name.trim() || L('Salle', 'Gym') }))
    : []
  if (!list.some((g) => g.id === HOME_GYM)) list.unshift({ ...DEFAULT_GYMS[0] })
  return list.filter((g, i) => list.findIndex((x) => x.id === g.id) === i)
}

const isISO = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)

/** One-week exceptions: real Mondays and explicit weekdays only, including an empty week. */
export function normalizeWeekSchedules(raw: unknown): AppState['weekSchedules'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const valid = Object.entries(raw).filter(([week, value]) => {
    if (!isISO(week) || !value || typeof value !== 'object' || Array.isArray(value)) return false
    const { days, target } = value
    if (!Array.isArray(days) || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)
      || !Number.isInteger(target) || target < new Set(days).size || target > 100) return false
    const date = new Date(`${week}T12:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === week && date.getUTCDay() === 1
  }).sort(([a], [b]) => b.localeCompare(a)).slice(0, 260)
  return valid.length ? Object.fromEntries(valid.map(([week, value]) => [week, { days: [1, 2, 3, 4, 5, 6, 0].filter(day => value.days.includes(day)), target: value.target }])) : undefined
}

const EQUIPMENT: Equipment[] = ['dumbbells', 'bench', 'pullupBar', 'bands']

function normSetup(raw: any): TrainingSetup {
  return {
    place: raw?.place === 'home' ? 'home' : 'gym',
    equipment: Array.isArray(raw?.equipment) ? EQUIPMENT.filter((e) => raw.equipment.includes(e)) : [],
  }
}

/** Data from before onboarding (the report's) keeps the report's start and foundation. */
function normSettings(raw: any): AppState['settings'] {
  const programStart = isISO(raw?.programStart) ? raw.programStart : REPORT_START
  const foundationStart = raw?.foundationStart === null ? null : isISO(raw?.foundationStart) ? raw.foundationStart : programStart === REPORT_START ? REPORT_FOUNDATION : null
  return {
    goalDate: isValidGoal(raw?.goalDate, programStart) ? raw.goalDate : defaultGoalFor(programStart),
    ...(raw?.maintenance === true ? { maintenance: true } : {}),
    programStart,
    foundationStart,
    setup: normSetup(raw?.setup),
  }
}

const LOOKS = ['athletique', 'sec', 'taille', 'tres-sec']
const ZONES = ['epaules', 'pectoraux', 'dos', 'bras', 'abdos', 'jambes', 'mollets']

function normVisualGoal(raw: any): VisualGoal | null {
  if (!raw || typeof raw !== 'object' || !LOOKS.includes(raw.look)) return null
  const bf = num(raw.bodyFat)
  return {
    look: raw.look,
    zones: Array.isArray(raw.zones) ? raw.zones.filter((z: unknown) => typeof z === 'string' && ZONES.includes(z)).slice(0, 3) : [],
    bodyFat: bf !== null && bf >= 3 && bf <= 60 ? bf : null,
    photoId: typeof raw.photoId === 'string' ? raw.photoId : undefined,
    cutWeeks: num(raw.cutWeeks) ?? undefined,
  }
}

function normPrefs(raw: any, d: Prefs): Prefs {
  const p = { ...d, ...(raw && typeof raw === 'object' ? raw : {}) }
  const time = (value: unknown, fallback: string) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback
  return {
    ...p,
    theme: p.theme === 'light' || p.theme === 'auto' ? p.theme : 'dark',
    accent: p.accent === 'blue' ? 'blue' : 'orange',
    lang: p.lang === 'fr' || p.lang === 'en' ? p.lang : 'auto',
    autoLoad: p.autoLoad !== false,
    keepWeeklyVolume: p.keepWeeklyVolume !== false,
    push: p.push === true,
    notifications: p.notifications === true,
    sound: typeof p.sound === 'boolean' ? p.sound : d.sound,
    wakeLock: typeof p.wakeLock === 'boolean' ? p.wakeLock : d.wakeLock,
    trainingTime: time(p.trainingTime, d.trainingTime),
    weighInTime: time(p.weighInTime, d.weighInTime),
  }
}

function normTemplates(raw: any): Partial<Record<WorkoutType, Template>> {
  const out: Partial<Record<WorkoutType, Template>> = {}
  for (const type of WORKOUT_TYPES) {
    const t = raw?.[type]
    if (!t || !Array.isArray(t.exercises)) continue
    out[type] = {
      type,
      label: str(t.label, TYPE_META[type].label),
      configured: t.configured !== false,
      exercises: t.exercises.map((e: any) => {
        const n = normExercise(e)
        const { sets: _s, notes: _n, skipped: _k, validated: _v, comparison: _c, ...rest } = n
        return rest
      }),
    }
  }
  return out
}

function normPause(p: any): ProgramPause {
  return {
    active: !!p?.active,
    startedAt: typeof p?.startedAt === 'string' ? p.startedAt : null,
    reason: p?.reason,
    plannedEnd: typeof p?.plannedEnd === 'string' ? p.plannedEnd : null,
    note: typeof p?.note === 'string' ? p.note : undefined,
    history: Array.isArray(p?.history)
      ? p.history.filter((h: any) => typeof h?.startedAt === 'string' && typeof h?.endedAt === 'string')
      : [],
  }
}

/** Updates pasted back from an AI assistant used to be recorded under the name of one assistant: they are 'coach' updates. */
function normPlanUpdates(raw: any): PlanUpdateRecord[] {
  return (Array.isArray(raw) ? raw : []).map((u: any) => (u?.source === 'claude' ? { ...u, source: 'coach' } : u))
}

/** Accepts the previous tracker's state (version 1) or this app's state, and returns a complete, typed state. */
export function normalizeState(raw: any): AppState {
  const d = defaultState()
  if (!raw || typeof raw !== 'object') return d
  const workouts = (Array.isArray(raw.workouts) ? raw.workouts : [])
    .map(normWorkout)
    .filter((w: Workout | null): w is Workout => !!w)
    .sort((a: Workout, b: Workout) => (a.date === b.date ? a.sessionNumber - b.sessionNumber : a.date < b.date ? -1 : 1))
  const templates = normTemplates(raw.templates)
  const bodyEntries: BodyEntry[] = (Array.isArray(raw.bodyEntries) ? raw.bodyEntries : [])
    .filter((b: any) => typeof b?.date === 'string')
    .map((b: any) => ({
      id: str(b.id, `body-${b.date}`),
      date: b.date.slice(0, 10),
      weight: num(b.weight),
      waist: num(b.waist),
      arm: num(b.arm),
      chest: num(b.chest),
      shoulders: num(b.shoulders),
    }))
    .sort((a: BodyEntry, b: BodyEntry) => (a.date < b.date ? -1 : 1))
  const nutritionEntries: Record<string, NutritionEntry> = {}
  for (const [k, v] of Object.entries(raw.nutritionEntries ?? {})) {
    const e = v as any
    nutritionEntries[k] = { date: k, calories: num(e?.calories) ?? 0, protein: num(e?.protein) ?? 0, creatine: num(e?.creatine) ?? 0 }
  }
  // A rest still running when the app was closed survives the reload.
  const t = raw.activeWorkout?.timer
  const timer =
    t && Number.isFinite(t.endAt) && Number.isFinite(t.total) && t.total > 0
      && t.endAt > Date.now() - 60_000 && Number.isFinite(new Date(t.endAt).getTime())
      ? { endAt: t.endAt, total: t.total, label: str(t.label), next: typeof t.next === 'string' ? t.next : undefined }
      : null
  const active = raw.activeWorkout && isType(raw.activeWorkout.type)
    ? {
        ...raw.activeWorkout,
        id: str(raw.activeWorkout.id, 'draft'),
        date: str(raw.activeWorkout.date, todayISO()),
        startedAt: str(raw.activeWorkout.startedAt, new Date().toISOString()),
        notes: str(raw.activeWorkout.notes),
        timerEndAt: timer ? new Date(timer.endAt).toISOString() : null,
        timer,
        activeExerciseIndex: Number.isInteger(raw.activeWorkout.activeExerciseIndex)
          && raw.activeWorkout.activeExerciseIndex >= 0
          && Array.isArray(raw.activeWorkout.exercises)
          && raw.activeWorkout.activeExerciseIndex < raw.activeWorkout.exercises.length
          ? raw.activeWorkout.activeExerciseIndex : undefined,
        gymId: typeof raw.activeWorkout.gymId === 'string' && raw.activeWorkout.gymId ? raw.activeWorkout.gymId : undefined,
        exercises: Array.isArray(raw.activeWorkout.exercises) ? raw.activeWorkout.exercises.map(normExercise) : [],
        reopened: raw.activeWorkout.reopened && typeof raw.activeWorkout.reopened === 'object'
          ? { completedAt: typeof raw.activeWorkout.reopened.completedAt === 'string' ? raw.activeWorkout.reopened.completedAt : null }
          : undefined,
      }
    : null
  const fullTemplates = { ...d.templates, ...templates } as Record<WorkoutType, Template>
  const state = upgradedProgram({
    ...d,
    version: 2,
    programId: str(raw.programId, 'legacy'),
    programRevision: num(raw.programRevision) ?? 1,
    totalSessions: num(raw.totalSessions) ?? TOTAL_SESSIONS,
    completedSessions: Math.max(num(raw.completedSessions) ?? 0, workouts.length ? Math.max(...workouts.map((w: Workout) => w.sessionNumber)) : 0),
    nextWorkoutType: isType(raw.nextWorkoutType) ? raw.nextWorkoutType : 'UPPER',
    workouts,
    templates: fullTemplates,
    activeWorkout: active,
    lastCompletedWorkoutId: typeof raw.lastCompletedWorkoutId === 'string' ? raw.lastCompletedWorkoutId : null,
    appliedPlanUpdates: normPlanUpdates(raw.appliedPlanUpdates),
    programPause: normPause(raw.programPause),
    reentry: raw.reentry ?? null,
    nutritionTargets: {
      calories: num(raw.nutritionTargets?.calories) ?? d.nutritionTargets.calories,
      proteinMin: num(raw.nutritionTargets?.proteinMin) ?? d.nutritionTargets.proteinMin,
      proteinMax: num(raw.nutritionTargets?.proteinMax) ?? d.nutritionTargets.proteinMax,
      creatine: num(raw.nutritionTargets?.creatine) ?? d.nutritionTargets.creatine,
      caloriesChangedAt: typeof raw.nutritionTargets?.caloriesChangedAt === 'string' ? raw.nutritionTargets.caloriesChangedAt : undefined,
      sizedStep: sizedStepOf(raw.nutritionTargets?.sizedStep),
      adaptive: raw.nutritionTargets?.adaptive !== false,
    },
    nutritionEntries,
    bodyEntries,
    settings: normSettings(raw.settings),
    manualDeload:
      typeof raw.manualDeload?.start === 'string' && typeof raw.manualDeload?.end === 'string'
        ? { start: raw.manualDeload.start, end: raw.manualDeload.end }
        : null,
    gyms: normGyms(raw.gyms),
    gymId: typeof raw.gymId === 'string' && normGyms(raw.gyms).some((g) => g.id === raw.gymId) ? raw.gymId : HOME_GYM,
    progressRevision: num(raw.progressRevision) ?? 1,
    profile: { heightCm: num(raw.profile?.heightCm) ?? 0, age: num(raw.profile?.age) ?? 0, sex: raw.profile?.sex === 'f' ? 'f' : 'm' },
    visualGoal: normVisualGoal(raw.visualGoal),
    goals: {
      targetWeightMin: num(raw.goals?.targetWeightMin) ?? 0,
      targetWeightMax: num(raw.goals?.targetWeightMax) ?? 0,
      targetWaist: num(raw.goals?.targetWaist),
      sessionsPerWeek: num(raw.goals?.sessionsPerWeek) ?? 5,
    },
    prefs: normPrefs(raw.prefs, d.prefs),
    schedule: raw.schedule && typeof raw.schedule === 'object' ? { ...d.schedule, ...raw.schedule } : d.schedule,
    exerciseVideos: raw.exerciseVideos && typeof raw.exerciseVideos === 'object' && !Array.isArray(raw.exerciseVideos)
      ? Object.fromEntries(Object.entries(raw.exerciseVideos).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {},
    archive: raw.archive,
    meta: {
      createdAt: str(raw.meta?.createdAt, d.meta.createdAt),
      lastBackupAt: typeof raw.meta?.lastBackupAt === 'string' ? raw.meta.lastBackupAt : null,
      importedAt: typeof raw.meta?.importedAt === 'string' ? raw.meta.importedAt : null,
    },
  })
  const weekSchedules = normalizeWeekSchedules(raw.weekSchedules)
  const postponed = normalizePostponed(raw.postponed)
  return { ...state, ...(weekSchedules ? { weekSchedules } : {}), ...(postponed ? { postponed } : {}), sessionReplacements: normalizeSessionReplacements(raw.sessionReplacements, state.templates) }
}

/**
 * A state written by an earlier revision of the research program takes the current one: its
 * sheets (and the ones kept for the other training place) are upgraded, and the change is
 * recorded where plan updates are listed.
 */
function upgradedProgram(state: AppState): AppState {
  if (state.programId !== PROGRAM_ID || state.programRevision >= PROGRAM_REVISION) return state
  const setup = state.settings.setup ?? { place: 'gym' as const, equipment: [] }
  const kept = state.archive?.templatesBySetup
  const other = (place: 'gym' | 'home') =>
    kept?.[place] ? retag(upgradeSheets(kept[place]!, state.programRevision, place === setup.place ? setup : { place, equipment: place === 'home' ? ['dumbbells', 'bench', 'pullupBar', 'bands'] : [] }, state.workouts)) : undefined
  // A slot the revision added takes the priority of the chosen zones, like the others.
  const zones = goalApplied(state.visualGoal) ? state.visualGoal.zones : []
  const retag = (t: Record<WorkoutType, Template>) => (zones.length ? tagPriorities(t, zones) : t)
  return {
    ...state,
    programRevision: PROGRAM_REVISION,
    templates: retag(upgradeSheets(state.templates, state.programRevision, setup, state.workouts)),
    archive: kept ? { ...state.archive, templatesBySetup: { ...kept, ...(kept.gym ? { gym: other('gym') } : {}), ...(kept.home ? { home: other('home') } : {}) } } : state.archive,
    appliedPlanUpdates: [
      ...state.appliedPlanUpdates,
      {
        updateId: `program-revision-${PROGRAM_REVISION}`,
        basedOnSession: state.completedSessions || null,
        summary:
          state.programRevision >= 4
            ? L(
                'Programme : les 10 séries d’abdos et de mollets sont réparties sur trois séances au lieu de deux (abdos ajoutés en Legs, mollets en Push), et les deltoïdes postérieurs passent à 4 séries en Pull et 3 en Push : plus aucun exercice à cinq séries.',
                'Program: the 10 sets of abs and of calves are spread over three workouts instead of two (abs added on Legs, calves on Push), and rear delts go to 4 sets on Pull and 3 on Push: no exercise at five sets any more.',
              )
            : L(
                'Programme : abdos, mollets et deltoïdes postérieurs passent de 6 à 10 séries par semaine (abdos ajoutés en Legs, mollets et deltoïdes postérieurs en Push), pour suivre la règle des 10–20 séries par muscle.',
                'Program: abs, calves and rear delts go from 6 to 10 sets a week (abs added on Legs, calves and rear delts on Push), to follow the rule of 10–20 sets per muscle.',
              ),
        appliedAt: new Date().toISOString(),
        changeCount: 7,
        source: 'program',
      },
    ],
  }
}

export interface ProgramChange {
  type: WorkoutType
  kind: 'added' | 'removed' | 'kept'
  name: string
}

/** Moves a previous tracker's state onto the research program, keeping loads and history. */
export function upgradeToResearchProgram(state: AppState): { state: AppState; changes: ProgramChange[] } {
  if (state.programId === PROGRAM_ID) return { state, changes: [] }
  const previous = state.templates
  const templates = buildResearchTemplates(previous, state.workouts)
  const changes: ProgramChange[] = []
  for (const type of ROTATION) {
    const before = new Set(previous[type]?.exercises.map((e) => e.exerciseId) ?? [])
    const after = new Set(templates[type].exercises.map((e) => e.exerciseId))
    for (const e of templates[type].exercises) changes.push({ type, kind: before.has(e.exerciseId) ? 'kept' : 'added', name: e.name })
    for (const e of previous[type]?.exercises ?? []) if (!after.has(e.exerciseId)) changes.push({ type, kind: 'removed', name: e.name })
  }
  const draft = state.activeWorkout
  const draftHasWork = !!draft?.exercises.some((e) => e.sets.some((s) => s.completed))
  const next: AppState = {
    ...state,
    programId: PROGRAM_ID,
    programRevision: PROGRAM_REVISION,
    templates,
    nextWorkoutType: 'UPPER',
    activeWorkout: draftHasWork ? draft : null,
    archive: { ...(state.archive ?? {}), templatesBeforeResearch: previous },
    appliedPlanUpdates: [
      ...state.appliedPlanUpdates,
      {
        updateId: `research-program-${todayISO()}`,
        basedOnSession: state.completedSessions || null,
        summary: L(
          'Programme fondé sur la recherche : ULPPL rééquilibré (latéraux ×2, triceps au-dessus de la tête, leg curl assis, hip thrust, RDL, mollets 2×/sem), blocs de 5 semaines + semaine allégée, sèche du 4 janvier au 13 juin.',
          'Research-based program: rebalanced ULPPL (side delts ×2, overhead triceps, seated leg curl, hip thrust, RDL, calves 2×/wk), 5-week blocks + deload, cut from 4 January to 13 June.',
        ),
        appliedAt: new Date().toISOString(),
        changeCount: changes.filter((c) => c.kind !== 'kept').length,
        source: 'program',
      },
    ],
  }
  return { state: next, changes }
}

export interface ParsedBackup {
  state: AppState
  photos: Photo[]
  legacy: boolean
  summary: { workouts: number; bodyEntries: number; photos: number; nutritionDays: number; exportedAt: string | null }
}

export function parseBackup(text: string): ParsedBackup {
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(L('Ce fichier ne peut pas être lu. Choisis le fichier .json exporté depuis Lift.', 'This file cannot be read. Choose the .json file exported from Lift.'))
  }
  const rawState = json?.state ?? json
  if (!rawState || typeof rawState !== 'object' || !('workouts' in rawState || 'templates' in rawState)) {
    throw new Error(L('Ce fichier ne contient pas de sauvegarde Lift. Choisis une sauvegarde exportée depuis l’app.', 'This file does not contain a Lift backup. Choose a backup exported from the app.'))
  }
  const state = normalizeState(rawState)
  const photos: Photo[] = (Array.isArray(json?.photos) ? json.photos : [])
    .filter((p: any) => typeof p?.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'))
    .map((p: any, i: number) => ({ id: str(p.id, `photo-${i}`), date: str(p.date, todayISO()).slice(0, 10), dataUrl: p.dataUrl, name: str(p.name, `photo-${i}.jpg`) }))
  const seen = new Set<string>()
  const unique = photos.filter((p) => {
    const key = `${p.date}-${p.dataUrl}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // Imported files can reuse an ID for distinct images. IndexedDB is keyed by
  // ID, so preserve the first reference and give later images collision-free keys.
  const reservedIds = new Set(unique.map(photo => photo.id))
  const usedIds = new Set<string>()
  for (const [index, photo] of unique.entries()) {
    if (!photo.id || usedIds.has(photo.id)) {
      let suffix = index
      let id: string
      do { id = `${photo.id || 'photo'}-import-${suffix++}` } while (reservedIds.has(id))
      photo.id = id
      reservedIds.add(id)
    }
    usedIds.add(photo.id)
  }
  return {
    state,
    photos: unique,
    legacy: state.programId !== PROGRAM_ID,
    summary: {
      workouts: state.workouts.length,
      bodyEntries: state.bodyEntries.length,
      photos: unique.length,
      nutritionDays: Object.keys(state.nutritionEntries).length,
      exportedAt: typeof json?.exportedAt === 'string' ? json.exportedAt : null,
    },
  }
}

export function makeBackup(state: AppState, photos: Photo[]): Backup {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: APP_ID,
    state,
    photos,
  }
}
