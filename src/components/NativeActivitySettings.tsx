import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { L } from '../lib/i18n'
import { useStore } from '../lib/store'
import { isNative, nativeNotificationPermission, WorkoutActivity } from '../lib/native/bridge'
import { Button, Row, Toggle } from './ui'

export function NativeActivitySettings() {
  const prefs = useStore(s => s.state.prefs)
  const { setPrefs, notify } = useStore.getState()
  const [permission, setPermission] = useState(false)
  const [activityEnabled, setActivityEnabled] = useState(true)
  useEffect(() => {
    if (!isNative()) return
    const refresh = () => {
      void nativeNotificationPermission().then(setPermission).catch(() => {})
      void WorkoutActivity.status().then(s => setActivityEnabled(s.enabled)).catch(() => setActivityEnabled(false))
    }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  if (!isNative()) return null
  const enableAlerts = async () => {
    try {
      const granted = await nativeNotificationPermission(true)
      setPermission(granted)
      setPrefs({ notifications: granted })
      if (!granted) notify(L('Autorise les notifications de Lift dans les réglages de l’appareil.', 'Allow Lift notifications in your device settings.'), 'bad')
    } catch {
      notify(L('Notifications non activées. Réessaie ou vérifie les autorisations de Lift dans les réglages de l’appareil.', 'Notifications not enabled. Try again or check Lift permissions in your device settings.'), 'bad')
    }
  }
  const ios = Capacitor.getPlatform() === 'ios'
  return <>
    <Toggle
      label={ios ? L('Activité en direct', 'Live Activity') : L('Suivi sur l’écran verrouillé', 'Lock screen tracking')}
      hint={ios ? L('Progression et repos sur l’écran verrouillé et dans la Dynamic Island.', 'Progress and rest on the lock screen and in the Dynamic Island.') : L('Notification persistante avec progression et compte à rebours.', 'Ongoing notification with progress and countdown.')}
      checked={prefs.liveActivity !== false} onChange={v => setPrefs({ liveActivity: v })}
    />
    {!activityEnabled && <Row label={L('Autorisation nécessaire', 'Permission needed')} hint={ios ? L('Réglages iPhone → Lift → Activités en direct.', 'iPhone Settings → Lift → Live Activities.') : L('Autorise les notifications de Lift pour afficher le suivi.', 'Allow Lift notifications to show workout tracking.')} />}
    <Toggle label={L('Notification de fin de repos', 'End-of-rest notification')}
      hint={permission
        ? L('Une alerte en fin de repos, avec les actions +30 s et Reprendre la séance.', 'An alert when your rest ends, with +30 s and Resume workout actions.')
        : L('Active pour autoriser les alertes de Lift sur cet appareil.', 'Turn on to allow Lift alerts on this device.')}
      checked={prefs.notifications && permission} onChange={v => { if (v) void enableAlerts(); else setPrefs({ notifications: false }) }} />
    {!ios && <Row label={L('Précision du minuteur', 'Timer accuracy')}
      hint={L('Autorise les alarmes et rappels pour recevoir l’alerte au bon moment en arrière-plan.', 'Allow alarms and reminders for timely background alerts.')}
      right={<Button size="sm" variant="soft" icon={<Settings size={16} aria-hidden />} onClick={() => void LocalNotifications.changeExactNotificationSetting().catch(() => notify(L('Ouvre les autorisations de Lift dans les réglages de l’appareil.', 'Open Lift permissions in your device settings.')))}>{L('Réglages', 'Settings')}</Button>} />}
  </>
}
