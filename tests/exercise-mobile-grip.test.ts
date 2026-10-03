import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Mesh, SkinnedMesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete } from '../src/lib/exerciseModelRig'
import { ExerciseEquipment } from '../src/lib/exerciseModelEquipment'
import { createLowerExercise } from '../src/lib/exerciseModelLower'

test('independent lower weights and calf handles follow the resolved palm, with supports outside the grip', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ['db-romanian-deadlift', 'standing-calf-raise', 'seated-calf-raise']) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const original = body.pose.bind(body)
    let result: ReturnType<Athlete['pose']>
    body.pose = (...args) => (result = original(...args))
    const motion = createLowerExercise(id, { body, equipment })!
    const at = (name: string) => body.root.getObjectByName(name)!.getWorldPosition(new Vector3())
    try {
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20)
        equipment.root.updateMatrixWorld(true)
        const handles: Mesh[] = [], links: Mesh[] = []
        equipment.root.traverse(object => {
          if (!(object instanceof Mesh) || object.geometry.type !== 'CylinderGeometry') return
          const parameters = (object.geometry as import('three').CylinderGeometry).parameters
          if (id === 'db-romanian-deadlift' ? object.material === equipment.metal : object.material === equipment.grip) handles.push(object)
          if (object.material === equipment.metal && Math.abs(parameters.radiusTop - .016) < .0001) links.push(object)
        })
        assert.equal(handles.length, 2)
        for (const [i, side] of [manifest.bones.right, manifest.bones.left].entries()) {
          const along = at(side.palmLandmarks.middle).sub(at(side.hand)).normalize()
          const across = at(side.palmLandmarks.index).sub(at(side.palmLandmarks.pinky))
          across.addScaledVector(along, -across.dot(along)).normalize()
          const handle = handles[i], center = handle.getWorldPosition(new Vector3())
          const axis = new Vector3(0, 1, 0).transformDirection(handle.matrixWorld)
          assert(Math.abs(axis.dot(across)) > .99999, `${id}: mobile shaft ignores resolved palm at ${step / 20}`)
          assert(center.distanceTo(result!.hands[i]) < .0001, `${id}: handle centre left the hand`)
          if (id === 'db-romanian-deadlift') continue
          assert.equal(links.length, 2)
          const linkEnds = [-.5, .5].map(y => new Vector3(0, y, 0).applyMatrix4(links[i].matrixWorld))
          const gripEnds = [-.06, .06].map(y => new Vector3(0, y, 0).applyMatrix4(handle.matrixWorld))
          assert(Math.min(...linkEnds.flatMap(end => gripEnds.map(gripEnd => end.distanceTo(gripEnd)))) < .0001,
            `${id}: support must connect to a grip end, outside the palm`)
          assert(Math.min(...linkEnds.map(end => end.distanceTo(center))) > .055,
            `${id}: metal support ends inside the palm`)
        }
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})

test('two-handed dumbbells rest against distinct open palms without entering the hand or torso skin', async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  for (const id of ['goblet-squat', 'db-hip-thrust']) {
    const body = Reflect.construct(Athlete, [{ gltf, manifest }, {}]) as Athlete
    const equipment = new ExerciseEquipment()
    const motion = createLowerExercise(id, { body, equipment })!
    const sides = [manifest.bones.right, manifest.bones.left]
    const handNames = sides.map(side => {
      const names = new Set<string>()
      body.root.getObjectByName(side.hand)!.traverse(object => names.add(object.name))
      return names
    })
    const surfaces: { mesh: SkinnedMesh; hand: number[]; hip: boolean[] }[] = []
    body.root.traverse(object => {
      if (!(object instanceof SkinnedMesh)) return
      const indices = object.geometry.getAttribute('skinIndex'), weights = object.geometry.getAttribute('skinWeight')
      const hand: number[] = [], hip: boolean[] = []
      for (let vertex = 0; vertex < indices.count; vertex++) {
        const bones = [0, 1, 2, 3].filter(i => weights.getComponent(vertex, i) > .5)
          .map(i => object.skeleton.bones[indices.getComponent(vertex, i)].name)
        hand.push(handNames.findIndex(names => bones.some(name => names.has(name))))
        const dominant = [0, 1, 2, 3].reduce((a, b) => weights.getComponent(vertex, a) >= weights.getComponent(vertex, b) ? a : b)
        hip.push(/thigh|pelvis|spine_01/.test(object.skeleton.bones[indices.getComponent(vertex, dominant)].name))
      }
      surfaces.push({ mesh: object, hand, hip })
    })
    const cylinders: Mesh[] = []
    equipment.root.traverse(object => {
      if (object instanceof Mesh && object.geometry.type === 'CylinderGeometry' && object.parent !== equipment.root) cylinders.push(object)
    })
    assert.equal(cylinders.length, 3, 'one complete dumbbell is required')
    const heads = cylinders.filter(object => object.material === equipment.rubber)
    try {
      for (let step = 0; step <= 20; step++) {
        motion.update(step / 20)
        equipment.root.updateMatrixWorld(true)
        const middle = sides.map(side => body.root.getObjectByName(side.palmLandmarks.middle)!.getWorldPosition(new Vector3()))
        assert(middle[0].distanceTo(middle[1]) > .065, `${id}: hands overlap around the load at ${step / 20}`)
        const shapes = cylinders.map(mesh => ({ mesh, inverse: mesh.matrixWorld.clone().invert(), parameters: (mesh.geometry as import('three').CylinderGeometry).parameters }))
        const contactVertices = [0, 0]
        let hipGap = Infinity
        for (const { mesh, hand, hip } of surfaces) for (let vertex = 0; vertex < hand.length; vertex++) {
          // Every phase checks the fingers. The full skin envelope is checked
          // at five positions as well, including the repetition's extremes.
          if (hand[vertex] < 0 && step % 5 !== 0) continue
          const world = mesh.getVertexPosition(vertex, new Vector3()).applyMatrix4(mesh.matrixWorld)
          for (const { mesh: shape, inverse, parameters } of shapes) {
            const local = world.clone().applyMatrix4(inverse)
            const gap = Math.max(Math.abs(local.y) - parameters.height / 2, Math.hypot(local.x, local.z) - parameters.radiusTop)
            assert(gap >= -.003, `${id}: dumbbell ${shape.material === equipment.metal ? 'shaft' : 'head'} enters ${mesh.name} vertex ${vertex} by ${(-gap * 1000).toFixed(1)} mm at ${step / 20}`)
            const side = hand[vertex]
            const contactHead = id === 'goblet-squat' ? heads[1] : heads[side]
            if (side >= 0 && shape === contactHead && Math.abs(gap) < .003) contactVertices[side]++
            if (id === 'db-hip-thrust' && hip[vertex] && heads.includes(shape)) hipGap = Math.min(hipGap, Math.abs(gap))
          }
        }
        contactVertices.forEach(count => assert(count >= 5, `${id}: open palm floats away from its head at ${step / 20}`))
        if (id === 'db-hip-thrust' && step % 5 === 0) assert(hipGap < .006, `${id}: dumbbell/hip gap ${(hipGap * 1000).toFixed(1)} mm at ${step / 20}`)
      }
    } finally { body.dispose(); equipment.dispose() }
  }
})
