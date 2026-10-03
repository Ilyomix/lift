import { CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Point } from './exerciseModelRig'

const Y = new Vector3(0, 1, 0)
export function placeBetween(mesh: Mesh, start: Point | Vector3, end: Point | Vector3) {
  const a = Array.isArray(start) ? new Vector3(...start) : start.clone()
  const b = Array.isArray(end) ? new Vector3(...end) : end.clone()
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.scale.y = a.distanceTo(b)
  mesh.quaternion.setFromUnitVectors(Y, b.sub(a).normalize())
}

/** Workout equipment only. The athlete is always the imported skinned human. */
export class ExerciseEquipment {
  readonly root = new Group()
  readonly metal = new MeshStandardMaterial({ color: '#6e7d8f', metalness: 0.7, roughness: 0.31 })
  readonly pad = new MeshStandardMaterial({ color: '#263348', roughness: 0.8 })
  readonly grip = new MeshStandardMaterial({ color: '#253247', roughness: 0.94 })
  readonly rope = new MeshStandardMaterial({ color: '#526175', roughness: 0.75, metalness: 0.12 })
  readonly rubber = new MeshStandardMaterial({ color: '#253247', roughness: 0.86, metalness: 0.05 })

  block(at: Point, size: Point, angle = 0, material = this.pad, parent = this.root) {
    const radius = Math.min(...size) * 0.25
    const mesh = new Mesh(new RoundedBoxGeometry(...size, 3, radius), material)
    mesh.position.set(...at); mesh.rotation.x = angle
    parent.add(mesh)
    return mesh
  }
  bar(a: Point, b: Point, radius = 0.025, material = this.metal, parent = this.root) {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, 1, 14), material)
    placeBetween(mesh, a, b); parent.add(mesh)
    return mesh
  }
  cable(a: Point, b: Point) { return this.bar(a, b, 0.006, this.rope) }
  /** D-handle eye sits beyond the fingers; the cable never ends in the palm. */
  cableHandle(depth = .17, faceForward = false) {
    const group = new Group(); this.root.add(group)
    this.handle([0, 0, 0], group).scale.y = 1.8
    this.bar([0, -.115, 0], [0, -.115, depth], .009, this.metal, group)
    this.bar([0, .115, 0], [0, .115, depth], .009, this.metal, group)
    this.bar([0, -.115, depth], [0, .115, depth], .009, this.metal, group)
    return (centre: Vector3, anchor: Point, axis = Y) => {
      group.position.copy(centre)
      const y = axis.clone().normalize()
      const z = faceForward ? new Vector3(0, 0, 1) : new Vector3(...anchor).sub(centre)
      z.addScaledVector(y, -z.dot(y)).normalize()
      group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(y.clone().cross(z).normalize(), y, z))
      group.updateMatrixWorld(true)
      return group.localToWorld(new Vector3(0, 0, depth))
    }
  }
  handle(at: Point = [0, 0, 0], parent = this.root) {
    const mesh = new Mesh(new CylinderGeometry(0.018, 0.018, 0.12, 14), this.grip)
    mesh.name = 'contact-grip'
    mesh.position.set(...at); parent.add(mesh)
    return mesh
  }
  plate(at: Point, radius = 0.17, thickness = 0.035) {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, thickness, 32), this.rubber)
    mesh.rotation.z = Math.PI / 2; mesh.position.set(...at)
    this.root.add(mesh)
    return mesh
  }
  dumbbell(at: Point = [0, 0, 0]) {
    const group = new Group()
    const bar = new Mesh(new CylinderGeometry(0.015, 0.015, 0.27, 16), this.metal)
    bar.rotation.z = Math.PI / 2; group.add(bar)
    for (const side of [-1, 1]) {
      const weight = new Mesh(new CylinderGeometry(0.078, 0.078, 0.058, 24), this.rubber)
      weight.rotation.z = Math.PI / 2; weight.position.x = side * 0.105; group.add(weight)
    }
    group.position.set(...at); this.root.add(group)
    return group
  }
  barbell(at: Point = [0, 0, 0], width = 1.45) {
    const group = new Group()
    const bar = new Mesh(new CylinderGeometry(0.014, 0.014, width, 16), this.metal)
    bar.rotation.z = Math.PI / 2; group.add(bar)
    for (const side of [-1, 1]) {
      const plate = new Mesh(new CylinderGeometry(0.16, 0.16, 0.042, 32), this.rubber)
      plate.rotation.z = Math.PI / 2; plate.position.x = side * (width / 2 - 0.17); group.add(plate)
    }
    group.position.set(...at); this.root.add(group)
    return group
  }
  bench(at: Point = [0, 0.48, 0], incline = 0, length = 1.15) {
    this.block(at, [0.34, 0.075, length], incline)
    for (const z of [-0.36, 0.36]) {
      this.bar([at[0], 0.065, at[2] + z], [at[0], at[1] - 0.035, at[2] + z], 0.033)
      this.bar([at[0] - 0.25, 0.045, at[2] + z], [at[0] + 0.25, 0.045, at[2] + z], 0.028)
    }
  }
  tower(at: Point = [0, 0, 0.8], height = 2.2) {
    for (const side of [-1, 1]) this.bar([at[0] + side * 0.20, 0.06, at[2]], [at[0] + side * 0.20, height, at[2]], 0.028)
    for (let plate = 0; plate < 8; plate++) this.block([at[0], .17 + plate * .094, at[2]], [.30, .079, .16], 0, this.rubber)
    this.bar([at[0] - 0.25, height, at[2]], [at[0] + 0.25, height, at[2]])
    this.bar([at[0] - 0.30, 0.035, at[2]], [at[0] + 0.30, 0.035, at[2]])
  }
  pulley(at: Point) {
    const wheel = this.plate(at, .062, .035)
    wheel.material = this.metal
    this.bar([at[0] - .035, at[1], at[2]], [at[0] + .035, at[1], at[2]], .018, this.rubber)
    return wheel
  }
  /** A padded seat with a real adjustment post, feet and back/chest support. */
  machineSeat(reverse = false, backLean = 0, backOffset = 0) {
    this.block([0, .52, .025], [.38, .075, .34]).name = 'contact-seat'
    this.bar([0, .065, .025], [0, .48, .025], .038)
    this.block([0, .30, .025], [.10, .15, .10], 0, this.metal)
    this.bar([-.42, .045, -.30], [.42, .045, -.30], .035)
    this.bar([0, .045, -.30], [0, .045, .37], .035)
    const z = reverse ? .185 : -.13 + backLean * .43 + backOffset
    this.block([0, reverse ? 1.06 : .99, z], [reverse ? .25 : .32, reverse ? .30 : .57, .065], backLean).name = 'contact-pad'
    // The support sits beyond the pad, never between it and the athlete.
    this.bar([0, .06, reverse ? .67 : -.36], [0, reverse ? 1.03 : 1.20, reverse ? .67 : -.36], .033)
    this.bar([0, reverse ? 1.03 : .99, reverse ? .67 : -.36], [0, reverse ? 1.03 : .99, z + (reverse ? .035 : -.035)], .026)
  }
  /** Original dual overhead-pivot pec deck. All lever geometry remains rigid. */
  flyMachine(reverse: boolean) {
    this.machineSeat(reverse)
    const stackZ = reverse ? .87 : -.55
    this.tower([0, 0, stackZ], 1.91)
    this.bar([0, 1.91, stackZ], [0, 1.91, .0138925], .038)
    this.bar([-.25, 1.91, .0138925], [.25, 1.91, .0138925], .032)
    const height = reverse ? 1.1699603 : 1.0899603
    // Grip-centre radius includes the real palm offset. Wrist-only .54 m
    // targets would turn this isolation into a deeply bent-elbow row.
    const radius = .634
    const arms = [-1, 1].map(side => {
      const arm = new Group()
      arm.name = `rigid-fly-${side}`
      arm.position.set(side * .1922427, 1.85, .0138925)
      this.root.add(arm)
      this.bar([arm.position.x, 1.81, .0138925], [arm.position.x, 1.94, .0138925], .047)
      // The drop rod is beyond the hand; its return stays above the fingers.
      this.bar([0, 0, 0], [0, 0, radius + .075], .029, this.metal, arm)
      this.bar([0, 0, radius + .075], [0, height - 1.85 + .10, radius + .075], .025, this.metal, arm)
      this.bar([0, height - 1.85 + .10, radius + .075], [0, height - 1.85 + .10, radius], .022, this.metal, arm)
      this.bar([0, height - 1.85 + .055, radius], [0, height - 1.85 + .10, radius], .014, this.metal, arm)
      const grip = this.handle([0, height - 1.85, radius], arm)
      return { arm, grip, side }
    })
    return (phase: number) => {
      const angle = reverse ? -.17 + 1.57 * phase : 1.30 - 1.52 * phase
      arms.forEach(({ arm, side }) => { arm.rotation.y = side * angle })
      this.root.updateMatrixWorld(true)
      return {
        targets: arms.map(({ grip }) => grip.getWorldPosition(new Vector3()).toArray() as Point),
        directions: arms.map(({ side }): Point => [side * Math.sin(angle), 0, Math.cos(angle)]),
      }
    }
  }
  /** Independent fixed-length press levers; palms follow their grip centres. */
  pressMachine(overhead: boolean) {
    this.machineSeat(false, -.035, overhead ? .003 : 0)
    this.tower([0, 0, -.58], overhead ? 1.58 : 1.90)
    const pivotY = overhead ? 1.30 : 1.85, pivotZ = overhead ? -.50 : .20
    const dy = overhead ? 0 : -.79, dz = overhead ? .70 : .02
    const inset = overhead ? .22 : .31
    const arms = [-1, 1].map(side => {
      this.bar([side * .62, .05, -.40], [side * .62, pivotY, pivotZ], .037)
      this.bar([side * .62, .05, -.40], [0, .05, -.40], .033)
      const arm = new Group(); arm.name = `rigid-press-${side}`
      arm.position.set(side * .62, pivotY, pivotZ); this.root.add(arm)
      this.bar([side * .55, pivotY, pivotZ], [side * .69, pivotY, pivotZ], .048)
      this.bar([0, 0, 0], [0, dy + .09, dz], .031, this.metal, arm)
      this.bar([0, dy + .09, dz], [-side * inset, dy + .09, dz], .026, this.metal, arm)
      this.bar([-side * inset, dy + .055, dz], [-side * inset, dy + .09, dz], .014, this.metal, arm)
      const grip = this.handle([-side * inset, dy, dz], arm)
      return { arm, grip }
    })
    return (phase: number) => {
      const angle = overhead ? -.30 - .333 * phase : -.26 - .249 * phase
      arms.forEach(({ arm }) => { arm.rotation.x = angle })
      this.root.updateMatrixWorld(true)
      return {
        targets: arms.map(({ grip }) => grip.getWorldPosition(new Vector3()).toArray() as Point),
        axes: arms.map((): Point => [0, Math.cos(angle), Math.sin(angle)]),
        directions: arms.map((): Point => [0, -Math.sin(angle), Math.cos(angle)]),
      }
    }
  }
  supportedRow() {
    this.block([0, 1.178, .292], [.34, .43, .09], .58).name = 'contact-pad'
    this.bar([0, .06, .53], [0, 1.155, .334], .038)
    this.bar([-.65, .05, .5], [.65, .05, .5], .038)
    this.bar([0, .05, -.49], [0, .05, .70], .038)
    const arms = [-1, 1].map(side => {
      this.block([side * .20, .076, -.30], [.23, .025, .35], -.12).name = 'contact-footplate'
      this.bar([side * .61, .05, -.49], [side * .61, .13, -.45], .035)
      const arm = new Group(); arm.name = `rigid-row-${side}`
      arm.position.set(side * .61, .05, -.45); this.root.add(arm)
      this.bar([0, 0, 0], [0, 1.45, 0], .031, this.metal, arm)
      this.bar([0, 1.45, 0], [-side * .28, 1.45, 0], .025, this.metal, arm)
      const grip = this.handle([-side * .28, 1.35, 0], arm)
      this.bar([-side * .28, 1.405, 0], [-side * .28, 1.45, 0], .014, this.metal, arm)
      const load = this.plate([0, .65, 0], .16, .055)
      arm.add(load); load.position.set(side * .09, .65, 0)
      return { arm, grip }
    })
    return (phase: number) => {
      const angle = .80 - .25 * phase
      arms.forEach(({ arm }) => { arm.rotation.x = angle })
      this.root.updateMatrixWorld(true)
      return {
        targets: arms.map(({ grip }) => grip.getWorldPosition(new Vector3()).toArray() as Point),
        axes: arms.map((): Point => [0, Math.cos(angle), Math.sin(angle)]),
        directions: arms.map((): Point => [0, -Math.sin(angle), Math.cos(angle)]),
      }
    }
  }
  style(dark: boolean) {
    this.metal.color.set(dark ? '#7c8b9d' : '#617289')
    this.pad.color.set(dark ? '#354258' : '#27374e')
    this.rope.color.set(dark ? '#b7c4d5' : '#526175')
  }
  dispose() {
    this.root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose() })
    for (const material of [this.metal, this.pad, this.grip, this.rope, this.rubber]) material.dispose()
  }
}
