import { Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3 } from 'three'
import { Athlete, type MuscleWeights } from './exerciseModelRig'
import { ExerciseEquipment } from './exerciseModelEquipment'
import { createUpperExercise } from './exerciseModelUpper'
import { createArmExercise } from './exerciseModelArms'
import { createLowerExercise } from './exerciseModelLower'

export type ExerciseView = 'technique' | 'front' | 'back'
// Geometry and motions are immutable within a bundle; colors do not change bounds.
const movementFrames = new Map<string, Box3>()

export async function createExerciseModel(id: string, weights: MuscleWeights) {
  const body = await Athlete.load(weights)
  const equipment = new ExerciseEquipment()
  const context = { body, equipment }
  const motion = createUpperExercise(id, context) ?? createArmExercise(id, context) ?? createLowerExercise(id, context)
  const scene = new Scene()
  scene.add(body.root, equipment.root)
  scene.add(new HemisphereLight('#ffffff', '#879ab8', 1.2))
  const key = new DirectionalLight('#ffffff', 2.6)
  key.position.set(-3, 5, 4)
  const rim = new DirectionalLight('#cbdcff', 0.65)
  rim.position.set(2, 3, -3)
  scene.add(key, rim)
  const camera = new OrthographicCamera(-1.36, 1.36, 1.02, -1.02, 0.01, 30)
  let view: ExerciseView = motion ? 'technique' : 'front'
  // Measure the deformed skin and equipment across the movement once. The camera
  // stays still during playback; hands, feet and tall machines remain in frame.
  const movementBounds = movementFrames.get(id)?.clone() ?? new Box3()
  if (motion && movementBounds.isEmpty()) {
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      motion.update(phase)
      movementBounds.union(new Box3().setFromObject(body.root, true))
      movementBounds.union(new Box3().setFromObject(equipment.root, true))
    }
    movementFrames.set(id, movementBounds.clone())
  }
  const pose = (seconds: number) => {
    if (view === 'technique' && motion) {
      const cycle = seconds % 4.4
      const phase = cycle < 1.9 ? Math.min(1, cycle / 1.7) : Math.max(0, 1 - (cycle - 1.9) / 2.3)
      motion.update(phase * phase * (3 - 2 * phase))
    } else {
      body.pose([0, 0.9828, 0], 0,
        [[-0.155, 0.523, 0.028], [0.155, 0.523, 0.028]], [[-0.205, 0.076, 0.013], [0.205, 0.076, 0.013]],
        [[-0.38, 0.98, 0.1], [0.38, 0.98, 0.1]], [[-0.5, 1.18, -0.1], [0.5, 1.18, -0.1]],
        { footRotations: [[0, 0, 0], [0, 0, 0]] })
    }
  }
  const setView = (next: ExerciseView, aspect: number) => {
    view = next
    const technique = view === 'technique' && !!motion
    equipment.root.visible = technique
    let height = technique ? motion!.height : 2.04
    if (view === 'back') camera.position.set(0, 1.1, -4)
    else if (!technique) camera.position.set(0, 1.1, 4)
    else camera.position.set(...motion!.camera)
    const target = technique ? motion!.target : [0, 0.95, 0]
    camera.lookAt(target[0], target[1], target[2])
    camera.updateMatrixWorld(true)
    if (technique && !movementBounds.isEmpty()) {
      const framed = new Box3()
      const { min, max } = movementBounds
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        framed.expandByPoint(new Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse))
      }
      const center = framed.getCenter(new Vector3())
      const size = framed.getSize(new Vector3())
      camera.translateX(center.x)
      camera.translateY(center.y)
      height = Math.max(size.y, size.x / Math.max(aspect, 0.1)) * 1.10
    }
    camera.top = height / 2; camera.bottom = -height / 2
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2
    camera.updateProjectionMatrix()
  }
  setView(view, 4 / 3); pose(0)
  return {
    scene, camera, pose, setView, animated: !!motion,
    style: (accent: string, dark: boolean) => { body.style(accent, dark); equipment.style(dark) },
    dispose: () => { body.dispose(); equipment.dispose() },
  }
}
