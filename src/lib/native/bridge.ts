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

/** Checking never prompts. Requests are reserved for an explicit user action. */
export async function nativeNotificationPermissionStatus(request = false) {
  if (!isNative()) return 'unsupported' as const
  const current = await LocalNotifications.checkPermissions()
  if (!request || (current.display !== 'prompt' && current.display !== 'prompt-with-rationale')) return current.display
  return (await LocalNotifications.requestPermissions()).display
}

export async function nativeNotificationPermission(request = false): Promise<boolean> {
  return await nativeNotificationPermissionStatus(request) === 'granted'
}

const REST_ID = 7401
export async function syncRestAlert(state: WorkoutActivityState | null, enabled: boolean, sound: boolean): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
  await LocalNotifications.removeDeliveredNotificationsById({ ids: [REST_ID] })
  if (!enabled || !state?.restEndAt || state.restEndAt <= Date.now() || !await nativeNotificationPermission()) return
  await LocalNotifications.schedule({ notifications: [{
    id: REST_ID, title: state.restLabel === 'Repos' ? 'Repos terminé' : 'Rest over',
    body: `${state.exercise} · ${state.setLabel}${state.detail ? ` · ${state.detail}` : ''}`,
    schedule: { at: new Date(state.restEndAt), allowWhileIdle: true },
    sound: sound ? 'default' : undefined,
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
