import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise, LOWER_EXERCISES } from '../src/lib/exerciseModelLower'

const asymmetric = new Set(['sissy-squat', 'single-leg-rdl', 'single-leg-calf-raise'])

test('lower grips keep neutral wrists, exact contacts and symmetric hand frames on the actual rig', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  let checked = 0
  for (const id of LOWER_EXERCISES) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const original = body.pose.bind(body)
    let depth = 0
    let input: Parameters<Athlete['pose']>, output: ReturnType<Athlete['pose']>
    body.pose = (...args) => {
      depth++
      const result = original(...args)
      if (--depth === 0) { input = args; output = result }
      return result
    }
    const motion = createLowerExercise(id, { body, equipment })!
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    let standingArmOffsets: Vector3[] | undefined
    try {
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20)
        if (!input![6]?.grip) continue
        checked++
        const poses = [manifest.bones.right, manifest.bones.left].map(side => {
          const elbow = at(side.forearm), wrist = at(side.hand)
          const along = at(side.palmLandmarks.middle).sub(wrist).normalize()
          const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
          across.addScaledVector(along, -across.dot(along)).normalize()
          return { elbow, wrist, along, across }
        })
        if (!asymmetric.has(id)) {
          for (const key of ['elbow', 'wrist', 'along', 'across'] as const) {
            const mirrored = poses[0][key].clone(); mirrored.x *= -1
            assert(mirrored.distanceTo(poses[1][key]) < .001, `${id}: asymmetric ${key} at ${step / 20}`)
          }
        }
        // Authored frames such as palms-up overhead contacts are a separate
        // contract. Unconstrained grips must not introduce an artificial bend.
        if (!input![6]?.gripDirections) {
          for (const { elbow, wrist, along } of poses) {
            const bend = along.angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI
            assert(bend < 10, `${id}: wrist bent ${bend.toFixed(1)} degrees at ${step / 20}`)
          }
          if (input![6]?.gripTargets) output!.hands.forEach((point, i) =>
            assert(point.distanceTo(new Vector3(...input![4][i])) < .002, `${id}: palm left its fixed grip`))
        }
        if (id === 'standing-calf-raise') {
          const offsets = poses.map(({ elbow }, i) => elbow.clone().sub(at([manifest.bones.right, manifest.bones.left][i].upperArm)))
          standingArmOffsets ??= offsets.map(offset => offset.clone())
          offsets.forEach((offset, i) => {
            assert(offset.y < -.20, 'standing calf: elbow must remain below the shoulder pad')
            assert(offset.distanceTo(standingArmOffsets![i]) < .001, 'standing calf: carriage motion folded the arm')
          })
        }
        if (id === 'romanian-deadlift' || id === 'db-romanian-deadlift') {
          equipment.root.updateMatrixWorld(true)
          const shafts: Mesh[] = []
          equipment.root.traverse(object => {
            if (object instanceof Mesh && object.geometry.type === 'CylinderGeometry' && object.material === equipment.metal) shafts.push(object)
          })
          assert.equal(shafts.length, id === 'romanian-deadlift' ? 1 : 2)
          poses.forEach(({ across }, i) => {
            const shaft = shafts.length === 1 ? shafts[0] : shafts[i]
            const center = shaft.getWorldPosition(new Vector3())
            const axis = new Vector3(0, 1, 0).transformDirection(shaft.matrixWorld)
            assert(Math.abs(across.dot(axis)) > .99, `${id}: fingers cross the weight shaft`)
            const offset = output!.hands[i].clone().sub(center)
            offset.addScaledVector(axis, -offset.dot(axis))
            assert(offset.length() < .002, `${id}: hand lost the weight shaft`)
          })
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
  assert(checked >= 400, 'the audit must include every lower gripping family')
})
