import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { ACESFilmicToneMapping, WebGLRenderer } from 'three'
import { createExerciseModel, type ExerciseOrbit, type ExerciseView } from './exerciseModels'
import { ANIMATED_EXERCISES } from './exerciseModelCatalog'
import type { MuscleWeights } from './exerciseModelRig'
import { RenderMetrics } from './renderMetrics'

type Model = Awaited<ReturnType<typeof createExerciseModel>>
type Slot = {
  canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; model?: Model
  visible: boolean; playing: boolean; animated: boolean; dirty: boolean
  elapsed: number; view: ExerciseView; orbit: ExerciseOrbit; ready: () => void; failed: () => void; notified: boolean
}

/** One exercise GPU context, regardless of a detail screen and sheet being mounted together. */
class ExerciseRenderer {
  private renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  private slots = new Set<Slot>()
  private motion = matchMedia('(prefers-reduced-motion: reduce)')
  private systemTheme = matchMedia('(prefers-color-scheme: dark)')
  private observer = new MutationObserver(() => this.themeChanged())
  private listener?: PluginListenerHandle
  private active = true
  private lost = false
  private disposed = false
  private frame = 0
  private previous = 0
  private budget = 0
  private release?: ReturnType<typeof setTimeout>
  private foreground?: Slot
  private sampleStart = 0
  private sampleFrames = 0
  private sampleCPU = 0
  private metrics = import.meta.env.VITE_LIFT_RENDER_METRICS === '1' ? new RenderMetrics('exercise') : undefined

  constructor() {
    this.renderer.setClearColor(0, 0)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    document.addEventListener('visibilitychange', this.refresh)
    this.motion.addEventListener('change', this.refresh)
    this.systemTheme.addEventListener('change', this.themeChanged)
    this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost)
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored)
    if (Capacitor.isNativePlatform()) void App.addListener('appStateChange', ({ isActive }) => {
      this.active = isActive
      this.refresh()
    }).then(listener => {
      if (this.disposed) void listener.remove()
      else this.listener = listener
    }).catch(() => { /* Document visibility still prevents background animation. */ })
  }

  private themeChanged = () => {
    const root = document.documentElement
    const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && this.systemTheme.matches)
    const accent = getComputedStyle(root).getPropertyValue(dark ? '--accent-bright' : '--accent').trim() || '#3068f5'
    for (const slot of this.slots) slot.model?.style(accent, dark)
    this.refresh()
  }

  private canDraw() { return !this.disposed && !this.lost && this.active && !document.hidden }
  private animated(slot: Slot) {
    return slot.visible && !!slot.model && slot.animated && slot.playing && slot.view === 'technique' && !this.motion.matches
  }
  private schedule() {
    const visible = [...this.slots].filter(slot => slot.visible)
    const foreground = visible.at(-1)
    if (!this.frame && this.canDraw() && foreground?.model && (foreground.dirty || this.animated(foreground))) {
      this.frame = requestAnimationFrame(this.draw)
    }
  }
  private refresh = () => {
    cancelAnimationFrame(this.frame)
    this.frame = 0; this.previous = 0; this.budget = 0
    this.sampleStart = 0; this.sampleFrames = 0; this.sampleCPU = 0
    this.metrics?.reset()
    for (const slot of this.slots) slot.dirty = true
    this.schedule()
  }
  private draw = (now: number) => {
    this.frame = 0
    if (!this.canDraw()) return
    const delta = this.previous ? Math.min(now - this.previous, 50) : 1000 / 60
    this.previous = now
    this.budget += delta
    const visible = [...this.slots].filter(slot => slot.visible)
    // A newly opened sheet takes priority over the exercise page beneath it.
    const foreground = visible.at(-1)
    if (foreground !== this.foreground) {
      this.metrics?.reset()
      // Snapshot only when a sheet replaces the previous view. The active
      // demonstration is direct WebGL: no large GPU→2D copy every frame.
      if (this.foreground) {
        const previous = this.foreground
        if (previous.model) {
          // The default WebGL drawing buffer is cleared after composition.
          // Render immediately before the occasional snapshot, in this callback.
          this.renderer.setSize(previous.canvas.width, previous.canvas.height, false)
          this.renderer.render(previous.model.scene, previous.model.camera)
          previous.context.clearRect(0, 0, previous.canvas.width, previous.canvas.height)
          previous.context.drawImage(this.renderer.domElement, 0, 0, previous.canvas.width, previous.canvas.height)
        }
      }
      this.foreground = foreground
      if (foreground) {
        foreground.canvas.after(this.renderer.domElement)
        foreground.dirty = true
      } else this.renderer.domElement.remove()
    }
    if (foreground && this.animated(foreground)) foreground.elapsed += delta / 1000
    if (this.budget >= 1000 / 60 - 0.25) {
      // Tolerance must not preserve a nearly full interval and draw twice.
      this.budget = Math.max(0, this.budget - 1000 / 60)
      if (this.budget > 1000 / 60) this.budget = 0
      for (const slot of visible) {
        if (slot !== foreground || !slot.model || (!slot.dirty && !this.animated(slot))) continue
        const { canvas, model } = slot
        const renderStarted = import.meta.env.DEV || this.metrics ? performance.now() : 0
        model.setView(slot.view, canvas.width / canvas.height, slot.orbit)
        model.pose(slot.elapsed)
        if (this.renderer.domElement.width !== canvas.width || this.renderer.domElement.height !== canvas.height) this.renderer.setSize(canvas.width, canvas.height, false)
        try {
          this.renderer.render(model.scene, model.camera)
          if (this.metrics && this.animated(slot)) {
            const completedAt = performance.now()
            this.metrics.frame(completedAt, completedAt - renderStarted, canvas.width, canvas.height)
          }
          if (import.meta.env.DEV) {
            canvas.dataset.modelState = 'rendered'
            this.renderer.domElement.dataset.animationState = this.animated(slot) ? 'playing' : 'static'
            this.sampleStart ||= now
            this.sampleFrames++
            this.sampleCPU += performance.now() - renderStarted
            if (now - this.sampleStart >= 1000) {
              this.renderer.domElement.dataset.renderFps = (this.sampleFrames * 1000 / (now - this.sampleStart)).toFixed(1)
              this.renderer.domElement.dataset.renderCpuMs = (this.sampleCPU / this.sampleFrames).toFixed(2)
              this.sampleStart = now; this.sampleFrames = 0; this.sampleCPU = 0
            }
          }
          slot.dirty = false
          if (!slot.notified) { slot.ready(); slot.notified = true }
        } catch (error) {
          if (import.meta.env.DEV) console.error('Exercise renderer failed', error)
          this.lost = true
          slot.notified = false
          slot.failed()
          break
        }
      }
    }
    this.schedule()
  }
  private contextLost = (event: Event) => {
    event.preventDefault(); this.lost = true
    for (const slot of this.slots) { slot.notified = false; slot.failed() }
    this.refresh()
  }
  private contextRestored = () => { this.lost = false; this.refresh() }

  mount(canvas: HTMLCanvasElement, id: string, weights: MuscleWeights, ready: () => void, failed: () => void) {
    clearTimeout(this.release)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    const slot: Slot = {
      canvas, context, visible: false, playing: true,
      animated: ANIMATED_EXERCISES.has(id), dirty: true, elapsed: 0,
      view: ANIMATED_EXERCISES.has(id) ? 'technique' : 'front', orbit: { yaw: 0, pitch: 0 }, ready, failed, notified: false,
    }
    if (import.meta.env.DEV) canvas.dataset.modelState = 'loading'
    this.slots.add(slot)
    void createExerciseModel(id, weights).then(model => {
      if (this.disposed || !this.slots.has(slot)) { model.dispose(); return }
      slot.model = model
      slot.animated = model.animated
      if (import.meta.env.DEV) canvas.dataset.modelState = 'loaded'
      this.themeChanged()
    }).catch(error => {
      if (import.meta.env.DEV) { console.error('Exercise model failed', error); canvas.dataset.modelState = 'error' }
      if (!this.disposed && this.slots.has(slot)) failed()
    })
    this.themeChanged()
    return {
      update: (options: { visible?: boolean; playing?: boolean; view?: ExerciseView; orbit?: ExerciseOrbit; width?: number }) => {
        if ((options.visible !== undefined && options.visible !== slot.visible)
          || (options.playing !== undefined && options.playing !== slot.playing)
          || (options.view !== undefined && options.view !== slot.view)) this.metrics?.reset()
        if (options.visible !== undefined) slot.visible = options.visible
        if (options.playing !== undefined) slot.playing = options.playing
        if (options.view !== undefined) slot.view = options.view
        if (options.orbit !== undefined) slot.orbit = { ...options.orbit }
        if (options.width !== undefined) {
          // At most 900 × 675 pixels: bounded fill rate on high-DPI phones.
          const width = Math.max(320, Math.min(900, Math.round(options.width * Math.min(devicePixelRatio, 2))))
          if (width !== canvas.width) { canvas.width = width; canvas.height = Math.round(width * 3 / 4) }
        }
        slot.dirty = true
        this.schedule()
      },
      dispose: () => {
        if (this.foreground === slot) {
          this.foreground = undefined
          this.renderer.domElement.remove()
        }
        this.slots.delete(slot)
        slot.model?.dispose()
        this.refresh()
        if (!this.slots.size) this.release = setTimeout(() => this.dispose(), 250)
      },
    }
  }

  private dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    document.removeEventListener('visibilitychange', this.refresh)
    this.motion.removeEventListener('change', this.refresh)
    this.systemTheme.removeEventListener('change', this.themeChanged)
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost)
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored)
    void this.listener?.remove()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.renderer.forceContextLoss()
    if (shared === this) shared = undefined
  }
}

let shared: ExerciseRenderer | undefined
export function mountExerciseModel(canvas: HTMLCanvasElement, id: string, weights: MuscleWeights, ready: () => void, failed: () => void) {
  shared ??= new ExerciseRenderer()
  return shared.mount(canvas, id, weights, ready, failed)
}
