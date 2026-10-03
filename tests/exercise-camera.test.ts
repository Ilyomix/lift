import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { type TestContext } from 'node:test'
import { Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Athlete, type AthleteManifest } from '../src/lib/exerciseModelRig'
import { exerciseMuscles } from '../src/lib/exerciseModelCatalog'
import { createExerciseModel, type ExerciseOrbit, type ExerciseView } from '../src/lib/exerciseModels'

type Model = Awaited<ReturnType<typeof createExerciseModel>>
const source = (async () => {
  const bytes = await readFile(new URL('../public/models/exercise/athlete.glb', import.meta.url))
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const manifest: AthleteManifest = JSON.parse(await readFile(new URL('../public/models/exercise/athlete.rig.json', import.meta.url), 'utf8'))
  return { gltf, manifest }
})()

async function withModel(t: TestContext, id: string, check: (model: Model) => void) {
  const asset = await source
  const loader = t.mock.method(Athlete, 'load', async weights => Reflect.construct(Athlete, [asset, weights]) as Athlete)
  const model = await createExerciseModel(id, exerciseMuscles(id))
  try { check(model) } finally { model.dispose(); loader.mock.restore() }
}

function cameraState(model: Model) {
  model.camera.updateMatrixWorld(true)
  return [...model.camera.matrixWorld.elements, ...model.camera.projectionMatrix.elements]
}

function assertSameCamera(actual: number[], expected: number[], message: string) {
  actual.forEach((value, index) => assert(Math.abs(value - expected[index]) < 1e-10, `${message}: camera element ${index} changed`))
}

// Project the deformed shipped mesh, including visible equipment. A bone-only
// assertion would miss a clipped hand, face, weight or machine frame.
function assertFramed(model: Model, label: string) {
  model.scene.updateMatrixWorld(true)
  model.camera.updateMatrixWorld(true)
  assert(cameraState(model).every(Number.isFinite), `${label}: non-finite camera matrix`)
  const point = new Vector3()
  let vertices = 0
  model.scene.traverseVisible(object => {
    if (!(object instanceof Mesh)) return
    const count = object.geometry.getAttribute('position').count
    for (let index = 0; index < count; index++) {
      object.getVertexPosition(index, point).applyMatrix4(object.matrixWorld).project(model.camera)
      assert(Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z), `${label}: invalid projected vertex`)
      assert(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1, `${label}: clipped vertex (${point.x}, ${point.y}, ${point.z})`)
      vertices++
    }
  })
  assert(vertices > 30_000, `${label}: real athlete was not checked`)
}

const angles: ExerciseOrbit[] = [
  { yaw: 0, pitch: 0 },
  { yaw: Math.PI / 2, pitch: 0.65 },
  { yaw: Math.PI, pitch: -0.65 },
  { yaw: 3 * Math.PI / 2, pitch: 0 },
  { yaw: 6 * Math.PI + 0.4, pitch: 0.35 },
]

test('free rotation keeps the neutral muscle map in frame from front, side and back', async t => {
  await withModel(t, 'lat-pulldown', model => {
    for (const view of ['front', 'back'] as const) for (const aspect of [4 / 3, 3 / 4]) for (const orbit of angles) {
      model.setView(view, aspect, orbit)
      model.pose(0)
      assertFramed(model, `${view}, aspect ${aspect}, yaw ${orbit.yaw}, pitch ${orbit.pitch}`)
    }
  })
})

test('rotated machine and floor demonstrations stay framed without camera drift during a repetition', async t => {
  for (const id of ['lat-pulldown', 'db-floor-press']) await withModel(t, id, model => {
    assert(model.animated, `${id}: expected a real exercise motion`)
    for (const orbit of angles) {
      model.setView('technique', 4 / 3, orbit)
      const camera = cameraState(model)
      for (const seconds of [0, 0.85, 1.7, 3, 4.4]) {
        model.setView('technique', 4 / 3, orbit)
        model.pose(seconds)
        assertSameCamera(cameraState(model), camera, `${id}: pose ${seconds}`)
        assertFramed(model, `${id}: pose ${seconds}, yaw ${orbit.yaw}, pitch ${orbit.pitch}`)
      }
    }
  })
})

test('extreme inclination stays finite and resetting a preset restores its original camera', async t => {
  await withModel(t, 'lat-pulldown', model => {
    for (const view of ['front', 'back', 'technique'] as ExerciseView[]) {
      model.setView(view, 4 / 3)
      const initial = cameraState(model)
      for (const pitch of [-100, -Math.PI / 2, Math.PI / 2, 100]) {
        model.setView(view, 4 / 3, { yaw: 10 * Math.PI + 0.8, pitch })
        model.pose(1.7)
        assertFramed(model, `${view}: extreme pitch ${pitch}`)
      }
      model.setView(view, 4 / 3, { yaw: 0, pitch: 0 })
      assertSameCamera(cameraState(model), initial, `${view}: explicit reset`)
      model.setView(view, 4 / 3, { yaw: 0.7, pitch: 0.4 })
      model.setView(view, 4 / 3)
      assertSameCamera(cameraState(model), initial, `${view}: omitted orbit reset`)
    }
  })
})
