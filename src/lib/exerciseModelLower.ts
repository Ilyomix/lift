import { Vector3 } from 'three'
import { placeBetween } from './exerciseModelEquipment'
import type { Point } from './exerciseModelRig'
import type { ExerciseContext, ExerciseMotion } from './exerciseModelTypes'

export const LOWER_EXERCISES = new Set([
  'leg-press', 'hack-squat', 'smith-squat', 'barbell-squat', 'leg-extension', 'leg-curl', 'lying-leg-curl',
  'romanian-deadlift', 'hip-thrust', 'smith-hip-thrust', 'glute-bridge', 'back-extension-45', 'calf-press', 'standing-calf-raise',
  'seated-calf-raise', 'goblet-squat', 'hip-adduction', 'hip-abduction', 'bulgarian-split-squat',
  'sissy-squat', 'sliding-leg-curl', 'nordic-curl', 'db-romanian-deadlift', 'single-leg-rdl',
  'db-hip-thrust', 'single-leg-hip-thrust', 'single-leg-calf-raise',
  'roman-chair-abs', 'cable-crunch', 'hanging-leg-raise', 'reverse-crunch', 'crunch',
])
const SIDES = [-1, 1] as const
const PI = Math.PI
const clamp = (t: number) => Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0))
const smooth = (t: number) => { const q = clamp(t); return q * q * (3 - 2 * q) }
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const rotate = (point: Point, angle: number): Point => [point[0], point[1] * Math.cos(angle) - point[2] * Math.sin(angle), point[1] * Math.sin(angle) + point[2] * Math.cos(angle)]
const torso = (hips: Point, lean: number, point: Point): Point => add(hips, rotate(point, lean))
const average = (points: Vector3[]) => points.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / points.length)

/** Dedicated lower/core contact models. Coordinates are authored for 1.82 m and scaled to the real rig. */
export function createLowerExercise(id: string, context: ExerciseContext): ExerciseMotion | null {
  const motion = buildLowerExercise(id, context)
  if (motion) context.body.calibrateTwistFromPose(() => motion.update(0))
  return motion
}

function buildLowerExercise(id: string, { body, equipment: eq }: ExerciseContext): ExerciseMotion | null {
  if (!LOWER_EXERCISES.has(id)) return null
  const scale = body.measures.height / 1.82
  const upper = body.measures.legs[0][0] / scale
  const lower = body.measures.legs[0][1] / scale
  const halfHip = body.measures.hipWidth / scale / 2
  const standing = 0.08 + upper + lower
  const palms = [body.manifest.bones.right, body.manifest.bones.left].map(side => ({
    wrist: body.root.getObjectByName(side.hand)!,
    middle: body.root.getObjectByName(side.palmLandmarks!.middle)!,
    index: body.root.getObjectByName(side.palmLandmarks!.index)!,
    pinky: body.root.getObjectByName(side.palmLandmarks!.pinky)!,
  }))
  const gripAxis = (index: number) => {
    const palm = palms[index]
    const along = palm.middle.getWorldPosition(new Vector3()).sub(palm.wrist.getWorldPosition(new Vector3())).normalize()
    const across = palm.index.getWorldPosition(new Vector3()).sub(palm.pinky.getWorldPosition(new Vector3()))
    return across.addScaledVector(along, -across.dot(along)).normalize()
  }
  const p = (point: Point): Point => point.map(value => value * scale) as Point
  const pair = (fn: (side: number, index: number) => Point) => SIDES.map(fn)
  const block = (at: Point, size: Point, angle = 0, material = eq.pad) => eq.block(p(at), p(size), angle, material)
  const bar = (a: Point, b: Point, radius = 0.025) => eq.bar(p(a), p(b), radius * scale)
  const cable = (a: Point, b: Point) => eq.cable(p(a), p(b))
  const groundFeet = pair(side => [side * 0.18, 0.078, 0.015])
  const straightFeet: Point[] = [[0, 0, 0], [0, 0, 0]]
  const defaultPoles = (hips: Point) => pair(side => [side * 0.65, hips[1] + 0.18, hips[2] - 0.08])
  const pose = (hips: Point, lean: number, knees: Point[], feet: Point[], hands: Point[], poles = defaultPoles(hips), options: Parameters<typeof body.pose>[6] = {}) =>
    body.pose(p(hips), lean, knees.map(p), feet.map(p), hands.map(p), poles.map(p), options)
  const motion = (update: (t: number) => void, camera: Point = [2.8, 1.85, 3.6], target: Point = [0, 0.88, 0], height = 2.18): ExerciseMotion => ({
    update: phase => update(clamp(phase)), camera: p(camera), target: p(target), height: height * scale,
  })
  const seat = (height = 0.56, z = 0) => {
    block([0, height, z], [0.40, 0.08, 0.42])
    bar([0, 0.06, z], [0, height - 0.04, z], 0.04)
    bar([-0.36, 0.04, z], [0.36, 0.04, z], 0.035)
  }
  const mat = (z = 0, length = 1.8) => block([0, 0.018, z], [0.62, 0.036, length])
  const ankleFromToe = (toe: Point, angle: number): Point => {
    const offset = rotate([0, -0.067, 0.132], angle)
    return [toe[0] - offset[0], toe[1] - offset[1], toe[2] - offset[2]]
  }
  const sagittalKneePole = (hips: Point, foot: Point, side: number): Point => {
    const y = foot[1] - hips[1], z = foot[2] - hips[2]
    const length = Math.hypot(y, z)
    // A point on the nominal knee arc can cross the hip–ankle line and flip
    // IK. Keep the pole well outside that line on the knee's flexion side.
    return [(side * halfHip + foot[0]) / 2,
      (hips[1] + foot[1]) / 2 + .40 * z / length,
      (hips[2] + foot[2]) / 2 - .40 * y / length]
  }

  if (id === 'goblet-squat' || id === 'smith-squat' || id === 'barbell-squat' || id === 'hack-squat' || id === 'bulgarian-split-squat' || id === 'sissy-squat') {
    const dumbbell = id === 'goblet-squat' ? eq.dumbbell() : null
    const gobletTilt = .35
    const gobletAxis = new Vector3(0, Math.cos(gobletTilt), -Math.sin(gobletTilt))
    if (dumbbell) {
      dumbbell.scale.setScalar(scale)
      dumbbell.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), gobletAxis)
    }
    // The free back squat follows the Smith path: the bar stays over mid-foot, on the traps.
    const smithBar = id === 'smith-squat' || id === 'barbell-squat' ? eq.barbell() : null
    smithBar?.scale.setScalar(scale)
    const backPad = id === 'hack-squat' ? block([0, 0.9, 0], [0.38, 0.60, 0.09], -0.67) : null
    const shoulderPads = id === 'hack-squat' ? pair(side => [side * 0.22, 1.3, 0] as Point).map(at => block(at, [0.14, 0.10, 0.28])) : []
    // Sled handles beside the pads: a bracket from the back pad, then a
    // forward grip held palms-in, rather than open hands in the air.
    const sledHandles = id === 'hack-squat' ? SIDES.map(() => [bar([0, 0, 0], [0, 0, 1], 0.02), bar([0, 0, 0], [0, 0, 1], 0.018)]) : []
    if (id === 'smith-squat') {
      for (const side of SIDES) { bar([side * 0.62, 0.04, -0.085], [side * 0.62, 1.85, -0.085]); bar([side * 0.62, 0.04, -0.40], [side * 0.62, 0.04, 0.5], 0.035) }
      bar([-0.62, 1.85, -0.085], [0.62, 1.85, -0.085])
    }
    if (id === 'hack-squat') {
      for (const side of SIDES) bar([side * 0.42, 0.18, 0.47], [side * 0.42, 1.70, -0.74], 0.035)
      block([0, 0.009, 0.30], [0.62, 0.018, 0.58], 0, eq.rubber).name = 'HackFootplate'
    }
    if (id === 'bulgarian-split-squat') eq.bench(p([0.16, 0.43, -0.72]), 0, 0.55 * scale)
    if (id === 'sissy-squat') { bar([-0.45, 0.03, 0.25], [-0.45, 1.4, 0.25], 0.032); bar([-0.62, 0.03, 0.25], [-0.25, 0.03, 0.25]) }
    return motion(t => {
      let hips: Point = [0, standing - 0.44 * t, -0.21 * t]
      let lean = 0.10 + 0.27 * t
      let feet = groundFeet
      let knees = pair(side => [side * 0.2, 0.43, 0.5])
      let hands = pair(side => torso(hips, lean, [side * 0.095, 0.39, 0.15]))
      let footRotations = straightFeet
      if (smithBar) {
        lean = 0.05 + 0.18 * t
        // Measured on the skin: the rail-bound bar rests on the traps (0–3 mm).
        hips = [0, standing - 0.04 - 0.40 * t, -0.47 * Math.sin(lean) + 0.021 + 0.008 * t]
        feet = pair(side => [side * 0.19, 0.078, 0.22])
        // Free bar: hands just outside the shoulders; the Smith grip is wider.
        hands = pair(side => [side * (id === 'barbell-squat' ? 0.38 : 0.43), hips[1] + 0.46 * Math.cos(lean), -0.085])
      } else if (id === 'hack-squat') {
        hips = [0, standing - 0.11 - 0.30 * t, -0.10 + 0.24 * t]; lean = -0.67
        feet = pair(side => [side * 0.18, 0.10, 0.38])
        hands = pair(side => torso(hips, lean, [side * 0.30, 0.38, 0.06]))
        backPad!.position.set(...p(torso(hips, lean, [0, 0.26, -0.15])))
        shoulderPads.forEach((pad, index) => pad.position.set(...p(torso(hips, lean, [SIDES[index] * 0.22, 0.49, -0.03]))).add(new Vector3(0, 0.122 * scale, 0)))
        sledHandles.forEach(([bracket, handle], index) => {
          const side = SIDES[index]
          placeBetween(bracket, p(torso(hips, lean, [side * 0.18, 0.38, -0.10])), p(torso(hips, lean, [side * 0.30, 0.38, -0.10])))
          placeBetween(handle, p(torso(hips, lean, [side * 0.30, 0.38, -0.10])), p(torso(hips, lean, [side * 0.30, 0.38, 0.16])))
        })
      } else if (id === 'bulgarian-split-squat') {
        hips = [0, 0.90 - 0.26 * t, 0.03]; lean = 0.15 + 0.18 * t
        feet = [[-0.14, 0.078, 0.34], [0.14, 0.58, -0.67]]
        knees = [[-0.14, 0.42, 0.58], [0.14, 0.40, -0.2]]
        hands = pair(side => torso(hips, lean, [side * 0.31, 0.05, 0.02]))
        footRotations = [[0, 0, 0], [1.2, 0, 0]]
      } else if (id === 'sissy-squat') {
        const footAngle = 0.10 + 0.40 * t
        feet = pair(side => ankleFromToe([side * 0.14, 0.04, 0.16], footAngle))
        const a = 0.03 + t * 1.0, b = t * 0.65
        knees = feet.map(foot => add(foot, [0, lower * Math.cos(a), lower * Math.sin(a)]))
        hips = [0, knees[0][1] + upper * Math.cos(b), knees[0][2] - upper * Math.sin(b)]
        lean = -b
        hands = [[-0.45, 1.12, 0.25], torso(hips, lean, [0.30, 0.10, 0.10])]
        footRotations = [[footAngle, 0, 0], [footAngle, 0, 0]]
      }
      const loadCenter = torso(hips, lean, [0, .33, .36])
      if (dumbbell) {
        // Separate palms support the underside of the upper head. The palm
        // skin sits 28 mm above its skeletal centre; neither hand holds the
        // narrow shaft, and the lower head stays in front of the chest.
        hands = pair(side => [side * .065, loadCenter[1] + (.076 - .028) * gobletAxis.y, loadCenter[2] + (.076 - .028) * gobletAxis.z])
      }
      const hack = sledHandles.length > 0
      const result = pose(hips, lean, knees, feet, hands,
        dumbbell ? pair(side => [side * .35, hips[1] + .20, hips[2] + .08]) : hack ? pair(side => torso(hips, lean, [side * 0.42, 0.08, 0.14]))
          // Bar on the back: elbows down and behind it. A side pole folded them forward.
          : smithBar ? pair(side => torso(hips, lean, [side * 0.60, 0.05, -0.40])) : undefined,
        { footRotations, grip: !!smithBar || hack || id === 'sissy-squat', openHands: !!dumbbell, gripTargets: !!dumbbell || !!smithBar || hack || id === 'sissy-squat',
          gripAxes: dumbbell ? [[-1, 0, 0], [1, 0, 0]] : smithBar ? [[1, 0, 0], [-1, 0, 0]] : hack ? pair(() => rotate([0, 0, 1], lean)) : undefined,
          // Palms forward, fingers up over the bar, wrists under it.
          gripDirections: dumbbell ? pair(() => [0, Math.sin(gobletTilt), Math.cos(gobletTilt)]) : smithBar ? pair(() => rotate([0, 1, 0], lean)) : undefined })
      if (dumbbell) dumbbell.position.set(...p(loadCenter))
      if (smithBar) smithBar.position.copy(average(result.hands))
    }, id === 'hack-squat' ? [2.8, 1.7, 3.6] : [2.8, 1.85, 3.6], [0, 0.87, -0.05], id === 'hack-squat' ? 2.35 : 2.18)
  }

  if (id === 'leg-extension' || id === 'leg-curl' || id === 'hip-adduction' || id === 'hip-abduction') {
    const kneeMachine = id === 'leg-extension' || id === 'leg-curl'
    seat(kneeMachine ? 0.514 : 0.50)
    block([0, 0.88, -0.175], [0.35, 0.58, 0.08], -0.05)
    const hips: Point = [0, 0.65, -0.025]
    const lean = id === 'hip-abduction' ? 0.15 : -0.04
    // Seat-height handles leave room for the palm below the wrist. Both
    // thumbs face forward; reversing one grip twists that wrist and elbow.
    const handleY = 0.52
    const handleZ = 0
    const hands = pair(side => [side * 0.30, handleY, handleZ])
    const seatedPoles = pair(side => [side * 0.34, 0.90, handleZ])
    SIDES.forEach(side => {
      bar([side * 0.18, 0.50, handleZ - 0.085], [side * 0.30, handleY, handleZ - 0.085], 0.014).name = 'SeatedHandleMount'
      bar([side * 0.30, handleY, handleZ - 0.085], [side * 0.30, handleY, handleZ + 0.09], 0.018).name = 'SeatedHandle'
    })
    const options = {
      grip: true, gripTargets: true,
      gripAxes: pair(() => [0, 0, 1]),
      gripDirections: pair(() => [0, -1, 0]),
    }
    if (kneeMachine) {
      // Calibrate the real knee centres once. A machine pivot cannot drift
      // because its animated ankle target was authored from an approximate hip.
      const initialAngle = id === 'leg-extension' ? 0.05 : 1.32
      const seedKnees = pair(side => [side * halfHip, 0.625, 0.405])
      const seedFeet = seedKnees.map(knee => add(knee, [0, -lower * Math.cos(initialAngle), lower * Math.sin(initialAngle)]))
      const fixedKnees = pose(hips, lean, seedKnees, seedFeet, hands, seatedPoles, options).knees.map(knee => knee.clone().multiplyScalar(1 / scale).toArray() as Point)
      const rollers = SIDES.map(() => eq.bar(p([-0.08, 0, 0]), p([0.08, 0, 0]), 0.055 * scale, eq.pad))
      const levers = SIDES.map(() => bar([0, 0, 0], [0, 0, 1]))
      const shafts = SIDES.map(() => bar([0, 0, 0], [1, 0, 0], 0.016))
      fixedKnees.forEach((knee, i) => {
        const x = SIDES[i] * 0.32
        bar([x, 0.12, 0.02], [x, knee[1], knee[2]], 0.03).name = 'KneeMachineFrame'
        bar([x, knee[1], knee[2]], [SIDES[i] * 0.23, knee[1], knee[2]], 0.022).name = 'KneePivotAxle'
      })
      if (id === 'leg-curl') block([0, 0.798, 0.30], [0.44, 0.075, 0.14]).name = 'CurlThighRestraint'
      return motion(t => {
        const angle = id === 'leg-extension' ? 0.05 + t * 1.30 : 1.32 - t * 1.60
        const direction = new Vector3(0, -Math.cos(angle), Math.sin(angle))
        const normal = new Vector3(0, Math.sin(angle), Math.cos(angle)).multiplyScalar(id === 'leg-extension' ? 1 : -1)
        const feet = fixedKnees.map(knee => new Vector3(...knee).addScaledVector(direction, lower).toArray() as Point)
        pose(hips, lean, fixedKnees, feet, hands, seatedPoles, { ...options, footRotations: [[-angle, 0, 0], [-angle, 0, 0]] })
        fixedKnees.forEach((knee, i) => {
          // Foam contacts the distal shin; the metal arm runs outside the leg.
          // Both offsets rotate with the shin, preserving a rigid lever length.
          const center = new Vector3(...knee).addScaledVector(direction, lower - 0.075)
            .addScaledVector(normal, id === 'leg-extension' ? 0.092 : 0.102)
          const outboard = center.clone(); outboard.x = SIDES[i] * 0.32
          const pivot = new Vector3(SIDES[i] * 0.32, knee[1], knee[2])
          placeBetween(rollers[i], center.clone().add(new Vector3(-0.08, 0, 0)).multiplyScalar(scale), center.clone().add(new Vector3(0.08, 0, 0)).multiplyScalar(scale))
          placeBetween(levers[i], pivot.multiplyScalar(scale), outboard.clone().multiplyScalar(scale))
          placeBetween(shafts[i], center.clone().multiplyScalar(scale), outboard.multiplyScalar(scale))
          rollers[i].name = 'ShinRoller'; levers[i].name = 'KneeMachineLever'; shafts[i].name = 'ShinRollerAxle'
        })
      }, [2.6, 1.65, 3.5], [0, 0.79, 0.12], 1.92)
    }
    const pads = SIDES.map(() => block([0, 0, 0], [0.06, 0.16, 0.18]))
    const levers = SIDES.map(() => bar([0, 0, 0], [0, 0, 1]))
    const links = SIDES.map(() => bar([0, 0, 0], [0, 1, 0], 0.018))
    const footLinks = SIDES.map(() => bar([0, 0, 0], [0, 1, 0], 0.018))
    const supports = SIDES.map(() => block([0, 0, 0], [0.20, 0.035, 0.25], 0, eq.rubber))
    return motion(t => {
      const opening = id === 'hip-abduction' ? 0.08 + 0.66 * t : 0.74 - 0.66 * t
      const knees = pair(side => [side * (halfHip + upper * Math.sin(opening)), 0.62, upper * Math.cos(opening) - 0.025])
      const feet = knees.map(knee => add(knee, [0, -lower, 0.035]))
      const result = pose(hips, lean, knees, feet, hands, seatedPoles, { ...options, footRotations: pair(side => [0, side * opening, 0]) })
      pads.forEach((pad, i) => {
        const side = SIDES[i]
        const normal = new Vector3(side * Math.cos(opening), 0, -Math.sin(opening))
        const thigh = new Vector3(side * Math.sin(opening), 0, Math.cos(opening))
        const center = new Vector3(side * halfHip, 0.62, -0.025).addScaledVector(thigh, upper - 0.065)
          .addScaledVector(normal, id === 'hip-abduction' ? 0.105 : -0.105)
        pad.position.copy(center).multiplyScalar(scale); pad.rotation.y = side * opening; pad.name = 'HipContactPad'
        const armEnd = center.clone(); armEnd.y = 0.39
        placeBetween(levers[i], p([side * halfHip, 0.39, -0.025]), armEnd.clone().multiplyScalar(scale))
        placeBetween(links[i], armEnd.multiplyScalar(scale), center.clone().add(new Vector3(0, -0.08, 0)).multiplyScalar(scale))
        levers[i].name = 'HipMachineLever'; links[i].name = 'HipPadStem'
        supports[i].position.copy(result.feet[i]).addScaledVector(thigh, 0.07 * scale).add(new Vector3(0, -0.095 * scale, 0))
        supports[i].rotation.y = side * opening; supports[i].name = 'HipFootSupport'
        const footAnchor = supports[i].position.clone().addScaledVector(normal, (id === 'hip-abduction' ? 0.115 : -0.115) * scale)
        placeBetween(footLinks[i], new Vector3(center.x, 0.39, center.z).multiplyScalar(scale), footAnchor)
        footLinks[i].name = 'HipFootSupportLink'
      })
    }, [2.6, 1.65, 3.5], [0, 0.79, 0.12], 1.92)
  }

  if (id === 'lying-leg-curl') {
    eq.bench(p([0, 0.56, 0.20]), 0, 1.35 * scale)
    // Upright grips let the forearms reach forward without twisting the palms
    // around a shaft that points through the fingers toward the wrist.
    SIDES.forEach(side => {
      bar([side * 0.16, 0.565, 0.73], [side * 0.26, 0.565, 0.73], 0.016).name = 'ProneHandleMount'
      bar([side * 0.26, 0.565, 0.73], [side * 0.26, 0.735, 0.73], 0.018).name = 'ProneHandle'
    })
    const hands = pair(side => [side * 0.26, 0.65, 0.73])
    const poles: Point[] = [[-0.50, 0.58, 0.43], [0.50, 0.58, 0.43]]
    const options = { grip: true, gripTargets: true, gripAxes: pair(() => [0, 1, 0]) }
    const seedKnees = pair(side => [side * halfHip, 0.735, -upper])
    const seedFeet = seedKnees.map(knee => add(knee, [0, lower * Math.sin(0.1), -lower * Math.cos(0.1)]))
    const knees = pose([0, 0.75, 0], PI / 2, seedKnees, seedFeet, hands, poles, options).knees.map(knee => knee.clone().multiplyScalar(1 / scale).toArray() as Point)
    const roller = eq.bar(p([-0.26, 0.70, -0.85]), p([0.26, 0.70, -0.85]), 0.06 * scale, eq.pad)
    roller.name = 'ProneCurlRoller'
    const lever = bar([0.32, 0.7, -0.45], [0.32, 0.7, -0.85])
    lever.name = 'ProneCurlLever'
    const axle = bar([-0.27, 0.7, -0.85], [0.32, 0.7, -0.85], 0.016)
    axle.name = 'ProneCurlAxle'
    bar([0.32, 0.06, knees[1][2]], [0.32, knees[1][1], knees[1][2]], 0.03).name = 'ProneCurlFrame'
    return motion(t => {
      const angle = 0.10 + t * 1.65
      const feet = knees.map(knee => add(knee, [0, lower * Math.sin(angle), -lower * Math.cos(angle)]))
      pose([0, 0.75, 0], PI / 2, knees, feet, hands, poles,
        { ...options, footRotations: [[PI / 2 + angle, 0, 0], [PI / 2 + angle, 0, 0]] })
      const center = new Vector3(0, knees[0][1], knees[0][2])
        .addScaledVector(new Vector3(0, Math.sin(angle), -Math.cos(angle)), lower - 0.075)
        .addScaledVector(new Vector3(0, Math.cos(angle), Math.sin(angle)), 0.11).multiplyScalar(scale)
      placeBetween(roller, center.clone().add(new Vector3(-0.27 * scale, 0, 0)), center.clone().add(new Vector3(0.27 * scale, 0, 0)))
      placeBetween(lever, p([0.32, knees[1][1], knees[1][2]]), center.clone().add(new Vector3(0.32 * scale, 0, 0)))
      placeBetween(axle, center.clone().add(new Vector3(-0.27 * scale, 0, 0)), center.clone().add(new Vector3(0.32 * scale, 0, 0)))
    }, [2.8, 2.1, 2.7], [0, 0.66, 0], 1.78)
  }

  if (id === 'leg-press' || id === 'calf-press') {
    const hips: Point = [0, 0.48, -0.36]
    block([0, 0.32, -0.44], [0.43, 0.08, 0.27]).name = 'PressSeat'
    block(torso(hips, -0.65, [0, 0.27, -0.146]), [0.37, 0.62, 0.085], -0.65).name = 'PressBackPad'
    // Rails and the sled share the same 45-degree travel line. The frame is
    // outboard of the legs; a rear crossmember carries the foot platform.
    const plateAngle = -3 * PI / 4
    const plateOffset = rotate(id === 'calf-press' ? [0, -0.046, 0.15] : [0, -0.114, 0.08], plateAngle)
    const railDifference = hips[1] - hips[2] + plateOffset[1] - plateOffset[2]
    for (const side of SIDES) {
      bar([side * 0.47, 0.10, 0.10 - railDifference], [side * 0.47, 1.70, 1.70 - railDifference], 0.028).name = 'PressRail'
      bar([side * 0.28, 0.46, -0.5], [side * 0.28, 0.46, -0.22])
      bar([side * 0.47, 0.04, -0.96], [side * 0.47, 0.04, 0.82], 0.035).name = 'PressBase'
      bar([side * 0.47, 0.04, 0.10 - railDifference], [side * 0.47, 0.10, 0.10 - railDifference], 0.035).name = 'PressRailSupport'
      bar([side * 0.47, 0.04, 1.70 - railDifference], [side * 0.47, 1.70, 1.70 - railDifference], 0.035).name = 'PressFrontSupport'
    }
    for (const z of [-0.92, -0.44, 0.78]) bar([-0.47, 0.04, z], [0.47, 0.04, z], 0.035).name = 'PressBaseCrossmember'
    bar([0, 0.04, -0.44], [0, 0.28, -0.44], 0.035).name = 'PressSeatSupport'
    bar([0, 0.25, -0.44], torso(hips, -0.65, [0, 0.27, -0.21]), 0.03).name = 'PressBackSupport'
    const platform = block([0, 1.0, 0.25], [0.65, 0.075, 0.48], plateAngle, eq.rubber)
    platform.name = 'PressFootplate'
    const carriage = bar([-0.47, 1, 0.25], [0.47, 1, 0.25], 0.025)
    carriage.name = 'PressCarriage'
    const shoes = SIDES.map(side => {
      const shoe = block([side * 0.47, 1, 0.25], [0.085, 0.18, 0.09], PI / 4, eq.metal)
      shoe.name = 'PressRailShoe'
      return shoe
    })
    return motion(t => {
      const distance = id === 'leg-press' ? 0.875 - 0.325 * t : 0.945 + 0.046 * t
      const center: Point = [0, hips[1] + distance * 0.707, hips[2] + distance * 0.707]
      const footAngle = id === 'calf-press' ? plateAngle + 0.36 * t : plateAngle
      const feet = id === 'calf-press'
        ? pair(side => ankleFromToe([side * 0.17, center[1], center[2]], footAngle))
        : pair(side => [side * 0.17, center[1], center[2]])
      // Knees bend toward the torso, above/behind the hip-to-ankle axis.
      // A low forward pole picks the opposite IK branch (backward knees).
      pose(hips, -0.65, pair(side => [side * 0.28, 1.15, -0.38]), feet,
        pair(side => [side * 0.28, 0.46, -0.30]), pair(side => [side * 0.34, 0.74, -0.50]), { footRotations: [[footAngle, 0, 0], [footAngle, 0, 0]], grip: true, gripTargets: true, gripAxes: pair(() => [0, 0, 1]) })
      const plateCenter = add(center, id === 'calf-press' ? rotate([0, -0.046 - 0.020 * t, 0.15], plateAngle) : plateOffset)
      platform.position.set(...p(plateCenter))
      const sled = add(plateCenter, rotate([0, -0.055, 0], plateAngle))
      placeBetween(carriage, p(add(sled, [-0.47, 0, 0])), p(add(sled, [0.47, 0, 0])))
      shoes.forEach((shoe, i) => shoe.position.set(...p(add(sled, [SIDES[i] * 0.47, 0, 0]))))
    }, [3.8, 2.0, -2.2], [0, 0.72, -0.05], 2.08)
  }

  if (id === 'romanian-deadlift' || id === 'db-romanian-deadlift' || id === 'single-leg-rdl') {
    const barbell = id === 'romanian-deadlift' ? eq.barbell() : null
    barbell?.scale.setScalar(scale)
    const dumbbells = id === 'db-romanian-deadlift' ? SIDES.map(() => eq.dumbbell()) : []
    dumbbells.forEach(weight => weight.scale.setScalar(scale))
    const freeHipOffset = body.root.getObjectByName(body.manifest.bones.left.thigh)!.getWorldPosition(new Vector3())
      .sub(body.root.getObjectByName(body.manifest.bones.pelvis)!.getWorldPosition(new Vector3())).divideScalar(scale).toArray() as Point
    const freeLegReach = Math.sqrt((upper + lower - .009) ** 2 - (.17 - freeHipOffset[0]) ** 2)
    if (id === 'single-leg-rdl') bar([-0.47, 0.03, 0.24], [-0.47, 1.45, 0.24], 0.03)
    return motion(t => {
      const lean = 0.04 + 1.08 * t
      const hips: Point = [0, standing - 0.12 * t, -0.24 * t]
      const freeHip = torso(hips, lean, freeHipOffset)
      const feet = id === 'single-leg-rdl'
        // Extend from the true hip socket; the former pelvis-based target
        // shortened this leg by 4–6 cm and folded the knee throughout the rep.
        ? [groundFeet[0], [0.17, freeHip[1] - freeLegReach * Math.cos(lean), freeHip[2] - freeLegReach * Math.sin(lean)] as Point]
        : groundFeet
      // Dumbbells hang beside the legs in a neutral grip; across the front,
      // their 78 mm heads sank into the thighs.
      const hands = pair(side => [side * (dumbbells.length ? 0.32 : 0.265), hips[1] + 0.44 * Math.cos(lean) - (dumbbells.length ? 0.494 : 0.51), hips[2] + 0.46 * Math.sin(lean) + 0.055])
      // A shared bar follows the front of the legs, not the wrist centres.
      // Author its palm contacts directly so the grip offset cannot pull the
      // shaft through the thighs when the athlete stands upright.
      if (barbell) hands.forEach(hand => { hand[1] -= .084 + .04 * t + .004 * Math.sin(PI * t); hand[2] = .16 - .04 * t })
      if (id === 'single-leg-rdl') hands[0] = [-0.47, 1.05, 0.24]
      const knees = id === 'single-leg-rdl' ? [[-0.18, 0.50, 0.30], sagittalKneePole(hips, feet[1], 1)] as Point[] : pair(side => [side * 0.18, 0.49, 0.28])
      // Keep the free sole level while it leaves the floor, then point the
      // toes with the raised leg. Both ends of this ankle blend are C2.
      const toeLift = clamp((t - .15) / .40)
      const freeFootAngle = lean * toeLift ** 3 * (10 + toeLift * (-15 + 6 * toeLift))
      const result = pose(hips, lean, knees, feet, hands, pair(side => [side * 0.50, hips[1] + 0.1, hips[2] - 0.1]),
        { footRotations: id === 'single-leg-rdl' ? [[0, 0, 0], [freeFootAngle, 0, 0]] : straightFeet, grip: true, gripTargets: !!barbell || id === 'single-leg-rdl', gripAxes: id === 'single-leg-rdl' ? undefined : dumbbells.length ? [[0, 0, 1], [0, 0, 1]] : [[1, 0, 0], [-1, 0, 0]] })
      if (barbell) barbell.position.copy(average(result.hands))
      dumbbells.forEach((weight, i) => {
        weight.position.copy(result.hands[i])
        weight.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), gripAxis(i))
      })
    }, [2.8, 1.7, 3.7], [0, 0.86, -0.03], 2.13)
  }

  if (id === 'hip-thrust' || id === 'smith-hip-thrust' || id === 'db-hip-thrust' || id === 'single-leg-hip-thrust' || id === 'sliding-leg-curl') {
    const sliding = id === 'sliding-leg-curl'
    if (sliding) mat(0.18, 1.8)
    else {
      // The single-leg variant rests its arms out along a longer bench.
      block([0, 0.45, -0.57], [id === 'single-leg-hip-thrust' ? 1.5 : 1.0, 0.08, 0.40])
      for (const side of SIDES) {
        bar([side * 0.36, 0.04, -0.57], [side * 0.36, 0.41, -0.57], 0.035)
        bar([side * 0.36, 0.04, -0.77], [side * 0.36, 0.04, -0.37], 0.03)
      }
    }
    const barbell = id === 'hip-thrust' || id === 'smith-hip-thrust' ? eq.barbell() : null
    const dumbbell = id === 'db-hip-thrust' ? eq.dumbbell() : null
    if (id === 'smith-hip-thrust') {
      // A compact Smith frame: the bar rides its rails 2 cm either side of its own path over the hips.
      for (const side of SIDES) { bar([side * 0.62, 0.04, -0.021], [side * 0.62, 1.30, -0.021]); bar([side * 0.62, 0.04, -0.30], [side * 0.62, 0.04, 0.45], 0.035) }
      bar([-0.62, 1.30, -0.021], [0.62, 1.30, -0.021])
    }
    barbell?.scale.setScalar(scale); dumbbell?.scale.setScalar(scale)
    const sliders = sliding ? SIDES.map(side => block([side * 0.17, 0.055, 0.7], [0.19, 0.035, 0.24], 0, eq.grip)) : []
    return motion(t => {
      let hips: Point, lean: number, feet: Point[], hands: Point[], knees: Point[]
      if (sliding) {
        hips = [0, 0.34 + 0.045 * t, -0.01 + 0.08 * t]
        lean = Math.atan2(-0.48, 0.16 - hips[1])
        feet = pair(side => [side * 0.17, 0.11, 0.73 - 0.44 * t])
        hands = [[-0.34, 0.11, -0.26], [0.34, 0.11, -0.26]]
        knees = pair(side => [side * 0.17, 0.63, 0.39])
      } else {
        lean = -1.03 - 0.54 * t
        hips = [0, 0.59 - 0.47 * Math.cos(lean), -0.46 - 0.47 * Math.sin(lean)]
        feet = pair(side => [side * 0.17, 0.078, 0.55])
        knees = pair(side => [side * 0.17, 0.57, 0.44])
        // The bar rests on the front of the pelvis, 4 cm above the hip joints,
        // where the measured skin stays within 1 mm of it over the whole rep.
        hands = pair(side => id === 'db-hip-thrust' ? [side * 0.085, hips[1] + 0.105, hips[2]] : torso(hips, lean, [side * 0.26, 0.04, 0.153]))
        if (id === 'single-leg-hip-thrust') {
          feet[1] = [0.16, hips[1] + 0.21, hips[2] + 0.60]
          knees[1] = [0.16, hips[1] + 0.46, hips[2] + 0.18]
          // Arms lie out on the bench, palms flat and relaxed (no pushing):
          // the upper back is the pivot, as coaching references describe.
          hands = pair(side => [side * 0.62, 0.515, -0.66])
        }
      }
      // The head rests on the changing hip surface. Open palms retain each
      // head from above, rather than closing inside its solid rubber disc.
      const loadCenter: Point = [0, hips[1] + .202 + .030 * (1 - t) ** 2, hips[2]]
      const supportTilt = .5
      if (dumbbell) hands = pair(side => [side * .105, loadCenter[1] + (.078 + .025) * Math.cos(supportTilt), loadCenter[2] - (.078 + .025) * Math.sin(supportTilt)])
      const result = pose(hips, lean, knees, feet, hands,
        id === 'single-leg-hip-thrust' ? pair(side => [side * 0.45, 0.58, -0.85]) : [[-0.52, 0.23, -0.32], [0.52, 0.23, -0.32]], { footRotations: straightFeet, grip: !!barbell, openHands: !!dumbbell, gripTargets: !!barbell || !!dumbbell,
          gripAxes: [[1, 0, 0], [-1, 0, 0]], gripDirections: dumbbell ? pair(() => [0, Math.sin(supportTilt), Math.cos(supportTilt)]) : undefined,
          flatHands: sliding || id === 'single-leg-hip-thrust', flatDirections: id === 'single-leg-hip-thrust' ? pair(side => [side * 0.8, 0, -0.6]) : undefined })
      if (barbell) barbell.position.copy(average(result.hands))
      if (dumbbell) dumbbell.position.set(...p(loadCenter))
      sliders.forEach((slider, i) => slider.position.set(...p([feet[i][0], 0.055, feet[i][2]])))
    }, [2.8, 2.1, 3.0], [0, 0.41, 0.04], 1.78)
  }

  if (id === 'glute-bridge') {
    // The hip thrust without a bench: shoulder blades on a mat, the bar over the hips.
    mat(-0.45, 1.2)
    const barbell = eq.barbell()
    barbell.scale.setScalar(scale)
    return motion(t => {
      const lean = -1.63 - 0.57 * t
      // The torso turns about the shoulder blades, 10 cm above the mat as on the bench.
      const hips: Point = [0, 0.135 - 0.47 * Math.cos(lean), -0.45 - 0.47 * Math.sin(lean)]
      const result = pose(hips, lean, pair(side => [side * 0.18, 0.75, 0.36]), pair(side => [side * 0.17, 0.078, 0.42]),
        pair(side => torso(hips, lean, [side * 0.26, 0.04, 0.153])), pair(side => [side * 0.52, 0.06, -0.32]),
        // The neck bends as the shoulders tip back, so the head stays on the mat.
        { neckFlexion: 0.8 * t, footRotations: straightFeet, grip: true, gripTargets: true, gripAxes: [[1, 0, 0], [-1, 0, 0]] })
      barbell.position.copy(average(result.hands))
    }, [3.3, 1.5, 1.7], [0, 0.25, -0.15], 1.5)
  }

  if (id === 'back-extension-45') {
    block([0, 0.603, -0.011], [0.46, 0.14, 0.25], -1.07).name = 'BackExtensionHipPad'
    bar([0, 0.05, 0.15], [0, 0.57, 0.05], 0.04).name = 'BackExtensionPadSupport'
    bar([-0.40, 0.055, -0.64], [0.40, 0.055, -0.64], 0.04)
    bar([0, 0.055, -0.64], [0, 0.055, 0.4], 0.04)
    eq.bar(p([-0.30, 0.27, -0.73]), p([0.30, 0.27, -0.73]), 0.06 * scale, eq.pad).name = 'BackExtensionAnkleRoller'
    block(add([0, 0.19, -0.59], rotate([0, -0.10, 0.08], 0.55)), [0.55, 0.05, 0.25], 0.55, eq.rubber).name = 'BackExtensionFootplate'
    return motion(t => {
      const lean = 1.72 - 0.97 * t
      const hips: Point = [0, 0.92, -0.08]
      // Hands behind the head, elbows out: palms on the head, fingers toward
      // the crown. Hands folded on the chest met and passed through each other.
      const up: Point = [0, Math.cos(lean + 0.06 - 0.35), Math.sin(lean + 0.06 - 0.35)]
      pose(hips, lean, [[-0.14, 0.54, -0.29], [0.14, 0.54, -0.29]], [[-0.17, 0.19, -0.59], [0.17, 0.19, -0.59]],
        pair(side => torso(hips, lean, [side * 0.095, 0.63, 0.02])),
        pair(side => torso(hips, lean, [side * 0.45, 0.62, 0.0])), { pelvisTilt: lean - 0.06, trunkFlexion: 0.06, footRotations: [[0.55, 0, 0], [0.55, 0, 0]],
          openHands: true, gripDirections: pair(() => up), gripAxes: pair(() => [0, up[2], -up[1]]) })
    }, [2.7, 1.8, 3.7], [0, 0.88, 0.05], 2.1)
  }

  if (id === 'nordic-curl') {
    mat(0.16, 1.8)
    block([0, 0.065, -0.08], [0.48, 0.13, 0.42])
    // The roller presses on the heels from above; lower, it went through them.
    bar([-0.36, 0.35, -0.46], [0.36, 0.35, -0.46], 0.065)
    for (const side of SIDES) bar([side * 0.35, 0.03, -0.46], [side * 0.35, 0.37, -0.46], 0.035)
    return motion(t => {
      const lean = 0.08 + 1.27 * t
      const hips: Point = [0, 0.16 + upper * Math.cos(lean), upper * Math.sin(lean)]
      const reach = smooth((t - 0.58) / 0.30)
      const hands = pair(side => {
        const chest = torso(hips, lean, [side * 0.22, 0.37, 0.15])
        return [side * 0.26, chest[1] * (1 - reach) + 0.09 * reach, chest[2] * (1 - reach) + 0.89 * reach]
      })
      pose(hips, lean, [[-halfHip, 0.16, 0], [halfHip, 0.16, 0]], [[-halfHip, 0.21, -lower], [halfHip, 0.21, -lower]], hands,
        [[-0.5, 0.30, 0.57], [0.5, 0.30, 0.57]], { footRotations: [[1.8, 0, 0], [1.8, 0, 0]], flatHands: true })
    }, [2.5, 1.85, 3.5], [0, 0.56, 0.2], 1.91)
  }

  if (id === 'standing-calf-raise' || id === 'single-leg-calf-raise' || id === 'seated-calf-raise') {
    const seated = id === 'seated-calf-raise', single = id === 'single-leg-calf-raise'
    block([0, 0.12, 0.14], [0.54, 0.24, 0.21], 0, eq.rubber)
    if (seated) seat(0.63, -0.30)
    else if (single) bar([-0.47, 0.02, 0.28], [-0.47, 1.65, 0.28], 0.03)
    else {
      for (const side of SIDES) bar([side * 0.50, 0.02, -0.13], [side * 0.50, 1.95, -0.13], 0.035)
    }
    const grips = single ? [] : SIDES.map(() => eq.handle())
    const gripLinks = single ? [] : SIDES.map(side => bar([side * 0.20, 0.8, 0], [side * 0.20, 0.8, 0.1], 0.016))
    const pads = seated ? [block([0, 0.83, 0.01], [0.51, 0.09, 0.18])]
      : single ? [] : SIDES.map(side => block([side * 0.26, 1.63, -0.05], [0.14, 0.11, 0.25]))
    return motion(t => {
      const angle = -0.18 + 0.65 * t
      const feet = pair(side => ankleFromToe([side * 0.16, 0.28, 0.17], angle))
      let hips: Point, knees: Point[], hands: Point[], lean = 0
      if (seated) {
        hips = [0, 0.735, -0.32]
        knees = pair(side => [side * 0.15, feet[0][1] + lower, 0.04])
        hands = pair(side => [side * 0.20, knees[0][1] + 0.10, 0.10])
      } else {
        hips = [0, feet[0][1] + upper + lower - 0.007, feet[0][2] - 0.01]
        knees = pair(side => [side * 0.16, hips[1] - upper, feet[0][2] + 0.03])
        // Handles travel with the shoulder carriage. A fixed world-Z target
        // folded the upper arms upward as the body rose onto the forefoot.
        hands = pair(side => [side * 0.32, hips[1] + 0.29, hips[2] + 0.35])
        if (single) {
          feet[1] = [0.16, feet[0][1] + 0.22, -0.24]
          knees[1] = [0.16, hips[1] - 0.40, 0.05]
          hands = [[-0.47, 1.45, 0.28], [0.28, hips[1] + 0.10, 0.10]]
          lean = 0.035
        }
      }
      const poles = !seated && !single ? pair(side => [side * 0.32, hips[1] + 0.10, hips[2] + 0.15]) : undefined
      const result = pose(hips, lean, knees, feet, hands, poles, { footRotations: [[angle, 0, 0], [single ? 0 : angle, 0, 0]], grip: true, gripTargets: true })
      grips.forEach((grip, i) => {
        grip.position.copy(result.hands[i])
        const axis = gripAxis(i)
        grip.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis)
        // Seated, the lever leaves the outer end of the knee pad, beside the thigh.
        const anchor = seated ? result.knees[i].clone().add(new Vector3(SIDES[i] * 0.095 * scale, 0.055 * scale, -0.04 * scale)) : new Vector3(...p([SIDES[i] * 0.20, hips[1] + 0.59, hips[2] + 0.13]))
        // Join the nearest end of the handle, never its occupied centre.
        const end = result.hands[i].clone().addScaledVector(axis, anchor.clone().sub(result.hands[i]).dot(axis) < 0 ? -.06 : .06)
        placeBetween(gripLinks[i], anchor, end)
      })
      if (seated) pads[0].position.copy(average(result.knees)).add(new Vector3(0, 0.055 * scale, -0.04 * scale))
      else pads.forEach((pad, i) => {
        pad.position.set(...p([SIDES[i] * 0.26, hips[1] + 0.588, hips[2] - 0.035]))
        pad.name = 'CalfShoulderPad'
      })
    }, [2.8, 1.9, 3.8], [0, seated ? 0.81 : 1.0, 0], seated ? 1.85 : 2.5)
  }

  if (id === 'crunch' || id === 'reverse-crunch') {
    mat(0, 1.95)
    return motion(t => {
      const reverse = id === 'reverse-crunch'
      const hips: Point = [0, 0.15 + (reverse ? 0.105 * t : 0), reverse ? -0.035 * t : 0]
      const lean = -PI / 2
      const knees: Point[] = reverse ? pair(side => [side * 0.13, 0.58 + 0.04 * t, 0.11 - 0.14 * t]) : pair(side => [side * 0.16, 0.52, 0.30])
      const feet: Point[] = reverse ? pair(side => [side * 0.13, 0.39 + 0.22 * t, 0.51 - 0.24 * t]) : pair(side => [side * 0.16, 0.078, 0.56])
      const hands = reverse ? [[-0.31, 0.09, -0.27], [0.31, 0.09, -0.27]] as Point[] : pair(side => [side * 0.10, 0.28 + 0.23 * t, -0.59 + 0.045 * t])
      // Crunch fingertips rest at the temples, palms toward the head and
      // fingers along it; the inherited wrist turned the backs of the hands in.
      const up: Point = [0, Math.cos(lean + 0.54 * t), Math.sin(lean + 0.54 * t)]
      pose(hips, lean, knees, feet, hands,
        [[-0.52, 0.14, -0.35], [0.52, 0.14, -0.35]],
        { pelvisTilt: reverse ? lean - 0.27 * t : lean, trunkFlexion: reverse ? 0.12 * t : 0.54 * t, footRotations: straightFeet, flatHands: reverse,
          openHands: !reverse, gripDirections: reverse ? undefined : pair(() => up), gripAxes: reverse ? undefined : pair(() => [0, up[2], -up[1]]) })
    }, [2.8, 2.2, 3.0], [0, 0.27, -0.06], 1.64)
  }

  if (id === 'cable-crunch') {
    mat(0.04, 1.15)
    eq.tower(p([0, 0, 0.98]), 2.10 * scale)
    const ropes = SIDES.map(side => cable([0, 1.98, 0.98], [side * 0.15, 1.1, 0.3]))
    return motion(t => {
      const lean = 0.03 + 0.12 * t
      const hips: Point = [0, 0.56, 0]
      const trunkFlexion = 0.58 * t
      const hands = pair(side => torso(hips, lean + trunkFlexion * 0.72, [side * 0.15, 0.53, 0.11]))
      const result = pose(hips, lean, [[-0.14, 0.11, 0.10], [0.14, 0.11, 0.10]], [[-0.14, 0.21, -0.34], [0.14, 0.21, -0.34]], hands,
        pair(side => torso(hips, lean + trunkFlexion * 0.65, [side * 0.32, 0.25, 0.25])),
        { pelvisTilt: 0.02, trunkFlexion, footRotations: [[1.75, 0, 0], [1.75, 0, 0]], grip: true, gripTargets: true })
      ropes.forEach((rope, i) => placeBetween(rope, p([0, 1.98, 0.98]), result.hands[i]))
    }, [2.8, 1.7, 3.5], [0, 1.0, 0.33], 2.3)
  }

  if (id === 'roman-chair-abs' || id === 'hanging-leg-raise') {
    const hanging = id === 'hanging-leg-raise'
    if (hanging) {
      for (const side of SIDES) bar([side * 0.55, 0.04, -0.08], [side * 0.55, 2.19, -0.08], 0.035)
      bar([-0.62, 2.18, 0], [0.62, 2.18, 0], 0.022)
    } else {
      block([0, 1.42, -0.23], [0.37, 0.36, 0.09]).name = 'RomanChairBackPad'
      for (const side of SIDES) {
        bar([side * 0.38, 0.04, -0.15], [side * 0.38, 1.46, -0.15], 0.032)
        block([side * 0.30, 1.292, 0.13], [0.15, 0.09, 0.40]).name = 'RomanChairForearmPad'
        bar([side * 0.30, 1.38, 0.30], [side * 0.30, 1.55, 0.30], 0.018)
        bar([side * 0.38, 0.04, -0.38], [side * 0.38, 0.04, 0.48], 0.035)
      }
    }
    return motion(t => {
      const hips: Point = [0, hanging ? 1.081 + 0.01 * t : 1.13 + 0.05 * t, -0.02 - 0.05 * t]
      const angle = hanging ? 0.20 + 1.85 * t : 0.12 + 1.39 * t
      const knees = pair(side => [side * halfHip, hips[1] - upper * Math.cos(angle), hips[2] + upper * Math.sin(angle)])
      const feet = knees.map(knee => add(knee, [0, -lower * Math.cos(hanging ? 0.40 + 0.80 * t : 0.20 + 0.45 * t), lower * Math.sin(hanging ? 0.40 + 0.80 * t : 0.20 + 0.45 * t)]))
      const hands: Point[] = hanging ? [[-0.33, 2.18, 0], [0.33, 2.18, 0]] : [[-0.30, 1.47, 0.30], [0.30, 1.47, 0.30]]
      const poles: Point[] = hanging ? [[-0.55, 1.80, -0.04], [0.55, 1.80, -0.04]] : [[-0.30, 1.37, -0.04], [0.30, 1.37, -0.04]]
      const kneePoles = feet.map((foot, i) => sagittalKneePole(hips, foot, SIDES[i]))
      pose(hips, 0, kneePoles, feet, hands, poles, { pelvisTilt: -0.21 * t, trunkFlexion: 0.07 * t, footRotations: [[-0.2, 0, 0], [-0.2, 0, 0]], grip: true, gripTargets: true, gripAxes: hanging ? [[1, 0, 0], [-1, 0, 0]] : undefined, gripDirections: hanging ? [[0, 1, 0], [0, 1, 0]] : undefined })
    }, [2.7, 1.8, 3.7], [0, 1.09, 0.08], hanging ? 2.43 : 2.18)
  }
  return null
}
