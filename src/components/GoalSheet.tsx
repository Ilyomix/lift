import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { addDays, capitalize, fmtDate, shiftMonths, todayISO } from '../lib/date'
import { fmtNum, plural } from '../lib/format'
import { L } from '../lib/i18n'
import {
  buildPeriods, CUT_LENGTH, GOAL_DATE, isValidGoal, MIN_PLAN_WEEKS, planShape, PROGRAM_START, projectSessions,
} from '../lib/program'
import { plannedWeightPath, weightStatus } from '../lib/stats'
import { useStore } from '../lib/store'
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
 * Changes the goal date: the plan (recomposition, cut, stabilization) is rebuilt around it.
 * Mount it only while open, so the draft starts from the current goal each time.
 */
export function GoalSheet({ onClose }: { onClose: () => void }) {
  const state = useStore((s) => s.state)
  const setGoalDate = useStore((s) => s.setGoalDate)
  const [draft, setDraft] = useState(GOAL_DATE)
  const today = todayISO()
  const min = addDays(PROGRAM_START, MIN_PLAN_WEEKS * 7)
  const valid = isValidGoal(draft)
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

  const changed = draft !== GOAL_DATE
  const save = () => {
    setGoalDate(draft)
    useStore.getState().notify(L(`Objectif fixé au ${fmtDate(draft, { long: true, year: true })} : plan recalculé.`, `Goal set to ${fmtDate(draft, { long: true, year: true })}: plan recalculated.`), 'good')
    onClose()
  }

  return (
    <SheetShell onClose={onClose} footer={
      <div className="flex gap-2">
        <Button variant="primary" size="lg" className="flex-1" disabled={!valid || !changed} onClick={save}>{L('Enregistrer', 'Save')}</Button>
      </div>
    }>
      <DateInput label={L('Date objectif', 'Goal date')} value={draft} min={min} max="2030-12-31" onChange={setDraft} />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label={L('Décaler la date', 'Shift the date')}>
        {STEPS.map((step) => {
          const to = step.apply(draft)
          const ok = isValidGoal(to)
          return (
            <button
              key={step.label}
              type="button"
              disabled={!ok}
              onClick={() => setDraft(to)}
              aria-label={L(`${step.label} : ${fmtDate(to, { long: true, year: true })}`, `${step.label}: ${fmtDate(to, { long: true, year: true })}`)}
              className="pressable inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] whitespace-nowrap disabled:opacity-35"
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
          <PlanRow label={L('Séances d’ici là', 'Sessions until then')} value={`${state.workouts.length + preview.planned}`} hint={L(`${state.workouts.length} faites + ${preview.planned} prévues`, `${state.workouts.length} done + ${preview.planned} planned`)} />
          {preview.end !== null && <PlanRow label={L('Poids visé au plus prudent', 'Target weight, most cautious case')} value={`${fmtNum(preview.end, 1)} kg`} hint={L('Rythmes les moins agressifs de chaque phase', 'Least aggressive pace of each phase')} />}
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
      {!valid && <p className="mt-3 text-[13px] text-bad">{L(`Choisis une date après le ${fmtDate(min, { long: true, year: true })}.`, `Pick a date after ${fmtDate(min, { long: true, year: true })}.`)}</p>}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {L(
          `${capitalize(fmtDate(GOAL_DATE, { weekday: true, long: true, year: true }))} actuellement. Les séances faites restent, le calendrier à venir (blocs, décharges, sèche) est recalculé.`,
          `Currently ${fmtDate(GOAL_DATE, { weekday: true, long: true, year: true })}. Sessions already done stay; the upcoming calendar (blocks, deloads, cut) is recalculated.`,
        )}
      </p>
    </SheetShell>
  )
}

function PlanRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <span className="shrink-0 text-[14px] font-semibold tnum">{value}</span>
    </div>
  )
}

function SheetShell({ onClose, footer, children }: { onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <Sheet open onClose={onClose} title={L('Date objectif', 'Goal date')} footer={footer}>
      {children}
    </Sheet>
  )
}
