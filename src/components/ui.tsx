import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { addMonths, capitalize, dayLetter, fmtDate, monthName, todayISO } from '../lib/date'
import { L, locale } from '../lib/i18n'
import { back } from '../lib/router'
import { useStore } from '../lib/store'
import { SportArt, type SportArtKind } from './SportArt'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ───────────── Buttons ─────────────

type Variant = 'primary' | 'ink' | 'outline' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-signal text-signal-ink hover:brightness-105 font-semibold',
  ink: 'bg-text text-bg hover:opacity-90 font-semibold',
  outline: 'border border-line-strong text-text hover:border-muted bg-transparent font-medium',
  ghost: 'text-text-2 hover:text-text hover:bg-surface-2 font-medium',
  danger: 'border border-line-strong text-bad hover:border-bad-mark bg-transparent font-medium',
  soft: 'bg-surface-2 text-text hover:bg-surface-3 font-medium',
}
const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-[9px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-[52px] px-5 text-[15px] gap-2 rounded-[12px]',
}

export function Button({
  variant = 'outline', size = 'md', full, icon, children, className, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'pressable inline-flex items-center justify-center whitespace-nowrap select-none disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], full && 'w-full', className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx('pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-text-2 hover:text-text hover:bg-surface-2 disabled:opacity-40', className)}
    >
      {children}
    </button>
  )
}

// ───────────── Text & labels ─────────────

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('eyebrow', className)}>{children}</p>
}

type TagTone = 'ink' | 'outline' | 'signal' | 'good' | 'warn' | 'bad' | 'muted'
const TAGS: Record<TagTone, string> = {
  ink: 'bg-text text-bg border-text',
  outline: 'border-line-strong text-text-2',
  signal: 'bg-signal text-signal-ink border-signal',
  good: 'border-good-mark/40 text-good bg-good-mark/8',
  warn: 'border-warn-mark/50 text-warn bg-warn-mark/10',
  bad: 'border-bad-mark/40 text-bad bg-bad-mark/8',
  muted: 'border-line text-muted',
}

/** Sharp-cornered badge, as in Cadran. */
export function Tag({ tone = 'outline', icon, children, className }: { tone?: TagTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 border px-2 py-[3px] text-[11px] font-semibold leading-4 tracking-[0.01em] whitespace-nowrap', TAGS[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function Num({ value, digits = 1, className, suffix, prefix, signed }: { value: number; digits?: number; className?: string; suffix?: string; prefix?: string; signed?: boolean }) {
  return (
    <NumberFlow
      className={className}
      value={value}
      locales={locale()}
      prefix={prefix}
      suffix={suffix}
      format={{ maximumFractionDigits: digits, minimumFractionDigits: 0, signDisplay: signed ? 'exceptZero' : 'auto' }}
    />
  )
}

// ───────────── Layout ─────────────

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('screen-in mx-auto w-full max-w-[640px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] safe-top', className)}>{children}</main>
}

export function Header({ eyebrow, title, backTo, right, sub, art, artSize = 'title' }: { eyebrow?: ReactNode; title: ReactNode; backTo?: string; right?: ReactNode; sub?: ReactNode; art?: SportArtKind; artSize?: 'title' | 'illustration' }) {
  return (
    <header className="pt-2 pb-5">
      {(backTo !== undefined || right) && <div className="mb-1 flex min-h-11 items-center justify-between gap-2">
        {backTo !== undefined ? (
          <button type="button" onClick={() => back(backTo)} className="pressable -ml-2 inline-flex h-11 items-center gap-1 rounded-[10px] px-2 text-sm font-medium text-text-2 hover:text-text">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden />
            {L('Retour', 'Back')}
          </button>
        ) : (
          <span />
        )}
        {right}
      </div>}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && <Eyebrow className="mt-1">{eyebrow}</Eyebrow>}
          <h1 className="mt-1 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-text">{title}</h1>
        </div>
        {art && <SportArt kind={art} size={artSize} />}
      </div>
      {sub && <p className="mt-2 text-[15px] leading-[1.45] text-text-2">{sub}</p>}
    </header>
  )
}

export function Section({ title, action, children, className, art }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; art?: SportArtKind }) {
  return (
    <section className={cx(art ? 'mt-6' : 'mt-7', className)}>
      {(title || action) && (
        <div className={cx('mb-3 flex gap-3', art ? 'items-center' : 'items-end justify-between')}>
          {art && <SportArt kind={art} size="title" />}
          {art ? <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {title && <h2 className="min-w-0 text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>}
            {action && <div className="min-w-0">{action}</div>}
          </div> : <>
            {title ? <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2> : <span />}
            {action}
          </>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' } & Record<string, unknown>) {
  return (
    <As className={cx('card', className)} {...rest}>
      {children}
    </As>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-line', className)} />
}

export function Row({ label, value, hint, onClick, right, className }: { label: ReactNode; value?: ReactNode; hint?: ReactNode; onClick?: () => void; right?: ReactNode; className?: string }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left', onClick && 'pressable hover:bg-surface-2', className)}
    >
      <span className="min-w-0">
        <span className="block text-[15px] leading-5 text-text">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-[18px] text-muted">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[15px] text-text-2">
        {value}
        {right}
      </span>
    </Comp>
  )
}

// ───────────── Controls ─────────────

export function Segmented<T extends string>({ value, options, onChange, className, label, disabled }: { value: T | undefined; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string; label: string; disabled?: boolean }) {
  return (
    <div role="tablist" aria-label={label} className={cx('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'pressable h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none',
              active ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2 hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-[52px] w-full items-center justify-between gap-4 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] leading-5">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-[18px] text-muted">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-[30px] w-[50px] rounded-full bg-surface-3 transition-colors peer-checked:bg-signal peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal" />
        <span className="absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'h-12 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[16px] text-text tnum placeholder:text-muted/70 focus:border-signal focus:outline-none'

/**
 * Date field with an in-app month calendar. The native iOS picker closed itself
 * whenever the page reacted to a new value (a preview growing, a hint appearing),
 * so the calendar is drawn here: labels in the app language, Monday first, days outside
 * the allowed range disabled, and it stays open until a day is picked.
 */
export function DateInput({
  value, onChange, min, max, placeholder = L('Choisir une date', 'Pick a date'), label, className, clearable,
}: { value: string; onChange: (v: string) => void; min?: string; max?: string; placeholder?: string; label: string; className?: string; clearable?: boolean }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value || clampDate(todayISO(), min, max)).slice(0, 7))
  const panel = useId()
  // Follow outside changes (shortcut chips) so the calendar opens on the chosen month.
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7))
  }, [value])
  const text = value ? capitalize(fmtDate(value, { weekday: true, long: true, year: true })) : placeholder
  return (
    <div className={cx('w-full min-w-0', className)}>
      <div className={cx('flex h-12 w-full min-w-0 items-center rounded-[10px] border bg-surface', open ? 'border-signal' : 'border-line-strong')}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          aria-label={L(`${label} : ${value ? text : 'aucune date'}`, `${label}: ${value ? text : 'no date'}`)}
          onClick={() => setOpen(!open)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left"
        >
          <CalendarDays size={18} className="shrink-0 text-muted" aria-hidden />
          <span className={cx('min-w-0 flex-1 truncate text-[16px]', value ? 'text-text' : 'text-muted/80')}>{text}</span>
          <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {clearable && value && (
          <button type="button" onClick={() => { onChange(''); setOpen(false) }} aria-label={L('Effacer la date', 'Clear date')} className="pressable mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-muted hover:text-text">
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      {open && (
        <MonthCalendar
          id={panel}
          month={month}
          onMonth={setMonth}
          value={value}
          min={min}
          max={max}
          onPick={(d) => {
            onChange(d)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function clampDate(d: string, min?: string, max?: string): string {
  if (min && d < min) return min
  if (max && d > max) return max
  return d
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]

function MonthCalendar({ id, month, onMonth, value, min, max, onPick }: { id: string; month: string; onMonth: (m: string) => void; value: string; min?: string; max?: string; onPick: (d: string) => void }) {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const count = new Date(y, m, 0).getDate()
  const today = todayISO()
  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  const canPrev = !min || `${prev}-31` >= min
  const canNext = !max || `${next}-01` <= max
  const days = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  return (
    <div id={id} className="overlay-enter mt-2 rounded-[12px] border border-line bg-surface p-3" role="group" aria-label={`${monthName(m - 1)} ${y}`}>
      <div className="flex items-center justify-between">
        <IconButton label={L('Mois précédent', 'Previous month')} disabled={!canPrev} onClick={() => onMonth(prev)} className="h-10 w-10"><ChevronLeft size={18} /></IconButton>
        <p className="text-[15px] font-semibold capitalize">{monthName(m - 1)} <span className="text-text-2">{y}</span></p>
        <IconButton label={L('Mois suivant', 'Next month')} disabled={!canNext} onClick={() => onMonth(next)} className="h-10 w-10"><ChevronRight size={18} /></IconButton>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted" aria-hidden>
        {WEEK.map((d, i) => <span key={i}>{dayLetter(d)}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
        {days.map((d) => {
          const off = (!!min && d < min) || (!!max && d > max)
          const selected = d === value
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              aria-pressed={selected}
              aria-label={capitalize(fmtDate(d, { weekday: true, long: true, year: true }))}
              onClick={() => onPick(d)}
              className={cx(
                'pressable h-10 rounded-[8px] text-[15px] tnum disabled:pointer-events-none disabled:opacity-25',
                selected ? 'bg-signal font-semibold text-signal-ink' : d === today ? 'font-semibold text-signal-text ring-1 ring-inset ring-line-strong' : 'hover:bg-surface-2',
              )}
            >
              {Number(d.slice(8))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Time field with the same treatment: readable value, native picker, full width. */
export function TimeInput({ value, onChange, label, className }: { value: string; onChange: (v: string) => void; label: string; className?: string }) {
  return (
    <div className={cx('relative flex h-12 w-full min-w-0 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3 focus-within:border-signal', className)}>
      <Clock size={18} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[16px] tnum" aria-hidden>{value ? L(value.replace(':', ' h '), value) : '—'}</span>
      <input type="time" aria-label={label} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </div>
  )
}

export function ProgressBar({ value, className, tone = 'signal', label }: { value: number; className?: string; tone?: 'signal' | 'text' | 'good'; label?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cx('h-full rounded-full transition-[width] duration-700 ease-out', tone === 'signal' ? 'bg-signal' : tone === 'good' ? 'bg-good-mark' : 'bg-text')}
        style={{ width: `${v * 100}%` }}
      />
    </div>
  )
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-[320px] text-[14px] leading-[1.45] text-text-2">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ───────────── Sheet (dialog) ─────────────

export function Sheet({ open, onClose, title, children, footer, tall }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // The latest onClose, without re-running the focus effect: parents re-render
  // (a clock ticking, a timer) and pass a new function each time; re-running the
  // effect used to pull focus out of the field being edited and close pickers.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? ref.current?.focus())
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="overlay-enter absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'sheet-enter relative flex w-full max-w-[640px] flex-col rounded-t-[16px] bg-surface shadow-[var(--shadow-sheet)] outline-none',
          tall ? 'h-[min(92dvh,calc(100dvh-var(--top-bar)-12px))]' : 'max-h-[min(88dvh,calc(100dvh-var(--top-bar)-12px))]',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
          <IconButton label={L('Fermer', 'Close')} onClick={onClose} className="-mr-2">
            <X size={20} aria-hidden />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Toaster() {
  const toast = useStore((s) => s.toast)
  const ref = useRef<number | null>(null)
  useEffect(() => {
    if (!toast) return
    if (ref.current) window.clearTimeout(ref.current)
    ref.current = window.setTimeout(() => useStore.setState({ toast: null }), toast.action ? 5000 : 2800)
  }, [toast])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+var(--top-clear))] z-[72] flex justify-center px-4">
      <div
        key={toast.id}
        role="status"
        className={cx(
          'overlay-enter pointer-events-auto flex max-w-[520px] items-center gap-2 rounded-[12px] border bg-surface px-4 py-3 text-[14px] shadow-[0_12px_40px_rgb(0_0_0/0.18)]',
          toast.tone === 'bad' ? 'border-bad-mark/50' : toast.tone === 'good' ? 'border-good-mark/50' : 'border-line',
        )}
      >
        {toast.tone === 'good' && <Check size={16} className="shrink-0 text-good" aria-hidden />}
        <span className="min-w-0 flex-1">{toast.message}</span>
        {toast.action && (
          <button type="button" onClick={() => { toast.action!.run(); useStore.setState({ toast: null }) }} className="pressable -my-1 shrink-0 rounded-[8px] px-2 py-1 text-[14px] font-semibold text-signal-text hover:bg-surface-2">
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
