import { todayISO } from './date'
import { DEFAULT_GYMS, HOME_GYM } from './gyms'
import {
  buildResearchTemplates, DEFAULT_GOAL, DEFAULT_SCHEDULE, isValidGoal, PROGRAM_ID, PROGRAM_REVISION, ROTATION, TOTAL_SESSIONS, TYPE_META,
} from './program'
import type {
  AppState, Backup, BodyEntry, Gym, NutritionEntry, Photo, Prefs, ProgramPause, Template, VisualGoal, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from './types'
import { WORKOUT_TYPES } from './types'

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
    settings: { goalDate: DEFAULT_GOAL },
    manualDeload: null,
    gyms: DEFAULT_GYMS.map((g) => ({ ...g })),
    gymId: HOME_GYM,
    progressRevision: 1,
    profile: { heightCm: 0, age: 0, sex: 'm' },
    visualGoal: null,
    goals: { targetWeightMin: 0, targetWeightMax: 0, targetWaist: null, sessionsPerWeek: 5 },
    prefs: { theme: 'dark', accent: 'blue', autoLoad: true, push: false, sound: true, notifications: false, wakeLock: true, trainingTime: '18:00', weighInTime: '07:30' },
    schedule: { ...DEFAULT_SCHEDULE },
    exerciseVideos: {},
    meta: { createdAt: now, lastBackupAt: null, importedAt: null },
  }
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null)
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
    name: str(e?.name, str(e?.exerciseId, 'Exercice')),
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
  }
}

function normGyms(raw: any): Gym[] {
  const list: Gym[] = Array.isArray(raw)
    ? raw.filter((g: any) => typeof g?.id === 'string' && g.id && typeof g?.name === 'string').map((g: any) => ({ id: g.id, name: g.name.trim() || 'Salle' }))
    : []
  if (!list.some((g) => g.id === HOME_GYM)) list.unshift({ ...DEFAULT_GYMS[0] })
  return list.filter((g, i) => list.findIndex((x) => x.id === g.id) === i)
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
  return {
    ...p,
    theme: p.theme === 'light' || p.theme === 'auto' ? p.theme : 'dark',
    accent: p.accent === 'orange' ? 'orange' : 'blue',
    autoLoad: p.autoLoad !== false,
    push: p.push === true,
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
    t && typeof t.endAt === 'number' && typeof t.total === 'number' && t.endAt > Date.now() - 60_000
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
        gymId: typeof raw.activeWorkout.gymId === 'string' && raw.activeWorkout.gymId ? raw.activeWorkout.gymId : undefined,
        exercises: Array.isArray(raw.activeWorkout.exercises) ? raw.activeWorkout.exercises.map(normExercise) : [],
      }
    : null
  const fullTemplates = { ...d.templates, ...templates } as Record<WorkoutType, Template>
  return {
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
    appliedPlanUpdates: Array.isArray(raw.appliedPlanUpdates) ? raw.appliedPlanUpdates : [],
    programPause: normPause(raw.programPause),
    reentry: raw.reentry ?? null,
    nutritionTargets: {
      calories: num(raw.nutritionTargets?.calories) ?? d.nutritionTargets.calories,
      proteinMin: num(raw.nutritionTargets?.proteinMin) ?? d.nutritionTargets.proteinMin,
      proteinMax: num(raw.nutritionTargets?.proteinMax) ?? d.nutritionTargets.proteinMax,
      creatine: num(raw.nutritionTargets?.creatine) ?? d.nutritionTargets.creatine,
      caloriesChangedAt: typeof raw.nutritionTargets?.caloriesChangedAt === 'string' ? raw.nutritionTargets.caloriesChangedAt : undefined,
      adaptive: raw.nutritionTargets?.adaptive !== false,
    },
    nutritionEntries,
    bodyEntries,
    settings: { goalDate: isValidGoal(raw.settings?.goalDate) ? raw.settings.goalDate : DEFAULT_GOAL },
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
    exerciseVideos: raw.exerciseVideos && typeof raw.exerciseVideos === 'object' ? raw.exerciseVideos : {},
    archive: raw.archive,
    meta: {
      createdAt: str(raw.meta?.createdAt, d.meta.createdAt),
      lastBackupAt: typeof raw.meta?.lastBackupAt === 'string' ? raw.meta.lastBackupAt : null,
      importedAt: typeof raw.meta?.importedAt === 'string' ? raw.meta.importedAt : null,
    },
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
        summary: 'Programme fondé sur la recherche : ULPPL rééquilibré (latéraux ×2, triceps au-dessus de la tête, leg curl assis, hip thrust, RDL, mollets 2×/sem), blocs de 5 semaines + décharge, sèche du 4 janvier au 13 juin.',
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
    throw new Error('Ce fichier n’est pas un JSON valide.')
  }
  const rawState = json?.state ?? json
  if (!rawState || typeof rawState !== 'object' || !('workouts' in rawState || 'templates' in rawState)) {
    throw new Error('Ce fichier ne ressemble pas à une sauvegarde Golgoth.')
  }
  const state = normalizeState(rawState)
  const photos: Photo[] = (Array.isArray(json?.photos) ? json.photos : [])
    .filter((p: any) => typeof p?.dataUrl === 'string' && p.dataUrl.startsWith('data:image/'))
    .map((p: any, i: number) => ({ id: str(p.id, `photo-${i}`), date: str(p.date, todayISO()).slice(0, 10), dataUrl: p.dataUrl, name: str(p.name, `photo-${i}.jpg`) }))
  const seen = new Set<string>()
  const unique = photos.filter((p) => {
    const key = `${p.date}-${p.dataUrl.length}-${p.dataUrl.slice(-64)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
