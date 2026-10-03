/** Local QA only. Call sites are removed unless VITE_LIFT_RENDER_METRICS=1.
 * Measures submitted frames, not GPU completion or display presentation.
 * No exercise, profile, workout, or other user data enters this report.
 */
export class RenderMetrics {
  private started = 0
  private previous = 0
  private signature = ''
  private intervals: number[] = []
  private cpu: number[] = []

  constructor(private surface: 'sport-atlas' | 'exercise') {}

  reset() {
    this.started = 0
    this.previous = 0
    this.signature = ''
    this.intervals = []
    this.cpu = []
  }

  frame(completedAt: number, cpuMs: number, width: number, height: number, renderCalls = 1) {
    const signature = `${width}:${height}:${renderCalls}`
    if (this.signature !== signature) this.reset()
    this.signature = signature
    if (!this.started) this.started = completedAt
    if (this.previous) this.intervals.push(completedAt - this.previous)
    this.previous = completedAt
    this.cpu.push(cpuMs)
    const durationMs = completedAt - this.started
    if (durationMs < 15_000) return
    const rounded = (n: number) => Math.round(n * 100) / 100
    const stats = (samples: number[]) => {
      const sorted = [...samples].sort((a, b) => a - b)
      const percentile = (fraction: number) => rounded(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)])
      return {
        mean: rounded(samples.reduce((sum, value) => sum + value, 0) / samples.length),
        p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99),
        max: rounded(sorted[sorted.length - 1]),
      }
    }
    console.info('LIFT_RENDER_METRICS', JSON.stringify({
      surface: this.surface,
      durationMs: rounded(durationMs),
      submittedFrames: this.cpu.length,
      submittedFps: rounded(this.intervals.length * 1000 / durationMs),
      frameIntervalMs: stats(this.intervals),
      submitCpuMs: stats(this.cpu),
      width, height, renderCallsPerFrame: renderCalls,
    }))
    this.reset()
  }
}
