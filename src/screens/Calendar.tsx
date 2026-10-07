import { isNative } from '../lib/native/bridge'
import { useMemo, useState } from 'react'
import { BellRing, BookOpen, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, CirclePause, ClipboardList, Flag, HelpCircle, NotebookPen, Play, RotateCcw } from 'lucide-react'
import { addDays, addMonths, capitalize, dayLetter, diffDays, fmtDate, fmtRelativeDay, monthKey, monthName, todayISO } from '../lib/date'
import { plural } from '../lib/format'
import { L } from '../lib/i18n'
import { buildIcs, icsEventCount, type IcsOptions } from '../lib/ics'
import {
  calendarMonth, GOAL_DATE, MAINTENANCE, PERIODS, projectSessions, reentryForGap, TYPE_META,
  gapSinceLastSession, sessionPlan, type Milestone,
} from '../lib/program'
import { navigate } from '../lib/router'
import { calendarMilestonesAt } from '../lib/programTimeline'
import { isIOS, saveFile } from '../lib/share'
import { useStore } from '../lib/store'
import type { ISODate, PauseReason } from '../lib/types'
import { Button, Card, cx, DateInput, Disclosure, Header, IconButton, inputClass, Screen, Section, SectionHeading, Segmented, Sheet, TimeInput, Toggle } from '../components/ui'
import { CalendarDaySheet } from '../components/CalendarDaySheet'
import { ProgramContent } from './ProgramScreen'
import { useSessionStart } from '../components/useSessionStart'

export function CalendarScreen({ tab = 'calendrier' }: { tab?: 'calendrier' | 'programme' }) {
  const state = useStore((s) => s.state)
  const { start, confirmation } = useSessionStart(() => navigate('seance'))
  const today = todayISO()
  const [month, updateMonth] = useState<string>(() => {
    const saved = window.history.state?.liftCalendarMonth
    return typeof saved === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(saved) ? saved : monthKey(today)
  })
  const setMonth = (value: string) => {
    window.history.replaceState({ ...window.history.state, liftCalendarMonth: value }, '')
    updateMonth(value)
  }
  const [day, setDay] = useState<ISODate | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const planned = useMemo(() => projectSessions(state, GOAL_DATE, today), [state, today])
  const weeks = useMemo(() => calendarMonth(state, month, planned, today), [state, month, planned, today])
  const [y, m] = month.split('-').map(Number)
  const next = calendarMilestonesAt(today)
  const plan = useMemo(() => sessionPlan(state, today), [state, today])
  const cycle = plan.cycle
  const milestonePeriod = milestone?.kind !== 'goal' ? PERIODS.find(period => period.start === milestone?.date) : undefined

  return (
    <Screen>
      <Header art="calendar" title={L('Calendrier', 'Calendar')} />
      <Segmented
        label={L('Vue du calendrier', 'Calendar view')}
        value={tab}
        layout="fit"
        onChange={(value) => navigate(value === 'programme' ? 'calendrier/programme' : 'calendrier', { replace: true, transition: 'none' })}
        options={[
          { value: 'calendrier', label: L('Calendrier', 'Calendar') },
          { value: 'programme', label: L('Programme', 'Program') },
        ]}
      />
      <div className="mt-4">
      {tab === 'programme' ? <ProgramContent /> : <>
      <div className="mb-5 text-text-2">
        <p className="text-[13px] leading-[1.4]">{cycle ? L('Mode entretien · sans date de fin', 'Maintenance mode · no end date') : L(`Programme jusqu’au ${fmtDate(GOAL_DATE, { long: true })}`, `Program through ${fmtDate(GOAL_DATE, { long: true })}`)}</p>
        <p className="mt-2 text-[15px] leading-[1.45]">{cycle
          ? L(`${cycle.label} : ${plural(plan.done, 'séance terminée', 'séances terminées')}, ${plural(plan.planned, 'séance prévue', 'séances prévues')} jusqu’au ${fmtDate(cycle.end, { long: true })}. Les séances manquées sont reportées.`, `${cycle.label}: ${plural(plan.done, 'completed workout', 'completed workouts')}, ${plural(plan.planned, 'planned workout', 'planned workouts')} until ${fmtDate(cycle.end, { long: true })}. Missed workouts are rescheduled.`)
          : L(`${plural(plan.done, 'séance terminée', 'séances terminées')}, ${plural(plan.planned, 'séance prévue', 'séances prévues')}. Les séances manquées sont reportées.`, `${plural(plan.done, 'completed workout', 'completed workouts')}, ${plural(plan.planned, 'planned workout', 'planned workouts')}. Missed workouts are rescheduled.`)}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <SectionHeading>{capitalize(monthName(m - 1))} <span className="text-text-2">{y}</span></SectionHeading>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {month !== monthKey(today) && <Button size="sm" variant="outline" onClick={() => setMonth(monthKey(today))}>{L('Aujourd’hui', 'Today')}</Button>}
          <IconButton label={L('Mois précédent', 'Previous month')} onClick={() => setMonth(addMonths(month, -1))} className="border border-line-strong"><ChevronLeft size={18} aria-hidden /></IconButton>
          <IconButton label={L('Mois suivant', 'Next month')} onClick={() => setMonth(addMonths(month, 1))} className="border border-line-strong"><ChevronRight size={18} aria-hidden /></IconButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d}>{dayLetter(d)}</span>)}
      </div>
      <div className="mt-1 space-y-1.5">
        {weeks.map((w) => (
          <div key={w.monday}>
            <div className={cx('mt-2 mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.04em]', w.kind === 'deload' ? 'text-text' : 'text-muted')}>
              {w.kind === 'deload' && <span className="hatch h-2.5 w-4 rounded-[2px] border border-line-strong" aria-hidden />}
              {w.caption}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {w.cells.map((c) => {
                const done = c.done[0]
                const active = c.active ? state.activeWorkout : null
                const code = done ? TYPE_META[done.type].code : active ? TYPE_META[active.type].code : c.planned ? TYPE_META[c.planned.type].code : null
                const label = done ? L(`${TYPE_META[done.type].label} faite`, `${TYPE_META[done.type].label} done`) : active ? L(`${TYPE_META[active.type].label} en cours`, `${TYPE_META[active.type].label} in progress`) : c.planned ? L(`${TYPE_META[c.planned.type].label} prévue`, `${TYPE_META[c.planned.type].label} planned`) : c.paused ? L('Pause', 'Paused') : c.rest ? L('Repos', 'Rest') : L('Aucune séance', 'No workout')
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => setDay(c.date)}
                    aria-label={`${fmtDate(c.date, { weekday: true, long: true })} : ${label}${c.isGoal ? L(', objectif', ', goal') : ''}`}
                    className={cx(
                      'pressable relative flex min-h-[52px] min-w-0 aspect-[0.86] flex-col items-center justify-between rounded-[9px] border py-1.5',
                      !c.inMonth && 'opacity-35',
                      w.kind === 'deload' && !done ? 'border-line-strong' : 'border-line',
                      c.paused && !done && 'hatch',
                      c.rest && 'border-dashed bg-surface',
                      c.isToday && 'border-signal ring-1 ring-signal',
                    )}
                  >
                    <span className={cx('inline-flex items-center gap-0.5 text-[12px] tnum', c.isToday ? 'font-bold text-signal-text' : 'text-text-2')}>{Number(c.date.slice(8))}{c.isGoal && <Flag size={10} className="text-signal-text" aria-hidden />}</span>
                    {code ? (
                      <span className={cx('flex h-[22px] min-w-[30px] items-center justify-center gap-0.5 rounded-[5px] px-1 text-[10px] font-bold tracking-[0.03em]', done ? 'bg-text text-bg' : active ? 'border border-signal bg-signal-soft text-signal-text' : c.planned?.tentative ? 'border border-dashed border-line-strong text-muted' : 'border border-line-strong text-text-2')}>
                        {active && !done && <Play size={10} aria-hidden />}{c.done.length > 1 ? `${c.done.length}×` : code}
                      </span>
                    ) : c.paused || c.rest ? (
                      <span className="flex h-[22px] items-center text-[10px] font-medium text-text-2">{c.paused ? L('Pause', 'Pause') : L('Repos', 'Rest')}</span>
                    ) : (
                      <span className="h-[22px]" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-text-2">
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] bg-text" />} label={L('Terminée', 'Completed')} />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-line-strong" />} label={L('Prévue', 'Planned')} />
        <Legend swatch={<span className="flex h-3.5 w-5 items-center justify-center rounded-[3px] bg-signal-soft text-signal-text"><Play size={10} aria-hidden /></span>} label={L('En cours', 'In progress')} />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-dashed border-line bg-surface" />} label={L('Repos', 'Rest')} />
        <Legend swatch={<span className="hatch h-3.5 w-5 rounded-[3px] border border-line" />} label={L('Pause', 'Paused')} />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-signal" />} label={L('Aujourd’hui', 'Today')} />
        <span className="text-muted">UP Upper · LO Lower · PS Push · PL Pull · LG Legs</span>
      </div>

      {next.length > 0 && (
        <Section art="program" title={L('Prochaines étapes', 'Upcoming milestones')}>
          <Card className="overflow-hidden">
            <ol className="divide-y divide-line">
              {next.map((ms, index) => {
                const days = diffDays(today, ms.date)
                const relative = days === 0 ? L('Aujourd’hui', 'Today') : days === 1 ? L('Demain', 'Tomorrow') : L(`Dans ${days} jours`, `In ${days} days`)
                return (
                  <li key={ms.date + ms.title}>
                    <button type="button" onClick={() => setMilestone(ms)} aria-label={L(`Voir l’étape : ${ms.title}`, `View milestone: ${ms.title}`)} className="pressable flex min-h-[80px] w-full items-center gap-3 px-3 py-4 text-left hover:bg-surface-2">
                      <time dateTime={ms.date} aria-hidden className={cx('flex w-11 shrink-0 flex-col items-center text-center tnum', index === 0 ? 'text-signal-text' : 'text-text-2')}>
                        <span className="text-[24px] leading-none font-semibold tracking-[-0.02em]">{Number(ms.date.slice(8))}</span>
                        <span className="mt-1 text-[12px] leading-4">{monthName(Number(ms.date.slice(5, 7)) - 1, true)}</span>
                        {ms.date.slice(0, 4) !== today.slice(0, 4) && <span className="text-[11px] leading-4 text-muted">{ms.date.slice(0, 4)}</span>}
                      </time>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-5 font-semibold">{ms.title}</span>
                        <span className={cx('mt-1 block text-[13px] leading-[18px]', index === 0 ? 'text-signal-text' : 'text-text-2')}>{relative}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          </Card>
        </Section>
      )}

      <div className="mt-6 grid gap-2">
        <Button variant="outline" size="lg" full icon={<CalendarPlus size={18} aria-hidden />} onClick={() => navigate('plus/rappels')}>{L('Rappels dans ton calendrier', 'Reminders in your calendar')}</Button>
        <Button variant="outline" size="lg" full icon={<CirclePause size={18} aria-hidden />} onClick={() => navigate('plus/pause')}>{state.programPause.active ? L('Gérer la pause', 'Manage the pause') : L('Mettre le programme en pause', 'Pause the program')}</Button>
      </div>

      {day && <CalendarDaySheet key={day} date={day} onClose={() => setDay(null)} planned={planned} onStart={start} />}
      {milestone && <Sheet open onClose={() => setMilestone(null)} title={milestone.title} icon={<Flag size={18} aria-hidden />}>
        <p className="text-[13px] text-text-2">{fmtDate(milestone.date, { long: true, year: true })}{milestonePeriod && ` – ${fmtDate(milestonePeriod.end, { long: true, year: true })}`}</p>
        <p className="mt-3 text-[15px] leading-relaxed">{milestone.detail}</p>
        <Button variant="outline" full className="mt-5" onClick={() => { setMilestone(null); navigate('calendrier/programme', { replace: true, transition: 'none' }) }}>{L('Voir le programme', 'View program')} <ChevronRight size={16} aria-hidden /></Button>
      </Sheet>}
      </>}
      </div>
      {confirmation}
    </Screen>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5">{swatch}{label}</span>
}

// ───────────────────────── Pause ─────────────────────────

// Labels are getters: they follow the interface language.
const REASONS: { id: PauseReason; label: string }[] = [
  { id: 'vacances', get label() { return L('Vacances', 'Vacation') } },
  { id: 'maladie', get label() { return L('Maladie', 'Illness') } },
  { id: 'blessure', get label() { return L('Blessure', 'Injury') } },
  { id: 'fatigue', get label() { return L('Fatigue', 'Fatigue') } },
  { id: 'autre', get label() { return L('Autre', 'Other') } },
]

export function PauseScreen() {
  const state = useStore((s) => s.state)
  const { startPause, endPause } = useStore.getState()
  const p = state.programPause
  const [reason, setReason] = useState<PauseReason>('vacances')
  const [end, setEnd] = useState<string>('')
  const [note, setNote] = useState('')
  const today = todayISO()
  const sinceDays = p.active && p.startedAt ? diffDays(p.startedAt.slice(0, 10), today) : 0
  const gap = Math.max(sinceDays, gapSinceLastSession(state, today))
  const preview = reentryForGap(gap)
  const plannedGap = end ? Math.max(diffDays(today, end) + 1, 0) + gapSinceLastSession(state, today) : null

  return (
    <Screen>
      <Header art="pause" backTo="plus/reglages/seances" title={p.active ? L('Programme en pause', 'Program paused') : L('Mettre en pause', 'Pause the program')} sub={MAINTENANCE ? L('Vacances, maladie, blessure : le calendrier continue, et la reprise est adaptée à la durée de l’arrêt.', 'Vacation, illness, injury: the calendar keeps going, and your return is adapted to how long you stopped.') : L(`Vacances, maladie, blessure : le calendrier reste calé sur le ${fmtDate(GOAL_DATE, { long: true })}, et la reprise est adaptée à la durée de l’arrêt.`, `Vacation, illness, injury: the calendar stays locked on ${fmtDate(GOAL_DATE, { long: true })}, and your return is adapted to how long you stopped.`)} />
      {p.active ? (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CirclePause size={18} className="text-muted" aria-hidden />
              <p className="text-[15px] font-semibold">{L('Depuis', 'Started')} {fmtRelativeDay(p.startedAt!.slice(0, 10), today)}{p.reason ? ` · ${REASONS.find((r) => r.id === p.reason)?.label}` : ''}</p>
            </div>
            {p.plannedEnd && <p className="mt-1 text-[13px] text-text-2">{L('Reprise prévue le', 'Planned return:')} {fmtDate(addDays(p.plannedEnd, 1), { weekday: true, long: true })}</p>}
            {p.note && <p className="mt-1 text-[13px] text-text-2">{p.note}</p>}
          </Card>
          <Section icon={<RotateCcw size={18} aria-hidden />} title={L('À la reprise', 'When you return')}>
            <Card className="p-4">
              <p className="text-[15px] font-semibold">{preview ? preview.label : L('Reprise normale', 'Normal return')}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{preview ? preview.advice : L('Moins d’une semaine d’arrêt : la rotation reprend là où elle s’est arrêtée, sans ajustement.', 'Less than a week off: the rotation picks up where it left off, with no adjustment.')}</p>
            </Card>
          </Section>
          <Button variant="primary" size="lg" full className="mt-6" onClick={() => { endPause(); navigate('') }}>{L('Reprendre le programme', 'Resume the program')}</Button>
        </>
      ) : (
        <>
          <Section icon={<CirclePause size={18} aria-hidden />} title={L('Raison', 'Reason')} className="mt-0">
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r.id} type="button" aria-pressed={reason === r.id} onClick={() => setReason(r.id)} className={cx('pressable min-h-11 rounded-full border px-4 text-[14px] font-semibold', reason === r.id ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                  {r.label}
                </button>
              ))}
            </div>
          </Section>
          <Section icon={<CalendarDays size={18} aria-hidden />} title={L('Dernier jour de pause (facultatif)', 'Last day of the pause (optional)')}>
            <DateInput label={L('Dernier jour de pause', 'Last day of the pause')} value={end} min={today} max={GOAL_DATE} onChange={setEnd} placeholder={L('Sans date de reprise', 'No return date')} clearable />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              {[3, 7, 14, 21].map((n) => {
                const d = addDays(today, n - 1)
                return (
                  <button key={n} type="button" aria-pressed={end === d} onClick={() => setEnd(d)} className={cx('pressable min-h-11 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold', end === d ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                    {n < 7 ? L(`${n} jours`, `${n} days`) : n === 7 ? L('1 semaine', '1 week') : L(`${n / 7} semaines`, `${n / 7} weeks`)}
                  </button>
                )
              })}
            </div>
            {plannedGap !== null && <p className="mt-2 text-[13px] text-text-2">{L('Reprise le', 'Back on')} {fmtDate(addDays(end, 1), { weekday: true, long: true })}. {reentryForGap(plannedGap)?.advice ?? L('Moins d’une semaine : reprise normale.', 'Less than a week: normal return.')}</p>}
          </Section>
          <Section icon={<NotebookPen size={18} aria-hidden />} title="Note">
            <input aria-label={L('Note de pause', 'Pause note')} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('Ex. : épaule gauche à surveiller', 'E.g. keep an eye on left shoulder')} />
          </Section>
          <Button variant="ink" size="lg" full className="mt-6" icon={<CirclePause size={18} aria-hidden />} onClick={() => { startPause({ reason, plannedEnd: end || null, note: note || undefined }); navigate('') }}>
            {L('Démarrer la pause', 'Start the pause')}
          </Button>
        </>
      )}
      <Disclosure icon={<ClipboardList size={18} aria-hidden />} title={L('Règles de reprise', 'Return rules')} className="mt-6">
        <Card className="divide-y divide-line text-[14px]">
          {[
            [L('1 séance manquée', '1 missed workout'), L('La rotation se décale, rien n’est sauté.', 'The rotation shifts; nothing is skipped.')],
            [L('1 semaine', '1 week'), L('Bloc en cours, charges −5 à −10 %, 2–3 reps en réserve pendant 2 séances.', 'Current block, loads −5 to −10%, 2–3 reps in reserve for 2 workouts.')],
            [L('2–3 semaines', '2–3 weeks'), L('Une semaine de reprise : 3 répétitions en réserve, −30 % de séries.', 'One return week: 3 reps in reserve, sets −30%.')],
            [L('Plus de 3 semaines', 'Over 3 weeks'), L('2 semaines de remise en route, puis retour au bloc.', '2 restart weeks, then back to the block.')],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3">
              <span className="w-28 shrink-0 font-semibold">{k}</span>
              <span className="text-text-2">{v}</span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('1 à 3 semaines d’arrêt coûtent peu : des cycles 6 semaines d’entraînement / 3 d’arrêt ont donné la même hypertrophie que l’entraînement continu (Ogasawara 2013). Les seuils sont une opinion d’experts.', '1 to 3 weeks off cost little: cycles of 6 weeks of training / 3 weeks off produced the same hypertrophy as continuous training (Ogasawara 2013). The thresholds are expert opinion.')}</p>
      </Disclosure>
    </Screen>
  )
}

// ───────────────────────── Calendar reminders (.ics) ─────────────────────────

export function RemindersScreen() {
  const state = useStore((s) => s.state)
  const setPrefs = useStore((s) => s.setPrefs)
  const [o, setO] = useState<IcsOptions>({ training: true, weighIn: true, waist: true, photos: true, deloads: true, phases: true })
  const ics = useMemo(() => buildIcs(state, o), [state, o])
  const n = icsEventCount(ics)
  const set = (k: keyof IcsOptions) => (v: boolean) => setO((x) => ({ ...x, [k]: v }))
  return (
    <Screen>
      <Header art="reminders" backTo="plus/reglages/seances" title={L('Rappels calendrier', 'Calendar reminders')} sub={L('Choisis les événements à exporter dans ton calendrier.', 'Choose which events to export to your calendar.')} />
      <Card className="divide-y divide-line">
        <Toggle label={L('Séances', 'Workouts')} hint={L(`Chaque jour d’entraînement, alerte 30 min avant`, `Every training day, alert 30 min before`)} checked={o.training} onChange={set('training')} />
        <Toggle label={L('Pesée à jeun', 'Fasted weigh-in')} hint={L('Chaque matin : la moyenne sur 7 jours guide les calories', 'Every morning: the 7-day average guides calories')} checked={o.weighIn} onChange={set('weighIn')} />
        <Toggle label={L('Tour de taille', 'Waist')} hint={L('Un dimanche sur deux', 'Every other Sunday')} checked={o.waist} onChange={set('waist')} />
        <Toggle label="Photos" hint={L('Toutes les 4 semaines', 'Every 4 weeks')} checked={o.photos} onChange={set('photos')} />
        <Toggle label={L('Semaines allégées', 'Deload weeks')} hint={L('Alerte la veille', 'Alert the day before')} checked={o.deloads} onChange={set('deloads')} />
        <Toggle label={MAINTENANCE ? L('Phases', 'Phases') : L('Phases et objectif', 'Phases and goal')} hint={MAINTENANCE ? L('Début du programme, fêtes', 'Program start, holidays') : L(`Début du programme, sèche, fêtes, stabilisation, ${fmtDate(GOAL_DATE, { long: true })}`, `Program start, cut, holidays, stabilization, ${fmtDate(GOAL_DATE, { long: true })}`)} checked={o.phases} onChange={set('phases')} />
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Heure des séances', 'Workout time')}</p>
          <TimeInput label={L('Heure des séances', 'Workout time')} value={state.prefs.trainingTime} onChange={(v) => setPrefs({ trainingTime: v })} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Heure de la pesée', 'Weigh-in time')}</p>
          <TimeInput label={L('Heure de la pesée', 'Weigh-in time')} value={state.prefs.weighInTime} onChange={(v) => setPrefs({ weighInTime: v })} />
        </div>
      </div>
      <Button variant="primary" size="lg" full className="mt-6" icon={<BellRing size={18} aria-hidden />} disabled={n === 0} onClick={() => void saveFile(L('lift-rappels.ics', 'lift-reminders.ics'), ics, 'text/calendar')}>
        {L('Exporter', 'Export')} {plural(n, L('rappel', 'reminder'), L('rappels', 'reminders'))}
      </Button>
      <Disclosure icon={<HelpCircle size={18} aria-hidden />} title={L('Comment ajouter les rappels', 'How to add reminders')} className="mt-4">
        <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
          {/* “Save to Files” is an entry of the iOS share sheet; other devices download the file or hand it to their calendar app. */}
          <li><span className="font-semibold text-text">1.</span> {isIOS() ? L('Choisis « Exporter » puis « Enregistrer dans Fichiers ».', 'Choose “Export”, then “Save to Files”.') : L('Choisis « Exporter » : le fichier calendrier s’enregistre sur ton appareil.', 'Choose “Export”: the calendar file is saved to your device.')}</li>
          <li><span className="font-semibold text-text">2.</span> {isIOS() ? L('Ouvre le fichier depuis Fichiers, puis « Tout ajouter » dans Calendrier.', 'Open the file from Files, then tap “Add All” in Calendar.') : L('Ouvre-le : ton application de calendrier propose d’ajouter les rappels.', 'Open it: your calendar app offers to add the reminders.')}</li>
          <li><span className="font-semibold text-text">3.</span> {L('Les séances suivent tes jours d’entraînement ; la rotation exacte est dans l’app.', 'Workouts follow your training days; the exact rotation is in the app.')}</li>
        </ol>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">{isNative() ? L('Active les alertes locales dans Plus → Réglages → Repos et alertes.', 'Enable local alerts in More → Settings → Rest and alerts.') : L('La fin de repos écran verrouillé passe par les notifications du serveur Lift : Plus → Réglages → Repos et alertes.', 'End-of-rest alerts on the lock screen go through Lift server notifications: More → Settings → Rest and alerts.')}</p>
      </Disclosure>
      <Disclosure icon={<BookOpen size={18} aria-hidden />} title={L('Dates des semaines allégées', 'Deload dates')} className="mt-3">
        <p className="text-[13px] text-text-2">{PERIODS.filter((p) => p.kind === 'deload' && (!MAINTENANCE || p.end >= todayISO())).slice(0, MAINTENANCE ? 8 : undefined).map((p) => fmtDate(p.start)).join(' · ')}</p>
      </Disclosure>
    </Screen>
  )
}
