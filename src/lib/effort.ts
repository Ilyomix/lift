import type { WorkoutExercise, WorkoutSet } from './types'

/** The dated prescription wins over the reusable exercise template. */
export function effortTarget(ex: Pick<WorkoutExercise, 'prescription' | 'target'>): string | undefined {
  return ex.prescription?.rir?.trim() || ex.target.rir?.trim() || undefined
}

/** A failure flag takes precedence over a contradictory RIR entry. Missing is not zero. */
export function recordedRir(set: Pick<WorkoutSet, 'rir' | 'flags'>): number | null {
  if (set.flags.includes('failure')) return 0
  return typeof set.rir === 'number' && Number.isFinite(set.rir) && set.rir >= 0 && set.rir <= 10 ? set.rir : null
}

export function effortBounds(value: string | undefined): number[] {
  return (value ?? '').match(/\d+(?:[.,]\d+)?/g)?.map((n) => Number(n.replace(',', '.'))).filter((n) => n >= 0 && n <= 10) ?? []
}

/** Count prescribed work separately from optional extra sets, without discarding either. */
export function prescribedSets(ex: Pick<WorkoutExercise, 'prescription' | 'target'>): number {
  const n = ex.prescription?.sets ?? ex.target.sets
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
}

/** Extra weekly-volume sets are work, but not an additional condition for load progression. */
export function progressionSets(ex: Pick<WorkoutExercise, 'prescription' | 'target'>): number {
  const n = ex.prescription?.planSets ?? prescribedSets(ex)
  return Number.isFinite(n) ? Math.max(1, Math.min(prescribedSets(ex), Math.floor(n))) : prescribedSets(ex)
}

export function effortSummary(exercises: WorkoutExercise[]) {
  let completed = 0
  let logged = 0
  let failures = 0
  let belowTarget = 0
  let extra = 0
  for (const ex of exercises) {
    if (ex.skipped) continue
    const bounds = effortBounds(effortTarget(ex))
    const minimum = bounds.length ? Math.min(...bounds) : null
    const done = ex.sets.filter((set) => set.completed && (set.reps ?? 0) > 0)
    completed += done.length
    extra += Math.max(0, done.length - prescribedSets(ex))
    for (const set of done) {
      const rir = recordedRir(set)
      if (rir === null) continue
      logged++
      if (rir === 0) failures++
      if (minimum !== null && rir < minimum) belowTarget++
    }
  }
  return { completed, logged, failures, belowTarget, extra }
}
