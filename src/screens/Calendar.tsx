import { useMemo, useState } from 'react'
import { BellRing, CalendarPlus, ChevronLeft, ChevronRight, CirclePause, Flag, Play } from 'lucide-react'
import { addDays, addMonths, capitalize, dayLetter, diffDays, fmtDate, fmtRelativeDay, monthKey, monthName, todayISO } from '../lib/date'
import { plural } from '../lib/format'
import { L } from '../lib/i18n'
import { buildIcs, icsEventCount, type IcsOptions } from '../lib/ics'
import {
  calendarMonth, contextAt, GOAL_DATE, MAINTENANCE, milestones, PERIODS, periodRangeLabel, PHASES, prescribe, projectSessions, reentryForGap, TYPE_META,
  gapSinceLastSession, sessionPlan,
} from '../lib/program'
import { navigate } from '../lib/router'
import { saveFile } from '../lib/share'
import { useStore } from '../lib/store'
import type { ISODate, PauseReason } from '../lib/types'
import { PhaseTrack } from '../components/Program'
import { Button, Card, cx, DateInput, Eyebrow, Header, inputClass, Screen, Section, Sheet, Tag, TimeInput, Toggle } from '../components/ui'

export function CalendarScreen() {
  const state = useStore((s) => s.state)
  const startSession = useStore((s) => s.startSession)
  const today = todayISO()
  const [month, setMonth] = useState(monthKey(today))
  const [day, setDay] = useState<ISODate | null>(null)
  const planned = useMemo(() => projectSessions(state, GOAL_DATE, today), [state, today])
  const weeks = useMemo(() => calendarMonth(state, month, planned, today), [state, month, planned, today])
  const [y, m] = month.split('-').map(Number)
  const next = milestones(today).slice(0, 5)
  const plan = useMemo(() => sessionPlan(state, today), [state, today])
  const cycle = plan.cycle
  // Maintenance mode has no end: the list shows what comes next, not the whole calendar laid out.
  const periods = MAINTENANCE ? PERIODS.filter((p) => p.kind !== 'pre' && p.end >= today).slice(0, 8) : PERIODS.filter((p) => p.kind !== 'pre')

  return (
    <Screen>
      <Header
        eyebrow={cycle ? L('Mode entretien · sans date de fin', 'Maintenance mode · no end date') : L(`${plural(plan.planned, 'séance prévue', 'séances prévues')} d’ici le ${fmtDate(GOAL_DATE, { long: true })}`, `${plural(plan.planned, 'session planned', 'sessions planned')} until ${fmtDate(GOAL_DATE, { long: true })}`)}
        title={L('Calendrier', 'Calendar')}
        sub={cycle
          ? L(`${cycle.label} : ${plan.done} faites + ${plan.planned} prévues jusqu’au ${fmtDate(cycle.end, { long: true })}. Une séance manquée décale la rotation, elle n’est jamais sautée.`, `${cycle.label}: ${plan.done} done + ${plan.planned} planned until ${fmtDate(cycle.end, { long: true })}. A missed session shifts the rotation; it’s never skipped.`)
          : L(`${plan.done} faites + ${plan.planned} prévues = ${plan.total} séances. Une séance manquée décale la rotation, elle n’est jamais sautée.`, `${plan.done} done + ${plan.planned} planned = ${plan.total} sessions. A missed session shifts the rotation; it’s never skipped.`)}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{capitalize(monthName(m - 1))} <span className="text-text-2">{y}</span></h2>
        <div className="flex items-center gap-1">
          {month !== monthKey(today) && <Button size="sm" variant="ghost" onClick={() => setMonth(monthKey(today))}>{L('Aujourd’hui', 'Today')}</Button>}
          <button type="button" aria-label={L('Mois précédent', 'Previous month')} onClick={() => setMonth(addMonths(month, -1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong hover:border-muted"><ChevronLeft size={18} /></button>
          <button type="button" aria-label={L('Mois suivant', 'Next month')} onClick={() => setMonth(addMonths(month, 1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong hover:border-muted"><ChevronRight size={18} /></button>
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
                const code = done ? TYPE_META[done.type].code : c.planned ? TYPE_META[c.planned.type].code : null
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => setDay(c.date)}
                    aria-label={`${fmtDate(c.date, { weekday: true, long: true })}${done ? L(` : ${TYPE_META[done.type].label} faite`, `: ${TYPE_META[done.type].label} done`) : c.planned ? L(` : ${TYPE_META[c.planned.type].label} prévue`, `: ${TYPE_META[c.planned.type].label} planned`) : ''}${c.paused ? L(', pause', ', paused') : ''}`}
                    className={cx(
                      'pressable relative flex aspect-[0.86] flex-col items-center justify-between rounded-[9px] border py-1.5',
                      !c.inMonth && 'opacity-35',
                      w.kind === 'deload' && !done ? 'border-line-strong' : 'border-line',
                      c.paused && !done && 'hatch',
                      c.isToday && 'border-signal ring-1 ring-signal',
                    )}
                  >
                    <span className={cx('text-[12px] tnum', c.isToday ? 'font-bold text-signal-text' : 'text-text-2')}>{Number(c.date.slice(8))}</span>
                    {c.isGoal ? (
                      <Flag size={16} className="text-signal-text" aria-hidden />
                    ) : code ? (
                      <span className={cx('flex h-[22px] min-w-[30px] items-center justify-center rounded-[5px] px-1 text-[10px] font-bold tracking-[0.03em]', done ? 'bg-text text-bg' : c.planned?.tentative ? 'border border-dashed border-line-strong text-muted' : 'border border-line-strong text-text-2')}>
                        {c.done.length > 1 ? `${c.done.length}×` : code}
                      </span>
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
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] bg-text" />} label={L('Faite', 'Done')} />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-line-strong" />} label={L('Prévue', 'Planned')} />
        <Legend swatch={<span className="hatch h-3.5 w-5 rounded-[3px] border border-line" />} label={L('Pause', 'Paused')} />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-signal" />} label={L('Aujourd’hui', 'Today')} />
        <span className="text-muted">UP Upper · LO Lower · PS Push · PL Pull · LG Legs</span>
      </div>

      <Section title={L('Le programme', 'The program')}>
        <PhaseTrack today={today} />
        <Card className="mt-4 divide-y divide-line">
          {periods.map((p) => {
            const current = today >= p.start && today <= p.end
            return (
              <div key={p.id} className={cx('flex items-start gap-3 px-4 py-3', current && 'bg-signal-soft')}>
                <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-[3px]', p.kind === 'deload' ? 'hatch border border-line-strong' : p.kind === 'holiday' ? 'bg-surface-3' : p.kind === 'stabilization' ? 'bg-signal' : '')} style={p.kind === 'block' ? { background: `color-mix(in oklch, var(--text) ${p.phase === 'recomp' || p.phase === 'upkeep' ? 42 : 82}%, transparent)` } : undefined} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold">{p.label}{current && <span className="ml-2 text-[12px] font-semibold text-signal-text">{L('en cours', 'current')}</span>}</p>
                    <p className="shrink-0 text-[12px] text-muted tnum">{periodRangeLabel(p)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-[1.4] text-text-2">{PHASES[p.phase].short} · {p.note}</p>
                </div>
              </div>
            )
          })}
        </Card>
        {MAINTENANCE && (
          <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Le plan continue ensuite au même rythme, sans date de fin : blocs de 5 semaines + décharge, fêtes à volume réduit.', 'The plan then keeps the same rhythm, with no end date: 5-week blocks + deload, holidays at reduced volume.')}</p>
        )}
      </Section>

      {next.length > 0 && (
        <Section title={L('Prochaines étapes', 'Upcoming milestones')}>
          <ol className="space-y-3">
            {next.map((ms) => (
              <li key={ms.date + ms.title} className="flex gap-3">
                <span className="w-16 shrink-0 pt-0.5 text-[12px] font-semibold text-muted tnum">{fmtDate(ms.date)}</span>
                <div>
                  <p className="text-[15px] font-medium">{ms.title}</p>
                  <p className="text-[13px] text-text-2">{L('Dans', 'In')} {plural(diffDays(today, ms.date), L('jour', 'day'), L('jours', 'days'))}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="mt-8 grid gap-2">
        <Button variant="outline" size="lg" full icon={<CalendarPlus size={18} aria-hidden />} onClick={() => navigate('plus/rappels')}>{L('Rappels dans Calendrier (iPhone)', 'Reminders in Calendar (iPhone)')}</Button>
        <Button variant="outline" size="lg" full icon={<CirclePause size={18} aria-hidden />} onClick={() => navigate('plus/pause')}>{state.programPause.active ? L('Gérer la pause', 'Manage the pause') : L('Mettre le programme en pause', 'Pause the program')}</Button>
      </div>

      <DaySheet date={day} onClose={() => setDay(null)} planned={planned.find((p) => p.date === day) ?? null} onStart={(t) => { startSession(t); navigate('seance') }} />
    </Screen>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5">{swatch}{label}</span>
}

function DaySheet({ date, onClose, planned, onStart }: { date: ISODate | null; onClose: () => void; planned: { type: keyof typeof TYPE_META; tentative: boolean } | null; onStart: (t: keyof typeof TYPE_META) => void }) {
  const state = useStore((s) => s.state)
  if (!date) return null
  const today = todayISO()
  const done = state.workouts.filter((w) => w.date === date)
  const ctx = contextAt(date)
  return (
    <Sheet open onClose={onClose} title={capitalize(fmtDate(date, { weekday: true, long: true, year: true }))}>
      <div className="flex flex-wrap items-center gap-2">
        {ctx.period && <Tag tone="ink">{ctx.title}</Tag>}
        {ctx.phase && <Tag tone="outline">{ctx.phase.short}</Tag>}
        {ctx.effort && <span className="text-[13px] text-text-2">{ctx.effort}</span>}
      </div>
      {done.length > 0 ? (
        <div className="mt-4 space-y-2">
          {done.map((w) => (
            <button key={w.id} type="button" onClick={() => { onClose(); navigate(`seance/${w.id}`) }} className="pressable card flex w-full items-center justify-between p-4 text-left hover:border-line-strong">
              <span>
                <span className="block text-[15px] font-semibold">{TYPE_META[w.type].label} · {L('n°', '#')}{w.sessionNumber}</span>
                <span className="text-[13px] text-text-2">{L(`${w.exercises.filter((e) => !e.skipped).length} exercices`, plural(w.exercises.filter((e) => !e.skipped).length, 'exercise', 'exercises'))}</span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
          ))}
        </div>
      ) : planned ? (
        <div className="mt-4">
          <p className="text-[15px]"><span className="font-semibold">{TYPE_META[planned.type].label}</span> {L('prévue', 'planned')} {planned.tentative ? L('(si reprise du programme)', '(if the program resumes)') : ''}</p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-text-2">
            {state.templates[planned.type].exercises.map((e, i) => {
              const p = prescribe(e, date, state.reentry)
              return <li key={i} className="flex justify-between gap-3"><span>{e.name}</span><span className="shrink-0 tnum text-muted">{p.sets} × {p.minReps}–{p.maxReps}</span></li>
            })}
          </ul>
          {date === today && !state.activeWorkout && (
            <Button variant="primary" size="lg" full className="mt-5" icon={<Play size={18} aria-hidden />} onClick={() => { onClose(); onStart(planned.type) }}>{L('Commencer maintenant', 'Start now')}</Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[15px] text-text-2">{date < today ? L('Aucune séance ce jour-là.', 'No session that day.') : L('Repos. Marche 8 000 à 10 000 pas.', 'Rest. Walk 8,000 to 10,000 steps.')}</p>
      )}
      {ctx.period && <p className="mt-5 text-[13px] leading-[1.45] text-muted">{ctx.period.note}</p>}
    </Sheet>
  )
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
      <Header backTo="plus" eyebrow={L('Système de pause', 'Pause system')} title={p.active ? L('Programme en pause', 'Program paused') : L('Mettre en pause', 'Pause the program')} sub={MAINTENANCE ? L('Vacances, maladie, blessure : le calendrier continue, et la reprise est adaptée à la durée de l’arrêt.', 'Vacation, illness, injury: the calendar keeps going, and your return is adapted to how long you stopped.') : L(`Vacances, maladie, blessure : le calendrier reste calé sur le ${fmtDate(GOAL_DATE, { long: true })}, et la reprise est adaptée à la durée de l’arrêt.`, `Vacation, illness, injury: the calendar stays locked on ${fmtDate(GOAL_DATE, { long: true })}, and your return is adapted to how long you stopped.`)} />
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
          <Section title={L('À la reprise', 'When you return')}>
            <Card className="p-4">
              <p className="text-[15px] font-semibold">{preview ? preview.label : L('Reprise normale', 'Normal return')}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{preview ? preview.advice : L('Moins d’une semaine d’arrêt : la rotation reprend là où elle s’est arrêtée, sans ajustement.', 'Less than a week off: the rotation picks up where it left off, with no adjustment.')}</p>
            </Card>
          </Section>
          <Button variant="primary" size="lg" full className="mt-6" onClick={() => { endPause(); navigate('') }}>{L('Reprendre le programme', 'Resume the program')}</Button>
        </>
      ) : (
        <>
          <Section title={L('Raison', 'Reason')}>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r.id} type="button" aria-pressed={reason === r.id} onClick={() => setReason(r.id)} className={cx('pressable h-10 rounded-full border px-4 text-[14px] font-semibold', reason === r.id ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                  {r.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title={L('Dernier jour de pause (optionnel)', 'Last day of the pause (optional)')}>
            <DateInput label={L('Dernier jour de pause', 'Last day of the pause')} value={end} min={today} max={GOAL_DATE} onChange={setEnd} placeholder={L('Sans date de reprise', 'No return date')} clearable />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              {[3, 7, 14, 21].map((n) => {
                const d = addDays(today, n - 1)
                return (
                  <button key={n} type="button" aria-pressed={end === d} onClick={() => setEnd(d)} className={cx('pressable h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold', end === d ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                    {n < 7 ? L(`${n} jours`, `${n} days`) : n === 7 ? L('1 semaine', '1 week') : L(`${n / 7} semaines`, `${n / 7} weeks`)}
                  </button>
                )
              })}
            </div>
            {plannedGap !== null && <p className="mt-2 text-[13px] text-text-2">{L('Reprise le', 'Back on')} {fmtDate(addDays(end, 1), { weekday: true, long: true })}. {reentryForGap(plannedGap)?.advice ?? L('Moins d’une semaine : reprise normale.', 'Less than a week: normal return.')}</p>}
          </Section>
          <Section title="Note">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('Ex. : épaule gauche à surveiller', 'E.g. keep an eye on left shoulder')} />
          </Section>
          <Button variant="ink" size="lg" full className="mt-6" icon={<CirclePause size={18} aria-hidden />} onClick={() => { startPause({ reason, plannedEnd: end || null, note: note || undefined }); navigate('') }}>
            {L('Démarrer la pause', 'Start the pause')}
          </Button>
        </>
      )}
      <Section title={L('Les règles de reprise', 'Return rules')}>
        <Card className="divide-y divide-line text-[14px]">
          {[
            [L('1 séance manquée', '1 missed session'), L('La rotation se décale, rien n’est sauté.', 'The rotation shifts; nothing is skipped.')],
            [L('1 semaine', '1 week'), L('Bloc en cours, charges −5 à −10 %, RIR 2–3 pendant 2 séances.', 'Current block, loads −5 to −10%, RIR 2–3 for 2 sessions.')],
            [L('2–3 semaines', '2–3 weeks'), L('Une semaine comme une S1 : RIR 3, −30 % de séries.', 'One week run like a W1: RIR 3, sets −30%.')],
            [L('Plus de 3 semaines', 'Over 3 weeks'), L('2 semaines de remise en route, puis retour au bloc.', '2 restart weeks, then back to the block.')],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3">
              <span className="w-28 shrink-0 font-semibold">{k}</span>
              <span className="text-text-2">{v}</span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('1 à 3 semaines d’arrêt coûtent peu : des cycles 6 semaines on / 3 off ont donné la même hypertrophie que l’entraînement continu (Ogasawara 2013). Les seuils sont une opinion d’experts.', '1 to 3 weeks off cost little: cycles of 6 weeks on / 3 off produced the same hypertrophy as continuous training (Ogasawara 2013). The thresholds are expert opinion.')}</p>
      </Section>
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
      <Header backTo="plus" eyebrow="Notifications" title={L('Rappels iPhone', 'iPhone reminders')} sub={L('Un fichier calendrier ajoute tes rappels à l’app Calendrier : notifications natives, même application fermée, sans serveur.', 'A calendar file adds your reminders to the Calendar app: native notifications, even with the app closed, no server needed.')} />
      <Card className="divide-y divide-line">
        <Toggle label={L('Séances', 'Sessions')} hint={L(`Chaque jour d’entraînement, alerte 30 min avant`, `Every training day, alert 30 min before`)} checked={o.training} onChange={set('training')} />
        <Toggle label={L('Pesée à jeun', 'Fasted weigh-in')} hint={L('Chaque matin : la moyenne sur 7 jours guide les calories', 'Every morning: the 7-day average guides calories')} checked={o.weighIn} onChange={set('weighIn')} />
        <Toggle label={L('Tour de taille', 'Waist')} hint={L('Un dimanche sur deux', 'Every other Sunday')} checked={o.waist} onChange={set('waist')} />
        <Toggle label="Photos" hint={L('Toutes les 4 semaines', 'Every 4 weeks')} checked={o.photos} onChange={set('photos')} />
        <Toggle label={L('Semaines de décharge', 'Deload weeks')} hint={L('Alerte la veille', 'Alert the day before')} checked={o.deloads} onChange={set('deloads')} />
        <Toggle label={MAINTENANCE ? L('Phases', 'Phases') : L('Phases et objectif', 'Phases and goal')} hint={MAINTENANCE ? L('Début du programme, fêtes', 'Program start, holidays') : L(`Début du programme, sèche, fêtes, stabilisation, ${fmtDate(GOAL_DATE, { long: true })}`, `Program start, cut, holidays, stabilization, ${fmtDate(GOAL_DATE, { long: true })}`)} checked={o.phases} onChange={set('phases')} />
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Heure des séances', 'Session time')}</p>
          <TimeInput label={L('Heure des séances', 'Session time')} value={state.prefs.trainingTime} onChange={(v) => setPrefs({ trainingTime: v })} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Heure de la pesée', 'Weigh-in time')}</p>
          <TimeInput label={L('Heure de la pesée', 'Weigh-in time')} value={state.prefs.weighInTime} onChange={(v) => setPrefs({ weighInTime: v })} />
        </div>
      </div>
      <Button variant="primary" size="lg" full className="mt-6" icon={<BellRing size={18} aria-hidden />} disabled={n === 0} onClick={() => void saveFile(L('lift-rappels.ics', 'lift-reminders.ics'), ics, 'text/calendar')}>
        {L('Ajouter', 'Add')} {plural(n, L('rappel', 'reminder'), L('rappels', 'reminders'))}
      </Button>
      <Section title={L('Sur iPhone', 'On iPhone')}>
        <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
          <li><span className="font-semibold text-text">1.</span> {L('Touche « Ajouter » puis « Enregistrer dans Fichiers ».', 'Tap “Add”, then “Save to Files”.')}</li>
          <li><span className="font-semibold text-text">2.</span> {L('Ouvre le fichier depuis Fichiers, puis « Tout ajouter » dans Calendrier.', 'Open the file from Files, then tap “Add All” in Calendar.')}</li>
          <li><span className="font-semibold text-text">3.</span> {L('Les séances suivent tes jours d’entraînement ; la rotation exacte est dans l’app.', 'Sessions follow your training days; the exact rotation is in the app.')}</li>
        </ol>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">{L('La fin de repos écran verrouillé passe par les notifications du serveur Lift : Plus → Réglages → Minuteur de repos.', 'End-of-rest alerts on the lock screen go through Lift server notifications: More → Settings → Rest timer.')}</p>
      </Section>
      <Eyebrow className="mt-8">{L('Semaines de décharge', 'Deload weeks')}</Eyebrow>
      <p className="mt-1 text-[13px] text-text-2">{PERIODS.filter((p) => p.kind === 'deload' && (!MAINTENANCE || p.end >= todayISO())).slice(0, MAINTENANCE ? 8 : undefined).map((p) => fmtDate(p.start)).join(' · ')}</p>
    </Screen>
  )
}
