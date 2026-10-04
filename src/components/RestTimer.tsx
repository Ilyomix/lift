import { isNative } from '../lib/native/bridge'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Minus, Plus, SkipForward, Timer, X } from 'lucide-react'
import { chime, keepAwake, systemNotify, vibrate } from '../lib/alerts'
import { fmtClock } from '../lib/format'
import { L } from '../lib/i18n'
import { preparePush, pushReady } from '../lib/push'
import { useStore } from '../lib/store'
import { cx, IconButton, Segmented } from './ui'

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
      // Native notifications own their sound/haptics. Never replay an expired
      // rest alert when the WebView resumes after the lock-screen notification.
      const inAppAlert = !isNative() || (!prefs.notifications && document.visibilityState === 'visible' && now - timer.endAt < 2000)
      if (inAppAlert) {
        if (prefs.sound) chime()
        vibrate([220, 90, 220])
      }
      // With push on, the server sends the notification (it also arrives phone locked).
      const viaPush = prefs.push && pushReady()
      if (!isNative() && !viaPush && (document.visibilityState !== 'visible' || prefs.notifications)) {
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

/** One character of a seven-segment readout: when it changes, the old figure fades out as the new one fades in. */
function SegChar({ ch }: { ch: string }) {
  const [cur, setCur] = useState(ch)
  const [old, setOld] = useState<string | null>(null)
  if (ch !== cur) {
    setOld(cur)
    setCur(ch)
  }
  return (
    <span className="relative inline-block">
      {old !== null && <span key={`out-${cur}`} className="seg-out absolute inset-0">{old}</span>}
      <span key={`in-${cur}`} className={old !== null ? 'seg-in inline-block' : 'inline-block'}>{cur}</span>
    </span>
  )
}

/** Seven-segment clock: unlit segments shown faintly behind, each figure cross-fading when it changes. */
function SegDigits({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cx('seg seg-ghost tnum whitespace-nowrap', className)} data-ghost={value.replace(/\d/g, '8')} aria-hidden>
      {/* Keyed from the right: the seconds keep their place when the minutes gain or lose a figure. */}
      {[...value].map((ch, i) => <SegChar key={value.length - i} ch={ch} />)}
    </span>
  )
}

/** The current tenth of a second, read on every frame: the state only changes when the tenth does. */
function useTenths(): number {
  const [tenth, setTenth] = useState(() => Math.floor(Date.now() / 100))
  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      setTenth(Math.floor(Date.now() / 100))
      id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [])
  return tenth
}

/**
 * The full-screen readout, to the tenth of a second as on a stopwatch: minutes and seconds in
 * large figures, the tenths smaller beside them. It runs on its own clock, so the seconds and
 * the tenths always turn together.
 */
function StopwatchDigits({ endAt, done }: { endAt: number; done: boolean }) {
  const tenths = Math.max(0, Math.floor((endAt - useTenths() * 100) / 100))
  const value = fmtClock(Math.floor(tenths / 10))
  // Past an hour the readout takes three pairs of figures: smaller ones, so it stays inside the dial.
  const hours = value.length > 5
  return (
    <><span role="timer" aria-live={done ? 'assertive' : 'off'} className="sr-only">{done ? L('Repos terminé', 'Rest over') : L(`Repos : ${value} restantes`, `Rest: ${value} left`)}</span><span className={cx('flex items-baseline', done && 'text-signal-text rest-expired-pulse')} aria-hidden>
      <SegDigits value={value} className={cx('leading-none', hours ? 'text-[40px]' : 'text-[60px]')} />
      <span className={cx('seg seg-ghost tnum ml-1 leading-none', hours ? 'text-[22px]' : 'text-[30px]')} data-ghost=".8">.{tenths % 10}</span>
    </span></>
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

  return (
    <><div aria-hidden={expanded || undefined} className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-40 px-3 pb-2">
      <div
        role="timer"
        aria-live={done ? 'assertive' : 'off'}
        aria-label={done ? L('Repos terminé', 'Rest over') : L(`Repos : ${clock} restantes`, `Rest: ${clock} left`)}
        className={cx('relative mx-auto max-w-[620px] overflow-hidden rounded-[14px] border bg-inst-bg px-3 pt-2.5 pb-3 text-inst-text shadow-[0_18px_50px_rgb(0_0_0/0.35)]', done ? 'border-signal' : 'border-inst-border')}
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setExpanded(true)} className="pressable flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={L('Agrandir le minuteur', 'Expand timer')}>
            <SegDigits value={clock} className={cx('leading-none', clock.length > 5 ? 'text-[22px]' : 'text-[30px]', done ? 'text-inst-done rest-expired-pulse' : 'text-white')} />
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
    {expanded && <RestOverlay remaining={remaining} progress={progress} onClose={() => setExpanded(false)} />}</>
  )
}

function DockButton({ label, onClick, children, accent }: { label: string; onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx('pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]', accent ? 'bg-signal text-signal-ink' : 'bg-inst-btn text-inst-text hover:bg-inst-btn-hover')}
    >
      {children}
    </button>
  )
}

/**
 * Full-screen rest: the time left in seven-segment figures inside a bezel of 180 graduations
 * that go out one by one, what comes next under it, and compact adjustments within thumb reach.
 * It follows the app's theme and accent.
 */
function RestOverlay({ remaining, progress, onClose }: { remaining: number; progress: number; onClose: () => void }) {
  const timer = useStore((s) => s.state.activeWorkout?.timer ?? null)
  const { adjustRest, stopRest } = useStore.getState()
  const [step, setStep] = useState('15')
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
      if (e.key !== 'Tab' || !dialog.current) return
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) { e.preventDefault(); dialog.current.focus(); return }
      const outside = !dialog.current.contains(document.activeElement)
      if (e.shiftKey && (outside || document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && (outside || document.activeElement === last || document.activeElement === dialog.current)) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => dialog.current?.focus({ preventScroll: true }))
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  if (!timer) return null
  const done = remaining <= 0
  const next = splitNext(timer.next)
  // 180 graduations, lit clockwise from the top for the time left; all lit again when the rest is over.
  const TICKS = 180
  const lit = done ? TICKS : Math.ceil((1 - progress) * TICKS)
  // Choose the adjustment step, then use one shared pair of controls.
  const steps = [
    { value: '15', label: '15 s', name: L('15 secondes', '15 seconds') },
    { value: '60', label: '1 min', name: L('1 minute', '1 minute') },
    { value: '300', label: '5 min', name: L('5 minutes', '5 minutes') },
  ]
  const selectedStep = steps.find((x) => x.value === step)!
  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-label={L('Minuteur de repos', 'Rest timer')} tabIndex={-1} className="overlay-enter fixed inset-0 z-[75] flex flex-col overflow-y-auto bg-bg text-text outline-none safe-top safe-bottom">
      <div className="flex items-center justify-between px-5 pt-2">
        <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-text-2"><Timer size={18} aria-hidden />{L('Repos', 'Rest')}</span>
        <button type="button" onClick={onClose} aria-label={L('Réduire', 'Minimize')} className="pressable -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-text-2 hover:bg-surface-2">
          <ChevronDown size={24} />
        </button>
      </div>
      <div className="flex flex-1 shrink-0 flex-col items-center justify-center px-6">
        <div className="relative aspect-square w-[min(84vw,340px,42vh)]">
          <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: TICKS }, (_, i) => {
              // Three lengths, as on a watch bezel: twelve long marks, the sixty of a minute, and two fine ones between each.
              const long = i % 15 === 0
              const mid = !long && i % 3 === 0
              const on = i < lit
              return (
                <line
                  key={i} x1="150" x2="150" y1="4" y2={long ? 24 : mid ? 15 : 10} strokeLinecap="round" strokeWidth={long ? 3 : mid ? 1.75 : 1}
                  stroke={on ? 'var(--signal)' : 'var(--line-strong)'} opacity={on ? (long ? 1 : mid ? 0.85 : 0.6) : 0.5}
                  className="transition-[stroke,opacity] duration-500 ease-out" transform={`rotate(${i * (360 / TICKS)} 150 150)`}
                />
              )
            })}
          </svg>
          {/* The figures sit at the exact centre of the dial; the label hangs under them without moving them. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <StopwatchDigits endAt={timer.endAt} done={done} />
          </div>
          <span className="absolute inset-x-0 top-[calc(50%+48px)] text-center text-[14px] leading-5 text-muted tnum">{done ? L('Repos terminé', 'Rest over') : L(`sur ${fmtClock(timer.total)}`, `of ${fmtClock(timer.total)}`)}</span>
        </div>
        <div className="mt-7 min-h-[76px] max-w-full px-2 text-center">
          {next ? (
            <>
              <p className="text-[13px] text-muted">{L('Ensuite', 'Next')}</p>
              <p className="mt-1 line-clamp-2 text-[20px] leading-[1.25] font-semibold [overflow-wrap:anywhere]">{next.name}</p>
              <p className="mt-0.5 text-[15px] text-text-2">{next.step}</p>
            </>
          ) : (
            <p className="truncate text-[17px] font-semibold">{timer.label}</p>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[440px] shrink-0 px-5 pb-5">
        <div className="flex items-center gap-2">
          <IconButton label={L(`Retirer ${selectedStep.name}`, `Take off ${selectedStep.name}`)} onClick={() => adjustRest(-Number(step))} disabled={done} className="border border-line-strong">
            <Minus size={18} strokeWidth={2.25} aria-hidden />
          </IconButton>
          <Segmented value={step} onChange={setStep} options={steps} layout="fit" label={L('Pas d’ajustement du repos', 'Rest adjustment step')} className="min-w-0 flex-1 tnum" />
          <IconButton label={L(`Ajouter ${selectedStep.name}`, `Add ${selectedStep.name}`)} onClick={() => adjustRest(Number(step))} className="border border-line-strong">
            <Plus size={18} strokeWidth={2.25} aria-hidden />
          </IconButton>
        </div>
        <button type="button" onClick={() => { stopRest(); onClose() }} className="pressable mt-3 h-14 w-full rounded-[14px] bg-signal text-[16px] font-semibold text-signal-ink">{done ? 'Go' : L('Passer le repos', 'Skip rest')}</button>
      </div>
    </div>
  )
}
