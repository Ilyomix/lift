import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseReady } from './release-source.mjs';

// QA is explicit: rendering records bytes, never visual approval or Apple receipt.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../.local-release/marketing');
const manifestPath = resolve(output, 'upload-ready.json');
const [state, ...paths] = process.argv.slice(2);
assert(['rendered', 'qa-approved', 'uploaded'].includes(state) && paths.length, 'Usage: media-state.mjs rendered|qa-approved|uploaded relative/path ...');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const requirements = JSON.parse(await readFile(resolve(project, 'source-requirements.json'), 'utf8'));
assertReleaseReady(requirements);
assert.equal(manifest.release.build, requirements.requiredBuild);
assert.equal(manifest.release.sourceCommit, requirements.sourceCommit);
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const brandSha256 = await hash(resolve(project, 'public/brand/icon.png'));
assert.equal(brandSha256, manifest.release.brandSha256, 'Brand changed: start a new release manifest before rendering');
for (const path of paths) {
  assert(!path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'));
  const previous = [...manifest.pending, ...manifest.assets].find(asset => asset.path === path);
  assert(previous, `Unknown campaign asset: ${path}`);
  const sha256 = await hash(resolve(output, path));
  let entry;
  if (state === 'rendered') {
    entry = { ...previous, state, sourceBuild: requirements.requiredBuild, sourceCommit: requirements.sourceCommit, brandSha256, sha256, renderedAt: new Date().toISOString(), reviewed: false };
    delete entry.upload;
    delete entry.reason;
    if (entry.kind === 'preview') {
      const poster = path.replace(/\.mp4$/, '.poster.png');
      entry.poster = { path: poster, sha256: await hash(resolve(output, poster)) };
    }
  } else {
    assert.equal(previous.sha256, sha256, `${path}: changed since rendering or review`);
    assert.equal(previous.sourceBuild, requirements.requiredBuild);
    assert.equal(previous.sourceCommit, requirements.sourceCommit);
    assert.equal(previous.brandSha256, brandSha256);
    if (previous.poster) assert.equal(previous.poster.sha256, await hash(resolve(output, previous.poster.path)));
    if (state === 'qa-approved') {
      assert.equal(previous.state, 'rendered', `${path}: record rendering first`);
      entry = { ...previous, state, reviewed: true, reviewedAt: new Date().toISOString() };
    } else {
      assert(['qa-approved', 'uploaded'].includes(previous.state) && previous.reviewed === true);
      assert.notEqual(previous.kind, 'promo', 'Social promos are not App Store uploads');
      const proof = process.env.LIFT_UPLOAD_PROOF;
      assert(proof && !proof.startsWith('/') && !proof.split('/').includes('..'), 'LIFT_UPLOAD_PROOF must identify the local Apple receipt evidence');
      await readFile(resolve(project, '../..', proof));
      const position = previous.kind === 'screenshot' ? Number(path.split('/').at(-1).slice(0, 2)) : ['workout', 'plan', 'live'].indexOf(path.split('/').at(-1).replace('.mp4', '')) + 1;
      entry = { ...previous, state, upload: { destination: 'app-store-connect', status: 'uploaded', received: true, position, confirmedAt: new Date().toISOString(), proof } };
    }
  }
  manifest.pending = manifest.pending.filter(asset => asset.path !== path);
  manifest.assets = manifest.assets.filter(asset => asset.path !== path);
  manifest[state === 'rendered' ? 'pending' : 'assets'].push(entry);
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${state}: ${paths.join(', ')}`);
