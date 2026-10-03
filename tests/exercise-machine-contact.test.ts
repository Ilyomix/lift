import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CylinderGeometry, Matrix4, Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createUpperExercise } from '../src/lib/exerciseModelUpper'

const machines = ['pec-deck', 'reverse-pec-deck', 'chest-press', 'shoulder-press-machine', 'lat-pulldown', 'single-arm-pulldown', 'low-cable-row', 'chest-supported-row', 'face-pull', 'cable-pullover', 'cable-fly', 'cable-lateral-raise']

test('guided upper machines keep rigid links and clear the actual animated skin', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  const failures: string[] = []
  for (const id of machines) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createUpperExercise(id, { body, equipment })!
    const skin: { mesh: SkinnedMesh; hand: boolean[] }[] = []
    body.root.traverse(object => {
      if (!(object instanceof SkinnedMesh)) return
      const joints = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight')
      const hand = Array.from({ length: joints.count }, (_, vertex) => {
        let amount = 0
        for (let i = 0; i < 4; i++) if (/hand|finger|thumb|index|middle|ring|pinky/i.test(object.skeleton.bones[joints.getComponent(vertex, i)].name)) amount += weights.getComponent(vertex, i)
        return amount > .5
      })
      skin.push({ mesh: object, hand })
    })
    const pieces: Mesh[] = []
    equipment.root.traverse(object => { if (object instanceof Mesh) pieces.push(object) })
    motion.update(0)
    const scales = pieces.map(mesh => mesh.getWorldScale(new Vector3()))
    const worst = new Map<number, { depth: number; phase: number; point: number[]; count: number }>()
    try {
      for (let step = 0; step <= 20; step++) {
        const phase = step / 20
        motion.update(phase); equipment.root.updateMatrixWorld(true)
        const fly = id === 'pec-deck' || id === 'reverse-pec-deck'
        const press = id === 'chest-press' || id === 'shoulder-press-machine'
        const extended = fly || (press && step === 20) || (id === 'lat-pulldown' && step === 0)
        if (id === 'lat-pulldown' && step === 20) {
          for (const side of [manifest.bones.right, manifest.bones.left]) {
            const shoulder = body.root.getObjectByName(side.upperArm)!.getWorldPosition(new Vector3())
            const elbow = body.root.getObjectByName(side.forearm)!.getWorldPosition(new Vector3())
            const drop = shoulder.y - elbow.y
            assert(drop >= .18 && drop <= .25, `lat-pulldown: elbow must finish below shoulder, actual ${(drop * 100).toFixed(1)}cm`)
            assert(Math.abs(elbow.x - shoulder.x) < .18, 'lat-pulldown: elbow must return toward ribs')
          }
        }
        if (extended || (press && step === 0)) {
          for (const side of [manifest.bones.right, manifest.bones.left]) {
            const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
            const bend = at(side.forearm).sub(at(side.upperArm)).angleTo(at(side.hand).sub(at(side.forearm))) * 180 / Math.PI
            const min = extended ? 15 : 70, max = extended ? (id === 'lat-pulldown' ? 25 : 30) : 110
            assert(bend >= min && bend <= max, `${id}: elbow bend ${bend.toFixed(1)}°, expected ${min}–${max}°`)
          }
        }
        const vertices: { point: Vector3; hand: boolean }[] = []
        for (const { mesh, hand } of skin) {
          mesh.skeleton.update()
          const positions = mesh.geometry.getAttribute('position')
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const point = new Vector3().fromBufferAttribute(positions, vertex)
            mesh.applyBoneTransform(vertex, point).applyMatrix4(mesh.matrixWorld)
            vertices.push({ point, hand: hand[vertex] })
          }
        }
        pieces.forEach((mesh, index) => {
          if (!mesh.visible || !mesh.parent?.visible) return
          const cable = mesh.geometry instanceof CylinderGeometry && mesh.geometry.parameters.radiusTop === .006
          if (!cable && mesh.getWorldScale(new Vector3()).distanceTo(scales[index]) >= 1e-8) failures.push(`${id}: rigid machine piece ${index} changes length`)
          const inverse = new Matrix4().copy(mesh.matrixWorld).invert()
          mesh.geometry.computeBoundingBox()
          const localBounds = mesh.geometry.boundingBox!
          const broad = localBounds.clone().applyMatrix4(mesh.matrixWorld)
          const supported = mesh.name === 'contact-seat' || mesh.name === 'contact-pad'
          if (supported) broad.expandByScalar(.04)
          let gap = Infinity
          const scale = mesh.getWorldScale(new Vector3())
          const padded = mesh.material === equipment.pad
          const allowance = padded ? .012 : .002
          for (const { point, hand } of vertices) {
            if (!broad.containsPoint(point)) continue
            // Finger contact is expected only on the designated rubber grips.
            if (hand && mesh.name === 'contact-grip') continue
            const local = point.clone().applyMatrix4(inverse)
            let depth: number
            if (mesh.geometry instanceof CylinderGeometry) {
              const { radiusTop, height } = mesh.geometry.parameters
              depth = Math.min((radiusTop - Math.hypot(local.x, local.z)) * scale.x, (height / 2 - Math.abs(local.y)) * scale.y)
            } else {
              const half = localBounds.getSize(new Vector3()).multiplyScalar(.5)
              const radius = Math.min(half.x, half.y, half.z) * .5
              const q = new Vector3(Math.abs(local.x), Math.abs(local.y), Math.abs(local.z)).sub(half).addScalar(radius)
              depth = radius - Math.hypot(Math.max(q.x, 0), Math.max(q.y, 0), Math.max(q.z, 0)) - Math.min(Math.max(q.x, q.y, q.z), 0)
            }
            if (supported) gap = Math.min(gap, Math.abs(depth))
            if (depth <= allowance) continue
            const old = worst.get(index)
            if (!old || depth > old.depth) worst.set(index, { depth, phase, point: point.toArray(), count: (old?.count ?? 0) + 1 })
            else old.count++
          }
          if (supported && gap >= .006) failures.push(`${id}: ${mesh.name} floats ${(gap * 1000).toFixed(1)}mm from skin/shorts`)
        })
      }
      for (const [index, hit] of worst) {
        const mesh = pieces[index]
        failures.push(`${id} piece${index} ${mesh.name || mesh.geometry.type} at ${mesh.getWorldPosition(new Vector3()).toArray().map(v => v.toFixed(3))}: ${(hit.depth * 1000).toFixed(1)}mm phase${hit.phase} skin[${hit.point.map(v => v.toFixed(3))}] (${hit.count} vertices)`)
      }
    } finally { body.dispose(); equipment.dispose() }
  }
  assert.deepEqual(failures, [], failures.join('\n'))
})
