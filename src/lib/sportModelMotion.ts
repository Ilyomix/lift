import { Mesh, OrthographicCamera, Quaternion, Vector3, type AnimationMixer, type Camera, type Object3D } from 'three'
import type { SportArtKind } from '../components/SportArt'

export type SportMotion = { animated: boolean; boundsTimes: readonly number[]; update: (seconds: number) => boolean }
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1)
const ease = (value: number) => { const t = Math.min(1, Math.max(0, value)); return t * t * (3 - 2 * t) }
const gesture = (time: number, start: number, open: number, hold: number, close: number) =>
  time < start ? 0 : time < start + open ? ease((time - start) / open)
    : time < start + open + hold ? 1 : 1 - ease((time - start - open - hold) / close)

/** Each prop performs its own short mechanical gesture, then rests. The body
 * and camera stay fixed; all movement belongs to real internal GLB nodes. */
export function createSportMotion(kind: SportArtKind, root: Object3D, mixer: AnimationMixer): SportMotion {
  // Different periods and entry delays keep adjacent objects independent. Each
  // gesture retains its normal speed, with a long truly static interval after it.
  const timing: Record<SportArtKind, readonly [number, number]> = {
    calendar: [27, .35], chart: [29, 1.3], nutrition: [25, 2.4], backup: [31, 3.1],
    dumbbell: [28, .8], plate: [26, 1.8], settings: [32, 3.6], appearance: [30, 1.9], stopwatch: [30, 2.8],
    trophy: [24, 4.1], coach: [32, 0],
    program: [29, .9], evidence: [32, 2.2], pause: [31, 3.3], reminders: [28, 1.4],
    privacy: [30, 2.7], kit: [32, 1.7], logbook: [29, 3.8],
    camera: [28, 1.05], 'measuring-tape': [31, 2.05], 'body-target': [30, 3.05],
    'workout-upper': [28, 1.1], 'workout-lower': [30, 2.1], 'workout-push': [28.5, .5],
    'workout-pull': [29, 1.6], 'workout-legs': [31, 2.6],
  }
  const [period, entryOrder] = timing[kind]
  // Show the first gesture while the section is being read, rather than
  // waiting up to five seconds. The long repeat intervals stay unchanged.
  const delay = .15 + entryOrder * .2
  const phaseAt = (seconds: number) => (Math.max(0, seconds) + period - delay) % period
  const boundsTimes = [0, ...[0, .4, .7, .9, 1.1, 1.4, 1.8, 2.2, 2.7].map(time => time + delay)]
  if (kind.startsWith('workout-')) {
    let previous = 0
    return { animated: true, boundsTimes, update: seconds => {
      const phase = phaseAt(seconds), clipTime = phase < 6 ? phase : 0
      if (Math.abs(clipTime - previous) < 1e-9) return false
      mixer.setTime(clipTime); previous = clipTime
      return true
    } }
  }
  mixer.stopAllAction()
  const poses = new Map<string, { node: Object3D; position: Vector3; scale: Vector3; rotation: Quaternion }>()
  root.traverse(node => poses.set(node.name, { node, position: node.position.clone(), scale: node.scale.clone(), rotation: node.quaternion.clone() }))
  const rotation = new Quaternion(), vector = new Vector3()
  let changed = false
  const turn = (name: string, axis: Vector3, angle: number) => {
    const pose = poses.get(name)
    if (!pose) return
    rotation.setFromAxisAngle(axis, angle).premultiply(pose.rotation)
    if (1 - Math.abs(pose.node.quaternion.dot(rotation)) > 1e-12) { pose.node.quaternion.copy(rotation); changed = true }
  }
  const move = (name: string, axis: Vector3, distance: number) => {
    const pose = poses.get(name)
    if (!pose) return
    vector.copy(pose.position).addScaledVector(axis, distance)
    if (pose.node.position.distanceToSquared(vector) > 1e-12) { pose.node.position.copy(vector); changed = true }
  }
  const height = (name: string, amount: number) => {
    const pose = poses.get(name)
    if (!pose) return
    vector.copy(pose.scale); vector.y *= amount
    if (pose.node.scale.distanceToSquared(vector) > 1e-12) { pose.node.scale.copy(vector); changed = true }
  }
  return {
    animated: true,
    boundsTimes,
    update: seconds => {
      changed = false
      const phase = phaseAt(seconds)
      switch (kind) {
        case 'calendar':
          turn('PageHinge', X, -.72 * gesture(phase, .30, .55, .12, .80))
          break
        case 'chart': {
          for (let i = 0; i < 3; i++) {
            const dip = gesture(phase, .15 + i * .18, .26, .12, .72)
            height(`BarPivot${i}`, 1 - .42 * dip)
          }
          break
        }
        case 'nutrition': {
          const leaf = gesture(phase, .20, .55, .05, .55) - .45 * gesture(phase, 1.5, .35, 0, .65)
          turn('AppleLeafPivot', Z, .48 * leaf)
          break
        }
        case 'backup':
          turn('LidHinge', X, -.55 * gesture(phase, .45, .60, .40, .65))
          break
        case 'dumbbell': {
          const load = gesture(phase, .35, .55, .10, .50)
          move('LeftLoadSlide', X, -.18 * load)
          move('RightLoadSlide', X, .18 * load)
          break
        }
        case 'plate': {
          // The plate has unit radius: x = radius × angle is rolling without
          // sliding. Its hub and spokes stay rigidly attached throughout.
          const roll = .44 * gesture(phase, .2, .65, .15, .85)
          turn('PlateRollPivot', Z, -roll)
          move('PlateRollPivot', X, roll)
          break
        }
        case 'settings': {
          // One tooth engages and returns, then rests. Unlike an idle yaw, this
          // follows the gear's working axis and keeps its silhouette steady.
          turn('ModelGeometry', Z, -gesture(phase, .2, .35, .15, .45) * Math.PI / 6)
          break
        }
        case 'appearance':
          move('AppearanceThumbSlide', X, .9 * gesture(phase, .2, .60, .18, .70))
          break
        case 'camera':
          move('CameraFocusSlide', Z, .16 * gesture(phase, .2, .55, .22, .65))
          move('CameraShutterPress', Y, -.035 * gesture(phase, .80, .18, .08, .25))
          break
        case 'measuring-tape':
          move('TapePullSlide', X, .26 * gesture(phase, .2, .60, .18, .75))
          break
        case 'body-target': {
          const focus = .09 * gesture(phase, .2, .60, .18, .75)
          move('BodyFocusLeft', X, focus)
          move('BodyFocusRight', X, -focus)
          break
        }
        case 'stopwatch':
          turn('SecondHandPivot', Z, phase < 2 ? ease((phase - .2) / 1.8) * Math.PI * 2 : 0)
          break
        case 'trophy':
          turn('CupPivot', Y, .20 * gesture(phase, .55, .5, .15, .7))
          break
        case 'coach': {
          // A brief double whistle tremor; the rigid mouthpiece and chamber
          // move together, with no generic spin or continuous bobbing.
          const signal = gesture(phase, .2, .16, 0, .24) - .65 * gesture(phase, .65, .16, 0, .28)
          move('ModelGeometry', Y, .14 * signal)
          break
        }
        case 'program':
          turn('ProgramClipPivot', X, -.48 * gesture(phase, .2, .35, .15, .55))
          break
        case 'evidence':
          turn('EvidenceBookmarkPivot', X, .30 * gesture(phase, .2, .55, .10, .80))
          break
        case 'pause':
          turn('HourglassPivot', X, .25 * gesture(phase, .2, .65, .15, .85))
          break
        case 'reminders': {
          const ring = gesture(phase, .15, .25, 0, .35) - .65 * gesture(phase, .75, .25, 0, .45)
          turn('BellSwingPivot', Z, .22 * ring)
          turn('BellClapperPivot', Z, -.30 * ring)
          break
        }
        case 'privacy':
          move('LockShacklePivot', Y, .09 * gesture(phase, .2, .45, .20, .65))
          break
        case 'kit':
          move('KitZipPullPivot', X, -.32 * gesture(phase, .2, .55, .20, .70))
          break
        case 'logbook':
          turn('LogbookPencilPivot', Z, .16 * gesture(phase, .2, .55, .1, .70))
          break
      }
      return changed
    },
  }
}

/** Frame the complete gesture once at load time, keeping the camera still
 * during playback. Merged GLB mesh bounds can otherwise offset a small prop. */
export function frameSportMotion(kind: SportArtKind, root: Object3D, camera: Camera, motion: SportMotion) {
  if (kind.startsWith('workout-') || !(camera instanceof OrthographicCamera)) return
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const point = new Vector3()
  for (const seconds of motion.boundsTimes) {
    motion.update(seconds)
    root.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    root.traverse(object => {
      if (!(object instanceof Mesh)) return
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
      }
    })
  }
  motion.update(0)
  const extent = Math.max(maxX - minX, maxY - minY) / 2 / .84
  if (!Number.isFinite(extent) || extent <= 0) return
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2
  camera.left = centerX - extent; camera.right = centerX + extent
  camera.top = centerY + extent; camera.bottom = centerY - extent
  camera.updateProjectionMatrix()
}
