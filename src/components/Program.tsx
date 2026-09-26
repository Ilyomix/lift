import { Check } from 'lucide-react'
import { DAYS_LETTER, diffDays, parseISO, todayISO } from '../lib/date'
import { FOUNDATION_START, GOAL_DATE, PERIODS, TYPE_META, type Period } from '../lib/program'
import type { DayStatus } from '../lib/stats'
import { cx } from './ui'

const TOTAL = diffDays(FOUNDATION_START, GOAL_DATE) + 1

function fill(p: Period): { className: string; style?: React.CSSProperties } {
  if (p.kind === 'deload') return { className: 'hatch bg-surface-3' }
  if (p.kind === 'pre' || p.kind === 'holiday') return { className: 'bg-surface-3' }
  if (p.kind === 'stabilization') return { className: 'bg-signal' }
  if (p.phase === 'recomp') return { className: '', style: { background: 'color-mix(in oklch, var(--text) 42%, transparent)' } }
  return { className: '', style: { background: 'color-mix(in oklch, var(--text) 82%, transparent)' } }
}

/** The whole program on one mechanical track, today marked. */
export function PhaseTrack({ today = todayISO(), showLabels = true }: { today?: string; showLabels?: boolean }) {
  const pos = Math.min(1, Math.max(0, diffDays(FOUNDATION_START, today) / TOTAL))
  const months: { label: string; at: number }[] = []
  for (let m = parseISO(FOUNDATION_START); m <= parseISO(GOAL_DATE); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
    if (iso < FOUNDATION_START) continue
    months.push({ label: 'JFMAMJJASOND'[m.getMonth()], at: diffDays(FOUNDATION_START, iso) / TOTAL })
  }
  const recomp = PERIODS.filter((p) => p.phase === 'recomp')
  const cut = PERIODS.filter((p) => ['cut', 'cut-end', 'diet-break'].includes(p.phase))
  const span = (ps: Period[]) => ({ left: diffDays(FOUNDATION_START, ps[0].start) / TOTAL, right: (diffDays(FOUNDATION_START, ps[ps.length - 1].end) + 1) / TOTAL })
  const r = span(recomp)
  const c = span(cut)
  return (
    <div className="w-full" role="img" aria-label="Calendrier du programme : fondation, recomposition jusqu’au 3 janvier, sèche du 4 janvier au 13 juin, stabilisation jusqu’au 30 juin.">
      <div className="relative h-3 w-full">
        {PERIODS.map((p) => {
          const left = diffDays(FOUNDATION_START, p.start) / TOTAL
          const width = (diffDays(p.start, p.end) + 1) / TOTAL
          const f = fill(p)
          return <div key={p.id} className={cx('absolute inset-y-0', f.className)} style={{ left: `calc(${left * 100}% + 1px)`, width: `calc(${width * 100}% - 2px)`, ...f.style }} />
        })}
        <div className="absolute -top-1.5 -bottom-1.5 w-[2px] -translate-x-1/2 rounded-full bg-signal" style={{ left: `${pos * 100}%` }} />
        <div className="absolute -top-[9px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-bg bg-signal" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="relative mt-1.5 h-4 w-full">
        {months.map((m, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-[10px] font-medium text-muted" style={{ left: `${m.at * 100}%` }}>{m.label}</span>
        ))}
      </div>
      {showLabels && (
        <div className="relative mt-1 h-4 w-full text-[11px] font-semibold">
          <span className="absolute truncate text-text-2" style={{ left: `${r.left * 100}%`, width: `${(r.right - r.left) * 100}%` }}>Recomposition</span>
          <span className="absolute truncate text-text-2" style={{ left: `${c.left * 100}%`, width: `${(c.right - c.left) * 100}%` }}>Sèche</span>
        </div>
      )}
    </div>
  )
}

export function WeekStrip({ days }: { days: DayStatus[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const done = d.done[0]
        const code = done ? TYPE_META[done.type].code : d.planned ? TYPE_META[d.planned].code : null
        const label = done ? `${TYPE_META[done.type].label} faite` : d.planned ? `${TYPE_META[d.planned].label} prévue` : d.paused ? 'Pause' : 'Repos'
        return (
          <li key={d.date} className="flex flex-col items-center gap-1.5" aria-label={`${parseISO(d.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} : ${label}`}>
            <span className={cx('text-[11px] font-semibold', d.isToday ? 'text-signal-text' : 'text-muted')}>{DAYS_LETTER[parseISO(d.date).getDay()]}</span>
            <span
              className={cx(
                'flex h-10 w-full items-center justify-center rounded-[8px] text-[11px] font-bold tracking-[0.02em]',
                done ? 'bg-text text-bg' : d.planned ? 'border border-line-strong text-text-2' : d.paused ? 'hatch border border-line' : 'border border-dashed border-line text-muted',
                d.isToday && 'ring-2 ring-signal ring-offset-2 ring-offset-bg',
              )}
            >
              {done ? d.done.length > 1 ? `${d.done.length}×` : <span className="flex items-center gap-0.5"><Check size={12} strokeWidth={3} aria-hidden />{code}</span> : code ?? '·'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
