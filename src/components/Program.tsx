import { Check } from 'lucide-react'
import { DAYS_LETTER, diffDays, fmtDate, parseISO, todayISO } from '../lib/date'
import { FOUNDATION_START, GOAL_DATE, PERIODS, TYPE_META, type Period, type PhaseId, type SessionPlan } from '../lib/program'
import type { DayStatus } from '../lib/stats'
import { cx } from './ui'

function fill(p: Period): { className: string; style?: React.CSSProperties } {
  if (p.kind === 'deload') return { className: 'hatch bg-surface-3' }
  if (p.kind === 'pre' || p.kind === 'holiday') return { className: 'bg-surface-3' }
  if (p.kind === 'stabilization') return { className: 'bg-signal' }
  if (p.phase === 'recomp') return { className: '', style: { background: 'color-mix(in oklch, var(--text) 42%, transparent)' } }
  return { className: '', style: { background: 'color-mix(in oklch, var(--text) 82%, transparent)' } }
}

/**
 * First label that fits a span of the track, full name then short form. The track is
 * about 360 px wide on a phone, ≈ 6.5 px per character at 11 px: a conservative estimate,
 * so a label never spills onto its neighbour.
 */
function fitLabel(fraction: number, options: string[]): string | null {
  return options.find((t) => fraction * 360 >= t.length * 6.5 + 4) ?? null
}

/** The whole program on one mechanical track (calendar time), today marked. */
export function PhaseTrack({ today = todayISO(), showLabels = true }: { today?: string; showLabels?: boolean }) {
  const total = diffDays(FOUNDATION_START, GOAL_DATE) + 1
  const pos = Math.min(1, Math.max(0, diffDays(FOUNDATION_START, today) / total))
  const months: { label: string; at: number }[] = []
  for (let m = parseISO(FOUNDATION_START); m <= parseISO(GOAL_DATE); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
    if (iso < FOUNDATION_START) continue
    months.push({ label: 'JFMAMJJASOND'[m.getMonth()], at: diffDays(FOUNDATION_START, iso) / total })
  }
  const recomp = PERIODS.filter((p) => p.phase === 'recomp')
  const cut = PERIODS.filter((p) => ['cut', 'cut-end', 'diet-break'].includes(p.phase))
  const span = (ps: Period[]) => (ps.length ? { left: diffDays(FOUNDATION_START, ps[0].start) / total, right: (diffDays(FOUNDATION_START, ps[ps.length - 1].end) + 1) / total } : null)
  const r = span(recomp)
  const c = span(cut)
  const label = `Calendrier du programme jusqu’au ${fmtDate(GOAL_DATE, { long: true, year: true })}${recomp.length ? `, recomposition jusqu’au ${fmtDate(recomp[recomp.length - 1].end, { long: true })}` : ''}${cut.length ? `, sèche du ${fmtDate(cut[0].start, { long: true })} au ${fmtDate(cut[cut.length - 1].end, { long: true })}` : ''}.`
  return (
    <div className="w-full" role="img" aria-label={label}>
      <div className="relative h-3 w-full">
        {PERIODS.map((p) => {
          const left = diffDays(FOUNDATION_START, p.start) / total
          const width = (diffDays(p.start, p.end) + 1) / total
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
          {([[r, ['Recomposition', 'Recomp.']], [c, ['Sèche']]] as const).map(([span, options]) => {
            const text = span && fitLabel(span.right - span.left, [...options])
            return span && text ? (
              <span key={options[0]} className="absolute truncate text-text-2" style={{ left: `${span.left * 100}%`, width: `${(span.right - span.left) * 100}%` }}>{text}</span>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Sessions to the goal ─────────────────────────

type Group = 'foundation' | 'recomp' | 'holiday' | 'cut' | 'stab'

/** Full name then short form, for spans too narrow for the full name. */
const GROUP_LABEL: Record<Group, string[]> = {
  foundation: ['Fondation'],
  recomp: ['Recomposition', 'Recomp.'],
  holiday: ['Fêtes'],
  cut: ['Sèche'],
  stab: ['Stabilisation', 'Stab.'],
}

function groupOf(kind: Period['kind'], phase: PhaseId): Group {
  if (kind === 'pre') return 'foundation'
  if (kind === 'holiday') return 'holiday'
  if (kind === 'stabilization') return 'stab'
  return phase === 'recomp' ? 'recomp' : 'cut'
}

/**
 * One tick per session, from the first session to the goal date: lit ticks are the
 * sessions done, dim ticks the sessions planned. Deload sessions are shorter, the
 * phases are separated by a gap. Reads as a progress bar and as the plan's rhythm.
 */
export function SessionTrack({ plan }: { plan: SessionPlan }) {
  const T = 2 // tick width
  const G = 1 // gap between ticks
  const P = 7 // gap between phases
  const H = 26
  type Tick = { x: number; h: number; done: boolean; next: boolean; group: Group }
  const ticks: Tick[] = []
  const starts: { group: Group; x: number }[] = []
  let x = 0
  let prev: Group | null = null
  let count = 0
  for (const seg of plan.segments) {
    const group = groupOf(seg.kind, seg.phase)
    if (group !== prev) {
      if (prev !== null) x += P - G
      starts.push({ group, x })
      prev = group
    }
    const h = seg.kind === 'deload' ? 12 : seg.kind === 'holiday' ? 17 : H
    for (let i = 0; i < seg.done + seg.planned; i++) {
      const done = i < seg.done
      ticks.push({ x, h, done, next: false, group })
      x += T + G
      count++
    }
  }
  const width = Math.max(1, x - G)
  const nextIndex = ticks.findIndex((t) => !t.done)
  if (nextIndex >= 0) ticks[nextIndex].next = true
  // Label spans: holidays never break a phase label (recomposition → fêtes → recomposition
  // reads as one recomposition); a span runs until the next different phase.
  const labels: { group: Group; x: number; end: number }[] = []
  for (const st of starts) {
    if (st.group === 'holiday') continue
    const prevSpan = labels[labels.length - 1]
    if (prevSpan && prevSpan.group === st.group) continue
    if (prevSpan) prevSpan.end = st.x
    labels.push({ group: st.group, x: st.x, end: width })
  }
  const currentGroup = nextIndex >= 0 ? ticks[nextIndex].group : null
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${H + 6}`} preserveAspectRatio="none" className="block h-[32px] w-full" role="img" aria-label={`${plan.done} séances faites sur ${plan.total} prévues d’ici le ${fmtDate(GOAL_DATE, { long: true, year: true })}`}>
        {ticks.map((t, i) => (
          <rect
            key={i}
            x={t.x}
            y={H - t.h}
            width={T}
            height={t.h}
            rx={0.4}
            fill={t.done ? 'var(--signal)' : t.next ? 'var(--text)' : 'var(--line-strong)'}
          />
        ))}
        {nextIndex >= 0 && <rect x={ticks[nextIndex].x - 1} y={H + 3} width={T + 2} height={3} rx={1} fill="var(--text)" />}
      </svg>
      <div className="relative mt-1.5 h-4 w-full">
        {labels.map((l) => {
          const w = (l.end - l.x) / width
          const text = fitLabel(w, GROUP_LABEL[l.group])
          if (!text) return null
          return (
            <span
              key={l.group + l.x}
              className={cx('absolute truncate text-[11px] font-semibold', l.group === currentGroup ? 'text-text' : 'text-muted')}
              style={{ left: `${(l.x / width) * 100}%`, width: `${w * 100}%` }}
            >
              {text}
            </span>
          )
        })}
      </div>
      <span className="sr-only">{count} séances au total</span>
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
