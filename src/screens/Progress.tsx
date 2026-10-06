import { L, locale } from '../lib/i18n'
import { useMemo, useRef, useState } from 'react'
import { BookOpen, Camera, ChevronLeft, ChevronRight, Columns2, Gauge, Plus, Ruler, Trash } from 'lucide-react'
import { addDays, capitalize, dayNumber, diffDays, fmtDate, fmtRelativeDay, mondayOf, parseISO, todayISO } from '../lib/date'
import { fmtNum, fmtSigned, parseNumber, plural, uid } from '../lib/format'
import { gymName, isGymBound } from '../lib/gyms'
import { infoFor, MUSCLES } from '../lib/library'
import { GOAL_DATE, MAINTENANCE, PERIODS, PROGRAM_START, trainingDays, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { imageToDataUrl } from '../lib/share'
import {
  cutAdvice, goalWeightRange, measureSeries, movingAverage7, phaseRateLabel, plannedWeightPath, weightStatus,
} from '../lib/stats'
import { GOAL_PHOTO_ID, useStore } from '../lib/store'
import {
  averageRir, doneSets, exerciseHistory, plannedVolume, sessionDurationMin, sessionSetCount, setsSummary, weekVolume, weeklySessionCounts,
} from '../lib/training'
import type { AppState, BodyEntry } from '../lib/types'
import { Columns, LineChart, RangeBars, Sparkline, type ChartSeries } from '../components/charts'
import { ExerciseSheet } from '../components/ExerciseSheet'
import { RecordTag, StatusTag } from '../components/Status'
import { SportArt } from '../components/SportArt'
import { Button, Card, cx, DateInput, Empty, Field, Header, IconButton, inputClass, Screen, Section, Segmented, Sheet, Tag } from '../components/ui'

type Tab = 'force' | 'corps' | 'volume' | 'seances'

function SessionLink() {
  const active = useStore((s) => s.state.activeWorkout)
  return <Button variant="primary" onClick={() => navigate('seance')}>{active ? L('Revenir à ma séance', 'Return to my workout') : L('Voir ma séance', 'View my workout')}</Button>
}

export function ProgressScreen({ tab, sub }: { tab: Tab; sub?: string }) {
  return (
    <Screen>
      <Header art="chart" title={L('Progrès', 'Progress')} />
      <Segmented
        label={L('Suivi des progrès', 'Progress view')}
        value={tab}
        onChange={(t) => navigate(t === 'force' ? 'progres' : `progres/${t}`, { replace: true })}
        options={[
          { value: 'force', label: L('Force', 'Strength') },
          { value: 'corps', label: L('Corps', 'Body') },
          { value: 'volume', label: 'Volume' },
          { value: 'seances', label: L('Séances', 'Workouts') },
        ]}
      />
      <div className="mt-4">
        {tab === 'force' && <ForceTab />}
        {tab === 'corps' && <BodyTab openMeasure={sub === 'mesure'} />}
        {tab === 'volume' && <VolumeTab />}
        {tab === 'seances' && <HistoryTab />}
      </div>
    </Screen>
  )
}

// ───────────────────────── Force ─────────────────────────

function ForceTab() {
  const state = useStore((s) => s.state)
  const rows = useMemo(() => {
    const ids: string[] = []
    for (const t of Object.values(state.templates)) for (const e of t.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId)
    for (const w of state.workouts) for (const e of w.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId)
    return ids.map((id) => {
      const h = exerciseHistory(state.workouts, id)
      const tpl = Object.values(state.templates).flatMap((t) => t.exercises).find((e) => e.exerciseId === id)
      const prevName = state.workouts.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)?.name
      const info = infoFor(id, { name: tpl?.name ?? prevName })
      const first = h[0]?.best ?? 0
      const last = h[h.length - 1]?.best ?? 0
      return { id, name: tpl?.name ?? info.name, muscle: info.muscle, inProgram: !!tpl, h, delta: h.length > 1 && first > 0 ? (last - first) / first : null }
    })
  }, [state.templates, state.workouts])
  const active = rows.filter((r) => r.inProgram)
  const archived = rows.filter((r) => !r.inProgram && r.h.length)
  if (!rows.some((row) => row.h.length)) return (
    <Empty art="logbook" title={L('Aucune performance enregistrée', 'No performance recorded yet')} action={<SessionLink />}>
      {L('Termine une séance en notant tes séries. Tu retrouveras ici tes charges, tes répétitions et leur évolution.', 'Finish a workout and log your sets. Your loads, reps and how they change will appear here.')}
    </Empty>
  )
  return (
    <>
      <p className="text-[13px] leading-[1.45] text-text-2">{L('Le 1RM estime la charge maximale pour une répétition, à partir de ta meilleure série (formule d’Epley). Au poids du corps, le suivi compare le nombre de répétitions.', '1RM estimates the heaviest load you could lift for one rep, based on your best set (Epley formula). For bodyweight exercises, progress is measured in reps.')}</p>
      {active.length > 0 && <ExerciseList title={L('Programme actuel', 'Current program')} rows={active} />}
      {archived.length > 0 && <ExerciseList title={L('Anciens exercices', 'Past exercises')} rows={archived} />}
    </>
  )
}

function ExerciseList({ title, rows }: { title: string; rows: { id: string; name: string; muscle: string; h: ReturnType<typeof exerciseHistory>; delta: number | null }[] }) {
  return (
    <Section art="dumbbell" title={title}>
      <Card className="divide-y divide-line">
        {rows.map((r) => {
          const last = r.h[r.h.length - 1]
          return (
            <button key={r.id} type="button" onClick={() => navigate(`progres/exercice/${r.id}`)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{r.name}</span>
                <span className="mt-0.5 block truncate text-[13px] text-text-2 tnum">{last ? setsSummary(last.sets, last.unit) : L('Pas encore réalisé', 'Not done yet')}</span>
              </span>
              {r.h.length > 1 && <Sparkline values={r.h.map((x) => x.best)} width={64} />}
              <span className={cx('w-14 shrink-0 text-right text-[13px] font-semibold tnum', r.delta === null ? 'text-muted' : r.delta > 0 ? 'text-good' : r.delta < 0 ? 'text-bad' : 'text-text-2')}>
                {r.delta === null ? '—' : fmtSigned(r.delta * 100, 0, '%')}
              </span>
              <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
            </button>
          )
        })}
      </Card>
    </Section>
  )
}

export function ExerciseDetail({ id }: { id: string }) {
  const state = useStore((s) => s.state)
  const [sheet, setSheet] = useState(false)
  const all = exerciseHistory(state.workouts, id)
  const tpl = Object.values(state.templates).flatMap((t) => t.exercises).find((e) => e.exerciseId === id)
  const historical = [...state.workouts].reverse().flatMap(workout => workout.exercises).find(exercise => exercise.exerciseId === id)
  const info = infoFor(id, tpl ?? historical)
  // Machines: one curve per gym (the same machine elsewhere is another machine).
  const bound = isGymBound({ exerciseId: id, unit: all[0]?.unit ?? tpl?.unit ?? info.unit })
  const gymsUsed = bound ? [...new Set(all.map((x) => x.gymId))] : []
  const [gym, setGym] = useState<string>(() => (gymsUsed.includes(state.gymId) ? state.gymId : gymsUsed[gymsUsed.length - 1] ?? state.gymId))
  const h = bound && gymsUsed.length > 1 ? all.filter((x) => x.gymId === gym) : all
  const unit = h[0]?.unit ?? tpl?.unit ?? info.unit
  const loaded = unit !== 'PDC'
  const series: ChartSeries[] = [{ id: 'best', label: loaded ? L('1RM estimé', 'Estimated 1RM') : L('Meilleure série', 'Best set'), points: h.map((x) => ({ x: dayNumber(x.date), y: x.best })), kind: 'line', color: 'var(--chart-1)' }]
  const first = h[0]
  const last = h[h.length - 1]
  return (
    <Screen>
      <Header art="chart" backTo="progres" eyebrow={info.muscle} title={tpl?.name ?? info.name} sub={h.length ? `${plural(h.length, L('séance', 'workout'), L('séances', 'workouts'))} · ${first && last && first.best > 0 ? `${fmtSigned(((last.best - first.best) / first.best) * 100, 0, '%')} ${L('depuis le', 'since')} ${fmtDate(first.date)}` : ''}` : L('Pas encore réalisé.', 'Not done yet.')} />
      {gymsUsed.length > 1 && (
        <Segmented className="mb-4" label={L('Salle', 'Gym')} value={gym} onChange={setGym} options={gymsUsed.map((g) => ({ value: g, label: gymName(state, g) }))} />
      )}
      {h.length > 0 ? (
        <>
          <Card className="p-4">
            <p className="text-[13px] font-medium text-text-2">{loaded ? L('1RM estimé (kg)', 'Estimated 1RM (kg)') : L('Meilleure série (reps)', 'Best set (reps)')}</p>
            <div className="mt-3">
              <LineChart series={series} ariaLabel={L(`Évolution de ${info.name}`, `${info.name} over time`)} yFormat={(v) => fmtNum(v, loaded ? 0 : 0)} height={200} />
            </div>
          </Card>
          <Card className="mt-3 p-4">
            <p className="text-[13px] font-medium text-text-2">{L('Répétitions propres par séance', 'Clean reps per workout')}</p>
            <div className="mt-3">
              <Columns
                ariaLabel={L('Répétitions propres par séance', 'Clean reps per workout')}
                bars={h.map((x) => ({ key: x.workoutId, label: fmtDate(x.date).replace('.', ''), value: x.totalClean, tooltip: <span className="tnum">{fmtDate(x.date)} · {setsSummary(x.sets, x.unit)}</span> }))}
                height={140}
                format={(v) => fmtNum(v, 0)}
              />
            </div>
          </Card>
          <Section art="logbook" title={L('Historique', 'History')}>
            <Card className="divide-y divide-line">
              {[...h].reverse().map((x) => (
                <button key={x.workoutId} type="button" onClick={() => navigate(`seance/${x.workoutId}`)} className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block text-[14px] text-text-2">{fmtDate(x.date)} · {L('n°', '#')}{x.sessionNumber}</span>
                    <span className="block text-[15px] font-medium tnum">{setsSummary(x.sets, x.unit)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusTag c={x.comparison} />
                    {x.comparison?.isRecord && <RecordTag />}
                  </span>
                </button>
              ))}
            </Card>
          </Section>
        </>
      ) : (
        <Empty art="dumbbell"
          title={all.length ? L('Pas de séance dans cette salle', 'No workouts at this gym') : L('Aucune série enregistrée', 'No sets logged yet')}
          action={all.length
            ? <Button variant="outline" onClick={() => setGym(all[all.length - 1].gymId)}>{L('Voir la dernière salle utilisée', 'View the last gym used')}</Button>
            : <Button variant="outline" onClick={() => setSheet(true)}>{L('Voir le mouvement', 'View the movement')}</Button>}
        >
          {all.length
            ? L('Cet exercice a été enregistré dans une autre salle. Ses résultats sont conservés séparément.', 'This exercise was recorded at another gym. Its results are kept separately.')
            : L('Après une séance comprenant cet exercice, tes séries et tes performances apparaîtront ici. Tu peux déjà consulter sa technique.', 'After a workout that includes this exercise, your sets and performance will appear here. You can explore its technique now.')}
        </Empty>
      )}
      <Button variant="outline" full className="mt-6" icon={<BookOpen size={18} aria-hidden />} onClick={() => setSheet(true)}>
        {L('Technique et alternatives', 'Technique and alternatives')}
      </Button>
      <ExerciseSheet exerciseId={id} name={tpl?.name ?? historical?.name} open={sheet} onClose={() => setSheet(false)} />
    </Screen>
  )
}

// ───────────────────────── Corps ─────────────────────────

function BodyTab({ openMeasure }: { openMeasure: boolean }) {
  const state = useStore((s) => s.state)
  const [measure, setMeasure] = useState(openMeasure)
  const today = todayISO()
  const weights = measureSeries(state.bodyEntries, 'weight')
  const ma = movingAverage7(weights)
  const ws = weightStatus(state, today)
  const goal = goalWeightRange(state, today)
  const waist = measureSeries(state.bodyEntries, 'waist')
  const advice = cutAdvice(state, today)
  const planStart = today < PROGRAM_START ? PROGRAM_START : today
  const ended = !MAINTENANCE && today > GOAL_DATE
  const currentRate = phaseRateLabel(today)
  const firstRate = today < PROGRAM_START ? phaseRateLabel(PROGRAM_START) : ''
  // Maintenance mode has no end date: the trajectory looks 12 weeks ahead.
  const chartEnd = MAINTENANCE ? addDays(today, 84) : ended ? today : GOAL_DATE
  const plan = ws.current && !ended ? plannedWeightPath(planStart, ws.current, MAINTENANCE ? { periods: PERIODS, goal: chartEnd } : undefined) : []
  const weightSeries: ChartSeries[] = [
    { id: 'raw', label: L('Pesées', 'Weigh-ins'), points: weights.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dots', color: 'var(--chart-2)' },
    { id: 'ma', label: L('Moyenne 7 jours', '7-day average'), points: ma.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'line', color: 'var(--chart-1)' },
    ...(plan.length ? [{ id: 'plan', label: L('Trajectoire du plan', 'Plan trajectory'), points: plan.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dashed' as const, color: 'var(--text-2)', endLabel: false }] : []),
  ]
  return (
    <>
      {weights.length > 0 ? <>
      <div className="grid grid-cols-3 gap-3">
        <Figure label={ws.isAverage && !ws.stale ? L('Moyenne 7 j', '7-day avg') : L('Dernière pesée', 'Last weigh-in')} value={ws.current !== null ? `${fmtNum(ws.current)} kg` : '—'} />
        <Figure label={L('Tendance', 'Trend')} value={ws.weeklyChangePct !== null ? L(`${fmtSigned(ws.weeklyChangePct, 2)} %`, `${fmtSigned(ws.weeklyChangePct, 2)}%`) : '—'} hint={L('par semaine', 'per week')} />
        <Figure label={L('Cible', 'Target')} value={goal ? `${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)}` : '—'} hint={goal?.computed ? L('estimé · kg', 'estimated · kg') : 'kg'} />
      </div>
      <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
        {currentRate ? <>{L('Rythme visé maintenant : ', 'Target pace now: ')}<span className="font-semibold text-text">{currentRate}</span>.</>
          : today < PROGRAM_START ? <>{L(`À partir du ${fmtDate(PROGRAM_START, { long: true, year: true })}`, `From ${fmtDate(PROGRAM_START, { long: true, year: true })}`)}{firstRate ? <> : <span className="font-semibold text-text">{firstRate}</span>.</> : '.'}</>
            : ended ? L('Ton plan daté est terminé. Ajuste ton objectif pour définir la suite.', 'Your dated plan has ended. Adjust your goal to plan what comes next.')
              : L('Consulte le programme pour voir les prochaines phases.', 'View the program to see the next phases.')} {advice ?? ''}
      </p>

      <Card className="mt-4 p-4">
        <p className="text-[13px] font-medium text-text-2">{L('Poids (kg)', 'Weight (kg)')}</p>
        <div className="mt-3">
          <LineChart
            series={weightSeries}
            ariaLabel={L('Poids, moyenne sur 7 jours et trajectoire du plan', 'Weight, 7-day average and plan trajectory')}
            height={220}
            band={goal ? { y0: goal.min, y1: goal.max, label: L(`Cible ${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)} kg`, `Target ${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)} kg`) } : undefined}
            xDomain={weights.length ? [dayNumber(weights[0].date), dayNumber(chartEnd)] : undefined}
          />
        </div>
      </Card>
      </> : <Empty art="logbook"
        title={state.bodyEntries.length ? L('Ajoute ta première pesée', 'Add your first weigh-in') : L('Aucune mesure enregistrée', 'No measurements yet')}
        action={<Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setMeasure(true)}>{state.bodyEntries.length ? L('Ajouter une pesée', 'Add a weigh-in') : L('Ajouter une mesure', 'Add a measurement')}</Button>}
      >
        {state.bodyEntries.length
          ? L('Tes autres mesures sont conservées ci-dessous. Une pesée permettra de commencer le suivi du poids.', 'Your other measurements are saved below. A weigh-in will start your weight history.')
          : L('Poids, tour de taille ou autre mesure : choisis ce que tu souhaites suivre. Tes courbes se construiront avec tes propres données.', 'Weight, waist or another measurement: choose what you want to track. Your charts will grow from your own records.')}
      </Empty>}

      {waist.length > 0 && (
        <Card className="mt-3 p-4">
          <p className="text-[13px] font-medium text-text-2">{L('Tour de taille (cm)', 'Waist (cm)')}</p>
          <div className="mt-3">
            <LineChart
              series={[{ id: 'waist', label: L('Tour de taille', 'Waist'), points: waist.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: waist.length > 1 ? 'line' : 'dots', color: 'var(--chart-1)' }]}
              ariaLabel={L('Tour de taille', 'Waist')}
              height={150}
              refLine={state.goals.targetWaist ? { y: state.goals.targetWaist, label: L(`Cible ${fmtNum(state.goals.targetWaist)} cm`, `Target ${fmtNum(state.goals.targetWaist)} cm`) } : undefined}
            />
          </div>
        </Card>
      )}

      {weights.length > 0 && <Button variant="primary" size="lg" full className="mt-4" icon={<Plus size={18} aria-hidden />} onClick={() => setMeasure(true)}>{L('Ajouter des mesures', 'Add measurements')}</Button>}

      {state.bodyEntries.length > 0 && <Section art="measuring-tape" title={L('Mesures', 'Measurements')}>
        <MeasureList entries={state.bodyEntries} />
      </Section>}

      <Photos />
      <MeasureSheet open={measure} onClose={() => { setMeasure(false); if (openMeasure) navigate('progres/corps', { replace: true }) }} />
    </>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[12px] font-medium text-text-2">{label}</p>
      <p className="mt-1.5 text-[19px] leading-none font-semibold tracking-[-0.02em] tnum">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function MeasureList({ entries }: { entries: BodyEntry[] }) {
  const deleteBody = useStore((s) => s.deleteBody)
  const [pending, setPending] = useState<BodyEntry | null>(null)
  return (
    <><Card className="divide-y divide-line">
      {[...entries].reverse().slice(0, 30).map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-20 shrink-0 text-[13px] text-text-2">{fmtDate(b.date)}</span>
          <span className="min-w-0 flex-1 text-[14px] tnum">
            {[b.weight !== null && `${fmtNum(b.weight)} kg`, b.waist !== null && L(`tour de taille ${fmtNum(b.waist)} cm`, `waist ${fmtNum(b.waist)} cm`), b.arm !== null && L(`bras ${fmtNum(b.arm)} cm`, `arm ${fmtNum(b.arm)} cm`), b.chest !== null && L(`poitrine ${fmtNum(b.chest)} cm`, `chest ${fmtNum(b.chest)} cm`), b.shoulders !== null && L(`épaules ${fmtNum(b.shoulders)} cm`, `shoulders ${fmtNum(b.shoulders)} cm`)].filter(Boolean).join(' · ')}
          </span>
          <IconButton label={L(`Supprimer la mesure du ${fmtDate(b.date)}`, `Delete the measurement from ${fmtDate(b.date)}`)} onClick={() => setPending(b)}><Trash size={16} aria-hidden /></IconButton>
        </div>
      ))}
    </Card>
    <Sheet open={!!pending} onClose={() => setPending(null)} icon={<Trash size={18} aria-hidden />} title={L('Supprimer cette mesure ?', 'Delete this measurement?')} footer={<div className="grid grid-cols-2 gap-2">
      <Button full onClick={() => setPending(null)}>{L('Annuler', 'Cancel')}</Button>
      <Button full variant="danger" onClick={() => { if (pending) deleteBody(pending.id); setPending(null) }}>{L('Supprimer', 'Delete')}</Button>
    </div>}>
      <p className="text-[14px] leading-[1.5] text-text-2">{pending && L(`Les mesures du ${fmtDate(pending.date, { long: true, year: true })} seront retirées de ton suivi. Cette action ne peut pas être annulée.`, `The measurements from ${fmtDate(pending.date, { long: true, year: true })} will be removed from your progress. This action cannot be undone.`)}</p>
    </Sheet></>
  )
}

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saveBody = useStore((s) => s.saveBody)
  const [date, setDate] = useState(todayISO())
  const [v, setV] = useState({ weight: '', waist: '', arm: '', chest: '', shoulders: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  const invalid = (key: keyof typeof v) => v[key].trim() !== '' && (parseNumber(v[key]) === null || parseNumber(v[key])! <= 0)
  const valid = Object.values(v).some(x => parseNumber(x) !== null) && !(Object.keys(v) as (keyof typeof v)[]).some(invalid)
  const error = L('Saisis une valeur supérieure à zéro.', 'Enter a value greater than zero.')
  const save = () => {
    if (!valid) return
    saveBody({ date, weight: parseNumber(v.weight), waist: parseNumber(v.waist), arm: parseNumber(v.arm), chest: parseNumber(v.chest), shoulders: parseNumber(v.shoulders) })
    setV({ weight: '', waist: '', arm: '', chest: '', shoulders: '' })
    useStore.getState().notify(L('Mesures enregistrées.', 'Measurements saved.'), 'good')
    onClose()
  }
  return (
    <Sheet icon={<Ruler size={18} aria-hidden />} open={open} onClose={onClose} title={L('Ajouter des mesures', 'Add measurements')} footer={<Button variant="primary" size="lg" full disabled={!valid} onClick={save}>{L('Enregistrer', 'Save')}</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Date</p>
          <DateInput label={L('Date de la mesure', 'Measurement date')} value={date} max={todayISO()} onChange={(v) => v && setDate(v)} />
        </div>
        <Field label={L('Poids (kg)', 'Weight (kg)')} hint={L('À jeun, même balance', 'Fasted, same scale')} error={invalid('weight') ? error : undefined}><input data-autofocus className={inputClass} inputMode="decimal" value={v.weight} onChange={set('weight')} placeholder={L('93,0', '93.0')} /></Field>
        <Field label={L('Tour de taille (cm)', 'Waist (cm)')} hint={L('Au nombril', 'At the navel')} error={invalid('waist') ? error : undefined}><input className={inputClass} inputMode="decimal" value={v.waist} onChange={set('waist')} /></Field>
        <Field label={L('Bras (cm)', 'Arm (cm)')} error={invalid('arm') ? error : undefined}><input className={inputClass} inputMode="decimal" value={v.arm} onChange={set('arm')} /></Field>
        <Field label={L('Poitrine (cm)', 'Chest (cm)')} error={invalid('chest') ? error : undefined}><input className={inputClass} inputMode="decimal" value={v.chest} onChange={set('chest')} /></Field>
        <Field label={L('Épaules (cm)', 'Shoulders (cm)')} error={invalid('shoulders') ? error : undefined}><input className={inputClass} inputMode="decimal" value={v.shoulders} onChange={set('shoulders')} /></Field>
      </div>
    </Sheet>
  )
}

function Photos() {
  const all = useStore((s) => s.photos)
  const photos = all.filter((p) => p.id !== GOAL_PHOTO_ID)
  const hasGoal = all.length !== photos.length
  const { addPhoto, deletePhoto } = useStore.getState()
  const input = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [compare, setCompare] = useState(false)
  const current = photos.find((p) => p.id === view)
  const deleting = photos.find((p) => p.id === pendingDelete)
  const onFile = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const dataUrl = await imageToDataUrl(f)
      await addPhoto({ id: uid('photo'), date: todayISO(), dataUrl, name: f.name })
    }
  }
  return (
    <Section art="camera" title={L('Photos de progression', 'Progress photos')} action={photos.length > 1 || (photos.length > 0 && hasGoal) ? <Button size="sm" variant="soft" onClick={() => setCompare(true)}>{L('Comparer', 'Compare')}</Button> : undefined}>
      {photos.length > 0 ? <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setView(p.id)} className="pressable relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface-2">
            <img src={p.dataUrl} alt={L(`Photo du ${fmtDate(p.date)}`, `Photo from ${fmtDate(p.date)}`)} className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pt-6 pb-1.5 text-left text-[11px] font-semibold text-white">{fmtDate(p.date)}</span>
          </button>
        ))}
        <button type="button" onClick={() => input.current?.click()} className="pressable flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong text-[12px] font-semibold text-text-2 hover:border-muted">
          <Camera size={20} aria-hidden />
          {L('Ajouter', 'Add')}
        </button>
      </div> : <button type="button" onClick={() => input.current?.click()} className="pressable flex min-h-20 w-full items-center gap-4 rounded-[12px] border border-dashed border-line-strong p-4 text-left hover:border-muted">
        <Camera size={24} className="shrink-0 text-signal-text" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold">{L('Ajouter une première photo', 'Add your first photo')}</span>
          <span className="mt-1 block text-[13px] leading-[1.45] text-text-2">{L('Un repère visuel facultatif, conservé sur ton appareil.', 'An optional visual reference, saved on your device.')}</span>
        </span>
      </button>}
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFile(e.target.files); e.target.value = '' }} />
      <p className="mt-2 text-[12px] text-muted">{L('Toutes les 4 semaines, même lumière, même pose. Les photos restent sur cet appareil et sont incluses dans tes sauvegardes.', 'Every 4 weeks, same lighting, same pose. Photos stay on this device and are included in your backups.')}</p>
      <Sheet icon={<Camera size={18} aria-hidden />} open={!!current} onClose={() => setView(null)} title={current ? L(`Photo du ${fmtDate(current.date, { year: true })}`, `Photo from ${fmtDate(current.date, { year: true })}`) : ''} footer={current && <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => { setPendingDelete(current.id); setView(null) }}>{L('Supprimer', 'Delete')}</Button>}>
        {current && <img src={current.dataUrl} alt="" className="w-full rounded-[12px]" />}
      </Sheet>
      <Sheet icon={<Trash size={18} aria-hidden />} open={!!deleting} onClose={() => { setView(pendingDelete); setPendingDelete(null) }} title={L('Supprimer cette photo ?', 'Delete this photo?')} footer={<div className="grid grid-cols-2 gap-2">
        <Button full onClick={() => { setView(pendingDelete); setPendingDelete(null) }}>{L('Annuler', 'Cancel')}</Button>
        <Button full variant="danger" onClick={() => { if (pendingDelete) void deletePhoto(pendingDelete); setPendingDelete(null) }}>{L('Supprimer', 'Delete')}</Button>
      </div>}>
        <p className="text-[14px] leading-[1.5] text-text-2">{deleting && L(`La photo du ${fmtDate(deleting.date, { long: true, year: true })} sera retirée de ton suivi. Cette action ne peut pas être annulée.`, `The photo from ${fmtDate(deleting.date, { long: true, year: true })} will be removed from your progress. This action cannot be undone.`)}</p>
      </Sheet>
      {compare && <CompareSheet onClose={() => setCompare(false)} />}
    </Section>
  )
}

function CompareSheet({ onClose }: { onClose: () => void }) {
  const all = useStore((s) => s.photos)
  // Progress pictures first, the goal's reference picture last ("Objectif").
  const photos = [...all.filter((p) => p.id !== GOAL_PHOTO_ID), ...all.filter((p) => p.id === GOAL_PHOTO_ID)]
  const progress = photos.filter((p) => p.id !== GOAL_PHOTO_ID)
  const [a, setA] = useState(progress.length > 1 ? progress[0]?.id : progress[progress.length - 1]?.id)
  const [b, setB] = useState(photos[photos.length - 1]?.id)
  const [pos, setPos] = useState(50)
  const pa = photos.find((p) => p.id === a)
  const pb = photos.find((p) => p.id === b)
  return (
    <Sheet icon={<Columns2 size={18} aria-hidden />} open onClose={onClose} title={L('Comparer les photos', 'Compare photos')} tall>
      <div className="grid grid-cols-2 gap-2">
        {[[L('Photo de gauche', 'Left photo'), a, setA], [L('Photo de droite', 'Right photo'), b, setB]].map(([label, val, set]) => (
          <Field key={label as string} label={label as string}>
            <select className={inputClass} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
              {photos.map((p) => <option key={p.id} value={p.id}>{p.id === GOAL_PHOTO_ID ? L('Objectif', 'Goal') : fmtDate(p.date, { year: true })}</option>)}
            </select>
          </Field>
        ))}
      </div>
      {pa && pb && (
        <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-[12px] bg-surface-2">
          <img src={pb.dataUrl} alt={L(`Photo de droite, ${fmtDate(pb.date)}`, `Right photo, ${fmtDate(pb.date)}`)} className="absolute inset-0 h-full w-full object-cover" />
          <img src={pa.dataUrl} alt={L(`Photo de gauche, ${fmtDate(pa.date)}`, `Left photo, ${fmtDate(pa.date)}`)} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.2)]" style={{ left: `${pos}%` }} />
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label={L('Position du comparateur', 'Comparison slider position')} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
          <span className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{fmtDate(pa.date)}</span>
          <span className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{fmtDate(pb.date)}</span>
        </div>
      )}
    </Sheet>
  )
}

// ───────────────────────── Volume ─────────────────────────

function VolumeTab() {
  const state = useStore((s) => s.state)
  const today = todayISO()
  const monday = mondayOf(today)
  const [offset, setOffset] = useState(0)
  const weekStart = addDays(monday, -7 * offset)
  const vol = weekVolume(state.workouts, weekStart)
  const planned = plannedVolume(state.templates, trainingDays(state).length, state.prefs.keepWeeklyVolume !== false)
  const counts = weeklySessionCounts(state.workouts, 12, today)
  const recent = state.workouts.slice(-8)
  const rirs = recent.map((w) => ({ w, r: averageRir(w) })).filter((x) => x.r !== null)
  const logged = state.workouts.filter((workout) => workout.exercises.some((exercise) => !exercise.skipped && doneSets(exercise).length > 0))
  const latestDate = logged.reduce((date, workout) => workout.date > date ? workout.date : date, '')
  const latestOffset = latestDate ? Math.max(0, Math.floor(diffDays(mondayOf(latestDate), monday) / 7)) : 0
  const hasWeekVolume = Object.values(vol).some((sets) => sets > 0)
  if (!logged.length) return (
    <Empty art="plate" title={L('Aucune série à comptabiliser', 'No sets to count yet')} action={<SessionLink />}>
      {L('Tes séries enregistrées dans les séances terminées permettront de suivre le travail de chaque muscle et ton rythme d’entraînement.', 'Sets logged in completed workouts will show the work for each muscle and your training rhythm.')}
    </Empty>
  )
  return (
    <>
      <Section art="chart" title={L('Séries par muscle', 'Sets per muscle')} className="mt-0">
        {/* The week shown, with a step to the one before and the one after: one control, the week in its middle. */}
        <div className="mb-3 flex min-h-12 items-center rounded-[12px] border border-line-strong" role="group" aria-label={L('Semaine affichée', 'Week shown')}>
          <IconButton label={L('Semaine précédente', 'Previous week')} onClick={() => setOffset(offset + 1)}>
            <ChevronLeft size={20} aria-hidden />
          </IconButton>
          <p className="min-w-0 flex-1 py-1 text-center text-[14px] font-semibold tnum" aria-live="polite">
            {offset === 0 ? L('Cette semaine', 'This week') : offset === 1 ? L('Semaine dernière', 'Last week') : L(`Il y a ${offset} semaines`, `${offset} weeks ago`)}
            <span className="block text-[12px] font-normal text-text-2">{L('du', 'from')} {fmtDate(weekStart)}</span>
          </p>
          <IconButton label={L('Semaine suivante', 'Next week')} disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
            <ChevronRight size={20} aria-hidden />
          </IconButton>
        </div>
        {hasWeekVolume ? <><p className="mb-4 text-[13px] leading-[1.45] text-text-2">
          {L('Séries poussées près de l’échec, en comptage fractionnaire (directe = 1, indirecte = 0,5). Zone visée : 10–20 séries par semaine (Schoenfeld 2017 ; Pelland 2025). Le trait marque le volume prévu par le programme pour tes jours d’entraînement, en moyenne sur la rotation.', 'Sets taken close to failure, counted fractionally (direct = 1, indirect = 0.5). Target zone: 10–20 sets a week (Schoenfeld 2017; Pelland 2025). The mark shows the volume the program plans for your training days, averaged over the rotation.')}
        </p>
        <Card className="p-4">
          <RangeBars rows={MUSCLES.map((m) => ({ key: m.id, label: m.label, value: vol[m.id], planned: planned[m.id] }))} />
        </Card>
        </> : <Empty art="calendar" title={L('Aucune série cette semaine', 'No sets this week')}
          action={offset !== latestOffset
            ? <Button variant="outline" onClick={() => setOffset(latestOffset)}>{L('Voir la dernière semaine active', 'View the last active week')}</Button>
            : <Button variant="outline" onClick={() => navigate('progres/seances')}>{L('Voir l’historique', 'View history')}</Button>}
        >{L('Cette semaine ne contient pas de séries enregistrées. Tes autres séances restent dans l’historique.', 'There are no logged sets in this week. Your other workouts remain in your history.')}</Empty>}
      </Section>
      {counts.some((count) => count.count > 0) && <Section art="calendar" title={L('Séances par semaine', 'Workouts per week')}>
        <Card className="p-4">
          <Columns
            ariaLabel={L('Séances par semaine sur 12 semaines', 'Workouts per week over 12 weeks')}
            bars={counts.map((c) => ({ key: c.monday, label: fmtDate(c.monday).replace('.', ''), value: c.count, tooltip: <span>{L('Semaine du', 'Week of')} {fmtDate(c.monday)}{L(' : ', ': ')}{plural(c.count, L('séance', 'workout'), L('séances', 'workouts'))}</span> }))}
            target={{ value: trainingDays(state).length, label: `Plan ${trainingDays(state).length}` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card>
      </Section>}
      <Section icon={<Gauge size={18} aria-hidden />} title={L('Répétitions en réserve', 'Reps in reserve')}>
        {rirs.length ? (
          <Card className="divide-y divide-line">
            {rirs.map(({ w, r }) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[14px]">
                <span className="text-text-2">{fmtDate(w.date)} · {TYPE_META[w.type].label}</span>
                <span className="font-semibold tnum">{L(`${fmtNum(r!, 1)} en moyenne`, `${fmtNum(r!, 1)} average`)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <div className="flex items-start gap-3 py-2">
            <SportArt kind="plate" size="title" />
            <p className="min-w-0 text-[13px] leading-[1.5] text-text-2">{L('Renseigne les répétitions en réserve de tes séries pendant la séance, en suivant la consigne du jour.', 'Log each set’s reps in reserve during the workout, following today’s instruction.')}</p>
          </div>
        )}
      </Section>
    </>
  )
}

// ───────────────────────── Séances ─────────────────────────

function HistoryTab() {
  const state = useStore((s) => s.state)
  const groups = useMemo(() => groupByMonth(state), [state])
  if (!state.workouts.length) return <Empty art="logbook" title={L('Aucune séance terminée', 'No completed workouts yet')} action={<SessionLink />}>
    {state.activeWorkout
      ? L('Ta séance est en cours. Une fois terminée, tu retrouveras ici son détail et tes séries.', 'Your workout is in progress. Once you finish it, its details and sets will appear here.')
      : L('Tes séances terminées seront réunies ici, avec leurs exercices, tes séries et tes notes.', 'Your completed workouts will appear here with their exercises, sets and notes.')}
  </Empty>
  return (
    <>
      {groups.map(([month, list]) => (
        <Section key={month} art="calendar" title={capitalize(parseISO(`${month}-01`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }))} className="first:mt-0">
          <Card className="divide-y divide-line">
            {list.map((w) => {
              const minutes = sessionDurationMin(w)
              const sets = sessionSetCount(w)
              // A heavier load counts as progress; the headline is stored in the language of the session.
              const progress = w.exercises.filter((e) => e.comparison?.status === 'progress' || e.comparison?.headline === 'CHARGE SUPÉRIEURE' || e.comparison?.headline === 'HEAVIER LOAD').length
              const records = w.exercises.filter((e) => e.comparison?.isRecord).length
              return (
                <button key={w.id} type="button" onClick={() => navigate(`seance/${w.id}`)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[8px] bg-text text-[11px] font-bold text-bg">{TYPE_META[w.type].code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{TYPE_META[w.type].label} <span className="font-normal text-muted">· {L('n°', '#')}{w.sessionNumber}</span></span>
                    <span className="block text-[13px] text-text-2">{capitalize(fmtRelativeDay(w.date))} · {sets} {L('séries', sets === 1 ? 'set' : 'sets')}{minutes ? ` · ${minutes} min` : ''}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {records > 0 && <RecordTag />}
                    {progress > 0 && <Tag tone="good">{plural(progress, L('progrès', 'improvement'), L('progrès', 'improvements'))}</Tag>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                </button>
              )
            })}
          </Card>
        </Section>
      ))}
    </>
  )
}

function groupByMonth(state: AppState): [string, AppState['workouts']][] {
  const map = new Map<string, AppState['workouts']>()
  for (const w of [...state.workouts].reverse()) {
    const k = w.date.slice(0, 7)
    map.set(k, [...(map.get(k) ?? []), w])
  }
  return [...map.entries()]
}
