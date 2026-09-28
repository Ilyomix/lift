import { Flag, Infinity as InfinityIcon } from 'lucide-react'
import { L } from '../lib/i18n'
import { cx } from './ui'

export type PlanMode = 'goal' | 'maintenance'

/** A dated goal (recomposition, cut, stabilization) or maintenance: training with no end date. */
export function PlanModePicker({ value, onChange }: { value: PlanMode; onChange: (m: PlanMode) => void }) {
  const options = [
    {
      id: 'goal' as const,
      icon: Flag,
      title: L('Date objectif', 'Goal date'),
      text: L('Un look pour une date : recomposition, sèche, stabilisation.', 'A look by a date: recomposition, cut, stabilization.'),
    },
    {
      id: 'maintenance' as const,
      icon: InfinityIcon,
      title: L('Entretien', 'Maintenance'),
      text: L('Sans date : blocs et décharges en continu, calories à maintenance.', 'No end date: blocks and deloads that keep going, maintenance calories.'),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={L('Type de plan', 'Plan type')}>
      {options.map(({ id, icon: Icon, title, text }) => {
        const on = id === value
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={cx('pressable card flex flex-col items-start gap-1.5 p-3.5 text-left', on ? 'border-signal shadow-[0_0_0_1px_var(--signal)]' : 'hover:border-line-strong')}
          >
            <Icon size={18} className={on ? 'text-signal-text' : 'text-text-2'} aria-hidden />
            <span className="text-[15px] font-semibold">{title}</span>
            <span className="text-[12px] leading-[1.4] text-text-2">{text}</span>
          </button>
        )
      })}
    </div>
  )
}
