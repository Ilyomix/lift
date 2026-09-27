import { useMemo, useState } from 'react'
import { BellRing, CalendarPlus, ChevronLeft, ChevronRight, CirclePause, Flag, Play } from 'lucide-react'
import { addDays, addMonths, capitalize, DAYS_LETTER, diffDays, fmtDate, fmtRelativeDay, MONTHS, monthKey, todayISO } from '../lib/date'
import { plural } from '../lib/format'
import { buildIcs, icsEventCount, type IcsOptions } from '../lib/ics'
import {
  calendarMonth, contextAt, GOAL_DATE, milestones, PERIODS, periodRangeLabel, PHASES, prescribe, projectSessions, reentryForGap, TYPE_META,
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

  return (
    <Screen>
      <Header
        eyebrow={`${plural(plan.planned, 'séance prévue', 'séances prévues')} d’ici le ${fmtDate(GOAL_DATE, { long: true })}`}
        title="Calendrier"
        sub={`${plan.done} faites + ${plan.planned} prévues = ${plan.total} séances. Une séance manquée décale la rotation, elle n’est jamais sautée.`}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{capitalize(MONTHS[m - 1])} <span className="text-text-2">{y}</span></h2>
        <div className="flex items-center gap-1">
          {month !== monthKey(today) && <Button size="sm" variant="ghost" onClick={() => setMonth(monthKey(today))}>Aujourd’hui</Button>}
          <button type="button" aria-label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong hover:border-muted"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong hover:border-muted"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <span key={d}>{DAYS_LETTER[d]}</span>)}
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
                    aria-label={`${fmtDate(c.date, { weekday: true, long: true })}${done ? ` : ${TYPE_META[done.type].label} faite` : c.planned ? ` : ${TYPE_META[c.planned.type].label} prévue` : ''}${c.paused ? ', pause' : ''}`}
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
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] bg-text" />} label="Faite" />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-line-strong" />} label="Prévue" />
        <Legend swatch={<span className="hatch h-3.5 w-5 rounded-[3px] border border-line" />} label="Pause" />
        <Legend swatch={<span className="h-3.5 w-5 rounded-[3px] border border-signal" />} label="Aujourd’hui" />
        <span className="text-muted">UP Upper · LO Lower · PS Push · PL Pull · LG Legs</span>
      </div>

      <Section title="Le programme">
        <PhaseTrack today={today} />
        <Card className="mt-4 divide-y divide-line">
          {PERIODS.filter((p) => p.kind !== 'pre').map((p) => {
            const current = today >= p.start && today <= p.end
            return (
              <div key={p.id} className={cx('flex items-start gap-3 px-4 py-3', current && 'bg-signal-soft')}>
                <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-[3px]', p.kind === 'deload' ? 'hatch border border-line-strong' : p.kind === 'holiday' ? 'bg-surface-3' : p.kind === 'stabilization' ? 'bg-signal' : '')} style={p.kind === 'block' ? { background: `color-mix(in oklch, var(--text) ${p.phase === 'recomp' ? 42 : 82}%, transparent)` } : undefined} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold">{p.label}{current && <span className="ml-2 text-[12px] font-semibold text-signal-text">en cours</span>}</p>
                    <p className="shrink-0 text-[12px] text-muted tnum">{periodRangeLabel(p)}</p>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-[1.4] text-text-2">{PHASES[p.phase].short} · {p.note}</p>
                </div>
              </div>
            )
          })}
        </Card>
      </Section>

      {next.length > 0 && (
        <Section title="Prochaines étapes">
          <ol className="space-y-3">
            {next.map((ms) => (
              <li key={ms.date + ms.title} className="flex gap-3">
                <span className="w-16 shrink-0 pt-0.5 text-[12px] font-semibold text-muted tnum">{fmtDate(ms.date)}</span>
                <div>
                  <p className="text-[15px] font-medium">{ms.title}</p>
                  <p className="text-[13px] text-text-2">Dans {plural(diffDays(today, ms.date), 'jour', 'jours')}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="mt-8 grid gap-2">
        <Button variant="outline" size="lg" full icon={<CalendarPlus size={18} aria-hidden />} onClick={() => navigate('plus/rappels')}>Rappels dans Calendrier (iPhone)</Button>
        <Button variant="outline" size="lg" full icon={<CirclePause size={18} aria-hidden />} onClick={() => navigate('plus/pause')}>{state.programPause.active ? 'Gérer la pause' : 'Mettre le programme en pause'}</Button>
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
                <span className="block text-[15px] font-semibold">{TYPE_META[w.type].label} · n°{w.sessionNumber}</span>
                <span className="text-[13px] text-text-2">{w.exercises.filter((e) => !e.skipped).length} exercices</span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
          ))}
        </div>
      ) : planned ? (
        <div className="mt-4">
          <p className="text-[15px]"><span className="font-semibold">{TYPE_META[planned.type].label}</span> prévue {planned.tentative ? '(si reprise du programme)' : ''}</p>
          <ul className="mt-3 space-y-1.5 text-[14px] text-text-2">
            {state.templates[planned.type].exercises.map((e, i) => {
              const p = prescribe(e, date, state.reentry)
              return <li key={i} className="flex justify-between gap-3"><span>{e.name}</span><span className="shrink-0 tnum text-muted">{p.sets} × {p.minReps}–{p.maxReps}</span></li>
            })}
          </ul>
          {date === today && !state.activeWorkout && (
            <Button variant="primary" size="lg" full className="mt-5" icon={<Play size={18} aria-hidden />} onClick={() => { onClose(); onStart(planned.type) }}>Commencer maintenant</Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[15px] text-text-2">{date < today ? 'Aucune séance ce jour-là.' : 'Repos. Marche 8 000 à 10 000 pas.'}</p>
      )}
      {ctx.period && <p className="mt-5 text-[13px] leading-[1.45] text-muted">{ctx.period.note}</p>}
    </Sheet>
  )
}

// ───────────────────────── Pause ─────────────────────────

const REASONS: { id: PauseReason; label: string }[] = [
  { id: 'vacances', label: 'Vacances' },
  { id: 'maladie', label: 'Maladie' },
  { id: 'blessure', label: 'Blessure' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'autre', label: 'Autre' },
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
      <Header backTo="plus" eyebrow="Système de pause" title={p.active ? 'Programme en pause' : 'Mettre en pause'} sub={`Vacances, maladie, blessure : le calendrier reste calé sur le ${fmtDate(GOAL_DATE, { long: true })}, et la reprise est adaptée à la durée de l’arrêt.`} />
      {p.active ? (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CirclePause size={18} className="text-muted" aria-hidden />
              <p className="text-[15px] font-semibold">Depuis {fmtRelativeDay(p.startedAt!.slice(0, 10), today)}{p.reason ? ` · ${REASONS.find((r) => r.id === p.reason)?.label}` : ''}</p>
            </div>
            {p.plannedEnd && <p className="mt-1 text-[13px] text-text-2">Reprise prévue le {fmtDate(addDays(p.plannedEnd, 1), { weekday: true, long: true })}</p>}
            {p.note && <p className="mt-1 text-[13px] text-text-2">{p.note}</p>}
          </Card>
          <Section title="À la reprise">
            <Card className="p-4">
              <p className="text-[15px] font-semibold">{preview ? preview.label : 'Reprise normale'}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{preview ? preview.advice : 'Moins d’une semaine d’arrêt : la rotation reprend là où elle s’est arrêtée, sans ajustement.'}</p>
            </Card>
          </Section>
          <Button variant="primary" size="lg" full className="mt-6" onClick={() => { endPause(); navigate('') }}>Reprendre le programme</Button>
        </>
      ) : (
        <>
          <Section title="Raison">
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r.id} type="button" aria-pressed={reason === r.id} onClick={() => setReason(r.id)} className={cx('pressable h-10 rounded-full border px-4 text-[14px] font-semibold', reason === r.id ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                  {r.label}
                </button>
              ))}
            </div>
          </Section>
          <Section title="Dernier jour de pause (optionnel)">
            <DateInput label="Dernier jour de pause" value={end} min={today} max={GOAL_DATE} onChange={setEnd} placeholder="Sans date de reprise" clearable />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              {[3, 7, 14, 21].map((n) => {
                const d = addDays(today, n - 1)
                return (
                  <button key={n} type="button" aria-pressed={end === d} onClick={() => setEnd(d)} className={cx('pressable h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold', end === d ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}>
                    {n < 7 ? `${n} jours` : n === 7 ? '1 semaine' : `${n / 7} semaines`}
                  </button>
                )
              })}
            </div>
            {plannedGap !== null && <p className="mt-2 text-[13px] text-text-2">Reprise le {fmtDate(addDays(end, 1), { weekday: true, long: true })}. {reentryForGap(plannedGap)?.advice ?? 'Moins d’une semaine : reprise normale.'}</p>}
          </Section>
          <Section title="Note">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : épaule gauche à surveiller" />
          </Section>
          <Button variant="ink" size="lg" full className="mt-6" icon={<CirclePause size={18} aria-hidden />} onClick={() => { startPause({ reason, plannedEnd: end || null, note: note || undefined }); navigate('') }}>
            Démarrer la pause
          </Button>
        </>
      )}
      <Section title="Les règles de reprise">
        <Card className="divide-y divide-line text-[14px]">
          {[
            ['1 séance manquée', 'La rotation se décale, rien n’est sauté.'],
            ['1 semaine', 'Bloc en cours, charges −5 à −10 %, RIR 2–3 pendant 2 séances.'],
            ['2–3 semaines', 'Une semaine comme une S1 : RIR 3, −30 % de séries.'],
            ['Plus de 3 semaines', '2 semaines de remise en route, puis retour au bloc.'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 px-4 py-3">
              <span className="w-28 shrink-0 font-semibold">{k}</span>
              <span className="text-text-2">{v}</span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">1 à 3 semaines d’arrêt coûtent peu : des cycles 6 semaines on / 3 off ont donné la même hypertrophie que l’entraînement continu (Ogasawara 2013). Les seuils sont une opinion d’experts.</p>
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
      <Header backTo="plus" eyebrow="Notifications" title="Rappels iPhone" sub="Un fichier calendrier ajoute tes rappels à l’app Calendrier : notifications natives, même application fermée, sans serveur." />
      <Card className="divide-y divide-line">
        <Toggle label="Séances" hint={`Chaque jour d’entraînement, alerte 30 min avant`} checked={o.training} onChange={set('training')} />
        <Toggle label="Pesée à jeun" hint="Chaque matin : la moyenne sur 7 jours guide les calories" checked={o.weighIn} onChange={set('weighIn')} />
        <Toggle label="Tour de taille" hint="Un dimanche sur deux" checked={o.waist} onChange={set('waist')} />
        <Toggle label="Photos" hint="Toutes les 4 semaines" checked={o.photos} onChange={set('photos')} />
        <Toggle label="Semaines de décharge" hint="Alerte la veille" checked={o.deloads} onChange={set('deloads')} />
        <Toggle label="Phases et objectif" hint={`Début du programme, sèche, fêtes, stabilisation, ${fmtDate(GOAL_DATE, { long: true })}`} checked={o.phases} onChange={set('phases')} />
      </Card>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Heure des séances</p>
          <TimeInput label="Heure des séances" value={state.prefs.trainingTime} onChange={(v) => setPrefs({ trainingTime: v })} />
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Heure de la pesée</p>
          <TimeInput label="Heure de la pesée" value={state.prefs.weighInTime} onChange={(v) => setPrefs({ weighInTime: v })} />
        </div>
      </div>
      <Button variant="primary" size="lg" full className="mt-6" icon={<BellRing size={18} aria-hidden />} disabled={n === 0} onClick={() => void saveFile('lift-rappels.ics', ics, 'text/calendar')}>
        Ajouter {plural(n, 'rappel', 'rappels')}
      </Button>
      <Section title="Sur iPhone">
        <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
          <li><span className="font-semibold text-text">1.</span> Touche « Ajouter » puis « Enregistrer dans Fichiers ».</li>
          <li><span className="font-semibold text-text">2.</span> Ouvre le fichier depuis Fichiers, puis « Tout ajouter » dans Calendrier.</li>
          <li><span className="font-semibold text-text">3.</span> Les séances suivent tes jours d’entraînement ; la rotation exacte est dans l’app.</li>
        </ol>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">La fin de repos écran verrouillé passe par les notifications du serveur Lift : Plus → Réglages → Minuteur de repos.</p>
      </Section>
      <Eyebrow className="mt-8">Semaines de décharge</Eyebrow>
      <p className="mt-1 text-[13px] text-text-2">{PERIODS.filter((p) => p.kind === 'deload').map((p) => fmtDate(p.start)).join(' · ')}</p>
    </Screen>
  )
}
