import { CalendarDays, ChartSpline, Dumbbell, Ellipsis, House } from 'lucide-react'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { cx } from './ui'

const TABS = [
  { path: '', label: "Aujourd'hui", Icon: House },
  { path: 'seance', label: 'Séance', Icon: Dumbbell },
  { path: 'calendrier', label: 'Calendrier', Icon: CalendarDays },
  { path: 'progres', label: 'Progrès', Icon: ChartSpline },
  { path: 'plus', label: 'Plus', Icon: Ellipsis },
] as const

export function TabBar({ current }: { current: string }) {
  const active = useStore((s) => !!s.state.activeWorkout)
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklch,var(--bg)_86%,transparent)] backdrop-blur-xl safe-bottom"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-5">
        {TABS.map(({ path, label, Icon }) => {
          const selected = current === path
          return (
            <li key={label}>
              <button
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => navigate(path)}
                className={cx('pressable relative flex h-[58px] w-full flex-col items-center justify-center gap-1 text-[10.5px] font-semibold tracking-[0.01em]', selected ? 'text-text' : 'text-muted hover:text-text-2')}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={selected ? 2.2 : 1.8} aria-hidden className={selected ? 'text-signal-text' : undefined} />
                  {path === 'seance' && active && <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-signal ring-2 ring-bg" aria-label="Séance en cours" />}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
