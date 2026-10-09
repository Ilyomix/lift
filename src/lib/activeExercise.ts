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

/**
 * Machine taken: the exercise to do instead, the next one with sets left outside this one's
 * superset. The skipped one comes back once those are done; -1 when nothing else is left.
 */
export function deferredFocus(workout: ActiveWorkout, index: number): number {
  const { exercises } = workout
  if (!exercises[index]) return -1
  let first = index, last = index
  while (first > 0 && exercises[first - 1].supersetWithNext) first--
  while (last < exercises.length - 1 && exercises[last].supersetWithNext) last++
  for (let step = 1; step < exercises.length; step++) {
    const i = (last + step) % exercises.length
    if ((i < first || i > last) && hasPendingSets(exercises[i])) return i
  }
  return -1
}
