import { effortBounds, effortSummary, effortTarget } from '../lib/effort'
import { L } from '../lib/i18n'
import type { WorkoutExercise } from '../lib/types'

/** The session's dated instruction, not the reusable template's default. */
export function EffortGuidance({ exercise }: { exercise: WorkoutExercise }) {
  const target = effortTarget(exercise)
  const minimum = Math.min(...effortBounds(target))
  const summary = effortSummary([exercise])
  return (
    <div className="mx-4 mt-3 rounded-[10px] bg-signal-soft p-3 text-[13px] leading-[1.45]" aria-live="polite">
      <p className="font-semibold">{L('Consigne du jour', 'Today’s instruction')} · RIR {target ?? '—'}</p>
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
      <p>{L(`RIR renseigné : ${s.logged}/${s.completed} séries. À RIR 0 ou signalées à l’échec : ${s.failures}.`, `RIR recorded: ${s.logged}/${s.completed} sets. At RIR 0 or flagged as failure: ${s.failures}.`)}</p>
      {s.extra > 0 && <p className="mt-1 text-warn">{L(`${s.extra} série(s) supplémentaire(s) comptée(s) dans le volume, mais exclue(s) de la validation de charge.`, `${s.extra} extra set(s) counted in volume, but excluded from load validation.`)}</p>}
      {s.logged < s.completed && <p className="mt-1 text-muted">{L('Un RIR non renseigné reste inconnu : il ne signifie pas zéro.', 'An unrecorded RIR is unknown; it does not mean zero.')}</p>}
    </div>
  )
}
