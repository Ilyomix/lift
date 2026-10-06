import { useEffect, useRef, useState } from 'react'
import type { WorkoutType } from '../lib/types'

const artwork = {
  dumbbell: new URL('../assets/sport/dumbbell.webp', import.meta.url).href,
  plate: new URL('../assets/sport/plate.webp', import.meta.url).href,
  stopwatch: new URL('../assets/sport/stopwatch.webp', import.meta.url).href,
  calendar: new URL('../assets/sport/calendar.webp', import.meta.url).href,
  chart: new URL('../assets/sport/chart.webp', import.meta.url).href,
  nutrition: new URL('../assets/sport/nutrition.webp', import.meta.url).href,
  settings: new URL('../assets/sport/settings.webp', import.meta.url).href,
  appearance: new URL('../assets/sport/appearance.webp', import.meta.url).href,
  backup: new URL('../assets/sport/backup.webp', import.meta.url).href,
  coach: new URL('../assets/sport/coach.webp', import.meta.url).href,
  trophy: new URL('../assets/sport/trophy.webp', import.meta.url).href,
  program: new URL('../assets/sport/program.webp', import.meta.url).href,
  evidence: new URL('../assets/sport/evidence.webp', import.meta.url).href,
  pause: new URL('../assets/sport/pause.webp', import.meta.url).href,
  reminders: new URL('../assets/sport/reminders.webp', import.meta.url).href,
  privacy: new URL('../assets/sport/privacy.webp', import.meta.url).href,
  kit: new URL('../assets/sport/kit.webp', import.meta.url).href,
  logbook: new URL('../assets/sport/logbook.webp', import.meta.url).href,
  camera: new URL('../assets/sport/camera.webp', import.meta.url).href,
  'measuring-tape': new URL('../assets/sport/measuring-tape.webp', import.meta.url).href,
  'body-target': new URL('../assets/sport/body-target.webp', import.meta.url).href,
  'workout-upper': new URL('../assets/sport/workout-upper.webp', import.meta.url).href,
  'workout-lower': new URL('../assets/sport/workout-lower.webp', import.meta.url).href,
  'workout-push': new URL('../assets/sport/workout-push.webp', import.meta.url).href,
  'workout-pull': new URL('../assets/sport/workout-pull.webp', import.meta.url).href,
  'workout-legs': new URL('../assets/sport/workout-legs.webp', import.meta.url).href,
}
export type SportArtKind = keyof typeof artwork
export const workoutArt: Record<WorkoutType, SportArtKind> = {
  UPPER: 'workout-upper', LOWER: 'workout-lower', PUSH: 'workout-push', PULL: 'workout-pull', LEGS: 'workout-legs',
}

/** Locally bundled 3D artwork. Titles stay 32px; standalone artwork gets 64px. */
export function SportArt({ kind, size = 'illustration' }: { kind: SportArtKind; size?: 'title' | 'illustration' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const pixels = size === 'title' ? 32 : 64

  useEffect(() => {
    const target = canvas.current
    if (!target) return
    setReady(false)
    // A reused title slot must not cover the next illustration's fallback with
    // pixels from the previous kind while its GLB is still loading.
    target.getContext('2d')?.clearRect(0, 0, target.width, target.height)
    let disposed = false
    let inView = false
    let started = false
    let model: ReturnType<typeof import('../lib/sportModels').mountSportModel> | undefined
    const observer = new IntersectionObserver(([entry]) => {
      // An initial observer entry can intersect by just one pixel, below its
      // configured threshold. Do not spend the gesture while still clipped.
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.1
      model?.setVisible(inView)
      if (!inView || started) return
      started = true
      // The workout UI never waits for the renderer or a model download.
      void import('../lib/sportModels').then(({ mountSportModel }) => {
        if (disposed) return
        model = mountSportModel(target, kind, () => { if (!disposed) setReady(true) })
        model.setVisible(inView)
      }).catch(() => { /* A theme-colored static silhouette remains if WebGL is unavailable. */ })
    }, { threshold: 0.1 })
    observer.observe(target)
    return () => {
      disposed = true
      observer.disconnect()
      model?.dispose()
    }
  }, [kind, pixels])

  return <span aria-hidden data-art={kind} data-renderer={ready ? '3d' : 'fallback'} className="sport-art pointer-events-none relative block shrink-0 select-none" style={{ width: pixels, height: pixels }}>
    {!ready && <span className="absolute inset-0 bg-signal" style={{ maskImage: `url(${artwork[kind]})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />}
    <canvas ref={canvas} width={pixels * 2} height={pixels * 2} className="relative block size-full" />
  </span>
}
