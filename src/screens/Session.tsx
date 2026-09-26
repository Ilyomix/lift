import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check, ChevronDown, CircleCheck, Ellipsis, Info, Link as LinkIcon, Play, Plus, Replace, Sparkles, StickyNote, Trash, X,
} from 'lucide-react'
import { unlockAudio } from '../lib/alerts'
import { sessionPrompt } from '../lib/coach'
import { capitalize, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtClock, fmtLoad, fmtNum, fmtRest, parseNumber, plural } from '../lib/format'
import { LIBRARY } from '../lib/library'
import { contextAt, GOAL_DATE, prescribe, projectSessions, PROGRAM_START, ROTATION, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { shareText } from '../lib/share'
import { useStore } from '../lib/store'
import { cleanOf, doneSets, previousPerformance, progressionFor, sessionDurationMin, sessionSetCount, setsSummary } from '../lib/training'
import type { SetFlag, Workout, WorkoutExercise, WorkoutType } from '../lib/types'
import { DemoFrames, ExerciseSheet } from '../components/ExerciseSheet'
import { RecordTag, StatusTag } from '../components/Status'
import {
  Button, Card, cx, Empty, Eyebrow, Header, IconButton, inputClass, ProgressBar, Screen, Section, Segmented, Sheet, Tag,
} from '../components/ui'

// ───────────────────────── Entry ─────────────────────────

export function SessionScreen() {
  const active = useStore((s) => !!s.state.activeWorkout)
  return active ? <ActiveSession /> : <SessionPreview />
}

// ───────────────────────── Preview ─────────────────────────

function SessionPreview() {
  const state = useStore((s) => s.state)
  const startSession = useStore((s) => s.startSession)
  const today = todayISO()
  const planned = useMemo(() => projectSessions(state, GOAL_DATE, today), [state, today])
  const [type, setType] = useState<WorkoutType>(planned[0]?.type ?? state.nextWorkoutType)
  const [sheet, setSheet] = useState<string | null>(null)
  const date = today < PROGRAM_START ? PROGRAM_START : today
  const ctx = contextAt(date)
  const tpl = state.templates[type]
  const rx = tpl.exercises.map((e) => prescribe(e, date, state.reentry))
  const totalSets = rx.reduce((a, p) => a + p.sets, 0)
  const isNext = type === (planned[0]?.type ?? state.nextWorkoutType)

  const begin = () => {
    unlockAudio()
    startSession(type)
    window.scrollTo({ top: 0 })
  }

  return (
    <Screen>
      <Header
        eyebrow={isNext ? `Prochaine séance · ${planned[0] ? fmtRelativeDay(planned[0].date, today) : ''}` : 'Autre séance'}
        title={TYPE_META[type].label}
        sub={`${TYPE_META[type].fr} · ${plural(tpl.exercises.length, 'exercice', 'exercices')} · ${totalSets} séries · ~${TYPE_META[type].minutes} min`}
      />
      <Segmented label="Type de séance" value={type} onChange={setType} options={ROTATION.map((t) => ({ value: t, label: TYPE_META[t].label }))} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Tag tone="ink">{ctx.before ? 'Bloc 1 · S1' : ctx.title}</Tag>
        <span className="text-[13px] text-text-2">{ctx.effortDetail}</span>
      </div>
      {state.reentry && <p className="mt-2 text-[13px] text-text-2">{state.reentry.label} : {state.reentry.advice}</p>}
      {!isNext && <p className="mt-2 text-[13px] text-muted">La rotation reprendra après cette séance : {TYPE_META[type].label} → {TYPE_META[ROTATION[(ROTATION.indexOf(type) + 1) % 5]].label}.</p>}

      <ol className="mt-5 divide-y divide-line rounded-[12px] border border-line bg-surface">
        {tpl.exercises.map((e, i) => (
          <li key={`${e.exerciseId}-${i}`}>
            <button type="button" onClick={() => setSheet(e.exerciseId)} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold text-muted tnum">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-5 font-medium">{e.name}</span>
                <span className="mt-0.5 block text-[13px] text-text-2 tnum">
                  {rx[i].sets} × {rx[i].minReps}–{rx[i].maxReps} · RIR {rx[i].rir} · {fmtLoad(rx[i].weight, e.unit)}
                </span>
                {e.supersetWithNext && <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-signal-text"><LinkIcon size={12} aria-hidden /> Superset avec l’exercice suivant</span>}
              </span>
              <Info size={18} className="shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-20 mt-6">
        <Button variant="primary" size="lg" full icon={<Play size={18} aria-hidden />} onClick={begin}>
          Commencer {TYPE_META[type].label}
        </Button>
      </div>

      {sheet && <ExerciseSheet exerciseId={sheet} open onClose={() => setSheet(null)} prescription={rx[tpl.exercises.findIndex((e) => e.exerciseId === sheet)]} />}
    </Screen>
  )
}

// ───────────────────────── Active session ─────────────────────────

function useElapsed(startedAt: string): number | null {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const s = (now - new Date(startedAt).getTime()) / 1000
  return s >= 0 && s < 5 * 3600 ? s : null
}

function ActiveSession() {
  const a = useStore((s) => s.state.activeWorkout)!
  const { finishSession, discardSession, setSessionField } = useStore.getState()
  const elapsed = useElapsed(a.startedAt)
  const [menu, setMenu] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const ctx = contextAt(a.date)
  const total = a.exercises.filter((e) => !e.skipped).reduce((n, e) => n + e.sets.length, 0)
  const done = a.exercises.reduce((n, e) => n + doneSets(e).length, 0)
  const pending = total - done

  const finish = () => {
    const id = finishSession()
    if (id) navigate('seance/bilan', { replace: true })
  }

  return (
    <Screen className="pb-[calc(150px+env(safe-area-inset-bottom))]">
      <Header
        eyebrow={`${ctx.before ? 'Fondation' : ctx.title} · ${fmtDate(a.date)}`}
        title={TYPE_META[a.type].label}
        right={
          <div className="flex items-center gap-1">
            {elapsed !== null && <span className="seg seg-ghost text-[18px] text-text-2 tnum" data-ghost={fmtClock(elapsed).replace(/\d/g, '8')} aria-label="Durée de la séance">{fmtClock(elapsed)}</span>}
            <IconButton label="Options de la séance" onClick={() => setMenu(true)}><Ellipsis size={20} /></IconButton>
          </div>
        }
      />
      <div className="flex items-center gap-3">
        <ProgressBar value={total ? done / total : 0} label="Séries validées" />
        <span className="shrink-0 text-[13px] font-semibold tnum">{done}/{total}</span>
      </div>
      {(a.deload || a.reentry) && (
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
          {a.deload ? 'Semaine de décharge : moitié des séries, charges −10 %, RIR 3–4.' : `${a.reentry!.label} : ${a.reentry!.advice}`}
        </p>
      )}

      <div className="mt-5 space-y-4">
        {a.exercises.map((ex, i) => (
          <ExerciseLogger key={`${ex.exerciseId}-${i}`} index={i} ex={ex} nextName={a.exercises[i + 1]?.name} />
        ))}
      </div>

      <Section title="Notes de séance">
        <textarea
          className={cx(inputClass, 'h-24 resize-none py-2.5')}
          placeholder="Sensations, sommeil, machine différente…"
          value={a.notes}
          onChange={(e) => setSessionField({ notes: e.target.value })}
        />
      </Section>

      <Button variant="primary" size="lg" full className="mt-6" icon={<CircleCheck size={18} aria-hidden />} onClick={() => (pending > 0 ? setConfirmFinish(true) : finish())}>
        Terminer la séance
      </Button>
      <p className="mt-2 text-center text-[12px] text-muted">{pending > 0 ? `${plural(pending, 'série restante', 'séries restantes')}` : 'Toutes les séries sont validées.'}</p>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Séance">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-text-2">Date de la séance</span>
          <input type="date" className={inputClass} value={a.date} max={todayISO()} onChange={(e) => e.target.value && setSessionField({ date: e.target.value })} />
        </label>
        <div className="mt-5">
          <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => { discardSession(); setMenu(false) }}>
            Abandonner la séance
          </Button>
          <p className="mt-2 text-[12px] text-muted">Les séries saisies seront perdues. La rotation ne change pas.</p>
        </div>
      </Sheet>

      <Sheet
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Terminer maintenant ?"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmFinish(false)}>Continuer</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => { setConfirmFinish(false); finish() }}>Terminer</Button>
          </div>
        }
      >
        <p className="text-[15px] leading-[1.5] text-text-2">
          {plural(pending, 'série n’est pas validée', 'séries ne sont pas validées')} : {pending > 1 ? 'elles seront ignorées' : 'elle sera ignorée'}. Les exercices sans série validée comptent comme non réalisés.
        </p>
      </Sheet>
    </Screen>
  )
}

// ───────────────────────── Exercise logger ─────────────────────────

function ExerciseLogger({ index, ex, nextName }: { index: number; ex: WorkoutExercise; nextName?: string }) {
  const workouts = useStore((s) => s.state.workouts)
  const { addSet, removeSet, skipExercise, replaceExercise, setExerciseField } = useStore.getState()
  const [info, setInfo] = useState(false)
  const [menu, setMenu] = useState(false)
  const prev = useMemo(() => previousPerformance(workouts, ex.exerciseId)?.exercise ?? null, [workouts, ex.exerciseId])
  const prevDate = useMemo(() => previousPerformance(workouts, ex.exerciseId)?.workout.date ?? null, [workouts, ex.exerciseId])
  const p = ex.prescription
  const target = p?.weight ?? ex.target.weight
  const prevSets = prev ? doneSets(prev) : []
  const sameLoad = prevSets.length > 0 && prevSets.every((s) => s.weight === target)
  const prevClean = prevSets.reduce((a, s) => a + cleanOf(s), 0)
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed)
  const validated = allDone ? progressionFor({ ...ex, sets: ex.sets }) : null
  const unitLabel = ex.unit === 'kg/main' ? 'kg/main' : ex.unit === 'PDC' ? 'Charge' : 'kg'

  if (ex.skipped) {
    return (
      <Card className="flex items-center gap-3 p-4 opacity-70">
        <span className="w-6 text-[12px] font-semibold text-muted tnum">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium line-through decoration-muted">{ex.name}</p>
          <p className="text-[12px] text-muted">Non réalisé{ex.skipReason ? ` · ${ex.skipReason}` : ''}</p>
        </div>
        <Button size="sm" variant="soft" onClick={() => skipExercise(index, false)}>Reprendre</Button>
      </Card>
    )
  }

  return (
    <Card as="article" className={cx('overflow-hidden', allDone && 'border-line-strong')}>
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="mt-[3px] w-6 shrink-0 text-[12px] font-semibold text-muted tnum">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-[1.25] font-semibold tracking-[-0.015em]">{ex.name}</h3>
          <p className="mt-0.5 text-[13px] text-text-2">{ex.muscle}{ex.replacement ? ` · remplace ${ex.replacement.fromName}` : ''}</p>
        </div>
        <IconButton label={`Démo et technique : ${ex.name}`} onClick={() => setInfo(true)} className="-mt-1.5 -mr-1"><Info size={19} /></IconButton>
        <IconButton label={`Options : ${ex.name}`} onClick={() => setMenu(true)} className="-mt-1.5 -mr-2"><Ellipsis size={19} /></IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pl-[52px]">
        <Tag tone="ink">{(p?.sets ?? ex.target.sets)} × {ex.target.minReps}–{ex.target.maxReps}</Tag>
        <Tag tone="outline">RIR {p?.rir ?? ex.target.rir ?? '—'}</Tag>
        <Tag tone="outline">{fmtRest(p?.restSeconds ?? ex.target.restSeconds)}</Tag>
        {ex.unit !== 'PDC' && <Tag tone="outline">{target !== null ? fmtLoad(target, ex.unit) : 'Charge à trouver'}</Tag>}
      </div>
      <div className="space-y-1 px-4 pt-2.5 pl-[52px] text-[13px] leading-[1.45]">
        {prevSets.length > 0 ? (
          <p className="text-text-2">
            <span className="text-muted">Dernière fois{prevDate ? ` · ${fmtDate(prevDate)}` : ''} :</span> <span className="font-medium text-text tnum">{setsSummary(prevSets, prev!.unit)}</span>
            {sameLoad && <span className="text-muted"> → à battre : <span className="font-semibold text-text">{prevClean + 1} reps propres</span></span>}
          </p>
        ) : (
          <p className="text-muted">{target === null && ex.unit !== 'PDC' ? `Séance d’essai : trouve une charge pour ${ex.target.minReps}–${ex.target.maxReps} reps à RIR 3.` : 'Première fois : établis ta référence.'}</p>
        )}
        {ex.note && <p className="text-muted">{ex.note}</p>}
        {ex.technique && <p className="flex gap-1.5 text-muted"><StickyNote size={13} className="mt-[3px] shrink-0" aria-hidden />{ex.technique}</p>}
        {p?.notes.filter((n) => !n.startsWith('Reprise') && !n.startsWith('Remise')).map((n) => <p key={n} className="text-muted">{n}</p>)}
      </div>

      <div className="mt-3 px-3 pb-3">
        <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,0.85fr)_60px_48px] gap-2 px-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          <span>Série</span>
          <span>{unitLabel}</span>
          <span>Reps</span>
          <span>RIR</span>
          <span className="sr-only">Valider</span>
        </div>
        <div className="space-y-1.5">
          {ex.sets.map((_, i) => (
            <SetRow key={i} exIndex={index} setIndex={i} ex={ex} prevReps={prevSets[i] ? cleanOf(prevSets[i]) : null} fallbackWeight={target} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button type="button" onClick={() => addSet(index)} className="pressable inline-flex h-10 items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
            <Plus size={16} aria-hidden /> Série
          </button>
          {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].completed && (
            <button type="button" onClick={() => removeSet(index, ex.sets.length - 1)} className="pressable inline-flex h-10 items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-text">
              <X size={15} aria-hidden /> Retirer
            </button>
          )}
        </div>
        {validated && (
          <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px]">
            <CircleCheck size={16} className="shrink-0 text-good" aria-hidden />
            <span><span className="font-semibold">Charge validée.</span> {validated.text}.</span>
          </div>
        )}
      </div>

      {ex.supersetWithNext && nextName && (
        <div className="flex items-center gap-2 border-t border-dashed border-line-strong bg-signal-soft px-4 py-2.5 text-[13px] font-medium">
          <LinkIcon size={14} className="text-signal-text" aria-hidden />
          Superset : enchaîne avec {nextName}, repos après.
        </div>
      )}

      <ExerciseSheet exerciseId={ex.exerciseId} name={ex.name} open={info} onClose={() => setInfo(false)} prescription={p} onReplace={(id) => replaceExercise(index, id)} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={ex.name}>
        <div className="space-y-5">
          {(LIBRARY[ex.exerciseId]?.alternatives.length ?? 0) > 0 && (
            <div>
              <Eyebrow>Remplacer par</Eyebrow>
              <div className="mt-2 flex flex-col gap-2">
                {LIBRARY[ex.exerciseId].alternatives.map((alt) => (
                  <Button key={alt} full variant="outline" className="justify-start" icon={<Replace size={16} aria-hidden />} onClick={() => { replaceExercise(index, alt); setMenu(false) }}>
                    {LIBRARY[alt]?.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-2">Conditions différentes (machine, tempo…)</span>
            <input className={inputClass} value={ex.comparisonContext ?? ''} placeholder="Ex. : autre machine, charge de départ différente" onChange={(e) => setExerciseField(index, { comparisonContext: e.target.value })} />
            <span className="mt-1 block text-[12px] text-muted">Évite une fausse comparaison avec la dernière séance.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-2">Note sur l’exercice</span>
            <textarea className={cx(inputClass, 'h-20 resize-none py-2.5')} value={ex.notes} onChange={(e) => setExerciseField(index, { notes: e.target.value })} />
          </label>
          <Button variant="danger" full onClick={() => { skipExercise(index, true, 'Passé'); setMenu(false) }}>Passer cet exercice</Button>
        </div>
      </Sheet>
    </Card>
  )
}

function NumField({ value, onCommit, placeholder, decimal, label, disabled }: { value: number | null; onCommit: (n: number | null) => void; placeholder?: string; decimal?: boolean; label: string; disabled?: boolean }) {
  const toText = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  const [text, setText] = useState(toText(value))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(toText(value))
  }, [value])
  return (
    <input
      aria-label={label}
      disabled={disabled}
      className="h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-2.5 text-center text-[17px] font-semibold text-text tnum placeholder:font-medium placeholder:text-muted/60 focus:border-signal focus:outline-none disabled:border-transparent disabled:bg-transparent disabled:text-text-2"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? undefined : '[0-9]*'}
      enterKeyHint="done"
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        focused.current = true
        e.currentTarget.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(toText(value))
      }}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseNumber(e.target.value)
        if (e.target.value.trim() === '') onCommit(null)
        else if (n !== null && n >= 0 && n < 1000) onCommit(n)
      }}
    />
  )
}

const FLAGS: { id: SetFlag; label: string }[] = [
  { id: 'failure', label: 'Échec' },
  { id: 'bad-technique', label: 'Technique' },
  { id: 'pain', label: 'Douleur' },
]

function SetRow({ exIndex, setIndex, ex, prevReps, fallbackWeight }: { exIndex: number; setIndex: number; ex: WorkoutExercise; prevReps: number | null; fallbackWeight: number | null }) {
  const s = ex.sets[setIndex]
  const { updateSet, completeSet, toggleFlag } = useStore.getState()
  const [open, setOpen] = useState(false)
  const done = s.completed
  const hasDetail = s.flags.length > 0 || (s.cleanReps !== null && s.reps !== null && s.cleanReps !== s.reps) || !!s.note
  return (
    <div className={cx('rounded-[12px] px-1 py-1 transition-colors', done && 'bg-surface-2')}>
      <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,0.85fr)_60px_48px] items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`Détails de la série ${setIndex + 1}`}
          className="pressable flex h-11 flex-col items-center justify-center rounded-[9px] text-[15px] font-semibold tnum hover:bg-surface-3"
        >
          {setIndex + 1}
          <ChevronDown size={11} className={cx('text-muted transition-transform', (open || hasDetail) && 'text-signal-text', open && 'rotate-180')} aria-hidden />
        </button>
        {ex.unit === 'PDC' ? (
          <span className="flex h-11 items-center justify-center rounded-[10px] text-[14px] font-semibold text-text-2">PDC</span>
        ) : (
          <NumField label={`Charge série ${setIndex + 1}`} decimal value={s.weight} placeholder={fallbackWeight !== null ? fmtNum(fallbackWeight) : '—'} onCommit={(n) => updateSet(exIndex, setIndex, { weight: n })} disabled={done} />
        )}
        <NumField
          label={`Répétitions série ${setIndex + 1}`}
          value={s.reps}
          placeholder={prevReps !== null ? String(prevReps) : `${ex.target.minReps}–${ex.target.maxReps}`}
          onCommit={(n) => updateSet(exIndex, setIndex, { reps: n === null ? null : Math.round(n) })}
          disabled={done}
        />
        <select
          aria-label={`RIR série ${setIndex + 1}`}
          value={s.rir ?? ''}
          onChange={(e) => updateSet(exIndex, setIndex, { rir: e.target.value === '' ? null : Number(e.target.value) })}
          className="h-11 w-full appearance-none rounded-[10px] border border-line-strong bg-surface text-center text-[16px] font-semibold text-text tnum focus:border-signal focus:outline-none"
        >
          <option value="">—</option>
          {[0, 1, 2, 3, 4].map((r) => <option key={r} value={r}>{r === 4 ? '4+' : r}</option>)}
        </select>
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `Annuler la série ${setIndex + 1}` : `Valider la série ${setIndex + 1}`}
          onClick={() => {
            unlockAudio()
            completeSet(exIndex, setIndex, { weight: fallbackWeight, reps: prevReps })
          }}
          className={cx('pressable flex h-11 w-12 items-center justify-center rounded-[10px] border', done ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2 hover:border-muted hover:text-text')}
        >
          <Check size={20} strokeWidth={done ? 3 : 2.2} aria-hidden />
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2.5 px-1 pb-1.5">
          <div className="flex flex-wrap gap-1.5">
            {FLAGS.map((f) => {
              const on = s.flags.includes(f.id)
              return (
                <button key={f.id} type="button" aria-pressed={on} onClick={() => toggleFlag(exIndex, setIndex, f.id)} className={cx('pressable h-9 rounded-full border px-3 text-[13px] font-semibold', on ? (f.id === 'pain' ? 'border-bad-mark bg-bad-mark/10 text-bad' : 'border-text bg-text text-bg') : 'border-line-strong text-text-2')}>
                  {f.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-text-2">Reps propres</span>
            <div className="flex items-center gap-1">
              <IconButton label="Une rep propre de moins" onClick={() => updateSet(exIndex, setIndex, { cleanReps: Math.max(0, (s.cleanReps ?? s.reps ?? 0) - 1) })} className="h-9 w-9"><span className="text-[18px]">−</span></IconButton>
              <span className="w-8 text-center text-[16px] font-semibold tnum">{s.cleanReps ?? s.reps ?? '—'}</span>
              <IconButton label="Une rep propre de plus" onClick={() => updateSet(exIndex, setIndex, { cleanReps: Math.min(s.reps ?? 99, (s.cleanReps ?? s.reps ?? 0) + 1) })} className="h-9 w-9"><span className="text-[18px]">+</span></IconButton>
            </div>
          </div>
          <input className={cx(inputClass, 'h-11')} placeholder="Note (ex. : dernière rep aidée)" value={s.note} onChange={(e) => updateSet(exIndex, setIndex, { note: e.target.value })} />
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Summary ─────────────────────────

export function SessionSummary() {
  const lastFinish = useStore((s) => s.lastFinish)
  const state = useStore((s) => s.state)
  const applyProgressions = useStore((s) => s.applyProgressions)
  const w = lastFinish?.workout ?? state.workouts.find((x) => x.id === state.lastCompletedWorkoutId) ?? null
  if (!w) {
    return (
      <Screen>
        <Header title="Bilan" backTo="" />
        <Empty title="Aucune séance terminée" />
      </Screen>
    )
  }
  const progressions = (lastFinish?.progressions ?? []).filter((p) => !lastFinish?.applied.includes(p.exerciseId))
  const applied = lastFinish?.applied ?? []
  const records = w.exercises.filter((e) => e.comparison?.isRecord)
  const minutes = sessionDurationMin(w)
  const volume = w.exercises.reduce((a, e) => a + (e.comparison?.volume ?? 0), 0)

  return (
    <Screen>
      <Header eyebrow={`Séance n°${w.sessionNumber} · ${capitalize(fmtDate(w.date, { weekday: true }))}`} title="Séance terminée" backTo="" />
      <div className="grid grid-cols-3 gap-2.5">
        <Figure label="Durée" value={minutes === null ? '—' : minutes < 1 ? '< 1 min' : `${minutes} min`} />
        <Figure label="Séries" value={String(sessionSetCount(w))} />
        <Figure label="Volume" value={`${fmtNum(volume / 1000, 1)} t`} />
      </div>

      {records.length > 0 && (
        <Section title="Records">
          <div className="flex flex-wrap gap-2">
            {records.map((e) => <span key={e.exerciseId} className="inline-flex items-center gap-2 text-[14px] font-medium"><RecordTag />{e.name}</span>)}
          </div>
        </Section>
      )}

      {(progressions.length > 0 || applied.length > 0) && (
        <Section title="Charges validées" action={progressions.length > 1 ? <Button size="sm" variant="ink" onClick={() => applyProgressions(progressions)}>Tout appliquer</Button> : undefined}>
          <p className="-mt-1 mb-3 text-[13px] text-text-2">Toutes les séries au haut de la fourchette : on augmente la charge (double progression).</p>
          <Card className="divide-y divide-line">
            {(lastFinish?.progressions ?? []).map((p) => {
              const done = applied.includes(p.exerciseId)
              return (
                <div key={p.exerciseId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{p.name}</p>
                    <p className="text-[13px] text-text-2">{p.text}</p>
                  </div>
                  {done ? <Tag tone="good" icon={<Check size={12} aria-hidden />}>Appliqué</Tag> : <Button size="sm" variant="primary" onClick={() => applyProgressions([p])}>Appliquer</Button>}
                </div>
              )
            })}
          </Card>
        </Section>
      )}

      {(lastFinish?.alerts.length ?? 0) > 0 && (
        <Section title="À surveiller">
          <Card className="space-y-2 p-4">
            {lastFinish!.alerts.map((a) => <p key={a} className="text-[14px] leading-[1.45]">{a}</p>)}
          </Card>
        </Section>
      )}

      <Section title="Exercices">
        <WorkoutExercises w={w} />
      </Section>

      <div className="mt-8 grid gap-2">
        <Button variant="primary" size="lg" full icon={<Sparkles size={18} aria-hidden />} onClick={() => void shareText(sessionPrompt(state, w), `Séance ${w.sessionNumber}`)}>
          Bilan pour Claude
        </Button>
        <Button variant="outline" size="lg" full onClick={() => navigate('')}>Retour à l’accueil</Button>
      </div>
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">Le bilan s’ouvre dans la feuille de partage : envoie-le à Claude, puis colle sa réponse dans Plus → Coach pour mettre tes cibles à jour.</p>
    </Screen>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-[12px] font-medium text-text-2">{label}</p>
      <p className="mt-1.5 text-[22px] leading-none font-semibold tracking-[-0.02em] tnum">{value}</p>
    </div>
  )
}

export function WorkoutExercises({ w }: { w: Workout }) {
  const [demo, setDemo] = useState<string | null>(null)
  return (
    <>
      <Card className="divide-y divide-line">
        {w.exercises.map((e, i) => (
          <div key={`${e.exerciseId}-${i}`} className={cx('px-4 py-3.5', e.skipped && 'opacity-60')}>
            <button type="button" onClick={() => setDemo(e.exerciseId)} className="block w-full text-left">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] leading-5 font-medium">{e.name}</span>
                <span className="shrink-0 text-[14px] font-semibold tnum">{e.skipped ? '—' : setsSummary(e.sets, e.unit)}</span>
              </span>
            </button>
            {!e.skipped && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusTag c={e.comparison} />
                {e.comparison?.isRecord && <RecordTag />}
                {e.comparison?.detail && <span className="text-[12px] text-muted">{e.comparison.detail}</span>}
              </div>
            )}
            {e.skipped && <p className="mt-1 text-[12px] text-muted">Non réalisé</p>}
            {e.notes && <p className="mt-1 text-[12px] text-muted">{e.notes}</p>}
          </div>
        ))}
      </Card>
      {demo && <ExerciseSheet exerciseId={demo} open onClose={() => setDemo(null)} />}
    </>
  )
}

export function WorkoutDetail({ id }: { id: string }) {
  const state = useStore((s) => s.state)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const [confirm, setConfirm] = useState(false)
  const w = state.workouts.find((x) => x.id === id)
  if (!w) {
    return (
      <Screen>
        <Header title="Séance" backTo="progres/seances" />
        <Empty title="Séance introuvable" />
      </Screen>
    )
  }
  const minutes = sessionDurationMin(w)
  const ctx = contextAt(w.date)
  return (
    <Screen>
      <Header eyebrow={`Séance n°${w.sessionNumber} · ${capitalize(fmtDate(w.date, { weekday: true, year: true }))}`} title={TYPE_META[w.type].label} backTo="progres/seances" sub={`${TYPE_META[w.type].fr} · ${sessionSetCount(w)} séries${minutes ? ` · ${minutes} min` : ''}${ctx.period ? ` · ${ctx.title}` : ''}`} />
      {w.notes && <Card className="mb-4 p-4 text-[14px] leading-[1.5] text-text-2">{w.notes}</Card>}
      <WorkoutExercises w={w} />
      <div className="mt-8 grid gap-2">
        <Button variant="ink" size="lg" full icon={<Sparkles size={18} aria-hidden />} onClick={() => void shareText(sessionPrompt(state, w), `Séance ${w.sessionNumber}`)}>Bilan pour Claude</Button>
        <Button variant="danger" size="lg" full icon={<Trash size={16} aria-hidden />} onClick={() => setConfirm(true)}>Supprimer la séance</Button>
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Supprimer cette séance ?"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirm(false)}>Annuler</Button>
            <Button variant="danger" size="lg" className="flex-1" onClick={() => { deleteWorkout(w.id); navigate('progres/seances', { replace: true }) }}>Supprimer</Button>
          </div>
        }
      >
        <p className="text-[15px] text-text-2">Elle disparaît de l’historique et des graphiques. Pense à exporter une sauvegarde avant.</p>
      </Sheet>
    </Screen>
  )
}

export { DemoFrames }
