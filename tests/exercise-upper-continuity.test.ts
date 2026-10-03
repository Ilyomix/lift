import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createUpperExercise } from '../src/lib/exerciseModelUpper'
import { exercisePhase, exerciseTempo } from '../src/lib/exercisePlayback'

const asset = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

for (const id of ['db-rear-delt-fly', 'lateral-raise', 'band-lateral-raise', 'cable-pullover', 'band-straight-arm-pulldown']) {
  test(`${id}: real arm rotations remain gradual through the isolation arc and at 60 fps`, async () => {
    const source = await asset
    const body = Reflect.construct(Athlete, [source, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createUpperExercise(id, { body, equipment })!
    const bones = [source.manifest.bones.right, source.manifest.bones.left]
      .flatMap(side => [side.upperArm, side.forearm, side.hand])
      .map(name => body.root.getObjectByName(name)!)
    const check = (phases: number[], maxDegrees: number) => {
      let previous: Quaternion[] | undefined
      for (const phase of phases) {
        motion.update(phase)
        const current = bones.map(bone => bone.getWorldQuaternion(new Quaternion()))
        if (previous) current.forEach((rotation, index) => {
          const degrees = rotation.angleTo(previous![index]) * 180 / Math.PI
          assert(degrees < maxDegrees, `${id} phase ${phase.toFixed(4)}, ${bones[index].name}: rotation jumps ${degrees.toFixed(2)}°`)
        })
        previous = current
      }
    }
    try {
      // These isolated arcs cover 80–106°. Allow more than twice that angular
      // rate, while rejecting the old middle-of-repetition elbow-plane spin.
      check(Array.from({ length: 121 }, (_, i) => i / 120), 2)
      const { outward, returning } = exerciseTempo(id)
      const duration = outward + returning
      check(Array.from({ length: Math.ceil(duration * 60) + 2 }, (_, frame) => exercisePhase(id, frame / 60)), 4)
    } finally { body.dispose(); equipment.dispose() }
  })
}

test('doorframe row bends the real knees forward gradually while the feet stay planted', async () => {
  const source = await asset
  const body = Reflect.construct(Athlete, [source, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const motion = createUpperExercise('doorframe-row', { body, equipment })!
  const sides = [source.manifest.bones.right, source.manifest.bones.left]
  const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
  motion.update(0)
  const feet = sides.map(side => at(side.foot))
  let previous: Vector3[] | undefined
  try {
    for (let step = 0; step <= 120; step++) {
      motion.update(step / 120)
      const knees = sides.map(side => at(side.shin))
      sides.forEach((side, index) => {
        const hip = at(side.thigh), ankle = at(side.foot)
        const legAxis = ankle.clone().sub(hip).normalize()
        const forward = new Vector3(0, 0, 1).addScaledVector(legAxis, -legAxis.z).normalize()
        assert(knees[index].clone().sub(hip).dot(forward) > .01, 'knee bends behind the hip–ankle line')
        assert(ankle.distanceTo(feet[index]) < .001, 'supporting foot moved')
        if (previous) assert(knees[index].distanceTo(previous[index]) < .004, `phase ${step / 120}: knee jumps around its support axis`)
      })
      previous = knees
    }
  } finally { body.dispose(); equipment.dispose() }
})
