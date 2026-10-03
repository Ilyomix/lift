import type { Athlete, Point } from './exerciseModelRig'
import type { ExerciseEquipment } from './exerciseModelEquipment'

export type ExerciseContext = { body: Athlete; equipment: ExerciseEquipment }
export type ExerciseMotion = {
  /** Eased repetition phase: 0=start, 1=contraction/end, then back to 0. */
  update: (phase: number) => void
  camera: Point
  target: Point
  height: number
}
