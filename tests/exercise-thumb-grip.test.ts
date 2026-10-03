import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createArmExercise } from '../src/lib/exerciseModelArms'
import { createUpperExercise } from '../src/lib/exerciseModelUpper'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

test('closed grips oppose the actual thumb tip across the palm without leaving its distal joint in bind pose', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ['seated-db-curl', 'triceps-overhead-rope', 'lat-pulldown', 'leg-extension']) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const sides = [manifest.bones.right, manifest.bones.left]
    // The last bone's origin is an interphalangeal joint, not the thumb tip.
    // Measure the exported distal tail instead of forcing that joint into
    // the index finger. Solid/skin contact is tested independently.
    const tips = sides.map(side => {
      const name = side.fingers!.thumb.at(-1)!
      const bone = body.root.getObjectByName(name)!
      return { bone, local: bone.worldToLocal(new Vector3(...manifest.restLandmarks![name].tail)) }
    })
    const motion = createArmExercise(id, { body, equipment }) ?? createUpperExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment })
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    try {
      for (const phase of [0, .5, 1]) {
        motion!.update(phase)
        const posedTips: Vector3[] = []
        for (const [i, side] of sides.entries()) {
          const wrist = at(side.hand)
          const along = at(side.palmLandmarks!.middle).sub(wrist).normalize()
          const across = at(side.palmLandmarks!.index).sub(at(side.palmLandmarks!.pinky))
          across.addScaledVector(along, -across.dot(along)).normalize()
          const tip = tips[i].bone.localToWorld(tips[i].local.clone())
          const distalJoint = tips[i].bone.getWorldPosition(new Vector3())
          const distal = tip.clone().sub(distalJoint).normalize()
          assert(distal.dot(across) < -.7, `${id}: terminal thumb still points out of the grip instead of across the palm`)
          const thumbBase = at(side.fingers!.thumb[0])
          assert(Math.abs(tip.clone().sub(wrist).dot(across)) < Math.abs(thumbBase.clone().sub(wrist).dot(across)), `${id}: thumb tip does not oppose toward the palm centre`)
          const previous = at(side.fingers!.thumb.at(-2)!)
          const flexion = distal.angleTo(distalJoint.clone().sub(previous))
          assert(flexion > 20 * Math.PI / 180 && flexion < 100 * Math.PI / 180, `${id}: terminal thumb is straight or folded back on itself`)
          posedTips.push(tip)
        }
        assert(posedTips[0].clone().setX(-posedTips[0].x).distanceTo(posedTips[1]) < .001, `${id}: the thumb tips are not mirrored`)
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
