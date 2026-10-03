import {
  Bone, Box3, Color, Euler, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D,
  Quaternion, SkinnedMesh, Vector3, type Material,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { AnatomicalRegion, MuscleWeights } from './exerciseModelCatalog'
export type { AnatomicalRegion, MuscleWeights } from './exerciseModelCatalog'

export type Point = [number, number, number]
export type PoseResult = { hands: Vector3[]; elbows: Vector3[]; knees: Vector3[]; feet: Vector3[] }
type SideBones = {
  clavicle: string; upperArm: string; forearm: string; hand: string
  thigh: string; shin: string; foot: string; toe?: string
  fingers?: Record<'thumb' | 'index' | 'middle' | 'ring' | 'pinky', string[]>
  palmLandmarks?: { index: string; middle: string; pinky: string }
}
export type AthleteManifest = {
  version: 1; forwardAxis: '+Z'; upAxis: '+Y'; heightMeters: number
  bones: { pelvis: string; spine: string[]; neck: string; head: string; left: SideBones; right: SideBones }
  muscleMaterials: Partial<Record<AnatomicalRegion, string[]>>
  skinMaterials: string[]; shortsMaterials: string[]
  restLandmarks?: Record<string, { head: Point; tail: Point }>
}
type RestBone = { bone: Bone; position: Vector3; quaternion: Quaternion; scale: Vector3; world: Quaternion }
type LimbChain = { first: Bone; middle: Bone; end: Bone; upper: number; lower: number; hingeNormal: Vector3 }
type ResolvedSide = {
  arm: LimbChain; leg: LimbChain; clavicle: Bone; toe?: Bone
  fingers?: Record<'thumb' | 'index' | 'middle' | 'ring' | 'pinky', Bone[]>
  palm?: { frame: Quaternion; handRotation: Quaternion; length: number }
  twists?: Bone[]
  twistReference?: number
}
type Source = { gltf: GLTF; manifest: AthleteManifest }
let sourcePromise: Promise<Source> | undefined
const X = new Vector3(1, 0, 0)

function validateManifest(value: unknown): asserts value is AthleteManifest {
  if (!value || typeof value !== 'object') throw new Error('Missing athlete rig manifest')
  const manifest = value as AthleteManifest
  if (manifest.version !== 1 || manifest.forwardAxis !== '+Z' || manifest.upAxis !== '+Y' ||
      !Number.isFinite(manifest.heightMeters) || manifest.heightMeters < 1 || manifest.heightMeters > 2.5 ||
      !manifest.bones?.pelvis || !Array.isArray(manifest.bones.spine) || !manifest.bones.spine.length ||
      !manifest.bones.left || !manifest.bones.right || !Array.isArray(manifest.skinMaterials) ||
      !Array.isArray(manifest.shortsMaterials) || !manifest.muscleMaterials) throw new Error('Unsupported athlete rig manifest')
}

async function loadSource(): Promise<Source> {
  if (!sourcePromise) {
    const base = `${import.meta.env.BASE_URL}models/exercise/athlete`
    sourcePromise = Promise.all([
      new GLTFLoader().loadAsync(`${base}.glb`),
      fetch(`${base}.rig.json`).then(async response => {
        if (!response.ok) throw new Error('Athlete rig unavailable')
        const manifest: unknown = await response.json()
        validateManifest(manifest)
        return manifest
      }),
    ]).then(([gltf, manifest]) => ({ gltf, manifest })).catch(error => {
      sourcePromise = undefined
      throw error
    })
  }
  return sourcePromise
}

/** Clamp the real target before solving, so the skin's wrist always meets its hand. */
export function solveTwoBone(start: Vector3, target: Vector3, pole: Vector3, upper: number, lower: number) {
  const direction = target.clone().sub(start)
  const rawDistance = direction.length()
  if (rawDistance < 1e-6) direction.set(0, -1, 0)
  else direction.divideScalar(rawDistance)
  const distance = Math.max(Math.abs(upper - lower) + 0.001, Math.min(upper + lower - 0.001, rawDistance))
  const end = start.clone().addScaledVector(direction, distance)
  const normal = pole.clone().sub(start)
  normal.addScaledVector(direction, -normal.dot(direction))
  if (normal.lengthSq() < 1e-8) normal.crossVectors(direction, Math.abs(direction.y) < 0.9 ? new Vector3(0, 1, 0) : X)
  normal.normalize()
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
  const perpendicular = Math.sqrt(Math.max(0, upper * upper - along * along))
  return { joint: start.clone().addScaledVector(direction, along).addScaledVector(normal, perpendicular), end }
}

/** Real, weighted human mesh. Rotations are computed from the exported bind axes. */
export class Athlete {
  readonly root = new Group()
  readonly manifest: AthleteManifest
  readonly measures: { height: number; arms: [number, number][]; legs: [number, number][]; hipWidth: number }
  private rest: RestBone[] = []
  private sides: ResolvedSide[]
  private pelvis: Bone
  private spine: Bone[]
  private bindPelvis: Vector3
  private materials = new Map<string, MeshStandardMaterial[]>()
  private geometries = new Set<Mesh['geometry']>()
  private ownedMaterials = new Set<Material>()
  private calibratingTwist = false
  private fingerDirections = new Map<Bone, Vector3>()

  private constructor(source: Source, readonly weights: MuscleWeights) {
    this.manifest = source.manifest
    const model = clone(source.gltf.scene)
    this.root.add(model)
    let skinnedCount = 0
    model.traverse(object => {
      if (object instanceof SkinnedMesh) skinnedCount++
      if (!(object instanceof Mesh)) return
      // Per-instance ownership: recolouring/disposal cannot alter another open sheet.
      object.geometry = object.geometry.clone()
      this.geometries.add(object.geometry)
      const materials = [object.material].flat().map(sourceMaterial => {
        const material = sourceMaterial.clone()
        this.ownedMaterials.add(material)
        if (material instanceof MeshStandardMaterial) {
          const list = this.materials.get(material.name) ?? []
          list.push(material); this.materials.set(material.name, list)
          material.roughness = 0.48; material.metalness = 0.015
        }
        return material
      })
      object.material = Array.isArray(object.material) ? materials : materials[0]
      object.frustumCulled = false
    })
    if (!skinnedCount) throw new Error('Athlete must contain a real skinned mesh')
    this.root.updateMatrixWorld(true)
    const bones = new Map<string, Bone>()
    model.traverse(object => {
      if (!(object instanceof Bone)) return
      if (bones.has(object.name)) throw new Error(`Duplicate athlete bone: ${object.name}`)
      bones.set(object.name, object)
      this.rest.push({ bone: object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), world: object.getWorldQuaternion(new Quaternion()) })
    })
    const bone = (name: string) => {
      const result = bones.get(name)
      if (!result) throw new Error(`Athlete manifest references missing bone: ${name}`)
      return result
    }
    const chain = (first: string, middle: string, end: string): LimbChain => {
      const a = bone(first), b = bone(middle), c = bone(end)
      const upper = b.getWorldPosition(new Vector3()).sub(a.getWorldPosition(new Vector3()))
      const lower = c.getWorldPosition(new Vector3()).sub(b.getWorldPosition(new Vector3()))
      return {
        first: a, middle: b, end: c,
        upper: upper.length(), lower: lower.length(),
        hingeNormal: upper.cross(lower).normalize().applyQuaternion(a.getWorldQuaternion(new Quaternion()).invert()),
      }
    }
    this.pelvis = bone(this.manifest.bones.pelvis)
    this.spine = this.manifest.bones.spine.map(bone)
    this.bindPelvis = this.pelvis.getWorldPosition(new Vector3())
    // Pose arrays use left side of the image first (-X), anatomical right.
    this.sides = [this.manifest.bones.right, this.manifest.bones.left].map(side => {
      const hand = bone(side.hand)
      let palm: ResolvedSide['palm']
      if (side.palmLandmarks) {
        const wrist = hand.getWorldPosition(new Vector3())
        const middle = bone(side.palmLandmarks.middle).getWorldPosition(new Vector3())
        const index = bone(side.palmLandmarks.index).getWorldPosition(new Vector3())
        const pinky = bone(side.palmLandmarks.pinky).getWorldPosition(new Vector3())
        const length = middle.distanceTo(wrist)
        const along = middle.sub(wrist).normalize()
        const across = index.sub(pinky)
        across.addScaledVector(along, -across.dot(along)).normalize()
        palm = { frame: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, along, across.clone().cross(along).normalize())), handRotation: hand.getWorldQuaternion(new Quaternion()), length }
      }
      return {
        arm: chain(side.upperArm, side.forearm, side.hand), leg: chain(side.thigh, side.shin, side.foot),
        clavicle: bone(side.clavicle), toe: side.toe ? bone(side.toe) : undefined,
        fingers: side.fingers ? Object.fromEntries(Object.entries(side.fingers).map(([name, names]) => [name, names.map(bone)])) as ResolvedSide['fingers'] : undefined,
        palm,
      }
    })
    for (const side of this.sides) for (const names of Object.values(side.fingers ?? {})) for (const joint of names) {
      const landmark = this.manifest.restLandmarks?.[joint.name]
      if (landmark) this.fingerDirections.set(joint, new Vector3(...landmark.tail).sub(new Vector3(...landmark.head)).normalize()
        .applyQuaternion(joint.getWorldQuaternion(new Quaternion()).invert()))
    }
    const size = new Box3().setFromObject(this.root).getSize(new Vector3())
    if (Math.abs(size.y - this.manifest.heightMeters) > 0.15) throw new Error('Athlete units differ from rig manifest')
    this.measures = {
      height: this.manifest.heightMeters,
      arms: this.sides.map(side => [side.arm.upper, side.arm.lower]),
      legs: this.sides.map(side => [side.leg.upper, side.leg.lower]),
      hipWidth: this.sides[0].leg.first.getWorldPosition(new Vector3()).distanceTo(this.sides[1].leg.first.getWorldPosition(new Vector3())),
    }
    this.sides.forEach(side => this.addForearmTwists(side))
    for (const name of [...this.manifest.skinMaterials, ...this.manifest.shortsMaterials, ...Object.values(this.manifest.muscleMaterials).flat()]) {
      if (!this.materials.has(name)) throw new Error(`Athlete manifest references missing surface material: ${name}`)
    }
  }

  static async load(weights: MuscleWeights) { return new Athlete(await loadSource(), weights) }

  /** Choose one rotation branch for the clip, independent of playback order. */
  calibrateTwistFromPose(pose: () => void) {
    this.sides.forEach(side => { side.twistReference = undefined })
    this.calibratingTwist = true
    try { pose() } finally { this.calibratingTwist = false }
  }

  private addForearmTwists(side: ResolvedSide) {
    const forearm = side.arm.middle
    const origin = forearm.getWorldPosition(new Vector3())
    const axis = side.arm.end.getWorldPosition(new Vector3()).sub(origin).normalize()
    const twists = Array.from({ length: 4 }, (_, index) => {
      const bone = new Bone()
      bone.name = `${forearm.name}_twist_${index + 1}`
      forearm.add(bone); bone.updateMatrixWorld(true)
      this.rest.push({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(), world: bone.getWorldQuaternion(new Quaternion()) })
      return bone
    })
    side.twists = twists
    const indices = new Map<SkinnedMesh['skeleton'], number[]>()
    this.root.traverse(mesh => {
      if (!(mesh instanceof SkinnedMesh)) return
      const skeleton = mesh.skeleton
      const original = skeleton.bones.indexOf(forearm)
      if (original < 0) return
      let chain = indices.get(skeleton)
      if (!chain) {
        chain = [original, ...twists.map((_, i) => skeleton.bones.length + i)]
        // SkeletonUtils clones bones but shares inverse-bind arrays with the
        // source. Give the extra skin joints strictly per-instance ownership.
        skeleton.boneInverses = skeleton.boneInverses.map(matrix => matrix.clone())
        for (const bone of twists) {
          skeleton.bones.push(bone)
          skeleton.boneInverses.push(bone.matrixWorld.clone().invert())
        }
        skeleton.init(); indices.set(skeleton, chain)
      }
      const skinIndex = mesh.geometry.getAttribute('skinIndex')
      const skinWeight = mesh.geometry.getAttribute('skinWeight')
      const point = new Vector3()
      for (let vertex = 0; vertex < skinIndex.count; vertex++) {
        const influence = [0, 1, 2, 3].find(i => skinIndex.getComponent(vertex, i) === original && skinWeight.getComponent(vertex, i) > 0)
        if (influence === undefined) continue
        mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld)
        const t = Math.max(0, Math.min(1, point.sub(origin).dot(axis) / side.arm.lower)) * twists.length
        const low = Math.min(twists.length - 1, Math.floor(t)), blend = t - low
        const weight = skinWeight.getComponent(vertex, influence)
        const weights = [0, 1, 2, 3].filter(i => i !== influence).map(i => ({ index: skinIndex.getComponent(vertex, i), weight: skinWeight.getComponent(vertex, i) }))
        weights.push({ index: chain[low], weight: weight * (1 - blend) }, { index: chain[low + 1], weight: weight * blend })
        weights.sort((a, b) => b.weight - a.weight)
        const total = weights.slice(0, 4).reduce((sum, entry) => sum + entry.weight, 0)
        for (let i = 0; i < 4; i++) {
          skinIndex.setComponent(vertex, i, weights[i].index)
          skinWeight.setComponent(vertex, i, weights[i].weight / total)
        }
      }
      skinIndex.needsUpdate = true; skinWeight.needsUpdate = true
    })
  }

  style(accent: string, dark: boolean) {
    const skin = new Color(dark ? '#e5e9ed' : '#dbe1e6')
    const paint = (names: string[], color: Color | string) => {
      for (const name of names) for (const material of this.materials.get(name) ?? []) material.color.set(color)
    }
    paint(this.manifest.skinMaterials, skin)
    const fabric = new Color(dark ? '#303c4c' : '#202a36')
    const shortMaterials = new Set(this.manifest.shortsMaterials)
    paint(this.manifest.shortsMaterials, fabric)
    for (const [region, names] of Object.entries(this.manifest.muscleMaterials)) {
      const weight = this.weights[region as AnatomicalRegion] ?? 0
      for (const name of names) {
        const base = shortMaterials.has(name) ? fabric : skin
        const color = weight >= 1 ? new Color(accent) : weight > 0 ? new Color(accent).lerp(base, 0.6) : base
        paint([name], color)
      }
    }
  }

  private worldRotation(object: Object3D, target: Quaternion) {
    const parent = object.parent?.getWorldQuaternion(new Quaternion()) ?? new Quaternion()
    object.quaternion.copy(parent.invert().multiply(target))
    object.updateMatrixWorld(true)
  }
  private aim(bone: Bone, child: Bone, point: Vector3) {
    const origin = bone.getWorldPosition(new Vector3())
    const current = child.getWorldPosition(new Vector3()).sub(origin).normalize()
    const target = point.clone().sub(origin).normalize()
    const rotation = new Quaternion().setFromUnitVectors(current, target).multiply(bone.getWorldQuaternion(new Quaternion()))
    this.worldRotation(bone, rotation)
  }
  private solve(chain: LimbChain, target: Vector3, pole: Vector3, alignHinge = false) {
    const start = chain.first.getWorldPosition(new Vector3())
    const result = solveTwoBone(start, target, pole, chain.upper, chain.lower)
    this.aim(chain.first, chain.middle, result.joint)
    if (alignHinge) {
      // IK joint positions alone do not orient the skin. Preserve the exported
      // elbow hinge, rather than bending a backwards/sideways upper-arm mesh.
      const axis = result.joint.clone().sub(start).normalize()
      const desired = axis.clone().cross(result.end.clone().sub(result.joint)).normalize()
      const rotation = chain.first.getWorldQuaternion(new Quaternion())
      const current = chain.hingeNormal.clone().applyQuaternion(rotation)
      const twist = Math.atan2(axis.dot(current.clone().cross(desired)), current.dot(desired))
      this.worldRotation(chain.first, new Quaternion().setFromAxisAngle(axis, twist).multiply(rotation))
    }
    this.aim(chain.middle, chain.end, result.end)
    return result.end
  }

  private grip(side: ResolvedSide, index: number, axis?: Point, flat = false, direction?: Point, closed = true) {
    if (!side.palm || !side.fingers) return side.arm.end.getWorldPosition(new Vector3())
    const wrist = side.arm.end.getWorldPosition(new Vector3())
    const along = flat ? new Vector3(0, 0, 1) : direction ? new Vector3(...direction).normalize() : wrist.clone().sub(side.arm.middle.getWorldPosition(new Vector3())).normalize()
    const across = flat ? new Vector3(index === 0 ? 1 : -1, 0, 0) : axis ? new Vector3(...axis) : new Vector3(0, 1, 0)
    across.addScaledVector(along, -across.dot(along)).normalize()
    if (across.lengthSq() < 0.1) across.set(1, 0, 0).addScaledVector(along, -along.x).normalize()
    const normal = across.clone().cross(along).normalize()
    const frame = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(across, along, normal))
    const handRotation = frame.clone().multiply(side.palm.frame.clone().invert()).multiply(side.palm.handRotation)
    const inherited = side.arm.end.getWorldQuaternion(new Quaternion())
    const delta = handRotation.clone().multiply(inherited.invert())
    const forearmAxis = wrist.clone().sub(side.arm.middle.getWorldPosition(new Vector3())).normalize()
    let twist = 2 * Math.atan2(new Vector3(delta.x, delta.y, delta.z).dot(forearmAxis), delta.w)
    if (twist > Math.PI) twist -= 2 * Math.PI
    if (twist < -Math.PI) twist += 2 * Math.PI
    if (this.calibratingTwist) side.twistReference = twist
    else if (side.twistReference !== undefined) {
      // A hand can cross ±π without changing orientation; fractional skin
      // joints cannot. Keep the branch nearest the clip's calibrated start.
      twist += 2 * Math.PI * Math.round((side.twistReference - twist) / (2 * Math.PI))
    }
    const localAxis = forearmAxis.applyQuaternion(side.arm.middle.getWorldQuaternion(new Quaternion()).invert())
    side.twists?.forEach((bone, index) => {
      bone.quaternion.setFromAxisAngle(localAxis, twist * (index + 1) / side.twists!.length)
      bone.updateMatrixWorld(true)
    })
    this.worldRotation(side.arm.end, handRotation)
    const sign = index === 0 ? 1 : -1
    if (flat || !closed) {
      for (const finger of ['index', 'middle', 'ring', 'pinky'] as const) for (const bone of side.fingers[finger]) {
        const axis = this.fingerDirections.get(bone)
        if (!axis) continue
        const rotation = bone.getWorldQuaternion(new Quaternion())
        this.worldRotation(bone, new Quaternion().setFromUnitVectors(axis.clone().applyQuaternion(rotation), along).multiply(rotation))
      }
      const thumbDirection = along.clone().multiplyScalar(0.55).addScaledVector(across, 0.84).normalize()
      for (let joint = 0; joint < side.fingers.thumb.length - 1; joint++) {
        const thumb = side.fingers.thumb[joint]
        this.aim(thumb, side.fingers.thumb[joint + 1], thumb.getWorldPosition(new Vector3()).add(thumbDirection))
      }
      return wrist.addScaledVector(along, side.palm.length * 0.70).addScaledVector(normal, flat ? sign * 0.016 : 0)
    }
    for (const finger of ['index', 'middle', 'ring', 'pinky'] as const) {
      const angles = [0.86, 1.18, 0.85]
      side.fingers[finger].forEach((bone, joint) => {
        this.worldRotation(bone, new Quaternion().setFromAxisAngle(across, sign * (angles[joint] ?? 0.85)).multiply(bone.getWorldQuaternion(new Quaternion())))
      })
    }
    // A thumb opposes the fingers across the palm; flexing it around the
    // finger axis alone leaves the bind-pose thumb sticking out sideways.
    const [thumbBase, thumbMiddle, thumbEnd] = side.fingers.thumb
    if (thumbBase && thumbMiddle && thumbEnd) {
      const a = thumbBase.getWorldPosition(new Vector3())
      const b = thumbMiddle.getWorldPosition(new Vector3())
      const c = thumbEnd.getWorldPosition(new Vector3())
      const palmPoint = (x: number, y: number, z: number) => wrist.clone()
        .addScaledVector(across, side.palm!.length * x)
        .addScaledVector(along, side.palm!.length * y)
        .addScaledVector(normal, sign * side.palm!.length * z)
      const thumb = solveTwoBone(a, palmPoint(.18, .88, .38), palmPoint(.55, .55, .55), a.distanceTo(b), b.distanceTo(c))
      this.aim(thumbBase, thumbMiddle, thumb.joint)
      this.aim(thumbMiddle, thumbEnd, thumb.end)
    }
    return wrist.addScaledVector(along, side.palm.length * 0.88).addScaledVector(normal, sign * 0.028)
  }

  pose(hips: Point, lean: number, knees: Point[], feet: Point[], hands: Point[], poles: Point[], options: {
    pelvisTilt?: number; trunkFlexion?: number; footRotations?: Point[]; handRotations?: Point[]; grip?: boolean; openHands?: boolean; gripAxes?: Point[]; gripDirections?: Point[]; flatHands?: boolean; flatHandSides?: boolean[]; gripTargets?: boolean
  } = {}): PoseResult {
    if (options.gripTargets) {
      if (options.grip && !options.gripDirections && !options.openHands && !options.flatHands &&
          !options.flatHandSides?.some(Boolean) && this.sides.every(side => side.palm)) {
        // Solve the contact as an extended forearm. Freezing the hand frame
        // before removing its palm offset bends the wrist on short reaches.
        this.pose(hips, lean, knees, feet, hands, poles, { ...options, gripTargets: false })
        const wrists: Point[] = [], elbows: Point[] = [], directions: Point[] = []
        for (let i = 0; i < this.sides.length; i++) {
          const side = this.sides[i]
          const start = side.arm.first.getWorldPosition(new Vector3())
          const contact = new Vector3(...hands[i])
          const pole = new Vector3(...poles[i])
          const palmLength = side.palm!.length * 0.88
          const end = contact.clone()
          let joint = start.clone(), along = new Vector3()
          // Only the 28 mm normal offset is iterated; limb lengths are solved
          // analytically each time. No recursively accumulated wrist errors.
          for (let iteration = 0; iteration < 12; iteration++) {
            const result = solveTwoBone(start, end, pole, side.arm.upper, side.arm.lower + palmLength)
            joint = result.joint
            along = result.end.clone().sub(joint).normalize()
            const across = options.gripAxes?.[i] ? new Vector3(...options.gripAxes[i]) : new Vector3(0, 1, 0)
            across.addScaledVector(along, -across.dot(along)).normalize()
            if (across.lengthSq() < 0.1) across.set(1, 0, 0).addScaledVector(along, -along.x).normalize()
            const next = contact.clone().addScaledVector(across.cross(along).normalize(), i === 0 ? -0.028 : 0.028)
            if (next.distanceToSquared(end) < 1e-12) break
            end.copy(next)
          }
          wrists.push(joint.clone().addScaledVector(along, side.arm.lower).toArray() as Point)
          elbows.push(joint.toArray() as Point)
          directions.push(along.toArray() as Point)
        }
        return this.pose(hips, lean, knees, feet, wrists, elbows, { ...options, gripDirections: directions, gripTargets: false })
      }
      // Closed-chain contacts specify palm/grip centres, not wrist joints.
      // Three bounded corrections compensate the wrist-to-palm offset.
      let wrists = hands.map(point => [...point] as Point)
      let result: PoseResult | undefined
      let directions = options.gripDirections
      for (let iteration = 0; iteration < 3; iteration++) {
        result = this.pose(hips, lean, knees, feet, wrists, poles, { ...options, gripDirections: directions, gripTargets: false })
        // A fixed handle fixes the hand frame too. Recomputing it from the
        // forearm after every correction causes oscillation around bent elbows.
        directions ??= this.sides.map(side => side.arm.end.getWorldPosition(new Vector3()).sub(side.arm.middle.getWorldPosition(new Vector3())).normalize().toArray() as Point)
        // Reconstruct the wrist from the desired contact and the actual palm
        // offset. Adding the residual to the previous target also accumulates
        // IK clamping when the initial centre lies beyond wrist reach.
        wrists = this.sides.map((side, i) => new Vector3(...hands[i])
          .sub(result!.hands[i].clone().sub(side.arm.end.getWorldPosition(new Vector3())))
          .toArray() as Point)
      }
      return result!
    }
    this.root.position.set(0, 0, 0)
    for (const rest of this.rest) {
      rest.bone.position.copy(rest.position); rest.bone.quaternion.copy(rest.quaternion); rest.bone.scale.copy(rest.scale)
    }
    this.root.position.set(...hips).sub(this.bindPelvis)
    this.root.updateMatrixWorld(true)
    const pelvisRest = this.rest.find(rest => rest.bone === this.pelvis)!
    this.worldRotation(this.pelvis, new Quaternion().setFromAxisAngle(X, options.pelvisTilt ?? lean).multiply(pelvisRest.world))
    const bend = (lean - (options.pelvisTilt ?? lean) + (options.trunkFlexion ?? 0)) / this.spine.length
    for (const spine of this.spine) this.worldRotation(spine, new Quaternion().setFromAxisAngle(X, bend).multiply(spine.getWorldQuaternion(new Quaternion())))
    const resolvedHands: Vector3[] = []
    for (let i = 0; i < 2; i++) {
      const side = this.sides[i]
      this.solve(side.leg, new Vector3(...feet[i]), new Vector3(...knees[i]))
      resolvedHands.push(this.solve(side.arm, new Vector3(...hands[i]), new Vector3(...poles[i]), true))
      for (const [bone, rotations] of [[side.leg.end, options.footRotations], [side.arm.end, options.handRotations]] as const) {
        if (!rotations?.[i]) continue
        const rest = this.rest.find(item => item.bone === bone)!
        this.worldRotation(bone, new Quaternion().setFromEuler(new Euler(...rotations[i])).multiply(rest.world))
      }
      const flat = options.flatHands || options.flatHandSides?.[i]
      if (options.grip || options.openHands || flat) resolvedHands[i] = this.grip(side, i, options.gripAxes?.[i], flat, options.gripDirections?.[i], !options.openHands)
    }
    this.root.updateMatrixWorld(true)
    return {
      hands: resolvedHands,
      elbows: this.sides.map(side => side.arm.middle.getWorldPosition(new Vector3())),
      knees: this.sides.map(side => side.leg.middle.getWorldPosition(new Vector3())),
      feet: this.sides.map(side => side.leg.end.getWorldPosition(new Vector3())),
    }
  }

  dispose() {
    this.geometries.forEach(geometry => geometry.dispose())
    this.ownedMaterials.forEach(material => material.dispose())
    this.root.traverse(object => { if (object instanceof SkinnedMesh) object.skeleton.dispose() })
  }
}
