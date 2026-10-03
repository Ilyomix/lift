import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Group, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise } from '../src/lib/exerciseModelLower'
import { createArmExercise } from '../src/lib/exerciseModelArms'
import { exercisePhase, exerciseTempo } from '../src/lib/exercisePlayback'

test('unsupported legs keep a continuous sagittal knee bend throughout two real 60 Hz cycles', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ['roman-chair-abs', 'hanging-leg-raise', 'single-leg-rdl']) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createLowerExercise(id, { body, equipment })!
    const sides = id === 'single-leg-rdl' ? [manifest.bones.left] : [manifest.bones.right, manifest.bones.left]
    const freeFoot: { mesh: SkinnedMesh; vertices: number[] }[] = []
    if (id === 'single-leg-rdl') body.root.traverse(object => {
      if (!(object instanceof SkinnedMesh)) return
      const names = new Set([manifest.bones.left.foot, manifest.bones.left.toe])
      const skin = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight')
      const vertices: number[] = []
      for (let vertex = 0; vertex < skin.count; vertex++) {
        const influence = [0, 1, 2, 3].reduce((sum, joint) => sum + (names.has(object.skeleton.bones[skin.getComponent(vertex, joint)].name) ? weights.getComponent(vertex, joint) : 0), 0)
        if (influence > .5) vertices.push(vertex)
      }
      if (vertices.length) freeFoot.push({ mesh: object, vertices })
    })
    const previous = new Map<string, { position: Vector3; rotation: Quaternion; velocity?: Vector3 }>()
    const tempo = exerciseTempo(id)
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    try {
      for (let frame = 0; frame <= Math.round((tempo.outward + tempo.returning) * 120); frame++) {
        motion.update(exercisePhase(id, frame / 60))
        for (const { mesh, vertices } of freeFoot) for (const vertex of vertices) {
          const point = mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(mesh.matrixWorld)
          assert(point.y >= -.002, `single-leg RDL: free foot enters the floor at frame ${frame}`)
        }
        for (const side of sides) {
          const hip = at(side.thigh), knee = at(side.shin), foot = at(side.foot)
          if (id === 'single-leg-rdl') {
            const bend = 180 - hip.clone().sub(knee).angleTo(foot.clone().sub(knee)) * 180 / Math.PI
            assert(bend > 8 && bend < 25, `single-leg RDL: free leg should remain softly extended (${bend.toFixed(1)}°)`)
          }
          const axis = foot.clone().sub(hip).normalize()
          const forwardBend = new Vector3(0, axis.z, -axis.y).normalize()
          assert(knee.clone().sub(hip).dot(forwardBend) > .005,
            `${id}: knee changed to the reverse IK branch at frame ${frame}`)
          for (const name of [side.thigh, side.shin, side.foot]) {
            const position = at(name), rotation = body.root.getObjectByName(name)!.getWorldQuaternion(new Quaternion())
            const last = previous.get(name)
            const velocity = last && position.clone().sub(last.position).multiplyScalar(60)
            if (last) {
              assert(position.distanceTo(last.position) < .025, `${id}: ${name} jumps more than 25 mm in one frame at ${frame}`)
              assert(rotation.angleTo(last.rotation) < .10, `${id}: ${name} rotates abruptly at frame ${frame}`)
              if (last.velocity) assert(velocity!.clone().sub(last.velocity).length() * 60 < 15,
                `${id}: ${name} acceleration spikes at frame ${frame}`)
            }
            previous.set(name, { position, rotation, velocity })
          }
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('overhead dumbbell support begins tilting without a sudden wrist angular velocity change', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
  const equipment = new ExerciseEquipment()
  let weight: Group, contacts: ReturnType<Athlete['pose']>
  const makeWeight = equipment.dumbbell.bind(equipment)
  equipment.dumbbell = (...args) => (weight = makeWeight(...args))
  const pose = body.pose.bind(body)
  body.pose = (...args) => (contacts = pose(...args))
  const id = 'db-overhead-extension', motion = createArmExercise(id, { body, equipment })!
  const hands = [manifest.bones.right, manifest.bones.left].map(side => body.root.getObjectByName(side.hand)!)
  const tempo = exerciseTempo(id)
  const last: { rotation?: Quaternion; angularStep?: number }[] = [{}, {}]
  let support: { axial: number; radial: number }[] | undefined
  try {
    for (let frame = 0; frame <= Math.round((tempo.outward + tempo.returning) * 120); frame++) {
      motion.update(exercisePhase(id, frame / 60))
      equipment.root.updateMatrixWorld(true)
      const shaft = new Vector3(1, 0, 0).transformDirection(weight!.matrixWorld)
      const center = weight!.getWorldPosition(new Vector3())
      for (const [i, hand] of hands.entries()) {
        const rotation = hand.getWorldQuaternion(new Quaternion())
        const angularStep = last[i].rotation && rotation.angleTo(last[i].rotation!) * 180 / Math.PI
        if (angularStep !== undefined && last[i].angularStep !== undefined) {
          const acceleration = Math.abs(angularStep - last[i].angularStep!) * 60 * 60
          assert(acceleration < 1000, `overhead support starts or stops abruptly: ${acceleration.toFixed(0)}°/s² at frame ${frame}`)
        }
        last[i] = { rotation, angularStep }
        const delta = contacts!.hands[i].clone().sub(center)
        const axial = delta.dot(shaft), radial = delta.addScaledVector(shaft, -axial).length()
        if (!support) support = []
        if (!support[i]) support[i] = { axial, radial }
        assert(Math.abs(axial - support[i].axial) < .0001 && Math.abs(radial - support[i].radial) < .0001,
          'smoothing the wrist must preserve its support relative to the weight head')
      }
    }
  } finally { body.dispose(); equipment.dispose() }
})
