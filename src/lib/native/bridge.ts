import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { L } from '../i18n'
import type { WorkoutActivityState } from './snapshot'
import type { NativeRestAction } from './restActions'

export const isNative = () => Capacitor.isNativePlatform()
export interface ActivityStatus { supported: boolean; enabled: boolean; apiLevel?: number }
export const WorkoutActivity = registerPlugin<{
  status(): Promise<ActivityStatus>
  setAppIcon(options: { accent: 'blue' | 'orange' }): Promise<{ applied: boolean }>
  sync(options: { state: WorkoutActivityState | null; enabled?: boolean; notificationsEnabled?: boolean; sound?: boolean }): Promise<void>
  pendingAction(): Promise<{ action?: NativeRestAction }>
  acknowledgeAction(options: { id: string }): Promise<{ acknowledged: boolean }>
  performAction(options: { action: 'add30' | 'skip'; workoutId: string; expectedRestEndAt: number }): Promise<{ applied: boolean }>
  addListener(event: 'actionPerformed', listener: () => void): Promise<PluginListenerHandle>
}>('WorkoutActivity')

// Effective device permission is separate from the user's desired alert setting.
let notificationPermission: boolean | null = null
const permissionListeners = new Set<() => void>()
export const nativeNotificationPermissionSnapshot = () => notificationPermission
export function subscribeNativeNotificationPermission(listener: () => void) {
  permissionListeners.add(listener)
  return () => { permissionListeners.delete(listener) }
}

/** Checking never prompts. Requests are reserved for an explicit user action. */
export async function nativeNotificationPermissionStatus(request = false) {
  if (!isNative()) return 'unsupported' as const
  const current = await LocalNotifications.checkPermissions()
  const status = request && (current.display === 'prompt' || current.display === 'prompt-with-rationale')
    ? (await LocalNotifications.requestPermissions()).display : current.display
  const allowed = status === 'granted'
  if (allowed !== notificationPermission) {
    notificationPermission = allowed
    permissionListeners.forEach(listener => listener())
  }
  return status
}

export async function nativeNotificationPermission(request = false): Promise<boolean> {
  return await nativeNotificationPermissionStatus(request) === 'granted'
}

const REST_ID = 7401
export async function syncRestAlert(state: WorkoutActivityState | null, enabled: boolean, sound: boolean): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
  await LocalNotifications.removeDeliveredNotificationsById({ ids: [REST_ID] })
  // Refresh even after expiry: permission may have changed while the app was hidden.
  if (!enabled || !state?.restEndAt || !await nativeNotificationPermission()) return
  // Capacitor's default exact schedule can open Android Settings. Only use an
  // existing grant here; permission requests belong to the explicit Settings button.
  const isExactNotification = Capacitor.getPlatform() === 'android'
    ? await LocalNotifications.checkExactNotificationSetting().then(status => status.exact_alarm === 'granted').catch(() => false)
    : undefined
  if (state.restEndAt <= Date.now()) return
  await LocalNotifications.schedule({ notifications: [{
    id: REST_ID, title: state.restLabel === 'Repos' ? 'Repos terminé' : 'Rest over',
    body: `${state.exercise} · ${state.setLabel}${state.detail ? ` · ${state.detail}` : ''}`,
    schedule: { at: new Date(state.restEndAt), allowWhileIdle: true },
    isExactNotification,
    // Android 7 has no silent channel and Capacitor defaults a missing sound
    // to the system alert. A bundled silent sample preserves the user's choice.
    sound: sound ? 'default' : Capacitor.getPlatform() === 'android' ? 'lift_silence.wav' : undefined,
    channelId: sound ? 'lift-rest-sound' : 'lift-rest-silent',
    actionTypeId: state.restLabel === 'Repos' ? 'lift-rest-fr' : 'lift-rest-en',
    extra: { route: 'seance', workoutId: state.workoutId, restEndAt: state.restEndAt },
  }] })
}

export async function configureNativeAlerts(): Promise<void> {
  await LocalNotifications.registerActionTypes({ types: [
    { id: 'lift-rest-fr', actions: [
      { id: 'lift-rest-add30', title: '+30 s', foreground: true },
      { id: 'lift-rest-resume', title: 'Reprendre la séance', foreground: true },
    ] },
    { id: 'lift-rest-en', actions: [
      { id: 'lift-rest-add30', title: '+30 s', foreground: true },
      { id: 'lift-rest-resume', title: 'Resume workout', foreground: true },
    ] },
  ] })
  if (Capacitor.getPlatform() !== 'android') return
  const status = await WorkoutActivity.status()
  if ((status.apiLevel ?? 0) < 26) return // Android 7 has no notification channels.
  await LocalNotifications.createChannel({ id: 'lift-rest-sound', name: L('Lift — repos', 'Lift — rest'), importance: 4, vibration: true })
  await LocalNotifications.createChannel({ id: 'lift-rest-silent', name: L('Lift — repos silencieux', 'Lift — silent rest'), importance: 2, vibration: false })
}
