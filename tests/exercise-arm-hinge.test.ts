import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { ARM_EXERCISES, createArmExercise } from '../src/lib/exerciseModelArms'
import { UPPER_EXERCISES, createUpperExercise } from '../src/lib/exerciseModelUpper'
import { LOWER_EXERCISES, createLowerExercise } from '../src/lib/exerciseModelLower'

test('every exercise bends the skinned elbows in their anatomical hinge plane', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of [...ARM_EXERCISES, ...UPPER_EXERCISES, ...LOWER_EXERCISES]) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    const hinges = [manifest.bones.right, manifest.bones.left].map(side => {
      const bone = body.root.getObjectByName(side.upperArm)!
      const normal = () => at(side.forearm).sub(at(side.upperArm)).cross(at(side.hand).sub(at(side.forearm))).normalize()
      const bind = normal().applyQuaternion(bone.getWorldQuaternion(new Quaternion()).invert())
      return { bone, normal, bind }
    })
    const motion = createArmExercise(id, { body, equipment }) ?? createUpperExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment })
    try {
      assert(motion, id)
      for (const phase of [0, .25, .5, .75, 1]) {
        motion.update(phase)
        for (const hinge of hinges) {
          const skinNormal = hinge.bind.clone().applyQuaternion(hinge.bone.getWorldQuaternion(new Quaternion()))
          const error = skinNormal.angleTo(hinge.normal()) * 180 / Math.PI
          assert(error < .1, `${id} at ${phase}: elbow folds ${error.toFixed(1)}° across its anatomical hinge`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
