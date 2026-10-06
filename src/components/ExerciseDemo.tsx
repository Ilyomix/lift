import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Hand, MousePointer2, Pause, Play, RotateCcw } from 'lucide-react'
import { L } from '../lib/i18n'
import { ANIMATED_EXERCISES, anatomicalLabel, exerciseMuscles, type AnatomicalRegion } from '../lib/exerciseModelCatalog'
import type { ExerciseOrbit, ExerciseView } from '../lib/exerciseModels'
import type { mountExerciseModel } from '../lib/exerciseModelRenderer'
import { bindTwoFingerRotation } from '../lib/exerciseTouch'
import { Button, IconButton, Segmented } from './ui'

type ModelHandle = ReturnType<typeof mountExerciseModel>

export function ExerciseDemo({ id, name, className, compact = false }: { id: string; name: string; className?: string; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<ModelHandle | null>(null)
  const orbit = useRef<ExerciseOrbit>({ yaw: 0, pitch: 0 })
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const instructions = useId()
  const [rotated, setRotated] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [reduced, setReduced] = useState(false)
  const animated = ANIMATED_EXERCISES.has(id)
  const [view, setView] = useState<ExerciseView>(animated ? 'technique' : 'front')
  const regions = Object.entries(exerciseMuscles(id)) as [AnatomicalRegion, number][]
  const direct = regions.filter(([, weight]) => weight >= 1).map(([region]) => anatomicalLabel(region))
  const secondary = regions.filter(([, weight]) => weight > 0 && weight < 1).map(([region]) => anatomicalLabel(region))

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    if (import.meta.env.DEV) element.dataset.modelState = 'waiting-for-visibility'
    let disposed = false, visible = false, starting = false
    setReady(false); setFailed(false)
    orbit.current = { yaw: 0, pitch: 0 }; pointer.current = null
    setRotated(false); setDragging(false)
    setView(ANIMATED_EXERCISES.has(id) ? 'technique' : 'front'); setPlaying(true)
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReduced(motion.matches)
    onMotion(); motion.addEventListener('change', onMotion)
    const resize = new ResizeObserver(() => handle.current?.update({ width: element.clientWidth }))
    resize.observe(element)
    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false
      handle.current?.update({ visible })
      if (!visible || starting) return
      starting = true
      if (import.meta.env.DEV) element.dataset.modelState = 'importing-renderer'
      void import('../lib/exerciseModelRenderer').then(({ mountExerciseModel }) => {
        if (disposed) return
        handle.current = mountExerciseModel(element, id, exerciseMuscles(id),
          () => { if (!disposed) { setReady(true); setFailed(false) } },
          () => { if (!disposed) { setFailed(true); setReady(false) } })
        handle.current.update({ visible, width: element.clientWidth })
      }).catch(error => { if (import.meta.env.DEV) console.error('Exercise renderer import failed', error); if (!disposed) setFailed(true) })
    }, { threshold: 0.05 })
    observer.observe(element)
    return () => {
      disposed = true; observer.disconnect(); resize.disconnect()
      motion.removeEventListener('change', onMotion)
      handle.current?.dispose(); handle.current = null
    }
  }, [id])

  useEffect(() => { handle.current?.update({ playing, view }) }, [playing, view])

  const resetView = (next = view) => {
    orbit.current = { yaw: 0, pitch: 0 }
    setRotated(false); setView(next)
    // Reselecting the current preset must also restore its original angle.
    handle.current?.update({ view: next, orbit: orbit.current })
  }
  const rotate = useCallback((yaw: number, pitch: number) => {
    const limit = Math.PI / 2 - 0.1
    orbit.current = {
      yaw: (orbit.current.yaw + yaw) % (2 * Math.PI),
      pitch: Math.max(-limit, Math.min(limit, orbit.current.pitch + pitch)),
    }
    setRotated(true)
    handle.current?.update({ orbit: orbit.current })
  }, [])
  useEffect(() => {
    if (!ready || !canvas.current) return
    return bindTwoFingerRotation(canvas.current, rotate, setDragging)
  }, [ready, rotate])
  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!ready || event.pointerType === 'touch' || !event.isPrimary || event.button !== 0 || pointer.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
  }
  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = pointer.current
    if (!previous || previous.id !== event.pointerId) return
    const scale = 2 * Math.PI / Math.max(event.currentTarget.clientWidth, 1)
    rotate((previous.x - event.clientX) * scale, (previous.y - event.clientY) * scale)
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current?.id !== event.pointerId) return
    pointer.current = null; setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const rotateWithKeys = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!ready || event.altKey || event.ctrlKey || event.metaKey) return
    const step = Math.PI / 12
    switch (event.key) {
      case 'ArrowLeft': rotate(step, 0); break
      case 'ArrowRight': rotate(-step, 0); break
      case 'ArrowUp': rotate(0, -step); break
      case 'ArrowDown': rotate(0, step); break
      case 'Home': resetView(); break
      default: return
    }
    event.preventDefault()
  }

  return (
    <figure className={`min-w-0 ${className ?? ''}`}>
      <div data-swipe-ignore className="relative overflow-hidden rounded-[12px] bg-surface-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-signal">
        <canvas ref={canvas} width={720} height={540}
          className={`block aspect-[4/3] w-full touch-auto select-none ${dragging ? 'cursor-grabbing' : ready ? 'cursor-grab' : ''}`}
          role="group" aria-roledescription={L('Modèle 3D interactif', 'Interactive 3D model')} tabIndex={ready ? 0 : -1}
          aria-label={L(`${name} : ${view === 'technique' ? 'démonstration 3D' : 'muscles sollicités'}`, `${name}: ${view === 'technique' ? '3D demonstration' : 'target muscles'}`)}
          aria-describedby={instructions} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag}
          onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={rotateWithKeys} />
        <span id={instructions} className="sr-only">{L('Sur écran tactile : deux doigts pour tourner, un doigt pour défiler. À la souris : glisse pour tourner. Au clavier : flèches pour tourner et incliner, Début pour recentrer.', 'Touchscreen: use two fingers to rotate, one finger to scroll. Mouse: drag to rotate. Keyboard: arrow keys to rotate and tilt, Home to reset the view.')}</span>
        {!ready && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-text-2">{failed ? L('Vue 3D indisponible. Quitte puis rouvre cet exercice pour réessayer.', '3D view unavailable. Leave and reopen this exercise to try again.') : L('Chargement de la vue 3D…', 'Loading 3D view…')}</div>}
        {ready && rotated && <IconButton className="absolute right-3 top-3 bg-surface" onClick={() => resetView()} label={L('Recentrer le modèle', 'Reset model view')}><RotateCcw size={16} aria-hidden /></IconButton>}
        {ready && animated && view === 'technique' && !reduced && <Button variant="ink" size="sm" className="absolute bottom-3 right-3" onClick={() => setPlaying(value => !value)} aria-pressed={!playing} icon={playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}>
          {playing ? L('Pause', 'Pause') : L('Lire', 'Play')}
        </Button>}
      </div>
      <div className="mt-2">
        {!compact && <Segmented<ExerciseView>
          layout="fit"
          label={L('Vue du modèle', 'Model view')}
          value={ready && !rotated ? view : undefined}
          disabled={!ready}
          onChange={resetView}
          options={[
            ...(animated ? [{ value: 'technique' as const, label: L('Mouvement', 'Movement') }] : []),
            { value: 'front', label: L('Face', 'Front') },
            { value: 'back', label: L('Dos', 'Back') },
          ]}
        />}
        <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-muted">
          <Hand size={14} strokeWidth={1.75} className="hidden shrink-0 [@media(pointer:coarse)]:block" aria-hidden />
          <MousePointer2 size={14} strokeWidth={1.75} className="shrink-0 [@media(pointer:coarse)]:hidden" aria-hidden />
          <span className="hidden [@media(pointer:coarse)]:inline">{L('2 doigts pour tourner · 1 pour défiler', '2 fingers to rotate · 1 to scroll')}</span>
          <span className="[@media(pointer:coarse)]:hidden">{L('Glisser pour tourner', 'Drag to rotate')}</span>
        </p>
      </div>
      {(!compact || !animated) && <figcaption className="mt-2 space-y-1.5 text-[12px] leading-[1.45] text-text-2">
        {!compact && direct.length > 0 && <p className="flex gap-2"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-signal" /><span className="min-w-0"><strong className="font-semibold">{L(direct.length === 1 ? 'Muscle principal : ' : 'Muscles principaux : ', direct.length === 1 ? 'Primary muscle: ' : 'Primary muscles: ')}</strong>{direct.join(', ')}</span></p>}
        {!compact && secondary.length > 0 && <p className="flex gap-2"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-signal opacity-40" /><span className="min-w-0"><strong className="font-semibold">{L(secondary.length === 1 ? 'Muscle secondaire : ' : 'Muscles secondaires : ', secondary.length === 1 ? 'Secondary muscle: ' : 'Secondary muscles: ')}</strong>{secondary.join(', ')}</span></p>}
        {!compact && !direct.length && !secondary.length && <p>{L('Consulte la vidéo de référence pour les muscles sollicités.', 'See the reference video for the muscles involved.')}</p>}
        {!animated && <p className="pt-1 text-muted">{L('Vue anatomique uniquement. Consulte les consignes et une vidéo de référence pour le mouvement.', 'Anatomy view only. Check the exercise instructions and a reference video for the movement.')}</p>}
      </figcaption>}
    </figure>
  )
}
