import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Matrix4, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createArmExercise } from '../src/lib/exerciseModelArms'

const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

for (const id of ['triceps-overhead-rope', 'db-overhead-extension', 'band-overhead-extension', 'triceps-rope', 'band-pushdown', 'db-skull-crusher']) {
  test(`${id}: elbow extension retains mirrored, untwisted grips`, async () => {
    const asset = await source
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createArmExercise(id, { body, equipment })!
    const overhead = id.includes('overhead')
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    let previousFlexion = Infinity
    try {
      for (let step = 0; step <= 20; step++) {
        const phase = step / 20
        motion.update(phase)
        const poses = [asset.manifest.bones.right, asset.manifest.bones.left].map(side => {
          const shoulder = at(side.upperArm), elbow = at(side.forearm), wrist = at(side.hand)
          const along = at(side.palmLandmarks.middle).sub(wrist).normalize()
          const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
          across.addScaledVector(along, -across.dot(along)).normalize()
          const flexion = 180 - elbow.clone().sub(shoulder).angleTo(elbow.clone().sub(wrist)) * 180 / Math.PI
          return { shoulder, elbow, wrist, along, across, flexion }
        })
        for (const landmark of ['shoulder', 'elbow', 'wrist', 'along', 'across'] as const) {
          const mirrored = poses[0][landmark].clone(); mirrored.x *= -1
          assert(mirrored.distanceTo(poses[1][landmark]) < .001, `${id} at ${phase}: ${landmark} is not mirrored`)
        }
        for (const { shoulder, elbow, wrist, along, across, flexion } of poses) {
          if (overhead) assert(elbow.y - shoulder.y > .23, `${id}: upper arm dropped during extension`)
          // Supporting a weight head uses an open, extended wrist; wrapping a
          // rope/handle keeps the wrist neutral. Both have explicit limits.
          const wristLimit = id === 'db-overhead-extension' ? 70 : 10
          assert(along.angleTo(wrist.clone().sub(elbow)) < wristLimit * Math.PI / 180, `${id}: wrist exceeds its ${wristLimit}° grip limit`)
          if (id !== 'db-overhead-extension') {
            // Neutral grips flex with the elbow in the sagittal
            // plane; rotating the forearm inward by 90° is not an extension.
            assert(Math.abs(across.x) < .05, `${id} at ${phase}: neutral grip twists sideways`)
          }
          if (phase === 0) {
            assert(flexion > (overhead ? 100 : 60) && flexion < (overhead ? 135 : 100), `${id}: folded elbow starts outside its working range`)
            if (overhead) assert(wrist.z < shoulder.z - .17, `${id}: folded wrist must pass behind the head`)
          }
          if (phase === 1) assert(flexion > 5 && flexion < 20, `${id}: final elbow remains bent ${flexion.toFixed(1)}°`)
        }
        assert(poses[0].flexion <= previousFlexion + .1, `${id}: extension reverses before its endpoint`)
        previousFlexion = poses[0].flexion
      }
    } finally { body.dispose(); equipment.dispose() }
  })
}

test('two-handed overhead extension supports the upper weight head without penetrating either plate', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const motion = createArmExercise('db-overhead-extension', { body, equipment })!
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
      assert(Math.abs(colliders[0].centre.y - colliders[1].centre.y) > .19, 'overhead dumbbell must remain upright')
      const normal = top.centre.clone().sub(colliders.find(plate => plate !== top)!.centre).normalize()
      for (const [sideIndex, side] of [manifest.bones.right, manifest.bones.left].entries()) {
        const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
        const along = at(side.palmLandmarks.middle).sub(at(side.hand)).normalize()
        const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
        const palmNormal = across.cross(along).normalize().multiplyScalar(sideIndex === 0 ? 1 : -1)
        assert(palmNormal.dot(normal) > .995, 'both palms must face the underside of the supported weight head')
      }
      const gaps = [Infinity, Infinity]
      for (const { mesh, palm } of skin) {
        mesh.skeleton.update()
        const positions = mesh.geometry.getAttribute('position')
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new Vector3().fromBufferAttribute(positions, vertex)
          mesh.applyBoneTransform(vertex, point).applyMatrix4(mesh.matrixWorld)
          const radial = point.clone().sub(top.centre)
          const height = radial.dot(normal)
          if (palm[vertex] !== -1 && radial.addScaledVector(normal, -height).length() < top.radius) {
            gaps[palm[vertex]] = Math.min(gaps[palm[vertex]], -top.half - height)
          }
          for (const plate of colliders) {
            const local = point.clone().applyMatrix4(plate.inverse)
            const depth = Math.min(plate.radius - Math.hypot(local.x, local.z), plate.half - Math.abs(local.y))
            assert(depth <= .002, `overhead phase${step / 20}: skin penetrates weight by ${(depth * 1000).toFixed(1)}mm`)
          }
        }
      }
      gaps.forEach(gap => assert(gap >= -.002 && gap <= .006, `overhead palm is ${(gap * 1000).toFixed(1)}mm from supporting head`))
    }
  } finally { body.dispose(); equipment.dispose() }
})
