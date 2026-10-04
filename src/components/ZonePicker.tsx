import { L } from '../lib/i18n'
import type { Zone } from '../lib/types'
import { MAX_ZONES, ZONES } from '../lib/visual'
import { cx } from './ui'

/** Priority zones as chips: three at most, the others are greyed once the three are chosen. */
export function ZonePicker({ value, onChange }: { value: Zone[]; onChange: (zones: Zone[]) => void }) {
  const toggle = (z: Zone) => onChange(value.includes(z) ? value.filter((x) => x !== z) : value.length >= MAX_ZONES ? value : [...value, z])
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={L('Zones prioritaires', 'Priority areas')}>
      {ZONES.map((z) => {
        const on = value.includes(z.id)
        return (
          <button
            key={z.id}
            type="button"
            aria-pressed={on}
            disabled={!on && value.length >= MAX_ZONES}
            onClick={() => toggle(z.id)}
            className={cx('pressable min-h-11 rounded-full border px-4 text-[14px] font-semibold disabled:opacity-35', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2')}
          >
            {z.label}
          </button>
        )
      })}
    </div>
  )
}
