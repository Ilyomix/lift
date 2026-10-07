import { Check, Play } from 'lucide-react'
import { addDays, dayLetter, diffDays, fmtDate, mondayOf, monthName, parseISO, todayISO } from '../lib/date'
import { L, locale } from '../lib/i18n'
import { FOUNDATION_START, GOAL_DATE, MAINTENANCE, PERIODS, TYPE_META, type Period, type PhaseId, type SessionPlan } from '../lib/program'
import type { ISODate } from '../lib/types'
import type { DayStatus } from '../lib/stats'
import { cx } from './ui'

function fill(p: Period): { className: string; style?: React.CSSProperties } {
  if (p.kind === 'deload') return { className: 'hatch bg-surface-3' }
  if (p.kind === 'pre' || p.kind === 'holiday') return { className: 'bg-surface-3' }
  if (p.kind === 'stabilization') return { className: 'bg-signal' }
  if (p.phase === 'recomp' || p.phase === 'upkeep') return { className: '', style: { background: 'color-mix(in oklch, var(--text) 42%, transparent)' } }
  return { className: '', style: { background: 'color-mix(in oklch, var(--text) 82%, transparent)' } }
}

/**
 * First label that fits a span of the track, full name then short form. The track is
 * about 360 px wide on a phone, ≈ 6.5 px per character at 11 px: a conservative estimate,
 * so a label never spills onto its neighbour.
 */
const TRACK_PX = 360
const labelPx = (t: string) => t.length * 6.5 + 4
function fitLabel(fraction: number, options: string[]): string | null {
  return options.find((t) => fraction * TRACK_PX >= labelPx(t)) ?? null
}

/**
 * The whole program on one mechanical track (calendar time), today marked. In maintenance
 * mode the plan has no end: the track shows a year around today instead.
 */
export function PhaseTrack({ today = todayISO(), showLabels = true }: { today?: string; showLabels?: boolean }) {
  const lateStart = mondayOf(addDays(today, -13 * 7))
  const from = MAINTENANCE && lateStart > FOUNDATION_START ? lateStart : FOUNDATION_START
  const to = MAINTENANCE && addDays(from, 52 * 7 - 1) < GOAL_DATE ? addDays(from, 52 * 7 - 1) : GOAL_DATE
  const total = diffDays(from, to) + 1
  const pos = Math.min(1, Math.max(0, diffDays(from, today) / total))
  const months: { label: string; at: number }[] = []
  for (let m = parseISO(from); m <= parseISO(to); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`
    if (iso < from) continue
    months.push({ label: monthName(m.getMonth()).charAt(0).toUpperCase(), at: diffDays(from, iso) / total })
  }
  const shown = PERIODS.filter((p) => p.end >= from && p.start <= to)
  const recomp = shown.filter((p) => p.phase === 'recomp' || p.phase === 'upkeep')
  const cut = shown.filter((p) => ['cut', 'cut-end', 'diet-break'].includes(p.phase))
  const clip = (d: string) => (d < from ? from : d > to ? to : d)
  const span = (ps: Period[]) => (ps.length ? { left: diffDays(from, clip(ps[0].start)) / total, right: (diffDays(from, clip(ps[ps.length - 1].end)) + 1) / total } : null)
  const r = span(recomp)
  const c = span(cut)
  const label = MAINTENANCE
    ? L(
        `Calendrier en mode entretien, sans date de fin : blocs de 5 semaines et semaines allégées du ${fmtDate(from, { long: true })} au ${fmtDate(to, { long: true, year: true })}.`,
        `Maintenance-mode calendar, with no end date: 5-week blocks and deloads from ${fmtDate(from, { long: true })} to ${fmtDate(to, { long: true, year: true })}.`,
      )
    : L(
        `Calendrier du programme jusqu’au ${fmtDate(GOAL_DATE, { long: true, year: true })}${recomp.length ? `, recomposition jusqu’au ${fmtDate(recomp[recomp.length - 1].end, { long: true })}` : ''}${cut.length ? `, sèche du ${fmtDate(cut[0].start, { long: true })} au ${fmtDate(cut[cut.length - 1].end, { long: true })}` : ''}.`,
        `Program calendar until ${fmtDate(GOAL_DATE, { long: true, year: true })}${recomp.length ? `, recomposition until ${fmtDate(recomp[recomp.length - 1].end, { long: true })}` : ''}${cut.length ? `, cut from ${fmtDate(cut[0].start, { long: true })} to ${fmtDate(cut[cut.length - 1].end, { long: true })}` : ''}.`,
      )
  const firstLabel: string[] = MAINTENANCE ? [L('Entretien, sans date de fin', 'Maintenance, no end date'), L('Entretien', 'Maintenance')] : ['Recomposition', 'Recomp.']
  return (
    <div className="w-full" role="img" aria-label={label}>
      <div className="relative h-3 w-full overflow-hidden">
        {shown.map((p) => {
          const left = diffDays(from, clip(p.start)) / total
          const width = (diffDays(clip(p.start), clip(p.end)) + 1) / total
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
          {([[r, firstLabel], [c, [L('Sèche', 'Cut')]]] as const).map(([span, options]) => {
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

type Group = 'foundation' | 'recomp' | 'holiday' | 'cut' | 'stab' | 'upkeep' | 'deload'

/** Full name then short form, for spans too narrow for the full name. Getters: they follow the interface language. */
const GROUP_LABEL: Record<Group, string[]> = {
  get foundation() { return [L('Fondation', 'Foundation')] },
  recomp: ['Recomposition', 'Recomp.'],
  get holiday() { return [L('Fêtes', 'Holidays')] },
  get cut() { return [L('Sèche', 'Cut')] },
  get stab() { return [L('Stabilisation', 'Stabilization'), 'Stab.'] },
  get upkeep() { return [L('Entretien', 'Maintenance')] },
  get deload() { return [L('Semaine allégée', 'Deload'), 'D.'] },
}

function groupOf(kind: Period['kind'], phase: PhaseId): Group {
  if (kind === 'pre') return 'foundation'
  if (kind === 'holiday') return 'holiday'
  if (kind === 'stabilization') return 'stab'
  // Maintenance counts one cycle: its deload gets a label of its own.
  if (phase === 'upkeep') return kind === 'deload' ? 'deload' : 'upkeep'
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
      // A gap separates the phases; a maintenance deload follows its block without one, like the deloads of the other phases (its ticks are shorter).
      if (prev !== null && group !== 'deload') x += P - G
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
  // reads as one recomposition), unless the track is the holidays alone (a maintenance cycle);
  // a span runs until the next different phase.
  const labels: { group: Group; x: number; end: number }[] = []
  const onlyHolidays = starts.every((st) => st.group === 'holiday')
  for (const st of starts) {
    if (st.group === 'holiday' && !onlyHolidays) continue
    const prevSpan = labels[labels.length - 1]
    if (prevSpan && prevSpan.group === st.group) continue
    if (prevSpan) prevSpan.end = st.x
    labels.push({ group: st.group, x: st.x, end: width })
  }
  const currentGroup = nextIndex >= 0 ? ticks[nextIndex].group : null
  // Each label fits its own span, full name then short form. The last one may also borrow room
  // on its left: set against the end of the track, its full name shows (« Décharge », not « D. »)
  // as long as it clears the label before it.
  const texts = labels.map((l) => ({ l, w: (l.end - l.x) / width, text: fitLabel((l.end - l.x) / width, GROUP_LABEL[l.group]), right: false }))
  const last = texts[texts.length - 1]
  const full = last ? GROUP_LABEL[last.l.group][0] : ''
  if (last && last.text !== full) {
    const prev = texts[texts.length - 2]
    const prevEnd = prev ? (prev.l.x / width) * TRACK_PX + (prev.text ? labelPx(prev.text) : 0) : 0
    if (TRACK_PX - prevEnd >= labelPx(full) + 8) {
      last.text = full
      last.right = true
    }
  }
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${H + 6}`} preserveAspectRatio="none" className="block h-[32px] w-full" role="img" aria-label={L(`${plan.done} séances faites sur ${plan.total} prévues d’ici le ${fmtDate(plan.cycle?.end ?? GOAL_DATE, { long: true, year: true })}`, `${plan.done} of ${plan.total} planned workouts done by ${fmtDate(plan.cycle?.end ?? GOAL_DATE, { long: true, year: true })}`)}>
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
        {texts.map(({ l, w, text, right }) => {
          if (!text) return null
          return (
            <span
              key={l.group + l.x}
              className={cx('absolute text-[11px] font-semibold', right ? 'whitespace-nowrap' : 'truncate', l.group === currentGroup ? 'text-text' : 'text-muted')}
              style={right ? { right: 0 } : { left: `${(l.x / width) * 100}%`, width: `${w * 100}%` }}
            >
              {text}
            </span>
          )
        })}
      </div>
      <span className="sr-only">{L(`${count} séances au total`, `${count} workouts in total`)}</span>
    </div>
  )
}

export function WeekStrip({ days, onSelect }: { days: DayStatus[]; onSelect: (date: ISODate) => void }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const done = d.done[0]
        const code = done ? TYPE_META[done.type].code : d.active ? TYPE_META[d.active].code : d.planned ? TYPE_META[d.planned].code : null
        const label = done ? L(`${TYPE_META[done.type].label} faite`, `${TYPE_META[done.type].label} done`) : d.active ? L(`${TYPE_META[d.active].label} en cours`, `${TYPE_META[d.active].label} in progress`) : d.planned ? L(`${TYPE_META[d.planned].label} prévue`, `${TYPE_META[d.planned].label} planned`) : d.paused ? L('Pause', 'Paused') : d.rest ? L('Repos', 'Rest') : L('Aucune séance', 'No workout')
        const day = parseISO(d.date).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric' })
        return (
          <li key={d.date} className="flex min-w-0 flex-col items-center gap-1.5">
            <span className={cx('text-[11px] font-semibold', d.isToday ? 'text-signal-text' : 'text-muted')}>{dayLetter(parseISO(d.date).getDay())}</span>
            <button type="button" onClick={() => onSelect(d.date)} aria-label={L(`${day} : ${label}`, `${day}: ${label}`)}
              className={cx(
                'pressable flex h-11 w-full items-center justify-center rounded-[8px] font-semibold',
                code ? 'text-[11px] tracking-[0.02em]' : 'text-[10px]',
                done ? 'bg-text text-bg' : d.active ? 'border border-signal bg-signal-soft text-signal-text' : d.planned ? 'border border-line-strong text-text-2' : d.paused ? 'hatch border border-line text-text-2' : d.rest ? 'border border-dashed border-line bg-surface text-text-2' : 'border border-dashed border-line text-muted',
                d.isToday && 'ring-2 ring-signal ring-offset-2 ring-offset-bg',
              )}
            >
              {done ? d.done.length > 1 ? `${d.done.length}×` : <span className="flex items-center gap-0.5"><Check size={12} strokeWidth={3} aria-hidden />{code}</span> : d.active ? <span className="flex items-center gap-0.5"><Play size={10} aria-hidden />{code}</span> : code ?? (d.paused ? L('Pause', 'Pause') : d.rest ? L('Repos', 'Rest') : '—')}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
