import { useState } from 'react'
import { Play } from 'lucide-react'
import { unlockAudio } from '../lib/alerts'
import { todayISO } from '../lib/date'
import { L } from '../lib/i18n'
import { isRestDay, TYPE_META } from '../lib/program'
import { useStore } from '../lib/store'
import type { WorkoutType } from '../lib/types'
import { SportArt } from './SportArt'
import { Button, Sheet } from './ui'

/** Every workout entry point confirms training on a scheduled rest day. */
export function useSessionStart(onStarted: () => void) {
  const [pending, setPending] = useState<WorkoutType | null>(null)
  const begin = (type: WorkoutType) => {
    unlockAudio()
    useStore.getState().startSession(type)
    setPending(null)
    onStarted()
  }
  return {
    start: (type: WorkoutType) => {
      if (isRestDay(useStore.getState().state, todayISO())) setPending(type)
      else begin(type)
    },
    confirmation: (
      <Sheet open={pending !== null} onClose={() => setPending(null)}
        icon={<SportArt kind="pause" size="title" />}
        title={L('S’entraîner un jour de repos ?', 'Train on a rest day?')}
        footer={<div className="grid gap-2">
          <Button variant="primary" size="lg" full icon={<Play size={18} aria-hidden />} onClick={() => pending && begin(pending)}>{L('Commencer la séance', 'Start workout')}</Button>
          <Button variant="outline" full onClick={() => setPending(null)}>{L('Garder mon repos', 'Keep my rest day')}</Button>
        </div>}
      >
        <p className="text-[15px] leading-relaxed text-text-2">{L('Aujourd’hui est prévu pour le repos dans ton programme.', 'Today is a scheduled rest day in your program.')}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-text-2">{L(
          `Si tu commences ${pending ? TYPE_META[pending].label : ''} maintenant, cette séance sera datée d’aujourd’hui. À la fin, tu pourras déplacer ton repos ou garder une séance supplémentaire cette semaine.`,
          `If you start ${pending ? TYPE_META[pending].label : ''} now, this workout will be dated today. Afterwards, you can move your rest day or keep an extra workout this week.`,
        )}</p>
      </Sheet>
    ),
  }
}
