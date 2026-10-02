import { L, locale } from '../lib/i18n'
import { useMemo, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Plus, Trash } from 'lucide-react'
import { addDays, capitalize, dayNumber, fmtDate, fmtRelativeDay, mondayOf, parseISO, todayISO } from '../lib/date'
import { fmtNum, fmtSigned, parseNumber, plural, uid } from '../lib/format'
import { gymName, isGymBound } from '../lib/gyms'
import { infoFor, MUSCLES } from '../lib/library'
import { GOAL_DATE, MAINTENANCE, PERIODS, trainingDays, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { imageToDataUrl } from '../lib/share'
import {
  cutAdvice, goalWeightRange, measureSeries, movingAverage7, phaseRateLabel, plannedWeightPath, weightStatus,
} from '../lib/stats'
import { GOAL_PHOTO_ID, useStore } from '../lib/store'
import {
  averageRir, exerciseHistory, plannedVolume, sessionDurationMin, sessionSetCount, setsSummary, weekVolume, weeklySessionCounts,
} from '../lib/training'
import type { AppState, BodyEntry } from '../lib/types'
import { Columns, LineChart, RangeBars, Sparkline, type ChartSeries } from '../components/charts'
import { LevelTag, RefList } from '../components/Evidence'
import { DemoFrames, ExerciseSheet } from '../components/ExerciseSheet'
import { RecordTag, StatusTag } from '../components/Status'
import { Button, Card, cx, DateInput, Empty, Field, Header, IconButton, inputClass, Screen, Section, Segmented, Sheet, Tag } from '../components/ui'

type Tab = 'force' | 'corps' | 'volume' | 'seances'

export function ProgressScreen({ tab, sub }: { tab: Tab; sub?: string }) {
  return (
    <Screen>
      <Header title={L('Progrès', 'Progress')} eyebrow={L('Force · corps · volume', 'Strength · body · volume')} />
      <Segmented
        label={L('Vue', 'View')}
        value={tab}
        onChange={(t) => navigate(t === 'force' ? 'progres' : `progres/${t}`, { replace: true })}
        options={[
          { value: 'force', label: L('Force', 'Strength') },
          { value: 'corps', label: L('Corps', 'Body') },
          { value: 'volume', label: 'Volume' },
          { value: 'seances', label: L('Séances', 'Sessions') },
        ]}
      />
      <div className="mt-5">
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
  return (
    <>
      <p className="text-[13px] leading-[1.45] text-text-2">{L('1RM estimé (Epley) sur les répétitions propres de la meilleure série de chaque séance. Au poids du corps : meilleure série en répétitions.', 'Estimated 1RM (Epley) from the clean reps of the best set in each session. Bodyweight exercises: best set in reps.')}</p>
      <ExerciseList title={L('Programme actuel', 'Current program')} rows={active} />
      {archived.length > 0 && <ExerciseList title={L('Anciens exercices', 'Past exercises')} rows={archived} />}
    </>
  )
}

function ExerciseList({ title, rows }: { title: string; rows: { id: string; name: string; muscle: string; h: ReturnType<typeof exerciseHistory>; delta: number | null }[] }) {
  return (
    <Section title={title}>
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
  const info = infoFor(id, { name: tpl?.name ?? all[0]?.sets[0] ? undefined : id })
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
      <Header backTo="progres" eyebrow={info.muscle} title={tpl?.name ?? info.name} sub={h.length ? `${plural(h.length, L('séance', 'session'), L('séances', 'sessions'))} · ${first && last && first.best > 0 ? `${fmtSigned(((last.best - first.best) / first.best) * 100, 0, '%')} ${L('depuis le', 'since')} ${fmtDate(first.date)}` : ''}` : L('Pas encore réalisé.', 'Not done yet.')} />
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
            <p className="text-[13px] font-medium text-text-2">{L('Répétitions propres par séance', 'Clean reps per session')}</p>
            <div className="mt-3">
              <Columns
                ariaLabel={L('Répétitions propres par séance', 'Clean reps per session')}
                bars={h.map((x) => ({ key: x.workoutId, label: fmtDate(x.date).replace('.', ''), value: x.totalClean, tooltip: <span className="tnum">{fmtDate(x.date)} · {setsSummary(x.sets, x.unit)}</span> }))}
                height={140}
                format={(v) => fmtNum(v, 0)}
              />
            </div>
          </Card>
          <Section title={L('Historique', 'History')}>
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
        <Empty title={L('Aucune donnée', 'No data')} />
      )}
      <Section title={L('Technique et preuves', 'Technique and evidence')} action={<Button size="sm" variant="soft" onClick={() => setSheet(true)}>{L('Démo', 'Demo')}</Button>}>
        <DemoFrames id={id} name={info.name} />
        <div className="mt-4 flex items-center gap-2"><LevelTag level={info.evidence.level} /></div>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-2">{info.evidence.text}</p>
        <RefList refs={info.evidence.refs} compact />
      </Section>
      <ExerciseSheet exerciseId={id} name={tpl?.name} open={sheet} onClose={() => setSheet(false)} />
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
  const planStart = today < '2026-09-28' ? '2026-09-28' : today
  // Maintenance mode has no end date: the trajectory looks 12 weeks ahead.
  const chartEnd = MAINTENANCE ? addDays(today, 84) : GOAL_DATE
  const plan = ws.current ? plannedWeightPath(planStart, ws.current, MAINTENANCE ? { periods: PERIODS, goal: chartEnd } : undefined) : []
  const weightSeries: ChartSeries[] = [
    { id: 'raw', label: L('Pesées', 'Weigh-ins'), points: weights.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dots', color: 'var(--chart-2)' },
    { id: 'ma', label: L('Moyenne 7 jours', '7-day average'), points: ma.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'line', color: 'var(--chart-1)' },
    ...(plan.length ? [{ id: 'plan', label: L('Trajectoire du plan', 'Plan trajectory'), points: plan.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dashed' as const, color: 'var(--text-2)', endLabel: false }] : []),
  ]
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Figure label={ws.isAverage && !ws.stale ? L('Moyenne 7 j', '7-day avg') : L('Dernière pesée', 'Last weigh-in')} value={ws.current !== null ? `${fmtNum(ws.current)} kg` : '—'} />
        <Figure label={L('Tendance', 'Trend')} value={ws.weeklyChangePct !== null ? L(`${fmtSigned(ws.weeklyChangePct, 2)} %`, `${fmtSigned(ws.weeklyChangePct, 2)}%`) : '—'} hint={L('par semaine', 'per week')} />
        <Figure label={L('Cible', 'Target')} value={goal ? `${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)}` : '—'} hint={goal?.computed ? 'plan · kg' : 'kg'} />
      </div>
      <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
        {phaseRateLabel(today) ? <>{L('Rythme visé maintenant : ', 'Target pace now: ')}<span className="font-semibold text-text">{phaseRateLabel(today)}</span>.</> : <>{L('Dès le 28 sept. : ', 'From 28 Sep: ')}<span className="font-semibold text-text">{phaseRateLabel('2026-09-28')}</span>{L(' (recomposition), puis sèche à −0,5 à −0,7 %/sem.', ' (recomposition), then a cut at −0.5 to −0.7%/wk.')}</>} {advice ?? ''}
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

      <Button variant="primary" size="lg" full className="mt-4" icon={<Plus size={18} aria-hidden />} onClick={() => setMeasure(true)}>{L('Nouvelle mesure', 'New measurement')}</Button>

      <Section title={L('Mesures', 'Measurements')}>
        <MeasureList entries={state.bodyEntries} />
      </Section>

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
  if (!entries.length) return <Empty title={L('Aucune mesure', 'No measurements')} >{L('Pèse-toi chaque matin, à jeun ; tour de taille toutes les 2 semaines.', 'Weigh yourself every morning, fasted; measure your waist every 2 weeks.')}</Empty>
  return (
    <Card className="divide-y divide-line">
      {[...entries].reverse().slice(0, 30).map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-20 shrink-0 text-[13px] text-text-2">{fmtDate(b.date)}</span>
          <span className="min-w-0 flex-1 text-[14px] tnum">
            {[b.weight !== null && `${fmtNum(b.weight)} kg`, b.waist !== null && L(`taille ${fmtNum(b.waist)}`, `waist ${fmtNum(b.waist)}`), b.arm !== null && L(`bras ${fmtNum(b.arm)}`, `arm ${fmtNum(b.arm)}`), b.chest !== null && L(`poitrine ${fmtNum(b.chest)}`, `chest ${fmtNum(b.chest)}`), b.shoulders !== null && L(`épaules ${fmtNum(b.shoulders)}`, `shoulders ${fmtNum(b.shoulders)}`)].filter(Boolean).join(' · ')}
          </span>
          <button type="button" aria-label={L(`Supprimer la mesure du ${fmtDate(b.date)}`, `Delete the measurement from ${fmtDate(b.date)}`)} onClick={() => deleteBody(b.id)} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:bg-surface-2 hover:text-bad"><Trash size={15} /></button>
        </div>
      ))}
    </Card>
  )
}

function MeasureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const saveBody = useStore((s) => s.saveBody)
  const [date, setDate] = useState(todayISO())
  const [v, setV] = useState({ weight: '', waist: '', arm: '', chest: '', shoulders: '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  const save = () => {
    saveBody({ date, weight: parseNumber(v.weight), waist: parseNumber(v.waist), arm: parseNumber(v.arm), chest: parseNumber(v.chest), shoulders: parseNumber(v.shoulders) })
    setV({ weight: '', waist: '', arm: '', chest: '', shoulders: '' })
    useStore.getState().notify(L('Mesure enregistrée.', 'Measurement saved.'), 'good')
    onClose()
  }
  const any = Object.values(v).some((x) => parseNumber(x) !== null)
  return (
    <Sheet open={open} onClose={onClose} title={L('Nouvelle mesure', 'New measurement')} footer={<Button variant="primary" size="lg" full disabled={!any} onClick={save}>{L('Enregistrer', 'Save')}</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Date</p>
          <DateInput label={L('Date de la mesure', 'Measurement date')} value={date} max={todayISO()} onChange={(v) => v && setDate(v)} />
        </div>
        <Field label={L('Poids (kg)', 'Weight (kg)')} hint={L('À jeun, même balance', 'Fasted, same scale')}><input data-autofocus className={inputClass} inputMode="decimal" value={v.weight} onChange={set('weight')} placeholder={L('93,0', '93.0')} /></Field>
        <Field label={L('Tour de taille (cm)', 'Waist (cm)')} hint={L('Au nombril', 'At the navel')}><input className={inputClass} inputMode="decimal" value={v.waist} onChange={set('waist')} /></Field>
        <Field label={L('Bras (cm)', 'Arm (cm)')}><input className={inputClass} inputMode="decimal" value={v.arm} onChange={set('arm')} /></Field>
        <Field label={L('Poitrine (cm)', 'Chest (cm)')}><input className={inputClass} inputMode="decimal" value={v.chest} onChange={set('chest')} /></Field>
        <Field label={L('Épaules (cm)', 'Shoulders (cm)')}><input className={inputClass} inputMode="decimal" value={v.shoulders} onChange={set('shoulders')} /></Field>
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
  const [compare, setCompare] = useState(false)
  const current = photos.find((p) => p.id === view)
  const onFile = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      const dataUrl = await imageToDataUrl(f)
      await addPhoto({ id: uid('photo'), date: todayISO(), dataUrl, name: f.name })
    }
    useStore.getState().notify(L('Photo ajoutée. Elle reste sur ce téléphone.', 'Photo added. It stays on this phone.'), 'good')
  }
  return (
    <Section title="Photos" action={photos.length > 1 || (photos.length > 0 && hasGoal) ? <Button size="sm" variant="soft" onClick={() => setCompare(true)}>{L('Comparer', 'Compare')}</Button> : undefined}>
      <div className="grid grid-cols-3 gap-2">
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
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFile(e.target.files); e.target.value = '' }} />
      <p className="mt-2 text-[12px] text-muted">{L('Toutes les 4 semaines, même lumière, même pose. Les photos ne quittent pas ce téléphone (sauf dans tes sauvegardes).', 'Every 4 weeks, same lighting, same pose. Photos never leave this phone (except in your backups).')}</p>
      <Sheet open={!!current} onClose={() => setView(null)} title={current ? L(`Photo du ${fmtDate(current.date, { year: true })}`, `Photo from ${fmtDate(current.date, { year: true })}`) : ''} footer={current && <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => { void deletePhoto(current.id); setView(null) }}>{L('Supprimer', 'Delete')}</Button>}>
        {current && <img src={current.dataUrl} alt="" className="w-full rounded-[12px]" />}
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
    <Sheet open onClose={onClose} title={L('Avant / après', 'Before / after')} tall>
      <div className="grid grid-cols-2 gap-2">
        {[[L('Avant', 'Before'), a, setA], [L('Après', 'After'), b, setB]].map(([label, val, set]) => (
          <Field key={label as string} label={label as string}>
            <select className={inputClass} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
              {photos.map((p) => <option key={p.id} value={p.id}>{p.id === GOAL_PHOTO_ID ? L('Objectif', 'Goal') : fmtDate(p.date, { year: true })}</option>)}
            </select>
          </Field>
        ))}
      </div>
      {pa && pb && (
        <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-[12px] bg-surface-2">
          <img src={pb.dataUrl} alt={L(`Après, ${fmtDate(pb.date)}`, `After, ${fmtDate(pb.date)}`)} className="absolute inset-0 h-full w-full object-cover" />
          <img src={pa.dataUrl} alt={L(`Avant, ${fmtDate(pa.date)}`, `Before, ${fmtDate(pa.date)}`)} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
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
  return (
    <>
      <Section title={L('Séries difficiles par muscle', 'Hard sets per muscle')} className="mt-0" action={
        <div className="flex gap-1">
          <IconButton label={L('Semaine précédente', 'Previous week')} onClick={() => setOffset(offset + 1)}><ChevronLeft size={18} /></IconButton>
          <IconButton label={L('Semaine suivante', 'Next week')} disabled={offset === 0} onClick={() => setOffset(offset - 1)}><ChevronRight size={18} /></IconButton>
        </div>
      }>
        <p className="-mt-1 mb-4 text-[13px] leading-[1.45] text-text-2">
          {L('Semaine du', 'Week of')} {fmtDate(weekStart)} {L('· comptage fractionnaire (série directe = 1, indirecte = 0,5). Zone visée : 10–20 séries (Schoenfeld 2017 ; Pelland 2025). Le trait marque le volume prévu par le programme pour tes jours d’entraînement, en moyenne sur la rotation.', '· fractional counting (direct set = 1, indirect = 0.5). Target range: 10–20 sets (Schoenfeld 2017; Pelland 2025). The line marks the volume planned by the program for your training days, on average over the rotation.')}
        </p>
        <Card className="p-4">
          <RangeBars rows={MUSCLES.map((m) => ({ key: m.id, label: m.label, value: vol[m.id], planned: planned[m.id] }))} />
        </Card>
      </Section>
      <Section title={L('Séances par semaine', 'Sessions per week')}>
        <Card className="p-4">
          <Columns
            ariaLabel={L('Séances par semaine sur 12 semaines', 'Sessions per week over 12 weeks')}
            bars={counts.map((c) => ({ key: c.monday, label: fmtDate(c.monday).replace('.', ''), value: c.count, tooltip: <span>{L('Semaine du', 'Week of')} {fmtDate(c.monday)}{L(' : ', ': ')}{plural(c.count, L('séance', 'session'), L('séances', 'sessions'))}</span> }))}
            target={{ value: trainingDays(state).length, label: `Plan ${trainingDays(state).length}` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card>
      </Section>
      <Section title={L('Effort (RIR moyen)', 'Effort (average RIR)')}>
        {rirs.length ? (
          <Card className="divide-y divide-line">
            {rirs.map(({ w, r }) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5 text-[14px]">
                <span className="text-text-2">{fmtDate(w.date)} · {TYPE_META[w.type].label}</span>
                <span className="font-semibold tnum">RIR {fmtNum(r!, 1)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-[13px] text-text-2">{L('Renseigne le RIR de tes séries pendant la séance : la cible est 1–2 en polyarticulaire, 0–1 en isolation.', 'Log the RIR of your sets during the session: the target is 1–2 on compound lifts, 0–1 on isolation.')}</p>
        )}
      </Section>
    </>
  )
}

// ───────────────────────── Séances ─────────────────────────

function HistoryTab() {
  const state = useStore((s) => s.state)
  const groups = useMemo(() => groupByMonth(state), [state])
  if (!state.workouts.length) return <Empty title={L('Aucune séance', 'No sessions')} >{L('Ta première séance apparaîtra ici.', 'Your first session will show up here.')}</Empty>
  return (
    <>
      {groups.map(([month, list]) => (
        <Section key={month} title={capitalize(parseISO(`${month}-01`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }))} className="mt-2 first:mt-0">
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
