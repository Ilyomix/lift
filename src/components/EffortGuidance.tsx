import { Gauge } from 'lucide-react'
import { effortBounds, effortSummary, effortTarget } from '../lib/effort'
import { L } from '../lib/i18n'
import type { WorkoutExercise } from '../lib/types'

export function reserveLabel(target: string | undefined) {
  if (!target) return L('Réserve non définie', 'Reserve not set')
  return L(`${target} ${target === '1' ? 'rep' : 'reps'} en réserve`, `${target} ${target === '1' ? 'rep' : 'reps'} in reserve`)
}

/** Explain the input once above the session, using the current exercise's target. */
export function EffortExplanation({ target }: { target: string | undefined }) {
  const bounds = effortBounds(target)
  if (!bounds.length) return null
  return <div className="mt-4 rounded-[10px] bg-surface-2 p-3 text-[13px] leading-[1.5]">
    <p className="font-semibold">{L('Répétitions en réserve', 'Reps in reserve')}</p>
    <p className="mt-1 text-text-2">{Math.max(...bounds) === 0
      ? L('0 = ne plus pouvoir faire de répétition supplémentaire proprement.', '0 = no more repetitions possible with good form.')
      : L(`${target} = pouvoir encore faire environ ${target} répétitions à la fin de la série.`, `${target} = being able to do about ${target} more repetitions at the end of the set.`)}</p>
  </div>
}

/** The session's dated instruction, not the reusable template's default. */
export function EffortGuidance({ exercise }: { exercise: WorkoutExercise }) {
  const target = effortTarget(exercise)
  const minimum = Math.min(...effortBounds(target))
  const summary = effortSummary([exercise])
  return (
    <div className="mx-4 mt-3 rounded-[10px] bg-signal-soft p-3 text-[13px] leading-[1.45]" aria-live="polite">
      <p className="mb-1 flex items-center gap-2 font-semibold"><Gauge size={16} className="shrink-0" aria-hidden />{L('Consigne du jour', 'Today’s instruction')}</p>
      <p>{Number.isFinite(minimum) && minimum > 0
        ? L(`Arrête la série avec environ ${target} répétitions encore possibles. Allège si nécessaire pour garder cette marge.`, `Stop with about ${target} repetitions still possible. Use a lighter load if needed to keep that reserve.`)
        : L('Garde une exécution contrôlée ; aucune répétition forcée n’est nécessaire.', 'Keep the movement controlled; forced repetitions are not needed.')}</p>
      {summary.belowTarget > 0 && <p className="mt-1 text-warn">{L(`${summary.belowTarget} série(s) plus proches de l’échec que prévu. Ne cherche pas à compenser par une série supplémentaire.`, `${summary.belowTarget} set(s) closer to failure than planned. Do not compensate with an extra set.`)}</p>}
    </div>
  )
}

export function EffortReport({ exercises }: { exercises: WorkoutExercise[] }) {
  const s = effortSummary(exercises)
  return (
    <div className="mt-3 rounded-[10px] bg-surface-2 p-3 text-[13px] leading-[1.45]">
      <p>{L(`Réserve renseignée : ${s.logged}/${s.completed} séries. Sans répétition en réserve ou signalées à l’échec : ${s.failures}.`, `Reps in reserve recorded: ${s.logged}/${s.completed} sets. With no reps in reserve or flagged as failure: ${s.failures}.`)}</p>
      {s.extra > 0 && <p className="mt-1 text-warn">{L(`${s.extra} série(s) supplémentaire(s) comptée(s) dans le volume, mais exclue(s) de la validation de charge.`, `${s.extra} extra set(s) counted in volume, but excluded from load validation.`)}</p>}
      {s.logged < s.completed && <p className="mt-1 text-muted">{L('Une réserve non renseignée reste inconnue : elle ne signifie pas zéro.', 'An unrecorded reserve is unknown; it does not mean zero.')}</p>}
    </div>
  )
}
