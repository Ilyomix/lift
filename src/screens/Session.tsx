import { EffortGuidance, EffortReport } from '../components/EffortGuidance'
import { effortTarget, prescribedSets, recordedRir } from '../lib/effort'
import { exerciseContextReason } from '../lib/comparability'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, ChevronDown, CircleCheck, Ellipsis, Info, Link as LinkIcon, MapPin, Pencil, Play, Plus, StickyNote, Timer, Trash, TriangleAlert, Undo2, X,
} from 'lucide-react'
import { unlockAudio } from '../lib/alerts'
import { capitalize, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { bodyweightLabel, fmtClock, fmtLoad, fmtNum, fmtRest, parseNumber, plural } from '../lib/format'
import { gymName, gymOf, HOME_GYM, isGymBound, placeName } from '../lib/gyms'
import { L, lang } from '../lib/i18n'
import { LIBRARY } from '../lib/library'
import { localizeGymName } from '../lib/localize'
import { contextAt, daysFactor, GOAL_DATE, prescribeSession, projectSessions, PROGRAM_START, ROTATION, sessionMinutes, takesLest, templateSets, TYPE_META, WEEK_DAYS, weekShape } from '../lib/program'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import {
  changeLabel, changesOf, changeState, cleanOf, doneSets, heldByEffort, knownLoads, lastFinished, loadDecision, PLATEAU_SESSIONS, previousPerformance, progressionFor, sessionDurationMin, sessionEffort, sessionPace,
  sessionNotes, sessionSetCount, setsSummary, toppedOut, type AutoChange,
} from '../lib/training'
import type { SetFlag, Unit, Workout, WorkoutExercise, WorkoutType } from '../lib/types'
import { DemoFrames, ExerciseSheet } from '../components/ExerciseSheet'
import { ExerciseAlternatives } from '../components/ExerciseAlternatives'
import { GymSheet } from '../components/GymSheet'
import { workoutArt } from '../components/SportArt'
import { RecordTag, StatusTag } from '../components/Status'
import {
  Button, Card, cx, DateInput, Empty, Header, IconButton, inputClass, ProgressBar, Screen, Section, Segmented, Sheet, Tag,
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
  const [gymOpen, setGymOpen] = useState(false)
  const date = today < PROGRAM_START ? PROGRAM_START : today
  const ctx = contextAt(date)
  const tpl = state.templates[type]
  const rx = prescribeSession(tpl.exercises, date, state.reentry, state.gymId, state.workouts)
  const totalSets = rx.reduce((a, p) => a + p.sets, 0)
  const sheetSets = tpl.exercises.reduce((a, e) => a + e.target.sets, 0)
  // The reason is given when it is the case: with two days, or sheets the ceiling cuts into, the week holds clearly less than the plan.
  const keepsWeek = weekShape(templateSets(state.templates)).share >= 0.95
  // The lifter's own pace once five sessions are known, the report's lengths until then.
  const minutes = sessionMinutes(type, totalSets, sessionPace(state.workouts, type))
  const isNext = type === (planned[0]?.type ?? state.nextWorkoutType)

  const begin = () => {
    unlockAudio()
    startSession(type)
    window.scrollTo({ top: 0 })
  }

  return (
    <Screen>
      <Header
        eyebrow={isNext ? `${L('Prochaine séance', 'Next session')} · ${planned[0] ? fmtRelativeDay(planned[0].date, today) : ''}` : L('Autre séance', 'Other session')}
        art={workoutArt[type]}
        title={TYPE_META[type].label}
        sub={`${TYPE_META[type].fr} · ${plural(tpl.exercises.length, L('exercice', 'exercise'), L('exercices', 'exercises'))} · ${L(`${totalSets} séries`, plural(totalSets, 'set', 'sets'))} · ~${minutes} min`}
        right={<GymChip id={state.gymId} onClick={() => setGymOpen(true)} />}
      />
      <Segmented label={L('Type de séance', 'Session type')} value={type} onChange={setType} options={ROTATION.map((t) => ({ value: t, label: TYPE_META[t].label }))} />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Tag tone="ink">{ctx.before ? L('Bloc 1 · S1', 'Block 1 · W1') : ctx.title}</Tag>
        <span className="text-[13px] text-text-2">{ctx.effortDetail}</span>
      </div>
      {state.reentry && <p className="mt-2 text-[13px] text-text-2">{L(`${state.reentry.label} : ${state.reentry.advice}`, `${state.reentry.label}: ${state.reentry.advice}`)}</p>}
      {daysFactor() > 1 && totalSets > sheetSets && (
        <p className="mt-2 text-[13px] leading-[1.45] text-text-2">
          {L(
            `${plural(WEEK_DAYS, 'séance', 'séances')} par semaine : la séance prend plus de séries que la fiche${keepsWeek ? ', pour garder le volume de la semaine' : ''}.`,
            `${plural(WEEK_DAYS, 'session', 'sessions')} a week: the session takes more sets than the sheet${keepsWeek ? ', to keep the weekly volume' : ''}.`,
          )}
        </p>
      )}
      {!isNext && <p className="mt-2 text-[13px] text-muted">{L(`La rotation reprendra après cette séance : ${TYPE_META[type].label} → ${TYPE_META[ROTATION[(ROTATION.indexOf(type) + 1) % 5]].label}.`, `The rotation resumes after this session: ${TYPE_META[type].label} → ${TYPE_META[ROTATION[(ROTATION.indexOf(type) + 1) % 5]].label}.`)}</p>}

      <ol className="mt-5 divide-y divide-line rounded-[12px] border border-line bg-surface">
        {tpl.exercises.map((e, i) => (
          <li key={`${e.exerciseId}-${i}`}>
            <button type="button" onClick={() => setSheet(e.exerciseId)} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
              <span className="w-6 shrink-0 text-[12px] font-semibold text-muted tnum">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-5 font-medium">{e.name}</span>
                <span className="mt-0.5 block text-[13px] text-text-2 tnum">
                  {rx[i].sets} × {rx[i].minReps}–{rx[i].maxReps} · RIR {rx[i].rir} · {rx[i].weight === null && e.unit !== 'PDC' ? (isGymBound(e) && state.gymId !== HOME_GYM ? L('première fois ici', 'first time here') : L('charge à trouver', 'find your load')) : fmtLoad(rx[i].weight, e.unit)}
                </span>
                {e.supersetWithNext && <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-signal-text"><LinkIcon size={12} aria-hidden /> {L('Superset avec l’exercice suivant', 'Superset with the next exercise')}</span>}
              </span>
              <Info size={18} className="shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-20 mt-6">
        <Button variant="primary" size="lg" full icon={<Play size={18} aria-hidden />} onClick={begin}>
          {L('Commencer', 'Start')} {TYPE_META[type].label}
        </Button>
      </div>

      {sheet && <ExerciseSheet exerciseId={sheet} open onClose={() => setSheet(null)} prescription={rx[tpl.exercises.findIndex((e) => e.exerciseId === sheet)]} />}
      {gymOpen && <GymSheet onClose={() => setGymOpen(false)} />}
    </Screen>
  )
}

function GymChip({ id, onClick }: { id: string | undefined; onClick: () => void }) {
  const name = useStore((s) => placeName(s.state, id))
  return (
    <button type="button" onClick={onClick} className="pressable inline-flex h-9 max-w-[180px] items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-semibold text-text-2 hover:text-text" aria-label={L(`Lieu : ${name}, changer`, `Place: ${name}, change`)}>
      <MapPin size={14} className="shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
    </button>
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

/** The exercise to work on: the first one, in order, with a set left to do. */
function currentIndexOf(exercises: WorkoutExercise[]): number {
  return exercises.findIndex((e) => !e.skipped && e.sets.some((s) => !s.completed))
}

function ActiveSession() {
  const a = useStore((s) => s.state.activeWorkout)!
  const { finishSession, discardSession, setSessionField } = useStore.getState()
  // No clock on a finished session reopened to be corrected: nothing is being timed.
  const running = useElapsed(a.startedAt)
  const elapsed = a.reopened ? null : running
  const [menu, setMenu] = useState(false)
  const [gymOpen, setGymOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const ctx = contextAt(a.date)
  const total = a.exercises.filter((e) => !e.skipped).reduce((n, e) => n + e.sets.length, 0)
  const done = a.exercises.reduce((n, e) => n + doneSets(e).length, 0)
  const pending = total - done
  const current = currentIndexOf(a.exercises)
  const cur = current >= 0 ? a.exercises[current] : null
  const curSet = cur ? cur.sets.findIndex((s) => !s.completed) : -1

  // When an exercise is finished, bring the next one into view.
  const prev = useRef(current)
  useEffect(() => {
    if (current > prev.current && current >= 0) {
      const el = document.getElementById(`exercise-${current}`)
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
    prev.current = current
  }, [current])

  const finish = () => {
    const id = finishSession()
    if (id) navigate('seance/bilan', { replace: true })
  }
  const jump = () => document.getElementById(`exercise-${current}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <Screen className="pb-[calc(170px+env(safe-area-inset-bottom))]">
      <Header
        eyebrow={`${ctx.title} · ${fmtDate(a.date)}`}
        art={workoutArt[a.type]}
        title={TYPE_META[a.type].label}
        right={
          <div className="flex items-center gap-1">
            <GymChip id={a.gymId} onClick={() => setGymOpen(true)} />
            <IconButton label={L('Options de la séance', 'Session options')} onClick={() => setMenu(true)}><Ellipsis size={20} /></IconButton>
          </div>
        }
      />

      {/* Focus bar: stays on top while scrolling, opaque (nothing blurs under it). */}
      <div className="sticky top-[var(--top-bar)] z-30 -mx-4 border-b border-line bg-bg px-4 pt-2 pb-3">
        <button type="button" onClick={jump} disabled={!cur} className="flex w-full items-center gap-3 text-left" aria-label={cur ? L(`Exercice en cours : ${cur.name}, série ${curSet + 1} sur ${cur.sets.length}`, `Current exercise: ${cur.name}, set ${curSet + 1} of ${cur.sets.length}`) : L('Toutes les séries sont faites', 'All sets done')}>
          <span className="min-w-0 flex-1">
            {/* The set and the session clock share the first line; the exercise name has the whole width under them. */}
            <span className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-signal-text uppercase">{cur ? L(`Série ${curSet + 1}/${cur.sets.length}`, `Set ${curSet + 1}/${cur.sets.length}`) : L('Terminé', 'Done')}</span>
              {elapsed !== null && (
                <span className="inline-flex shrink-0 items-center gap-1.5" aria-label={L('Durée de la séance', 'Session duration')}>
                  <Timer size={14} className="text-muted" aria-hidden />
                  <span className="seg seg-ghost text-[15px] leading-none text-text tnum" data-ghost={fmtClock(elapsed).replace(/\d/g, '8')} aria-hidden>{fmtClock(elapsed)}</span>
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[15px] leading-5 font-semibold">{cur ? cur.name : L('Toutes les séries sont faites', 'All sets done')}</span>
          </span>
        </button>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar value={total ? done / total : 0} label={L('Séries validées', 'Sets logged')} />
          <span className="shrink-0 text-[12px] font-semibold text-text-2 tnum">{done}/{total}</span>
        </div>
      </div>

      {a.reopened && (
        <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
          <Pencil size={14} className="mt-0.5 shrink-0 text-signal-text" aria-hidden />
          {L('Correction d’une séance terminée : ouvre un exercice, corrige ses séries, puis termine. Les comparaisons et les charges sont recalculées.', 'Correcting a finished session: open an exercise, fix its sets, then finish. Comparisons and loads are worked out again.')}
        </p>
      )}

      {(a.deload || a.reentry) && (
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
          {a.deload ? L('Semaine de décharge : moitié des séries, charges −10 %, RIR 3–4.', 'Deload week: half the sets, loads −10%, RIR 3–4.') : L(`${a.reentry!.label} : ${a.reentry!.advice}`, `${a.reentry!.label}: ${a.reentry!.advice}`)}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {a.exercises.map((ex, i) => (
          <ExerciseLogger key={`${ex.exerciseId}-${i}`} index={i} ex={ex} nextName={a.exercises[i + 1]?.name} current={i === current} gymId={gymOf(a)} />
        ))}
      </div>

      <Section title={L('Notes de séance', 'Session notes')}>
        <textarea
          className={cx(inputClass, 'h-24 resize-none py-2.5')}
          placeholder={L('Sensations, sommeil, machine différente…', 'How you felt, sleep, different machine…')}
          value={a.notes}
          onChange={(e) => setSessionField({ notes: e.target.value })}
        />
      </Section>

      <Button variant="primary" size="lg" full className="mt-6" icon={<CircleCheck size={18} aria-hidden />} onClick={() => (pending > 0 ? setConfirmFinish(true) : finish())}>
        {L('Terminer la séance', 'Finish session')}
      </Button>
      <p className="mt-2 text-center text-[12px] text-muted">{pending > 0 ? `${plural(pending, L('série restante', 'set left'), L('séries restantes', 'sets left'))}` : L('Toutes les séries sont validées.', 'All sets are logged.')}</p>

      <Sheet open={menu} onClose={() => setMenu(false)} title={L('Séance', 'Session')}>
        <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Date de la séance', 'Session date')}</p>
        <DateInput label={L('Date de la séance', 'Session date')} value={a.date} max={todayISO()} onChange={(v) => v && setSessionField({ date: v })} />
        <div className="mt-5">
          <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => { discardSession(); setMenu(false) }}>
            {a.reopened ? L('Annuler la correction', 'Cancel the correction') : L('Abandonner la séance', 'Discard session')}
          </Button>
          <p className="mt-2 text-[12px] text-muted">{a.reopened ? L('La séance reste telle qu’elle était enregistrée.', 'The session stays as it was logged.') : L('Les séries saisies seront perdues. La rotation ne change pas.', 'The sets you logged will be lost. The rotation doesn’t change.')}</p>
        </div>
      </Sheet>
      {gymOpen && <GymSheet session onClose={() => setGymOpen(false)} />}

      <Sheet
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title={L('Terminer maintenant ?', 'Finish now?')}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirmFinish(false)}>{L('Continuer', 'Keep going')}</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => { setConfirmFinish(false); finish() }}>{L('Terminer', 'Finish')}</Button>
          </div>
        }
      >
        <p className="text-[15px] leading-[1.5] text-text-2">
          {L(
            `${plural(pending, 'série n’est pas validée', 'séries ne sont pas validées')} : ${pending > 1 ? 'elles seront ignorées' : 'elle sera ignorée'}. Les exercices sans série validée comptent comme non réalisés.`,
            `${plural(pending, 'set isn’t logged', 'sets aren’t logged')}: ${pending > 1 ? 'they’ll be ignored' : 'it’ll be ignored'}. Exercises with no logged set count as not done.`,
          )}
        </p>
      </Sheet>
    </Screen>
  )
}

// ───────────────────────── Exercise logger ─────────────────────────

/** Re-entry labels (« Reprise après 10 j », « Remise en route (25 j) », « Return after… », « Restart… »): already shown above the exercises. */
const REENTRY_NOTE_PREFIXES = ['Reprise', 'Remise', 'Return', 'Restart']
const isReentryNote = (n: string) => REENTRY_NOTE_PREFIXES.some((x) => n.startsWith(x))

/** The skip reason stored by « Passer cet exercice », shown in the current language; other reasons are left as typed. */
const skipReasonLabel = (r: string) => (r === 'Passé' || r === 'Skipped' ? L('Passé', 'Skipped') : r)

function ExerciseLogger({ index, ex, nextName, current, gymId }: { index: number; ex: WorkoutExercise; nextName?: string; current: boolean; gymId: string }) {
  const workouts = useStore((s) => s.state.workouts)
  const autoLoad = useStore((s) => s.state.prefs.autoLoad)
  const { addSet, removeSet, skipExercise, replaceExercise, setExerciseField, undoHint } = useStore.getState()
  const [info, setInfo] = useState(false)
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState(false)
  const bound = isGymBound(ex)
  // The reference is the last session in the same rep range: an exercise two sessions have in two ranges is followed like for like.
  const { minReps, maxReps } = ex.target
  // (A session reopened to be corrected is still in the history: it is not its own reference.)
  const self = useStore((s) => s.state.activeWorkout?.id)
  const prevPerf = useMemo(() => previousPerformance(workouts, ex.exerciseId, self, bound ? gymId : undefined, { minReps, maxReps }), [workouts, ex.exerciseId, self, bound, gymId, minReps, maxReps])
  const prev = prevPerf?.exercise ?? null
  const prevDate = prevPerf?.workout.date ?? null
  const p = ex.prescription
  const target = p?.weight ?? ex.target.weight
  const prevSets = prev ? doneSets(prev) : []
  // "To beat" counts the reps of the whole exercise: it only means something with as many sets as last time.
  const sameLoad = !!prev && !exerciseContextReason(ex, prev) && effortTarget(ex) === effortTarget(prev) && prevSets.length > 0 && prevSets.length === ex.sets.length && prevSets.every((s) => s.weight === target)
  const prevClean = prevSets.reduce((a, s) => a + cleanOf(s), 0)
  const allDone = ex.sets.length > 0 && ex.sets.every((s) => s.completed)
  // The next load is one the equipment has: the loads already used on it, today's included.
  const known = useMemo(() => knownLoads([...workouts, { exercises: [ex], gymId }], ex.exerciseId, bound ? gymId : undefined), [workouts, ex, bound, gymId])
  // Announced as it will be applied: a heavier load held during the session can beat the standard step.
  const next = allDone && progressionFor(ex, known) ? loadDecision(ex, known) : null
  const validated = next?.kind === 'up' && { text: L(`${fmtLoad(next.weight, ex.unit)} la prochaine fois`, `${fmtLoad(next.weight, ex.unit)} next time`) }
  const noLoadLeft = allDone && toppedOut(ex)
  const lest = takesLest(ex)
  const unitLabel = ex.unit === 'kg/main' ? L('kg/main', 'kg/hand') : ex.unit === 'PDC' ? (lest ? L('Lest', '+ kg') : L('Charge', 'Load')) : 'kg'
  // Pain is about the exercise, whatever the range: the last time it was done at all.
  const hurtLastTime = useMemo(() => !!previousPerformance(workouts, ex.exerciseId, self, bound ? gymId : undefined)?.exercise.sets.some((s) => s.completed && s.flags.includes('pain')), [workouts, ex.exerciseId, self, bound, gymId])
  const currentSet = current ? ex.sets.findIndex((s) => !s.completed) : -1

  if (ex.skipped) {
    return (
      <Card id={`exercise-${index}`} className="flex scroll-mt-[calc(var(--top-bar)+96px)] items-center gap-3 p-4 opacity-70">
        <span className="w-6 text-[12px] font-semibold text-muted tnum">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium line-through decoration-muted">{ex.name}</p>
          <p className="text-[12px] text-muted">{L('Non réalisé', 'Not done')}{ex.skipReason ? ` · ${skipReasonLabel(ex.skipReason)}` : ''}</p>
        </div>
        <Button size="sm" variant="soft" onClick={() => skipExercise(index, false)}>{L('Reprendre', 'Restore')}</Button>
      </Card>
    )
  }

  // Finished exercises fold into one line; tap to reopen (to correct a set).
  if (allDone && !open) {
    return (
      <button
        type="button"
        id={`exercise-${index}`}
        onClick={() => setOpen(true)}
        className="pressable card flex w-full scroll-mt-[calc(var(--top-bar)+96px)] items-center gap-3 px-4 py-3 text-left hover:border-line-strong"
        aria-label={L(`${ex.name} terminé : ${setsSummary(ex.sets, ex.unit)}. Ouvrir`, `${ex.name} done: ${setsSummary(ex.sets, ex.unit)}. Open`)}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal text-signal-ink"><Check size={14} strokeWidth={3} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{ex.name}</span>
          <span className="block truncate text-[13px] text-text-2 tnum">{setsSummary(ex.sets, ex.unit)}{validated ? ` · ${validated.text}` : noLoadLeft ? L(' · haut de la fourchette : variante plus dure', ' · top of the range: harder variation') : ''}</span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden />
      </button>
    )
  }

  return (
    <Card
      as="article"
      id={`exercise-${index}`}
      className={cx('scroll-mt-[calc(var(--top-bar)+96px)] overflow-hidden transition-[border-color,box-shadow]', current ? 'border-signal shadow-[0_0_0_1px_var(--signal)]' : allDone ? 'border-line-strong' : '')}
    >
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className={cx('mt-[3px] w-6 shrink-0 text-[12px] font-semibold tnum', current ? 'text-signal-text' : 'text-muted')}>{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-[1.25] font-semibold tracking-[-0.015em]">{ex.name}</h3>
          <p className="mt-0.5 text-[13px] text-text-2">{ex.muscle}{ex.replacement ? L(` · remplace ${LIBRARY[ex.replacement.fromId]?.name ?? ex.replacement.fromName}`, ` · replaces ${LIBRARY[ex.replacement.fromId]?.name ?? ex.replacement.fromName}`) : ''}</p>
        </div>
        {allDone && <IconButton label={L('Replier', 'Collapse')} onClick={() => setOpen(false)} className="-mt-1.5 -mr-1"><ChevronDown size={19} className="rotate-180" /></IconButton>}
        <IconButton label={L(`Démo et technique : ${ex.name}`, `Demo and technique: ${ex.name}`)} onClick={() => setInfo(true)} className="-mt-1.5 -mr-1"><Info size={19} /></IconButton>
        <IconButton label={L(`Options : ${ex.name}`, `Options: ${ex.name}`)} onClick={() => setMenu(true)} className="-mt-1.5 -mr-2"><Ellipsis size={19} /></IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pl-[52px]">
        <Tag tone={current ? 'signal' : 'ink'}>{(p?.sets ?? ex.target.sets)} × {ex.target.minReps}–{ex.target.maxReps}</Tag>
        <Tag tone="signal">{L('RIR du jour', 'Today’s RIR')} {effortTarget(ex) ?? '—'}</Tag>
        <Tag tone="outline">{fmtRest(p?.restSeconds ?? ex.target.restSeconds)}</Tag>
        {(ex.unit !== 'PDC' || !!target) && <Tag tone="outline">{target !== null ? fmtLoad(target, ex.unit) : L('Charge à trouver', 'Find your load')}</Tag>}
      </div>
      <EffortGuidance exercise={ex} />
      <div className="space-y-1 px-4 pt-2.5 pl-[52px] text-[13px] leading-[1.45]">
        {ex.gymTrial && (
          <p className="text-text-2">
            <span className="font-semibold text-text">{L('Première fois dans cette salle.', 'First time at this gym.')}</span> {L(`Charge de ${localizeGymName(ex.gymTrial.fromGym)} (${fmtLoad(ex.gymTrial.weight, ex.unit)}) comme départ : ajuste si la machine est différente, l’app retiendra la tienne.`, `Starting from your load at ${localizeGymName(ex.gymTrial.fromGym)} (${fmtLoad(ex.gymTrial.weight, ex.unit)}): adjust if the machine is different, the app will remember yours.`)}
          </p>
        )}
        {prevSets.length > 0 ? (
          <p className="text-text-2">
            <span className="text-muted">{L('Dernière fois', 'Last time')}{prevDate ? ` · ${fmtDate(prevDate)}` : ''}{L(' :', ':')}</span> <span className="font-medium text-text tnum">{setsSummary(prevSets, prev!.unit)}</span>
            {sameLoad && <span className="text-muted"> {L('→ à battre :', '→ to beat:')} <span className="font-semibold text-text">{L(`${prevClean + 1} reps propres`, `${prevClean + 1} clean reps`)}</span></span>}
          </p>
        ) : !ex.gymTrial ? (
          <p className="text-muted">{target === null && ex.unit !== 'PDC' ? L(`Séance d’essai : trouve une charge pour ${ex.target.minReps}–${ex.target.maxReps} reps à RIR ${effortTarget(ex) ?? '3'}.`, `Trial session: find a load for ${ex.target.minReps}–${ex.target.maxReps} reps at RIR ${effortTarget(ex) ?? '3'}.`) : L('Première fois : établis ta référence.', 'First time: set your baseline.')}</p>
        ) : null}
        {hurtLastTime && (
          <p className="flex gap-1.5 text-text-2"><TriangleAlert size={13} className="mt-[3px] shrink-0 text-warn" aria-hidden />{L('Douleur signalée la dernière fois : si elle revient, compare les alternatives dans les options de l’exercice (···).', 'Pain flagged last time: if it comes back, compare alternatives in the exercise options (···).')}</p>
        )}
        {lest && !!target && <p className="text-muted">{L('Lest proposé : saisis-le si tu l’ajoutes, sinon la série compte au poids du corps.', 'Suggested added load: type it in if you use it, otherwise the set counts at body weight.')}</p>}
        {ex.note && <p className="text-muted">{ex.note}</p>}
        {ex.technique && <p className="flex gap-1.5 text-muted"><StickyNote size={13} className="mt-[3px] shrink-0" aria-hidden />{ex.technique}</p>}
        {p?.notes.filter((n) => !isReentryNote(n)).map((n) => <p key={n} className="text-muted">{n}</p>)}
      </div>

      <div className="mt-3 px-3 pb-3">
        <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,0.85fr)_60px_48px] gap-2 px-1 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          <span>{L('Série', 'Set')}</span>
          <span>{unitLabel}</span>
          <span>Reps</span>
          <span>RIR</span>
          <span className="sr-only">{L('Valider', 'Log')}</span>
        </div>
        <div className="space-y-1.5">
          {ex.sets.map((_, i) => (
            <SetRow key={i} exIndex={index} setIndex={i} ex={ex} prevReps={prevSets[i] ? cleanOf(prevSets[i]) : null} fallbackWeight={target} isCurrent={i === currentSet} />
          ))}
        </div>
        {ex.hint && (
          <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-signal-soft px-3 py-2 text-[13px]">
            {ex.hint.to > ex.hint.from ? <ArrowUp size={15} className="shrink-0 text-signal-text" aria-hidden /> : <ArrowDown size={15} className="shrink-0 text-signal-text" aria-hidden />}
            <span className="min-w-0 flex-1"><span className="font-semibold">{L('Charge ajustée.', 'Load adjusted.')}</span> {ex.hint.text}</span>
            <button type="button" onClick={() => undoHint(index)} className="pressable -my-1 inline-flex shrink-0 items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] font-semibold text-signal-text hover:bg-surface-2">
              <Undo2 size={14} aria-hidden /> {L('Annuler', 'Undo')}
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button type="button" onClick={() => {
            if (ex.sets.length >= prescribedSets(ex) && !window.confirm(L('Ajouter une série hors prescription ? Elle sera comptée dans le volume. Une série de plus n’est pas nécessaire pour valider la charge.', 'Add a set outside the prescription? It will count towards volume. An extra set is not needed to validate the load.'))) return
            addSet(index)
          }} className="pressable inline-flex h-10 items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
            <Plus size={16} aria-hidden /> {L('Série', 'Set')}
          </button>
          {ex.sets.length > 1 && !ex.sets[ex.sets.length - 1].completed && (
            <button type="button" onClick={() => removeSet(index, ex.sets.length - 1)} className="pressable inline-flex h-10 items-center gap-1.5 rounded-[9px] px-2 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-text">
              <X size={15} aria-hidden /> {L('Retirer', 'Remove')}
            </button>
          )}
        </div>
        {validated && (
          <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px]">
            <CircleCheck size={16} className="shrink-0 text-good" aria-hidden />
            <span><span className="font-semibold">{L('Charge validée.', 'Load mastered.')}</span> {validated.text}{autoLoad ? L(' (appliqué à la fin de la séance)', ' (applied at the end of the session)') : ''}.</span>
          </div>
        )}
        {noLoadLeft && (
          <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[13px]">
            <CircleCheck size={16} className="shrink-0 text-good" aria-hidden />
            <span><span className="font-semibold">{L('Haut de la fourchette atteint.', 'Top of the range reached.')}</span> {L('Passe à une variante plus dure ou à un élastique plus fort.', 'Move to a harder variation or a stronger band.')}</span>
          </div>
        )}
      </div>

      {ex.supersetWithNext && nextName && (
        <div className="flex items-center gap-2 border-t border-dashed border-line-strong bg-signal-soft px-4 py-2.5 text-[13px] font-medium">
          <LinkIcon size={14} className="text-signal-text" aria-hidden />
          {L(`Superset : enchaîne avec ${nextName}, repos après.`, `Superset: go straight into ${nextName}, then rest.`)}
        </div>
      )}

      <ExerciseSheet exerciseId={ex.exerciseId} name={ex.name} open={info} onClose={() => setInfo(false)} prescription={p} onReplace={(id) => replaceExercise(index, id)} />
      <Sheet open={menu} onClose={() => setMenu(false)} title={ex.name}>
        <div className="space-y-5">
          <ExerciseAlternatives exerciseId={ex.exerciseId} onChoose={(id) => { replaceExercise(index, id); setMenu(false) }} />
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-2">{L('Conditions différentes (tempo, prise…)', 'Different conditions (tempo, grip…)')}</span>
            <input className={inputClass} value={ex.comparisonContext ?? ''} placeholder={L('Ex. : tempo lent, prise différente', 'E.g. slow tempo, different grip')} onChange={(e) => setExerciseField(index, { comparisonContext: e.target.value })} />
            <span className="mt-1 block text-[12px] text-muted">{L('Évite une fausse comparaison avec la dernière séance. Pour une autre salle, change plutôt la salle en haut de la séance.', 'Avoids a misleading comparison with the last session. For another gym, change the gym at the top of the session instead.')}</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-text-2">{L('Note sur l’exercice', 'Exercise note')}</span>
            <textarea className={cx(inputClass, 'h-20 resize-none py-2.5')} value={ex.notes} onChange={(e) => setExerciseField(index, { notes: e.target.value })} />
          </label>
          <Button variant="danger" full onClick={() => { skipExercise(index, true, L('Passé', 'Skipped')); setMenu(false) }}>{L('Passer cet exercice', 'Skip this exercise')}</Button>
        </div>
      </Sheet>
    </Card>
  )
}

function NumField({ value, onCommit, placeholder, decimal, label, disabled }: { value: number | null; onCommit: (n: number | null) => void; placeholder?: string; decimal?: boolean; label: string; disabled?: boolean }) {
  const toText = (v: number | null) => (v === null ? '' : String(v).replace('.', L(',', '.')))
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

// Labels are getters: they follow the interface language.
const FLAGS: { id: SetFlag; label: string }[] = [
  { id: 'failure', get label() { return L('Échec', 'Failure') } },
  { id: 'bad-technique', get label() { return L('Technique', 'Technique') } },
  { id: 'pain', get label() { return L('Douleur', 'Pain') } },
]

function SetRow({ exIndex, setIndex, ex, prevReps, fallbackWeight, isCurrent }: { exIndex: number; setIndex: number; ex: WorkoutExercise; prevReps: number | null; fallbackWeight: number | null; isCurrent: boolean }) {
  const s = ex.sets[setIndex]
  const { updateSet, completeSet, toggleFlag } = useStore.getState()
  const [open, setOpen] = useState(false)
  const done = s.completed
  const hasDetail = s.flags.length > 0 || (s.cleanReps !== null && s.reps !== null && s.cleanReps !== s.reps) || !!s.note
  return (
    <div className={cx('rounded-[12px] px-1 py-1 transition-colors', done && 'bg-surface-2', isCurrent && 'bg-signal-soft shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--signal)_55%,transparent)]')} aria-current={isCurrent ? 'step' : undefined}>
      <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,0.85fr)_60px_48px] items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={L(`Détails de la série ${setIndex + 1}`, `Set ${setIndex + 1} details`)}
          className={cx('pressable flex h-11 flex-col items-center justify-center rounded-[9px] text-[15px] font-semibold tnum hover:bg-surface-3', isCurrent && 'text-signal-text')}
        >
          {setIndex + 1}{setIndex >= prescribedSets(ex) && <span className="text-[9px] text-warn">{L('Bonus', 'Extra')}</span>}
          <ChevronDown size={11} className={cx('text-muted transition-transform', (open || hasDetail) && 'text-signal-text', open && 'rotate-180')} aria-hidden />
        </button>
        {ex.unit === 'PDC' && !takesLest(ex) ? (
          <span className="flex h-11 items-center justify-center rounded-[10px] text-[14px] font-semibold text-text-2">{bodyweightLabel()}</span>
        ) : ex.unit === 'PDC' ? (
          <NumField label={L(`Lest série ${setIndex + 1}`, `Set ${setIndex + 1} added load`)} decimal value={s.weight} placeholder={bodyweightLabel()} onCommit={(n) => updateSet(exIndex, setIndex, { weight: n })} disabled={done} />
        ) : (
          <NumField label={L(`Charge série ${setIndex + 1}`, `Set ${setIndex + 1} load`)} decimal value={s.weight} placeholder={fallbackWeight !== null ? fmtNum(fallbackWeight) : '—'} onCommit={(n) => updateSet(exIndex, setIndex, { weight: n })} disabled={done} />
        )}
        <NumField
          label={L(`Répétitions série ${setIndex + 1}`, `Set ${setIndex + 1} reps`)}
          value={s.reps}
          placeholder={prevReps !== null ? String(prevReps) : `${ex.target.minReps}–${ex.target.maxReps}`}
          onCommit={(n) => updateSet(exIndex, setIndex, { reps: n === null ? null : Math.round(n) })}
          disabled={done}
        />
        <select
          aria-label={L(`RIR série ${setIndex + 1}`, `Set ${setIndex + 1} RIR`)}
          value={recordedRir(s) ?? ''}
          onChange={(e) => updateSet(exIndex, setIndex, { rir: e.target.value === '' ? null : Number(e.target.value) })}
          className="h-11 w-full appearance-none rounded-[10px] border border-line-strong bg-surface text-center text-[16px] font-semibold text-text tnum focus:border-signal focus:outline-none"
        >
          <option value="">—</option>
          {[0, 1, 2, 3, 4].map((r) => <option key={r} value={r}>{r === 4 ? '4+' : r}</option>)}
        </select>
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? L(`Annuler la série ${setIndex + 1}`, `Undo set ${setIndex + 1}`) : L(`Valider la série ${setIndex + 1}`, `Log set ${setIndex + 1}`)}
          onClick={() => {
            unlockAudio()
            completeSet(exIndex, setIndex, { weight: fallbackWeight, reps: prevReps })
          }}
          className={cx('pressable flex h-11 w-12 items-center justify-center rounded-[10px] border', done ? 'border-signal bg-signal text-signal-ink' : isCurrent ? 'border-signal bg-surface text-signal-text' : 'border-line-strong text-text-2 hover:border-muted hover:text-text')}
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
            <span className="text-[13px] text-text-2">{L('Reps propres', 'Clean reps')}</span>
            <div className="flex items-center gap-1">
              <IconButton label={L('Une rep propre de moins', 'One fewer clean rep')} onClick={() => updateSet(exIndex, setIndex, { cleanReps: Math.max(0, (s.cleanReps ?? s.reps ?? 0) - 1) })} className="h-9 w-9"><span className="text-[18px]">−</span></IconButton>
              <span className="w-8 text-center text-[16px] font-semibold tnum">{s.cleanReps ?? s.reps ?? '—'}</span>
              <IconButton label={L('Une rep propre de plus', 'One more clean rep')} onClick={() => updateSet(exIndex, setIndex, { cleanReps: Math.min(s.reps ?? 99, (s.cleanReps ?? s.reps ?? 0) + 1) })} className="h-9 w-9"><span className="text-[18px]">+</span></IconButton>
            </div>
          </div>
          <input className={cx(inputClass, 'h-11')} placeholder={L('Note (ex. : dernière rep aidée)', 'Note (e.g. last rep assisted)')} value={s.note} onChange={(e) => updateSet(exIndex, setIndex, { note: e.target.value })} />
        </div>
      )}
    </div>
  )
}

// ───────────────────────── Summary ─────────────────────────

export function SessionSummary() {
  const lastFinish = useStore((s) => s.lastFinish)
  const state = useStore((s) => s.state)
  const { applyChanges, revertChange, bringDeloadForward, cancelEarlyDeload } = useStore.getState()
  const w = lastFinish?.workout ?? state.workouts.find((x) => x.id === state.lastCompletedWorkoutId) ?? null
  if (!w) {
    return (
      <Screen>
        <Header art="trophy" title={L('Bilan', 'Summary')} backTo="" />
        <Empty title={L('Aucune séance terminée', 'No completed session')} />
      </Screen>
    )
  }
  // The changes live with the session and their state is read on the sheets: still there once the app was closed.
  const changes = w.changes ?? []
  const stateOf = (c: AutoChange) => changeState(state.templates, c, w, state.workouts)
  const waiting = changes.filter((c) => stateOf(c) === 'open')
  const records = w.exercises.filter((e) => e.comparison?.isRecord)
  const minutes = sessionDurationMin(w)
  const volume = w.exercises.reduce((a, e) => a + (e.comparison?.volume ?? 0), 0)
  const today = todayISO()
  const early = !!lastFinish?.generalDrop && !state.manualDeload && !contextAt(today).deload
  // An early deload still ahead, or running: it can be called off here.
  const advanced = state.manualDeload && today <= state.manualDeload.end ? state.manualDeload : null
  // Effort beyond the plan: worth a word when it is a habit of the session, or when it kept a load from going up.
  const effort = sessionEffort(w)
  const pushedOften = effort.pushed >= 2 && effort.pushed * 3 >= effort.logged
  const held = w.exercises.filter(heldByEffort)
  // What the loads cannot settle: pain that comes back, and exercises that stopped progressing.
  const notes = sessionNotes(state.workouts, w)
  const watch = [
    ...(state.prefs.autoLoad ? [] : (lastFinish?.alerts ?? [])),
    ...(notes.pain.length
      ? [L(
          `Douleur signalée : ${notes.pain.join(', ')}. La charge n’y monte pas tant qu’elle est là.${notes.painAgain.length ? ` Deuxième séance de suite sur ${notes.painAgain.join(', ')} : remplace l’exercice (··· → Remplacer par), et fais-toi examiner si elle persiste.` : ' Si elle revient à la prochaine séance, remplace l’exercice (··· → Remplacer par).'}`,
          `Pain flagged: ${notes.pain.join(', ')}. The load does not go up there while it hurts.${notes.painAgain.length ? ` Second session in a row on ${notes.painAgain.join(', ')}: replace the exercise (··· → Replace with), and have it checked if it lasts.` : ' If it comes back next session, replace the exercise (··· → Replace with).'}`,
        )]
      : []),
    ...(notes.plateau.length
      ? [L(
          `Pas de progrès depuis ${PLATEAU_SESSIONS} séances : ${notes.plateau.join(', ')}. Bon moment pour faire le point : sommeil, calories, technique, ou une variante de l’exercice.`,
          `No progress for ${PLATEAU_SESSIONS} sessions: ${notes.plateau.join(', ')}. A good time to take stock: sleep, calories, technique, or a variation of the exercise.`,
        )]
      : []),
  ]

  return (
    <Screen>
      <Header art="trophy" eyebrow={`${L(`Séance n°${w.sessionNumber}`, `Session #${w.sessionNumber}`)} · ${capitalize(fmtDate(w.date, { weekday: true }))} · ${gymName(state, w.gymId)}`} title={L('Séance terminée', 'Workout complete')} backTo="" />
      <div className="grid grid-cols-3 gap-2.5">
        <Figure label={L('Durée', 'Duration')} value={minutes === null ? '—' : minutes < 1 ? '< 1 min' : `${minutes} min`} />
        <Figure label={L('Séries', 'Sets')} value={String(sessionSetCount(w))} />
        <Figure label="Volume" value={`${fmtNum(volume / 1000, 1)} t`} />
      </div>

      <EffortReport exercises={w.exercises} />

      {records.length > 0 && (
        <Section title={L('Records', 'Personal bests')}>
          <div className="flex flex-wrap gap-2">
            {records.map((e) => <span key={e.exerciseId} className="inline-flex items-center gap-2 text-[14px] font-medium"><RecordTag />{e.name}</span>)}
          </div>
        </Section>
      )}

      {changes.length > 0 && (
        <Section
          title={state.prefs.autoLoad ? L('Plan ajusté', 'Plan adjusted') : L('Ajustements proposés', 'Suggested adjustments')}
          action={waiting.length > 1 ? <Button size="sm" variant="ink" onClick={() => applyChanges(waiting.map((c) => c.id))}>{L('Tout appliquer', 'Apply all')}</Button> : undefined}
        >
          <p className="-mt-1 mb-3 text-[13px] leading-[1.45] text-text-2">
            {state.prefs.autoLoad ? L('Tes prochaines séances partent de ces charges. Annule un changement si la séance ne te ressemblait pas.', 'Your next sessions start from these loads. Undo a change if this session wasn’t typical for you.') : L('Calculé d’après tes séries. Applique ce qui te convient.', 'Calculated from your sets. Apply what suits you.')}
          </p>
          <Card className="divide-y divide-line">
            {changes.map((c) => <ChangeRow key={c.id} c={c} unit={unitOf(w, c)} state={stateOf(c)} onApply={() => applyChanges([c.id])} onRevert={() => revertChange(c.id)} />)}
          </Card>
        </Section>
      )}

      {(pushedOften || held.length > 0) && (
        <Section title="Effort">
          <Card className="p-4">
            <p className="flex gap-2 text-[14px] leading-[1.45]">
              <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>
                {pushedOften && L(
                  `${effort.pushed} séries sur ${sessionSetCount(w)} poussées plus loin que l’effort prévu${effort.planned ? ` (RIR ${effort.planned})` : ''}. `,
                  `${effort.pushed} of ${sessionSetCount(w)} sets pushed past the planned effort${effort.planned ? ` (RIR ${effort.planned})` : ''}. `,
                )}
                {w.deload
                  ? L('En décharge, garde cette marge : c’est elle qui fait récupérer.', 'On a deload, keep that margin: it is what lets you recover.')
                  : L('Une charge ne monte que si la fourchette est tenue à l’effort prévu.', 'A load only goes up when the range is held at the planned effort.')}
                {held.length > 0 && L(` Maintenue cette fois : ${held.map((e) => e.name).join(', ')}.`, ` Held this time: ${held.map((e) => e.name).join(', ')}.`)}
              </span>
            </p>
          </Card>
        </Section>
      )}

      {early && (
        <Section title={L('Récupération', 'Recovery')}>
          <Card className="p-4">
            <p className="flex gap-2 text-[14px] leading-[1.45]"><TriangleAlert size={17} className="mt-0.5 shrink-0 text-warn" aria-hidden />{L('Plusieurs exercices sont en nette baisse deux séances de suite : c’est le signal pour avancer la décharge.', 'Several exercises clearly dropped two sessions in a row: that’s the signal to bring the deload forward.')}</p>
            <Button variant="primary" full className="mt-3" onClick={() => { bringDeloadForward(); useStore.getState().notify(L('Décharge avancée : 7 jours dès demain.', 'Deload brought forward: 7 days starting tomorrow.'), 'good') }}>{L('Décharge dès demain (7 jours)', 'Deload from tomorrow (7 days)')}</Button>
          </Card>
        </Section>
      )}

      {advanced && (
        <Section title={L('Récupération', 'Recovery')}>
          <Card className="flex items-center gap-3 p-4">
            <p className="min-w-0 flex-1 text-[14px] leading-[1.45]">{L(`Décharge avancée : du ${fmtDate(advanced.start, { long: true })} au ${fmtDate(advanced.end, { long: true })}.`, `Deload brought forward: ${fmtDate(advanced.start, { long: true })} to ${fmtDate(advanced.end, { long: true })}.`)}</p>
            <Button size="sm" variant="ghost" icon={<Undo2 size={14} aria-hidden />} onClick={() => { cancelEarlyDeload(); useStore.getState().notify(L('Décharge avancée annulée : le plan reprend son calendrier.', 'Early deload cancelled: the plan is back on its calendar.')) }}>{L('Annuler', 'Cancel')}</Button>
          </Card>
        </Section>
      )}

      {watch.length > 0 && (
        <Section title={L('À surveiller', 'To watch')}>
          <Card className="space-y-2 p-4">
            {watch.map((a) => <p key={a} className="text-[14px] leading-[1.45]">{a}</p>)}
          </Card>
        </Section>
      )}

      <Section title={L('Exercices', 'Exercises')}>
        <WorkoutExercises w={w} />
      </Section>

      <div className="mt-8 grid gap-2">
        <Button variant="primary" size="lg" full onClick={() => navigate('')}>{L('Retour à l’accueil', 'Back to home')}</Button>
      </div>
    </Screen>
  )
}

/** Unit of the exercise a change is about, as the session logged it. */
const unitOf = (w: Workout, c: AutoChange): Unit => w.exercises.find((e) => e.exerciseId === c.exerciseId)?.unit ?? 'kg'

/** A change a session made to the plan: undone while the sheet still holds it, applied while it still holds what the change started from. */
function ChangeRow({ c, unit, state, onApply, onRevert }: { c: AutoChange; unit: Unit; state: 'applied' | 'open' | 'gone'; onApply: () => void; onRevert: () => void }) {
  const icon = c.kind === 'up' ? <ArrowUp size={15} aria-hidden /> : c.kind === 'down' || c.kind === 'sets' ? <ArrowDown size={15} aria-hidden /> : <Check size={15} aria-hidden />
  // Its sentence was written when the session ended: in another language since, the figures speak instead.
  const text = c.lang && c.lang !== lang() ? changeLabel(c, unit) : c.text
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', c.kind === 'up' ? 'bg-good-mark/12 text-good' : c.kind === 'baseline' ? 'bg-surface-2 text-text-2' : 'bg-warn-mark/12 text-warn')}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{c.name}</p>
        <p className={cx('text-[13px] text-text-2', state !== 'applied' && 'text-muted')}>{text}</p>
        {state === 'gone' && <p className="text-[12px] text-muted">{L('Plus d’actualité : fiche modifiée ou exercice refait depuis.', 'No longer current: sheet edited or exercise done again since.')}</p>}
      </div>
      {state === 'applied' ? (
        <Button size="sm" variant="ghost" icon={<Undo2 size={14} aria-hidden />} onClick={onRevert}>{L('Annuler', 'Undo')}</Button>
      ) : state === 'open' ? (
        <Button size="sm" variant="primary" onClick={onApply}>{L('Appliquer', 'Apply')}</Button>
      ) : null}
    </div>
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
            {e.skipped && <p className="mt-1 text-[12px] text-muted">{L('Non réalisé', 'Not done')}</p>}
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
  const { deleteWorkout, reopenWorkout, applyChanges, revertChange, notify } = useStore.getState()
  const [confirm, setConfirm] = useState(false)
  const [fix, setFix] = useState(false)
  const w = state.workouts.find((x) => x.id === id)
  if (!w) {
    return (
      <Screen>
        <Header art="plate" title={L('Séance', 'Session')} backTo="progres/seances" />
        <Empty title={L('Séance introuvable', 'Session not found')} />
      </Screen>
    )
  }
  const minutes = sessionDurationMin(w)
  const ctx = contextAt(w.date)
  // What the session changed in the plan, and where each change stands on the sheets today.
  const changes = w.changes ?? []
  const stateOf = (c: AutoChange) => changeState(state.templates, c, w, state.workouts)
  // What a deletion would undo (a session logged before changes were kept has its load changes worked out again).
  const inPlace = changesOf(state, w).filter((c) => stateOf(c) === 'applied')
  // Only the last session finished can be put back in progress: later sessions were compared with it.
  const isLast = lastFinished(state.workouts)?.id === w.id
  // Its correction may already be under way: the session in progress is then this one, reopened.
  const correcting = !!state.activeWorkout?.reopened && state.activeWorkout.id === w.id
  return (
    <Screen>
      <Header art="trophy" eyebrow={`${L(`Séance n°${w.sessionNumber}`, `Session #${w.sessionNumber}`)} · ${capitalize(fmtDate(w.date, { weekday: true, year: true }))}`} title={TYPE_META[w.type].label} backTo="progres/seances" sub={`${TYPE_META[w.type].fr} · ${L(`${sessionSetCount(w)} séries`, plural(sessionSetCount(w), 'set', 'sets'))}${minutes ? ` · ${minutes} min` : ''}${ctx.period ? ` · ${ctx.title}` : ''}`} />
      {w.notes && <Card className="mb-4 p-4 text-[14px] leading-[1.5] text-text-2">{w.notes}</Card>}
      <WorkoutExercises w={w} />
      {changes.length > 0 && (
        <Section title={L('Plan ajusté après cette séance', 'Plan adjusted after this session')}>
          <Card className="divide-y divide-line">
            {changes.map((c) => <ChangeRow key={c.id} c={c} unit={unitOf(w, c)} state={stateOf(c)} onApply={() => applyChanges([c.id])} onRevert={() => revertChange(c.id)} />)}
          </Card>
        </Section>
      )}
      <div className="mt-8 grid gap-2">
        {isLast && (correcting ? (
          <Button variant="outline" size="lg" full icon={<Pencil size={16} aria-hidden />} onClick={() => navigate('seance')}>{L('Reprendre la correction', 'Resume the correction')}</Button>
        ) : (
          <Button variant="outline" size="lg" full icon={<Pencil size={16} aria-hidden />} disabled={!!state.activeWorkout} onClick={() => setFix(true)}>{L('Corriger la séance', 'Correct this session')}</Button>
        ))}
        <Button variant="danger" size="lg" full icon={<Trash size={16} aria-hidden />} onClick={() => setConfirm(true)}>{L('Supprimer la séance', 'Delete session')}</Button>
      </div>
      {isLast && state.activeWorkout && !correcting && <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Une séance est en cours : termine-la avant de corriger celle-ci.', 'A session is in progress: finish it before correcting this one.')}</p>}
      <Sheet
        open={fix}
        onClose={() => setFix(false)}
        title={L('Corriger cette séance ?', 'Correct this session?')}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setFix(false)}>{L('Annuler', 'Cancel')}</Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => { setFix(false); if (reopenWorkout(w.id)) { notify(L('Séance rouverte : corrige, puis termine-la.', 'Session reopened: correct it, then finish it.')); navigate('seance', { replace: true }) } }}>{L('Corriger', 'Correct')}</Button>
          </div>
        }
      >
        <p className="text-[15px] text-text-2">
          {L('Elle s’ouvre avec ses séries : corrige ce qu’il faut, puis termine-la à nouveau. Tant que tu n’as pas terminé, rien ne change.', 'It opens with its sets: fix what needs fixing, then finish it again. Until you finish, nothing changes.')}
          {inPlace.length > 0 && L(` Ses ajustements (${inPlace.map((c) => c.name).join(', ')}) sont recalculés à la fin.`, ` Its adjustments (${inPlace.map((c) => c.name).join(', ')}) are worked out again at the end.`)}
        </p>
      </Sheet>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={L('Supprimer cette séance ?', 'Delete this session?')}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirm(false)}>{L('Annuler', 'Cancel')}</Button>
            <Button variant="danger" size="lg" className="flex-1" onClick={() => { deleteWorkout(w.id); navigate('progres/seances', { replace: true }) }}>{L('Supprimer', 'Delete')}</Button>
          </div>
        }
      >
        <p className="text-[15px] text-text-2">
          {L('Elle disparaît de l’historique et des graphiques. Pense à exporter une sauvegarde avant.', 'It disappears from your history and charts. Consider exporting a backup first.')}
          {inPlace.length > 0 && L(` Ses ajustements encore en place sont annulés : ${inPlace.map((c) => c.name).join(', ')}.`, ` Its adjustments still in place are undone: ${inPlace.map((c) => c.name).join(', ')}.`)}
        </p>
      </Sheet>
    </Screen>
  )
}

export { DemoFrames }
