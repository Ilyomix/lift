import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { L, resolveLang } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { configureNativeAlerts, isNative, syncRestAlert, WorkoutActivity } from '../lib/native/bridge'
import { workoutActivityState } from '../lib/native/snapshot'
import { latestSync } from '../lib/native/sync'

// Kept outside React: language changes and StrictMode remounts share the same queue.
let alertKey = ''
let reported = false
let alertsConfigured: Promise<void> | undefined
const submit = latestSync(async (state: ReturnType<typeof useStore.getState>['state']) => {
  const snapshot = workoutActivityState(state.activeWorkout, resolveLang(state.prefs.lang))
  if (snapshot && state.prefs.liveActivity !== false && Capacitor.getPlatform() === 'android' && document.visibilityState === 'visible') {
    const permission = await LocalNotifications.checkPermissions()
    if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions()
    }
  }
  const nextKey = JSON.stringify([snapshot?.workoutId, snapshot?.restEndAt, snapshot?.exercise, snapshot?.setLabel, snapshot?.detail, state.prefs.notifications, state.prefs.sound])
  if (nextKey !== alertKey) {
    try {
      alertsConfigured ??= configureNativeAlerts().catch(error => { alertsConfigured = undefined; throw error })
      await alertsConfigured
      await syncRestAlert(snapshot, state.prefs.notifications, state.prefs.sound)
      alertKey = nextKey
    } catch {
      useStore.getState().notify(L('Alerte de repos indisponible. Vérifie les autorisations des notifications.', 'Rest alert unavailable. Check notification permissions.'), 'bad')
    }
  }
  await WorkoutActivity.sync({ state: state.prefs.liveActivity === false ? null : snapshot })
}, () => {
  if (reported) return
  reported = true
  useStore.getState().notify(L('Suivi écran verrouillé indisponible. Vérifie les autorisations dans Réglages.', 'Lock screen tracking unavailable. Check permissions in Settings.'), 'bad')
})

export function NativeSessionEffects() {
  useEffect(() => {
    if (!isNative()) return
    let disposed = false
    const subscriptions: Array<{ remove(): Promise<void> }> = []
    void LocalNotifications.addListener('localNotificationActionPerformed', () => navigate('seance')).then(h => {
      if (disposed) void h.remove()
      else subscriptions.push(h)
    })
    const sync = () => {
      const s = useStore.getState()
      if (s.ready) submit(s.state)
    }
    // Subscription also catches finish, discard, import/reset and changes made away from the session screen.
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.ready && (s.ready !== prev.ready || s.state.activeWorkout !== prev.state.activeWorkout || s.state.prefs !== prev.state.prefs)) sync()
    })
    const onVisible = () => { if (document.visibilityState === 'visible') sync() }
    document.addEventListener('visibilitychange', onVisible)
    sync()
    return () => {
      disposed = true
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      subscriptions.forEach(h => void h.remove())
    }
  }, [])
  return null
}
