import { useState } from 'react'
import { ChevronDown, Gauge } from 'lucide-react'
import { effortBounds, effortSummary, effortTarget } from '../lib/effort'
import { L } from '../lib/i18n'
import type { WorkoutExercise } from '../lib/types'
import { Sheet, Tag } from './ui'

export function reserveLabel(target: string | undefined, compact = false) {
  if (!target) return L('Réserve non définie', 'Reserve not set')
  if (compact) return L(`${target} rép. en réserve`, `${target} ${target === '1' ? 'rep' : 'reps'} in reserve`)
  return L(`${target} ${target === '1' ? 'répétition' : 'répétitions'} en réserve`, `${target} ${target === '1' ? 'rep' : 'reps'} in reserve`)
}

/** Extra context stays behind the exercise's effort target, beside the set inputs. */
function EffortExplanation({ target }: { target: string | undefined }) {
  const bounds = effortBounds(target)
  return <div className="space-y-2 text-[13px] leading-[1.5] text-text-2">
    <p>{!bounds.length
      ? L('La réserve correspond aux répétitions que tu pourrais encore faire proprement à la fin de la série.', 'Reps in reserve are the reps you could still do with good form at the end of a set.')
      : Math.max(...bounds) === 0
      ? L('0 = ne plus pouvoir faire de répétition supplémentaire proprement.', '0 = no more repetitions possible with good form.')
      : L(`${target} = pouvoir encore faire environ ${target} ${target === '1' ? 'répétition' : 'répétitions'} à la fin de la série.`, `${target} = being able to do about ${target} more ${target === '1' ? 'rep' : 'reps'} at the end of the set.`)}</p>
    <p>{bounds.length > 0 && Math.min(...bounds) > 0
      ? L('Allège si nécessaire pour garder cette marge.', 'Use a lighter load if needed to keep that reserve.')
      : L('Garde une exécution contrôlée ; aucune répétition forcée n’est nécessaire.', 'Keep the movement controlled; forced repetitions are not needed.')}</p>
  </div>
}

/** The session's dated instruction, not the reusable template's default. */
export function EffortGuidance({ exercise }: { exercise: WorkoutExercise }) {
  const [open, setOpen] = useState(false)
  const target = effortTarget(exercise)
  const summary = effortSummary([exercise])
  return (
    <>
      <button type="button" className="pressable inline-flex min-h-11 items-center" aria-haspopup="dialog" aria-label={L(`Comprendre l’objectif : ${reserveLabel(target)}`, `Understand the target: ${reserveLabel(target)}`)} onClick={() => setOpen(true)}>
        <Tag tone="outline">{reserveLabel(target, true)} <ChevronDown size={12} aria-hidden /></Tag>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={L('Répétitions en réserve', 'Reps in reserve')} icon={<Gauge />}>
        <EffortExplanation target={target} />
      </Sheet>
      <div className="order-last basis-full" aria-live="polite">
        {summary.belowTarget > 0 && <p className="mb-3 text-[13px] leading-[1.45] text-warn">{L(`${summary.belowTarget} ${summary.belowTarget === 1 ? 'série réalisée' : 'séries réalisées'} avec moins de répétitions en réserve que prévu. Ne cherche pas à compenser par une série supplémentaire.`, `${summary.belowTarget} ${summary.belowTarget === 1 ? 'set completed' : 'sets completed'} with fewer reps in reserve than planned. Do not compensate with an extra set.`)}</p>}
      </div>
    </>
  )
}

export function EffortReport({ exercises }: { exercises: WorkoutExercise[] }) {
  const s = effortSummary(exercises)
  return (
    <div className="mt-3 rounded-[10px] bg-surface-2 p-3 text-[13px] leading-[1.45]">
      <p>{L(`Réserve renseignée : ${s.logged}/${s.completed} ${s.completed === 1 ? 'série' : 'séries'}. Sans répétition en réserve ou signalées à l’échec : ${s.failures}.`, `Reps in reserve recorded: ${s.logged}/${s.completed} ${s.completed === 1 ? 'set' : 'sets'}. With no reps in reserve or flagged as failure: ${s.failures}.`)}</p>
      {s.extra > 0 && <p className="mt-1 text-warn">{L(`${s.extra} ${s.extra === 1 ? 'série supplémentaire comptée' : 'séries supplémentaires comptées'} dans le volume, mais ${s.extra === 1 ? 'exclue' : 'exclues'} de la validation de charge.`, `${s.extra} extra ${s.extra === 1 ? 'set' : 'sets'} counted in volume, but excluded from load validation.`)}</p>}
      {s.logged < s.completed && <p className="mt-1 text-muted">{L('Une réserve non renseignée reste inconnue : elle ne signifie pas zéro.', 'An unrecorded reserve is unknown; it does not mean zero.')}</p>}
    </div>
  )
}
