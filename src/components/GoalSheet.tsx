import { useMemo, useState } from 'react'
import { Flag, TriangleAlert } from 'lucide-react'
import { addDays, capitalize, fmtDate, shiftMonths, todayISO } from '../lib/date'
import { fmtNum, plural } from '../lib/format'
import { L } from '../lib/i18n'
import {
  buildMaintenancePeriods, buildPeriods, CUT_LENGTH, GOAL_DATE, isValidGoal, MAINTENANCE, minResumeGoal, MIN_PLAN_WEEKS, planShape, PROGRAM_START,
  projectSessions, resumeGoalFor, weekIn,
} from '../lib/program'
import { plannedWeightPath, weightStatus } from '../lib/stats'
import { caloriesForMaintenance, useStore } from '../lib/store'
import { goalApplied } from '../lib/visual'
import { PlanModePicker, type PlanMode } from './PlanMode'
import { Button, Card, DateInput, Sheet } from './ui'

/** Shortcuts relative to the date being chosen, each labelled with the date it leads to. Labels are getters: they follow the interface language. */
const STEPS: { readonly label: string; apply: (d: string) => string }[] = [
  { get label() { return L('−1 mois', '−1 mo') }, apply: (d) => shiftMonths(d, -1) },
  { get label() { return L('−2 sem.', '−2 wk') }, apply: (d) => addDays(d, -14) },
  { get label() { return L('+2 sem.', '+2 wk') }, apply: (d) => addDays(d, 14) },
  { get label() { return L('+1 mois', '+1 mo') }, apply: (d) => shiftMonths(d, 1) },
  { get label() { return L('+3 mois', '+3 mo') }, apply: (d) => shiftMonths(d, 3) },
]

/**
 * The plan's goal: a date (the plan — recomposition, cut, stabilization — is rebuilt around it)
 * or maintenance mode, with no date. Mount it only while open, so the draft starts from the
 * current plan each time.
 */
export function GoalSheet({ onClose }: { onClose: () => void }) {
  const state = useStore((s) => s.state)
  const { setGoalDate, enterMaintenance, notify } = useStore.getState()
  const today = todayISO()
  const current: PlanMode = MAINTENANCE ? 'maintenance' : 'goal'
  const [mode, setMode] = useState<PlanMode>(current)
  // Leaving maintenance, the date kept from before is offered again while it is still far enough.
  const [draft, setDraft] = useState(MAINTENANCE ? resumeGoalFor(state.settings.goalDate, today) : GOAL_DATE)
  const min = MAINTENANCE ? minResumeGoal(today) : addDays(PROGRAM_START, MIN_PLAN_WEEKS * 7)
  const okDate = (d: string) => isValidGoal(d) && d >= min
  const valid = okDate(draft)
  const preview = useMemo(() => {
    if (!valid) return null
    const shape = planShape(draft, CUT_LENGTH)
    const periods = buildPeriods(draft, CUT_LENGTH)
    const planned = projectSessions(state, draft, today).length + (state.activeWorkout ? 1 : 0)
    const ws = weightStatus(state, today)
    const start = today < PROGRAM_START ? PROGRAM_START : today
    const end = ws.current ? plannedWeightPath(start, ws.current, { periods, goal: draft }).at(-1)!.value : null
    return { shape, planned, end, stabWeeks: Math.round((new Date(draft).getTime() - new Date(shape.stabStart).getTime()) / (7 * 86_400_000)) }
  }, [draft, valid, state, today])

  const changed = mode !== current || (mode === 'goal' && draft !== GOAL_DATE)
  const save = () => {
    if (mode === 'maintenance') {
      const kcal = enterMaintenance()
      notify(
        L(
          `Mode entretien : plus de date objectif, le plan continue sans fin.${kcal ? ` Calories à ${fmtNum(kcal, 0)} kcal.` : ''}`,
          `Maintenance mode: no goal date, the plan keeps going.${kcal ? ` Calories set to ${fmtNum(kcal, 0)} kcal.` : ''}`,
        ),
        'good',
      )
    } else {
      setGoalDate(draft)
      notify(L(`Objectif fixé au ${fmtDate(draft, { long: true, year: true })} : plan recalculé.`, `Goal set to ${fmtDate(draft, { long: true, year: true })}: plan recalculated.`), 'good')
    }
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      icon={<Flag size={18} aria-hidden />}
      title={L('Objectif du programme', 'Program goal')}
      footer={<Button variant="primary" size="lg" full disabled={!changed || (mode === 'goal' && !valid)} onClick={save}>{L('Enregistrer', 'Save')}</Button>}
    >
      <PlanModePicker value={mode} onChange={setMode} />
      <div className="mt-5">
        {mode === 'maintenance' ? (
          <MaintenancePreview active={current === 'maintenance'} />
        ) : (
          <>
            <DateInput label={L('Date objectif', 'Goal date')} value={draft} min={min} max="2030-12-31" onChange={setDraft} />
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label={L('Décaler la date', 'Shift the date')}>
              {STEPS.map((step) => {
                const to = step.apply(draft)
                const ok = okDate(to)
                return (
                  <button
                    key={step.label}
                    type="button"
                    disabled={!ok}
                    onClick={() => setDraft(to)}
                    aria-label={L(`${step.label} : ${fmtDate(to, { long: true, year: true })}`, `${step.label}: ${fmtDate(to, { long: true, year: true })}`)}
                    className="pressable inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] whitespace-nowrap disabled:opacity-35"
                  >
                    <span className="font-semibold">{step.label}</span>
                    <span className="text-muted tnum">{fmtDate(to)}</span>
                  </button>
                )
              })}
            </div>

            {preview && (
              <Card className="mt-4 divide-y divide-line">
                <PlanRow label="Recomposition" value={preview.shape.recompWeeks ? plural(preview.shape.recompWeeks, L('semaine', 'week'), L('semaines', 'weeks')) : '—'} />
                <PlanRow label={L('Sèche', 'Cut')} value={plural(preview.shape.cutWeeks, L('semaine', 'week'), L('semaines', 'weeks'))} hint={L(`dès le ${fmtDate(preview.shape.cutStart, { long: true, year: true })}`, `from ${fmtDate(preview.shape.cutStart, { long: true, year: true })}`)} />
                <PlanRow label={L('Stabilisation', 'Stabilization')} value={plural(Math.max(1, preview.stabWeeks), L('semaine', 'week'), L('semaines', 'weeks'))} hint={L(`dès le ${fmtDate(preview.shape.stabStart, { long: true })}`, `from ${fmtDate(preview.shape.stabStart, { long: true })}`)} />
                <PlanRow label={L('Total de séances', 'Total workouts')} value={`${state.workouts.length + preview.planned}`} hint={L(`${state.workouts.length} faites + ${preview.planned} prévues`, `${state.workouts.length} done + ${preview.planned} planned`)} />
                {preview.end !== null && <PlanRow label={L('Poids estimé, rythme prudent', 'Estimated weight, cautious pace')} value={`${fmtNum(preview.end, 1)} kg`} hint={L('Rythmes les moins agressifs de chaque phase', 'Least aggressive pace of each phase')} />}
              </Card>
            )}
            {preview?.shape.shortCut && (
              <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                {L(
                  `Sèche de ${preview.shape.cutWeeks} semaines au lieu de ${CUT_LENGTH} : le rythme reste plafonné à −0,7 %/semaine pour garder le muscle, donc moins de gras perdu d’ici la date.`,
                  `${preview.shape.cutWeeks}-week cut instead of ${CUT_LENGTH}: the pace stays capped at −0.7%/week to keep muscle, so less fat is lost by the date.`,
                )}
              </p>
            )}
            {!valid && <p className="mt-3 text-[13px] text-bad">{L(`Choisis une date à partir du ${fmtDate(min, { long: true, year: true })}.`, `Choose a date on or after ${fmtDate(min, { long: true, year: true })}.`)}</p>}
            <p className="mt-3 text-[12px] leading-[1.45] text-muted">
              {current === 'maintenance'
                ? L(
                    'Tu quittes le mode entretien : les séances faites restent, le calendrier à venir repasse en recomposition, puis sèche et stabilisation avant la date. Choisis ensuite ton objectif visuel pour caler la sèche sur ton physique.',
                    'You leave maintenance mode: workouts already done stay, and the upcoming calendar switches to recomposition, then a cut and a stabilization before the date. Then choose your visual goal to size the cut to your physique.',
                  )
                : L(
                    `${capitalize(fmtDate(GOAL_DATE, { weekday: true, long: true, year: true }))} actuellement. Les séances faites restent, le calendrier à venir (blocs, semaines allégées, sèche) est recalculé.`,
                    `Currently ${fmtDate(GOAL_DATE, { weekday: true, long: true, year: true })}. Workouts already done stay; the upcoming calendar (blocks, deload weeks, cut) is recalculated.`,
                  )}
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}

/** What maintenance mode gives from today: this week in the plan, the next deload, the calories. */
function MaintenancePreview({ active }: { active: boolean }) {
  const state = useStore((s) => s.state)
  const today = todayISO()
  const info = useMemo(() => {
    const periods = buildMaintenancePeriods()
    const now = periods.find((p) => today >= p.start && today <= p.end && p.kind !== 'pre') ?? periods.find((p) => p.kind === 'block')!
    const deload = periods.find((p) => p.kind === 'deload' && p.end >= today)
    return { now, week: today >= now.start ? weekIn(now, today) : 1, deload, calories: active ? null : caloriesForMaintenance(state, today) }
  }, [state, today, active])
  const hadLook = goalApplied(state.visualGoal)
  return (
    <>
      <Card className="divide-y divide-line">
        <PlanRow label={L('Rythme', 'Rhythm')} value={L('5 sem. + 1 allégée', '5 wk + deload week')} hint={L('Les blocs se suivent sans fin, fêtes à volume réduit. Pas de sèche.', 'Blocks follow one another with no end, holidays at reduced volume. No cut.')} />
        <PlanRow
          label={L('Cette semaine', 'This week')}
          value={info.now.kind === 'block' ? L(`${info.now.label} · S${info.week}`, `${info.now.label} · W${info.week}`) : info.now.label}
        />
        {info.deload && <PlanRow label={L('Prochaine semaine allégée', 'Next deload week')} value={fmtDate(info.deload.start, { long: true })} />}
        <PlanRow
          label="Calories"
          value={info.calories ? `${fmtNum(info.calories, 0)} kcal` : `${fmtNum(state.nutritionTargets.calories, 0)} kcal`}
          hint={info.calories ? L('Maintenance estimée : fin de la sèche', 'Estimated maintenance: the cut ends') : L('Ajustées sur ta moyenne 7 jours pour un poids stable', 'Adjusted to your 7-day average for a stable weight')}
        />
      </Card>
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {active
          ? L('Mode entretien actif. Choisis « Date objectif » pour viser un physique à une date : le plan repassera en recomposition, sèche puis stabilisation.', 'Maintenance mode is on. Choose “Goal date” to aim for a physique by a date: the plan switches back to recomposition, cut, then stabilization.')
          : L(
              `Ta date du ${fmtDate(GOAL_DATE, { long: true, year: true })} est gardée pour plus tard. Les séances faites restent.${hadLook ? ' L’objectif visuel est mis de côté (poids cible, sèche) ; ses zones prioritaires restent.' : ''}`,
              `Your ${fmtDate(GOAL_DATE, { long: true, year: true })} date is kept for later. Workouts already done stay.${hadLook ? ' The visual goal is set aside (target weight, cut); its priority areas stay.' : ''}`,
            )}
      </p>
    </>
  )
}

function PlanRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <span className="ml-auto max-w-full text-right text-[14px] font-semibold tnum">{value}</span>
    </div>
  )
}
