import { useMemo, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Plus, Trash } from 'lucide-react'
import { addDays, capitalize, dayNumber, fmtDate, fmtRelativeDay, mondayOf, parseISO, todayISO } from '../lib/date'
import { fmtNum, fmtSigned, parseNumber, plural, uid } from '../lib/format'
import { gymName, isGymBound } from '../lib/gyms'
import { infoFor, MUSCLES } from '../lib/library'
import { GOAL_DATE, trainingDays, TYPE_META } from '../lib/program'
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
      <Header title="Progrès" eyebrow="Force · corps · volume" />
      <Segmented
        label="Vue"
        value={tab}
        onChange={(t) => navigate(t === 'force' ? 'progres' : `progres/${t}`, { replace: true })}
        options={[
          { value: 'force', label: 'Force' },
          { value: 'corps', label: 'Corps' },
          { value: 'volume', label: 'Volume' },
          { value: 'seances', label: 'Séances' },
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
      <p className="text-[13px] leading-[1.45] text-text-2">1RM estimé (Epley) sur les répétitions propres de la meilleure série de chaque séance. Au poids du corps : meilleure série en répétitions.</p>
      <ExerciseList title="Programme actuel" rows={active} />
      {archived.length > 0 && <ExerciseList title="Anciens exercices" rows={archived} />}
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
                <span className="mt-0.5 block truncate text-[13px] text-text-2 tnum">{last ? setsSummary(last.sets, last.unit) : 'Pas encore réalisé'}</span>
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
  const series: ChartSeries[] = [{ id: 'best', label: loaded ? '1RM estimé' : 'Meilleure série', points: h.map((x) => ({ x: dayNumber(x.date), y: x.best })), kind: 'line', color: 'var(--chart-1)' }]
  const first = h[0]
  const last = h[h.length - 1]
  return (
    <Screen>
      <Header backTo="progres" eyebrow={info.muscle} title={tpl?.name ?? info.name} sub={h.length ? `${plural(h.length, 'séance', 'séances')} · ${first && last && first.best > 0 ? `${fmtSigned(((last.best - first.best) / first.best) * 100, 0, '%')} depuis le ${fmtDate(first.date)}` : ''}` : 'Pas encore réalisé.'} />
      {gymsUsed.length > 1 && (
        <Segmented className="mb-4" label="Salle" value={gym} onChange={setGym} options={gymsUsed.map((g) => ({ value: g, label: gymName(state, g) }))} />
      )}
      {h.length > 0 ? (
        <>
          <Card className="p-4">
            <p className="text-[13px] font-medium text-text-2">{loaded ? '1RM estimé (kg)' : 'Meilleure série (reps)'}</p>
            <div className="mt-3">
              <LineChart series={series} ariaLabel={`Évolution de ${info.name}`} yFormat={(v) => fmtNum(v, loaded ? 0 : 0)} height={200} />
            </div>
          </Card>
          <Card className="mt-3 p-4">
            <p className="text-[13px] font-medium text-text-2">Répétitions propres par séance</p>
            <div className="mt-3">
              <Columns
                ariaLabel="Répétitions propres par séance"
                bars={h.map((x) => ({ key: x.workoutId, label: fmtDate(x.date).replace('.', ''), value: x.totalClean, tooltip: <span className="tnum">{fmtDate(x.date)} · {setsSummary(x.sets, x.unit)}</span> }))}
                height={140}
                format={(v) => fmtNum(v, 0)}
              />
            </div>
          </Card>
          <Section title="Historique">
            <Card className="divide-y divide-line">
              {[...h].reverse().map((x) => (
                <button key={x.workoutId} type="button" onClick={() => navigate(`seance/${x.workoutId}`)} className="pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block text-[14px] text-text-2">{fmtDate(x.date)} · n°{x.sessionNumber}</span>
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
        <Empty title="Aucune donnée" />
      )}
      <Section title="Technique et preuves" action={<Button size="sm" variant="soft" onClick={() => setSheet(true)}>Démo</Button>}>
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
  const plan = ws.current ? plannedWeightPath(planStart, ws.current) : []
  const weightSeries: ChartSeries[] = [
    { id: 'raw', label: 'Pesées', points: weights.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dots', color: 'var(--chart-2)' },
    { id: 'ma', label: 'Moyenne 7 jours', points: ma.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'line', color: 'var(--chart-1)' },
    ...(plan.length ? [{ id: 'plan', label: 'Trajectoire du plan', points: plan.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: 'dashed' as const, color: 'var(--text-2)', endLabel: false }] : []),
  ]
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Figure label={ws.isAverage ? 'Moyenne 7 j' : 'Dernière pesée'} value={ws.current !== null ? `${fmtNum(ws.current)} kg` : '—'} />
        <Figure label="Tendance" value={ws.weeklyChangePct !== null ? `${fmtSigned(ws.weeklyChangePct, 2)} %` : '—'} hint="par semaine" />
        <Figure label="Cible" value={goal ? `${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)}` : '—'} hint={goal?.computed ? 'plan · kg' : 'kg'} />
      </div>
      <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
        {phaseRateLabel(today) ? <>Rythme visé maintenant : <span className="font-semibold text-text">{phaseRateLabel(today)}</span>.</> : <>Dès le 28 sept. : <span className="font-semibold text-text">{phaseRateLabel('2026-09-28')}</span> (recomposition), puis sèche à −0,5 à −0,7 %/sem.</>} {advice ?? ''}
      </p>

      <Card className="mt-4 p-4">
        <p className="text-[13px] font-medium text-text-2">Poids (kg)</p>
        <div className="mt-3">
          <LineChart
            series={weightSeries}
            ariaLabel="Poids, moyenne sur 7 jours et trajectoire du plan"
            height={220}
            band={goal ? { y0: goal.min, y1: goal.max, label: `Cible ${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)} kg` } : undefined}
            xDomain={weights.length ? [dayNumber(weights[0].date), dayNumber(GOAL_DATE)] : undefined}
          />
        </div>
      </Card>

      {waist.length > 0 && (
        <Card className="mt-3 p-4">
          <p className="text-[13px] font-medium text-text-2">Tour de taille (cm)</p>
          <div className="mt-3">
            <LineChart
              series={[{ id: 'waist', label: 'Tour de taille', points: waist.map((p) => ({ x: dayNumber(p.date), y: p.value })), kind: waist.length > 1 ? 'line' : 'dots', color: 'var(--chart-1)' }]}
              ariaLabel="Tour de taille"
              height={150}
              refLine={state.goals.targetWaist ? { y: state.goals.targetWaist, label: `Cible ${fmtNum(state.goals.targetWaist)} cm` } : undefined}
            />
          </div>
        </Card>
      )}

      <Button variant="primary" size="lg" full className="mt-4" icon={<Plus size={18} aria-hidden />} onClick={() => setMeasure(true)}>Nouvelle mesure</Button>

      <Section title="Mesures">
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
  if (!entries.length) return <Empty title="Aucune mesure" >Pèse-toi chaque matin, à jeun ; tour de taille toutes les 2 semaines.</Empty>
  return (
    <Card className="divide-y divide-line">
      {[...entries].reverse().slice(0, 30).map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-20 shrink-0 text-[13px] text-text-2">{fmtDate(b.date)}</span>
          <span className="min-w-0 flex-1 text-[14px] tnum">
            {[b.weight !== null && `${fmtNum(b.weight)} kg`, b.waist !== null && `taille ${fmtNum(b.waist)}`, b.arm !== null && `bras ${fmtNum(b.arm)}`, b.chest !== null && `poitrine ${fmtNum(b.chest)}`, b.shoulders !== null && `épaules ${fmtNum(b.shoulders)}`].filter(Boolean).join(' · ')}
          </span>
          <button type="button" aria-label={`Supprimer la mesure du ${fmtDate(b.date)}`} onClick={() => deleteBody(b.id)} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:bg-surface-2 hover:text-bad"><Trash size={15} /></button>
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
    useStore.getState().notify('Mesure enregistrée.', 'good')
    onClose()
  }
  const any = Object.values(v).some((x) => parseNumber(x) !== null)
  return (
    <Sheet open={open} onClose={onClose} title="Nouvelle mesure" footer={<Button variant="primary" size="lg" full disabled={!any} onClick={save}>Enregistrer</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Date</p>
          <DateInput label="Date de la mesure" value={date} max={todayISO()} onChange={(v) => v && setDate(v)} />
        </div>
        <Field label="Poids (kg)" hint="À jeun, même balance"><input data-autofocus className={inputClass} inputMode="decimal" value={v.weight} onChange={set('weight')} placeholder="93,0" /></Field>
        <Field label="Tour de taille (cm)" hint="Au nombril"><input className={inputClass} inputMode="decimal" value={v.waist} onChange={set('waist')} /></Field>
        <Field label="Bras (cm)"><input className={inputClass} inputMode="decimal" value={v.arm} onChange={set('arm')} /></Field>
        <Field label="Poitrine (cm)"><input className={inputClass} inputMode="decimal" value={v.chest} onChange={set('chest')} /></Field>
        <Field label="Épaules (cm)"><input className={inputClass} inputMode="decimal" value={v.shoulders} onChange={set('shoulders')} /></Field>
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
    useStore.getState().notify('Photo ajoutée. Elle reste sur ce téléphone.', 'good')
  }
  return (
    <Section title="Photos" action={photos.length > 1 || (photos.length > 0 && hasGoal) ? <Button size="sm" variant="soft" onClick={() => setCompare(true)}>Comparer</Button> : undefined}>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => setView(p.id)} className="pressable relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface-2">
            <img src={p.dataUrl} alt={`Photo du ${fmtDate(p.date)}`} className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pt-6 pb-1.5 text-left text-[11px] font-semibold text-white">{fmtDate(p.date)}</span>
          </button>
        ))}
        <button type="button" onClick={() => input.current?.click()} className="pressable flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong text-[12px] font-semibold text-text-2 hover:border-muted">
          <Camera size={20} aria-hidden />
          Ajouter
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onFile(e.target.files); e.target.value = '' }} />
      <p className="mt-2 text-[12px] text-muted">Toutes les 4 semaines, même lumière, même pose. Les photos ne quittent pas ce téléphone (sauf dans tes sauvegardes).</p>
      <Sheet open={!!current} onClose={() => setView(null)} title={current ? `Photo du ${fmtDate(current.date, { year: true })}` : ''} footer={current && <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => { void deletePhoto(current.id); setView(null) }}>Supprimer</Button>}>
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
    <Sheet open onClose={onClose} title="Avant / après" tall>
      <div className="grid grid-cols-2 gap-2">
        {[['Avant', a, setA], ['Après', b, setB]].map(([label, val, set]) => (
          <Field key={label as string} label={label as string}>
            <select className={inputClass} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
              {photos.map((p) => <option key={p.id} value={p.id}>{p.id === GOAL_PHOTO_ID ? 'Objectif' : fmtDate(p.date, { year: true })}</option>)}
            </select>
          </Field>
        ))}
      </div>
      {pa && pb && (
        <div className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-[12px] bg-surface-2">
          <img src={pb.dataUrl} alt={`Après, ${fmtDate(pb.date)}`} className="absolute inset-0 h-full w-full object-cover" />
          <img src={pa.dataUrl} alt={`Avant, ${fmtDate(pa.date)}`} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.2)]" style={{ left: `${pos}%` }} />
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Position du comparateur" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
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
  const planned = plannedVolume(state.templates)
  const counts = weeklySessionCounts(state.workouts, 12, today)
  const recent = state.workouts.slice(-8)
  const rirs = recent.map((w) => ({ w, r: averageRir(w) })).filter((x) => x.r !== null)
  return (
    <>
      <Section title="Séries difficiles par muscle" className="mt-0" action={
        <div className="flex gap-1">
          <IconButton label="Semaine précédente" onClick={() => setOffset(offset + 1)}><ChevronLeft size={18} /></IconButton>
          <IconButton label="Semaine suivante" disabled={offset === 0} onClick={() => setOffset(offset - 1)}><ChevronRight size={18} /></IconButton>
        </div>
      }>
        <p className="-mt-1 mb-4 text-[13px] leading-[1.45] text-text-2">
          Semaine du {fmtDate(weekStart)} · comptage fractionnaire (série directe = 1, indirecte = 0,5). Zone visée : 10–20 séries (Schoenfeld 2017 ; Pelland 2025). Le trait marque le volume prévu par le programme.
        </p>
        <Card className="p-4">
          <RangeBars rows={MUSCLES.map((m) => ({ key: m.id, label: m.label, value: vol[m.id], planned: planned[m.id] }))} />
        </Card>
      </Section>
      <Section title="Séances par semaine">
        <Card className="p-4">
          <Columns
            ariaLabel="Séances par semaine sur 12 semaines"
            bars={counts.map((c) => ({ key: c.monday, label: fmtDate(c.monday).replace('.', ''), value: c.count, tooltip: <span>Semaine du {fmtDate(c.monday)} : {plural(c.count, 'séance', 'séances')}</span> }))}
            target={{ value: trainingDays(state).length, label: `Plan ${trainingDays(state).length}` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card>
      </Section>
      <Section title="Effort (RIR moyen)">
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
          <p className="text-[13px] text-text-2">Renseigne le RIR de tes séries pendant la séance : la cible est 1–2 en polyarticulaire, 0–1 en isolation.</p>
        )}
      </Section>
    </>
  )
}

// ───────────────────────── Séances ─────────────────────────

function HistoryTab() {
  const state = useStore((s) => s.state)
  const groups = useMemo(() => groupByMonth(state), [state])
  if (!state.workouts.length) return <Empty title="Aucune séance" >Ta première séance apparaîtra ici.</Empty>
  return (
    <>
      {groups.map(([month, list]) => (
        <Section key={month} title={capitalize(parseISO(`${month}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))} className="mt-2 first:mt-0">
          <Card className="divide-y divide-line">
            {list.map((w) => {
              const minutes = sessionDurationMin(w)
              const progress = w.exercises.filter((e) => e.comparison?.status === 'progress' || e.comparison?.headline === 'CHARGE SUPÉRIEURE').length
              const records = w.exercises.filter((e) => e.comparison?.isRecord).length
              return (
                <button key={w.id} type="button" onClick={() => navigate(`seance/${w.id}`)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[8px] bg-text text-[11px] font-bold text-bg">{TYPE_META[w.type].code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium">{TYPE_META[w.type].label} <span className="font-normal text-muted">· n°{w.sessionNumber}</span></span>
                    <span className="block text-[13px] text-text-2">{capitalize(fmtRelativeDay(w.date))} · {sessionSetCount(w)} séries{minutes ? ` · ${minutes} min` : ''}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {records > 0 && <RecordTag />}
                    {progress > 0 && <Tag tone="good">{plural(progress, 'progrès', 'progrès')}</Tag>}
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
