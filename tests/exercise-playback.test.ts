import assert from 'node:assert/strict'
import test from 'node:test'
import { exercisePhase, exerciseTempo } from '../src/lib/exercisePlayback'

test('repetitions keep moving between reversals instead of holding frozen endpoint frames', () => {
  for (const id of ['seated-db-curl', 'lat-pulldown', 'leg-press', 'romanian-deadlift', 'nordic-curl']) {
    const { outward, returning } = exerciseTempo(id)
    assert.equal(exercisePhase(id, 0), 0)
    assert.equal(exercisePhase(id, outward), 1)
    assert.equal(exercisePhase(id, outward + returning), 0)
    for (let frame = 1; frame <= 120; frame++) {
      const prior = (frame - 1) / 120, current = frame / 120
      assert(exercisePhase(id, outward * current) > exercisePhase(id, outward * prior), `${id}: frozen outward phase`)
      assert(exercisePhase(id, outward + returning * current) < exercisePhase(id, outward + returning * prior), `${id}: frozen return phase`)
    }
    for (const time of [.4, 1.1, 2.7, 4]) {
      assert(Math.abs(exercisePhase(id, time) - exercisePhase(id, time + 9 * (outward + returning))) < 1e-10, `${id}: loop drift`)
    }
  }
})

test('turnarounds and loop joins have continuous velocity and acceleration', () => {
  const h = .0001
  for (const id of ['lat-pulldown', 'romanian-deadlift', 'nordic-curl']) {
    const { outward, returning } = exerciseTempo(id), duration = outward + returning
    const phase = (t: number) => exercisePhase(id, t + duration * 3)
    for (const time of [0, outward, duration]) {
      const before = (phase(time) - phase(time - h)) / h
      const after = (phase(time + h) - phase(time)) / h
      const accelerationBefore = (phase(time) - 2 * phase(time - h) + phase(time - 2 * h)) / h ** 2
      const accelerationAfter = (phase(time + 2 * h) - 2 * phase(time + h) + phase(time)) / h ** 2
      assert(Math.abs(before) < 1e-5 && Math.abs(after) < 1e-5, `${id}: velocity snaps at ${time}`)
      assert(Math.abs(accelerationBefore) < .002 && Math.abs(accelerationAfter) < .002, `${id}: acceleration snaps at ${time}`)
    }
  }
})

test('controlled descent follows the clip direction, not a fixed half-cycle', () => {
  for (const id of ['leg-press', 'goblet-squat', 'smith-squat', 'hack-squat', 'bulgarian-split-squat', 'sissy-squat', 'romanian-deadlift', 'db-romanian-deadlift', 'single-leg-rdl', 'nordic-curl']) {
    const tempo = exerciseTempo(id)
    assert(tempo.outward > tempo.returning, `${id}: descent should be the slower leg`)
  }
  for (const id of ['lat-pulldown', 'seated-db-curl', 'hip-thrust', 'push-up']) {
    const tempo = exerciseTempo(id)
    assert(tempo.returning > tempo.outward, `${id}: lowering should be the slower return leg`)
  }
  for (const time of [NaN, Infinity, -1]) assert.equal(exercisePhase('lat-pulldown', time), 0)
})
