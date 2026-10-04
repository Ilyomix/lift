import { fmtDate, todayISO } from '../lib/date'
import { L } from '../lib/i18n'
import { GOAL_DATE, MAINTENANCE, PHASES, type Period } from '../lib/program'
import { programTimelineAt } from '../lib/programTimeline'
import { Button, Card, Disclosure, Tag } from './ui'
import { navigate } from '../lib/router'

/** The current point in the plan is primary; completed blocks stay folded away. */
export function ProgramProgress({ today = todayISO(), paused = false }: { today?: string; paused?: boolean }) {
  const { context, current, upcoming, past } = programTimelineAt(today)
  const first = upcoming[0]
  return <section aria-label={L('Progression du programme', 'Program progress')} className="mb-7">
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{L('Où tu en es', 'Where you are now')}</h2>
        <Tag tone="signal">{paused ? L('En pause', 'Paused') : current ? L('En cours', 'Current') : first ? L('À venir', 'Upcoming') : MAINTENANCE ? L('Entretien', 'Maintenance') : L('Terminé', 'Complete')}</Tag>
      </div>
      <p className="mt-3 text-[22px] leading-[1.2] font-semibold tracking-[-0.02em]">{current ? context.deload && current.kind !== 'deload' ? context.title : current.label : first ? L('Le programme arrive', 'Your program is coming up') : MAINTENANCE ? L('Le programme continue', 'Your program continues') : context.title}</p>
      {current ? <>
        <p className="mt-1.5 text-[14px] leading-5 text-text-2">{context.phase?.short} · {L(`Semaine ${context.week} sur ${context.weeks}`, `Week ${context.week} of ${context.weeks}`)}</p>
        <p className="mt-1 text-[12px] leading-[18px] text-muted tnum">{context.deload && current.kind !== 'deload' ? `${current.label} : ` : ''}{fmtDate(current.start, { year: true })} – {fmtDate(current.end, { year: true })}</p>
        <p className="mt-3 text-[14px] leading-[1.5]">{context.effortDetail || current.note}</p>
      </> : first ? <p className="mt-2 text-[14px] leading-[1.5] text-text-2">{L(`Début le ${fmtDate(first.start, { weekday: true, long: true })}. Tu retrouves ci-dessous les étapes prévues.`, `Starts ${fmtDate(first.start, { weekday: true, long: true })}. The planned stages are listed below.`)}</p> : !MAINTENANCE && <p className="mt-2 text-[14px] leading-[1.5] text-text-2">{L(`Le plan daté s’est terminé le ${fmtDate(GOAL_DATE, { long: true, year: true })}. Tes séances enregistrées restent disponibles.`, `The dated plan ended on ${fmtDate(GOAL_DATE, { long: true, year: true })}. Your recorded workouts remain available.`)}</p>}
      {paused && <p className="mt-3 text-[13px] leading-5 text-text-2">{L('Le calendrier continue pendant la pause ; la reprise sera adaptée à la durée de l’arrêt.', 'The calendar continues during the pause; your return will adapt to the time off.')}</p>}
      {MAINTENANCE && <p className="mt-3 text-[13px] leading-5 text-text-2">{L('Mode entretien : les blocs continuent sans date de fin.', 'Maintenance mode: blocks continue with no end date.')}</p>}
      {!current && !first && !MAINTENANCE && <Button variant="outline" full className="mt-4" onClick={() => navigate('plus/objectif')}>{L('Ajuster mon objectif', 'Adjust my goal')}</Button>}
    </Card>
    {upcoming.length > 0 && <div className="mt-5">
      <h3 className="mb-3 text-[15px] font-semibold">{L('La suite du programme', 'What comes next')}</h3>
      <PeriodList periods={upcoming.slice(0, 4)} />
      {upcoming.length > 4 && <Disclosure bordered={false} className="mt-1" title={L(`Voir les ${upcoming.length - 4} autres étapes prévues`, `View ${upcoming.length - 4} more planned stages`)}><PeriodList periods={upcoming.slice(4)} /></Disclosure>}
    </div>}
    {past.length > 0 && <Disclosure bordered={false} className="mt-2" title={L(`Blocs passés (${past.length})`, `Past blocks (${past.length})`)}><PeriodList periods={past} /></Disclosure>}
  </section>
}

function PeriodList({ periods }: { periods: Period[] }) {
  return <ol className="divide-y divide-line">
    {periods.map((period) => <li key={period.id} className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[15px] leading-5 font-medium">{period.label}</p>
        <p className="text-[12px] leading-[18px] text-muted tnum">{fmtDate(period.start, { year: true })} – {fmtDate(period.end, { year: true })}</p>
      </div>
      <p className="mt-1 text-[13px] leading-[1.45] text-text-2">{PHASES[period.phase].short} · {period.note}</p>
    </li>)}
  </ol>
}
