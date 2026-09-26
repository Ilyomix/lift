import { useEffect, useRef, useState } from 'react'
import { Minus, Plus, SkipForward, X } from 'lucide-react'
import { chime, keepAwake, systemNotify, vibrate } from '../lib/alerts'
import { fmtClock } from '../lib/format'
import { useStore } from '../lib/store'
import { cx } from './ui'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 200)
    const onVis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])
  return now
}

/** Global side effects of a running session: end-of-rest alerts and keeping the screen awake. */
export function useSessionEffects() {
  const timer = useStore((s) => s.state.activeWorkout?.timer ?? null)
  const hasSession = useStore((s) => !!s.state.activeWorkout)
  const prefs = useStore((s) => s.state.prefs)
  const alerted = useRef<number | null>(null)
  const now = useNow(!!timer)

  useEffect(() => {
    void keepAwake(hasSession && prefs.wakeLock)
  }, [hasSession, prefs.wakeLock])

  useEffect(() => {
    if (!timer || alerted.current === timer.endAt) return
    if (now >= timer.endAt) {
      alerted.current = timer.endAt
      if (prefs.sound) chime()
      vibrate([220, 90, 220])
      if (document.visibilityState !== 'visible' || prefs.notifications) {
        void systemNotify('Repos terminé', timer.next ? `Ensuite : ${timer.next}` : 'Série suivante.')
      }
    }
  }, [now, timer, prefs.sound, prefs.notifications])
}

function SegDigits({ value, className }: { value: string; className?: string }) {
  const ghost = value.replace(/\d/g, '8')
  return (
    <span className={cx('seg seg-ghost tnum', className)} data-ghost={ghost} aria-hidden>
      {value}
    </span>
  )
}

export function RestDock() {
  const timer = useStore((s) => s.state.activeWorkout?.timer ?? null)
  const { adjustRest, stopRest } = useStore.getState()
  const [expanded, setExpanded] = useState(false)
  const now = useNow(!!timer)
  useEffect(() => {
    if (!timer) setExpanded(false)
  }, [timer])
  if (!timer) return null
  const remaining = Math.max(0, (timer.endAt - now) / 1000)
  const done = remaining <= 0
  const progress = Math.min(1, 1 - remaining / timer.total)
  const clock = fmtClock(Math.ceil(remaining))

  if (expanded) return <RestOverlay remaining={remaining} progress={progress} onClose={() => setExpanded(false)} />

  return (
    <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-40 px-3 pb-2">
      <div
        role="timer"
        aria-live={done ? 'assertive' : 'off'}
        aria-label={done ? 'Repos terminé' : `Repos : ${clock} restantes`}
        className={cx('mx-auto flex max-w-[620px] items-center gap-3 overflow-hidden rounded-[14px] border bg-[#0b0b0e] px-3 py-2.5 text-white shadow-[0_18px_50px_rgb(0_0_0/0.35)]', done ? 'border-signal' : 'border-[#2a2a30]')}
      >
        <button type="button" onClick={() => setExpanded(true)} className="pressable flex min-w-0 flex-1 items-center gap-3 text-left" aria-label="Agrandir le minuteur">
          <SegDigits value={clock} className={cx('text-[30px] leading-none', done ? 'text-[#ff9a3d]' : 'text-white')} />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-[0.1em] text-[#8b8b91] uppercase">{done ? 'Go' : timer.next ? 'Ensuite' : 'Repos'}</span>
            <span className="block truncate text-[13px] font-medium text-[#e8e8e6]">{timer.next ?? timer.label}</span>
          </span>
        </button>
        {!done && (
          <>
            <DockButton label="Retirer 15 secondes" onClick={() => adjustRest(-15)}><Minus size={16} /></DockButton>
            <DockButton label="Ajouter 15 secondes" onClick={() => adjustRest(15)}><Plus size={16} /></DockButton>
          </>
        )}
        <DockButton label={done ? 'Fermer' : 'Passer le repos'} onClick={stopRest} accent={done}>
          {done ? <X size={16} /> : <SkipForward size={16} />}
        </DockButton>
      </div>
      <div className="mx-auto -mt-[3px] h-[3px] max-w-[590px] overflow-hidden rounded-full">
        <div className="h-full bg-signal transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}

function DockButton({ label, onClick, children, accent }: { label: string; onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx('pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]', accent ? 'bg-signal text-[#111]' : 'bg-[#1c1c21] text-[#e8e8e6] hover:bg-[#26262c]')}
    >
      {children}
    </button>
  )
}

/** Full-screen dial: the Cadran-style face of the rest timer. */
function RestOverlay({ remaining, progress, onClose }: { remaining: number; progress: number; onClose: () => void }) {
  const timer = useStore((s) => s.state.activeWorkout?.timer ?? null)
  const { adjustRest, stopRest } = useStore.getState()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!timer) return null
  const done = remaining <= 0
  const R = 132
  const C = 2 * Math.PI * R
  return (
    <div role="dialog" aria-modal="true" aria-label="Minuteur de repos" className="overlay-enter fixed inset-0 z-[55] flex flex-col bg-[#0b0b0e] text-white safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-[#8b8b91] uppercase">{done ? 'Repos terminé' : 'Repos'}</span>
        <button type="button" onClick={onClose} aria-label="Réduire" className="pressable inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-[#b8b9b6] hover:bg-[#1c1c21]">
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative h-[300px] w-[300px]">
          <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="150" cy="150" r={R} fill="none" stroke="#1f1f24" strokeWidth="18" />
            <circle
              cx="150" cy="150" r={R} fill="none" stroke={done ? '#ff9a3d' : '#ff7b00'} strokeWidth="18"
              strokeDasharray={C} strokeDashoffset={C * progress} className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
            {Array.from({ length: 60 }, (_, i) => (
              <line key={i} x1="150" x2="150" y1={i % 5 === 0 ? 6 : 9} y2={i % 5 === 0 ? 14 : 12} stroke="#3a3a40" strokeWidth={i % 5 === 0 ? 2 : 1} transform={`rotate(${i * 6} 150 150)`} />
            ))}
          </svg>
          <div className={cx('absolute inset-0 flex flex-col items-center justify-center', done && 'rest-flash')}>
            <SegDigits value={fmtClock(Math.ceil(remaining))} className={cx('text-[64px] leading-none', done ? 'text-[#ff9a3d]' : 'text-white')} />
            <span className="mt-3 max-w-[200px] truncate text-center text-[13px] text-[#b8b9b6]">{timer.label}</span>
          </div>
        </div>
        <p className="mt-8 min-h-[22px] text-center text-[15px] font-medium text-[#e8e8e6]">{timer.next ? `Ensuite : ${timer.next}` : ''}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 px-6 pb-6">
        <button type="button" onClick={() => adjustRest(-15)} disabled={done} className="pressable h-14 rounded-[12px] bg-[#1c1c21] text-[15px] font-semibold disabled:opacity-40">−15 s</button>
        <button type="button" onClick={() => adjustRest(15)} className="pressable h-14 rounded-[12px] bg-[#1c1c21] text-[15px] font-semibold">+15 s</button>
        <button type="button" onClick={() => { stopRest(); onClose() }} className="pressable h-14 rounded-[12px] bg-signal text-[15px] font-semibold text-[#111]">{done ? 'Go' : 'Passer'}</button>
      </div>
    </div>
  )
}
