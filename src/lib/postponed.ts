import { diffDays } from './date'
import { L } from './i18n'
import { WORKOUT_TYPES, type AppState, type ISODate, type PostponedExercise, type TemplateExercise, type WorkoutExercise, type WorkoutType } from './types'

// A machine taken: the exercise can move to the next workout, whatever its type, and joins
// its end. The week keeps its sets; the load stays on the sheet the exercise comes from.

/** A moved exercise waits one week at most: by then its own workout has come round again. */
export const POSTPONE_DAYS = 7

/** Skip reason of a moved exercise, in both languages: shown in the current one. */
export const POSTPONED_REASONS = ['Reporté à la prochaine séance', 'Moved to next workout'] as const
export const postponedReason = () => L(...POSTPONED_REASONS)

const isType = (x: unknown): x is WorkoutType => typeof x === 'string' && (WORKOUT_TYPES as string[]).includes(x)
const isDate = (x: unknown): x is ISODate => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)

/** The planned exercise without what belongs to one workout: sets, verdicts, pairing. */
export function postponedTemplate(ex: WorkoutExercise | TemplateExercise): TemplateExercise {
  const {
    sets: _s, notes: _n, skipped: _k, skipReason: _r, validated: _v, comparison: _c, comparisonContext: _x, replacement: _p,
    prescription: _q, hint: _h, gymTrial: _g, postponedFrom: _f, supersetWithNext: _ss, ...template
  } = ex as WorkoutExercise
  return template
}

/** The sheet the exercise belongs to: a carried exercise keeps the sheet it was first planned on. */
export const sheetTypeOf = (ex: Pick<WorkoutExercise, 'postponedFrom'>, workoutType: WorkoutType): WorkoutType =>
  isType(ex.postponedFrom?.type) ? ex.postponedFrom.type : workoutType

/** What the next workout takes on: moves still fresh on `date`, once per exercise, none it already holds. */
export function postponedFor(
  state: Pick<AppState, 'postponed' | 'templates'>, date: ISODate, planned: Pick<TemplateExercise, 'exerciseId'>[] = [], excludeWorkout?: string,
): { item: PostponedExercise; exercise: TemplateExercise }[] {
  const seen = new Set(planned.map(e => e.exerciseId))
  const out: { item: PostponedExercise; exercise: TemplateExercise }[] = []
  for (const item of state.postponed ?? []) {
    const id = item.exercise.exerciseId
    const age = diffDays(item.fromDate, date)
    if (item.fromWorkoutId === excludeWorkout || seen.has(id) || age < 0 || age > POSTPONE_DAYS) continue
    seen.add(id)
    // The sheet as it stands now (a load moved since), the day's version if it left the sheet.
    const live = state.templates[item.fromType]?.exercises.find(e => e.exerciseId === id)
    out.push({ item, exercise: postponedTemplate(live ?? item.exercise) })
  }
  return out
}

/** Moves left in a workout, the one of `exerciseId` included or not. */
export function withoutPostponed(list: PostponedExercise[] | undefined, workoutId: string, exerciseId?: string): PostponedExercise[] | undefined {
  const kept = (list ?? []).filter(item => item.fromWorkoutId !== workoutId || (exerciseId !== undefined && item.exercise.exerciseId !== exerciseId))
  return kept.length ? kept : undefined
}

/** The state with these moves; no key at all when none is left. */
export function withPostponed<S extends Pick<AppState, 'postponed'>>(s: S, list: PostponedExercise[] | undefined): S {
  if (list?.length) return list === s.postponed ? s : { ...s, postponed: list }
  if (!('postponed' in s)) return s
  const { postponed: _p, ...rest } = s
  return rest as S
}

/** Only the moves a workout made itself: the others were offered to it. */
export function keptPostponed(list: PostponedExercise[] | undefined, workoutId: string): PostponedExercise[] | undefined {
  const kept = (list ?? []).filter(item => item.fromWorkoutId === workoutId)
  return kept.length ? kept : undefined
}

/** Backup input: well-formed moves only, at most one per exercise (the latest). */
export function normalizePostponed(raw: unknown): PostponedExercise[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PostponedExercise[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { exercise, fromType, fromDate, fromWorkoutId } = item as Partial<PostponedExercise>
    const t = exercise?.target
    if (!exercise || typeof exercise !== 'object' || typeof exercise.exerciseId !== 'string' || !exercise.exerciseId ||
        typeof exercise.name !== 'string' || !t || typeof t !== 'object' ||
        ![t.sets, t.minReps, t.maxReps, t.restSeconds].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) ||
        !isType(fromType) || !isDate(fromDate) || typeof fromWorkoutId !== 'string') continue
    const unit = exercise.unit === 'kg/main' || exercise.unit === 'PDC' ? exercise.unit : 'kg'
    const weight = typeof t.weight === 'number' && Number.isFinite(t.weight) ? t.weight : null
    const entry = { exercise: postponedTemplate({ ...exercise, unit, muscle: typeof exercise.muscle === 'string' ? exercise.muscle : '', target: { ...t, weight } }), fromType, fromDate, fromWorkoutId }
    const at = out.findIndex(other => other.exercise.exerciseId === exercise.exerciseId)
    if (at >= 0) out.splice(at, 1)
    out.push(entry)
  }
  return out.length ? out : undefined
}
