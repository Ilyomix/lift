import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

type Surface = {
  mesh: SkinnedMesh
  lower: number[]
  faces: number[][]
  hands: { vertex: number; side: number; distal?: string }[]
}

function surfaces(body: Athlete, manifest: AthleteManifest): Surface[] {
  const sides = [manifest.bones.right, manifest.bones.left]
  const lowerNames = new Set([manifest.bones.pelvis, ...sides.flatMap(side => [side.thigh, side.shin, side.foot, side.toe])])
  const handNames = sides.map(side => new Set([side.hand, ...Object.values(side.fingers!).flat()]))
  const distalNames = sides.map(side => new Map(Object.entries(side.fingers!).map(([finger, bones]) => [bones.at(-1)!, finger])))
  const result: Surface[] = []
  body.root.traverse(mesh => {
    if (!(mesh instanceof SkinnedMesh)) return
    const joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
    const lower: number[] = [], hands: Surface['hands'] = []
    for (let vertex = 0; vertex < joints.count; vertex++) {
      let lowerWeight = 0
      const handWeights = [0, 0], distal: (string | undefined)[] = []
      for (let component = 0; component < 4; component++) {
        const name = mesh.skeleton.bones[joints.getComponent(vertex, component)].name
        const weight = weights.getComponent(vertex, component)
        if (lowerNames.has(name)) lowerWeight += weight
        for (let side = 0; side < 2; side++) {
          if (handNames[side].has(name)) handWeights[side] += weight
          if (weight > .5 && distalNames[side].has(name)) distal[side] = distalNames[side].get(name)
        }
      }
      // Both shorts and skin retain their actual pelvis/leg weights. No
      // spatial exclusion can hide a thigh intersection near a hand.
      if (lowerWeight > .5) lower.push(vertex)
      for (let side = 0; side < 2; side++) if (handWeights[side] > .5) hands.push({ vertex, side, distal: distal[side] })
    }
    const included = new Set(lower), faces: number[][] = [], index = mesh.geometry.index
    if (index) for (let i = 0; i < index.count; i += 3) {
      const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      if (face.every(vertex => included.has(vertex))) faces.push(face)
    }
    if (lower.length || hands.length) result.push({ mesh, lower, faces, hands })
  })
  return result
}

test('Romanian deadlift keeps its real shaft just in front of the leg surface while both hands keep their grip', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  const motion = createLowerExercise('romanian-deadlift', { body, equipment })!
  const parts = surfaces(body, manifest)
  const shafts: Mesh<CylinderGeometry>[] = []
  equipment.root.traverse(object => {
    if (object instanceof Mesh && object.geometry instanceof CylinderGeometry && object.geometry.parameters.radiusTop === .014) shafts.push(object as Mesh<CylinderGeometry>)
  })
  assert.equal(shafts.length, 1, 'measure the actual 14 mm barbell shaft')
  assert(parts.reduce((total, part) => total + part.lower.length, 0) > 5000, 'include shipped thighs, shorts and lower legs')
  const shaft = shafts[0], failures: string[] = []
  try {
    for (let step = 0; step <= 20; step++) {
      const phase = step / 20
      motion.update(phase); equipment.root.updateMatrixWorld(true)
      // Moving the bar clear must not turn the hip hinge into a bent-arm row.
      for (const side of [manifest.bones.right, manifest.bones.left]) {
        const shoulder = body.root.getObjectByName(side.upperArm)!.getWorldPosition(new Vector3())
        const elbow = body.root.getObjectByName(side.forearm)!.getWorldPosition(new Vector3())
        const wrist = body.root.getObjectByName(side.hand)!.getWorldPosition(new Vector3())
        const flexion = elbow.clone().sub(shoulder).angleTo(wrist.clone().sub(elbow)) * 180 / Math.PI
        if (flexion >= 25) failures.push(`phase ${phase}: elbow bends ${flexion.toFixed(2)}° instead of leaving the arms long`)
      }
      const center = shaft.getWorldPosition(new Vector3()), inverse = shaft.matrixWorld.clone().invert(), scale = shaft.getWorldScale(new Vector3())
      const radius = shaft.geometry.parameters.radiusTop * scale.x
      const halfLength = shaft.geometry.parameters.height * scale.y / 2
      const axis = shaft.localToWorld(new Vector3(0, 1, 0)).sub(center).normalize()
      assert(Math.abs(axis.x) > .999, 'the held bar must remain transverse for the front-surface comparison')
      const signedDistance = (point: Vector3) => {
        const local = point.clone().applyMatrix4(inverse)
        const radial = (Math.hypot(local.x, local.z) - shaft.geometry.parameters.radiusTop) * scale.x
        const axial = (Math.abs(local.y) - shaft.geometry.parameters.height / 2) * scale.y
        return Math.min(Math.max(radial, axial), 0) + Math.hypot(Math.max(radial, 0), Math.max(axial, 0))
      }
      let lowerDistance = Infinity, handDistance = Infinity, front = -Infinity
      const contacts = [new Map<string, number>(), new Map<string, number>()]
      for (const part of parts) {
        const points = new Map<number, Vector3>()
        for (const vertex of new Set([...part.lower, ...part.hands.map(hand => hand.vertex)])) points.set(vertex, part.mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(part.mesh.matrixWorld))
        for (const vertex of part.lower) lowerDistance = Math.min(lowerDistance, signedDistance(points.get(vertex)!))
        for (const face of part.faces) {
          const triangle = face.map(vertex => points.get(vertex)!)
          const [a, b, c] = triangle
          lowerDistance = Math.min(lowerDistance, signedDistance(a.clone().add(b).multiplyScalar(.5)), signedDistance(b.clone().add(c).multiplyScalar(.5)), signedDistance(c.clone().add(a).multiplyScalar(.5)), signedDistance(a.clone().add(b).add(c).multiplyScalar(1 / 3)))
          // A shaft wholly inside a leg can miss every surface sample. The
          // horizontal skin section also requires it to be in front (+Z).
          for (let edge = 0; edge < 3; edge++) {
            const from = triangle[edge], to = triangle[(edge + 1) % 3]
            if ((from.y - center.y) * (to.y - center.y) > 0 || from.y === to.y) continue
            const t = (center.y - from.y) / (to.y - from.y)
            if (t < 0 || t > 1) continue
            const x = from.x + (to.x - from.x) * t
            if (Math.abs(x - center.x) > halfLength) continue
            front = Math.max(front, from.z + (to.z - from.z) * t)
          }
        }
        for (const { vertex, side, distal } of part.hands) {
          const distance = signedDistance(points.get(vertex)!)
          handDistance = Math.min(handDistance, distance)
          if (distal) contacts[side].set(distal, Math.min(contacts[side].get(distal) ?? Infinity, distance))
        }
      }
      assert(Number.isFinite(front), `phase ${phase}: the bar height must intersect a real leg/shorts section`)
      const frontGap = center.z - radius - front
      if (frontGap < -.001 || frontGap > .060) failures.push(`phase ${phase}: shaft rear edge ${(frontGap * 1000).toFixed(2)} mm in front of skin (expected -1…60 mm)`)
      if (lowerDistance < -.001) failures.push(`phase ${phase}: shaft penetrates leg/shorts surface by ${(-lowerDistance * 1000).toFixed(2)} mm`)
      if (handDistance < -.001) failures.push(`phase ${phase}: shaft penetrates hand skin by ${(-handDistance * 1000).toFixed(2)} mm`)
      // Same 14 mm grip allowance as the pulldown-bar regression: do not
      // eliminate the leg collision by separating hands from their shaft.
      for (const [side, fingers] of contacts.entries()) for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
        if ((fingers.get(finger) ?? Infinity) > .008) failures.push(`phase ${phase}: ${side ? 'left' : 'right'} ${finger} floats ${(1000 * (fingers.get(finger) ?? Infinity)).toFixed(2)} mm from the shaft`)
      }
    }
    assert.equal(failures.length, 0, failures.join('\n'))
  } finally { body.dispose(); equipment.dispose() }
})
