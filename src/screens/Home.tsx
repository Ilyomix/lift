import { useMemo, useState } from 'react'
import { Apple, ArrowRight, Camera, ChevronDown, CirclePause, Download, Flag, Infinity as InfinityIcon, MapPin, Pencil, Play, Scale, Smartphone, TriangleAlert } from 'lucide-react'
import { addDays, capitalize, diffDays, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, fmtSigned, plural } from '../lib/format'
import { gymOf, isGymBound, placeName } from '../lib/gyms'
import { L } from '../lib/i18n'
import {
  contextAt, GOAL_DATE, pauseDays, prescribeSession, projectSessions, PROGRAM_START, sessionMinutes, sessionPlan, trainingDays, TYPE_META,
} from '../lib/program'
import { navigate } from '../lib/router'
import { isIOS, isStandalone } from '../lib/share'
import {
  calorieAdvice, goalWeightRange, measureSeries, movingAverage7, nutritionFor, proteinTargetFor, recentPace, sessionsThisWeek, weekStrip, weightStatus,
} from '../lib/stats'
import { useStore } from '../lib/store'
import { dropAlert, doneSets, sessionPace, strengthSummary } from '../lib/training'
import { Sparkline } from '../components/charts'
import { GoalSheet } from '../components/GoalSheet'
import { GymSheet } from '../components/GymSheet'
import { SessionTrack, WeekStrip } from '../components/Program'
import { Button, Card, cx, Num, ProgressBar, Screen, Section, Tag } from '../components/ui'
import { AppIcon } from './Onboarding'
import { workoutArt } from '../components/SportArt'
import { cutDrift, lookInfo, goalApplied } from '../lib/visual'

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
  // The cut was sized when the goal was applied: say so when today's weight asks for another length.
  const drift = useMemo(() => cutDrift(state, today), [state, today])
  const lastWorkout = state.workouts[state.workouts.length - 1]
  const drops = !state.prefs.autoLoad && lastWorkout ? lastWorkout.exercises.filter((e) => !e.skipped).map((e) => dropAlert(state.workouts, e.exerciseId, isGymBound(e) ? gymOf(lastWorkout) : undefined, e.target)).filter((x): x is string => !!x) : []
  const earlyDeload = state.manualDeload && today <= state.manualDeload.end ? state.manualDeload : null
  const lastPhoto = photos[photos.length - 1]
  const daysSinceBackup = state.meta.lastBackupAt ? Math.floor((Date.now() - new Date(state.meta.lastBackupAt).getTime()) / 86_400_000) : null
  const weeksLeft = Math.max(0, Math.ceil(diffDays(today, GOAL_DATE) / 7))
  // Maintenance mode: no goal, the hero follows the current cycle (a block and its deload).
  const cycle = plan.cycle
  const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0

  const nextType = active?.type ?? next?.type ?? state.nextWorkoutType
  const nextDate = next?.date ?? today
  const nextCtx = contextAt(nextDate < PROGRAM_START ? PROGRAM_START : nextDate)
  const nextSets = prescribeSession(state.templates[nextType].exercises, nextCtx.date, state.reentry, undefined, state.workouts).reduce((a, p) => a + p.sets, 0)
  const nextMinutes = sessionMinutes(nextType, nextSets, sessionPace(state.workouts, nextType))

  const begin = () => {
    startSession(nextType)
    navigate('seance')
  }

  return (
    <Screen>
      <header className="pt-2 pb-2">
        <h1 className="inline-flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.02em]">
          <AppIcon size={24} className="rounded-[6px]" />
          Lift
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-text-2">{capitalize(fmtDate(today, { weekday: true, long: true }))}</p>
      </header>

      <section aria-label={cycle ? L('Progression du cycle en cours', 'Progress through the current cycle') : L('Progression vers l’objectif', 'Progress toward the goal')} className="mt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <p className="flex min-w-0 items-baseline gap-x-2 whitespace-nowrap tnum">
            <span className="text-[48px] leading-none font-semibold tracking-[-0.04em] min-[360px]:text-[64px]"><Num value={plan.done} digits={0} className="[--number-flow-mask-height:0.08em]" /></span>
            <span className="text-[18px] leading-none font-medium text-text-2 min-[360px]:text-[22px]">/ {plan.total}</span>
            <span className="text-[12px] leading-5 text-text-2 min-[360px]:text-[13px]">{L(plan.done === 1 ? 'séance terminée' : 'séances terminées', plan.done === 1 ? 'session completed' : 'sessions completed')}</span>
          </p>
          <p className="ml-auto shrink-0 text-[22px] leading-none font-semibold tnum">{L(`${pct} %`, `${pct}%`)}</p>
        </div>
        <div className="mt-3"><SessionTrack plan={plan} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <button type="button" className="pressable -ml-2 inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 py-1 text-left hover:bg-surface-2" onClick={() => setGoalOpen(true)}
            aria-label={cycle ? L('Mode entretien, sans date objectif, modifier', 'Maintenance mode, no goal date, edit') : L(`Objectif le ${fmtDate(GOAL_DATE, { long: true, year: true })}, modifier`, `Goal date ${fmtDate(GOAL_DATE, { long: true, year: true })}, edit`)}
          >
            {cycle ? <InfinityIcon size={18} className="shrink-0 text-signal-text" aria-hidden /> : <Flag size={18} className="shrink-0 text-signal-text" aria-hidden />}
            <span>
              <span className="flex items-center gap-2 text-[13px] leading-5 font-semibold">{cycle ? L('Entretien', 'Maintenance') : fmtDate(GOAL_DATE, { long: true, year: true })}<Pencil size={12} className="text-muted" aria-hidden /></span>
              <span className="block text-[12px] leading-[18px] text-text-2 tnum">{cycle ? L(`Cycle jusqu’au ${fmtDate(cycle.end)}`, `Cycle until ${fmtDate(cycle.end)}`) : ctx.after ? L('Programme terminé', 'Program complete') : plural(weeksLeft, L('semaine restante', 'week left'), L('semaines restantes', 'weeks left'))}</span>
            </span>
          </button>
          <Button variant="ghost" size="sm" className="-mr-2 px-2" onClick={() => navigate('calendrier/programme')} aria-label={L('Voir le programme', 'View program')}>
            {L('Programme', 'Program')}<ArrowRight size={16} aria-hidden />
          </Button>
        </div>
      </section>

      {state.programPause.active && (
        <Card className="mt-6 flex items-center gap-3 p-4">
          <CirclePause size={20} className="shrink-0 text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{L('Programme en pause', 'Program paused')}</p>
            <p className="text-[13px] text-text-2">
              {L('Depuis', 'Started')} {state.programPause.startedAt ? fmtRelativeDay(state.programPause.startedAt.slice(0, 10), today) : '—'}
              {state.programPause.plannedEnd ? L(` · reprise ${fmtRelativeDay(addDays(state.programPause.plannedEnd, 1), today)}`, ` · back ${fmtRelativeDay(addDays(state.programPause.plannedEnd, 1), today)}`) : ''}
            </p>
          </div>
          <Button size="sm" variant="ink" onClick={() => navigate('plus/pause')}>{L('Gérer', 'Manage')}</Button>
        </Card>
      )}

      {state.reentry && (
        <Card className="mt-3 p-4">
          <p className="text-[15px] font-semibold">{state.reentry.label}</p>
          <p className="mt-1 text-[13px] leading-[1.45] text-text-2">{state.reentry.advice} {L(`Encore ${plural(state.reentry.sessionsLeft, 'séance', 'séances')}.`, `${plural(state.reentry.sessionsLeft, 'more session', 'more sessions')}.`)}</p>
        </Card>
      )}

      {/* Next action — the one primary command of the screen */}
      <Section art={workoutArt[nextType]} title={active ? L('Séance en cours', 'Session in progress') : L('Prochaine séance', 'Next session')}>
        <Card className="overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[26px] leading-none font-semibold tracking-[-0.03em]">{TYPE_META[nextType].label}</p>
                <p className="mt-1.5 text-[14px] text-text-2">
                  {TYPE_META[nextType].fr} · {active ? `${active.exercises.reduce((a, e) => a + doneSets(e).length, 0)} / ${active.exercises.reduce((a, e) => a + e.sets.length, 0)} ${L('séries', 'sets')}` : `${L(`${nextSets} séries`, plural(nextSets, 'set', 'sets'))} · ~${nextMinutes} min`}
                </p>
              </div>
              <Tag tone="outline">{active ? L('En cours', 'In progress') : capitalize(fmtRelativeDay(nextDate, today))}</Tag>
            </div>
            {!active && nextCtx.effort && <p className="mt-3 text-[13px] text-muted">{nextCtx.title} · {nextCtx.effort}</p>}
            {!active && (
              <button type="button" onClick={() => setGymOpen(true)} className="pressable -mx-1 mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-1 text-[13px] font-medium text-text-2 hover:text-text">
                <MapPin size={14} aria-hidden />
                {placeName(state, state.gymId)}
                <ChevronDown size={14} className="text-muted" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <Button variant="primary" size="lg" className="flex-1" icon={<Play size={18} aria-hidden />} onClick={active ? () => navigate('seance') : begin}>
              {active ? L('Reprendre', 'Resume') : L('Commencer', 'Start')}
            </Button>
            {!active && (
              <Button variant="outline" size="lg" onClick={() => navigate('seance')} aria-label={L('Voir le détail de la séance', 'View session details')}>
                {L('Détail', 'Details')}
              </Button>
            )}
          </div>
        </Card>
      </Section>

      <Section art="calendar" title={L('Cette semaine', 'This week')} action={<span className="text-[13px] text-text-2 tnum">{doneThisWeek} / {perWeek} {L('séances', 'sessions')}</span>}>
        <WeekStrip days={week} />
      </Section>

      <Section art="trophy" title={L('Objectifs', 'Goals')} action={<Button variant="ghost" onClick={() => navigate('progres')}>{L('Progrès', 'Progress')} <ArrowRight size={16} aria-hidden /></Button>}>
        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            label={L('Poids', 'Weight')}
            value={ws.current !== null ? <><Num value={ws.current} digits={1} /><span className="ml-0.5 text-[15px] font-medium text-text-2">kg</span></> : '—'}
            foot={ws.current === null ? L('Ajoute une pesée', 'Add a weigh-in') : ws.isAverage && !ws.stale ? L('Moyenne 7 jours', '7-day average') : L(`Pesée ${fmtRelativeDay(ws.currentDate!, today)}`, `Weighed ${fmtRelativeDay(ws.currentDate!, today)}`)}
            detail={goal ? `${L('Cible', 'Target')} ${fmtNum(goal.min, 0)}–${fmtNum(goal.max, 0)} kg${goalApplied(state.visualGoal) ? ` · ${lookInfo(state.visualGoal.look).label}` : ''}` : undefined}
            chart={ma.length > 1 ? <Sparkline values={ma} /> : undefined}
            onClick={() => navigate('progres/corps')}
          />
          <Tile
            label={L('Tour de taille', 'Waist')}
            value={waist.length ? <><Num value={waist[waist.length - 1].value} digits={1} /><span className="ml-0.5 text-[15px] font-medium text-text-2">cm</span></> : '—'}
            foot={waist.length ? L(`Mesuré ${fmtRelativeDay(waist[waist.length - 1].date, today)}`, `Measured ${fmtRelativeDay(waist[waist.length - 1].date, today)}`) : L('Toutes les 2 semaines', 'Every 2 weeks')}
            detail={waist.length > 1 ? L(`${fmtSigned(waist[waist.length - 1].value - waist[0].value, 1, 'cm')} depuis le début`, `${fmtSigned(waist[waist.length - 1].value - waist[0].value, 1, 'cm')} since the start`) : state.goals.targetWaist ? `${L('Cible', 'Target')} ${fmtNum(state.goals.targetWaist)} cm` : L('À jeun, même point', 'Fasted, same spot')}
            onClick={() => navigate('progres/corps')}
          />
          <Tile
            label={L('Régularité', 'Consistency')}
            value={<><Num value={pace} digits={1} /><span className="ml-1 text-[15px] font-medium text-text-2">{L('/ sem.', '/ wk')}</span></>}
            foot={L('4 dernières semaines', 'Last 4 weeks')}
            detail={L(`Plan : ${perWeek} par semaine`, `Plan: ${perWeek} per week`)}
            onClick={() => navigate('progres/seances')}
          >
            <ProgressBar value={pace / Math.max(1, perWeek)} className="mt-2" label={L('Séances par semaine par rapport au plan', 'Sessions per week compared with the plan')} tone={pace >= perWeek - 0.25 ? 'good' : 'text'} />
          </Tile>
          <Tile
            label={L('Force', 'Strength')}
            value={strength.avg !== null ? <Num value={strength.avg * 100} digits={0} suffix={L(' %', '%')} signed /> : '—'}
            foot={strength.avg !== null ? L(`1RM estimé · ${plural(strength.lifts, 'exercice', 'exercices')}`, `Estimated 1RM · ${plural(strength.lifts, 'exercise', 'exercises')}`) : L('Après 2 séances par exercice', 'After 2 sessions per exercise')}
            detail={strength.records ? L(`${plural(strength.records, 'record', 'records')} en 30 jours`, `${plural(strength.records, 'record', 'records')} in 30 days`) : undefined}
            onClick={() => navigate('progres')}
          />
        </div>
      </Section>

      <Section art="nutrition" title={L('Nutrition du jour', 'Today’s nutrition')} action={<Button variant="ghost" onClick={() => navigate('plus/nutrition')}>{L('Saisir', 'Log')}</Button>}>
        <Card className="grid grid-cols-3 divide-x divide-line overflow-hidden">
          <NutriCell label={L('Protéines', 'Protein')} value={nut.protein} unit="g" target={`${protein.min}–${protein.max}`} ratio={nut.protein / protein.min} />
          <NutriCell label="Calories" value={nut.calories} unit="kcal" target={`${state.nutritionTargets.calories}`} ratio={nut.calories / state.nutritionTargets.calories} />
          <NutriCell label={L('Créatine', 'Creatine')} value={nut.creatine} unit="g" target={`${state.nutritionTargets.creatine}`} ratio={nut.creatine / Math.max(1, state.nutritionTargets.creatine)} />
        </Card>
      </Section>

      <Reminders
        items={[
          // An early deload still ahead or running can be called off: the plan goes back to its calendar.
          ...(earlyDeload
            ? [{
                icon: <CirclePause size={18} aria-hidden />,
                text: L(`Décharge avancée : du ${fmtDate(earlyDeload.start, { long: true })} au ${fmtDate(earlyDeload.end, { long: true })}.`, `Deload brought forward: ${fmtDate(earlyDeload.start, { long: true })} to ${fmtDate(earlyDeload.end, { long: true })}.`),
                action: L('Annuler', 'Cancel'),
                run: () => { useStore.getState().cancelEarlyDeload(); useStore.getState().notify(L('Décharge avancée annulée : le plan reprend son calendrier.', 'Early deload cancelled: the plan is back on its calendar.')) },
              }]
            : []),
          ...drops.map((d) => ({ icon: <TriangleAlert size={18} className="text-warn" aria-hidden />, text: d, action: L('Programme', 'Program'), to: 'calendrier/programme' })),
          ...(cal.status === 'lower' || cal.status === 'raise'
            ? [{ icon: <Apple size={18} aria-hidden />, text: L(`${cal.headline} : ${cal.target} kcal conseillées (${cal.delta > 0 ? '+' : '−'}${Math.abs(cal.delta)}).`, `${cal.headline}: ${cal.target} kcal recommended (${cal.delta > 0 ? '+' : '−'}${Math.abs(cal.delta)}).`), action: L('Voir', 'View'), to: 'plus/nutrition' }]
            : []),
          // The sized step of the cut waits for an answer, on the nutrition screen.
          ...(cal.status === 'ask'
            ? [{ icon: <Apple size={18} aria-hidden />, text: L(`${cal.headline} : une question avant de régler tes calories.`, `${cal.headline}: one question before setting your calories.`), action: L('Voir', 'View'), to: 'plus/nutrition' }]
            : []),
          ...(drift
            ? [{
                icon: <Flag size={18} aria-hidden />,
                text: drift.needed === 0
                  ? L(`Ton dernier tour de taille te place déjà dans ton objectif : la sèche de ${drift.planned} semaines n’est plus nécessaire. Mets ton objectif à jour.`, `Your latest waist measurement already puts you at your goal: the cut of ${drift.planned} weeks is no longer needed. Update your goal.`)
                  : drift.planned === 0
                    ? L(`Ton dernier tour de taille demande ${drift.needed} semaines de sèche, le plan n’en prévoit pas : mets ton objectif à jour.`, `Your latest waist measurement calls for a cut of ${drift.needed} weeks, the plan has none: update your goal.`)
                    : drift.needed > drift.planned
                      ? L(`Ton dernier tour de taille demande ${drift.needed} semaines de sèche, le plan en prévoit ${drift.planned} : mets ton objectif à jour.`, `Your latest waist measurement calls for a cut of ${drift.needed} weeks, the plan has ${drift.planned}: update your goal.`)
                      : L(`Ton dernier tour de taille ne demande plus que ${drift.needed} semaines de sèche, le plan en prévoit ${drift.planned} : mets ton objectif à jour.`, `Your latest waist measurement now calls for a cut of ${drift.needed} weeks, the plan has ${drift.planned}: update your goal.`),
                action: L('Objectif', 'Goal'), to: 'plus/objectif',
              }]
            : []),
          ...(ws.daysSinceLast === null || ws.daysSinceLast >= 2
            ? [{ icon: <Scale size={18} aria-hidden />, text: ws.daysSinceLast === null ? L('Aucune pesée : la moyenne sur 7 jours guide tes calories.', 'No weigh-ins yet: the 7-day average guides your calories.') : L(`Dernière pesée il y a ${ws.daysSinceLast} jours. Pèse-toi chaque matin, à jeun.`, `Last weigh-in ${ws.daysSinceLast} days ago. Weigh yourself every morning, fasted.`), action: L('Peser', 'Weigh in'), to: 'progres/corps/mesure' }]
            : []),
          ...(!lastPhoto || (Date.now() - new Date(lastPhoto.date).getTime()) / 86_400_000 > 28
            ? [{ icon: <Camera size={18} aria-hidden />, text: L('Photos de progression : une série toutes les 4 semaines, même lumière.', 'Progress photos: one set every 4 weeks, same lighting.'), action: 'Photos', to: 'progres/corps' }]
            : []),
          ...(daysSinceBackup === null || daysSinceBackup > 7
            ? [{ icon: <Download size={18} aria-hidden />, text: daysSinceBackup === null ? L('Tes données vivent sur ce téléphone. Exporte une sauvegarde.', 'Your data lives on this phone. Export a backup.') : L(`Dernière sauvegarde il y a ${daysSinceBackup} jours.`, `Last backup ${daysSinceBackup} days ago.`), action: L('Exporter', 'Export'), to: 'plus/donnees' }]
            : []),
          ...(isIOS() && !isStandalone()
            ? [{ icon: <Smartphone size={18} aria-hidden />, text: L('Installe Lift : Partager, puis « Sur l’écran d’accueil ».', 'Install Lift: Share, then “Add to Home Screen”.'), action: L('Aide', 'Help'), to: 'plus/a-propos' }]
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
    <div className="min-w-0 p-3">
      <p className="text-[12px] font-medium text-text-2">{label}</p>
      <p className="mt-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em] text-text tnum">
        {fmtNum(value, 0)}
        <span className="ml-0.5 text-[12px] font-medium text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted tnum">/ {target}</p>
      <ProgressBar value={ratio} className="mt-2 h-1" label={label} tone="signal" />
    </div>
  )
}

/** A reminder leads to a screen (`to`), or acts on the spot (`run`). */
function Reminders({ items }: { items: { icon: React.ReactNode; text: string; action: string; to?: string; run?: () => void }[] }) {
  if (!items.length) return null
  return (
    <Section art="calendar" title={L('À faire', 'To do')}>
      <Card className="divide-y divide-line">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className={cx('shrink-0 text-text-2')}>{it.icon}</span>
            <p className="min-w-0 flex-1 text-[14px] leading-[1.4]">{it.text}</p>
            <Button size="sm" variant="soft" onClick={() => (it.run ? it.run() : it.to !== undefined && navigate(it.to))}>{it.action}</Button>
          </div>
        ))}
      </Card>
    </Section>
  )
}
