// Clips use a geometric phase, not time. These start upright/extended and
// reach their lowered position at phase 1; their outward leg is the descent.
const DESCENT_FIRST = new Set([
  'goblet-squat', 'smith-squat', 'hack-squat', 'bulgarian-split-squat', 'sissy-squat',
  'leg-press', 'romanian-deadlift', 'db-romanian-deadlift', 'single-leg-rdl', 'nordic-curl',
])

export function exerciseTempo(id: string): { outward: number; returning: number } {
  if (id === 'nordic-curl') return { outward: 3, returning: 2.1 }
  return DESCENT_FIRST.has(id)
    ? { outward: 2.6, returning: 1.9 }
    : { outward: 1.9, returning: 2.6 }
}

/** Continuous repetition: no frozen end frames; velocity and acceleration
 * reach zero together at each reversal, including the loop boundary. */
export function exercisePhase(id: string, seconds: number): number {
  const { outward, returning } = exerciseTempo(id)
  const cycle = Math.max(0, Number.isFinite(seconds) ? seconds : 0) % (outward + returning)
  const reverse = cycle > outward
  const t = reverse ? (cycle - outward) / returning : cycle / outward
  const eased = t * t * t * (10 + t * (-15 + 6 * t))
  return reverse ? 1 - eased : eased
}
