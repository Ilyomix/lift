import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { BufferAttribute, BufferGeometry, type CylinderGeometry, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { ARM_EXERCISES, createArmExercise } from '../src/lib/exerciseModelArms'
import { UPPER_EXERCISES, createUpperExercise } from '../src/lib/exerciseModelUpper'
import { LOWER_EXERCISES, createLowerExercise } from '../src/lib/exerciseModelLower'

const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

function create(id: string, asset: Awaited<typeof source>) {
  const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const motion = createUpperExercise(id, { body, equipment }) ?? createArmExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment })
  assert(motion, id)
  return { body, equipment, motion }
}

// The deformed skin as one triangle soup, with vertices weighted to a hand flagged.
function bake(body: Athlete, handBones: Set<string>) {
  const P: number[] = [], N: number[] = [], hand: boolean[] = [], T: number[] = []
  body.root.traverse(mesh => {
    if (!(mesh instanceof SkinnedMesh)) return
    const count = mesh.geometry.getAttribute('position').count, base = P.length / 3
    const baked = new Float32Array(count * 3), v = new Vector3()
    const joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      baked.set([v.x, v.y, v.z], i * 3); P.push(v.x, v.y, v.z)
      hand.push([0, 1, 2, 3].some(j => weights.getComponent(i, j) > .3 && handBones.has(mesh.skeleton.bones[joints.getComponent(i, j)].name)))
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(baked, 3))
    if (mesh.geometry.index) { geometry.setIndex(mesh.geometry.index); for (let i = 0; i < mesh.geometry.index.count; i++) T.push(base + mesh.geometry.index.getX(i)) }
    geometry.computeVertexNormals()
    const normals = geometry.getAttribute('normal')
    for (let i = 0; i < count; i++) N.push(normals.getX(i), normals.getY(i), normals.getZ(i))
    geometry.dispose()
  })
  return { P, N, hand, T }
}

// Enclosed when the nearest skin vertex faces away and most axis rays first
// leave through a back face. Hands are skipped: a closed grip holds its handle.
function enclosed(skin: ReturnType<typeof bake>, grid: Map<string, number[]>, point: Vector3) {
  const { P, N, hand, T } = skin, cell = (value: number) => Math.floor(value / .03)
  let nearest = -1, best = Infinity
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) for (let z = -2; z <= 2; z++) {
    for (const k of grid.get(`${cell(point.x) + x},${cell(point.y) + y},${cell(point.z) + z}`) ?? []) {
      const d = (P[k * 3] - point.x) ** 2 + (P[k * 3 + 1] - point.y) ** 2 + (P[k * 3 + 2] - point.z) ** 2
      if (d < best) { best = d; nearest = k }
    }
  }
  if (nearest < 0 || hand[nearest]) return false
  const facing = (point.x - P[nearest * 3]) * N[nearest * 3] + (point.y - P[nearest * 3 + 1]) * N[nearest * 3 + 1] + (point.z - P[nearest * 3 + 2]) * N[nearest * 3 + 2]
  if (facing >= 0) return false
  let back = 0
  for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    let first = Infinity, fromInside = false
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3
      const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]
      const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]
      if (Math.abs(det) < 1e-12) continue
      const s = [point.x - P[a], point.y - P[a + 1], point.z - P[a + 2]]
      const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det
      if (u < 0 || u > 1) continue
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]]
      const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det
      if (v < 0 || u + v > 1) continue
      const distance = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det
      if (distance > 1e-6 && distance < first) { first = distance; fromInside = det < 0 }
    }
    if (first < Infinity && fromInside) back++
  }
  return back >= 4
}

test('bars, dumbbells and frames never run through the skinned athlete', async () => {
  const asset = await source
  const handBones = new Set<string>()
  for (const id of [...UPPER_EXERCISES, ...ARM_EXERCISES, ...LOWER_EXERCISES]) {
    const { body, equipment, motion } = create(id, asset)
    if (!handBones.size) for (const side of [asset.manifest.bones.right, asset.manifest.bones.left]) body.root.getObjectByName(side.hand)!.traverse(bone => handBones.add(bone.name))
    try {
      for (const phase of [0, .2, .4, .6, .8, 1]) {
        motion.update(phase)
        equipment.root.updateMatrixWorld(true)
        const skin = bake(body, handBones), grid = new Map<string, number[]>()
        for (let k = 0; k < skin.P.length / 3; k++) {
          const key = [0, 1, 2].map(axis => Math.floor(skin.P[k * 3 + axis] / .03)).join(',')
          ;(grid.get(key) ?? grid.set(key, []).get(key)!).push(k)
        }
        equipment.root.traverse(object => {
          // Rigid parts only: soft pads compress and elastic bands may graze an arm.
          if (!(object instanceof Mesh) || !object.visible || object.geometry.type !== 'CylinderGeometry') return
          if (object.material !== equipment.metal && object.material !== equipment.rubber && object.material !== equipment.grip) return
          const { height } = (object.geometry as CylinderGeometry).parameters
          const a = new Vector3(0, -height / 2, 0).applyMatrix4(object.matrixWorld), b = new Vector3(0, height / 2, 0).applyMatrix4(object.matrixWorld)
          const steps = Math.max(2, Math.ceil(a.distanceTo(b) / .02))
          for (let step = 0; step <= steps; step++) {
            const point = a.clone().lerp(b, step / steps)
            assert(!enclosed(skin, grid, point), `${id}: ${object.name || 'equipment'} axis inside the body at ${phase} (${point.toArray().map(v => v.toFixed(2))})`)
          }
        })
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('crunch palms rest toward the head, never the backs of the hands', async () => {
  const asset = await source
  const { body, equipment, motion } = create('crunch', asset)
  const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
  try {
    for (const phase of [0, .5, 1]) {
      motion.update(phase)
      for (const [i, side] of [asset.manifest.bones.right, asset.manifest.bones.left].entries()) {
        const wrist = at(side.hand), middle = at(side.palmLandmarks!.middle)
        const along = middle.clone().sub(wrist).normalize(), across = at(side.palmLandmarks!.index).sub(at(side.palmLandmarks!.pinky)).normalize()
        const palm = across.cross(along).normalize().multiplyScalar(i ? -1 : 1)
        const toHead = at(asset.manifest.bones.head).sub(wrist.lerp(middle, .6)).normalize()
        assert(palm.dot(toHead) > .5, `crunch: ${i ? 'left' : 'right'} palm turned away from the head at ${phase}`)
      }
    }
  } finally { body.dispose(); equipment.dispose() }
})
