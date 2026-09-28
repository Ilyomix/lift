import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fmtDate, fromDayNumber } from '../lib/date'
import { fmtNum } from '../lib/format'
import { L } from '../lib/i18n'
import { cx } from './ui'

// Mark specs (dataviz): 2px lines, ≥8px markers with a 2px surface ring, hairline
// recessive grid, text in ink tokens (never the series colour), selective labels.

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    setW(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min]
  const span = max - min
  const step0 = span / Math.max(1, count - 1)
  const mag = 10 ** Math.floor(Math.log10(step0))
  const norm = step0 / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag
  const start = Math.ceil(min / step) * step
  const out: number[] = []
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(6)))
  return out
}

export interface ChartPoint {
  x: number
  y: number
}

export interface ChartSeries {
  id: string
  label: string
  points: ChartPoint[]
  kind: 'line' | 'dots' | 'dashed'
  color: string
  endLabel?: boolean
}

export function LineChart({
  series, height = 188, yFormat = (v) => fmtNum(v), xFormat = (x) => fmtDate(fromDayNumber(x)), band, refLine, yPad = 0.08, ariaLabel, xDomain, legend,
}: {
  series: ChartSeries[]
  height?: number
  yFormat?: (v: number) => string
  xFormat?: (x: number) => string
  band?: { y0: number; y1: number; label: string }
  refLine?: { y: number; label: string }
  yPad?: number
  ariaLabel: string
  xDomain?: [number, number]
  legend?: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.points)
  const m = { l: 40, r: 14, t: 12, b: 24 }
  const iw = Math.max(10, width - m.l - m.r)
  const ih = height - m.t - m.b

  const scales = useMemo(() => {
    if (!all.length) return null
    let x0 = xDomain?.[0] ?? Math.min(...all.map((p) => p.x))
    let x1 = xDomain?.[1] ?? Math.max(...all.map((p) => p.x))
    if (x0 === x1) {
      x0 -= 3
      x1 += 3
    }
    const ys = [...all.map((p) => p.y), ...(band ? [band.y0, band.y1] : []), ...(refLine ? [refLine.y] : [])]
    let y0 = Math.min(...ys)
    let y1 = Math.max(...ys)
    const pad = (y1 - y0 || Math.abs(y1) * 0.1 || 1) * yPad
    y0 -= pad
    y1 += pad
    const ticks = niceTicks(y0, y1, 4)
    y0 = Math.min(y0, ticks[0])
    y1 = Math.max(y1, ticks[ticks.length - 1])
    return {
      x: (v: number) => m.l + ((v - x0) / (x1 - x0)) * iw,
      y: (v: number) => m.t + (1 - (v - y0) / (y1 - y0)) * ih,
      ticks, x0, x1,
    }
  }, [all, band, refLine, iw, ih, xDomain, yPad, m.l, m.t])

  if (!all.length) return <div ref={ref} className="flex h-24 items-center justify-center text-[13px] text-muted">{L('Pas encore de données', 'No data yet')}</div>

  const primary = series.find((s) => s.kind === 'line') ?? series[0]
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b)
  const hovered = hover !== null && scales ? xs.reduce((best, x) => (Math.abs(scales.x(x) - hover) < Math.abs(scales.x(best) - hover) ? x : best), xs[0]) : null

  const onPointer = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    setHover(e.clientX - r.left)
  }

  const path = (pts: ChartPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${scales!.x(p.x).toFixed(1)},${scales!.y(p.y).toFixed(1)}`).join('')
  const last = primary.points[primary.points.length - 1]
  const showLegend = legend ?? series.length > 1

  return (
    <div className="w-full">
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && scales && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
            {scales.ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={scales.y(t)} y2={scales.y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={m.l - 8} y={scales.y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tnum">{yFormat(t)}</text>
              </g>
            ))}
            {band && (
              <g>
                <rect x={m.l} width={iw} y={scales.y(band.y1)} height={Math.max(1, scales.y(band.y0) - scales.y(band.y1))} fill="color-mix(in oklch, var(--signal) 10%, transparent)" />
                <text x={m.l + 6} y={scales.y(band.y1) + 13} className="fill-text-2 text-[11px] font-medium">{band.label}</text>
              </g>
            )}
            {refLine && (
              <g>
                <line x1={m.l} x2={width - m.r} y1={scales.y(refLine.y)} y2={scales.y(refLine.y)} stroke="var(--line-strong)" strokeWidth={1} />
                <text x={width - m.r} y={scales.y(refLine.y) - 5} textAnchor="end" className="fill-text-2 text-[11px] font-medium">{refLine.label}</text>
              </g>
            )}
            {[scales.x0, scales.x1].map((x, i) => (
              <text key={i} x={scales.x(x)} y={height - 6} textAnchor={i ? 'end' : 'start'} className="fill-muted text-[11px]">{xFormat(x)}</text>
            ))}
            {series.map((s) =>
              s.kind === 'dots' ? (
                <g key={s.id}>
                  {s.points.map((p, i) => (
                    <circle key={i} cx={scales.x(p.x)} cy={scales.y(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                </g>
              ) : (
                <path key={s.id} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.kind === 'dashed' ? '5 5' : undefined} />
              ),
            )}
            {last && primary.kind === 'line' && (
              <g>
                <circle cx={scales.x(last.x)} cy={scales.y(last.y)} r={4.5} fill={primary.color} stroke="var(--surface)" strokeWidth={2} />
                {primary.endLabel !== false && (
                  <text x={Math.min(scales.x(last.x), width - m.r)} y={scales.y(last.y) - 10} textAnchor="end" className="fill-text text-[12px] font-semibold tnum">{yFormat(last.y)}</text>
                )}
              </g>
            )}
            {hovered !== null && (
              <g pointerEvents="none">
                <line x1={scales.x(hovered)} x2={scales.x(hovered)} y1={m.t} y2={m.t + ih} stroke="var(--line-strong)" strokeWidth={1} />
                {series.map((s) => {
                  const p = s.points.find((q) => q.x === hovered)
                  return p ? <circle key={s.id} cx={scales.x(p.x)} cy={scales.y(p.y)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null
                })}
              </g>
            )}
            <rect
              x={m.l} y={m.t} width={iw} height={ih} fill="transparent" style={{ touchAction: 'pan-y' }}
              onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {hovered !== null && scales && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.12)]"
            style={{ left: Math.min(Math.max(scales.x(hovered), 70), width - 70) }}
          >
            <div className="text-muted">{xFormat(hovered)}</div>
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hovered)
              return p ? (
                <div key={s.id} className="flex items-center gap-1.5 font-semibold tnum text-text">
                  <Key kind={s.kind} color={s.color} />
                  {yFormat(p.y)}
                  {series.length > 1 && <span className="font-normal text-text-2">{s.label}</span>}
                </div>
              ) : null
            })}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[12px] text-text-2">
              <Key kind={s.kind} color={s.color} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Key({ kind, color }: { kind: ChartSeries['kind']; color: string }) {
  if (kind === 'dots') return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
  return (
    <svg width="14" height="8" aria-hidden className="shrink-0">
      <line x1="1" x2="13" y1="4" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={kind === 'dashed' ? '3 3' : undefined} />
    </svg>
  )
}

export function Columns({
  bars, height = 150, target, format = (v) => fmtNum(v), ariaLabel, highlightLast = true,
}: {
  bars: { key: string; label: string; value: number; tooltip?: ReactNode }[]
  height?: number
  target?: { value: number; label: string }
  format?: (v: number) => string
  ariaLabel: string
  highlightLast?: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const m = { l: 4, r: 4, t: 18, b: 22 }
  const ih = height - m.t - m.b
  const max = Math.max(1, ...bars.map((b) => b.value), target?.value ?? 0) * 1.08
  const slot = bars.length ? (width - m.l - m.r) / bars.length : 0
  const bw = Math.min(24, Math.max(6, slot - 6))
  const y = (v: number) => m.t + ih - (v / max) * ih
  const labelEvery = Math.ceil(bars.length / 7)
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <line x1={m.l} x2={width - m.r} y1={m.t + ih} y2={m.t + ih} stroke="var(--line-strong)" strokeWidth={1} />
          {target && (
            <g>
              <line x1={m.l} x2={width - m.r} y1={y(target.value)} y2={y(target.value)} stroke="var(--line-strong)" strokeWidth={1} />
              <text x={width - m.r} y={y(target.value) - 5} textAnchor="end" className="fill-text-2 text-[11px] font-medium">{target.label}</text>
            </g>
          )}
          {bars.map((b, i) => {
            const cx0 = m.l + slot * i + slot / 2
            const h = Math.max(b.value > 0 ? 2 : 0, (b.value / max) * ih)
            const x = cx0 - bw / 2
            const top = m.t + ih - h
            const r = Math.min(4, h / 2, bw / 2)
            const isLast = i === bars.length - 1
            const color = (highlightLast && isLast) || active === i ? 'var(--chart-1)' : 'color-mix(in oklch, var(--text) 30%, transparent)'
            return (
              <g key={b.key} onPointerDown={() => setActive(active === i ? null : i)} style={{ cursor: 'pointer' }}>
                <rect x={m.l + slot * i} y={m.t} width={slot} height={ih + m.b} fill="transparent" />
                {h > 0 && (
                  <path d={`M${x},${m.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${m.t + ih} Z`} fill={color} />
                )}
                {(isLast || active === i) && b.value > 0 && (
                  <text x={cx0} y={top - 5} textAnchor="middle" className="fill-text text-[11px] font-semibold tnum">{format(b.value)}</text>
                )}
                {i % labelEvery === 0 && (
                  <text x={cx0} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">{b.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {active !== null && bars[active]?.tooltip && (
        <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[0_6px_20px_rgb(0_0_0/0.12)]">
          {bars[active].tooltip}
        </div>
      )}
    </div>
  )
}

/** Weekly hard sets per muscle against the 10–20 evidence band. */
export function RangeBars({ rows, min = 10, max = 20, domain = 24 }: { rows: { key: string; label: string; value: number; planned?: number }[]; min?: number; max?: number; domain?: number }) {
  const top = Math.max(domain, ...rows.map((r) => Math.max(r.value, r.planned ?? 0)))
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const state = r.value < min ? 'low' : r.value > max ? 'high' : 'ok'
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-text-2">{r.label}</span>
              <span className="text-[13px] font-semibold tnum">
                {fmtNum(r.value)}
                {r.planned !== undefined && <span className="font-normal text-muted">{L(` / ${fmtNum(r.planned)} prévues`, ` / ${fmtNum(r.planned)} planned`)}</span>}
              </span>
            </div>
            <div className="relative h-2.5 w-full rounded-full bg-surface-3">
              <div className="absolute inset-y-0 rounded-full" style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})`, background: 'color-mix(in oklch, var(--signal) 18%, transparent)' }} />
              <div
                className={cx('absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out', state === 'low' ? 'bg-[color-mix(in_oklch,var(--text)_35%,transparent)]' : 'bg-[var(--chart-1)]')}
                style={{ width: pct(r.value) }}
              />
              {r.planned !== undefined && <div className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded-full bg-text" style={{ left: `calc(${pct(r.planned)} - 1px)` }} aria-hidden />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Sparkline({ values, width = 84, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => 3 + (i / (values.length - 1)) * (width - 6)
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const lx = x(values.length - 1)
  const ly = y(values[values.length - 1])
  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  )
}
