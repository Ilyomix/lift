import { infoFor } from './library'
import type { Workout, WorkoutExercise, WorkoutType } from './types'

import type { ContextReason } from './trainingMessages'
export type { ContextReason } from './trainingMessages'
type Range = { minReps: number; maxReps: number }
const complete = (ex: WorkoutExercise) => !ex.skipped && ex.sets.some((s) => s.completed && (s.reps ?? 0) > 0)
const context = (ex: WorkoutExercise) => ex.comparisonContext?.trim().toLowerCase() ?? ''
const sameRange = (a: Range, b: Range) => a.minReps === b.minReps && a.maxReps === b.maxReps

/** Chronological copies: imported arrays and backdated edits need not be in date order. */
export function chronological(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.sessionNumber - b.sessionNumber)
}

export function workoutsBefore(workouts: Workout[], current: Pick<Workout, 'id' | 'date' | 'sessionNumber'>): Workout[] {
  return workouts.filter((w) => w.id !== current.id && (w.date < current.date || (w.date === current.date && w.sessionNumber < current.sessionNumber)))
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
    if (latest && (exercise.unit !== latest.exercise.unit || context(exercise) !== context(latest.exercise))) return sameRangeFallback ?? latest
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
  const currentContext = context(now)
  const oldContext = context(before)
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

/** Work performed before this exercise on muscles it uses, including optional extra sets. */
function precedingWork(workout: Workout, exercise: WorkoutExercise): string {
  const own = infoFor(exercise.exerciseId, exercise).groups
  const index = workout.exercises.indexOf(exercise)
  if (index < 0) return ''
  return workout.exercises.slice(0, index).filter(complete).flatMap((ex) => {
    const groups = infoFor(ex.exerciseId, ex).groups
    const overlap = Object.keys(own).some((muscle) => (groups[muscle as keyof typeof groups] ?? 0) > 0)
    if (!overlap) return []
    const sets = ex.sets.filter((s) => s.completed && (s.reps ?? 0) > 0).length
    return [`${ex.exerciseId}:${sets}`]
  }).join('|')
}

export function workoutContextReason(now: Workout, exercise: WorkoutExercise, before: Workout, previous: WorkoutExercise): ContextReason | null {
  const reason = exerciseContextReason(exercise, previous)
  // An equipment change must not be hidden by the order of exercises in a split.
  if (reason === 'unit-changed' || reason === 'conditions-changed') return reason
  if (!!now.periodId !== !!before.periodId) {
    return 'program-changed'
  }
  if (reason === 'rep-range-changed') return reason
  const precedingChanged = precedingWork(now, exercise) !== precedingWork(before, previous)
  if (now.type !== before.type && (reason === 'rest-changed' || precedingChanged)) return 'workout-type-changed'
  return reason ?? (precedingChanged ? 'preceding-work-changed' : null)
}
