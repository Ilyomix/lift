import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { L } from '../lib/i18n'
import { ANIMATED_EXERCISES, anatomicalLabel, exerciseMuscles, type AnatomicalRegion } from '../lib/exerciseModelCatalog'
import type { ExerciseView } from '../lib/exerciseModels'
import type { mountExerciseModel } from '../lib/exerciseModelRenderer'

type ModelHandle = ReturnType<typeof mountExerciseModel>

export function ExerciseDemo({ id, name, className }: { id: string; name: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<ModelHandle | null>(null)
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

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-[12px] bg-surface-2">
        <canvas ref={canvas} width={720} height={540} className="block aspect-[4/3] w-full" role="img" aria-label={L(`${name} : ${view === 'technique' ? 'démonstration 3D' : 'muscles sollicités'}`, `${name}: ${view === 'technique' ? '3D demonstration' : 'target muscles'}`)} />
        {!ready && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-text-2">{failed ? L('Vue 3D indisponible. Les muscles et vidéos restent accessibles ci-dessous.', '3D view unavailable. Muscle information and videos are available below.') : L('Chargement du modèle…', 'Loading model…')}</div>}
        {ready && animated && view === 'technique' && !reduced && <button type="button" className="pressable absolute bottom-3 right-3 flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium" onClick={() => setPlaying(value => !value)} aria-pressed={!playing}>
          {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}{playing ? L('Pause', 'Pause') : L('Lire', 'Play')}
        </button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex gap-1" aria-label={L('Vue du modèle', 'Model view')}>
          {(animated ? ['technique', 'front', 'back'] : ['front', 'back']).map(value => <button type="button" key={value} disabled={!ready} aria-pressed={view === value} onClick={() => setView(value as ExerciseView)} className={`pressable min-h-11 rounded-[8px] px-3 text-[12px] font-medium disabled:opacity-40 ${view === value ? 'bg-signal-soft text-signal' : 'text-text-2 hover:bg-surface-2'}`}>
            {value === 'technique' ? L('Mouvement', 'Movement') : value === 'front' ? L('Face', 'Front') : L('Dos', 'Back')}
          </button>)}
        </div>
        <span className="text-[11px] text-muted">{animated ? reduced ? L('Animation réduite', 'Reduced motion') : L('Modèle 3D Lift', 'Lift 3D model') : L('Carte musculaire', 'Muscle map')}</span>
      </div>
      <figcaption className="mt-2 space-y-1.5 text-[12px] leading-[1.45] text-text-2">
        {direct.length > 0 && <p className="flex gap-2"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-signal" /><span><strong className="font-semibold">{L('Principal : ', 'Primary: ')}</strong>{direct.join(', ')}</span></p>}
        {secondary.length > 0 && <p className="flex gap-2"><span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-signal opacity-40" /><span><strong className="font-semibold">{L('Secondaire : ', 'Secondary: ')}</strong>{secondary.join(', ')}</span></p>}
        {!direct.length && !secondary.length && <p>{L('Consulte la vidéo de référence pour les muscles sollicités.', 'See the reference video for the muscles involved.')}</p>}
        {!animated && <p className="pt-1 text-muted">{L('Repère anatomique. La vidéo de référence ci-dessous montre le mouvement.', 'Anatomy reference. The video below shows the movement.')}</p>}
      </figcaption>
    </figure>
  )
}
