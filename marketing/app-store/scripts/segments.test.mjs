import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSegments} from './segments.mjs';

const cut = segments => ({fps:30,segments});
test('accepts chronological cuts across two native takes', () => {
  const segments = [{start:2,duration:8},{source:'ipad-preview-plan-detail-en.mp4',start:1,duration:12}];
  assert.equal(validateSegments(cut(segments),30,{'ipad-preview-plan-detail-en.mp4':20}),segments);
});
test('rejects repeated footage when returning to an earlier take', () => {
  assert.throws(()=>validateSegments(cut([{start:2,duration:8},{source:'extra.mp4',start:1,duration:8},{start:3,duration:4}]),30,{'extra.mp4':20}),/chronology/);
});
test('rejects an absent or too-short extra take', () => {
  const value=cut([{start:0,duration:8},{source:'extra.mp4',start:10,duration:12}]);
  assert.throws(()=>validateSegments(value,30),/missing/);
  assert.throws(()=>validateSegments(value,30,{'extra.mp4':20}),/exceeds/);
});
test('rejects paths outside recordings and non-frame timecodes', () => {
  assert.throws(()=>validateSegments(cut([{source:'../extra.mp4',start:0,duration:20}]),30,{'../extra.mp4':30}),/filenames/);
  assert.throws(()=>validateSegments(cut([{start:.01,duration:20}]),30),/align/);
});
