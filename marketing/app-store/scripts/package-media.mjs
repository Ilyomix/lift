import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseReady } from './release-source.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../.local-release/marketing');
const requirements = JSON.parse(await readFile(resolve(project, 'source-requirements.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(output, 'upload-ready.json'), 'utf8'));
assertReleaseReady(requirements);
assert.equal(manifest.release.build, requirements.requiredBuild);
assert.equal(manifest.release.sourceCommit, requirements.sourceCommit);
assert.equal(manifest.pending.length, 0, 'Finish and review every asset before packaging');
assert.equal(manifest.assets.length, 58);
assert.equal(new Set(manifest.assets.map(asset => asset.path)).size, 58);
for (const [kind, count] of Object.entries({ screenshot: 40, preview: 12, promo: 6 })) {
  assert.equal(manifest.assets.filter(asset => asset.kind === kind).length, count);
}
const files = new Set(['index.html', 'manifest.json', 'gallery-assets/icon.png', 'gallery-assets/geologica.woff2', 'gallery-assets/Geologica-LICENSE.txt']);
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
assert.equal(await hash(resolve(project, 'public/brand/icon.png')), manifest.release.brandSha256);
const verify = async file => {
  assert(file.path && !file.path.startsWith('/') && !file.path.includes('\\') && !file.path.split('/').includes('..'));
  assert(!/[\r\n]/.test(file.path));
  assert.equal(await hash(resolve(output, file.path)), file.sha256, `${file.path}: bytes changed after QA`);
  files.add(file.path);
};
for (const asset of manifest.assets) {
  assert(asset.reviewed && ['qa-approved', 'uploaded'].includes(asset.state));
  assert.equal(asset.sourceBuild, manifest.release.build);
  assert.equal(asset.sourceCommit, manifest.release.sourceCommit);
  assert.equal(asset.brandSha256, manifest.release.brandSha256);
  await verify(asset);
  if (asset.poster) await verify(asset.poster);
}
execFileSync(process.execPath, ['scripts/create-gallery.mjs'], { cwd: project, stdio: 'inherit' });
const delivery = {
  release: { build: manifest.release.build, sourceCommit: manifest.release.sourceCommit, brandSha256: manifest.release.brandSha256 },
  generatedAt: new Date().toISOString(),
  assets: manifest.assets.map(({ path, kind, device, lang, title, sha256, poster }) => ({ path, kind, device, lang, title, sha256, ...(poster ? { poster } : {}) })),
};
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(delivery, null, 2) + '\n');
const ordered = [...files].sort();
const archive = resolve(output, `../Lift-App-Store-build${manifest.release.build}-FR-EN.zip`);
// -FS removes stale archive members; the input list includes only verified assets.
execFileSync('zip', ['-0', '-X', '-q', '-FS', archive, '-@'], { cwd: output, input: ordered.join('\n') + '\n' });
const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort();
assert.deepEqual(entries, ordered);
console.log(`Archive: ${archive}\nSHA256: ${await hash(archive)}\n58 reviewed media assets, ${ordered.length} total files including gallery, posters and manifest.`);
