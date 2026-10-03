import assert from 'node:assert/strict';

/** A planned build number alone never authorizes importing or rendering old media. */
export function assertReleaseReady(requirements) {
  assert.equal(requirements.status, 'ready', 'Native release is not finalized: wait for its exact commit and capture handoff');
  assert(/^\d+$/.test(requirements.requiredBuild), 'Missing native build number');
  assert(/^[0-9a-f]{7,40}$/.test(requirements.sourceCommit ?? ''), 'Missing exact release source commit');
  assert(Number.isFinite(Date.parse(requirements.captureNotBefore)), 'Missing native capture cutoff');
  assert(/^[0-9a-f]{64}$/.test(requirements.brandSha256 ?? ''), 'Missing release brand hash');
}

/** Timecodes must be authored for these raw takes, not inherited by filename. */
export function assertCutProvenance(cut, requirements, sourceHashes) {
  assert.equal(cut.sourceBuild, requirements.requiredBuild, 'Cut belongs to another native build');
  assert.equal(cut.sourceCommit, requirements.sourceCommit, 'Cut belongs to another release commit');
  assert.deepEqual(Object.keys(cut.sourceHashes ?? {}).sort(), Object.keys(sourceHashes).sort(), 'Cut must identify every raw take');
  for (const [name, sha256] of Object.entries(sourceHashes)) {
    assert.equal(cut.sourceHashes[name], sha256, `${name}: timecodes belong to different footage`);
  }
}
