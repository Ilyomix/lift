import { useEffect, useRef, useState } from 'react'

const artwork = {
  dumbbell: new URL('../assets/sport/dumbbell.webp', import.meta.url).href,
  plate: new URL('../assets/sport/plate.webp', import.meta.url).href,
  stopwatch: new URL('../assets/sport/stopwatch.webp', import.meta.url).href,
  calendar: new URL('../assets/sport/calendar.webp', import.meta.url).href,
  chart: new URL('../assets/sport/chart.webp', import.meta.url).href,
  nutrition: new URL('../assets/sport/nutrition.webp', import.meta.url).href,
  settings: new URL('../assets/sport/settings.webp', import.meta.url).href,
  backup: new URL('../assets/sport/backup.webp', import.meta.url).href,
  coach: new URL('../assets/sport/coach.webp', import.meta.url).href,
  trophy: new URL('../assets/sport/trophy.webp', import.meta.url).href,
}
export type SportArtKind = keyof typeof artwork

/** Decorative equipment uses one fixed slot; only the artwork itself moves. */
export function SportArt({ kind }: { kind: SportArtKind }) {
  const image = useRef<HTMLImageElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let inView = false
    const update = () => setPlaying(inView && !document.hidden && !reducedMotion.matches)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    }, { threshold: 0.1 })
    if (image.current) observer.observe(image.current)
    reducedMotion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      reducedMotion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return <img ref={image} src={artwork[kind]} alt="" aria-hidden draggable={false} width={64} height={64} data-art={kind} className="sport-art pointer-events-none block size-16 shrink-0 select-none object-contain" style={{ animationPlayState: playing ? 'running' : 'paused' }} />
}
