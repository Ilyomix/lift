import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['program', 'evidence', 'pause', 'reminders', 'privacy', 'kit', 'logbook', 'dumbbell', 'plate', 'stopwatch', 'calendar', 'chart', 'nutrition', 'settings', 'appearance', 'backup', 'coach', 'trophy', 'workout-upper', 'workout-lower', 'workout-push', 'workout-pull', 'workout-legs'];
const allowedMaterials = new Set(['LiftGraphite', 'LiftCobalt', 'LiftSilver', 'LiftInk']);
const report = [];
for (const name of names) {
  const bytes = await readFile(resolve(root, `public/models/sport/${name}.glb`));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
  const jsonSize = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.toString('utf8', 20, 20 + jsonSize));
  const binOffset = 20 + jsonSize;
  assert.equal(bytes.readUInt32LE(binOffset + 4), 0x004e4942);
  const binary = bytes.subarray(binOffset + 8);
  assert.equal(binary.length, bytes.readUInt32LE(binOffset));
  assert.equal(doc.buffers.length, 1);
  assert.equal(doc.buffers[0].uri, undefined);
  assert(doc.buffers[0].byteLength <= binary.length);
  assert.equal(doc.images?.length ?? 0, 0, 'No raster textures or external images');
  assert.equal(doc.textures?.length ?? 0, 0);
  assert(doc.materials.every(mat => allowedMaterials.has(mat.name)));
  assert.equal(doc.cameras.length, 1);
  assert.equal(doc.cameras[0].type, 'orthographic');
  const camera = doc.cameras[0].orthographic;
  assert(camera.xmag > 0 && Math.abs(camera.xmag - camera.ymag) < 1e-7, `${name}: square-slot camera aspect must be exactly 1:1`);
  for (const view of doc.bufferViews) assert((view.byteOffset ?? 0) + view.byteLength <= doc.buffers[0].byteLength, `${name}: buffer view exceeds binary payload`);
  const values = index => {
    const accessor = doc.accessors[index];
    const view = doc.bufferViews[accessor.bufferView];
    const count = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
    assert(count && !accessor.sparse);
    const [width, read] = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'], 5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] }[accessor.componentType];
    const stride = view.byteStride ?? count * width;
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    assert(offset + (accessor.count - 1) * stride + count * width <= (view.byteOffset ?? 0) + view.byteLength);
    return Array.from({ length: accessor.count }, (_, i) => Array.from({ length: count }, (_, j) => binary[read](offset + i * stride + j * width)));
  };
  let triangles = 0;
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    const positions = values(primitive.attributes.POSITION);
    assert(positions.flat().every(Number.isFinite), `${name}: non-finite geometry`);
    const indices = values(primitive.indices).flat();
    assert.equal(indices.length % 3, 0);
    assert(indices.every(index => index < positions.length));
    triangles += indices.length / 3;
  }
  assert(doc.nodes.some(node => node.name === 'ArtRoot'));
  assert.equal(doc.animations.length, 1);
  const animation = doc.animations[0];
  assert.equal(animation.name, 'Idle');
  assert(animation.channels.length > 0);
  for (const sampler of animation.samplers) {
    const times = values(sampler.input).flat();
    assert(Math.abs(times[0]) < 1e-6 && Math.abs(times.at(-1) - 6) < 1e-6, `${name}: loop must span 0–6 seconds`);
    assert(times.every((time, i) => Number.isFinite(time) && (!i || time > times[i-1])));
    assert(values(sampler.output).flat().every(Number.isFinite));
  }
  for (const channel of animation.channels) {
    const output = values(animation.samplers[channel.sampler].output);
    const first = output[0], last = output.at(-1);
    const difference = Math.max(...first.map((value, i) => Math.abs(value - last[i])));
    const signDifference = Math.max(...first.map((value, i) => Math.abs(value + last[i])));
    assert(difference < 1e-5 || (channel.target.path === 'rotation' && signDifference < 1e-5), `${name}: discontinuous loop endpoint`);
  }
  const drawCalls = doc.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0);
  assert(drawCalls <= 10, `${name}: unexpectedly fragmented static geometry`);
  report.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), triangles, drawCalls, animatedChannels: animation.channels.length, cameraAspect: 1, duration: 6, materials: doc.materials.map(mat => mat.name) });
}
await mkdir(resolve(root, '.local-release/sport-models'), { recursive: true });
const result = { verifiedAt: new Date().toISOString(), validationScope: 'Binary and animation contract only; visual acceptance is pending', models: report, totalBytes: report.reduce((sum, model) => sum + model.bytes, 0) };
await writeFile(resolve(root, '.local-release/sport-models/validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(`Verified ${report.length} bundled 3D models; ${result.totalBytes} bytes; square cameras; continuous 6 s Idle clips; no textures or external resources.`);
