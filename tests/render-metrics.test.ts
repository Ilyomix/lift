import assert from 'node:assert/strict'
import test from 'node:test'
import { RenderMetrics } from '../src/lib/renderMetrics'

test('QA cadence counts intervals and excludes only explicit lifecycle resets', () => {
  const reports: Record<string, any>[] = []
  const original = console.info
  console.info = (marker, json) => {
    assert.equal(marker, 'LIFT_RENDER_METRICS')
    reports.push(JSON.parse(json))
  }
  try {
    const metrics = new RenderMetrics('exercise')
    for (let i = 0; i <= 750; i++) metrics.frame(1000 + i * 20, 2, 800, 600)
    assert.equal(reports.length, 1)
    assert.equal(reports[0].submittedFps, 50)
    assert.equal(reports[0].submittedFrames, 751)
    assert.equal(reports[0].frameIntervalMs.p99, 20)
    assert.equal(reports[0].submitCpuMs.mean, 2)

    metrics.frame(17000, 2, 800, 600)
    metrics.reset() // The app was backgrounded; this gap must not enter a window.
    metrics.frame(50000, 2, 800, 600)
    for (let i = 1; i <= 746; i++) metrics.frame(50080 + i * 20, 2, 800, 600)
    assert.equal(reports.length, 2)
    assert.equal(reports[1].frameIntervalMs.max, 100) // Visible stall remains counted.
    assert.equal(reports[1].submittedFps, 49.73)
  } finally {
    console.info = original
  }
})
