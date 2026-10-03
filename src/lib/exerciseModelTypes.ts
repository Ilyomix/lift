import type { Athlete, Point } from './exerciseModelRig'
import type { ExerciseEquipment } from './exerciseModelEquipment'

export type ExerciseContext = { body: Athlete; equipment: ExerciseEquipment }
export type ExerciseMotion = {
  /** Eased geometric phase: 0=start, 1=end, then back to 0.
   * Squats/hinges start extended; their contraction is the return leg. */
  update: (phase: number) => void
  camera: Point
  target: Point
  height: number
}
