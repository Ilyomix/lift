import { CalendarDays, History, Layers3 } from 'lucide-react'
import { fmtDate, todayISO } from '../lib/date'
import { L } from '../lib/i18n'
import { GOAL_DATE, MAINTENANCE, PHASES, type Period } from '../lib/program'
import { programTimelineAt } from '../lib/programTimeline'
import { PhaseTrack } from './Program'
import { Button, Card, cx, Disclosure, SectionHeading, Tag } from './ui'
import { navigate } from '../lib/router'

/** Keep the original phase track and period markers, with past blocks folded away. */
export function ProgramProgress({ today = todayISO(), paused = false }: { today?: string; paused?: boolean }) {
  const { context, current, upcoming, past } = programTimelineAt(today)
  const first = upcoming[0]
  const shown = [...(current ? [current] : []), ...upcoming.slice(0, 4)]
  return <section aria-label={L('Progression du programme', 'Program progress')} className="mb-6">
    <SectionHeading className="mb-3" icon={<CalendarDays />} action={paused ? <Tag tone="outline">{L('En pause', 'Paused')}</Tag> : undefined}>{L('Calendrier des blocs', 'Block calendar')}</SectionHeading>
    <PhaseTrack today={today} />
    {current && <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[15px] leading-5 font-semibold">{context.title}</p>
        <span className="text-[12px] leading-[18px] text-muted tnum">{L(`Semaine ${context.week} sur ${context.weeks}`, `Week ${context.week} of ${context.weeks}`)}</span>
    </div>}
    {current ? <>
      {context.deload && current.kind !== 'deload' && <p className="mt-2 text-[12px] leading-[18px] text-muted tnum">{current.label} : {fmtDate(current.start, { year: true })} – {fmtDate(current.end, { year: true })}</p>}
      <p className="mt-2 text-[13px] leading-[1.5] text-text-2">{context.effortDetail || current.note}</p>
    </> : first ? <p className="mt-3 text-[13px] leading-[1.5] text-text-2">{L(`Début le ${fmtDate(first.start, { weekday: true, long: true })}.`, `Starts ${fmtDate(first.start, { weekday: true, long: true })}.`)}</p> : !MAINTENANCE && <p className="mt-3 text-[13px] leading-[1.5] text-text-2">{L(`Le plan daté s’est terminé le ${fmtDate(GOAL_DATE, { long: true, year: true })}. Tes séances enregistrées restent disponibles.`, `The dated plan ended on ${fmtDate(GOAL_DATE, { long: true, year: true })}. Your recorded workouts remain available.`)}</p>}
    {paused && <p className="mt-2 text-[13px] leading-5 text-text-2">{L('Le calendrier continue pendant la pause ; la reprise sera adaptée à la durée de l’arrêt.', 'The calendar continues during the pause; your return will adapt to the time off.')}</p>}
    {shown.length > 0 && <div className="mt-4"><PeriodList periods={shown} currentId={current?.id} /></div>}
    {MAINTENANCE && <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Mode entretien : les blocs continuent sans date de fin.', 'Maintenance mode: blocks continue with no end date.')}</p>}
    {upcoming.length > 4 && <Disclosure icon={<Layers3 size={18} />} bordered={false} className="mt-1" title={L(`Voir les ${upcoming.length - 4} autres étapes prévues`, `View ${upcoming.length - 4} more planned stages`)}><PeriodList periods={upcoming.slice(4)} /></Disclosure>}
    {past.length > 0 && <Disclosure icon={<History size={18} />} bordered={false} className="mt-2" title={L(`Blocs passés (${past.length})`, `Past blocks (${past.length})`)}><PeriodList periods={past} /></Disclosure>}
    {!current && !first && !MAINTENANCE && <Button variant="outline" full className="mt-4" onClick={() => navigate('plus/objectif')}>{L('Ajuster mon objectif', 'Adjust my goal')}</Button>}
  </section>
}

/** Original period-list markers share the colours and hatching of PhaseTrack. */
function PeriodList({ periods, currentId }: { periods: Period[]; currentId?: string }) {
  return <Card className="overflow-hidden"><ol className="divide-y divide-line">
    {periods.map((period) => {
      const current = period.id === currentId
      return <li key={period.id} aria-current={current ? 'step' : undefined} className={cx('flex items-start gap-3 px-4 py-3', current && 'bg-signal-soft')}>
        <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-[3px]', period.kind === 'deload' ? 'hatch border border-line-strong' : period.kind === 'holiday' ? 'bg-surface-3' : period.kind === 'stabilization' ? 'bg-signal' : '')} style={period.kind === 'block' ? { background: `color-mix(in oklch, var(--text) ${period.phase === 'recomp' || period.phase === 'upkeep' ? 42 : 82}%, transparent)` } : undefined} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[15px] leading-5 font-semibold">{period.label}{current && <span className="ml-2 text-[12px] font-semibold text-signal-text">{L('en cours', 'current')}</span>}</p>
            <p className="text-[12px] leading-[18px] text-muted tnum">{fmtDate(period.start, { year: true })} – {fmtDate(period.end, { year: true })}</p>
          </div>
          <p className="mt-0.5 text-[13px] leading-[1.4] text-text-2">{PHASES[period.phase].short} · {period.note}</p>
        </div>
      </li>
    })}
  </ol></Card>
}
