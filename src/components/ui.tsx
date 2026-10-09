import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type AriaAttributes, type ButtonHTMLAttributes, type ReactEventHandler, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Pencil, Undo2, X } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { addMonths, capitalize, dayLetter, fmtDate, monthName, todayISO } from '../lib/date'
import { L, locale } from '../lib/i18n'
import { back } from '../lib/router'
import { useStore } from '../lib/store'
import { SportArt, type SportArtKind } from './SportArt'
import { useDismissGesture } from './useDismissGesture'
import { useDiscardConfirmation, useUnsavedChanges } from '../lib/unsavedChanges'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ───────────── Buttons ─────────────

type Variant = 'primary' | 'ink' | 'outline' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg'
type SheetAction = () => unknown
type SheetClose = (action: SheetAction, validate?: () => boolean | Promise<boolean>) => void
const SheetCloseContext = createContext<SheetClose>((action, validate) => {
  const allowed = validate ? validate() : true
  if (allowed instanceof Promise) void allowed.then(ok => { if (ok) void action() })
  else if (allowed) void action()
})
const SheetDiscardContext = createContext<() => Promise<boolean>>(async () => true)

/** Defer only an action that has already passed validation and will close this sheet. */
export function SheetAction({ children }: { children: (close: SheetClose, confirmDiscard: () => Promise<boolean>) => ReactNode }) {
  return children(useContext(SheetCloseContext), useContext(SheetDiscardContext))
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-signal text-signal-ink hover:brightness-105 font-semibold',
  ink: 'bg-text text-bg hover:opacity-90 font-semibold',
  outline: 'border border-line-strong text-text hover:border-muted bg-transparent font-medium',
  ghost: 'text-text-2 hover:text-text hover:bg-surface-2 font-medium',
  danger: 'border border-line-strong text-bad hover:border-bad-mark bg-transparent font-medium',
  soft: 'bg-surface-2 text-text hover:bg-surface-3 font-medium',
}
const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3 py-2 text-[13px] gap-1.5 rounded-[9px]',
  md: 'min-h-11 px-4 py-2.5 text-sm gap-2 rounded-[10px]',
  lg: 'min-h-[52px] px-5 py-3 text-[15px] gap-2 rounded-[12px]',
}

type ButtonStyle = { variant?: Variant; size?: Size; full?: boolean; icon?: ReactNode }
function buttonClass(variant: Variant, size: Size, full?: boolean, className?: string) {
  return cx('pressable inline-flex min-w-0 items-center justify-center text-center leading-5 select-none disabled:opacity-40 disabled:pointer-events-none [&>svg]:shrink-0',
    full ? 'w-full whitespace-normal' : 'whitespace-nowrap', VARIANTS[variant], SIZES[size], className)
}

export function Button({
  variant = 'outline', size = 'md', full, icon, children, className, closeSheet, onClick, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyle & { closeSheet?: boolean | (() => boolean | Promise<boolean>) }) {
  const close = useContext(SheetCloseContext)
  const click = closeSheet && onClick ? (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    close(() => onClick(event), typeof closeSheet === 'function' ? closeSheet : undefined)
  } : onClick
  return (
    <button
      type="button"
      {...rest}
      onClick={click}
      className={buttonClass(variant, size, full, className)}
    >
      {icon}
      {children}
    </button>
  )
}

export function LinkButton({ variant = 'outline', size = 'md', full, icon, children, className, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonStyle) {
  return <a {...rest} className={buttonClass(variant, size, full, className)}>{icon}{children}</a>
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
  return <main className={cx('screen-in mx-auto w-full max-w-[640px] px-4 pb-[calc(96px+env(safe-area-inset-bottom)+var(--page-actions-height,0px)+var(--rest-dock-height,0px))] safe-top', className)}>{children}</main>
}

/** Keep draft actions reachable without covering the page or its rest timer. */
export function PageActions({ visible, children }: { visible: boolean; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const screen = anchor.current?.closest<HTMLElement>('main')
    const element = bar.current
    if (!visible || !screen || !element) return
    const measure = () => screen.style.setProperty('--page-actions-height', `${element.getBoundingClientRect().height}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { observer.disconnect(); screen.style.removeProperty('--page-actions-height') }
  }, [visible])
  return <><span ref={anchor} hidden />{visible && createPortal(
    <div ref={bar} data-page-actions className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom)+var(--rest-dock-height,0px))] z-40 border-t border-line bg-bg px-4 py-3">
      <div className="mx-auto grid max-w-[608px] gap-2">{children}</div>
    </div>, document.body,
  )}</>
}

export function Header({ eyebrow, title, backTo, right, sub, art, artSize = 'illustration' }: { eyebrow?: ReactNode; title: ReactNode; backTo?: string; right?: ReactNode; sub?: ReactNode; art?: SportArtKind; artSize?: 'title' | 'illustration' }) {
  return (
    <header className="pt-2 pb-5">
      {backTo !== undefined && <div className="mb-1 flex min-h-11 items-center">
        <button type="button" onClick={() => back(backTo)} className="pressable -ml-2 inline-flex h-11 items-center gap-1 rounded-[10px] px-2 text-sm font-medium text-text-2 hover:text-text">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          {L('Retour', 'Back')}
        </button>
      </div>}
      <div className="flex items-start gap-2">
        {art && <SportArt kind={art} size={artSize} />}
        <div className="min-w-0 flex-1">
          <div className="flex min-h-8 min-w-0 items-center justify-between gap-2">
            <h1 className={cx('min-w-0 break-words font-semibold leading-[1.05] tracking-[-0.03em] text-text', right ? 'text-[28px] min-[400px]:text-[32px]' : 'text-[32px]')}>{title}</h1>
            {right && <div className="min-w-0 max-w-[55%] shrink-0">{right}</div>}
          </div>
          {eyebrow && <div className="mt-1.5 text-[13px] leading-[1.4] text-text-2">{eyebrow}</div>}
          {sub && <p className="mt-1.5 text-[14px] leading-[1.45] text-text-2">{sub}</p>}
        </div>
      </div>
    </header>
  )
}

/** Shared heading rhythm for sections and compact sheet content. */
export function SectionHeading({ children, icon, action, className }: { children: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
    {children && <h2 className="flex min-w-0 items-center gap-2 text-[17px] leading-6 font-semibold tracking-[-0.015em]">
      {icon && <span className="inline-flex shrink-0 text-text-2 [&>svg]:size-[18px]" aria-hidden>{icon}</span>}
      <span className="min-w-0">{children}</span>
    </h2>}
    {action && <div className="min-w-0 max-w-full">{action}</div>}
  </div>
}

export function Section({ title, action, children, className, art, icon }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; art?: SportArtKind; icon?: ReactNode }) {
  return (
    <section className={cx('mt-6', className)}>
      {(title || action) && (
        <div className={cx('mb-3', art && 'flex items-center gap-2')}>
          {art && <SportArt kind={art} size="title" />}
          <SectionHeading icon={art ? undefined : icon} action={action} className={art ? 'min-w-0 flex-1' : undefined}>{title}</SectionHeading>
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

export function Disclosure({ title, icon, children, className, contentClassName, defaultOpen, onToggle, bordered = true }: { title: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; contentClassName?: string; defaultOpen?: boolean; onToggle?: ReactEventHandler<HTMLDetailsElement>; bordered?: boolean }) {
  return <details open={defaultOpen || undefined} onToggle={onToggle} className={cx('disclosure min-w-0', bordered && 'border-y border-line', className)}>
    <summary className="pressable flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] py-3 text-[15px] font-medium leading-5 text-text-2 hover:text-text">
      {icon && <span className="shrink-0" aria-hidden>{icon}</span>}
      <span className="min-w-0 flex-1">{title}</span>
      <ChevronDown size={18} className="disclosure-chevron shrink-0 text-muted" aria-hidden />
    </summary>
    <div className={cx('min-w-0 pb-4', contentClassName)}>{children}</div>
  </details>
}

export function Segmented<T extends string>({ value, options, onChange, className, label, disabled, layout = 'fit' }: { value: T | undefined; options: { value: T; label: ReactNode; icon?: ReactNode }[]; onChange: (v: T) => void; className?: string; label: string; disabled?: boolean; layout?: 'scroll' | 'fit' }) {
  const groupRef = useRef<HTMLDivElement>(null)
  const selected = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const update = () => {
      group.dataset.scrollStart = String(group.scrollLeft > 1)
      group.dataset.scrollEnd = String(group.scrollWidth - group.clientWidth - group.scrollLeft > 1)
    }
    const observer = new ResizeObserver(update)
    observer.observe(group)
    for (const button of group.children) observer.observe(button)
    group.addEventListener('scroll', update, { passive: true })
    update()
    return () => { observer.disconnect(); group.removeEventListener('scroll', update) }
  }, [options.length])
  useLayoutEffect(() => {
    const button = selected.current, group = button?.parentElement
    if (!button || !group) return
    const item = button.getBoundingClientRect(), bounds = group.getBoundingClientRect()
    const left = bounds.left + (button.previousElementSibling ? 24 : 0)
    const right = bounds.right - (button.nextElementSibling ? 24 : 0)
    group.scrollLeft += item.left < left ? item.left - left : Math.max(0, item.right - right)
  }, [value])
  return (
    <div ref={groupRef} role="group" aria-label={label} className={cx('segmented flex w-full min-w-0 gap-1 overflow-x-auto no-scrollbar', layout === 'scroll' && '-mx-4 px-4', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={active ? selected : undefined}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'pressable inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-2 text-[13px] font-semibold leading-5 whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none',
              layout === 'fit' ? 'min-w-max flex-1' : 'shrink-0',
              active ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2 hover:text-text',
            )}
          >
            {o.icon ? <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
              <span className="inline-flex size-4 shrink-0 [&>svg]:size-4" aria-hidden>{o.icon}</span>
              <span className="min-w-0">{o.label}</span>
            </span> : o.label}
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

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  const child = isValidElement<AriaAttributes>(children) && (typeof children.type === 'function' || (typeof children.type === 'string' && ['input', 'textarea', 'select'].includes(children.type))) ? children : undefined
  // Composite pickers own their accessible name. Wrapping their wheel in a
  // label forwards taps on the selected value to its first button and closes it.
  const Label = child && typeof child.type === 'string' ? 'label' : 'div'
  const control = child ? cloneElement(child, {
    'aria-describedby': [child.props['aria-describedby'], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
    'aria-invalid': error ? true : child.props['aria-invalid'],
  }) : children
  return (
    <div className={cx('block min-w-0', className)}>
      <Label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-text-2">{label}</span>
        {control}
      </Label>
      {hint && <span id={`${id}-hint`} className="mt-1 block text-[12px] text-muted">{hint}</span>}
      {error && <span id={`${id}-error`} className="mt-1 block text-[13px] leading-[18px] text-bad">{error}</span>}
    </div>
  )
}

export const inputClass =
  'h-12 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[16px] text-text tnum placeholder:text-muted focus:border-signal focus:outline-none aria-invalid:border-bad-mark'

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
          <span className={cx('min-w-0 flex-1 truncate text-[16px]', value ? 'text-text' : 'text-muted')}>{text}</span>
          <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {clearable && value && (
          <button type="button" onClick={() => { onChange(''); setOpen(false) }} aria-label={L('Effacer la date', 'Clear date')} className="pressable mr-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-muted hover:text-text">
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
        <IconButton label={L('Mois précédent', 'Previous month')} disabled={!canPrev} onClick={() => onMonth(prev)}><ChevronLeft size={18} /></IconButton>
        <p className="text-[15px] font-semibold capitalize">{monthName(m - 1)} <span className="text-text-2">{y}</span></p>
        <IconButton label={L('Mois suivant', 'Next month')} disabled={!canNext} onClick={() => onMonth(next)}><ChevronRight size={18} /></IconButton>
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

export function Empty({ art = 'chart', icon, title, children, action }: { art?: SportArtKind; icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-5 py-8 text-center sm:py-10">
      <div className="mb-4 flex h-16 items-center justify-center text-signal-text" aria-hidden>{icon ?? <SportArt kind={art} size="illustration" />}</div>
      <p className="max-w-[360px] text-[16px] leading-[1.35] font-semibold text-balance">{title}</p>
      {children && <p className="mt-2 max-w-[320px] text-[14px] leading-[1.55] text-pretty text-text-2">{children}</p>}
      {action && <div className="mt-5 flex max-w-full flex-wrap justify-center gap-2 [&>button]:max-w-full [&>button]:whitespace-normal">{action}</div>}
    </div>
  )
}

// ───────────── Sheet (dialog) ─────────────

const sheetPanels: HTMLElement[] = []
const LOCKED_STYLES = ['position', 'top', 'left', 'right', 'overflow'] as const
let pageLock: { scrollY: number; route: string; style: Record<string, string> } | null = null
// iOS scrolls the page to reveal a focused field even under overflow: hidden.
// Pinning the body at its offset keeps the page still behind every sheet.
function lockPage() {
  const style = document.body.style
  pageLock = { scrollY: window.scrollY ?? 0, route: window.location?.hash ?? '', style: Object.fromEntries(LOCKED_STYLES.map(key => [key, style[key]])) }
  Object.assign(style, { position: 'fixed', top: `${-pageLock.scrollY}px`, left: '0', right: '0', overflow: 'hidden' })
}
// Only the top sheet stays reachable: the keyboard's ⌃ ⌄ and VoiceOver follow
// the DOM, and must not land on a field hidden behind it.
function syncInert() {
  const top = sheetPanels.at(-1)?.parentElement
  for (const element of Array.from(document.body.children ?? [])) (element as HTMLElement).inert = !!top && element !== top
}
function unlockPage() {
  if (!pageLock) return
  const { scrollY, route, style } = pageLock
  pageLock = null
  Object.assign(document.body.style, style)
  // A sheet action that opened another screen leaves it at its top.
  if ((window.location?.hash ?? '') === route) window.scrollTo?.({ top: scrollY, left: 0, behavior: 'instant' })
}

export function Sheet({ open, onClose, title, icon, children, footer, tall, dirty = false }: { open: boolean; onClose: () => void; title: ReactNode; icon?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean; dirty?: boolean }) {
  const guard = useUnsavedChanges(open && dirty)
  const ref = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const [present, setPresent] = useState(open)
  const [revision, setRevision] = useState(0)
  const snapshot = useRef({ title, icon, children, footer, tall })
  if (open) snapshot.current = { title, icon, children, footer, tall }
  const openRef = useRef(open)
  openRef.current = open
  const closing = useRef(false)
  const pendingAction = useRef<SheetAction | null>(null)
  const visible = open || present
  const dismiss = useDismissGesture(ref, visible, () => {
    setPresent(false)
    const action = pendingAction.current
    pendingAction.current = null
    if (!action) { if (openRef.current) onClose(); return }
    // The action owns the parent's state/navigation. If an asynchronous action
    // refuses to close, restore the live panel rather than leaving it offscreen.
    void Promise.resolve().then(action).catch(() => {
      useStore.getState().notify(L('Impossible d’enregistrer. Tes modifications sont conservées.', 'Could not save. Your changes are kept.'), 'bad')
    }).finally(() => requestAnimationFrame(() => {
      // Let React commit the action's parent state before deciding whether the
      // operation stayed open. Otherwise a successful save can exit twice.
      if (openRef.current) { guard.rearm(); closing.current = false; setPresent(true); setRevision(value => value + 1) }
    }))
  }, backdrop, revision, () => !openRef.current || !!pendingAction.current || guard.confirm())
  const closeAfter: SheetClose = (action, validate) => {
    if (closing.current) return
    closing.current = true
    const proceed = (allowed: boolean) => {
      if (!allowed) { guard.rearm(); closing.current = false; return }
      guard.discard()
      pendingAction.current = action
      dismiss()
    }
    try {
      const allowed = validate ? validate() : true
      if (allowed instanceof Promise) void allowed.then(proceed).catch(() => proceed(false))
      else proceed(allowed)
    } catch { proceed(false) }
  }
  useEffect(() => {
    openRef.current = open
    return () => { openRef.current = false; pendingAction.current = null }
  }, [])
  useEffect(() => {
    if (open) {
      setPresent(true)
      if (closing.current) {
        closing.current = false
        pendingAction.current = null
        setRevision(value => value + 1)
      }
    } else if (present) {
      closing.current = true
      dismiss()
    }
  }, [open, dismiss])
  const titleId = useId()
  // dismiss stays stable while the hook keeps the latest parent callback;
  // ticking parents must not reset focus or interrupt an open picker.
  useEffect(() => {
    if (!visible) return
    const panel = ref.current!
    const prev = document.activeElement as HTMLElement | null
    if (!sheetPanels.length) lockPage()
    sheetPanels.push(panel)
    syncInert()
    const onKey = (e: KeyboardEvent) => {
      if (sheetPanels.at(-1) !== panel) return
      if (e.key === 'Escape') { e.preventDefault(); dismiss() }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
          .filter(element => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0)
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // Start on an explicit autofocus target or Close, keeping the dialog's first action reachable.
    const focusFrame = requestAnimationFrame(() => { if (sheetPanels.at(-1) === panel) (panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>('[data-sheet-handle] button') ?? panel).focus({ preventScroll: true }) })
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKey)
      const wasTop = sheetPanels.at(-1) === panel
      const index = sheetPanels.indexOf(panel)
      if (index !== -1) sheetPanels.splice(index, 1)
      syncInert()
      if (!sheetPanels.length) unlockPage()
      if (wasTop && prev?.isConnected !== false) prev?.focus?.({ preventScroll: true })
    }
  }, [visible, dismiss])
  if (!visible) return null
  const content = open ? { title, icon, children, footer, tall } : snapshot.current
  return createPortal(
    <SheetCloseContext value={closeAfter}><SheetDiscardContext value={async () => { const allowed = await guard.confirm(); guard.rearm(); return allowed }}>
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div ref={backdrop} className="overlay-enter absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={dismiss} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'sheet-enter relative flex w-full max-w-[640px] flex-col rounded-t-[16px] bg-surface shadow-[var(--shadow-sheet)] outline-none',
          content.tall ? 'h-[min(92dvh,calc(100dvh-var(--top-bar)-12px))]' : 'max-h-[min(88dvh,calc(100dvh-var(--top-bar)-12px))]',
        )}
      >
        <div data-sheet-handle className="shrink-0 touch-none select-none pt-2">
          <div aria-hidden className="mx-auto h-1 w-8 rounded-full bg-line-strong" />
          <div className="flex items-center justify-between gap-3 px-4 pt-1 pb-2">
          <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-[17px] leading-6 font-semibold tracking-[-0.015em]">
            {content.icon && <span className="inline-flex shrink-0 text-text-2 [&>svg]:size-[18px]" aria-hidden>{content.icon}</span>}
            <span className="min-w-0">{content.title}</span>
          </h2>
          <IconButton label={L('Fermer', 'Close')} onClick={dismiss} className="-mr-2">
            <X size={20} aria-hidden />
          </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{content.children}</div>
        {content.footer && <div className="border-t border-line px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{content.footer}</div>}
      </div>
    </div>
    </SheetDiscardContext></SheetCloseContext>,
    document.body,
  )
}

export function DiscardChanges() {
  const { open, resolve } = useDiscardConfirmation()
  return <Sheet open={open} onClose={() => resolve(false)} icon={<Pencil size={18} aria-hidden />} title={L('Modifications non enregistrées', 'Unsaved changes')}
    footer={<div className="grid gap-2">
      <Button full variant="primary" icon={<Pencil size={18} aria-hidden />} closeSheet onClick={() => resolve(false)}>{L('Continuer la modification', 'Keep editing')}</Button>
      <Button full variant="outline" icon={<X size={18} aria-hidden />} closeSheet onClick={() => resolve(true)}>{L('Quitter sans enregistrer', 'Leave without saving')}</Button>
    </div>}>
    <p className="text-[14px] leading-[1.5] text-text-2">{L('En quittant, les modifications de ce formulaire seront perdues.', 'Leaving will discard the changes to this form.')}</p>
  </Sheet>
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
          <button type="button" onClick={() => { toast.action!.run(); useStore.setState({ toast: null }) }} className="pressable -my-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[8px] px-2 py-1 text-[14px] font-semibold text-signal-text hover:bg-surface-2">
            <Undo2 size={14} className="mr-1.5 shrink-0" aria-hidden />
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
