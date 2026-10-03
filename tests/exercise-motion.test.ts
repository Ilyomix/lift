import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Box3, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { ARM_EXERCISES, createArmExercise } from '../src/lib/exerciseModelArms'

// Exercise the shipped rig/weights: a correct IK formula alone cannot detect a
// scale, axis or skin-export regression that makes hands/feet float in the app.
test('arm demonstrations retain their supports, elbow centres and continuous loop', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ARM_EXERCISES) {
    // Supply the actual parsed local asset to the private constructor without a
    // browser fetch; no production API is added solely for this regression test.
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createArmExercise(id, { body, equipment })!
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    const supports = [manifest.bones.left.foot, manifest.bones.right.foot]
    const elbows = [manifest.bones.left.forearm, manifest.bones.right.forearm]
    const landmarks = [...supports, ...elbows, manifest.bones.head, manifest.bones.left.hand, manifest.bones.right.hand]
    try {
      motion.update(0)
      const start = new Map(landmarks.map(name => [name, at(name)]))
      for (const phase of [.25, .5, .75, 1, 0]) {
        motion.update(phase)
        for (const name of supports) assert(at(name).distanceTo(start.get(name)!) < 1e-5, `${id}: foot left its support`)
        // Fully extended limbs retain a slight bend; allow natural millimetres,
        // not a shoulder swing that turns an elbow exercise into a press.
        for (const name of elbows) assert(at(name).distanceTo(start.get(name)!) < .012, `${id}: elbow drifted off its arc/pad`)
        body.root.traverse(object => {
          assert(object.matrixWorld.elements.every(Number.isFinite), `${id}: invalid joint transform`)
          if (object instanceof SkinnedMesh) object.computeBoundingBox()
        })
        assert(new Box3().setFromObject(body.root).min.y >= -.015, `${id}: skin crosses the floor`)
        if (phase === 0) for (const name of landmarks) assert(at(name).distanceTo(start.get(name)!) < 1e-5, `${id}: discontinuous loop`)
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
