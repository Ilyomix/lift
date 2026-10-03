import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { ARM_EXERCISES, createArmExercise } from '../src/lib/exerciseModelArms'

const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

function bodySurfaces(body: Athlete) {
  // Fingers and palms deliberately contact the handles/weights. Exclude their
  // actual skin influences, never a broad volume that could hide a thigh/head hit.
  const hands = new Set<string>()
  for (const side of [body.manifest.bones.right, body.manifest.bones.left]) {
    body.root.getObjectByName(side.hand)!.traverse(bone => hands.add(bone.name))
  }
  const parts: { mesh: SkinnedMesh; indices: number[] }[] = []
  body.root.traverse(mesh => {
    if (!(mesh instanceof SkinnedMesh)) return
    const skin = mesh.geometry.getAttribute('skinIndex')
    const weights = mesh.geometry.getAttribute('skinWeight')
    const indices: number[] = []
    for (let index = 0; index < skin.count; index++) {
      const grip = [0, 1, 2, 3].some(joint => weights.getComponent(index, joint) > .1 && hands.has(mesh.skeleton.bones[skin.getComponent(index, joint)].name))
      if (!grip) indices.push(index)
    }
    parts.push({ mesh, indices })
  })
  return parts
}

test('dumbbell plates clear the shipped thighs, torso and head throughout arm movements', async () => {
  const asset = await source
  for (const id of ['seated-db-curl', 'incline-db-curl', 'db-curl', 'db-overhead-extension', 'db-skull-crusher']) {
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const plates: Mesh<CylinderGeometry>[] = []
    const dumbbell = equipment.dumbbell.bind(equipment)
    equipment.dumbbell = (...args) => {
      const group = dumbbell(...args)
      group.traverse(mesh => {
        if (mesh instanceof Mesh && mesh.geometry instanceof CylinderGeometry && mesh.material === equipment.rubber) plates.push(mesh as Mesh<CylinderGeometry>)
      })
      return group
    }
    const motion = createArmExercise(id, { body, equipment })!
    const parts = bodySurfaces(body)
    const world = new Vector3(), local = new Vector3()
    assert(plates.length >= 2, `${id}: the real dumbbell plates were not captured`)
    try {
      for (let step = 0; step <= 40; step++) {
        motion.update(step / 40)
        equipment.root.updateMatrixWorld(true)
        const colliders = plates.map(plate => ({
          inverse: plate.matrixWorld.clone().invert(),
          radius: plate.geometry.parameters.radiusTop + .005,
          halfHeight: plate.geometry.parameters.height / 2 + .005,
        }))
        for (const { mesh, indices } of parts) for (const index of indices) {
          mesh.getVertexPosition(index, world).applyMatrix4(mesh.matrixWorld)
          for (const collider of colliders) {
            local.copy(world).applyMatrix4(collider.inverse)
            assert(!(Math.abs(local.y) < collider.halfHeight && Math.hypot(local.x, local.z) < collider.radius), `${id} at ${step / 40}: a plate lacks 5 mm clearance from ${mesh.name}`)
          }
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('arm equipment supports and cable routes do not deeply intersect the shipped body', async () => {
  const asset = await source
  for (const id of ARM_EXERCISES) {
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const supports: Mesh[] = []
    const bar = equipment.bar.bind(equipment)
    const block = equipment.block.bind(equipment)
    const plate = equipment.plate.bind(equipment)
    equipment.bar = (...args) => { const mesh = bar(...args); supports.push(mesh); return mesh }
    equipment.block = (...args) => { const mesh = block(...args); supports.push(mesh); return mesh }
    equipment.plate = (...args) => { const mesh = plate(...args); supports.push(mesh); return mesh }
    const motion = createArmExercise(id, { body, equipment })!
    const parts = bodySurfaces(body)
    const world = new Vector3(), local = new Vector3()
    try {
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20)
        equipment.root.updateMatrixWorld(true)
        const colliders = supports.map(mesh => ({ mesh, inverse: mesh.matrixWorld.clone().invert(), scale: mesh.getWorldScale(new Vector3()) }))
        for (const { mesh, indices } of parts) for (const index of indices) {
          mesh.getVertexPosition(index, world).applyMatrix4(mesh.matrixWorld)
          for (const collider of colliders) {
            local.copy(world).applyMatrix4(collider.inverse)
            let intersects = false
            if (collider.mesh.geometry instanceof CylinderGeometry) {
              const geometry = collider.mesh.geometry.parameters
              // Measure the contact allowance in metres, not the normalized
              // bar's coordinates: long cables must not gain a large blind zone.
              intersects = Math.abs(local.y) < geometry.height / 2 - .002 / collider.scale.y && Math.hypot(local.x, local.z) < geometry.radiusTop - .002 / Math.max(collider.scale.x, collider.scale.z)
            } else if (collider.mesh.geometry.type === 'RoundedBoxGeometry') {
              const geometry = (collider.mesh.geometry as typeof collider.mesh.geometry & { parameters: { width: number; height: number; depth: number } }).parameters
              // Padding may compress at contact; penetrating more than 1 cm
              // into its inner box, as the former seat/preacher pad did, may not.
              const allowance = collider.mesh.material === equipment.pad ? .01 : .002
              intersects = Math.abs(local.x) < geometry.width / 2 - allowance / collider.scale.x && Math.abs(local.y) < geometry.height / 2 - allowance / collider.scale.y && Math.abs(local.z) < geometry.depth / 2 - allowance / collider.scale.z
            }
            assert(!intersects, `${id} at ${step / 20}: ${collider.mesh.geometry.type} intersects ${mesh.name}`)
          }
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
