import { useEffect, useRef, useState } from 'react'
import { Plus, SkipForward, X } from 'lucide-react'
import { chime, keepAwake, systemNotify, vibrate } from '../lib/alerts'
import { fmtClock } from '../lib/format'
import { L } from '../lib/i18n'
import { preparePush, pushReady } from '../lib/push'
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

/**
 * Global side effects of a running session: end-of-rest alerts and keeping the screen
 * awake. A component of its own, so its 200 ms clock re-renders nothing else.
 */
export function SessionEffects() {
  useSessionEffects()
  return null
}

function useSessionEffects() {
  const timer = useStore((s) => s.state.activeWorkout?.timer ?? null)
  const hasSession = useStore((s) => !!s.state.activeWorkout)
  const prefs = useStore((s) => s.state.prefs)
  const alerted = useRef<number | null>(null)
  const now = useNow(!!timer)

  useEffect(() => {
    void keepAwake(hasSession && prefs.wakeLock)
  }, [hasSession, prefs.wakeLock])

  useEffect(() => {
    if (prefs.push) void preparePush()
  }, [prefs.push])

  useEffect(() => {
    if (!timer || alerted.current === timer.endAt) return
    if (now >= timer.endAt) {
      alerted.current = timer.endAt
      if (prefs.sound) chime()
      vibrate([220, 90, 220])
      // With push on, the server sends the notification (it also arrives phone locked).
      const viaPush = prefs.push && pushReady()
      if (!viaPush && (document.visibilityState !== 'visible' || prefs.notifications)) {
        void systemNotify(L('Repos terminé', 'Rest over'), timer.next ? L(`Ensuite : ${timer.next}`, `Next: ${timer.next}`) : L('Série suivante.', 'Next set.'))
      }
    }
  }, [now, timer, prefs.sound, prefs.notifications, prefs.push])
}

/**
 * "Série 2/3 · Chest press machine" → ["Série 2/3", "Chest press machine"]; an exercise name stays whole.
 * The store writes "Set 2/3 · …" in English; either form is read and the step is shown in the current language.
 */
function splitNext(next: string | undefined): { step: string; name: string } | null {
  if (!next) return null
  const m = next.match(/^(?:Série|Set) (\d+(?:\/\d+)?) · (.+)$/)
  return m ? { step: L(`Série ${m[1]}`, `Set ${m[1]}`), name: m[2] } : { step: L('Exercice suivant', 'Next exercise'), name: next }
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
  const next = splitNext(timer.next)

  if (expanded) return <RestOverlay remaining={remaining} progress={progress} onClose={() => setExpanded(false)} />

  return (
    <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-40 px-3 pb-2">
      <div
        role="timer"
        aria-live={done ? 'assertive' : 'off'}
        aria-label={done ? L('Repos terminé', 'Rest over') : L(`Repos : ${clock} restantes`, `Rest: ${clock} left`)}
        className={cx('relative mx-auto max-w-[620px] overflow-hidden rounded-[14px] border bg-inst-bg px-3 pt-2.5 pb-3 text-inst-text shadow-[0_18px_50px_rgb(0_0_0/0.35)]', done ? 'border-signal' : 'border-inst-border')}
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setExpanded(true)} className="pressable flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={L('Agrandir le minuteur', 'Expand timer')}>
            <SegDigits value={clock} className={cx('text-[30px] leading-none', done ? 'text-inst-done' : 'text-white')} />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold tracking-[0.08em] text-inst-label uppercase">{done ? 'Go' : next ? L('Ensuite', 'Next') : L('Repos', 'Rest')}</span>
              <span className="block truncate text-[15px] leading-5 font-semibold">{next?.step ?? timer.label}</span>
            </span>
          </button>
          {!done && <DockButton label={L('Ajouter 15 secondes', 'Add 15 seconds')} onClick={() => adjustRest(15)}><Plus size={16} /></DockButton>}
          <DockButton label={done ? L('Fermer', 'Close') : L('Passer le repos', 'Skip rest')} onClick={stopRest} accent={done}>
            {done ? <X size={16} /> : <SkipForward size={16} />}
          </DockButton>
        </div>
        {next && <p className="mt-1.5 truncate text-[13px] leading-[18px] text-inst-label">{next.name}</p>}
        {/* Progress along the bottom edge, inside the card. */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-inst-btn" aria-hidden>
          <div className="h-full bg-signal transition-[width] duration-200 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
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
      className={cx('pressable inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]', accent ? 'bg-signal text-signal-ink' : 'bg-inst-btn text-inst-text hover:bg-inst-btn-hover')}
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
    <div role="dialog" aria-modal="true" aria-label={L('Minuteur de repos', 'Rest timer')} className="overlay-enter fixed inset-0 z-[75] flex flex-col bg-inst-bg text-white safe-top safe-bottom">
      <div className="flex items-center justify-between px-4 pt-2">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-inst-label uppercase">{done ? L('Repos terminé', 'Rest over') : L('Repos', 'Rest')}</span>
        <button type="button" onClick={onClose} aria-label={L('Réduire', 'Minimize')} className="pressable inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-inst-text hover:bg-inst-btn">
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative h-[300px] w-[300px]">
          <svg viewBox="0 0 300 300" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="150" cy="150" r={R} fill="none" stroke="var(--inst-track)" strokeWidth="18" />
            <circle
              cx="150" cy="150" r={R} fill="none" stroke={done ? 'var(--inst-done)' : 'var(--accent-bright)'} strokeWidth="18"
              strokeDasharray={C} strokeDashoffset={C * progress} className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
            {Array.from({ length: 60 }, (_, i) => (
              <line key={i} x1="150" x2="150" y1={i % 5 === 0 ? 6 : 9} y2={i % 5 === 0 ? 14 : 12} stroke="var(--inst-tick)" strokeWidth={i % 5 === 0 ? 2 : 1} transform={`rotate(${i * 6} 150 150)`} />
            ))}
          </svg>
          <div className={cx('absolute inset-0 flex flex-col items-center justify-center', done && 'rest-flash')}>
            <SegDigits value={fmtClock(Math.ceil(remaining))} className={cx('text-[64px] leading-none', done ? 'text-inst-done' : 'text-white')} />
            <span className="mt-3 max-w-[200px] truncate text-center text-[13px] text-inst-label">{timer.label}</span>
          </div>
        </div>
        <p className="mt-8 min-h-[22px] px-4 text-center text-[15px] font-medium text-inst-text">{timer.next ? L(`Ensuite : ${timer.next}`, `Next: ${timer.next}`) : ''}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 px-6 pb-6">
        <button type="button" onClick={() => adjustRest(-15)} disabled={done} className="pressable h-14 rounded-[12px] bg-inst-btn text-[15px] font-semibold disabled:opacity-40">−15 s</button>
        <button type="button" onClick={() => adjustRest(15)} className="pressable h-14 rounded-[12px] bg-inst-btn text-[15px] font-semibold">+15 s</button>
        <button type="button" onClick={() => { stopRest(); onClose() }} className="pressable h-14 rounded-[12px] bg-signal text-[15px] font-semibold text-signal-ink">{done ? 'Go' : L('Passer', 'Skip')}</button>
      </div>
    </div>
  )
}
