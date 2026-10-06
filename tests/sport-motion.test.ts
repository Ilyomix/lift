import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { AnimationMixer, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createSportMotion, frameSportMotion } from '../src/lib/sportModelMotion'
import type { SportArtKind } from '../src/components/SportArt'

const kinds: SportArtKind[] = ['program', 'evidence', 'pause', 'reminders', 'privacy', 'kit', 'logbook', 'dumbbell', 'plate', 'calendar', 'chart', 'nutrition', 'settings', 'appearance', 'backup', 'stopwatch', 'trophy', 'coach', 'camera', 'measuring-tape', 'body-target']
const allKinds: SportArtKind[] = [...kinds, 'workout-upper', 'workout-lower', 'workout-push', 'workout-pull', 'workout-legs']

test('every bundled illustration is covered by the motion checks', async () => {
  const assets = (await readdir(new URL('../public/models/sport/', import.meta.url)))
    .filter(name => name.endsWith('.glb')).map(name => name.slice(0, -4))
  assert.deepEqual(new Set(allKinds), new Set(assets))
})

test('prop motion uses internal parts, returns to a static rest and stays inside its icon camera', async () => {
  for (const kind of kinds) {
    const bytes = await readFile(new URL(`../public/models/sport/${kind}.glb`, import.meta.url))
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const mixer = new AnimationMixer(gltf.scene)
    for (const clip of gltf.animations) mixer.clipAction(clip).play()
    mixer.setTime(0)
    const motion = createSportMotion(kind, gltf.scene, mixer)
    frameSportMotion(kind, gltf.scene, gltf.cameras[0], motion)
    const art = gltf.scene.getObjectByName('ArtRoot')!
    const rootRotation = art.quaternion.clone()
    const rest = new Map<string, number[]>()
    gltf.scene.traverse(object => rest.set(object.uuid, [...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]))
    let moved = false
    const camera = gltf.cameras[0]
    const point = new Vector3()
    const restScreen = new Map<string, Float32Array>()
    let earlyPixelTravel = 0
    for (let step = 0; step <= 120; step++) {
      moved = motion.update(step / 10) || moved
      gltf.scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
      assert(art.quaternion.angleTo(rootRotation) < 1e-7, `${kind}: generic body rotation must stay disabled`)
      if (kind === 'plate') {
        const pivot = gltf.scene.getObjectByName('PlateRollPivot')!
        const rollAngle = -2 * Math.atan2(pivot.quaternion.z, pivot.quaternion.w)
        assert(Math.abs(pivot.position.x - rollAngle) < 1e-6, 'plate: rolling distance must equal radius × angle')
        assert(Math.abs(pivot.position.y) < 1e-6 && Math.abs(pivot.position.z) < 1e-6, 'plate: its edge must stay on the same plane')
      }
      gltf.scene.traverse(object => {
        assert(object.matrixWorld.elements.every(Number.isFinite), `${kind}: invalid animation pose`)
        if (!(object instanceof Mesh)) return
        const positions = object.geometry.getAttribute('position')
        if (step === 0) restScreen.set(object.uuid, new Float32Array(positions.count * 2))
        const initial = restScreen.get(object.uuid)!
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera)
          assert(Math.abs(point.x) < .99 && Math.abs(point.y) < .99, `${kind}: animated part leaves the camera at ${step / 10}s`)
          if (step === 0) { initial[i * 2] = point.x; initial[i * 2 + 1] = point.y }
          else if (step <= 25) {
            // Real vertex displacement projected into the smallest 32px slot,
            // not a boolean that could report animation on an unchanged mesh.
            earlyPixelTravel = Math.max(earlyPixelTravel, Math.hypot(point.x - initial[i * 2], point.y - initial[i * 2 + 1]) * 16)
          }
        }
      })
    }
    assert.equal(moved, true, `${kind}: expected a real gesture`)
    assert(earlyPixelTravel >= 1, `${kind}: first gesture stays below one pixel at title size`)
    motion.update(0)
    assert.equal(motion.update(0), false, `${kind}: a static or reduced-motion pose must not redraw continuously`)
    gltf.scene.traverse(object => {
      const original = rest.get(object.uuid)!
      const actual = [...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]
      const samePositionScale = actual.every((value, i) => (i >= 3 && i <= 6) || Math.abs(value - original[i]) < 1e-6)
      // q and -q describe the same orientation (the watch hand completes a turn).
      const rotationDot = actual.slice(3, 7).reduce((sum, value, i) => sum + value * original[i + 3], 0)
      assert(samePositionScale && Math.abs(rotationDot) > 1 - 1e-6, `${kind}: rest pose changed`)
    })
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
  }
})

test('all animated icons make short independent gestures separated by at least twenty seconds of rest', async () => {
  const starts = new Set<number>()
  for (const kind of allKinds) {
    const bytes = await readFile(new URL(`../public/models/sport/${kind}.glb`, import.meta.url))
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const mixer = new AnimationMixer(gltf.scene)
    for (const clip of gltf.animations) mixer.clipAction(clip).play()
    mixer.setTime(0)
    const motion = createSportMotion(kind, gltf.scene, mixer)
    let changedFrames = 0, idleFrames = 0, longestIdle = 0, firstChange = -1
    for (let frame = 0; frame <= 700; frame++) {
      if (motion.update(frame / 10)) {
        changedFrames++; idleFrames = 0
        if (firstChange < 0) firstChange = frame
      } else {
        idleFrames++; longestIdle = Math.max(longestIdle, idleFrames)
      }
    }
    assert(changedFrames > 0, `${kind}: gesture never starts`)
    assert(firstChange <= 16, `${kind}: first gesture must start while the section is being read`)
    const maxFrames = kind.startsWith('workout-') ? 196 : 98
    assert(changedFrames < maxFrames, `${kind}: animation occupies too much viewing time`)
    assert(longestIdle >= 200, `${kind}: there is no twenty-second rest`)
    starts.add(firstChange)
    motion.update(0)
    assert.equal(motion.update(0), false, `${kind}: reduced motion must stay still`)
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
  }
  assert(starts.size >= 10, 'adjacent objects should not all start together')
})
