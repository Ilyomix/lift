import { useMemo, useState } from 'react'
import { Apple, ArrowRight, Camera, ChevronDown, CirclePause, Download, Flag, MapPin, Pencil, Play, Scale, Smartphone, TriangleAlert } from 'lucide-react'
import { addDays, capitalize, diffDays, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, fmtSigned, plural } from '../lib/format'
import { gymName } from '../lib/gyms'
import {
  contextAt, GOAL_DATE, pauseDays, prescribe, projectSessions, PROGRAM_START, sessionPlan, trainingDays, TYPE_META,
} from '../lib/program'
import { navigate } from '../lib/router'
import { isIOS, isStandalone } from '../lib/share'
import {
  calorieAdvice, goalWeightRange, measureSeries, movingAverage7, nutritionFor, proteinTargetFor, recentPace, sessionsThisWeek, weekStrip, weightStatus,
} from '../lib/stats'
import { useStore } from '../lib/store'
import { dropAlert, doneSets, strengthSummary } from '../lib/training'
import { Sparkline } from '../components/charts'
import { GoalSheet } from '../components/GoalSheet'
import { GymSheet } from '../components/GymSheet'
import { SessionTrack, WeekStrip } from '../components/Program'
import { Button, Card, cx, Eyebrow, Num, ProgressBar, Screen, Section, Tag } from '../components/ui'
import { Dial } from './Onboarding'

export function Home() {
  const state = useStore((s) => s.state)
  const photos = useStore((s) => s.photos)
  const startSession = useStore((s) => s.startSession)
  const [goalOpen, setGoalOpen] = useState(false)
  const [gymOpen, setGymOpen] = useState(false)
  const today = todayISO()
  const ctx = contextAt(today)
  const plan = useMemo(() => sessionPlan(state, today), [state, today])
  const planned = useMemo(() => projectSessions(state, GOAL_DATE, today), [state, today])
  const paused = useMemo(() => pauseDays(state, today), [state, today])
  const week = weekStrip(state, planned, paused, today)
  const doneThisWeek = sessionsThisWeek(state.workouts, today)
  const perWeek = trainingDays(state).length
  const next = planned[0]
  const active = state.activeWorkout
  const ws = weightStatus(state, today)
  const goal = goalWeightRange(state, today)
  const ma = movingAverage7(measureSeries(state.bodyEntries, 'weight')).slice(-20).map((p) => p.value)
  const waist = measureSeries(state.bodyEntries, 'waist')
  const strength = strengthSummary(state.workouts, state.templates, addDays(today, -30))
  const pace = recentPace(state.workouts, today)
  const nut = nutritionFor(state, today)
  const protein = proteinTargetFor(state, today)
  const cal = calorieAdvice(state, today)
  const lastWorkout = state.workouts[state.workouts.length - 1]
  const drops = !state.prefs.autoLoad && lastWorkout ? lastWorkout.exercises.map((e) => dropAlert(state.workouts, e.exerciseId)).filter((x): x is string => !!x) : []
  const lastPhoto = photos[photos.length - 1]
  const daysSinceBackup = state.meta.lastBackupAt ? Math.floor((Date.now() - new Date(state.meta.lastBackupAt).getTime()) / 86_400_000) : null
  const weeksLeft = Math.max(0, Math.ceil(diffDays(today, GOAL_DATE) / 7))
  const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0

  const nextType = active?.type ?? next?.type ?? state.nextWorkoutType
  const nextDate = next?.date ?? today
  const nextCtx = contextAt(nextDate < PROGRAM_START ? PROGRAM_START : nextDate)
  const nextSets = state.templates[nextType].exercises.reduce((a, e) => a + prescribe(e, nextCtx.date, state.reentry).sets, 0)

  const begin = () => {
    startSession(nextType)
    navigate('seance')
  }

  return (
    <Screen>
      {/* Same rhythm as the other tabs: a 44 px top row, then the eyebrow, then the title. */}
      <header className="pt-2">
        <div className="flex min-h-11 items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <Dial size={24} className="rounded-[6px]" />
            Golgoth
          </span>
        </div>
        <Eyebrow className="mt-1">{capitalize(fmtDate(today, { weekday: true, long: true }))}</Eyebrow>
      </header>

      {/* Hero: sessions done out of the sessions planned until the goal date */}
      <section aria-label="Progression vers l’objectif" className="mt-2">
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-[64px] leading-[0.8] font-semibold tracking-[-0.04em] tnum">
              <Num value={plan.done} digits={0} />
            </span>
            <span className="text-[22px] leading-none font-medium tracking-[-0.02em] text-text-2 tnum">/ {plan.total}</span>
            <span className="sr-only">séances</span>
          </p>
          <p className="pb-0.5 text-right">
            <span className="block text-[22px] leading-none font-semibold tracking-[-0.02em] tnum">{pct} %</span>
            <span className="mt-1 block text-[12px] font-medium text-muted">séances</span>
          </p>
        </div>
        <div className="mt-4">
          <SessionTrack plan={plan} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setGoalOpen(true)}
            className="pressable inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-semibold hover:border-muted"
            aria-label={`Objectif le ${fmtDate(GOAL_DATE, { long: true, year: true })}, modifier`}
          >
            <Flag size={14} className="shrink-0 text-signal-text" aria-hidden />
            <span className="truncate">{fmtDate(GOAL_DATE, { long: true, year: true })}</span>
            <Pencil size={12} className="shrink-0 text-muted" aria-hidden />
          </button>
          <span className="shrink-0 text-right text-[12px] leading-[1.35] text-muted tnum">
            {plural(plan.planned, 'séance', 'séances')} à faire
            <br />
            {plural(weeksLeft, 'semaine', 'semaines')}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ctx.before || ctx.period?.kind === 'pre' ? (
            <>
              <Tag tone="ink">Bloc 1 · {fmtRelativeDay(PROGRAM_START, today)}</Tag>
              <span className="text-[13px] text-text-2">Recomposition · RIR 3, réintroduction</span>
            </>
          ) : (
            <>
              <Tag tone="ink">{ctx.title}</Tag>
              {ctx.phase && <Tag tone="outline">{ctx.phase.short}</Tag>}
              {ctx.effort && <span className="text-[13px] text-text-2">{ctx.effort}</span>}
            </>
          )}
        </div>
      </section>

      {state.programPause.active && (
        <Card className="mt-6 flex items-center gap-3 p-4">
          <CirclePause size={20} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Programme en pause</p>
            <p className="text-[13px] text-text-2">
              Depuis {state.programPause.startedAt ? fmtRelativeDay(state.programPause.startedAt.slice(0, 10), today) : '—'}
              {state.programPause.plannedEnd ? ` · reprise ${fmtRelativeDay(addDays(state.programPause.plannedEnd, 1), today)}` : ''}
            </p>
          </div>
          <Button size="sm" variant="ink" onClick={() => navigate('plus/pause')}>Gérer</Button>
        </Card>
      )}

      {state.reentry && (
        <Card className="mt-3 p-4">
          <p className="text-[15px] font-semibold">{state.reentry.label}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-text-2">{state.reentry.advice} Encore {plural(state.reentry.sessionsLeft, 'séance', 'séances')}.</p>
        </Card>
      )}

      {/* Next action — the one primary command of the screen */}
      <Section title={active ? 'Séance en cours' : 'Prochaine séance'}>
        <Card className="overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[26px] leading-none font-semibold tracking-[-0.03em]">{TYPE_META[nextType].label}</p>
                <p className="mt-1.5 text-[14px] text-text-2">
                  {TYPE_META[nextType].fr} · {active ? `${active.exercises.reduce((a, e) => a + doneSets(e).length, 0)} / ${active.exercises.reduce((a, e) => a + e.sets.length, 0)} séries` : `${nextSets} séries · ~${TYPE_META[nextType].minutes} min`}
                </p>
              </div>
              <Tag tone="outline">{active ? 'En cours' : capitalize(fmtRelativeDay(nextDate, today))}</Tag>
            </div>
            {!active && nextCtx.effort && <p className="mt-3 text-[13px] text-muted">{nextCtx.title} · {nextCtx.effort}</p>}
            {!active && (
              <button type="button" onClick={() => setGymOpen(true)} className="pressable -mx-1 mt-2 inline-flex h-9 items-center gap-1.5 rounded-[8px] px-1 text-[13px] font-medium text-text-2 hover:text-text">
                <MapPin size={14} aria-hidden />
                {gymName(state, state.gymId)}
                <ChevronDown size={14} className="text-muted" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <Button variant="primary" size="lg" className="flex-1" icon={<Play size={18} aria-hidden />} onClick={active ? () => navigate('seance') : begin}>
              {active ? 'Reprendre' : 'Commencer'}
            </Button>
            {!active && (
              <Button variant="outline" size="lg" onClick={() => navigate('seance')} aria-label="Voir le détail de la séance">
                Détail
              </Button>
            )}
          </div>
        </Card>
      </Section>

      <Section title="Cette semaine" action={<span className="text-[13px] text-text-2 tnum">{doneThisWeek} / {perWeek} séances</span>}>
        <WeekStrip days={week} />
      </Section>

      <Section title="Objectifs" action={<button type="button" onClick={() => navigate('progres')} className="inline-flex items-center gap-1 text-[13px] font-medium text-text-2 hover:text-text">Progrès <ArrowRight size={14} aria-hidden /></button>}>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            label="Poids"
            value={ws.current !== null ? <><Num value={ws.current} digits={1} /><span className="ml-0.5 text-[15px] font-medium text-text-2">kg</span></> : '—'}
            foot={ws.current === null ? 'Ajoute une pesée' : ws.isAverage ? 'Moyenne 7 jours' : `Pesée ${fmtRelativeDay(ws.currentDate!, today)}`}
            detail={goal ? `Cible ${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)} kg` : undefined}
            chart={ma.length > 1 ? <Sparkline values={ma} /> : undefined}
            onClick={() => navigate('progres/corps')}
          />
          <Tile
            label="Tour de taille"
            value={waist.length ? <><Num value={waist[waist.length - 1].value} digits={1} /><span className="ml-0.5 text-[15px] font-medium text-text-2">cm</span></> : '—'}
            foot={waist.length ? `Mesuré ${fmtRelativeDay(waist[waist.length - 1].date, today)}` : 'Toutes les 2 semaines'}
            detail={waist.length > 1 ? `${fmtSigned(waist[waist.length - 1].value - waist[0].value, 1, 'cm')} depuis le début` : state.goals.targetWaist ? `Cible ${fmtNum(state.goals.targetWaist)} cm` : 'À jeun, même point'}
            onClick={() => navigate('progres/corps')}
          />
          <Tile
            label="Régularité"
            value={<><Num value={pace} digits={1} /><span className="ml-1 text-[15px] font-medium text-text-2">/ sem.</span></>}
            foot="4 dernières semaines"
            detail={`Plan : ${perWeek} par semaine`}
            onClick={() => navigate('progres/seances')}
          >
            <ProgressBar value={pace / Math.max(1, perWeek)} className="mt-2" label="Séances par semaine par rapport au plan" tone={pace >= perWeek - 0.25 ? 'good' : 'text'} />
          </Tile>
          <Tile
            label="Force"
            value={strength.avg !== null ? <Num value={strength.avg * 100} digits={0} suffix=" %" signed /> : '—'}
            foot={strength.avg !== null ? `1RM estimé · ${plural(strength.lifts, 'exercice', 'exercices')}` : 'Après 2 séances par exercice'}
            detail={strength.records ? `${plural(strength.records, 'record', 'records')} en 30 jours` : undefined}
            onClick={() => navigate('progres')}
          />
        </div>
      </Section>

      <Section title="Nutrition du jour" action={<button type="button" onClick={() => navigate('plus/nutrition')} className="text-[13px] font-medium text-text-2 hover:text-text">Saisir</button>}>
        <Card className="grid grid-cols-3 divide-x divide-line">
          <NutriCell label="Protéines" value={nut.protein} unit="g" target={`${protein.min}–${protein.max}`} ratio={nut.protein / protein.min} />
          <NutriCell label="Calories" value={nut.calories} unit="kcal" target={`${state.nutritionTargets.calories}`} ratio={nut.calories / state.nutritionTargets.calories} />
          <NutriCell label="Créatine" value={nut.creatine} unit="g" target={`${state.nutritionTargets.creatine}`} ratio={nut.creatine / Math.max(1, state.nutritionTargets.creatine)} />
        </Card>
      </Section>

      <Reminders
        items={[
          ...drops.map((d) => ({ icon: <TriangleAlert size={18} className="text-warn" aria-hidden />, text: d, action: 'Programme', to: 'plus/programme' })),
          ...(cal.status === 'lower' || cal.status === 'raise'
            ? [{ icon: <Apple size={18} aria-hidden />, text: `${cal.headline} : ${cal.target} kcal conseillées (${cal.delta > 0 ? '+' : '−'}${Math.abs(cal.delta)}).`, action: 'Voir', to: 'plus/nutrition' }]
            : []),
          ...(ws.daysSinceLast === null || ws.daysSinceLast >= 2
            ? [{ icon: <Scale size={18} aria-hidden />, text: ws.daysSinceLast === null ? 'Aucune pesée : la moyenne sur 7 jours guide tes calories.' : `Dernière pesée il y a ${ws.daysSinceLast} jours. Pèse-toi chaque matin, à jeun.`, action: 'Peser', to: 'progres/corps/mesure' }]
            : []),
          ...(!lastPhoto || (Date.now() - new Date(lastPhoto.date).getTime()) / 86_400_000 > 28
            ? [{ icon: <Camera size={18} aria-hidden />, text: 'Photos de progression : une série toutes les 4 semaines, même lumière.', action: 'Photos', to: 'progres/corps' }]
            : []),
          ...(daysSinceBackup === null || daysSinceBackup > 7
            ? [{ icon: <Download size={18} aria-hidden />, text: daysSinceBackup === null ? 'Tes données vivent sur ce téléphone. Exporte une sauvegarde.' : `Dernière sauvegarde il y a ${daysSinceBackup} jours.`, action: 'Exporter', to: 'plus/donnees' }]
            : []),
          ...(isIOS() && !isStandalone()
            ? [{ icon: <Smartphone size={18} aria-hidden />, text: 'Installe Golgoth : Partager, puis « Sur l’écran d’accueil ».', action: 'Aide', to: 'plus/reglages' }]
            : []),
        ]}
      />
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
      {gymOpen && <GymSheet onClose={() => setGymOpen(false)} />}
    </Screen>
  )
}

function Tile({ label, value, foot, detail, chart, onClick, children }: { label: string; value: React.ReactNode; foot?: string; detail?: string; chart?: React.ReactNode; onClick?: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="pressable card flex min-h-[132px] flex-col p-3.5 text-left hover:border-line-strong">
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-text-2">{label}</span>
        {chart}
      </span>
      <span className="mt-auto pt-3 text-[28px] leading-none font-semibold tracking-[-0.03em] tnum">{value}</span>
      {children}
      {foot && <span className="mt-2 text-[12px] leading-[16px] text-muted">{foot}</span>}
      {detail && <span className="mt-0.5 text-[12px] leading-[16px] font-medium text-text-2">{detail}</span>}
    </button>
  )
}

function NutriCell({ label, value, unit, target, ratio }: { label: string; value: number; unit: string; target: string; ratio: number }) {
  return (
    <div className="p-3">
      <p className="text-[12px] font-medium text-text-2">{label}</p>
      <p className="mt-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em] tnum">
        {fmtNum(value, 0)}
        <span className="ml-0.5 text-[12px] font-medium text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted tnum">/ {target}</p>
      <ProgressBar value={ratio} className="mt-2 h-1" label={label} tone={ratio >= 1 ? 'good' : 'text'} />
    </div>
  )
}

function Reminders({ items }: { items: { icon: React.ReactNode; text: string; action: string; to: string }[] }) {
  if (!items.length) return null
  return (
    <Section title="À faire">
      <Card className="divide-y divide-line">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className={cx('shrink-0 text-text-2')}>{it.icon}</span>
            <p className="min-w-0 flex-1 text-[14px] leading-[1.4]">{it.text}</p>
            <Button size="sm" variant="soft" onClick={() => navigate(it.to)}>{it.action}</Button>
          </div>
        ))}
      </Card>
    </Section>
  )
}
