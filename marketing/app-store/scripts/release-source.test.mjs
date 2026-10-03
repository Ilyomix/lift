import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseReady, assertCutProvenance } from './release-source.mjs';
const ready = { status: 'ready', requiredBuild: '7', sourceCommit: '1234abc', captureNotBefore: '2026-10-03T12:00:00Z', brandSha256: 'a'.repeat(64) };
test('planned native releases cannot import or render old captures', () => {
  assert.throws(() => assertReleaseReady({ ...ready, status: 'awaiting-native-build' }), /not finalized/);
  assert.throws(() => assertReleaseReady({ ...ready, sourceCommit: null }), /source commit/);
  assert.throws(() => assertReleaseReady({ ...ready, captureNotBefore: null }), /capture cutoff/);
  assert.throws(() => assertReleaseReady({ ...ready, brandSha256: 'old' }), /brand hash/);
  assert.doesNotThrow(() => assertReleaseReady(ready));
});

test('native cuts are tied to the exact new raw files and release', () => {
  const hashes = { 'iphone-preview-workout-fr.mp4': 'b'.repeat(64), 'iphone-technique-fr.mp4': 'c'.repeat(64) };
  const cut = { sourceBuild: ready.requiredBuild, sourceCommit: ready.sourceCommit, sourceHashes: hashes };
  assert.doesNotThrow(() => assertCutProvenance(cut, ready, hashes));
  assert.throws(() => assertCutProvenance({ ...cut, sourceBuild: '6' }, ready, hashes), /another native build/);
  assert.throws(() => assertCutProvenance({ ...cut, sourceCommit: 'abc1234' }, ready, hashes), /another release commit/);
  assert.throws(() => assertCutProvenance({ ...cut, sourceHashes: {} }, ready, hashes), /every raw take/);
  assert.throws(() => assertCutProvenance(cut, ready, { ...hashes, 'iphone-preview-workout-fr.mp4': 'd'.repeat(64) }), /different footage/);
});
