import type { ActiveWorkout, WorkoutExercise } from './types'

export const hasPendingSets = (exercise: WorkoutExercise | undefined): boolean =>
  !!exercise && !exercise.skipped && exercise.sets.some(set => !set.completed)

/** Search forward, wrapping to unfinished exercises earlier in the workout. */
export function nextPendingExerciseIndex(exercises: WorkoutExercise[], after: number): number {
  for (let step = 1; step <= exercises.length; step++) {
    const index = (after + step) % exercises.length
    if (hasPendingSets(exercises[index])) return index
  }
  return -1
}

/** One occurrence-based focus for the logger and native activity, independent of rest. */
export function currentExerciseIndex(workout: ActiveWorkout): number {
  const focus = workout.activeExerciseIndex
  if (typeof focus === 'number' && Number.isInteger(focus) && focus >= 0 && focus < workout.exercises.length) {
    return hasPendingSets(workout.exercises[focus]) ? focus : nextPendingExerciseIndex(workout.exercises, focus)
  }
  // Drafts saved before explicit focus existed used the rest's next-exercise label.
  const nextName = workout.timer?.next?.replace(/^(?:Série|Set) \d+(?:\/\d+)? · /, '')
  const legacy = nextName ? workout.exercises.findIndex(exercise => exercise.name === nextName && hasPendingSets(exercise)) : -1
  return legacy >= 0 ? legacy : workout.exercises.findIndex(hasPendingSets)
}
