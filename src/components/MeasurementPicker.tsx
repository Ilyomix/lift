import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type AriaAttributes, type FocusEventHandler } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, Keyboard } from 'lucide-react'
import { fmtNum, parseNumber } from '../lib/format'
import { L } from '../lib/i18n'
import { isNative } from '../lib/native/bridge'
import { Button, cx, inputClass, Sheet } from './ui'

type MeasurementPickerProps = {
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  onFocus?: FocusEventHandler<HTMLInputElement>
  onBlur?: FocusEventHandler<HTMLInputElement>
  min: number
  max: number
  strictBounds?: boolean
  step?: number
  defaultValue?: number
  placeholder?: string
  required?: boolean
  invalid?: boolean
  disabled?: boolean
  presentation?: 'inline' | 'sheet'
  inputClassName?: string
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: AriaAttributes['aria-invalid']
}

const TOUCH_POINTER = '(pointer: coarse), (any-pointer: coarse)'
const canUseWheel = () => isNative() || (typeof window !== 'undefined' && window.matchMedia(TOUCH_POINTER).matches)
function subscribePointer(change: () => void) {
  const media = window.matchMedia(TOUCH_POINTER)
  media.addEventListener('change', change)
  return () => media.removeEventListener('change', change)
}

/** Closing a changed wheel applies its draft; manual input retains the parent's validation and precision. */
export function MeasurementPicker({ label, unit, value, onChange, onFocus, onBlur, min, max, strictBounds = false, step = 1, defaultValue, placeholder = '—', required, invalid, disabled, presentation = 'sheet', inputClassName, className, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid }: MeasurementPickerProps) {
  const wheelAvailable = useSyncExternalStore(subscribePointer, canUseWheel, () => false)
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const draft = useRef<string | null>(null)
  const panel = useId()
  const parsed = parseNumber(value)
  const compact = presentation === 'sheet' && !!inputClassName
  const controlClass = inputClassName ?? inputClass
  const initialValue = parsed ?? defaultValue ?? (min + max) / 2
  const wheelValue = strictBounds ? Math.max(min, Math.min(max, initialValue)) : initialValue
  const close = () => {
    const next = draft.current
    draft.current = null
    setOpen(false)
    if (next !== null) onChange(next)
  }
  useEffect(() => {
    if (!wheelAvailable || disabled) { draft.current = null; setOpen(false) }
  }, [wheelAvailable, disabled])
  useEffect(() => {
    if (!open) return
    const commit = () => flushSync(close)
    document.addEventListener('lift:commit-measurements', commit)
    return () => document.removeEventListener('lift:commit-measurements', commit)
  }, [open, onChange])
  useEffect(() => {
    // A sheet owns its portal, focus trap and dismiss gesture. Only inline
    // wheels close when another control receives a press or keyboard focus.
    if (!open || presentation === 'sheet') return
    let pressing = false
    const outside = (event: Event) => container.current && !container.current.contains(event.target as Node)
    const click = (event: Event) => {
      pressing = false
      // Wait for release before collapsing the layout, but update a parent
      // form before the clicked Save/Continue handler reads its draft.
      if (outside(event)) flushSync(close)
    }
    const focus = (event: Event) => { if (!pressing && outside(event)) close() }
    const press = () => { pressing = true }
    const release = () => { pressing = false }
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('pointerup', release, true)
    document.addEventListener('pointercancel', release, true)
    document.addEventListener('keydown', release, true)
    document.addEventListener('click', click, true)
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('pointerup', release, true)
      document.removeEventListener('pointercancel', release, true)
      document.removeEventListener('keydown', release, true)
      document.removeEventListener('click', click, true)
      document.removeEventListener('focusin', focus)
    }
  }, [open, presentation, onChange])
  const wheel = open && wheelAvailable && !disabled && <MeasurementWheel id={panel} label={label} unit={unit} value={wheelValue} min={strictBounds ? min : Math.min(min, wheelValue)} max={strictBounds ? max : Math.max(max, wheelValue)} step={step}
    onClose={close} onDraft={next => { draft.current = next }} />
  return <div ref={container} className={cx('min-w-0', className)} data-swipe-ignore>
    {!wheelAvailable ? <div className="relative min-w-0"><input
      className={cx(controlClass, compact ? 'pb-3 text-center' : 'pr-11', 'disabled:opacity-40')} inputMode="decimal" aria-label={`${label} (${unit})`}
      required={required} disabled={disabled} aria-invalid={invalid || ariaInvalid || undefined} aria-describedby={describedBy} value={value} placeholder={placeholder}
      onChange={event => onChange(event.target.value)} onFocus={onFocus} onBlur={onBlur}
    /><span aria-hidden className={cx('pointer-events-none absolute flex items-center text-text-2', compact ? 'inset-x-0 bottom-1 justify-center text-[10px] leading-3' : 'inset-y-0 right-3 text-[11px]')}>{unit}</span></div>
      : <button type="button" className={cx(controlClass, 'pressable flex w-full items-center disabled:opacity-40', compact ? 'flex-col justify-center gap-0 text-center' : 'justify-between gap-1 text-left')}
        aria-label={`${label} : ${parsed === null ? placeholder : `${fmtNum(parsed, 6)} ${unit}`}`} disabled={disabled}
        aria-expanded={open} aria-controls={panel} aria-haspopup={presentation === 'sheet' ? 'dialog' : undefined} aria-invalid={invalid || ariaInvalid || undefined} aria-describedby={describedBy}
        onClick={() => {
          if (open) close()
          else {
            // A linked limit can invalidate a previously entered minimum or
            // maximum. Closing then applies the bounded value actually shown.
            draft.current = strictBounds && parsed !== null && parsed !== wheelValue ? String(wheelValue) : null
            setOpen(true)
          }
        }}>
        <span className={cx('whitespace-nowrap', compact && 'leading-5', parsed === null && 'text-muted')}>{parsed === null ? placeholder : fmtNum(parsed, 6)}</span>
        <span className={cx("flex shrink-0 items-center gap-1 text-text-2", inputClassName ? "text-[10px] leading-3" : "text-[11px]")}>{unit}{presentation !== 'sheet' && <ChevronDown size={12} className={cx('transition-transform', open && 'rotate-180')} aria-hidden />}</span>
      </button>}
    {presentation === 'sheet' ? <Sheet open={!!wheel} onClose={close} title={label}>{wheel}</Sheet> : wheel}
  </div>
}

const ROW = 44
const rounded = (value: number) => Number(value.toFixed(6))

function MeasurementWheel({ id, label, unit, value, min, max, step, onDraft, onClose }: {
  id: string; label: string; unit: string; value: number; min: number; max: number; step: number
  onDraft: (value: string) => void; onClose: () => void
}) {
  const clamp = (next: number) => rounded(Math.max(min, Math.min(max, next)))
  const [draft, setDraft] = useState(value)
  const [manual, setManual] = useState<string | null>(null)
  const whole = Math.floor(draft), fraction = rounded(draft - whole)
  const decimal = step < 1
  const change = (value: number) => {
    const next = clamp(value)
    setDraft(next)
    onDraft(String(next))
  }
  // Contain gestures on the frame as well as the columns: the unit and the
  // gaps must not hand their scroll to the page behind the wheel.
  return <div id={id} className="mt-2 overflow-y-auto overscroll-y-none rounded-[12px] border border-line bg-surface p-2" data-swipe-ignore
    onKeyDown={event => {
      if (event.key === 'Enter' && ((event.target as HTMLElement).getAttribute('role') === 'spinbutton' || (event.target as HTMLElement).tagName === 'INPUT')) { event.preventDefault(); onClose() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }}>
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[88px] h-11 rounded-[8px] bg-surface-2" />
      <div className="flex items-center justify-center gap-1" inert={manual !== null} aria-hidden={manual !== null || undefined}>
        <WheelColumn label={decimal ? L(`${label} : unités`, `${label}: whole number`) : `${label} (${unit})`}
          className={decimal ? "max-w-[92px] flex-1 [&>div]:justify-end [&>div]:pr-1" : undefined}
          value={decimal ? whole : draft} min={decimal ? Math.floor(min) : min} max={decimal ? Math.floor(max) : max} step={decimal ? 1 : step}
          onManual={() => setManual(String(draft))} onChange={next => change(decimal ? next + fraction : next)} />
        {decimal && <>
          <span aria-hidden className="relative text-[22px]">{L(',', '.')}</span>
          <WheelColumn label={L(`${label} : décimales`, `${label}: decimals`)} value={fraction} className="w-11 flex-none [&>div]:justify-start [&>div]:pl-1"
            min={whole === Math.floor(min) ? rounded(min - whole) : 0}
            max={whole === Math.floor(max) ? rounded(max - whole) : rounded(Math.floor((1 - 1e-8) / step) * step)} step={step}
            format={next => String(next).split('.')[1] ?? '0'}
            onManual={() => setManual(String(draft))} onChange={next => change(whole + next)} />
        </>}
        <span aria-hidden className="relative pr-1 text-[13px] text-text-2">{unit}</span>
      </div>
      {manual !== null && <div className="absolute inset-x-0 top-[88px] flex h-11 items-center rounded-[8px] bg-surface-2">
        <input autoFocus aria-label={`${label} (${unit})`} inputMode="decimal" value={manual}
          onFocus={event => event.currentTarget.select()} onChange={event => { setManual(event.target.value); onDraft(event.target.value) }}
          className="h-full min-w-0 flex-1 rounded-[8px] border border-signal bg-surface px-3 text-center text-[22px] text-text tnum outline-none" />
        <span aria-hidden className="px-2 text-[13px] text-text-2">{unit}</span>
      </div>}
    </div>
    {manual === null && <Button size="sm" variant="ghost" className="sr-only focus:not-sr-only focus:px-3 focus:py-2" icon={<Keyboard size={14} aria-hidden />} onClick={() => setManual(String(draft))}>{L('Saisir au clavier', 'Type a value')}</Button>}
  </div>
}

function WheelColumn({ label, value, min, max, step, onChange, onManual, format = (next: number) => fmtNum(next, 6), className }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; onManual: () => void
  format?: (value: number) => string; className?: string
}) {
  const initial = useRef(value)
  // Keep unit steps through 500; larger ranges use familiar 1/2/5 increments plus the exact original value.
  const values = useMemo(() => {
    const factor = Math.max(1, (max - min) / step / 500), power = 10 ** Math.floor(Math.log10(factor))
    const increment = step * [1, 2, 5, 10].find(next => next * power >= factor)! * power
    const choices = Array.from({ length: Math.floor((max - min) / increment + 1e-8) + 1 }, (_, index) => rounded(min + index * increment))
    return [...new Set([...choices, max, Math.max(min, Math.min(max, initial.current))])].sort((a, b) => a - b)
  }, [min, max, step])
  const bounded = (index: number) => Math.max(0, Math.min(values.length - 1, index))
  const selectedIndex = () => values.indexOf(value)
  const [position, setPosition] = useState(selectedIndex)
  const index = bounded(Math.round(position))
  const viewport = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const selected = bounded(selectedIndex())
    // Local scrolling owns momentum. Only another column changing bounds repositions it.
    if (viewport.current && Math.round(viewport.current.scrollTop / ROW) !== selected) {
      viewport.current.scrollTop = selected * ROW
      setPosition(selected)
    }
  }, [values])
  const move = (next: number) => {
    const chosen = bounded(next)
    setPosition(chosen)
    if (viewport.current) viewport.current.scrollTop = chosen * ROW
    onChange(values[chosen])
  }
  return <div ref={viewport} role="spinbutton" tabIndex={0} aria-label={label}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    className={cx('no-scrollbar relative h-[220px] min-w-0 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-[8px] py-[88px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal', className ?? 'flex-1')}
    style={{ perspective: 500, WebkitOverflowScrolling: 'touch' }}
    onScroll={event => {
      const next = bounded(event.currentTarget.scrollTop / ROW)
      setPosition(next)
      const selected = values[Math.round(next)]
      if (selected !== value) onChange(selected)
    }}
    onKeyDown={event => {
      const next = event.key === 'ArrowUp' ? index + 1 : event.key === 'ArrowDown' ? index - 1
        : event.key === 'PageUp' ? index + 10 : event.key === 'PageDown' ? index - 10
          : event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : null
      if (next !== null) { event.preventDefault(); move(next) }
    }}>
    {values.map((number, item) => {
      const distance = Math.abs(item - position)
      return <div key={number} aria-hidden onClick={() => item === index ? onManual() : move(item)}
        className={cx('flex h-11 shrink-0 snap-center cursor-pointer items-center justify-center text-[22px] tnum', item === index ? 'font-semibold text-text' : 'text-text-2')}
        style={{ transform: `rotateX(${Math.max(-55, Math.min(55, (item - position) * 18))}deg) scale(${Math.max(.8, 1 - distance * .07)})`, opacity: Math.max(.35, 1 - distance * .2) }}>
        {format(number)}
      </div>
    })}
  </div>
}
