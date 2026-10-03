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
// Carry the elbow's bend plane with an isolation arc. A fixed world-space
// pole can pass almost through the shoulder–wrist axis and spin the arm.
const arcPole = (origin: Point, pole: Point, axis: Point, angle: number): Point =>
  new Vector3(...pole).sub(new Vector3(...origin)).applyAxisAngle(new Vector3(...axis), angle).add(new Vector3(...origin)).toArray() as Point

export function createUpperExercise(id: string, context: ExerciseContext): ExerciseMotion | null {
  const motion = buildUpperExercise(id, context)
  if (motion) context.body.calibrateTwistFromPose(() => motion.update(0))
  return motion
}

function buildUpperExercise(id: string, { body, equipment: eq }: ExerciseContext): ExerciseMotion | null {
  if (!UPPER_EXERCISES.has(id)) return null
  const motion = (update: ExerciseMotion['update'], framing: Partial<Omit<ExerciseMotion, 'update'>> = {}): ExerciseMotion => ({ ...standard, ...framing, update })
  const stand = (hands: Point[], poles: Point[], grip = true, axes = neutral, lean = 0) => body.pose([0, 0.983, 0], lean, knees, feet, hands, poles, { footRotations, grip, gripAxes: axes })
  const palms = [body.manifest.bones.right, body.manifest.bones.left].map(side => ({
    wrist: body.root.getObjectByName(side.hand)!,
    index: body.root.getObjectByName(side.palmLandmarks!.index)!,
    middle: body.root.getObjectByName(side.palmLandmarks!.middle)!,
    pinky: body.root.getObjectByName(side.palmLandmarks!.pinky)!,
  }))
  const gripAxis = (i: number) => {
    const palm = palms[i]
    const long = palm.middle.getWorldPosition(new Vector3()).sub(palm.wrist.getWorldPosition(new Vector3())).normalize()
    const axis = palm.index.getWorldPosition(new Vector3()).sub(palm.pinky.getWorldPosition(new Vector3()))
    return axis.addScaledVector(long, -axis.dot(long)).normalize()
  }
  const attach = (objects: Group[], positions: Vector3[]) => objects.forEach((object, i) => {
    object.position.copy(positions[i])
    object.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), gripAxis(i))
  })

  if (id === 'pec-deck' || id === 'reverse-pec-deck') {
    const reverse = id === 'reverse-pec-deck'
    const machine = eq.flyMachine(reverse)
    return motion(t => {
      const { targets, directions } = machine(t)
      body.pose([0, .695, 0], 0, pair(s => [s * .18, .55, .40]), pair(s => [s * .19, .08, .43]),
        targets, pair(s => [s * .65, reverse ? 1.0 : .945, -.05]),
        { footRotations, grip: true, gripAxes: neutral, gripDirections: directions, gripTargets: true })
    }, { camera: reverse ? [2.7, 2.0, -3.4] : [2.7, 1.75, 3.8], target: [0, .97, .12], height: 2.3 })
  }

  if (id === 'chest-press' || id === 'shoulder-press-machine' || id === 'db-shoulder-press') {
    const overhead = id !== 'chest-press', free = id === 'db-shoulder-press'
    const machine = free ? null : eq.pressMachine(overhead)
    if (free) eq.machineSeat(false, -.035)
    const loads = free ? SIDES.map(() => eq.dumbbell()) : []
    return motion(t => {
      const lever = machine?.(t)
      const hands = lever?.targets ?? pair(s => [s * (.33 - .10 * t), 1.20 + .46 * t, .14])
      const result = body.pose([0, .695, 0], -.035, pair(s => [s * .19, .59, .42]), pair(s => [s * .19, .08, .43]), hands,
        overhead ? pair(s => [s * .62, 1.17, .03]) : pair(s => [s * .75, .80, .01]),
        { footRotations, grip: true, gripAxes: lever?.axes ?? pronated, gripDirections: lever?.directions, gripTargets: !!lever })
      attach(loads, result.hands)
    }, { target: [0, .97, .03], height: free ? 2.04 : 2.30 })
  }

  if (['db-bench-press', 'incline-db-press', 'db-floor-press', 'db-fly', 'db-pullover'].includes(id)) {
    const incline = id === 'incline-db-press', floor = id === 'db-floor-press' || id === 'db-fly', fly = id === 'db-fly', pullover = id === 'db-pullover'
    const hipY = floor ? 0.18 : 0.62, lean = incline ? -Math.PI / 3 : -Math.PI / 2
    if (!floor) eq.bench([0, incline ? 0.62 : 0.50, -0.19], incline ? Math.PI / 6 : 0, 1.18)
    else eq.block([0, 0.018, -0.1], [0.70, 0.035, 1.65], 0, eq.rubber)
    const loads = pullover ? [eq.dumbbell()] : SIDES.map(() => eq.dumbbell())
    if (pullover) loads[0].quaternion.setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(0, 1, 0))
    return motion(t => {
      const shoulderY = hipY + (incline ? 0.235 : 0), shoulderZ = incline ? -0.40 : -0.47
      const actualShoulders = shoulders([0, hipY, 0], lean)
      let targets: Point[]
      if (pullover) {
        const angle = 0.18 + 1.38 * t
        // Both palms support the underside of the upper head, not the narrow
        // shaft. Preserve shoulder reach while bringing the wrists together.
        const radius = Math.sqrt(.5271 ** 2 + (.1922427 - .075) ** 2 - (.1922427 - .045) ** 2)
        targets = actualShoulders.map((origin, i): Point => [SIDES[i] * .045, origin[1] + radius * Math.sin(angle), origin[2] - radius * Math.cos(angle)])
      } else if (fly) {
        const angle = 1.45 - 1.72 * t
        targets = actualShoulders.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(angle), origin[1] + 0.54 * Math.cos(angle), origin[2]])
      }
      else targets = pair(s => [s * (0.33 - 0.12 * t), shoulderY + 0.14 + 0.40 * t, shoulderZ + 0.10])
      const result = body.pose([0, hipY, 0], lean,
        pair(s => [s * 0.19, floor ? 0.35 : 0.49, 0.42]), pair(s => [s * 0.21, 0.08, floor ? 0.72 : 0.48]), targets,
        pullover ? pair(s => [s * 0.35, hipY + 0.1, -0.78]) : pair(s => [s * 0.70, shoulderY + 0.03, shoulderZ + 0.15]),
        // Supine fly: longitudinal handles, palms facing one another at the
        // top. A world-X shaft is almost parallel to the open forearm.
        { footRotations, grip: !pullover, openHands: pullover, gripAxes: fly ? pair(() => [0, 0, -1]) : pronated,
          gripDirections: pullover ? pair(() => [0, 0, -1]) : undefined })
      if (pullover) loads[0].position.copy(result.hands[0]).add(result.hands[1]).multiplyScalar(0.5).add(new Vector3(0, -.043, 0))
      else attach(loads, result.hands)
    }, { camera: [2.7, 2.15, 2.8], target: [0, floor ? 0.34 : 0.72, -0.20], height: floor ? 1.55 : 1.83 })
  }

  if (id === 'cable-fly' || id === 'band-fly') {
    const band = id === 'band-fly', hipY = .983
    if (!band) { eq.tower([-.90, 0, -.28]); eq.tower([.90, 0, -.28]) }
    else { eq.bar([-.45, .03, -.4], [-.45, 1.65, -.4], .025); eq.bar([.45, .03, -.4], [.45, 1.65, -.4], .025) }
    const handles = SIDES.map(() => eq.cableHandle(.23))
    const cables = SIDES.map(s => eq.cable([s * (band ? .45 : .9), hipY + .45, -.4], [s * .5, hipY + .38, .15]))
    return motion(t => {
      const angle = 1.30 - 1.57 * t
      const targets = shoulders([0, hipY, 0], 0).map((shoulder, i): Point => [shoulder[0] + SIDES[i] * .53404 * Math.sin(angle), shoulder[1] - .08, shoulder[2] + .53404 * Math.cos(angle)])
      const result = body.pose([0, hipY, 0], 0, knees, feet, targets, pair(s => [s * .65, hipY + .25, .02]), { footRotations, grip: true })
      cables.forEach((cable, i) => {
        const anchor: Point = [SIDES[i] * (band ? .45 : .9), hipY + .45, -.4]
        placeBetween(cable, anchor, handles[i](result.hands[i], anchor, gripAxis(i)))
      })
    }, { target: [0, 1.06, 0], height: band ? 2.1 : 2.4 })
  }

  if (id === 'dips') {
    for (const s of SIDES) { eq.bar([s * 0.33, 0.03, 0], [s * 0.33, 1.14, 0], 0.035); eq.bar([s * 0.33, 1.14, -0.28], [s * 0.33, 1.14, 0.36], 0.018).name = 'contact-grip' }
    return motion(t => {
      const hip = 1.05 + 0.23 * t
      body.pose([0, hip, 0], 0.12, pair(s => [s * 0.13, hip - 0.4, 0.04]), pair(s => [s * 0.12, hip - 0.50, -0.33]),
        pair(s => [s * 0.33, 1.14, 0.06]), pair(s => [s * 0.50, 1.28, -0.25]), { grip: true, footRotations, gripAxes: pair(() => [0, 0, 1]), gripDirections: pair(() => [0, -1, 0]), gripTargets: true })
    }, { target: [0, 1.10, 0], height: 2.30 })
  }

  if (['lat-pulldown', 'band-pulldown', 'single-arm-pulldown', 'pull-up', 'chin-up'].includes(id)) {
    const hanging = id === 'pull-up' || id === 'chin-up', single = id === 'single-arm-pulldown', band = id === 'band-pulldown'
    const height = hanging ? 2.15 : 2.12
    if (hanging) {
      for (const s of SIDES) eq.bar([s * 0.67, 0.02, 0.12], [s * 0.67, height, 0.12], 0.035)
      eq.bar([-0.67, height, 0.12], [0.67, height, 0.12], 0.018).name = 'contact-grip'
    } else if (band || single) {
      eq.bar([0, 0.04, 0.62], [0, height, 0.62], 0.032)
      eq.bar([-.32, .035, .82], [.32, .035, .82], .025)
      eq.block([0, -.003, -.05], [.65, .006, 1.0], 0, eq.rubber)
      if (single) eq.block([0, 0.60, 0.65], [0.18, 0.75, 0.15], 0, eq.rubber)
    } else {
      eq.tower([0, 0, -0.50], height)
      eq.bar([0, height, -0.50], [0, height, 0.29], 0.032)
      eq.block([0, 0.52, -0.03], [0.42, 0.075, 0.38]).name = 'contact-seat'
      eq.bar([0, .06, -.03], [0, .48, -.03], .038)
      eq.block([0, .74, .36], [.48, .10, .13]).name = 'contact-thigh-pad'
      SIDES.forEach(side => {
        eq.bar([side * .38, .045, -.50], [side * .38, .74, .36], .030)
        eq.bar([side * .38, .74, .36], [side * .24, .74, .36], .025)
      })
      eq.pulley([0, height, .29]); eq.pulley([0, height, -.50])
    }
    const bandHandles = band ? SIDES.map(() => eq.handle()) : []
    const bandLines = band ? SIDES.map(() => eq.cable([0, height, 0.62], [0, 1.8, 0.17])) : []
    const handle = !hanging && !single && !band ? eq.bar([-.47, 0, 0], [.47, 0, 0], .014) : single ? eq.handle() : null
    if (handle && !single) handle.name = 'contact-grip'
    const singleGrip = single ? eq.cableHandle(.14, true) : null
    if (single && handle) handle.visible = false
    const cable = !hanging && !band ? eq.cable([0, height, 0.62], [0, 1.8, 0.17]) : null
    return motion(t => {
      const hipY = hanging ? (id === 'chin-up' ? 1.061 : 1.063) + (id === 'chin-up' ? 0.449 : 0.447) * t : band || single ? 0.55 : 0.695
      const handY = hanging ? height : hipY + (single || band ? .96 - .48 * t : 1.017 - .537 * t)
      const width = id === 'chin-up' ? 0.24 : single ? 0.20 : 0.35
      const targets = pair(s => [s * width, handY, hanging ? .12 : single || band ? .17 : .29])
      // The straight lat bar fixes the palm's transverse axis. Keep the hand
      // direction in its perpendicular plane as the forearms tilt during the
      // pull; projecting the shaft axis onto each forearm skewed the fingers.
      const latHandAngle = .407 + .35 * t * t * t
      const directions = hanging ? pair(() => [0, 1, 0]) : id === 'lat-pulldown'
        ? pair(() => [0, Math.cos(latHandAngle), Math.sin(latHandAngle)]) : undefined
      if (single) targets[0] = [-0.23, 0.73, 0.30]
      const result = body.pose([0, hipY, 0], hanging ? -0.02 : -0.04,
        hanging ? pair(s => [s * 0.13, hipY - 0.42, 0.02]) : single ? [[-0.17, 0.46, 0.34], [0.17, 0.09, 0.03]] : band ? pair(s => [s * 0.17, 0.09, 0.03]) : pair(s => [s * 0.19, 0.54, 0.43]),
        hanging ? pair(s => [s * 0.12, hipY - 0.79, -0.17]) : single ? [[-0.17, 0.08, 0.47], [0.17, 0.08, -0.40]] : band ? pair(s => [s * 0.17, 0.08, -0.4]) : pair(s => [s * 0.2, 0.08, 0.46]),
        targets, id === 'lat-pulldown' ? pair(s => [s * (.7 - .3 * t), hipY + .36 - .21 * t, .03 + .02 * t]) : pair(s => [s * .7, hipY + .36, .03]), { grip: true, footRotations, gripAxes: id === 'chin-up' ? pair(s => [s, 0, 0]) : pronated, gripDirections: directions, gripTargets: hanging || (!band && !single) })
      const barCentre = new Vector3(0, handY, .29)
      if (handle && !single) handle.position.copy(barCentre)
      if (cable) {
        const anchor: Point = [single ? .2 : 0, height, single ? .62 : .29]
        placeBetween(cable, anchor, singleGrip ? singleGrip(result.hands[1], anchor, gripAxis(1)) : barCentre)
      }
      bandHandles.forEach((grip, i) => {
        grip.position.copy(result.hands[i])
        grip.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), gripAxis(i))
        placeBetween(bandLines[i], [0, height, 0.62], result.hands[i])
      })
    }, { target: [0, 1.10, 0.12], height: 2.48, camera: [2.8, 1.65, 4.1] })
  }

  if (['low-cable-row', 'chest-supported-row', 'band-row', 'doorframe-row', 'one-arm-db-row', 'inverted-row'].includes(id)) {
    const supported = id === 'chest-supported-row', single = id === 'one-arm-db-row', inverted = id === 'inverted-row', door = id === 'doorframe-row', band = id === 'band-row'
    const seated = id === 'low-cable-row'
    const grips = SIDES.map(() => eq.handle())
    let load: Group | null = null
    const rowMachine = supported ? eq.supportedRow() : null
    if (supported) { grips.forEach(grip => { grip.visible = false }) } else if (single) { eq.bench([0.19, 0.5, 0.1]); load = eq.dumbbell(); grips.forEach(grip => { grip.visible = false }) }
    else if (inverted || door) {
      if (inverted) grips.forEach(grip => { grip.visible = false })
      for (const s of SIDES) {
        if (door && s === 1) {
          // Keep the structural post, with a hand-sized section at its grip.
          eq.bar([.40, .02, .40], [.40, 1.16, .40], .035)
          eq.bar([.40, 1.16, .40], [.40, 1.40, .40], .018).name = 'contact-grip'
          eq.bar([.40, 1.40, .40], [.40, 2.05, .40], .035)
        } else eq.bar([s * (door ? .40 : .55), .02, inverted ? -.55 : .40], [s * (door ? .40 : .55), inverted ? 1.1 : 2.05, inverted ? -.55 : .40], .035)
      }
      const crossbar = eq.bar([door ? -0.40 : -0.55, inverted ? 1.1 : 2.05, inverted ? -0.55 : 0.40], [door ? 0.40 : 0.55, inverted ? 1.1 : 2.05, inverted ? -0.55 : 0.40], inverted ? 0.018 : 0.025)
      if (inverted) crossbar.name = 'contact-grip'
    } else if (band) eq.block([0, 0.018, 0.25], [0.72, 0.035, 1.40], 0, eq.rubber)
    else {
      eq.tower([0, 0, 1.0], 1.5)
      eq.block([0, .366, 0], [.45, .08, .4]).name = 'contact-seat'
      eq.bar([0, .045, 0], [0, .326, 0], .035)
      eq.bar([-.32, .04, 0], [.32, .04, 0], .028)
      eq.bar([0, .04, 0], [0, .04, 1.0], .028)
      SIDES.forEach(side => eq.block([side * .22, .006, .82], [.24, .025, .35], 0, eq.rubber))
      eq.pulley([0, .62, 1.0])
    }
    const connectors = !supported && !single && !door && !inverted ? Array.from({ length: seated ? 2 : 1 }, () => eq.cable([0, seated ? .62 : 1.2, 1.0], [0, 1.0, .5])) : []
    const rowGrips = seated ? SIDES.map(() => eq.cableHandle()) : null
    if (rowGrips) grips.forEach(grip => { grip.visible = false })
    return motion(t => {
      let hip: Point = [0, seated ? 0.55 : 0.983, 0], lean = 0
      let legKnees = knees, legFeet = feet
      let hands = pair(s => [s * 0.25, seated ? 0.92 : 1.20, 0.53 - 0.31 * t])
      if (supported) { hip = [0, 0.98, -0.06]; lean = 0.57; legKnees = pair(s => [s * 0.16, 0.52, -0.2]); legFeet = pair(s => [s * 0.20, 0.18, -0.32]) }
      if (seated) { legKnees = pair(s => [s * 0.20, 0.43, 0.44]); legFeet = pair(s => [s * 0.22, 0.10, 0.765]) }
      if (single) { hip = [0, 0.82, 0]; lean = 0.95; hands = [[-0.30, 0.60 + 0.36 * t, 0.42 - 0.34 * t], [0.19, 0.56, 0.51]]; legKnees = [[-0.25, 0.48, -0.08], [0.18, 0.60, 0.12]]; legFeet = [[-0.28, 0.08, -0.12], [0.20, 0.53, -0.32]] }
      if (band) { hip = [0, 0.17, 0]; lean = -0.04; legFeet = pair(s => [s * 0.16, 0.08, 0.89]); legKnees = pair(s => [s * 0.16, 0.18, 0.45]); hands = pair(s => [s * 0.17, 0.52, 0.52 - 0.31 * t]) }
      if (door) { hip = [0, 0.92 + 0.05 * t, -0.073 + 0.143 * t]; lean = -0.23 + 0.20 * t; hands = [[-0.27, hip[1] + 0.10, hip[2] + 0.10], [0.40, 1.28, 0.40]]; legFeet = pair(s => [s * 0.2, 0.08, 0.15]); legKnees = pair(s => [s * .15, .52, .35]); grips[0].visible = false }
      if (inverted) {
        const hipY = 0.334 + 0.266 * t
        hip = [0, hipY, 0.80 - Math.sqrt(0.911 ** 2 - (hipY - 0.078) ** 2)]
        lean = -Math.acos((hipY - 0.078) / 0.911)
        hands = pair(s => [s * 0.32, 1.10, -0.55])
        legFeet = pair(s => [s * 0.16, 0.078, 0.80])
        legKnees = pair(s => [s * 0.16, (hipY + 0.078) / 2, 0.44])
      }
      const lever = rowMachine?.(t)
      if (lever) hands = lever.targets
      const result = body.pose(hip, lean, legKnees, legFeet, hands,
        pair(s => [s * (band || single ? 0.35 : 0.65), single ? 0.96 : band ? 0.47 : supported ? 1.14 : seated ? 0.83 : 1.2, -0.23]), { footRotations, grip: true, gripAxes: lever?.axes ?? (inverted ? pronated : single ? pair(() => [0, 0, 1]) : neutral), gripDirections: lever?.directions ?? (inverted ? pair(() => [0, 1, 0]) : door ? pair(() => [0, 0, 1]) : undefined), flatHandSides: single ? [false, true] : undefined, gripTargets: inverted || door || supported })
      grips.forEach((grip, i) => {
        grip.position.copy(result.hands[i])
        grip.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), gripAxis(i))
      })
      if (load) {
        load.position.copy(result.hands[0])
        load.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), gripAxis(0))
      }
      const middle = result.hands[0].clone().add(result.hands[1]).multiplyScalar(0.5)
      if (connectors[0]) {
        const anchor: Point = band ? [0, .14, .88] : [0, .62, 1.0]
        connectors.forEach((line, i) => placeBetween(line, anchor, rowGrips ? rowGrips[i](result.hands[i], anchor, gripAxis(i)) : middle))
      }
    }, { target: [0, inverted ? 0.63 : supported || single ? 0.86 : 0.99, 0.03], height: inverted ? 1.8 : 2.1, camera: single ? [-3.0, 1.9, 3.7] : door ? [4.0, 1.7, 0.8] : supported ? [2.8, 1.85, -3.2] : [3.0, 1.9, 3.7] })
  }

  if (['cable-pullover', 'band-straight-arm-pulldown', 'face-pull'].includes(id)) {
    const face = id === 'face-pull'
    if (id === 'band-straight-arm-pulldown') { eq.bar([0, 0.03, 1.05], [0, 2.15, 1.05]); eq.bar([-0.25, 0.03, 1.05], [0.25, 0.03, 1.05]) }
    else eq.tower([0, 0, 1.05], 2.15)
    const grips = SIDES.map(() => eq.cableHandle())
    const anchor: Point = [0, face ? 1.55 : 2.12, 1.05]
    const ropes = SIDES.map(() => eq.cable(anchor, [0, 1.4, 0.5]))
    return motion(t => {
      const angle = 0.65 - 1.85 * t
      const origins = shoulders([0, 0.983, 0], 0.10)
      const targets = face ? pair(s => [s * (0.12 + 0.21 * t), 1.40 + 0.08 * t, 0.54 - 0.44 * t]) : origins.map((shoulder): Point => [shoulder[0], shoulder[1] + 0.54 * Math.sin(angle), shoulder[2] + 0.54 * Math.cos(angle)])
      const poles = face ? pair(s => [s * .7, 1.50, -.1]) : origins.map((origin, i) => arcPole(origin, [SIDES[i] * .22, 1.32, .36], [1, 0, 0], .65 - angle))
      const result = stand(targets, poles, true, face ? neutral : pronated, face ? 0 : 0.10)
      ropes.forEach((rope, i) => placeBetween(rope, anchor, grips[i](result.hands[i], anchor, gripAxis(i))))
    }, { target: [0, 1.02, 0.2], height: 2.4 })
  }

  if (['lateral-raise', 'cable-lateral-raise', 'band-lateral-raise', 'db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise'].includes(id)) {
    const cable = id === 'cable-lateral-raise', band = id.startsWith('band-'), rear = id === 'db-rear-delt-fly', apart = id === 'band-pull-apart', prone = id === 'prone-y-raise'
    const dumbbells = !cable && !band && !prone ? SIDES.map(() => eq.dumbbell()) : []
    const handles = cable || band ? SIDES.map(() => eq.handle()) : []
    const lateralGrip = cable ? eq.cableHandle(.14, true) : null
    if (cable) eq.tower([-.70, 0, .55], 1.8)
    if (prone) eq.block([0, 0.012, 0.1], [0.85, 0.025, 1.85], 0, eq.rubber)
    const connectors = apart ? [eq.cable([-0.15, 1.4, 0.4], [0.15, 1.4, 0.4])] : cable || band ? SIDES.map(s => eq.cable([s * 0.20, 0.04, 0], [s * 0.3, 1.0, 0])) : []
    return motion(t => {
      let hip: Point = [0, prone ? 0.17 : rear ? 0.97 : 0.983, 0]
      let lean = rear ? 0.90 : prone ? Math.PI / 2 : 0
      const origins = shoulders(hip, lean)
      const angle = 0.08 + 1.40 * t
      let targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * (cable ? .52412 : .54) * Math.sin(angle), origin[1] - (cable ? .52412 : .54) * Math.cos(angle), origin[2]])
      if (apart) { const arc = -0.17 + 1.57 * t; targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.sin(arc), origin[1], origin[2] + 0.54 * Math.cos(arc)]) }
      if (rear) targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * (cable ? .52412 : .54) * Math.sin(angle), origin[1] - (cable ? .52412 : .54) * Math.cos(angle), origin[2]])
      if (prone) { const lift = -0.12 + 0.52 * t; targets = origins.map((origin, i): Point => [origin[0] + SIDES[i] * 0.54 * Math.cos(lift) * 0.60, origin[1] + 0.54 * Math.sin(lift), origin[2] + 0.54 * Math.cos(lift) * 0.80]) }
      if (cable) { targets[0] = [-.25, .98, .09]; targets[1][2] += .13 }
      const poles = pair(s => [s * .65, rear ? 1.09 : prone ? .45 : 1.18, rear || prone ? .4 : -.05])
      if (!cable && !apart && !prone) poles.forEach((pole, i) => { poles[i] = arcPole(origins[i], pole, [0, 0, 1], SIDES[i] * (angle - .08)) })
      const result = body.pose(hip, lean,
        prone ? pair(s => [s * 0.15, 0.12, -0.43]) : knees,
        prone ? pair(s => [s * 0.15, 0.20, -0.87]) : feet,
        targets, poles,
        { footRotations: prone ? pair(() => [Math.PI / 2, 0, 0]) : footRotations, grip: !prone, openHands: prone, gripAxes: dumbbells.length || cable || (band && !apart) ? pair(() => [0,0,1]) : neutral, gripTargets: cable, gripDirections: cable ? targets.map((target, i) => new Vector3(...target).sub(new Vector3(...origins[i])).normalize().toArray() as Point) : undefined })
      attach(dumbbells, result.hands)
      handles.forEach((handle, i) => {
        handle.position.copy(result.hands[i]); handle.visible = !cable
        handle.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), gripAxis(i))
      })
      if (apart) placeBetween(connectors[0], result.hands[0], result.hands[1])
      else connectors.forEach((line, i) => {
        line.visible = !cable || i === 1
        const anchor: Point = cable ? [-.70, .10, .55] : [SIDES[i] * .2, .008, .015]
        placeBetween(line, anchor, lateralGrip ? lateralGrip(result.hands[i], anchor, gripAxis(i)) : result.hands[i])
      })
    }, { camera: prone ? [2.2, 3.7, 1.6] : rear ? [2.7, 2.0, -3.4] : [2.3, 1.6, 4.1], target: [0, prone ? 0.20 : 0.98, prone ? 0.07 : 0], height: prone ? 1.9 : 2.1 })
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
