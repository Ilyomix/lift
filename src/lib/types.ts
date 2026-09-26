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
}

export interface Prefs {
  theme: 'auto' | 'light' | 'dark'
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
  settings: { goalDate: ISODate }
  progressRevision: number
  profile: { heightCm: number; age: number }
  goals: Goals
  prefs: Prefs
  /** weekday (0 = Sunday) → planned session type */
  schedule: Record<number, WorkoutType | null>
  exerciseVideos: Record<string, string>
  archive?: { templatesBeforeResearch?: Record<string, Template> }
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
