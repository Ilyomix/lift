import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Matrix4, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { ARM_EXERCISES, createArmExercise } from '../src/lib/exerciseModelArms'
import { UPPER_EXERCISES, createUpperExercise } from '../src/lib/exerciseModelUpper'
import { LOWER_EXERCISES, createLowerExercise } from '../src/lib/exerciseModelLower'

type SkinSample = { mesh: string; index: number; radius: number; side: number; wrist: boolean }
const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  gltf.scene.updateMatrixWorld(true)
  const samples: SkinSample[] = []
  for (const [side, bones] of [manifest.bones.right, manifest.bones.left].entries()) {
    const origin = gltf.scene.getObjectByName(bones.forearm)!.getWorldPosition(new Vector3())
    const axis = gltf.scene.getObjectByName(bones.hand)!.getWorldPosition(new Vector3()).sub(origin)
    const length = axis.length(); axis.normalize()
    gltf.scene.traverse(mesh => {
      if (!(mesh instanceof SkinnedMesh)) return
      const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
      for (let index = 0; index < indices.count; index++) {
        let forearm = 0, hand = 0
        for (let slot = 0; slot < 4; slot++) {
          const name = mesh.skeleton.bones[indices.getComponent(index, slot)].name
          if (name === bones.forearm) forearm += weights.getComponent(index, slot)
          if (name === bones.hand) hand += weights.getComponent(index, slot)
        }
        if (forearm + hand < .95) continue
        const offset = mesh.getVertexPosition(index, new Vector3()).applyMatrix4(mesh.matrixWorld).sub(origin)
        const axial = offset.dot(axis), fraction = axial / length
        const radius = offset.addScaledVector(axis, -axial).length()
        if (radius < .008 || fraction < .2 || fraction > 1.05) continue
        const wrist = fraction > .8 && forearm > .15 && hand > .15
        samples.push({ mesh: mesh.name, index, radius, side, wrist })
      }
    })
  }
  return { gltf, manifest, samples }
})()

const meshesOf = (body: Athlete) => {
  const result = new Map<string, SkinnedMesh>()
  body.root.traverse(mesh => { if (mesh instanceof SkinnedMesh) result.set(mesh.name, mesh) })
  return result
}
const pointAt = (meshes: Map<string, SkinnedMesh>, sample: SkinSample) => {
  const mesh = meshes.get(sample.mesh)!
  return mesh.getVertexPosition(sample.index, new Vector3()).applyMatrix4(mesh.matrixWorld)
}

test('overhead wrist skin retains its cross-section under large forearm twist', async () => {
  const asset = await source
  const rings = [0, 1].map(side => asset.samples.filter(sample => sample.side === side && sample.wrist))
  assert(rings.every(ring => ring.length >= 12), 'the shipped asset must provide a mixed forearm/hand wrist ring on both sides')
  for (const id of ['triceps-overhead-rope', 'db-overhead-extension', 'band-overhead-extension']) {
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment(), meshes = meshesOf(body)
    const motion = createArmExercise(id, { body, equipment })!
    try {
      for (const phase of [0, .25, .5, .75, 1]) {
        motion.update(phase)
        for (const [side, bones] of [asset.manifest.bones.right, asset.manifest.bones.left].entries()) {
          const elbow = body.root.getObjectByName(bones.forearm)!.getWorldPosition(new Vector3())
          const axis = body.root.getObjectByName(bones.hand)!.getWorldPosition(new Vector3()).sub(elbow).normalize()
          const ratios = rings[side].map(sample => {
            const offset = pointAt(meshes, sample).sub(elbow)
            return offset.addScaledVector(axis, -offset.dot(axis)).length() / sample.radius
          }).sort((a, b) => a - b)
          // The lower decile prevents a few remaining surface points from
          // hiding a pinched/collapsed wrist inside a generous bounding box.
          const lowerDecile = ratios[Math.floor(ratios.length * .1)]
          assert(lowerDecile > .65, `${id} at ${phase}, side ${side}: wrist radius falls to ${(lowerDecile * 100).toFixed(1)}% of bind skin`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('forearm skin has no half-turn branch jump and poses do not depend on playback order', async () => {
  const asset = await source
  // Distributed forearm vertices catch jumps in intermediate twist joints,
  // even when the final wrist/hand orientation differs by an equivalent 2π.
  const samples = asset.samples.filter((_, index) => index % 5 === 0)
  assert(samples.length >= 40)
  for (const id of [...ARM_EXERCISES, ...UPPER_EXERCISES, ...LOWER_EXERCISES]) {
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment(), meshes = meshesOf(body)
    const motion = createArmExercise(id, { body, equipment }) ?? createUpperExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment })
    assert(motion, id)
    const forearms = [asset.manifest.bones.right, asset.manifest.bones.left].map(bones => body.root.getObjectByName(bones.forearm)!)
    const capture = () => {
      const inverses = forearms.map(bone => new Matrix4().copy(bone.matrixWorld).invert())
      return samples.map(sample => pointAt(meshes, sample).applyMatrix4(inverses[sample.side]))
    }
    try {
      motion.update(.37); const reference = capture()
      let previous: Vector3[] | undefined
      for (let step = 0; step <= 100; step++) {
        motion.update(step / 100)
        const current = capture()
        if (previous) for (let vertex = 0; vertex < current.length; vertex++) {
          assert(current[vertex].distanceTo(previous[vertex]) < .015, `${id} at ${step / 100}: forearm skin jumps across the twist branch`)
        }
        previous = current
      }
      for (const phase of [1, .8, 0, .37]) motion.update(phase)
      capture().forEach((point, index) => assert(point.distanceTo(reference[index]) < 1e-6, `${id}: skin pose depends on playback order`))
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('runtime skin joints and weights never mutate the source or another athlete', async () => {
  const asset = await source
  const originals = new Map<string, { mesh: SkinnedMesh; indices: number[]; weights: number[]; inverses: number[][]; boneNames: string[] }>()
  asset.gltf.scene.traverse(mesh => {
    if (mesh instanceof SkinnedMesh) originals.set(mesh.name, {
      mesh,
      indices: Array.from(mesh.geometry.getAttribute('skinIndex').array),
      weights: Array.from(mesh.geometry.getAttribute('skinWeight').array),
      inverses: mesh.skeleton.boneInverses.map(matrix => [...matrix.elements]),
      boneNames: mesh.skeleton.bones.map(bone => bone.name),
    })
  })
  const first = Reflect.construct(Athlete, [asset, {}]) as Athlete
  const second = Reflect.construct(Athlete, [asset, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const firstMeshes = meshesOf(first), secondMeshes = meshesOf(second)
  const baseline = asset.samples.map(sample => pointAt(secondMeshes, sample))
  try {
    asset.samples.forEach((sample, index) => {
      const original = originals.get(sample.mesh)!.mesh
      const bindPoint = original.getVertexPosition(sample.index, new Vector3()).applyMatrix4(original.matrixWorld)
      // Skin weights are Float32; re-normalizing them may round below a micron.
      assert(baseline[index].distanceTo(bindPoint) < 1e-6, 'adding skin joints changed the exported bind shape')
    })
    createArmExercise('triceps-overhead-rope', { body: first, equipment })!.update(.5)
    for (const [name, original] of originals) {
      const a = firstMeshes.get(name)!, b = secondMeshes.get(name)!
      for (const attribute of ['skinIndex', 'skinWeight']) {
        assert.notEqual(a.geometry.getAttribute(attribute).array, original.mesh.geometry.getAttribute(attribute).array)
        assert.notEqual(a.geometry.getAttribute(attribute).array, b.geometry.getAttribute(attribute).array)
      }
      assert.notEqual(a.skeleton, b.skeleton)
      assert.notEqual(a.skeleton.boneInverses, original.mesh.skeleton.boneInverses)
      assert.notEqual(a.skeleton.boneInverses[0], b.skeleton.boneInverses[0])
      assert.deepEqual(Array.from(original.mesh.geometry.getAttribute('skinIndex').array), original.indices)
      assert.deepEqual(Array.from(original.mesh.geometry.getAttribute('skinWeight').array), original.weights)
      assert.deepEqual(original.mesh.skeleton.bones.map(bone => bone.name), original.boneNames)
      assert.deepEqual(original.mesh.skeleton.boneInverses.map(matrix => matrix.elements), original.inverses)
    }
    asset.samples.forEach((sample, index) => assert(pointAt(secondMeshes, sample).distanceTo(baseline[index]) < 1e-8, 'posing one athlete changed another athlete’s bind skin'))
  } finally { first.dispose(); second.dispose(); equipment.dispose() }
})
