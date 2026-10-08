import { L } from '../lib/i18n'
import { Segmented } from './ui'

export type PlanMode = 'goal' | 'maintenance'

/** A dated goal (recomposition, cut, stabilization) or maintenance: training with no end date. */
export function PlanModePicker({ value, onChange }: { value: PlanMode; onChange: (m: PlanMode) => void }) {
  return <Segmented label={L('Durée du programme', 'Program duration')} value={value} onChange={onChange} layout="fit" options={[
    { value: 'maintenance', label: L('Sans date limite', 'No deadline') },
    { value: 'goal', label: L('Avec date cible', 'With a target date') },
  ]} />
}
