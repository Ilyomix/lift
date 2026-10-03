import { Group, Vector3 } from 'three'
import { placeBetween } from './exerciseModelEquipment'
import type { Point } from './exerciseModelRig'
import type { ExerciseContext, ExerciseMotion } from './exerciseModelTypes'

export const UPPER_EXERCISES = new Set([
  'chest-press', 'incline-db-press', 'pec-deck', 'cable-fly', 'dips',
  'lat-pulldown', 'low-cable-row', 'chest-supported-row', 'cable-pullover', 'single-arm-pulldown',
  'reverse-pec-deck', 'face-pull', 'shoulder-press-machine', 'lateral-raise', 'cable-lateral-raise',
  'db-bench-press', 'db-floor-press', 'push-up', 'feet-elevated-push-up', 'db-fly', 'band-fly',
  'close-grip-push-up', 'pull-up', 'chin-up', 'band-pulldown', 'one-arm-db-row', 'band-row',
  'doorframe-row', 'prone-y-raise', 'inverted-row', 'db-pullover', 'band-straight-arm-pulldown',
  'db-rear-delt-fly', 'band-pull-apart', 'db-shoulder-press', 'pike-push-up', 'band-lateral-raise',
])

const SIDES = [-1, 1]
const pair = (point: (side: number) => Point) => SIDES.map(point)
const feet = pair(s => [s * 0.205, 0.078, 0.015])
const knees = pair(s => [s * 0.15, 0.52, 0.035])
const footRotations: Point[] = [[0, 0, 0], [0, 0, 0]]
const pronated: Point[] = [[1, 0, 0], [-1, 0, 0]]
const neutral: Point[] = [[0, 1, 0], [0, 1, 0]]
const standard = { camera: [2.7, 1.75, 3.8] as Point, target: [0, 0.95, 0.04] as Point, height: 2.08 }
// Measured bind landmarks in the 1.82 m export, transformed with the torso.
const shoulders = (hips: Point, lean: number) => pair(s => [s * 0.1922427,
  hips[1] + 0.4749603 * Math.cos(lean) - 0.0138925 * Math.sin(lean),
  hips[2] + 0.4749603 * Math.sin(lean) + 0.0138925 * Math.cos(lean)])

export function createUpperExercise(id: string, { body, equipment: eq }: ExerciseContext): ExerciseMotion | null {
  if (!UPPER_EXERCISES.has(id)) return null
  const motion = (update: ExerciseMotion['update'], framing: Partial<Omit<ExerciseMotion, 'update'>> = {}): ExerciseMotion => ({ ...standard, ...framing, update })
  const stand = (hands: Point[], poles: Point[], grip = true, axes = neutral, lean = 0) => body.pose([0, 0.983, 0], lean, knees, feet, hands, poles, { footRotations, grip, gripAxes: axes })
  const attach = (objects: Group[], positions: Vector3[]) => objects.forEach((object, i) => object.position.copy(positions[i]))

  if (id === 'chest-press' || id === 'shoulder-press-machine' || id === 'db-shoulder-press') {
    const overhead = id !== 'chest-press', free = id === 'db-shoulder-press'
    eq.block([0, 0.58, 0.025], [0.40, 0.075, 0.34])
    eq.block([0, 0.96, -0.15], [0.33, 0.58, 0.075], -0.035)
    eq.bar([0, 0.05, -0.15], [0, 1.26, -0.17], 0.035)
    eq.bar([-0.45, 0.05, 0], [0.45, 0.05, 0], 0.035)
    eq.bar([0, 0.05, -0.45], [0, 0.05, 0.46], 0.035)
    const loads = free ? SIDES.map(() => eq.dumbbell()) : SIDES.map(() => eq.handle())
    const arms = free ? [] : SIDES.map(s => {
      eq.bar([s * 0.46, 0.05, -0.16], [s * 0.46, 1.05, -0.16])
      eq.block([s * 0.46, 0.47, -0.20], [0.13, 0.56, 0.16], 0, eq.rubber)
      return eq.bar([s * 0.46, 1.05, -0.16], [s * 0.3, 1.05, 0.25], 0.021)
    })
    return motion(t => {
      const hands = overhead ? pair(s => [s * (0.33 - 0.10 * t), 1.20 + 0.46 * t, 0.14]) : pair(s => [s * (0.355 - 0.10 * t), 1.025 + 0.05 * t, 0.25 + 0.275 * t])
      const result = body.pose([0, 0.695, 0], -0.035, pair(s => [s * 0.19, 0.59, 0.42]), pair(s => [s * 0.19, 0.08, 0.43]), hands,
        overhead ? pair(s => [s * 0.62, 1.17, 0.03]) : pair(s => [s * 0.75, 0.80, 0.01]),
        { footRotations, grip: true, gripAxes: free ? pronated : neutral })
      loads.forEach((load, i) => load.position.copy(result.hands[i]))
      arms.forEach((arm, i) => placeBetween(arm, [SIDES[i] * 0.46, 1.05, -0.16], result.hands[i]))
    }, { target: [0, overhead ? 0.94 : 0.78, 0.03], height: overhead ? 2.04 : 1.76 })
  }

  if (['db-bench-press', 'incline-db-press', 'db-floor-press', 'db-fly', 'db-pullover'].includes(id)) {
    const incline = id === 'incline-db-press', floor = id === 'db-floor-press' || id === 'db-fly', fly = id === 'db-fly', pullover = id === 'db-pullover'
    const hipY = floor ? 0.18 : 0.62, lean = incline ? -Math.PI / 3 : -Math.PI / 2
    if (!floor) eq.bench([0, incline ? 0.62 : 0.50, -0.19], incline ? Math.PI / 6 : 0, 1.18)
    else eq.block([0, 0.018, -0.1], [0.70, 0.035, 1.65], 0, eq.rubber)
    const loads = pullover ? [eq.dumbbell()] : SIDES.map(() => eq.dumbbell())
    return motion(t => {
      const shoulderY = hipY + (incline ? 0.235 : 0), shoulderZ = incline ? -0.40 : -0.47
      const actualShoulders = shoulders([0, hipY, 0], lean)
      let targets: Point[]
      if (pullover) {
        const angle = 0.18 + 1.38 * t
        targets = actualShoulders.map((origin, i): Point => [SIDES[i] * 0.075, origin[1] + 0.5271 * Math.sin(angle), origin[2] - 0.5271 * Math.cos(angle)])
      } else if (fly) {
        const angle = 1.45 - 1.72 * t
        targets = actualShoulders.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(angle), origin[1] + 0.54 * Math.cos(angle), origin[2]])
      }
      else targets = pair(s => [s * (0.33 - 0.12 * t), shoulderY + 0.14 + 0.40 * t, shoulderZ + 0.10])
      const result = body.pose([0, hipY, 0], lean,
        pair(s => [s * 0.19, floor ? 0.35 : 0.49, 0.42]), pair(s => [s * 0.21, 0.08, floor ? 0.72 : 0.48]), targets,
        pullover ? pair(s => [s * 0.35, hipY + 0.1, -0.78]) : pair(s => [s * 0.70, shoulderY + 0.03, shoulderZ + 0.15]),
        { footRotations, grip: true, gripAxes: pronated })
      if (pullover) loads[0].position.copy(result.hands[0]).add(result.hands[1]).multiplyScalar(0.5)
      else attach(loads, result.hands)
    }, { camera: [2.7, 2.15, 2.8], target: [0, floor ? 0.34 : 0.72, -0.20], height: floor ? 1.55 : 1.83 })
  }

  if (id === 'pec-deck' || id === 'cable-fly' || id === 'band-fly') {
    const seated = id === 'pec-deck', band = id === 'band-fly', hipY = seated ? 0.695 : 0.983
    if (seated) {
      eq.block([0, 0.58, 0.03], [0.38, 0.08, 0.35]); eq.block([0, 1.0, -0.15], [0.32, 0.60, 0.07])
      eq.bar([0, 0.05, -0.16], [0, 1.50, -0.16], 0.035)
      eq.bar([-0.56, 1.145, -0.12], [0.56, 1.145, -0.12], 0.028)
      eq.bar([-0.4, 0.045, -0.16], [0.4, 0.045, -0.16], 0.03)
      eq.bar([0, 0.05, -0.16], [0, 0.58, 0.03], 0.035)
    } else if (!band) { eq.tower([-0.90, 0, -0.28]); eq.tower([0.90, 0, -0.28]) }
    else { eq.bar([-0.45, 0.03, -0.4], [-0.45, 1.65, -0.4], 0.025); eq.bar([0.45, 0.03, -0.4], [0.45, 1.65, -0.4], 0.025) }
    const handles = SIDES.map(() => eq.handle())
    const cables = SIDES.map(s => seated ? eq.bar([s * 0.55, hipY + 0.45, -0.12], [s * 0.5, hipY + 0.38, 0.15], 0.023) : eq.cable([s * (band ? 0.45 : 0.9), hipY + 0.45, -0.4], [s * 0.5, hipY + 0.38, 0.15]))
    return motion(t => {
      const angle = 1.30 - 1.57 * t
      const targets = shoulders([0, hipY, 0], 0).map((shoulder, i): Point => [shoulder[0] + SIDES[i] * 0.53404 * Math.sin(angle), shoulder[1] - 0.08, shoulder[2] + 0.53404 * Math.cos(angle)])
      const result = body.pose([0, hipY, 0], 0, seated ? pair(s => [s * 0.18, 0.55, 0.40]) : knees,
        seated ? pair(s => [s * 0.19, 0.08, 0.43]) : feet, targets, pair(s => [s * 0.65, hipY + 0.25, 0.02]), { footRotations, grip: true })
      handles.forEach((handle, i) => handle.position.copy(result.hands[i]))
      cables.forEach((cable, i) => placeBetween(cable, [SIDES[i] * (seated ? 0.55 : band ? 0.45 : 0.9), hipY + 0.45, seated ? -0.12 : -0.4], result.hands[i]))
    }, { target: [0, seated ? 0.8 : 1.06, 0], height: seated ? 1.82 : band ? 2.1 : 2.4 })
  }

  if (id === 'dips') {
    for (const s of SIDES) { eq.bar([s * 0.33, 0.03, 0], [s * 0.33, 1.14, 0], 0.035); eq.bar([s * 0.33, 1.14, -0.28], [s * 0.33, 1.14, 0.36], 0.025) }
    return motion(t => {
      const hip = 1.06 + 0.23 * t
      body.pose([0, hip, 0], 0.12, pair(s => [s * 0.13, hip - 0.4, 0.04]), pair(s => [s * 0.12, hip - 0.50, -0.33]),
        pair(s => [s * 0.33, 1.14, 0.06]), pair(s => [s * 0.50, 1.28, -0.25]), { grip: true, footRotations, gripAxes: pair(() => [0, 0, 1]), gripDirections: pair(() => [0, -1, 0]), gripTargets: true })
    }, { target: [0, 1.10, 0], height: 2.30 })
  }

  if (['lat-pulldown', 'band-pulldown', 'single-arm-pulldown', 'pull-up', 'chin-up'].includes(id)) {
    const hanging = id === 'pull-up' || id === 'chin-up', single = id === 'single-arm-pulldown', band = id === 'band-pulldown'
    const height = hanging ? 2.15 : 2.12
    if (hanging) {
      for (const s of SIDES) eq.bar([s * 0.67, 0.02, 0.12], [s * 0.67, height, 0.12], 0.035)
      eq.bar([-0.67, height, 0.12], [0.67, height, 0.12], 0.023)
    } else if (band || single) {
      eq.bar([0, 0.04, 0.62], [0, height, 0.62], 0.032)
      eq.bar([-0.32, 0.035, 0.62], [0.32, 0.035, 0.62], 0.025)
      eq.block([0, 0.018, -0.05], [0.65, 0.035, 1.0], 0, eq.rubber)
      if (single) eq.block([0, 0.60, 0.65], [0.18, 0.75, 0.15], 0, eq.rubber)
    } else {
      eq.tower([0, 0, -0.50], height)
      eq.bar([0, height, -0.50], [0, height, 0.62], 0.032)
      eq.block([0, 0.58, -0.03], [0.42, 0.075, 0.38])
      eq.block([0, 0.74, 0.36], [0.48, 0.10, 0.13])
    }
    const bandHandles = band ? SIDES.map(() => eq.handle()) : []
    const bandLines = band ? SIDES.map(() => eq.cable([0, height, 0.62], [0, 1.8, 0.17])) : []
    const handle = !hanging && !single && !band ? eq.bar([-0.47, 1.8, 0.17], [0.47, 1.8, 0.17], 0.014) : single ? eq.handle() : null
    const cable = !hanging && !band ? eq.cable([0, height, 0.62], [0, 1.8, 0.17]) : null
    return motion(t => {
      const hipY = hanging ? (id === 'chin-up' ? 1.047 : 1.058) + (id === 'chin-up' ? 0.463 : 0.452) * t : band || single ? 0.55 : 0.695
      const handY = hanging ? height : hipY + 0.96 - 0.48 * t
      const width = id === 'chin-up' ? 0.24 : single ? 0.20 : 0.35
      const targets = pair(s => [s * width, handY, hanging ? 0.12 : 0.17])
      if (single) targets[0] = [-0.23, 0.73, 0.30]
      const result = body.pose([0, hipY, 0], hanging ? -0.02 : -0.04,
        hanging ? pair(s => [s * 0.13, hipY - 0.42, 0.02]) : single ? [[-0.17, 0.46, 0.34], [0.17, 0.09, 0.03]] : band ? pair(s => [s * 0.17, 0.09, 0.03]) : pair(s => [s * 0.19, 0.54, 0.43]),
        hanging ? pair(s => [s * 0.12, hipY - 0.79, -0.17]) : single ? [[-0.17, 0.08, 0.47], [0.17, 0.08, -0.40]] : band ? pair(s => [s * 0.17, 0.08, -0.4]) : pair(s => [s * 0.2, 0.08, 0.46]),
        targets, pair(s => [s * 0.7, hipY + 0.36, 0.03]), { grip: true, footRotations, gripAxes: id === 'chin-up' ? pair(s => [s, 0, 0]) : pronated, gripDirections: hanging ? pair(() => [0, 1, 0]) : undefined, gripTargets: hanging })
      if (single && handle) handle.position.copy(result.hands[1])
      else if (handle) placeBetween(handle, result.hands[0], result.hands[1])
      if (cable) placeBetween(cable, [single ? 0.2 : 0, height, 0.62], single ? result.hands[1] : result.hands[0].clone().add(result.hands[1]).multiplyScalar(0.5))
      bandHandles.forEach((grip, i) => { grip.position.copy(result.hands[i]); placeBetween(bandLines[i], [0, height, 0.62], result.hands[i]); bandLines[i].material = eq.grip })
    }, { target: [0, 1.10, 0.12], height: 2.48, camera: [2.8, 1.65, 4.1] })
  }

  if (['low-cable-row', 'chest-supported-row', 'band-row', 'doorframe-row', 'one-arm-db-row', 'inverted-row'].includes(id)) {
    const supported = id === 'chest-supported-row', single = id === 'one-arm-db-row', inverted = id === 'inverted-row', door = id === 'doorframe-row', band = id === 'band-row'
    const seated = id === 'low-cable-row'
    const grips = SIDES.map(() => eq.handle())
    let load: Group | null = null
    if (supported) {
      eq.block([0, 1.16, 0.32], [0.34, 0.43, 0.09], 0.58)
      eq.bar([0, 0.06, 0.53], [0, 1.22, 0.38], 0.038)
      eq.bar([-0.44, 0.05, 0.5], [0.44, 0.05, 0.5], 0.038)
      eq.bar([0, 0.05, -0.49], [0, 0.05, 0.7], 0.038)
      SIDES.forEach(s => eq.block([s * 0.20, 0.083, -0.30], [0.23, 0.04, 0.35], -0.12))
    } else if (single) { eq.bench([0.19, 0.5, 0.1]); load = eq.dumbbell(); grips.forEach(grip => { grip.visible = false }) }
    else if (inverted || door) {
      for (const s of SIDES) eq.bar([s * (door ? 0.40 : 0.55), 0.02, inverted ? -0.55 : 0.40], [s * (door ? 0.40 : 0.55), inverted ? 1.1 : 2.05, inverted ? -0.55 : 0.40], 0.035)
      eq.bar([door ? -0.40 : -0.55, inverted ? 1.1 : 2.05, inverted ? -0.55 : 0.40], [door ? 0.40 : 0.55, inverted ? 1.1 : 2.05, inverted ? -0.55 : 0.40], 0.025)
    } else if (band) eq.block([0, 0.018, 0.25], [0.72, 0.035, 1.40], 0, eq.rubber)
    else { eq.tower([0, 0, 1.0], 1.5); eq.block([0, 0.42, 0], [0.45, 0.08, 0.4]) }
    const connectors = supported ? [eq.bar([0, 0.08, 0.70], [0, 0.85, 0.45], 0.028), eq.bar([-0.3, 1.0, 0.5], [0.3, 1.0, 0.5], 0.023)] : !single && !door && !inverted ? [eq.cable([0, seated ? 0.62 : 1.2, 1.0], [0, 1.0, 0.5])] : []
    const plate = supported ? eq.plate([0, 0.45, 0.6], 0.19, 0.045) : null
    return motion(t => {
      let hip: Point = [0, seated ? 0.55 : 0.983, 0], lean = 0
      let legKnees = knees, legFeet = feet
      let hands = pair(s => [s * 0.25, seated ? 0.92 : 1.20, 0.53 - 0.31 * t])
      if (supported) { hip = [0, 0.98, -0.06]; lean = 0.57; legKnees = pair(s => [s * 0.16, 0.52, -0.2]); legFeet = pair(s => [s * 0.20, 0.18, -0.32]); hands = pair(s => [s * (0.28 + 0.05 * t), 0.98 + 0.125 * t, 0.565 - 0.365 * t]) }
      if (seated) { legKnees = pair(s => [s * 0.20, 0.43, 0.44]); legFeet = pair(s => [s * 0.22, 0.10, 0.765]) }
      if (single) { hip = [0, 0.82, 0]; lean = 0.95; hands = [[-0.30, 0.60 + 0.36 * t, 0.42 - 0.34 * t], [0.19, 0.56, 0.51]]; legKnees = [[-0.25, 0.48, -0.08], [0.18, 0.60, 0.12]]; legFeet = [[-0.28, 0.08, -0.12], [0.20, 0.53, -0.32]] }
      if (band) { hip = [0, 0.17, 0]; lean = -0.04; legFeet = pair(s => [s * 0.16, 0.08, 0.89]); legKnees = pair(s => [s * 0.16, 0.18, 0.45]); hands = pair(s => [s * 0.17, 0.52, 0.52 - 0.31 * t]) }
      if (door) { hip = [0, 0.92 + 0.05 * t, -0.09 + 0.16 * t]; lean = -0.23 + 0.20 * t; hands = [[-0.27, hip[1] + 0.10, hip[2] + 0.10], [0.40, 1.28, 0.40]]; legFeet = pair(s => [s * 0.2, 0.08, 0.15]); grips[0].visible = false }
      if (inverted) {
        const hipY = 0.328 + 0.272 * t
        hip = [0, hipY, 0.80 - Math.sqrt(0.911 ** 2 - (hipY - 0.078) ** 2)]
        lean = -Math.acos((hipY - 0.078) / 0.911)
        hands = pair(s => [s * 0.32, 1.10, -0.55])
        legFeet = pair(s => [s * 0.16, 0.078, 0.80])
        legKnees = pair(s => [s * 0.16, (hipY + 0.078) / 2, 0.44])
      }
      const result = body.pose(hip, lean, legKnees, legFeet, hands,
        pair(s => [s * (band || single ? 0.35 : 0.65), single ? 0.96 : band ? 0.47 : supported ? 1.14 : seated ? 0.83 : 1.2, -0.23]), { footRotations, grip: true, gripAxes: inverted ? pronated : neutral, gripDirections: inverted ? pair(() => [0, 1, 0]) : door ? pair(() => [0, 0, 1]) : undefined, flatHandSides: single ? [false, true] : undefined, gripTargets: inverted || door })
      grips.forEach((grip, i) => grip.position.copy(result.hands[i]))
      if (load) load.position.copy(result.hands[0])
      const middle = result.hands[0].clone().add(result.hands[1]).multiplyScalar(0.5)
      if (supported) {
        placeBetween(connectors[0], [0, 0.08, 0.70], middle)
        placeBetween(connectors[1], result.hands[0], result.hands[1])
        plate!.position.set(0, 0.08, 0.70).lerp(middle, 0.46)
        plate!.rotation.z = 0
        plate!.quaternion.copy(connectors[0].quaternion)
      } else if (connectors[0]) placeBetween(connectors[0], band ? [0, 0.14, 0.88] : [0, 0.62, 1.0], middle)
    }, { target: [0, inverted ? 0.63 : supported || single ? 0.86 : 0.99, 0.03], height: inverted ? 1.8 : 2.1, camera: single ? [-3.0, 1.9, 3.7] : door ? [4.0, 1.7, 0.8] : supported ? [2.8, 1.85, -3.2] : [3.0, 1.9, 3.7] })
  }

  if (['cable-pullover', 'band-straight-arm-pulldown', 'face-pull'].includes(id)) {
    const face = id === 'face-pull'
    if (id === 'band-straight-arm-pulldown') { eq.bar([0, 0.03, 1.05], [0, 2.15, 1.05]); eq.bar([-0.25, 0.03, 1.05], [0.25, 0.03, 1.05]) }
    else eq.tower([0, 0, 1.05], 2.15)
    const grips = SIDES.map(() => eq.handle())
    const anchor: Point = [0, face ? 1.55 : 2.12, 1.05]
    const ropes = SIDES.map(() => eq.cable(anchor, [0, 1.4, 0.5]))
    return motion(t => {
      const angle = 0.65 - 1.85 * t
      const targets = face ? pair(s => [s * (0.12 + 0.21 * t), 1.40 + 0.08 * t, 0.54 - 0.44 * t]) : shoulders([0, 0.983, 0], 0.10).map((shoulder): Point => [shoulder[0], shoulder[1] + 0.54 * Math.sin(angle), shoulder[2] + 0.54 * Math.cos(angle)])
      const result = stand(targets, face ? pair(s => [s * 0.7, 1.50, -0.1]) : pair(s => [s * 0.22, 1.32, 0.36]), true, neutral, face ? 0 : 0.10)
      grips.forEach((grip, i) => grip.position.copy(result.hands[i]))
      ropes.forEach((rope, i) => placeBetween(rope, anchor, result.hands[i]))
    }, { target: [0, 1.02, 0.2], height: 2.4 })
  }

  if (['lateral-raise', 'cable-lateral-raise', 'band-lateral-raise', 'reverse-pec-deck', 'db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise'].includes(id)) {
    const cable = id === 'cable-lateral-raise', band = id.startsWith('band-'), reverse = id === 'reverse-pec-deck', rear = id === 'db-rear-delt-fly', apart = id === 'band-pull-apart', prone = id === 'prone-y-raise'
    const dumbbells = !cable && !band && !reverse && !prone ? SIDES.map(() => eq.dumbbell()) : []
    dumbbells.forEach(dumbbell => { dumbbell.rotation.y = Math.PI / 2 })
    const handles = cable || band || reverse ? SIDES.map(() => eq.handle()) : []
    if (reverse) { eq.block([0, 0.59, 0], [0.4, 0.08, 0.34]); eq.block([0, 1.05, 0.15], [0.32, 0.42, 0.07]); eq.bar([0, 0.04, 0.22], [0, 1.5, 0.22], 0.035); eq.bar([-0.55, 1.2, 0.5], [0.55, 1.2, 0.5], 0.027); eq.bar([0, 1.2, 0.22], [0, 1.2, 0.5]); eq.bar([-.35,.05,.22],[.35,.05,.22]); eq.bar([0,.05,.22],[0,.59,0]) }
    if (cable) eq.tower([-0.70, 0, 0.03], 1.8)
    if (prone) eq.block([0, 0.012, 0.1], [0.85, 0.025, 1.85], 0, eq.rubber)
    const connectors = apart ? [eq.cable([-0.15, 1.4, 0.4], [0.15, 1.4, 0.4])] : cable || band || reverse ? SIDES.map(s => eq.cable([s * 0.20, reverse ? 1.2 : 0.04, reverse ? 0.5 : 0], [s * 0.3, 1.0, 0])) : []
    return motion(t => {
      let hip: Point = [0, reverse ? 0.695 : prone ? 0.17 : rear ? 0.97 : 0.983, 0]
      let lean = rear ? 0.90 : prone ? Math.PI / 2 : 0
      const origins = shoulders(hip, lean)
      const angle = 0.08 + 1.40 * t
      let targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(angle), origin[1] - 0.54 * Math.cos(angle), origin[2]])
      if (reverse || apart) { const arc = -0.17 + 1.57 * t; targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(arc), origin[1], origin[2] + 0.54 * Math.cos(arc)]) }
      if (rear) targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(angle), origin[1] - 0.54 * Math.cos(angle), origin[2]])
      if (prone) { const lift = -0.12 + 0.52 * t; targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.cos(lift) * 0.60, origin[1] + 0.54 * Math.sin(lift), origin[2] + 0.54 * Math.cos(lift) * 0.80]) }
      if (cable) targets[0] = [-0.25, 0.98, 0.09]
      const result = body.pose(hip, lean,
        reverse ? pair(s => [s * 0.18, 0.53, 0.41]) : prone ? pair(s => [s * 0.15, 0.12, -0.43]) : knees,
        reverse ? pair(s => [s * 0.19, 0.08, 0.43]) : prone ? pair(s => [s * 0.15, 0.20, -0.87]) : feet,
        targets, pair(s => [s * 0.65, rear ? 1.09 : prone ? 0.45 : reverse ? 1.0 : 1.18, rear || prone ? 0.4 : -0.05]),
        { footRotations: prone ? pair(() => [Math.PI / 2, 0, 0]) : footRotations, grip: !prone, openHands: prone, gripAxes: dumbbells.length ? pair(() => [0,0,1]) : neutral })
      attach(dumbbells, result.hands)
      handles.forEach((handle, i) => { handle.position.copy(result.hands[i]); handle.visible = !cable || i === 1 })
      if (apart) placeBetween(connectors[0], result.hands[0], result.hands[1])
      else connectors.forEach((line, i) => {
        line.visible = !cable || i === 1
        placeBetween(line, cable ? [-0.70, 0.10, 0.03] : [SIDES[i] * 0.2, reverse ? 1.2 : 0.008, reverse ? 0.5 : 0.015], result.hands[i])
      })
    }, { camera: prone ? [2.2, 3.7, 1.6] : rear || reverse ? [2.7, 2.0, -3.4] : [2.3, 1.6, 4.1], target: [0, prone ? 0.20 : reverse ? 0.8 : 0.98, prone ? 0.07 : 0], height: prone ? 1.9 : 2.1 })
  }

  if (['push-up', 'feet-elevated-push-up', 'close-grip-push-up', 'pike-push-up'].includes(id)) {
    const elevated = id === 'feet-elevated-push-up', narrow = id === 'close-grip-push-up', pike = id === 'pike-push-up'
    eq.block([0, 0.017, 0], [0.85, 0.025, 1.7], 0, eq.rubber)
    if (elevated) eq.block([0, 0.22, -0.78], [0.65, 0.43, 0.35])
    return motion(t => {
      const ankleY = elevated ? 0.612 : 0.209
      const hipY = pike ? 0.86 : elevated ? 0.50 + 0.09 * t : 0.29 + 0.16 * t
      const lean = pike ? 2.45 - 0.18 * t : Math.acos((hipY - ankleY) / 0.911)
      // The hip joint is offset from the pelvis origin. Preserve the true
      // ankle-to-hip length as the torso folds at the hips in the pike.
      const thighY = -0.0080899 * Math.cos(lean) + 0.0107461 * Math.sin(lean)
      const thighZ = -0.0080899 * Math.sin(lean) - 0.0107461 * Math.cos(lean)
      const hipZ = pike
        ? -0.72 + Math.sqrt(0.904 ** 2 - (hipY + thighY - ankleY) ** 2 - (0.17 - 0.1115) ** 2) - thighZ
        : -0.96 + Math.sqrt(0.911 ** 2 - (hipY - ankleY) ** 2)
      body.pose([0, hipY, hipZ], lean,
        pair(s => [s * 0.14, pike ? 0.48 : (hipY + ankleY) / 2, -0.48]),
        pair(s => [s * 0.17, ankleY, pike ? -0.72 : -0.96]),
        pair(s => [s * (narrow ? 0.12 : 0.30), 0.032, pike ? 0.35 : 0.46]),
        pair(s => [s * (narrow ? 0.22 : 0.52), pike ? 0.45 : 0.24, 0.22]),
        { footRotations: pair(() => [0.65, 0, 0]), flatHands: true, gripTargets: true })
    }, { camera: [2.7, 1.8, 3.3], target: [0, pike ? 0.71 : 0.43, -0.03], height: pike ? 1.9 : 1.62 })
  }
  return null
}
