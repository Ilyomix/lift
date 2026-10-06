import { CalendarDays, ChartSpline, Dumbbell, Ellipsis, House } from 'lucide-react'
import { L } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { cx } from './ui'

// Labels are getters: they follow the interface language.
const TABS = [
  { path: '', get label() { return L("Aujourd'hui", 'Today') }, Icon: House },
  { path: 'seance', get label() { return L('Séance', 'Workout') }, Icon: Dumbbell },
  { path: 'calendrier', get label() { return L('Calendrier', 'Calendar') }, Icon: CalendarDays },
  { path: 'progres', get label() { return L('Progrès', 'Progress') }, Icon: ChartSpline },
  { path: 'plus', get label() { return L('Plus', 'More') }, Icon: Ellipsis },
] as const

export function TabBar({ current }: { current: string }) {
  const active = useStore((s) => !!s.state.activeWorkout)
  return (
    <nav
      aria-label={L('Navigation principale', 'Main navigation')}
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
                onClick={() => navigate(path, { transition: 'none' })}
                className={cx('pressable relative flex h-[58px] w-full flex-col items-center justify-center gap-1 text-[10.5px] font-semibold tracking-[0.01em]', selected ? 'text-text' : 'text-muted hover:text-text-2')}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={selected ? 2.2 : 1.8} aria-hidden className={selected ? 'text-signal-text' : undefined} />
                  {path === 'seance' && active && <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-signal ring-2 ring-bg" aria-label={L('Séance en cours', 'Workout in progress')} />}
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
