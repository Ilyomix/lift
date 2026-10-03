import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

const ids = ['leg-extension', 'leg-curl', 'hip-adduction', 'hip-abduction']

test('seated machine grips keep symmetric, neutral wrists and relaxed upper arms', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ids) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const original = body.pose.bind(body)
    let contactError = Infinity
    body.pose = (...args) => {
      const result = original(...args)
      if (args[6]?.gripTargets) contactError = Math.max(...result.hands.map((hand, i) => hand.distanceTo(new Vector3(...args[4][i]))))
      return result
    }
    const motion = createLowerExercise(id, { body, equipment })!
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    try {
      for (const phase of [0, .25, .5, .75, 1]) {
        motion.update(phase)
        assert(contactError < .002, `${id}: palm has left its handle`)
        const poses = [manifest.bones.right, manifest.bones.left].map(side => {
          const shoulder = at(side.upperArm), elbow = at(side.forearm), wrist = at(side.hand)
          const along = at(side.palmLandmarks.middle).sub(wrist).normalize()
          const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
          // Finger bases are staggered. Project out their longitudinal offset
          // before comparing the palm's across-axis with a sagittal handle.
          across.addScaledVector(along, -across.dot(along)).normalize()
          return { shoulder, elbow, wrist, along, across }
        })
        for (const name of ['shoulder', 'elbow', 'wrist', 'along', 'across'] as const) {
          const mirrored = poses[0][name].clone(); mirrored.x *= -1
          assert(mirrored.distanceTo(poses[1][name]) < .001, `${id}: asymmetric ${name} at ${phase}`)
        }
        for (const { shoulder, elbow, wrist, along, across } of poses) {
          const wristBend = along.angleTo(wrist.clone().sub(elbow).normalize()) * 180 / Math.PI
          assert(wristBend < 10, `${id}: wrist bent ${wristBend.toFixed(1)} degrees at ${phase}`)
          assert(across.z > .98, `${id}: thumb/finger frame reversed along the handle`)
          assert(shoulder.y - elbow.y > .16, `${id}: raised elbow at ${phase}`)
          assert(Math.abs(elbow.x) - Math.abs(shoulder.x) < .18, `${id}: upper arm flares outward at ${phase}`)
          assert(Math.abs(elbow.z - shoulder.z) < .10, `${id}: elbow reaches far ahead/behind torso at ${phase}`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
