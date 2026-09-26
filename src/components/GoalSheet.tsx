import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { addDays, capitalize, fmtDate, todayISO } from '../lib/date'
import { fmtNum, plural } from '../lib/format'
import {
  buildPeriods, CUT_WEEKS, DEFAULT_GOAL, GOAL_DATE, isValidGoal, MIN_PLAN_WEEKS, planShape, PROGRAM_START, projectSessions,
} from '../lib/program'
import { plannedWeightPath, weightStatus } from '../lib/stats'
import { useStore } from '../lib/store'
import { Button, Card, cx, DateInput, Sheet } from './ui'

const PRESETS: { date: string; label: string }[] = [
  { date: '2027-05-31', label: 'Fin mai 2027' },
  { date: '2027-06-30', label: '30 juin 2027' },
  { date: '2027-07-31', label: 'Fin juillet 2027' },
  { date: '2027-08-31', label: 'Fin août 2027' },
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
    const shape = planShape(draft)
    const periods = buildPeriods(draft)
    const planned = projectSessions(state, draft, today).length + (state.activeWorkout ? 1 : 0)
    const ws = weightStatus(state, today)
    const start = today < PROGRAM_START ? PROGRAM_START : today
    const end = ws.current ? plannedWeightPath(start, ws.current, { periods, goal: draft }).at(-1)!.value : null
    return { shape, planned, end, stabWeeks: Math.round((new Date(draft).getTime() - new Date(shape.stabStart).getTime()) / (7 * 86_400_000)) }
  }, [draft, valid, state, today])

  const changed = draft !== GOAL_DATE
  const save = () => {
    setGoalDate(draft)
    useStore.getState().notify(`Objectif fixé au ${fmtDate(draft, { long: true, year: true })} : plan recalculé.`, 'good')
    onClose()
  }

  return (
    <SheetShell onClose={onClose} footer={
      <div className="flex gap-2">
        {GOAL_DATE !== DEFAULT_GOAL && draft !== DEFAULT_GOAL && (
          <Button variant="outline" size="lg" onClick={() => setDraft(DEFAULT_GOAL)}>30 juin 2027</Button>
        )}
        <Button variant="primary" size="lg" className="flex-1" disabled={!valid || !changed} onClick={save}>Enregistrer</Button>
      </div>
    }>
      <DateInput label="Date objectif" value={draft} min={min} max="2030-12-31" onChange={setDraft} />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {PRESETS.filter((p) => isValidGoal(p.date)).map((p) => (
          <button
            key={p.date}
            type="button"
            aria-pressed={draft === p.date}
            onClick={() => setDraft(p.date)}
            className={cx('pressable h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap', draft === p.date ? 'border-text bg-text text-bg' : 'border-line-strong text-text-2')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preview && (
        <Card className="mt-4 divide-y divide-line">
          <PlanRow label="Recomposition" value={preview.shape.recompWeeks ? plural(preview.shape.recompWeeks, 'semaine', 'semaines') : '—'} />
          <PlanRow label="Sèche" value={plural(preview.shape.cutWeeks, 'semaine', 'semaines')} hint={`dès le ${fmtDate(preview.shape.cutStart, { long: true, year: true })}`} />
          <PlanRow label="Stabilisation" value={plural(Math.max(1, preview.stabWeeks), 'semaine', 'semaines')} hint={`dès le ${fmtDate(preview.shape.stabStart, { long: true })}`} />
          <PlanRow label="Séances d’ici là" value={`${state.workouts.length + preview.planned}`} hint={`${state.workouts.length} faites + ${preview.planned} prévues`} />
          {preview.end !== null && <PlanRow label="Poids visé au plus prudent" value={`${fmtNum(preview.end, 1)} kg`} hint="Rythmes les moins agressifs de chaque phase" />}
        </Card>
      )}
      {preview?.shape.shortCut && (
        <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          Sèche de {preview.shape.cutWeeks} semaines au lieu de {CUT_WEEKS} : le rythme reste plafonné à −0,7 %/semaine pour garder le muscle, donc moins de gras perdu d’ici la date.
        </p>
      )}
      {!valid && <p className="mt-3 text-[13px] text-bad">Choisis une date après le {fmtDate(min, { long: true, year: true })}.</p>}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {capitalize(fmtDate(GOAL_DATE, { weekday: true, long: true, year: true }))} actuellement. Les séances faites restent, le calendrier à venir (blocs, décharges, sèche) est recalculé.
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
    <Sheet open onClose={onClose} title="Date objectif" footer={footer}>
      {children}
    </Sheet>
  )
}
