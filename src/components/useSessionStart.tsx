import { useState } from 'react'
import { CirclePause, Play, X } from 'lucide-react'
import { unlockAudio } from '../lib/alerts'
import { todayISO } from '../lib/date'
import { L } from '../lib/i18n'
import { isRestDay, TYPE_META } from '../lib/program'
import { useStore } from '../lib/store'
import type { WorkoutType } from '../lib/types'
import { SportArt } from './SportArt'
import { Button, Sheet } from './ui'

/** Every workout entry point confirms a rest-day session or ending an active pause. */
export function useSessionStart(onStarted: () => void) {
  const [pending, setPending] = useState<{ type: WorkoutType; paused: boolean } | null>(null)
  const begin = (type: WorkoutType) => {
    unlockAudio()
    useStore.getState().startSession(type)
    setPending(null)
    onStarted()
  }
  return {
    start: (type: WorkoutType) => {
      const state = useStore.getState().state
      if (state.programPause.active || isRestDay(state, todayISO())) setPending({ type, paused: state.programPause.active })
      else begin(type)
    },
    confirmation: (
      <Sheet open={pending !== null} onClose={() => setPending(null)}
        icon={<SportArt kind="pause" size="title" />}
        title={pending?.paused ? L('Reprendre le programme ?', 'Resume the program?') : L('S’entraîner un jour de repos ?', 'Train on a rest day?')}
        footer={<div className="grid gap-2">
          <Button variant="primary" size="lg" full icon={<Play size={18} aria-hidden />} closeSheet onClick={() => pending && begin(pending.type)}>{pending?.paused ? L('Reprendre et commencer', 'Resume and start') : L('Commencer la séance', 'Start workout')}</Button>
          <Button variant="outline" full icon={pending?.paused ? <X size={18} aria-hidden /> : <CirclePause size={18} aria-hidden />} closeSheet onClick={() => setPending(null)}>{pending?.paused ? L('Annuler', 'Cancel') : L('Garder mon repos', 'Keep my rest day')}</Button>
        </div>}
      >
        <p className="text-[15px] leading-relaxed text-text-2">{pending?.paused ? L('Ton programme est actuellement en pause.', 'Your program is currently paused.') : L('Aujourd’hui est prévu pour le repos dans ton programme.', 'Today is a scheduled rest day in your program.')}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-text-2">{pending?.paused ? L(
          `La pause sera terminée et la séance ${TYPE_META[pending.type].label} commencera aujourd’hui. Le programme restera actif même si tu abandonnes ensuite cette séance.`,
          `Your pause will end and the ${TYPE_META[pending.type].label} workout will start today. The program will remain active even if you later discard this workout.`,
        ) : L(
          `Si tu commences ${pending ? TYPE_META[pending.type].label : ''} maintenant, cette séance sera datée d’aujourd’hui. À la fin, tu pourras déplacer ton repos ou garder une séance supplémentaire cette semaine.`,
          `If you start ${pending ? TYPE_META[pending.type].label : ''} now, this workout will be dated today. Afterwards, you can move your rest day or keep an extra workout this week.`,
        )}</p>
      </Sheet>
    ),
  }
}
