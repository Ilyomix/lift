import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Matrix4, Mesh, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createUpperExercise, UPPER_EXERCISES } from '../src/lib/exerciseModelUpper'

const unilateral = new Set(['single-arm-pulldown', 'cable-lateral-raise', 'one-arm-db-row', 'doorframe-row'])
const formerlySingular = new Set(['db-fly', 'one-arm-db-row', 'band-lateral-raise', 'cable-pullover', 'band-straight-arm-pulldown'])

test('upper grips stay mirrored, avoid wrist-axis singularities and align with the held shafts', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of UPPER_EXERCISES) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createUpperExercise(id, { body, equipment })!
    const sides = [manifest.bones.right, manifest.bones.left]
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    const axes = () => sides.map(side => {
      const along = at(side.palmLandmarks.middle).sub(at(side.hand)).normalize()
      const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
      return across.addScaledVector(along, -across.dot(along)).normalize()
    })
    const original = body.pose.bind(body)
    let args: Parameters<Athlete['pose']> | undefined
    let result: ReturnType<Athlete['pose']> | undefined
    let depth = 0
    body.pose = (...next) => {
      depth++
      const posed = original(...next)
      depth--
      if (!depth) { args = next; result = posed }
      return posed
    }
    let previous: Vector3[] | undefined
    try {
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20); equipment.root.updateMatrixWorld(true)
        const current = axes()
        if (!unilateral.has(id)) assert(current[0].clone().setX(-current[0].x).distanceTo(current[1]) < .02, `${id}: one palm is rolled away from its mirror`)
        if (previous) current.forEach((axis, i) => assert(axis.angleTo(previous![i]) < Math.PI / 3, `${id}: discontinuous wrist roll`))
        previous = current
        if (formerlySingular.has(id)) sides.forEach((side, i) => {
          if (args![6]?.flatHandSides?.[i]) return
          const direction = at(side.hand).sub(at(side.forearm)).normalize()
          const authored = new Vector3(...args![6]!.gripAxes![i]).normalize()
          assert(Math.abs(authored.dot(direction)) < .95, `${id}: grip axis approaches forearm axis`)
        })
        const shaftAxis = (mesh: Mesh) => new Vector3(0, 1, 0).applyQuaternion(mesh.getWorldQuaternion(new Quaternion())).normalize()
        equipment.root.traverse(object => {
          if (!(object instanceof Mesh) || !(object.geometry instanceof CylinderGeometry) || !object.visible || !object.parent?.visible) return
          const { radiusTop, height } = object.geometry.parameters
          // Pullover palms support a weight head, rather than wrapping its shaft.
          const dumbbellShaft = id !== 'db-pullover' && radiusTop === .015 && height === .27
          const looseHandle = radiusTop === .018 && height === .12 && object.parent === equipment.root
          if (!dumbbellShaft && !looseHandle) return
          const centre = object.getWorldPosition(new Vector3())
          const distances = result!.hands.map(point => point.distanceTo(centre))
          const index = distances[0] <= distances[1] ? 0 : 1
          assert(Math.abs(shaftAxis(object).dot(current[index])) > .995, `${id}: load/handle axis misses the palm`)
        })
        if (id === 'db-fly' && step === 20) sides.forEach((side, i) => {
          const along = at(side.palmLandmarks.middle).sub(at(side.hand)).normalize()
          const inward = current[i].clone().cross(along).multiplyScalar(i === 0 ? 1 : -1)
          assert(inward.dot(new Vector3(i === 0 ? 1 : -1, 0, 0)) > .7, 'supine fly palms must face one another at the top')
        })
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('two-handed pullover supports the upper weight head without penetrating either plate', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const motion = createUpperExercise('db-pullover', { body, equipment })!
  const plates: Mesh<CylinderGeometry>[] = []
  equipment.root.traverse(object => {
    if (object instanceof Mesh && object.geometry instanceof CylinderGeometry && object.geometry.parameters.radiusTop === .078) plates.push(object as Mesh<CylinderGeometry>)
  })
  assert.equal(plates.length, 2)
  const handNames = [manifest.bones.right.hand, manifest.bones.left.hand]
  const skin: { mesh: SkinnedMesh; palm: number[] }[] = []
  body.root.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return
    const joints = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight')
    const palm = Array.from({ length: joints.count }, (_, vertex) => {
      for (let i = 0; i < 4; i++) {
        const hand = handNames.indexOf(object.skeleton.bones[joints.getComponent(vertex, i)].name)
        if (hand !== -1 && weights.getComponent(vertex, i) > .5) return hand
      }
      return -1
    })
    skin.push({ mesh: object, palm })
  })
  try {
    for (let step = 0; step <= 20; step++) {
      motion.update(step / 20); equipment.root.updateMatrixWorld(true)
      const colliders = plates.map(plate => ({
        centre: plate.getWorldPosition(new Vector3()), inverse: new Matrix4().copy(plate.matrixWorld).invert(),
        radius: plate.geometry.parameters.radiusTop, half: plate.geometry.parameters.height / 2,
      }))
      const top = colliders[0].centre.y > colliders[1].centre.y ? colliders[0] : colliders[1]
      assert(Math.abs(colliders[0].centre.y - colliders[1].centre.y) > .20, 'pullover dumbbell must stay vertical')
      const gaps = [Infinity, Infinity]
      for (const { mesh, palm } of skin) {
        mesh.skeleton.update()
        const positions = mesh.geometry.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new Vector3().fromBufferAttribute(positions, vertex)
          mesh.applyBoneTransform(vertex, point).applyMatrix4(mesh.matrixWorld)
          if (palm[vertex] !== -1 && Math.hypot(point.x - top.centre.x, point.z - top.centre.z) < top.radius) {
            gaps[palm[vertex]] = Math.min(gaps[palm[vertex]], top.centre.y - top.half - point.y)
          }
          for (const plate of colliders) {
            if (Math.abs(point.y - plate.centre.y) > plate.half || Math.hypot(point.x - plate.centre.x, point.z - plate.centre.z) > plate.radius) continue
            const local = point.clone().applyMatrix4(plate.inverse)
            const depth = Math.min(plate.radius - Math.hypot(local.x, local.z), plate.half - Math.abs(local.y))
            assert(depth <= .002, `pullover phase${step / 20}: skin penetrates weight by ${(depth * 1000).toFixed(1)}mm`)
          }
        }
      }
      gaps.forEach(gap => assert(gap >= -.002 && gap <= .006, `pullover palm is ${(gap * 1000).toFixed(1)}mm from supporting head`))
    }
  } finally { body.dispose(); equipment.dispose() }
})
