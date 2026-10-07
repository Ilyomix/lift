import type { Workout, WorkoutExercise, WorkoutType } from './types'

import type { ContextReason } from './trainingMessages'
export type { ContextReason } from './trainingMessages'
type Range = { minReps: number; maxReps: number }
const complete = (ex: WorkoutExercise) => !ex.skipped && ex.sets.some((s) => s.completed && (s.reps ?? 0) > 0)
export const comparisonContext = (ex: Pick<WorkoutExercise, 'comparisonContext'>) => ex.comparisonContext?.trim().toLowerCase() ?? ''
const sameRange = (a: Range, b: Range) => a.minReps === b.minReps && a.maxReps === b.maxReps

/** Chronological copies: imported arrays and backdated edits need not be in date order. */
export function chronological(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.sessionNumber - b.sessionNumber)
}

export function workoutsBefore(workouts: Workout[], current: Pick<Workout, 'id' | 'date'> & Partial<Pick<Workout, 'sessionNumber'>>): Workout[] {
  const number = current.sessionNumber ?? workouts.find(w => w.id === current.id)?.sessionNumber ?? Infinity
  return workouts.filter((w) => w.id !== current.id && (w.date < current.date || (w.date === current.date && w.sessionNumber < number)))
}

/**
 * Prefer the requested range and split, but never search through an explicitly flagged context change
 * to resurrect an older machine. The most recent performance remains a useful baseline even
 * when its range differs. `accept` supplies the caller's gym filter.
 */
export function previousComparablePerformance(
  workouts: Workout[], exerciseId: string, excludeId?: string, like?: Range,
  accept: (workout: Workout, exercise: WorkoutExercise) => boolean = () => true,
  preferredType?: WorkoutType,
): { workout: Workout; exercise: WorkoutExercise } | null {
  const self = workouts.find((w) => w.id === excludeId)
  const ordered = chronological(self ? workoutsBefore(workouts, self) : workouts.filter((w) => w.id !== excludeId))
  let latest: { workout: Workout; exercise: WorkoutExercise } | null = null
  let sameRangeFallback: { workout: Workout; exercise: WorkoutExercise } | null = null
  for (let i = ordered.length - 1; i >= 0; i--) {
    const workout = ordered[i]
    const exercise = workout.exercises.find((ex) => ex.exerciseId === exerciseId && complete(ex))
    if (!exercise || !accept(workout, exercise)) continue
    if (latest && (exercise.unit !== latest.exercise.unit || comparisonContext(exercise) !== comparisonContext(latest.exercise))) return sameRangeFallback ?? latest
    latest ??= { workout, exercise }
    if (!like || sameRange(exercise.prescription ?? exercise.target, like)) {
      if (!preferredType || workout.type === preferredType) return { workout, exercise }
      sameRangeFallback ??= { workout, exercise }
    }
  }
  return sameRangeFallback ?? latest
}

/** Different measurements must not become a physiological fatigue diagnosis. */
export function exerciseContextReason(now: WorkoutExercise, before: WorkoutExercise): ContextReason | null {
  if (now.unit !== before.unit) return 'unit-changed'
  const currentContext = comparisonContext(now)
  const oldContext = comparisonContext(before)
  if (currentContext !== oldContext) {
    return 'conditions-changed'
  }
  if (!sameRange(now.prescription ?? now.target, before.prescription ?? before.target)) {
    return 'rep-range-changed'
  }
  const restNow = now.prescription?.restSeconds ?? now.target.restSeconds
  const restBefore = before.prescription?.restSeconds ?? before.target.restSeconds
  if (restNow !== restBefore) return 'rest-changed'
  return null
}

export function workoutContextReason(now: Workout, exercise: WorkoutExercise, before: Workout, previous: WorkoutExercise): ContextReason | null {
  const reason = exerciseContextReason(exercise, previous)
  // An equipment change must not be hidden by the order of exercises in a split.
  if (reason === 'unit-changed' || reason === 'conditions-changed') return reason
  if (!!now.periodId !== !!before.periodId) {
    return 'program-changed'
  }
  if (reason === 'rep-range-changed') return reason
  if (now.type !== before.type) return 'workout-type-changed'
  // The sheet order is not execution order: users can jump between exercises.
  // Only recorded conditions can establish a change; other rows cannot prove prior fatigue.
  return reason
}
