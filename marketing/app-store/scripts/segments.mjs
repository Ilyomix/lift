import assert from 'node:assert/strict';

/** Seconds on the untouched source recording. Export timeline is exactly 600 frames. */
export function validateSegments(cut, sourceDuration) {
  assert.equal(cut.fps, 30, 'Cut list must use the composition rate of 30 fps');
  assert(Array.isArray(cut.segments) && cut.segments.length > 0, 'Cut list needs segments');
  let total = 0;
  let previousEnd = 0;
  for (const segment of cut.segments) {
    assert(Number.isFinite(segment.start) && segment.start >= 0, 'Segment start must be nonnegative seconds');
    assert(Number.isFinite(segment.duration) && segment.duration > 0, 'Segment duration must be positive seconds');
    const startFrame = Math.round(segment.start * 30);
    const frames = Math.round(segment.duration * 30);
    assert(Math.abs(segment.start * 30 - startFrame) < 0.001 && Math.abs(segment.duration * 30 - frames) < 0.001, 'Timecodes must align to 30 fps frames');
    assert(startFrame >= previousEnd, 'Segments must preserve chronology without repeating footage');
    assert((startFrame + frames) / 30 <= sourceDuration + 0.001, 'Segment exceeds recorded footage');
    previousEnd = startFrame + frames;
    total += frames;
  }
  assert.equal(total, 600, 'Segments must total exactly 20 seconds / 600 frames');
  return cut.segments;
}

export const uncut = { fps: 30, segments: [{ start: 0, duration: 20 }] };
