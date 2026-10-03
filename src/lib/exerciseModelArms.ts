import { Group, Vector3, type Mesh } from 'three'
import { placeBetween } from './exerciseModelEquipment'
import type { Point } from './exerciseModelRig'
import type { ExerciseContext, ExerciseMotion } from './exerciseModelTypes'

export const ARM_EXERCISES = new Set([
  'triceps-overhead-rope', 'triceps-rope', 'ez-curl', 'preacher-curl',
  'seated-db-curl', 'incline-db-curl', 'db-overhead-extension', 'band-overhead-extension',
  'band-pushdown', 'db-skull-crusher', 'db-curl', 'band-curl',
])
const sides = [-1, 1]
const footRotation: Point[] = [[0, 0, 0], [0, 0, 0]]
const pair = (fn: (side: number, index: number) => Point) => sides.map(fn)

/** Elbows remain on a fixed arc centre; shoulder motion never impersonates a curl. */
export function createArmExercise(id: string, context: ExerciseContext): ExerciseMotion | null {
  const motion = buildArmExercise(id, context)
  if (motion) context.body.calibrateTwistFromPose(() => motion.update(0))
  return motion
}

function buildArmExercise(id: string, { body, equipment: e }: ExerciseContext): ExerciseMotion | null {
  if (!ARM_EXERCISES.has(id)) return null
  const curl = ['ez-curl', 'preacher-curl', 'seated-db-curl', 'incline-db-curl', 'db-curl', 'band-curl'].includes(id)
  const seated = ['preacher-curl', 'seated-db-curl', 'incline-db-curl'].includes(id)
  const incline = id === 'incline-db-curl'
  const preacher = id === 'preacher-curl'
  const dumbbellCurl = ['seated-db-curl', 'incline-db-curl', 'db-curl'].includes(id)
  const skull = id === 'db-skull-crusher'
  const overhead = id.includes('overhead')
  const band = id.startsWith('band-')
  const rope = id === 'triceps-rope' || id === 'triceps-overhead-rope'
  const lean = skull ? -Math.PI / 2 : incline ? -0.55 : overhead ? 0.05 : 0
  const hips: Point = [0, skull ? 0.13 : seated ? 0.695 : band && overhead ? 0.95 : 0.9828, 0]
  const feet = skull
    ? pair(side => [side * 0.17, 0.077, 0.57])
    : pair(side => [side * 0.19, 0.077, seated ? 0.43 : band && overhead ? (side < 0 ? -0.24 : 0.18) : 0.015])
  const knees = skull ? pair(side => [side * 0.17, 0.48, 0.25]) : pair(side => [side * 0.18, 0.49, seated ? 0.43 : 0.04])
  // The exported athlete is 1.82 m; shoulders are measured from its bind pose.
  const shoulders = pair(side => [side * 0.19224,
    hips[1] + 0.47496 * Math.cos(lean) - 0.01389 * Math.sin(lean),
    hips[2] + 0.47496 * Math.sin(lean) + 0.01389 * Math.cos(lean)])
  const elbows = shoulders.map((shoulder, i): Point => {
    const length = body.measures.arms[i][0]
    // A hanging dumbbell needs room outside the thigh and the bench edge.
    // Mild shoulder abduction keeps the full weight clear throughout the curl.
    const x = sides[i] * (dumbbellCurl || preacher ? .30 : id === 'band-curl' ? .26 : !curl && !overhead && !skull ? .25 : skull ? .225 : id === 'db-overhead-extension' ? .16 : .215)
    const span = Math.sqrt(length * length - (x - shoulder[0]) ** 2)
    if (skull) return [x, shoulder[1] + span, shoulder[2]]
    if (overhead) return [x, shoulder[1] + span * Math.cos(0.25), shoulder[2] - span * Math.sin(0.25)]
    if (preacher) return [x, shoulder[1] - span * Math.cos(0.8), shoulder[2] + span * Math.sin(0.8)]
    if (id === 'ez-curl') return [x, shoulder[1] - span * Math.cos(.20), shoulder[2] + span * Math.sin(.20)]
    if (!curl) return [x, shoulder[1] - span * Math.cos(.22), shoulder[2] + span * Math.sin(.22)]
    return [x, shoulder[1] - span, shoulder[2]]
  })

  if (seated) {
    e.block([0, 0.515, 0.03], [0.38, 0.07, 0.36])
    e.bar([0, 0.045, 0.02], [0, 0.48, 0.02], 0.035)
    e.bar([-0.28, 0.04, -0.16], [0.28, 0.04, -0.16], 0.03)
    e.bar([-0.28, 0.04, 0.28], [0.28, 0.04, 0.28], 0.03)
    if (!preacher) {
      const backCenter: Point = [0, hips[1] + 0.25 * Math.cos(lean), (incline ? -0.19 : -0.13) + 0.25 * Math.sin(lean)]
      e.block(backCenter, [0.32, 0.59, 0.07], lean)
      e.bar([0, 0.08, backCenter[2]], [0, backCenter[1], backCenter[2]], 0.026)
    } else {
      // Split pads centred under the elbows leave the armpits/torso clear;
      // pivots and levers sit outside the animated forearms.
      for (const side of sides) {
        e.block([side * .30, 1.012, .032], [.16, .05, .24], .80)
        e.bar([side * .40, .05, .22], [side * .40, .94, .12], .026)
        e.bar([side * .40, .94, .12], [side * .30, .99, .01], .022)
      }
      e.bar([-.43, .035, -.16], [.43, .035, -.16], .03)
      e.block([0, 0.49, 0.58], [0.24, 0.64, 0.18], 0, e.rubber)
    }
  }
  if (skull) e.block([0, -0.011, -0.05], [0.73, 0.022, 2.02], 0, e.rubber)

  const dumbbells = ['seated-db-curl', 'incline-db-curl', 'db-curl', 'db-skull-crusher'].includes(id)
    ? [e.dumbbell(), e.dumbbell()] : []
  const singleDumbbell = id === 'db-overhead-extension' ? e.dumbbell() : undefined
  if (singleDumbbell) singleDumbbell.rotation.z = Math.PI / 2
  const bar = id === 'ez-curl' || preacher ? new Group() : undefined
  if (bar) {
    e.root.add(bar)
    if (id === 'ez-curl') {
      const profile: Point[] = [[-.57, 0, 0], [-.39, 0, 0], [-.27, .035, .035], [-.14, 0, 0], [.14, 0, 0], [.27, .035, .035], [.39, 0, 0], [.57, 0, 0]]
      for (let i = 1; i < profile.length; i++) bar.add(e.bar(profile[i - 1], profile[i], 0.014))
      for (const side of sides) bar.add(e.plate([side * 0.48, 0, 0], 0.11, 0.05))
    } else bar.add(e.bar([-.40, 0, 0], [.40, 0, 0], 0.017, e.grip))
  }
  const pivots: Point[] = preacher ? elbows.map((elbow, i) => [sides[i] * .40, elbow[1], elbow[2]]) : []
  const levers: Mesh[] = pivots.map(pivot => e.bar(pivot, [pivot[0], .7, .45], .022))
  for (const at of pivots) {
    e.bar(at, [at[0], .15, .34], .022)
    const pivot = e.plate(at, .045, .07)
    pivot.material = e.metal
  }

  const handles = band || rope ? [e.handle(), e.handle()] : []
  let anchor: Point | undefined
  const ropes: Mesh[] = []
  const bandShoulders: Mesh[] = []
  const bandBase = (i: number): Point => anchor ?? [sides[i] * .24, .025, overhead ? feet[i][2] + .04 : .03]
  const bandGuide = (i: number): Point => [sides[i] * .29, 1.49, -.15]
  let cable: Mesh | undefined
  if (rope) {
    anchor = overhead ? [0, 0.28, -0.84] : [0, 2.12, 0.81]
    e.tower([0, 0, anchor[2]], overhead ? 1.58 : 2.18)
    cable = e.cable(anchor, [0, 1.2, 0.25])
    ropes.push(e.cable([0, 1.2, 0.25], [-0.15, 1.1, 0.3]), e.cable([0, 1.2, 0.25], [0.15, 1.1, 0.3]))
  } else if (band) {
    if (id === 'band-pushdown') {
      anchor = [0, 2.10, 0.8]
      e.bar([0, 0.025, .83], [0, 2.18, .83], 0.025)
      e.bar([-.18, 2.10, .8], [.18, 2.10, .8], 0.02)
    }
    for (let i = 0; i < 2; i++) {
      const base = bandBase(i)
      ropes.push(e.cable(base, [sides[i] * .18, 1, .12]))
      if (overhead) bandShoulders.push(e.cable(bandGuide(i), [sides[i] * .12, 1.7, 0]))
    }
  }

  return {
    camera: skull ? [2.8, 2.0, 1.7] : incline ? [3.3, 1.55, 3.0] : [2.65, 1.70, 3.8],
    target: skull ? [0, 0.25, -0.12] : [0, overhead || rope || id === 'band-pushdown' ? 1.04 : seated ? 0.81 : 0.91, 0.03],
    height: skull ? 1.72 : overhead || rope || id === 'band-pushdown' ? 2.35 : seated ? 1.85 : 2.04,
    update(t) {
      const targets = elbows.map((elbow, i): Point => {
        const wristX = skull ? sides[i] * .235 : overhead ? sides[i] * (singleDumbbell ? .075 : .18) : curl ? sides[i] * (dumbbellCurl ? .37 : preacher ? .30 : id === 'band-curl' ? .32 : id === 'ez-curl' ? .245 : .22) : sides[i] * (.18 + .13 * t)
        const length = Math.sqrt(Math.max(0.01, body.measures.arms[i][1] ** 2 - (wristX - elbow[0]) ** 2))
        const angle = curl ? (preacher ? .78 + 1.78 * t : id === 'ez-curl' ? .34 + 1.84 * t : .13 + 2.05 * t) : overhead ? -2.30 + 2.10 * t : skull ? -1.42 + 1.42 * t : 1.48 - 1.12 * t
        return [wristX, elbow[1] + (curl || !overhead && !skull ? -1 : 1) * length * Math.cos(angle), elbow[2] + length * Math.sin(angle)]
      })
      const gripAxes: Point[] = curl
        ? pair(side => [side * Math.sin(.18 + 1.39 * t), 0, Math.cos(.18 + 1.39 * t)])
        : singleDumbbell ? pair(side => [side, 0, 0]) : targets.map((target, i): Point => {
          // A neutral grip rotates with elbow flexion. Projecting a fixed
          // vertical axis becomes singular near extension and rolls the hands
          // sideways; the sagittal tangent stays perpendicular and continuous.
          const along = new Vector3(...target).sub(new Vector3(...elbows[i])).normalize()
          return [0, overhead || skull ? -along.z : along.z, overhead || skull ? along.y : -along.y]
        })
      if (bar || id === 'band-curl') for (let i = 0; i < 2; i++) gripAxes[i] = [sides[i], 0, 0]
      // Use the same orthogonal palm frame for the weight and the fingers.
      for (let i = 0; i < 2; i++) {
        const along = new Vector3(...targets[i]).sub(new Vector3(...elbows[i])).normalize()
        const axis = new Vector3(...gripAxes[i])
        axis.addScaledVector(along, -axis.dot(along))
        if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
        gripAxes[i] = axis.normalize().toArray() as Point
      }
      const result = body.pose(hips, lean, knees, feet, targets, elbows, { footRotations: footRotation, grip: true, gripAxes })
      for (let i = 0; i < dumbbells.length; i++) {
        dumbbells[i].position.copy(result.hands[i])
        dumbbells[i].quaternion.setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(...gripAxes[i]).normalize())
      }
      if (singleDumbbell) singleDumbbell.position.copy(result.hands[0]).add(result.hands[1]).multiplyScalar(.5).add(new Vector3(0, -.085, 0))
      if (bar) {
        bar.position.copy(result.hands[0]).add(result.hands[1]).multiplyScalar(.5)
        if (id === 'ez-curl') {
          const gripBend = .035 * Math.min(1, Math.max(0, (Math.abs(result.hands[0].x) - .14) / .13))
          bar.position.add(new Vector3(0, -gripBend, -gripBend))
        }
        if (preacher) for (let i = 0; i < levers.length; i++) placeBetween(levers[i], pivots[i], [pivots[i][0], bar.position.y, bar.position.z])
      }
      for (let i = 0; i < handles.length; i++) {
        handles[i].position.copy(result.hands[i])
        handles[i].quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...gripAxes[i]).normalize())
      }
      if (rope && anchor && cable) {
        const join = result.hands[0].clone().add(result.hands[1]).multiplyScalar(.5)
        join.add(overhead ? new Vector3(0, -.10, -.09) : new Vector3(0, .16, .075))
        placeBetween(cable, anchor, join)
        ropes.forEach((strand, i) => placeBetween(strand, join, result.hands[i]))
      } else if (band) {
        ropes.forEach((strand, i) => {
          const base = bandBase(i)
          if (overhead) {
            const shoulderContact = bandGuide(i)
            placeBetween(strand, base, shoulderContact)
            placeBetween(bandShoulders[i], shoulderContact, result.hands[i])
          } else placeBetween(strand, base, result.hands[i])
        })
      }
    },
  }
}
