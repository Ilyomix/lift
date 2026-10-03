import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
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
  readonly rubber = new MeshStandardMaterial({ color: '#253247', roughness: 0.86, metalness: 0.05 })

  block(at: Point, size: Point, angle = 0, material = this.pad) {
    const radius = Math.min(...size) * 0.25
    const mesh = new Mesh(new RoundedBoxGeometry(...size, 3, radius), material)
    mesh.position.set(...at); mesh.rotation.x = angle
    this.root.add(mesh)
    return mesh
  }
  bar(a: Point, b: Point, radius = 0.025, material = this.metal) {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, 1, 14), material)
    placeBetween(mesh, a, b); this.root.add(mesh)
    return mesh
  }
  cable(a: Point, b: Point) { return this.bar(a, b, 0.006, this.grip) }
  handle(at: Point = [0, 0, 0]) {
    const mesh = new Mesh(new CylinderGeometry(0.018, 0.018, 0.12, 14), this.grip)
    mesh.position.set(...at); this.root.add(mesh)
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
    this.block([at[0], 0.52, at[2]], [0.30, 0.8, 0.16], 0, this.rubber)
    this.bar([at[0] - 0.25, height, at[2]], [at[0] + 0.25, height, at[2]])
    this.bar([at[0] - 0.30, 0.035, at[2]], [at[0] + 0.30, 0.035, at[2]])
  }
  style(dark: boolean) {
    this.metal.color.set(dark ? '#7c8b9d' : '#617289')
    this.pad.color.set(dark ? '#354258' : '#27374e')
  }
  dispose() {
    this.root.traverse(object => { if (object instanceof Mesh) object.geometry.dispose() })
    for (const material of [this.metal, this.pad, this.grip, this.rubber]) material.dispose()
  }
}
