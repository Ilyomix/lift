import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { addDays, dayName, fmtDate, mondayOf, todayISO, weekday } from '../lib/date'
import { plural } from '../lib/format'
import { L } from '../lib/i18n'
import { GOAL_DATE, isPausedDay, maintenanceHorizon, MAINTENANCE, PROGRAM_START, weekSchedule } from '../lib/program'
import { useStore } from '../lib/store'
import type { ISODate } from '../lib/types'
import { SportArt } from './SportArt'
import { Button, cx, Sheet } from './ui'

export function canEditWeekSchedule(date: ISODate, today: ISODate = todayISO()): boolean {
  const week = mondayOf(date)
  return week >= mondayOf(today) && addDays(week, 6) >= PROGRAM_START
    && week <= (MAINTENANCE ? maintenanceHorizon(today, PROGRAM_START) : GOAL_DATE)
}

export function WeekScheduleSheet({ weekDate, onClose, afterRestWorkout = false }: { weekDate: ISODate; onClose: () => void; afterRestWorkout?: boolean }) {
  const state = useStore(s => s.state)
  const today = todayISO()
  const week = weekSchedule(state, weekDate, today)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week.monday, i))
  const occupied = new Set(state.workouts.map(w => w.date))
  if (state.activeWorkout && !state.activeWorkout.reopened) occupied.add(state.activeWorkout.date)
  const [initialSelected] = useState<ISODate[]>(() => week.planned)
  const [selected, setSelected] = useState<ISODate[]>(initialSelected)
  const [error, setError] = useState(false)
  const dirty = selected.join() !== initialSelected.join()
  const total = week.completed + week.active + selected.length
  const save = (days: number[] | null) => {
    if (!useStore.getState().setWeekSchedule(week.monday, days)) { setError(true); return false }
    useStore.getState().notify(days === null ? L('Jours habituels rétablis.', 'Usual days restored.') : L('Planning de la semaine enregistré.', 'Weekly schedule saved.'))
    return true
  }
  return <Sheet open dirty={dirty} onClose={onClose} title={afterRestWorkout ? L('Où placer ton repos ?', 'When would you like to rest?') : L('Organiser la semaine', 'Plan your week')} icon={<SportArt kind="calendar" size="title" />}
    footer={<Button variant="primary" size="lg" full icon={<Check size={18} aria-hidden />} closeSheet={() => save(selected.map(weekday))} onClick={onClose}>{L('Enregistrer cette semaine', 'Save this week')}</Button>}>
    <p className="text-[13px] text-text-2">{fmtDate(week.monday)} – {fmtDate(addDays(week.monday, 6))}</p>
    <p className="mt-3 text-[15px] leading-relaxed">{afterRestWorkout
      ? L('Tu t’es entraîné un jour de repos. Choisis les jours de tes prochaines séances cette semaine.', 'You trained on a rest day. Choose your remaining workout days this week.')
      : L('Touche un jour à venir pour alterner séance et repos.', 'Tap an upcoming day to switch between training and rest.')}</p>
    <div className="mt-5 grid grid-cols-7 gap-1" aria-label={L('Jours de la semaine', 'Days of the week')}>
      {dates.map(date => {
        const done = state.workouts.some(w => w.date === date)
        const active = occupied.has(date) && !done
        const paused = isPausedDay(state, date, today)
        const unavailable = date < today || date < PROGRAM_START || (!MAINTENANCE && date > GOAL_DATE) || paused
        const locked = occupied.has(date) || unavailable
        const training = selected.includes(date)
        const label = done ? L('Fait', 'Done') : active ? L('En cours', 'Active') : paused ? L('Pause', 'Paused') : unavailable ? '—' : training ? L('Séance', 'Train') : L('Repos', 'Rest')
        return <button type="button" key={date} disabled={locked} aria-pressed={!locked && training}
          aria-label={`${fmtDate(date, { weekday: true, long: true })} : ${label}`}
          onClick={() => { setError(false); setSelected(prev => training ? prev.filter(d => d !== date) : [...prev, date].sort()) }}
          className={cx('pressable flex min-h-[88px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border px-0.5 py-2', done || active ? 'border-line bg-surface-2' : unavailable ? 'border-line opacity-40' : training ? 'border-signal bg-signal-soft text-signal-text' : 'border-dashed border-line-strong text-text-2')}>
          <span className="text-[10px] font-medium">{dayName(weekday(date), true)}</span>
          <span className="text-[18px] font-semibold tnum">{Number(date.slice(8))}</span>
          <span className="flex h-4 items-center text-[9px] font-medium">{done ? <Check size={14} aria-hidden /> : label}</span>
        </button>
      })}
    </div>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-1">
      <p className="text-[15px] font-semibold" aria-live="polite">{L(`${plural(total, 'séance', 'séances')} cette semaine`, `${plural(total, 'workout', 'workouts')} this week`)}</p>
      <p className="text-[13px] text-text-2">{[L(plural(week.completed, 'terminée', 'terminées'), `${week.completed} done`), ...(week.active ? [L(`${week.active} en cours`, `${week.active} in progress`)] : []), L(`${selected.length} à venir`, `${selected.length} upcoming`)].join(' · ')}</p>
    </div>
    <p className="mt-3 text-[13px] leading-relaxed text-text-2">{L('Les séances terminées restent en place. Les dates des blocs et de ton objectif ne changent pas.', 'Completed workouts stay in place. Your program blocks and goal date stay unchanged.')}</p>
    {week.customized && <Button full variant="outline" className="mt-4" icon={<RotateCcw size={16} aria-hidden />} closeSheet={() => save(null)} onClick={onClose}>{L('Rétablir les jours habituels', 'Restore usual days')}</Button>}
    {error && <p role="alert" className="mt-3 text-[13px] text-bad">{L('Le planning a changé. Ferme ce volet puis rouvre la semaine.', 'The schedule has changed. Close this panel and reopen the week.')}</p>}
  </Sheet>
}
