import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Box3, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createUpperExercise, UPPER_EXERCISES } from '../src/lib/exerciseModelUpper'
import { LIBRARY } from '../src/lib/library'

const straightLegs = new Set(['push-up', 'feet-elevated-push-up', 'close-grip-push-up', 'pike-push-up', 'inverted-row'])
const suspendedFeet = new Set(['dips', 'pull-up', 'chin-up'])
const fixedElbowAngle = new Set([
  'pec-deck', 'cable-fly', 'band-fly', 'db-fly', 'db-pullover', 'cable-pullover',
  'band-straight-arm-pulldown', 'lateral-raise', 'cable-lateral-raise', 'band-lateral-raise',
  'reverse-pec-deck', 'db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise',
])

// These are geometric regressions on the shipped weighted human, not a claim
// that numeric reach alone validates exercise technique or camera readability.
test('40 upper motions preserve real limb reach, supports, isolation angles and loop continuity', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  assert.equal(UPPER_EXERCISES.size, 40)
  for (const id of UPPER_EXERCISES) {
    assert(id in LIBRARY, `unknown exercise ${id}`)
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const sides = [manifest.bones.right, manifest.bones.left]
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    const names = sides.flatMap(side => [side.foot, side.shin, side.hand, side.forearm]).concat(manifest.bones.head)
    const original = body.pose.bind(body)
    let depth = 0
    body.pose = (...args) => {
      depth++
      const result = original(...args)
      depth--
      if (depth) return result
      result.feet.forEach((point, i) => assert(point.distanceTo(new Vector3(...args[3][i])) < .004, `${id}: foot beyond leg reach`))
      sides.forEach((side, i) => {
        const actual = args[6]?.gripTargets ? result.hands[i] : at(side.hand)
        assert(actual.distanceTo(new Vector3(...args[4][i])) < .004, `${id}: hand beyond arm reach`)
      })
      return result
    }
    const motion = createUpperExercise(id, { body, equipment })!
    assert(motion, `${id}: missing motion`)
    const elbowRanges = sides.map(() => ({ min: Infinity, max: -Infinity }))
    const angle = (first: string, joint: string, end: string) => at(joint).sub(at(first)).angleTo(at(end).sub(at(joint))) * 180 / Math.PI
    try {
      motion.update(0)
      const start = new Map(names.map(name => [name, at(name)]))
      if (id === 'pull-up' || id === 'chin-up' || id === 'inverted-row') {
        sides.forEach(side => assert(angle(side.upperArm, side.forearm, side.hand) < 20, `${id}: start must have nearly straight arms`))
      }
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20)
        for (const [i, side] of sides.entries()) {
          if (!suspendedFeet.has(id)) assert(at(side.foot).distanceTo(start.get(side.foot)!) < .001, `${id}: fixed foot drifted`)
          if (straightLegs.has(id)) assert(angle(side.thigh, side.shin, side.foot) < 10, `${id}: knees folded in a braced pose`)
          const elbow = angle(side.upperArm, side.forearm, side.hand)
          elbowRanges[i].min = Math.min(elbowRanges[i].min, elbow)
          elbowRanges[i].max = Math.max(elbowRanges[i].max, elbow)
        }
        const bounds = new Box3()
        body.root.traverse(object => {
          assert(object.matrixWorld.elements.every(Number.isFinite), `${id}: non-finite joint transform`)
          if (step % 5 === 0 && object instanceof SkinnedMesh) {
            object.computeBoundingBox()
            bounds.union(object.boundingBox!.clone().applyMatrix4(object.matrixWorld))
          }
        })
        if (step % 5 === 0) {
          assert(bounds.min.y >= -.015, `${id}: skin crosses floor`)
          assert(bounds.getSize(new Vector3()).length() < 3.5, `${id}: distorted skin envelope`)
        }
      }
      if (fixedElbowAngle.has(id)) {
        for (const range of elbowRanges) assert(range.max - range.min < 2, `${id}: isolation arc changes elbow bend`)
      }
      motion.update(0)
      for (const name of names) assert(at(name).distanceTo(start.get(name)!) < 1e-6, `${id}: repetition does not return continuously`)
    } finally { body.dispose(); equipment.dispose() }
  }
})
