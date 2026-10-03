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

test('closed grips oppose the thumbs to the fingers instead of leaving them splayed', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ['seated-db-curl', 'triceps-overhead-rope', 'lat-pulldown', 'leg-extension']) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createArmExercise(id, { body, equipment }) ?? createUpperExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment })
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    try {
      for (const phase of [0, .5, 1]) {
        motion!.update(phase)
        for (const side of [manifest.bones.right, manifest.bones.left]) {
          const wrist = at(side.hand)
          const middle = at(side.palmLandmarks!.middle).sub(wrist)
          const thumb = at(side.fingers!.thumb[2])
          assert(thumb.clone().sub(wrist).dot(middle.clone().normalize()) > middle.length() * .75, `${id}: thumb remains abducted away from the grip`)
          assert(thumb.distanceTo(at(side.fingers!.index[2])) < .035, `${id}: thumb fails to oppose the curled fingers`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
