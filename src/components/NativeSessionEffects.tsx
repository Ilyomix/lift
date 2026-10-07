import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { LocalNotifications, type ActionPerformed } from '@capacitor/local-notifications'
import { L, resolveLang } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { configureNativeAlerts, isNative, syncRestAlert, WorkoutActivity } from '../lib/native/bridge'
import { workoutActivityState } from '../lib/native/snapshot'
import { latestSync } from '../lib/native/sync'
import { applyNativeRestAction, matchesRestNotification } from '../lib/native/restActions'

// Kept outside React: language changes and StrictMode remounts share the same queue.
let alertKey = ''
let reported = false
let alertsConfigured: Promise<void> | undefined
let reconciliation: Promise<void> | undefined
let iconReported = false

// Icon changes can display an iOS system alert. Keep their serialized queue
// separate so neither that alert nor an icon error blocks rest/activity updates.
const submitIcon = latestSync(async (_state: ReturnType<typeof useStore.getState>['state']) => {
  if (Capacitor.getPlatform() !== 'ios' || document.visibilityState !== 'visible') return
  const accent = useStore.getState().state.prefs.accent === 'blue' ? 'blue' : 'orange'
  const result = await WorkoutActivity.setAppIcon({ accent })
  if (result.applied) iconReported = false
}, error => {
  if (iconReported) return
  iconReported = true
  const unsupported = typeof error === 'object' && error !== null && 'code' in error && error.code === 'APP_ICON_UNSUPPORTED'
  useStore.getState().notify(unsupported
    ? L('Le changement d’icône n’est pas disponible sur cet appareil.', 'Changing the app icon is unavailable on this device.')
    : L('L’icône de l’app n’a pas été mise à jour. Rouvre Lift pour réessayer.', 'The app icon wasn’t updated. Reopen Lift to try again.'), 'bad')
})

function activityState(state: ReturnType<typeof useStore.getState>['state']) {
  return workoutActivityState(state.activeWorkout, resolveLang(state.prefs.lang), Date.now(), {
    theme: state.prefs.theme, accent: state.prefs.accent,
    systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  })
}
function reconcileNativeAction(): Promise<void> {
  if (!reconciliation) reconciliation = drainNativeActions().finally(() => { reconciliation = undefined })
  return reconciliation
}

async function drainNativeActions() {
  if (Capacitor.getPlatform() !== 'ios') return
  // A new action may arrive while the previous result is being persisted.
  while (true) {
    const { action } = await WorkoutActivity.pendingAction()
    if (!action) return
    const current = useStore.getState().state.activeWorkout
    const next = applyNativeRestAction(current, action)
    if (next !== current) useStore.getState().update(state => ({ ...state, activeWorkout: next }))
    await useStore.getState().flush()
    // Preserve the native journal if IndexedDB is temporarily unavailable.
    if (useStore.getState().storage !== 'idb') return
    await WorkoutActivity.acknowledgeAction({ id: action.id })
  }
}

const submit = latestSync(async (_state: ReturnType<typeof useStore.getState>['state']) => {
  await reconcileNativeAction()
  // Reconciliation may have changed the timer since this update was queued.
  const state = useStore.getState().state
  const snapshot = activityState(state)
  const nextKey = JSON.stringify([snapshot?.workoutId, snapshot?.restEndAt, snapshot?.exercise, snapshot?.setLabel, snapshot?.detail, state.prefs.notifications, state.prefs.sound])
  if (nextKey !== alertKey) {
    try {
      alertsConfigured ??= configureNativeAlerts().catch(error => { alertsConfigured = undefined; throw error })
      await alertsConfigured
      await syncRestAlert(snapshot, state.prefs.notifications, state.prefs.sound)
      alertKey = nextKey
    } catch {
      useStore.getState().notify(L('Alerte de repos indisponible. Garde le minuteur ouvert ou vérifie les notifications de Lift dans les réglages de l’appareil.', 'Rest alert unavailable. Keep the timer open or check Lift notifications in your device settings.'), 'bad')
    }
  }
  // Notification scheduling can yield while an action or a new set updates the store.
  const latest = useStore.getState().state
  const activitySnapshot = activityState(latest)
  await WorkoutActivity.sync({
    state: Capacitor.getPlatform() === 'ios' || latest.prefs.liveActivity !== false ? activitySnapshot : null,
    enabled: latest.prefs.liveActivity !== false,
    notificationsEnabled: latest.prefs.notifications,
    sound: latest.prefs.sound,
  })
}, () => {
  if (reported) return
  reported = true
  useStore.getState().notify(L('Suivi sur l’écran verrouillé indisponible. Consulte le minuteur dans la séance.', 'Lock screen tracking unavailable. Use the timer in your workout.'), 'bad')
})

export function NativeSessionEffects() {
  useEffect(() => {
    if (!isNative()) return
    let disposed = false
    const subscriptions: Array<{ remove(): Promise<void> }> = []
    const retain = (h: { remove(): Promise<void> }) => { if (disposed) void h.remove(); else subscriptions.push(h) }
    const pendingNotifications: ActionPerformed[] = []
    let pendingURL: string | undefined
    let handlingActions = false
    const sync = () => {
      const s = useStore.getState()
      if (s.ready) {
        submitIcon(s.state)
        submit(s.state)
      }
    }
    const handleActions = async () => {
      if (handlingActions || !useStore.getState().ready || disposed) return
      handlingActions = true
      try {
        if (pendingURL) {
          const launchURL = pendingURL
          pendingURL = undefined
          const url = new URL(launchURL)
          if (url.protocol === 'lift:' && url.hostname === 'workout' && url.searchParams.get('workoutId') === useStore.getState().state.activeWorkout?.id) navigate('seance')
        }
        while (pendingNotifications.length) {
          const event = pendingNotifications.shift()!
          if (event.actionId === 'dismiss' || event.notification.extra?.route !== 'seance') continue
          // A Live Activity may have extended this rest while the WebView slept.
          // Reconcile first so a valid notification for its new deadline works.
          await reconcileNativeAction()
          const current = useStore.getState().state.activeWorkout
          if (matchesRestNotification(current, event.notification.extra)) {
            const action = event.actionId === 'lift-rest-add30' ? 'add30' : event.actionId === 'lift-rest-resume' ? 'skip' : null
            if (action && Capacitor.getPlatform() === 'ios') {
              const result = await WorkoutActivity.performAction({ action, workoutId: current!.id, expectedRestEndAt: current!.timer!.endAt })
              if (!result.applied) throw new Error('Native rest no longer matches this action')
            } else if (action === 'add30') useStore.getState().adjustRest(30)
            else if (action === 'skip') useStore.getState().stopRest()
          }
          navigate('seance')
        }
        sync()
      } catch {
        useStore.getState().notify(L('Action non terminée. Ouvre la séance dans Lift pour vérifier le repos.', 'Action not completed. Open your workout in Lift to check the rest timer.'), 'bad')
      } finally {
        handlingActions = false
        // A deep link can arrive while a notification action is awaiting native work.
        if (!disposed && (pendingURL || pendingNotifications.length)) queueMicrotask(() => { void handleActions() })
      }
    }
    void LocalNotifications.addListener('localNotificationActionPerformed', event => {
      pendingNotifications.push(event)
      void handleActions()
    }).then(retain)
    void App.addListener('appUrlOpen', ({ url }) => { pendingURL = url; void handleActions() }).then(retain)
    void App.getLaunchUrl().then(result => { if (result) { pendingURL = result.url; void handleActions() } })
    if (Capacitor.getPlatform() === 'ios') void WorkoutActivity.addListener('actionPerformed', sync).then(retain)
    // Subscription also catches finish, discard, import/reset and changes made away from the session screen.
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.ready && (s.ready !== prev.ready || s.state.activeWorkout !== prev.state.activeWorkout || s.state.prefs !== prev.state.prefs)) {
        void handleActions()
        sync()
      }
    })
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // System notification permission may have changed in Settings during this rest.
      alertKey = ''
      void handleActions()
      sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    // A native inactive → active transition need not hide the WebView (e.g. a
    // system dialog). Refresh permission and retry deferred work on return too.
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      alertKey = ''
      void handleActions()
      sync()
    }).then(retain)
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemTheme = () => { if (useStore.getState().state.prefs.theme === 'auto') sync() }
    systemTheme.addEventListener('change', onSystemTheme)
    sync()
    return () => {
      disposed = true
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      systemTheme.removeEventListener('change', onSystemTheme)
      subscriptions.forEach(h => void h.remove())
    }
  }, [])
  return null
}
