import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const path = 'public/models/exercise/athlete.glb'
const bytes = readFileSync(path)
assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
assert.equal(bytes.readUInt32LE(4), 2)
assert.equal(bytes.readUInt32LE(8), bytes.length)
assert.ok(bytes.length < 4 * 1024 * 1024, 'PWA precache asset limit exceeded')
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength))
const binaryStart = 20 + jsonLength + 8
const manifest = JSON.parse(readFileSync('public/models/exercise/athlete.rig.json', 'utf8'))
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const components = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'], 5126: [4, 'readFloatLE'] }
function accessor(index) {
  const a = gltf.accessors[index]
  const view = gltf.bufferViews[a.bufferView]
  const [size, read] = components[a.componentType]
  const count = sizes[a.type]
  const stride = view.byteStride ?? size * count
  const start = binaryStart + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return Array.from({ length: a.count }, (_, row) => Array.from({ length: count }, (_, col) => bytes[read](start + row * stride + col * size)))
}
assert.equal(gltf.skins.length, 1)
assert.equal(gltf.skins[0].joints.length, 53)
assert.equal(gltf.textures?.length ?? 0, 0)
assert.equal(gltf.animations?.length ?? 0, 0)
const nodeNames = new Set(gltf.nodes.map(node => node.name))
const materialNames = new Set(gltf.materials.map(material => material.name))
function strings(value) { return typeof value === 'string' ? [value] : Object.values(value).flatMap(strings) }
for (const name of strings(manifest.bones)) assert.ok(nodeNames.has(name), `Missing bone: ${name}`)
for (const name of [...manifest.skinMaterials, ...manifest.shortsMaterials, ...Object.values(manifest.muscleMaterials).flat()]) assert.ok(materialNames.has(name), `Missing material: ${name}`)
let triangleCount = 0, exportedVertices = 0, maxWeightError = 0, primitiveCount = 0
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  primitiveCount++
  triangleCount += gltf.accessors[primitive.indices].count / 3
  const weights = accessor(primitive.attributes.WEIGHTS_0)
  const joints = accessor(primitive.attributes.JOINTS_0)
  const positions = accessor(primitive.attributes.POSITION)
  exportedVertices += weights.length
  for (let i = 0; i < weights.length; i++) {
    assert.ok(positions[i].every(Number.isFinite), 'Non-finite position')
    assert.ok(weights[i].every(weight => Number.isFinite(weight) && weight >= 0), 'Invalid skin weight')
    const error = Math.abs(weights[i].reduce((sum, weight) => sum + weight, 0) - 1)
    maxWeightError = Math.max(maxWeightError, error)
    assert.ok(error < 1e-5, `Unnormalized/unweighted vertex: ${error}`)
    assert.ok(joints[i].every(joint => joint >= 0 && joint < 53), 'Invalid joint reference')
  }
}
const result = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangleCount, exportedVerticesIncludingMaterialSeams: exportedVertices, skinCount: 1, jointCount: 53, maxWeightNormalizationError: maxWeightError, zeroWeightVertices: 0, textureCount: 0, primitiveCount }
mkdirSync('.local-release/athlete', { recursive: true })
writeFileSync('.local-release/athlete/skin-validation.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
