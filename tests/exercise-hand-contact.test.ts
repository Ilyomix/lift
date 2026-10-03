import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Matrix4, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createArmExercise } from '../src/lib/exerciseModelArms'
import { createUpperExercise } from '../src/lib/exerciseModelUpper'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

type Surface = { mesh: SkinnedMesh; vertices: { vertex: number; side: number; distal: string | undefined }[]; faces: number[][] }
function handSurface(body: Athlete, manifest: AthleteManifest): Surface[] {
  const sides = [manifest.bones.right, manifest.bones.left]
  const names = sides.map(side => new Set([side.hand, ...Object.values(side.fingers!).flat()]))
  const distal = sides.map(side => new Map(Object.entries(side.fingers!).map(([finger, bones]) => [bones[2], finger])))
  const surfaces: Surface[] = []
  body.root.traverse(mesh => {
    if (!(mesh instanceof SkinnedMesh)) return
    const joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
    const vertices: Surface['vertices'] = []
    const accepted = new Set<number>()
    for (let vertex = 0; vertex < joints.count; vertex++) {
      for (let side = 0; side < sides.length; side++) {
        let influence = 0, finger: string | undefined
        for (let component = 0; component < 4; component++) {
          const name = mesh.skeleton.bones[joints.getComponent(vertex, component)].name
          const weight = weights.getComponent(vertex, component)
          if (names[side].has(name)) influence += weight
          if (weight > .5 && distal[side].has(name)) finger = distal[side].get(name)
        }
        // Include mixed palm/finger weights too; no contact exclusion masks.
        if (influence > .5) { vertices.push({ vertex, side, distal: finger }); accepted.add(vertex); break }
      }
    }
    const faces: number[][] = [], index = mesh.geometry.index
    if (index) for (let triangle = 0; triangle < index.count; triangle += 3) {
      const face = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
      if (face.every(vertex => accepted.has(vertex))) faces.push(face)
    }
    if (vertices.length) surfaces.push({ mesh, vertices, faces })
  })
  return surfaces
}

for (const id of ['chest-press', 'shoulder-press-machine', 'pec-deck', 'seated-db-curl', 'preacher-curl', 'triceps-overhead-rope', 'leg-extension', 'lat-pulldown']) {
  test(`${id}: hand skin wraps the real shaft without passing through it`, async () => {
    const asset = await source
    const body = Reflect.construct(Athlete, [asset, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = (createArmExercise(id, { body, equipment }) ?? createUpperExercise(id, { body, equipment }) ?? createLowerExercise(id, { body, equipment }))!
    const skin = handSurface(body, asset.manifest)
    const shafts: Mesh<CylinderGeometry>[] = []
    equipment.root.traverse(object => {
      if (!(object instanceof Mesh) || !(object.geometry instanceof CylinderGeometry)) return
      const { radiusTop, height } = object.geometry.parameters
      if (object.name === 'contact-grip' || object.name === 'SeatedHandle' || radiusTop === .015 && height === .27 || id === 'preacher-curl' && radiusTop === .017) shafts.push(object as Mesh<CylinderGeometry>)
    })
    assert.equal(shafts.length, id === 'preacher-curl' || id === 'lat-pulldown' ? 1 : 2)
    assert(skin.reduce((total, surface) => total + surface.vertices.length, 0) > 3000, 'the actual hand mesh must be sampled')
    try {
      for (const phase of [0, .25, .5, .75, 1]) {
        motion.update(phase); equipment.root.updateMatrixWorld(true)
        const cylinders = shafts.map(shaft => ({ inverse: new Matrix4().copy(shaft.matrixWorld).invert(), scale: shaft.getWorldScale(new Vector3()), radius: shaft.geometry.parameters.radiusTop, halfLength: shaft.geometry.parameters.height / 2 }))
        // Signed distance to the finite solid, in world metres. The 1 mm
        // tolerance permits shallow soft contact and the cylinder's facets.
        const distance = (point: Vector3) => Math.min(...cylinders.map(cylinder => {
          const local = point.clone().applyMatrix4(cylinder.inverse)
          const radial = (Math.hypot(local.x, local.z) - cylinder.radius) * cylinder.scale.x
          const axial = (Math.abs(local.y) - cylinder.halfLength) * cylinder.scale.y
          return Math.min(Math.max(radial, axial), 0) + Math.hypot(Math.max(radial, 0), Math.max(axial, 0))
        }))
        let minimum = Infinity
        const contacts = [new Map<string, number>(), new Map<string, number>()]
        for (const surface of skin) {
          const points = new Map<number, Vector3>()
          for (const { vertex, side, distal } of surface.vertices) {
            const point = surface.mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(surface.mesh.matrixWorld)
            points.set(vertex, point)
            const gap = distance(point); minimum = Math.min(minimum, gap)
            if (distal) contacts[side].set(distal, Math.min(contacts[side].get(distal) ?? Infinity, gap))
          }
          // Vertices alone miss a triangle crossing a shaft between corners.
          for (const face of surface.faces) {
            const [a, b, c] = face.map(vertex => points.get(vertex)!)
            minimum = Math.min(minimum, distance(a.clone().add(b).multiplyScalar(.5)), distance(b.clone().add(c).multiplyScalar(.5)), distance(c.clone().add(a).multiplyScalar(.5)), distance(a.clone().add(b).add(c).multiplyScalar(1 / 3)))
          }
        }
        assert(minimum >= -.001, `${id} phase ${phase}: hand skin penetrates the shaft by ${(-minimum * 1000).toFixed(2)} mm`)
        // All fingers must actually close near the shaft. The narrower 14 mm
        // pulldown bar and 15 mm dumbbell leave more room than an 18 mm handle.
        const maxGap = id === 'lat-pulldown' ? .008 : id === 'seated-db-curl' ? .006 : .004
        for (const [side, fingers] of contacts.entries()) for (const finger of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
          assert((fingers.get(finger) ?? Infinity) <= maxGap, `${id} phase ${phase}: ${side ? 'left' : 'right'} ${finger} tip floats ${(1000 * (fingers.get(finger) ?? Infinity)).toFixed(2)} mm from the shaft`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  })
}
