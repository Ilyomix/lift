import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

const machines = ['leg-press', 'calf-press', 'hack-squat', 'leg-extension', 'leg-curl', 'lying-leg-curl', 'hip-adduction', 'hip-abduction', 'standing-calf-raise', 'back-extension-45', 'roman-chair-abs']

test('lower machines keep rigid pivots and surface contacts on the actual skinned athlete', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of machines) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createLowerExercise(id, { body, equipment })!
    const handBones = new Set<string>()
    for (const side of [manifest.bones.right, manifest.bones.left]) {
      body.root.getObjectByName(side.hand)!.traverse(bone => handBones.add(bone.name))
    }
    // Holding a handle is intentional contact. Keep wrists, limbs, skin and
    // opaque shorts in the test; omit only vertices belonging to the hands.
    const surfaces: { mesh: SkinnedMesh; indices: number[] }[] = []
    body.root.traverse(object => {
      if (!(object instanceof SkinnedMesh)) return
      const indices: number[] = []
      const skinIndex = object.geometry.getAttribute('skinIndex')
      const skinWeight = object.geometry.getAttribute('skinWeight')
      for (let i = 0; i < object.geometry.getAttribute('position').count; i++) {
        if (![0, 1, 2, 3].some(j => skinWeight.getComponent(i, j) > .1 && handBones.has(object.skeleton.bones[skinIndex.getComponent(i, j)].name))) indices.push(i)
      }
      surfaces.push({ mesh: object, indices })
    })
    const rigidLengths = new Map<Mesh, number>()
    const pivots = new Map<Mesh, Vector3>()
    try {
      for (let phase = 0; phase <= 20; phase++) {
        motion.update(phase / 20)
        equipment.root.updateMatrixWorld(true)
        const shapes: { mesh: Mesh; inverse: import('three').Matrix4; parameters: Record<string, number> }[] = []
        equipment.root.traverse(object => {
          if (!(object instanceof Mesh) || !object.visible) return
          const parameters = (object.geometry as unknown as { parameters?: Record<string, number> }).parameters
          if (parameters) shapes.push({ mesh: object, inverse: object.matrixWorld.clone().invert(), parameters })
          if (['KneeMachineLever', 'ProneCurlLever', 'HipMachineLever'].includes(object.name)) {
            const length = object.getWorldScale(new Vector3()).y
            if (!rigidLengths.has(object)) rigidLengths.set(object, length)
            assert(Math.abs(length - rigidLengths.get(object)!) < 1e-6, `${id}: metal lever stretches at ${phase / 20}`)
            const pivot = new Vector3(0, -.5, 0).applyMatrix4(object.matrixWorld)
            if (!pivots.has(object)) pivots.set(object, pivot)
            assert(pivot.distanceTo(pivots.get(object)!) < 1e-6, `${id}: machine pivot drifts at ${phase / 20}`)
          }
        })
        let footplateGap = Infinity
        const point = new Vector3(), local = new Vector3()
        for (const { mesh, indices } of surfaces) for (const index of indices) {
          mesh.getVertexPosition(index, point).applyMatrix4(mesh.matrixWorld)
          for (const { mesh: shape, inverse, parameters: p } of shapes) {
            local.copy(point).applyMatrix4(inverse)
            const depth = shape.geometry.type === 'CylinderGeometry'
              ? Math.min((p.height / 2 - Math.abs(local.y)) * shape.scale.y, p.radiusTop - Math.hypot(local.x, local.z))
              : Math.min(p.width / 2 - Math.abs(local.x), p.height / 2 - Math.abs(local.y), p.depth / 2 - Math.abs(local.z))
            // Rounded-box AABBs conservatively include their rounded corners.
            // Foam permits 8 mm of compression; metal shafts permit only 3 mm.
            const tolerance = shape.material === equipment.metal ? .003 : .008
            assert(depth <= tolerance, `${id}: ${shape.name || shape.geometry.type} penetrates ${mesh.name} by ${(depth * 1000).toFixed(1)} mm at ${phase / 20}`)
            if (shape.name === 'PressFootplate' && Math.abs(local.x) < p.width / 2 - .01 && Math.abs(local.z) < p.depth / 2 - .01) {
              footplateGap = Math.min(footplateGap, local.y - p.height / 2)
            }
          }
        }
        if (id === 'leg-press' || id === 'calf-press') {
          for (const side of [manifest.bones.right, manifest.bones.left]) {
            const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
            const hip = at(side.thigh), ankle = at(side.foot), knee = at(side.shin)
            if (id === 'leg-press' && (phase === 0 || phase === 20)) {
              const flexion = 180 - hip.clone().sub(knee).angleTo(ankle.clone().sub(knee)) * 180 / Math.PI
              assert(phase === 0 ? flexion > 10 && flexion < 30 : flexion > 90, `${id}: inadequate knee range ${flexion.toFixed(1)}° at ${phase / 20}`)
            }
            const axis = ankle.sub(hip).normalize()
            const bend = knee.sub(hip)
            bend.addScaledVector(axis, -bend.dot(axis))
            assert(bend.dot(new Vector3(0, 1, -1)) > .005, `${id}: knee bends away from the torso at ${phase / 20}`)
          }
          assert(footplateGap > -.003 && footplateGap < .008, `${id}: sole/footplate gap ${(footplateGap * 1000).toFixed(1)} mm at ${phase / 20}`)
          const rails = shapes.filter(s => s.mesh.name === 'PressRail').map(s => s.mesh)
          const shoes = shapes.filter(s => s.mesh.name === 'PressRailShoe').map(s => s.mesh)
          assert.equal(rails.length, 2); assert.equal(shoes.length, 2)
          shoes.forEach((shoe, i) => {
            const localCenter = rails[i].worldToLocal(shoe.getWorldPosition(new Vector3()))
            assert(Math.hypot(localCenter.x, localCenter.z) < 1e-6, `${id}: carriage has left its rail`)
          })
        }
        if (['leg-extension', 'leg-curl', 'hip-adduction', 'hip-abduction'].includes(id)) {
          for (const side of [manifest.bones.right, manifest.bones.left]) {
            const shoulder = body.root.getObjectByName(side.upperArm)!.getWorldPosition(new Vector3())
            const elbow = body.root.getObjectByName(side.forearm)!.getWorldPosition(new Vector3())
            assert(shoulder.y - elbow.y > .12 && Math.abs(elbow.x) < .36, `${id}: elbow flares at shoulder height`)
          }
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
