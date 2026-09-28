import { Fragment, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'
import { L, resolveLang } from './lib/i18n'
import { useRoute } from './lib/router'
import { useStore } from './lib/store'
import type { WorkoutType } from './lib/types'
import { WORKOUT_TYPES } from './lib/types'
import { RestDock, SessionEffects } from './components/RestTimer'
import { TabBar } from './components/TabBar'
import { Button, Toaster } from './components/ui'
import { CalendarScreen, PauseScreen, RemindersScreen } from './screens/Calendar'
import { Home } from './screens/Home'
import { CoachScreen, DataScreen, MoreScreen, NutritionScreen, SettingsScreen } from './screens/More'
import { Dial, ImportResultSheet, Onboarding } from './screens/Onboarding'
import { ProgramScreen, SourcesScreen, TemplateEditor } from './screens/ProgramScreen'
import { ExerciseDetail, ProgressScreen } from './screens/Progress'
import { VisualGoalScreen } from './screens/Goal'
import { SessionScreen, SessionSummary, WorkoutDetail } from './screens/Session'

function Routes({ path }: { path: string[] }) {
  const [a, b, c] = path
  switch (a) {
    case undefined:
      return <Home />
    case 'seance':
      if (b === 'bilan') return <SessionSummary />
      if (b) return <WorkoutDetail id={b} />
      return <SessionScreen />
    case 'calendrier':
      return <CalendarScreen />
    case 'progres':
      if (b === 'exercice' && c) return <ExerciseDetail id={c} />
      return <ProgressScreen tab={b === 'corps' || b === 'volume' || b === 'seances' ? b : 'force'} sub={c} />
    case 'plus':
      switch (b) {
        case 'nutrition': return <NutritionScreen />
        case 'programme': return c && (WORKOUT_TYPES as string[]).includes(c) ? <TemplateEditor type={c as WorkoutType} /> : <ProgramScreen />
        case 'preuves': return <SourcesScreen />
        case 'coach': return <CoachScreen />
        case 'pause': return <PauseScreen />
        case 'rappels': return <RemindersScreen />
        case 'reglages': return <SettingsScreen />
        case 'objectif': return <VisualGoalScreen />
        case 'donnees': return <DataScreen />
        default: return <MoreScreen />
      }
    default:
      return <Home />
  }
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })
  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-0 top-[calc(max(env(safe-area-inset-top),12px)+var(--top-clear))] z-[71] flex justify-center px-4">
      <div role="status" className="overlay-enter flex items-center gap-3 rounded-[12px] border border-line bg-surface px-4 py-2.5 shadow-[0_12px_40px_rgb(0_0_0/0.18)]">
        <RefreshCw size={16} className="text-text-2" aria-hidden />
        <span className="text-[14px]">{L('Nouvelle version disponible', 'New version available')}</span>
        <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>{L('Mettre à jour', 'Update')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>{L('Plus tard', 'Later')}</Button>
      </div>
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const hasData = useStore((s) => s.hasData)
  // Strings are read at render: a language change remounts the whole tree.
  const langKey = useStore((s) => resolveLang(s.state.prefs.lang))
  const path = useRoute()

  useEffect(() => {
    void useStore.getState().init()
    const flush = () => void useStore.getState().flush()
    const onVis = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const effects = <SessionEffects />
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <Dial size={48} />
      </div>
    )
  }

  if (!hasData) {
    return (
      <>
        {effects}
        <Onboarding />
        <Toaster />
        <UpdatePrompt />
      </>
    )
  }

  return (
    <Fragment key={langKey}>
      {effects}
      <div className="status-scrim" aria-hidden />
      <Routes key={path.join('/')} path={path} />
      <RestDock />
      <TabBar current={path[0] ?? ''} />
      <ImportResultSheet />
      <Toaster />
      <UpdatePrompt />
    </Fragment>
  )
}
