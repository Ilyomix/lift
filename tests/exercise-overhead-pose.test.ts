import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createArmExercise } from '../src/lib/exerciseModelArms'

const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

for (const id of ['triceps-overhead-rope', 'db-overhead-extension', 'band-overhead-extension', 'triceps-rope', 'band-pushdown', 'db-skull-crusher']) {
  test(`${id}: elbow extension retains mirrored, untwisted grips`, async () => {
    const asset = await source
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createArmExercise(id, { body, equipment })!
    const overhead = id.includes('overhead')
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    let previousFlexion = Infinity
    try {
      for (let step = 0; step <= 20; step++) {
        const phase = step / 20
        motion.update(phase)
        const poses = [asset.manifest.bones.right, asset.manifest.bones.left].map(side => {
          const shoulder = at(side.upperArm), elbow = at(side.forearm), wrist = at(side.hand)
          const along = at(side.palmLandmarks.middle).sub(wrist).normalize()
          const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
          across.addScaledVector(along, -across.dot(along)).normalize()
          const flexion = 180 - elbow.clone().sub(shoulder).angleTo(elbow.clone().sub(wrist)) * 180 / Math.PI
          return { shoulder, elbow, wrist, along, across, flexion }
        })
        for (const landmark of ['shoulder', 'elbow', 'wrist', 'along', 'across'] as const) {
          const mirrored = poses[0][landmark].clone(); mirrored.x *= -1
          assert(mirrored.distanceTo(poses[1][landmark]) < .001, `${id} at ${phase}: ${landmark} is not mirrored`)
        }
        for (const { shoulder, elbow, wrist, along, across, flexion } of poses) {
          if (overhead) assert(elbow.y - shoulder.y > .23, `${id}: upper arm dropped during extension`)
          assert(along.angleTo(wrist.clone().sub(elbow)) < 10 * Math.PI / 180, `${id}: wrist bends away from forearm`)
          if (id !== 'db-overhead-extension') {
            // Neutral grips flex with the elbow in the sagittal
            // plane; rotating the forearm inward by 90° is not an extension.
            assert(Math.abs(across.x) < .05, `${id} at ${phase}: neutral grip twists sideways`)
          }
          if (phase === 0) {
            assert(flexion > (overhead ? 100 : 60) && flexion < (overhead ? 135 : 100), `${id}: folded elbow starts outside its working range`)
            if (overhead) assert(wrist.z < shoulder.z - .17, `${id}: folded wrist must pass behind the head`)
          }
          if (phase === 1) assert(flexion > 5 && flexion < 20, `${id}: final elbow remains bent ${flexion.toFixed(1)}°`)
        }
        assert(poses[0].flexion <= previousFlexion + .1, `${id}: extension reverses before its endpoint`)
        previousFlexion = poses[0].flexion
      }
    } finally { body.dispose(); equipment.dispose() }
  })
}
