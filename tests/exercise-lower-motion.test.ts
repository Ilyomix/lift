import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Box3, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise, LOWER_EXERCISES } from '../src/lib/exerciseModelLower'
import { EXERCISE_ANATOMY, exerciseMuscles } from '../src/lib/exerciseModelCatalog'
import { LIBRARY } from '../src/lib/library'

const fixedFeet: Record<string, number[]> = {
  'hack-squat': [0, 1], 'smith-squat': [0, 1], 'goblet-squat': [0, 1],
  'bulgarian-split-squat': [0, 1], 'romanian-deadlift': [0, 1], 'db-romanian-deadlift': [0, 1],
  'single-leg-rdl': [0], 'hip-thrust': [0, 1], 'smith-hip-thrust': [0, 1], 'glute-bridge': [0, 1], 'db-hip-thrust': [0, 1],
  'single-leg-hip-thrust': [0], 'back-extension-45': [0, 1], 'nordic-curl': [0, 1],
  'cable-crunch': [0, 1], crunch: [0, 1],
}
const fixedToes: Record<string, number[]> = {
  'sissy-squat': [0, 1], 'standing-calf-raise': [0, 1], 'seated-calf-raise': [0, 1],
  'single-leg-calf-raise': [0],
}

test('anatomy covers the library independently of volume credits and uses real surface regions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  assert.deepEqual(Object.keys(EXERCISE_ANATOMY).sort(), Object.keys(LIBRARY).sort())
  for (const [id, weights] of Object.entries(EXERCISE_ANATOMY)) {
    assert(Object.values(weights).includes(1), `${id}: primary region missing`)
    for (const [region, category] of Object.entries(weights)) {
      assert(region in manifest.muscleMaterials, `${id}: surface ${region} is not segmented`)
      assert(category === 1 || category === .5, `${id}: non-ordinal anatomical category`)
    }
  }
  const row = exerciseMuscles('chest-supported-row')
  assert.equal(row.lats, 1); assert.equal(row.upperBack, 1)
  assert.equal(row.lowerBack, undefined)
  assert.equal('back' in row, false)
  assert.equal(exerciseMuscles('prone-y-raise').upperBack, 1)
  assert.equal(exerciseMuscles('hip-adduction').adductors, 1)
  // The display owns its values; callers cannot mutate either training data or later maps.
  row.lats = 0
  assert.equal(exerciseMuscles('chest-supported-row').lats, 1)
  assert.equal(LIBRARY['chest-supported-row'].groups.back, 1)
  assert.deepEqual(exerciseMuscles('unknown'), {})
})

test('all 32 lower/core motions retain supports, reachable limbs and floor clearance on the shipped human', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  assert.equal(LOWER_EXERCISES.size, 32)
  for (const id of LOWER_EXERCISES) {
    assert(id in LIBRARY, `unknown motion ${id}`)
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const sides = [manifest.bones.right, manifest.bones.left]
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    const names = sides.flatMap(side => [side.foot, side.toe, side.hand, side.shin]).concat(manifest.bones.head)
    const original = body.pose.bind(body)
    let depth = 0
    body.pose = (...args) => {
      depth++
      const result = original(...args)
      depth--
      if (depth) return result
      result.feet.forEach((point, i) => assert(point.distanceTo(new Vector3(...args[3][i])) < .004, `${id}: foot target exceeds leg reach`))
      sides.forEach((side, i) => assert((args[6]?.gripTargets ? result.hands[i] : at(side.hand)).distanceTo(new Vector3(...args[4][i])) < .004, `${id}: hand target exceeds arm reach`))
      return result
    }
    const motion = createLowerExercise(id, { body, equipment })!
    assert(motion, `${id}: factory returned no motion`)
    try {
      motion.update(0)
      const start = new Map(names.map(name => [name, at(name)]))
      const loop = [...Array.from({ length: 41 }, (_, i) => i / 40), 0]
      for (const phase of loop) {
        motion.update(phase)
        for (const i of fixedFeet[id] ?? []) assert(at(sides[i].foot).distanceTo(start.get(sides[i].foot)!) < .001, `${id}: fixed foot drift`)
        for (const i of fixedToes[id] ?? []) assert(at(sides[i].toe).distanceTo(start.get(sides[i].toe)!) < .001, `${id}: forefoot left step/ground`)
        const bounds = new Box3()
        body.root.traverse(object => {
          assert(object.matrixWorld.elements.every(Number.isFinite), `${id}: invalid joint transform`)
          if (object instanceof SkinnedMesh) {
            object.computeBoundingBox()
            bounds.union(object.boundingBox!.clone().applyMatrix4(object.matrixWorld))
          }
        })
        assert(bounds.min.y >= -.015, `${id}: skin crossed floor at phase ${phase}: ${bounds.min.y}`)
        assert(bounds.getSize(new Vector3()).length() < 3.5, `${id}: distorted skin envelope`)
        if (phase === 0) for (const name of names) assert(at(name).distanceTo(start.get(name)!) < 1e-6, `${id}: discontinuous repetition loop`)
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
