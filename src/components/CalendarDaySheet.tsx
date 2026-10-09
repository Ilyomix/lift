import { useState } from 'react'
import { CalendarDays, ChevronRight, CirclePause, Play, X } from 'lucide-react'
import { capitalize, fmtDate, todayISO } from '../lib/date'
import { fmtRest, plural } from '../lib/format'
import { L } from '../lib/i18n'
import { scheduledExercises } from '../lib/exerciseReplacement'
import { postponedFor } from '../lib/postponed'
import { contextAt, isPausedDay, isRestDay, prescribeSession, projectSessions, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import type { ISODate, WorkoutType } from '../lib/types'
import { canEditWeekSchedule, WeekScheduleSheet } from './WeekScheduleSheet'
import { ExerciseSheet } from './ExerciseSheet'
import { reserveLabel } from './EffortGuidance'
import { Button, Empty, Sheet, SheetAction, Tag } from './ui'

export function CalendarDaySheet({ date, onClose, planned: projection, onStart }: { date: ISODate; onClose: () => void; planned: ReturnType<typeof projectSessions>; onStart: (type: WorkoutType) => void }) {
  const state = useStore((s) => s.state)
  const [weekOpen, setWeekOpen] = useState(false)
  const [exercise, setExercise] = useState<number | null>(null)
  const planned = projection.find(item => item.date === date)
  const own = planned ? scheduledExercises(state, planned.type, date, projection) : []
  // Exercises moved from an earlier workout join the next one only.
  const carried = planned && projection[0] === planned && !state.activeWorkout ? postponedFor(state, date, own) : []
  const exercises = [...own, ...carried.map(c => c.exercise)]
  const prescriptions = prescribeSession(exercises, date, state.reentry, state.gymId, state.workouts)
  if (weekOpen) return <WeekScheduleSheet weekDate={date} onClose={() => setWeekOpen(false)} />
  if (exercise !== null && exercises[exercise]) return <ExerciseSheet open exerciseId={exercises[exercise].exerciseId} name={exercises[exercise].name} prescription={prescriptions[exercise]} onClose={() => setExercise(null)} />
  const today = todayISO()
  const done = state.workouts.filter((w) => w.date === date)
  const active = state.activeWorkout?.date === date ? state.activeWorkout : null
  const rest = isRestDay(state, date, today)
  const p = state.programPause
  const paused = isPausedDay(state, date, today)
  const ctx = contextAt(date)
  return (
    <Sheet icon={<CalendarDays size={18} aria-hidden />} open onClose={onClose} title={capitalize(fmtDate(date, { weekday: true, long: true, year: true }))}>
      <SheetAction>{close => <>
      {planned && !active && !done.length && !paused && <div className="flex flex-wrap items-center gap-2">
        {ctx.period && <Tag tone="ink">{ctx.title}</Tag>}
        {ctx.phase && <Tag tone="outline">{ctx.phase.short}</Tag>}
      </div>}
      {active && <div className="mt-4">
        <p className="text-[15px] font-semibold">{TYPE_META[active.type].label} · {active.reopened ? L('Modification en cours', 'Editing workout') : L('Séance en cours', 'Workout in progress')}</p>
        <Button variant="primary" size="lg" full className="mt-3" icon={<Play size={18} aria-hidden />} closeSheet onClick={() => { onClose(); navigate('seance') }}>{active.reopened ? L('Reprendre les modifications', 'Continue editing') : L('Reprendre la séance', 'Resume workout')}</Button>
      </div>}
      {done.length > 0 ? (
        <div className="mt-4 space-y-2">
          {done.map((w) => (
            <button key={w.id} type="button" onClick={() => close(() => { onClose(); navigate(`seance/${w.id}`) })} className="pressable card flex w-full items-center justify-between p-4 text-left hover:border-line-strong">
              <span>
                <span className="block text-[15px] font-semibold">{TYPE_META[w.type].label} · {L('n°', '#')}{w.sessionNumber}</span>
                <span className="text-[13px] text-text-2">{L(`${w.exercises.filter((e) => !e.skipped).length} exercices`, plural(w.exercises.filter((e) => !e.skipped).length, 'exercise', 'exercises'))}</span>
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden />
            </button>
          ))}
        </div>
      ) : active ? null : planned ? (
        <div className="mt-4">
          {paused && <p className="mb-2 text-[13px] text-text-2">{L('Programme en pause : cette séance reste provisoire.', 'Program paused: this workout remains tentative.')}</p>}
          <p className="text-[15px]"><span className="font-semibold">{TYPE_META[planned.type].label}</span> {L('prévue', 'planned')} {planned.tentative ? L('(si reprise du programme)', '(if the program resumes)') : ''}</p>
          <ol className="mt-3 divide-y divide-line rounded-[12px] border border-line">
            {exercises.map((item, index) => {
              const rx = prescriptions[index]
              const moved = carried[index - own.length]?.item
              return <li key={`${item.exerciseId}-${index}`}>
                <button type="button" onClick={() => close(() => setExercise(index))} className="pressable flex w-full items-center gap-3 px-3 py-3.5 text-left hover:bg-surface-2" aria-label={L(`Voir la technique : ${item.name}`, `View technique: ${item.name}`)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-5 font-medium">{item.name}</span>
                    <span className="mt-1 block text-[13px] leading-5 text-text-2">{rx.sets} × {rx.minReps}–{rx.maxReps} · {reserveLabel(rx.rir)} · {fmtRest(rx.restSeconds)}</span>
                    {moved && <span className="mt-1 block text-[12px] font-medium text-signal-text">{L(`Reporté de ${TYPE_META[moved.fromType].label} (${fmtDate(moved.fromDate)})`, `Moved from ${TYPE_META[moved.fromType].label} (${fmtDate(moved.fromDate)})`)}</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            })}
          </ol>
          {date === today && !state.activeWorkout && !paused && (
            <Button variant="primary" size="lg" full className="mt-4" icon={<Play size={18} aria-hidden />} closeSheet onClick={() => { onClose(); onStart(planned.type) }}>{L('Commencer maintenant', 'Start now')}</Button>
          )}
        </div>
      ) : paused ? (
        <Empty art="pause" title={p.active && date >= today ? L('Programme en pause', 'Program paused') : L('Pause enregistrée', 'Recorded pause')} action={p.active ? <Button icon={<CirclePause size={18} aria-hidden />} closeSheet onClick={() => { onClose(); navigate('plus/pause') }}>{L('Gérer la pause', 'Manage pause')}</Button> : <Button icon={<X size={18} aria-hidden />} closeSheet onClick={onClose}>{L('Fermer', 'Close')}</Button>}>
          {date < today || !p.active ? L('Cette date fait partie d’une pause enregistrée.', 'This date is part of a recorded pause.') : p.plannedEnd ? L(`La pause est prévue jusqu’au ${fmtDate(p.plannedEnd, { long: true })} inclus.`, `The pause is planned through ${fmtDate(p.plannedEnd, { long: true })}, inclusive.`) : L('Aucune date de reprise n’est fixée. Les séances à venir restent provisoires.', 'No return date is set. Upcoming workouts remain tentative.')}
        </Empty>
      ) : (
        <Empty art={rest ? 'pause' : 'calendar'} title={rest ? L('Jour de repos', 'Rest day') : date < today ? L('Aucune séance ce jour-là', 'No workout that day') : L('Aucune séance prévue', 'No workout planned')} action={<Button icon={<X size={18} aria-hidden />} closeSheet onClick={onClose}>{L('Fermer', 'Close')}</Button>}>
          {rest ? L('Ce jour est réservé à la récupération dans ton rythme de la semaine.', 'This is a recovery day in your weekly schedule.') : date < today ? L('Aucune séance n’a été enregistrée à cette date.', 'No workout was recorded on this date.') : L('Aucune séance n’est prévue à cette date.', 'No workout is planned for this date.')}
        </Empty>
      )}
      {canEditWeekSchedule(date, today) && <Button full variant="outline" className="mt-4" icon={<CalendarDays size={16} aria-hidden />} closeSheet onClick={() => setWeekOpen(true)}>{L('Déplacer un repos / une séance', 'Move a rest day / workout')}</Button>}
      </>}</SheetAction>
    </Sheet>
  )
}
