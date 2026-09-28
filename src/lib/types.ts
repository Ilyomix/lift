export type ISODate = string // YYYY-MM-DD, local calendar day

export type WorkoutType = 'UPPER' | 'LOWER' | 'PUSH' | 'PULL' | 'LEGS'
export const WORKOUT_TYPES: WorkoutType[] = ['UPPER', 'LOWER', 'PUSH', 'PULL', 'LEGS']

export type Unit = 'kg' | 'kg/main' | 'PDC'
export type SetFlag = 'failure' | 'bad-technique' | 'pain'
export type Role = 'compound' | 'isolation'

export interface Target {
  weight: number | null
  sets: number
  minReps: number
  maxReps: number
  restSeconds: number
  /** Research-based effort target for weeks 3–4 of a block, e.g. "1–2". */
  rir?: string
}

export interface TemplateExercise {
  exerciseId: string
  name: string
  muscle: string
  unit: Unit
  target: Target
  nextTarget?: string
  technique?: string
  bodyweight?: boolean
  calibration?: boolean
  role?: Role
  /** When true, the next exercise is performed back-to-back and rest starts after it. */
  supersetWithNext?: boolean
  /** Program note, e.g. the accepted alternative. */
  note?: string
  /** Volume rules of the program: priority muscles gain a set from block 2, calves from block 3. */
  volumeTag?: 'priority' | 'calves'
  /** Priority zone chosen in the visual goal: +1 set from block 2 like a priority muscle, on top of the calves rule. */
  focus?: boolean
  /** Loads at gyms other than the first one, for machine and cable work (a machine differs from one gym to another). */
  gymLoads?: Record<string, number | null>
  /** Automatic set change (e.g. −1 after two sessions in a row with fewer reps), valid until the end of the period of `since`. */
  autoAdjust?: { sets: number; since: ISODate; reason: string }
}

export interface Template {
  type: WorkoutType
  label: string
  configured: boolean
  exercises: TemplateExercise[]
}

export interface WorkoutSet {
  weight: number | null
  reps: number | null
  cleanReps: number | null
  flags: SetFlag[]
  note: string
  completed: boolean
  rir?: number | null
}

export type ComparisonStatus =
  | 'new-baseline'
  | 'progress'
  | 'stable'
  | 'down'
  | 'load-change'
  | 'different-sets'
  | 'different-context'
  | 'skipped'
  | 'deload'

export interface Comparison {
  status: ComparisonStatus
  headline: string
  detail: string
  totalReps: number
  totalCleanReps: number
  volume: number
  deltaCleanReps: number | null
  previousTotalCleanReps: number | null
  previousSetReps: number[] | null
  previousWeights: (number | null)[] | null
  chargeValidated: boolean
  suggestion: string | null
  isRecord: boolean
}

export interface Prescription {
  sets: number
  minReps: number
  maxReps: number
  rir: string
  restSeconds: number
  weight: number | null
  loadFactor: number
  notes: string[]
}

export interface WorkoutExercise extends TemplateExercise {
  sets: WorkoutSet[]
  notes: string
  skipped: boolean
  skipReason?: string
  validated: boolean
  comparison: Comparison | null
  comparisonContext?: string
  replacement?: { fromId: string; fromName: string }
  prescription?: Prescription
  /** In-session load change on the following sets, with what is needed to undo it. */
  hint?: { text: string; from: number; to: number; sets: number[] }
  /** First time at this gym on a gym-bound exercise: load of another gym offered as a starting point. */
  gymTrial?: { fromGym: string; weight: number | null }
}

export interface Workout {
  id: string
  sessionNumber: number
  type: WorkoutType
  date: ISODate
  startedAt: string
  completedAt: string | null
  notes: string
  exercises: WorkoutExercise[]
  periodId?: string
  week?: number
  deload?: boolean
  /** Gym where the session took place (absent = the first gym). */
  gymId?: string
}

export interface RestTimer {
  endAt: number
  total: number
  label: string
  next?: string
}

export interface ReentryInfo {
  sessionsLeft: number
  days: number
  setsFactor: number
  loadFactor: number
  rir: string
  label: string
  advice: string
}

export interface ActiveWorkout {
  id: string
  type: WorkoutType
  date: ISODate
  startedAt: string
  notes: string
  timerEndAt: string | null
  timer: RestTimer | null
  exercises: WorkoutExercise[]
  periodId?: string
  week?: number
  deload?: boolean
  reentry?: ReentryInfo | null
  gymId?: string
}

export interface BodyEntry {
  id: string
  date: ISODate
  weight: number | null
  waist: number | null
  arm: number | null
  chest: number | null
  shoulders: number | null
}

export interface NutritionEntry {
  date: ISODate
  calories: number
  protein: number
  creatine: number
}

export type PauseReason = 'vacances' | 'maladie' | 'blessure' | 'fatigue' | 'autre'

export interface PauseRecord {
  startedAt: string
  endedAt: string
  reason?: PauseReason
  note?: string
}

export interface ProgramPause {
  active: boolean
  startedAt: string | null
  reason?: PauseReason
  plannedEnd?: ISODate | null
  note?: string
  history: PauseRecord[]
}

export interface PlanUpdateRecord {
  updateId: string
  basedOnSession: number | null
  summary: string
  appliedAt: string
  changeCount: number
  source?: 'claude' | 'program' | 'progression'
}

export interface NutritionTargets {
  calories: number
  proteinMin: number
  proteinMax: number
  creatine: number
  /** Day the calorie target last changed: the weight gets two weeks to answer before the next change. */
  caloriesChangedAt?: ISODate
  /** Protein follows the 7-day average weight (≈ 2 g/kg) instead of the fixed range. */
  adaptive?: boolean
}

/** Home equipment; body weight is always available. */
export type Equipment = 'dumbbells' | 'bench' | 'pullupBar' | 'bands'

export interface TrainingSetup {
  place: 'gym' | 'home'
  equipment: Equipment[]
}

export interface Prefs {
  theme: 'auto' | 'light' | 'dark'
  /** Interface language; auto follows the phone. */
  lang?: 'auto' | 'fr' | 'en'
  accent: 'blue' | 'orange'
  /** Loads follow the performance automatically after each session (undo available). */
  autoLoad: boolean
  /** End-of-rest notifications sent by the push server, delivered with the phone locked. */
  push: boolean
  sound: boolean
  notifications: boolean
  wakeLock: boolean
  trainingTime: string
  weighInTime: string
}

export interface Goals {
  targetWeightMin: number
  targetWeightMax: number
  targetWaist: number | null
  sessionsPerWeek: number
}

export interface Gym {
  id: string
  name: string
}

export type Look = 'athletique' | 'sec' | 'taille' | 'tres-sec'
export type Zone = 'epaules' | 'pectoraux' | 'dos' | 'bras' | 'abdos' | 'jambes' | 'mollets'

/** The physique aimed at: the look (a body-fat range), the zones to emphasise, a reference picture. */
export interface VisualGoal {
  look: Look
  zones: Zone[]
  /** Measured body fat (impedance scale, DEXA…), preferred over the waist estimate. */
  bodyFat: number | null
  /** Id of the reference picture in the photo store. */
  photoId?: string
  /** Cut length (weeks) the look asks for, fixed when the goal is applied: the plan follows it. */
  cutWeeks?: number
}

export interface AppState {
  version: number
  programId: string
  programRevision: number
  totalSessions: number
  completedSessions: number
  nextWorkoutType: WorkoutType
  workouts: Workout[]
  templates: Record<WorkoutType, Template>
  activeWorkout: ActiveWorkout | null
  lastCompletedWorkoutId: string | null
  appliedPlanUpdates: PlanUpdateRecord[]
  programPause: ProgramPause
  reentry: ReentryInfo | null
  nutritionTargets: NutritionTargets
  nutritionEntries: Record<ISODate, NutritionEntry>
  bodyEntries: BodyEntry[]
  settings: {
    goalDate: ISODate
    /** Monday of the program's first week; the report's data starts on 28 Sept 2026. */
    programStart?: ISODate
    /** Sessions logged before the program (the report's data), shown as a foundation phase. */
    foundationStart?: ISODate | null
    /** Where the sessions happen: a gym (machines) or at home with the equipment listed. */
    setup?: TrainingSetup
  }
  /** Deload brought forward after a general drop of performance. */
  manualDeload: { start: ISODate; end: ISODate } | null
  gyms: Gym[]
  /** Gym of the next session (the last one used). */
  gymId: string
  progressRevision: number
  profile: { heightCm: number; age: number; sex?: 'm' | 'f' }
  visualGoal: VisualGoal | null
  goals: Goals
  prefs: Prefs
  /** weekday (0 = Sunday) → planned session type */
  schedule: Record<number, WorkoutType | null>
  exerciseVideos: Record<string, string>
  archive?: {
    templatesBeforeResearch?: Record<string, Template>
    /** Sessions of the other training place, restored when switching back (gym ↔ home). */
    templatesBySetup?: Partial<Record<'gym' | 'home', Record<WorkoutType, Template>>>
  }
  meta: { createdAt: string; lastBackupAt: string | null; importedAt: string | null }
}

export interface Photo {
  id: string
  date: ISODate
  dataUrl: string
  name: string
}

export interface Backup {
  backupVersion: number
  exportedAt: string
  app?: string
  state: AppState
  photos: Photo[]
}
