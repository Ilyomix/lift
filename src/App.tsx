import { NativeSessionEffects } from './components/NativeSessionEffects'
import { isNative } from './lib/native/bridge'
import { Fragment, useEffect, useLayoutEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { L, resolveLang } from './lib/i18n'
import { navigate, useRoute } from './lib/router'
import { useStore } from './lib/store'
import type { WorkoutType } from './lib/types'
import { WORKOUT_TYPES } from './lib/types'
import { RestDock, SessionEffects } from './components/RestTimer'
import { TabBar } from './components/TabBar'
import { SwipeNavigation } from './components/SwipeNavigation'
import { RouteFocus } from './components/RouteFocus'
import { Button, DiscardChanges, Header, Screen, Toaster } from './components/ui'
import { CalendarScreen, PauseScreen, RemindersScreen } from './screens/Calendar'
import { Home } from './screens/Home'
import { AboutScreen, CoachScreen, DataScreen, MoreScreen, NutritionScreen, NutritionTargetsScreen } from './screens/More'
import { SettingsScreen } from './screens/Settings'
import { AppIcon, ImportResultSheet, Onboarding } from './screens/Onboarding'
import { SourcesScreen, TemplateEditor } from './screens/ProgramScreen'
import { ExerciseDetail, ProgressScreen } from './screens/Progress'
import { VisualGoalScreen } from './screens/Goal'
import { SessionScreen, SessionSummary, WorkoutDetail } from './screens/Session'
import { PrivacyScreen } from './screens/Privacy'

function LegacyProgramRedirect({ type }: { type?: WorkoutType }) {
  useLayoutEffect(() => {
    navigate(type ? `calendrier/programme/${type}` : 'calendrier/programme', { replace: true })
  }, [type])
  return null
}

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
      if (b === 'programme' && c && (WORKOUT_TYPES as string[]).includes(c)) return <TemplateEditor type={c as WorkoutType} />
      return <CalendarScreen tab={b === 'programme' ? 'programme' : 'calendrier'} />
    case 'progres':
      if (b === 'exercice' && c) return <ExerciseDetail id={c} />
      return <ProgressScreen tab={b === 'corps' || b === 'volume' || b === 'seances' ? b : 'force'} sub={c} />
    case 'plus':
      switch (b) {
        case 'confidentialite': return <PrivacyScreen />
        case 'nutrition': return <NutritionScreen />
        case 'programme': return <LegacyProgramRedirect type={c && (WORKOUT_TYPES as string[]).includes(c) ? c as WorkoutType : undefined} />
        case 'preuves': return <SourcesScreen />
        case 'coach': return <CoachScreen />
        case 'pause': return <PauseScreen />
        case 'rappels': return <RemindersScreen />
        case 'reglages': return c === 'nutrition' ? <NutritionTargetsScreen /> : <SettingsScreen section={c} />
        case 'a-propos': return <AboutScreen />
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
      {/* One line where it fits; on a phone the message keeps its line and the buttons go under it. */}
      <div role="status" className="overlay-enter flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-line bg-surface py-2.5 pr-2.5 pl-4 shadow-[0_12px_40px_rgb(0_0_0/0.18)]">
        <span className="flex min-w-0 items-center gap-2.5 py-1 text-[14px]">
          <RefreshCw size={16} className="shrink-0 text-text-2" aria-hidden />
          {L('Nouvelle version disponible', 'New version available')}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" icon={<X size={16} aria-hidden />} onClick={() => setNeedRefresh(false)}>{L('Plus tard', 'Later')}</Button>
          <Button size="sm" variant="primary" icon={<RefreshCw size={16} aria-hidden />} onClick={() => void updateServiceWorker(true)}>{L('Mettre à jour', 'Update')}</Button>
        </span>
      </div>
    </div>
  )
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const hasData = useStore((s) => s.hasData)
  const storage = useStore((s) => s.storage)
  // Strings are read at render: a language change remounts the whole tree.
  const langKey = useStore((s) => resolveLang(s.state.prefs.lang))
  const path = useRoute()
  const routeKey = path.join('/')
  // Keep Calendar's selected month when switching its two top-level tabs.
  const screenKey = routeKey === 'calendrier' || routeKey === 'calendrier/programme' ? 'calendrier' : routeKey

  useEffect(() => {
    void useStore.getState().init()
    const flush = () => void useStore.getState().flush()
    // Save before suspension and retry unsaved changes when storage wakes up.
    const onVis = () => flush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const effects = <><SessionEffects /><NativeSessionEffects /></>
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label={L('Chargement de Lift', 'Loading Lift')} aria-busy="true">
        <AppIcon size={48} />
      </div>
    )
  }

  if (!hasData && storage === 'memory') {
    return <Screen>
      <Header art="backup" title={L('Données temporairement inaccessibles', 'Data temporarily unavailable')} />
      <p className="text-[15px] leading-[1.5] text-text-2">
        {L('Lift n’a pas pu ouvrir le stockage de cet appareil. Aucune donnée n’a été effacée. Réessaie ou ferme puis rouvre l’app.', 'Lift could not open this device’s storage. No data was erased. Retry or close and reopen the app.')}
      </p>
      <Button full variant="primary" className="mt-5" icon={<RefreshCw size={18} aria-hidden />} onClick={() => void useStore.getState().init()}>{L('Réessayer', 'Retry')}</Button>
    </Screen>
  }

  if (!hasData) {
    return (
      <>
        {effects}
        <Onboarding />
        <DiscardChanges />
        <Toaster />
        {!isNative() && <UpdatePrompt />}
      </>
    )
  }

  return (
    <Fragment key={langKey}>
      {effects}
      <div className="status-scrim" aria-hidden />
      <SwipeNavigation path={path} />
      <div className="route-viewport mx-auto w-full max-w-[640px]">
        {/* The motion surface stays mounted when a page swaps its own <main>
            (for example, a workout preview becoming an active workout). */}
        <div className="route-surface"><Routes key={screenKey} path={path} /></div>
      </div>
      <RouteFocus route={routeKey} />
      <RestDock />
      <TabBar current={path[0] ?? ''} />
      <ImportResultSheet />
      <DiscardChanges />
      <Toaster />
      {!isNative() && <UpdatePrompt />}
    </Fragment>
  )
}
