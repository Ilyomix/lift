import { App } from '@capacitor/app'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import {
  ACESFilmicToneMapping, AnimationMixer, DirectionalLight, HemisphereLight,
  Mesh, MeshStandardMaterial, PMREMGenerator, Scene, WebGLRenderer,
  type Camera, type Material, type WebGLRenderTarget,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { SportArtKind } from '../components/SportArt'
import { RenderMetrics } from './renderMetrics'
import { createSportMotion, frameSportMotion, type SportMotion } from './sportModelMotion'

type Model = { scene: Scene; camera: Camera; mixer: AnimationMixer; materials: Set<Material>; motion: SportMotion }
type Slot = {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  model?: Model
  visible: boolean
  dirty: boolean
  ready: () => void
}

// One small GPU atlas for all illustrations, including menus. Render every tile
// before copying to DOM canvases: one GPU readback, with normal layout/clipping.
// https://threejs.org/manual/pages/multiple-scenes.html
class SportRenderer {
  private renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  private environment: WebGLRenderTarget
  private slots = new Set<Slot>()
  private models = new Map<SportArtKind, Promise<Model>>()
  private motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  private themeObserver = new MutationObserver(() => this.updateTheme())
  private nativeListener?: PluginListenerHandle
  private nativeActive = true
  private frame = 0
  private previousFrame = 0
  private frameBudget = 0
  private measuredFrames = 0
  private measurementStart = 0
  private metrics = import.meta.env.VITE_LIFT_RENDER_METRICS === '1' ? new RenderMetrics('sport-atlas') : undefined
  private elapsed = 0
  private activeSince = new Map<Model, number>()
  private lost = false
  private disposed = false
  private releaseTimer?: ReturnType<typeof setTimeout>

  constructor() {
    this.renderer.setSize(128, 128, false)
    this.renderer.autoClear = false
    this.renderer.setClearColor(0, 0)
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.95
    const room = new RoomEnvironment()
    const pmrem = new PMREMGenerator(this.renderer)
    this.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    room.dispose()
    pmrem.dispose()
    document.addEventListener('visibilitychange', this.refresh)
    this.motion.addEventListener('change', this.refresh)
    this.systemTheme.addEventListener('change', this.updateTheme)
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] })
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost)
    this.renderer.domElement.addEventListener('webglcontextrestored', this.contextRestored)
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        this.nativeActive = isActive
        this.refresh()
      }).then(listener => {
        if (this.disposed) void listener.remove()
        else this.nativeListener = listener
      }).catch(() => { /* Page visibility remains available on unsupported hosts. */ })
    }
  }

  private styleMaterials(model: Model) {
    const root = document.documentElement
    const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && this.systemTheme.matches)
    const style = getComputedStyle(root)
    const accent = style.getPropertyValue(dark ? '--accent-bright' : '--accent').trim() || '#ff7b00'
    const colors: Record<string, string> = {
      LiftGraphite: dark ? '#252a32' : '#1b1e23',
      LiftCobalt: accent,
      LiftSilver: dark ? '#d6dde6' : '#c7ccd2',
      LiftInk: dark ? '#0c1018' : '#101620',
    }
    for (const material of model.materials) {
      if (material instanceof MeshStandardMaterial && colors[material.name]) material.color.set(colors[material.name])
    }
  }

  private updateTheme = () => {
    const models = new Set([...this.slots].flatMap(slot => slot.model ? [slot.model] : []))
    for (const model of models) this.styleMaterials(model)
    this.refresh()
  }

  private load(kind: SportArtKind) {
    let pending = this.models.get(kind)
    if (!pending) {
      pending = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/sport/${kind}.glb`).then(gltf => {
        const scene = new Scene()
        const materials = new Set<Material>()
        scene.add(gltf.scene)
        gltf.scene.traverse(object => {
          if (object instanceof Mesh) for (const material of [object.material].flat()) materials.add(material)
        })
        const camera = gltf.cameras[0]
        const mixer = new AnimationMixer(gltf.scene)
        for (const clip of gltf.animations) mixer.clipAction(clip).play()
        mixer.setTime(0)
        const motion = createSportMotion(kind, gltf.scene, mixer)
        const model = { scene, camera, mixer, materials, motion }
        if (this.disposed || !camera) {
          this.disposeModel(model)
          throw new Error('Unavailable illustration')
        }
        frameSportMotion(kind, gltf.scene, camera, motion)
        scene.environment = this.environment.texture
        scene.environmentIntensity = 1
        scene.add(new HemisphereLight(0xffffff, 0x64748b, 0.65))
        const key = new DirectionalLight(0xffffff, 2.5)
        key.position.set(-3, 5, 4)
        scene.add(key)
        this.styleMaterials(model)
        return model
      }).catch(error => {
        // A later mount can recover from a transient fetch failure.
        if (this.models.get(kind) === pending) this.models.delete(kind)
        throw error
      })
      this.models.set(kind, pending)
    }
    return pending
  }

  register(canvas: HTMLCanvasElement, kind: SportArtKind, ready: () => void) {
    clearTimeout(this.releaseTimer)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    const slot: Slot = { canvas, context, visible: false, dirty: true, ready }
    this.slots.add(slot)
    void this.load(kind).then(model => {
      if (this.disposed || !this.slots.has(slot)) return
      slot.model = model
      this.styleMaterials(model)
      if (slot.visible) this.activeSince.delete(model)
      this.schedule()
    }).catch(() => { /* Keep the static, theme-colored fallback. */ })
    return {
      setVisible: (visible: boolean) => {
        if (slot.visible === visible) return
        slot.visible = visible
        slot.dirty = true
        // A newly visible instance must not inherit another instance's long
        // idle phase merely because both use the same cached GLB/atlas tile.
        if (visible && slot.model) this.activeSince.delete(slot.model)
        this.refresh()
      },
      dispose: () => {
        this.slots.delete(slot)
        this.refresh()
        // Route changes briefly unmount the old screen before mounting the new one.
        if (!this.slots.size) this.releaseTimer = setTimeout(() => this.dispose(), 250)
      },
    }
  }

  private canDraw() {
    return !this.disposed && !this.lost && !document.hidden && this.nativeActive
  }

  private needsFrame() {
    return this.canDraw() && [...this.slots].some(slot => slot.visible && slot.model && (slot.dirty || (!this.motion.matches && slot.model.motion.animated)))
  }

  private schedule() {
    if (!this.frame && this.needsFrame()) this.frame = requestAnimationFrame(this.draw)
  }

  private refresh = () => {
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.previousFrame = 0
    this.frameBudget = 0
    this.measurementStart = 0
    this.measuredFrames = 0
    this.metrics?.reset()
    const visible = new Set([...this.slots].flatMap(slot => slot.visible && slot.model ? [slot.model] : []))
    for (const model of this.activeSince.keys()) if (!visible.has(model) || this.motion.matches) this.activeSince.delete(model)
    for (const slot of this.slots) slot.dirty = true
    this.schedule()
  }

  private draw = (now: number) => {
    this.frame = 0
    if (!this.canDraw()) return
    const interval = 1000 / 60
    const delta = this.previousFrame ? now - this.previousFrame : interval
    this.previousFrame = now
    this.frameBudget += delta
    if (!this.motion.matches) this.elapsed += Math.min(delta, 100) / 1000
    if (this.frameBudget >= interval - 0.1) {
      this.frameBudget = Math.max(0, this.frameBudget - interval) % interval
      const visible = new Map<Model, Slot[]>()
      for (const slot of this.slots) {
        if (!slot.visible || !slot.model || (this.motion.matches && !slot.dirty)) continue
        const instances = visible.get(slot.model) ?? []
        instances.push(slot)
        visible.set(slot.model, instances)
      }
      const tiles = [...visible].filter(([model, slots]) => {
        // Start the gesture when its object enters view, not halfway through
        // a global loop left running by another screen's illustrations.
        if (!this.activeSince.has(model)) this.activeSince.set(model, this.elapsed)
        const changed = model.motion.update(this.motion.matches ? 0 : this.elapsed - this.activeSince.get(model)!)
        return changed || slots.some(slot => slot.dirty)
      })
      if (!tiles.length) { this.schedule(); return }
      const tileSize = 128
      const columns = Math.ceil(Math.sqrt(tiles.length)) || 1
      const rows = Math.ceil(tiles.length / columns) || 1
      const width = columns * tileSize, height = rows * tileSize
      const renderStarted = this.metrics ? performance.now() : 0
      try {
        if (this.renderer.domElement.width !== width || this.renderer.domElement.height !== height) this.renderer.setSize(width, height, false)
        this.renderer.setScissorTest(false)
        this.renderer.clear()
        this.renderer.setScissorTest(true)
        for (let i = 0; i < tiles.length; i++) {
          const [model] = tiles[i]
          const x = (i % columns) * tileSize, y = Math.floor(i / columns) * tileSize
          this.renderer.setViewport(x, y, tileSize, tileSize)
          this.renderer.setScissor(x, y, tileSize, tileSize)
          this.renderer.render(model.scene, model.camera)
        }
        this.renderer.setScissorTest(false)
        for (let i = 0; i < tiles.length; i++) {
          const [, instances] = tiles[i]
          const x = (i % columns) * tileSize, y = height - (Math.floor(i / columns) + 1) * tileSize
          for (const slot of instances) {
            const { canvas, context } = slot
            context.clearRect(0, 0, canvas.width, canvas.height)
            context.drawImage(this.renderer.domElement, x, y, tileSize, tileSize, 0, 0, canvas.width, canvas.height)
            slot.dirty = false
            slot.ready()
            slot.ready = () => {}
          }
        }
        if (this.metrics && tiles.length && !this.motion.matches) {
          const completedAt = performance.now()
          this.metrics.frame(completedAt, completedAt - renderStarted, width, height, tiles.length)
        }
      } catch {
        // A GPU failure must never interrupt logging a workout.
        this.lost = true
      }
      if (import.meta.env.DEV && visible.size) {
        this.measuredFrames++
        this.measurementStart ||= now
        if (now - this.measurementStart >= 1000) {
          const fps = Math.round(this.measuredFrames * 1000 / (now - this.measurementStart))
          for (const instances of visible.values()) for (const slot of instances) slot.canvas.dataset.renderFps = String(fps)
          this.measurementStart = now
          this.measuredFrames = 0
        }
      }
    }
    this.schedule()
  }

  private contextLost = (event: Event) => {
    event.preventDefault()
    this.lost = true
    this.refresh()
  }

  private contextRestored = () => {
    this.lost = false
    const room = new RoomEnvironment()
    const pmrem = new PMREMGenerator(this.renderer)
    this.environment.dispose()
    this.environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 128 })
    room.dispose()
    pmrem.dispose()
    for (const pending of this.models.values()) void pending.then(model => {
      if (!this.disposed) model.scene.environment = this.environment.texture
    }).catch(() => {})
    this.refresh()
  }

  private disposeModel(model: Model) {
    model.mixer.stopAllAction()
    model.mixer.uncacheRoot(model.mixer.getRoot())
    const geometries = new Set<import('three').BufferGeometry>()
    model.scene.traverse(object => { if (object instanceof Mesh) geometries.add(object.geometry) })
    for (const geometry of geometries) geometry.dispose()
    for (const material of model.materials) material.dispose()
  }

  private dispose() {
    if (this.slots.size || this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    document.removeEventListener('visibilitychange', this.refresh)
    this.motion.removeEventListener('change', this.refresh)
    this.systemTheme.removeEventListener('change', this.updateTheme)
    this.themeObserver.disconnect()
    void this.nativeListener?.remove()
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost)
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.contextRestored)
    for (const pending of this.models.values()) void pending.then(model => this.disposeModel(model)).catch(() => {})
    this.models.clear()
    this.environment.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    if (shared === this) shared = undefined
  }
}

let shared: SportRenderer | undefined

export function mountSportModel(canvas: HTMLCanvasElement, kind: SportArtKind, ready: () => void) {
  shared ??= new SportRenderer()
  return shared.register(canvas, kind, ready)
}
