import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { Capacitor, type PermissionState } from '@capacitor/core'
import { defaultState } from '../src/lib/backup'
import { workoutActivityState } from '../src/lib/native/snapshot'

// Exercise real bridge/effects against native transport, audio and hook hosts;
// no notification permission prompt or physical device is used by these tests.
const cap = Capacitor as any
const original = { headers: cap.PluginHeaders, promise: cap.nativePromise, native: cap.isNativePlatform, platform: cap.getPlatform }
let permission: PermissionState = 'granted'
let exactPermission: PermissionState = 'denied'
let platform = 'ios'
const calls: string[] = []
const scheduled: any[] = []
cap.isNativePlatform = () => true
cap.getPlatform = () => platform
cap.PluginHeaders = [{ name: 'LocalNotifications', methods: ['cancel', 'removeDeliveredNotificationsById', 'checkPermissions', 'checkExactNotificationSetting', 'schedule'].map(name => ({ name, rtype: 'promise' })) }]
cap.nativePromise = async (_plugin: string, method: string, options: any) => {
  calls.push(method)
  if (method === 'schedule') scheduled.push(...options.notifications)
  if (method === 'checkExactNotificationSetting') return { exact_alarm: exactPermission }
  return method === 'checkPermissions' ? { display: permission } : {}
}
const { nativeNotificationPermission, nativeNotificationPermissionSnapshot, subscribeNativeNotificationPermission, syncRestAlert } = await import('../src/lib/native/bridge')
const { SessionEffects } = await import('../src/components/RestTimer')
const { unlockAudio } = await import('../src/lib/alerts')
const { useStore } = await import('../src/lib/store')

let beeps = 0, vibrations = 0
const globals = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
const oldVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate')
const documentStub = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
const fakeGain = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
class FakeAudioContext {
  state = 'running'; currentTime = 0; destination = {}
  createGain() { return fakeGain }
  createOscillator() { return { type: '', frequency: { value: 0 }, connect: () => fakeGain, start: () => beeps++, stop() {} } }
}
Object.defineProperty(globalThis, 'document', { value: documentStub, configurable: true })
Object.defineProperty(globalThis, 'window', { value: { AudioContext: FakeAudioContext, setInterval: () => 0, clearInterval() {} }, configurable: true })
Object.defineProperty(navigator, 'vibrate', { value: () => { vibrations++; return true }, configurable: true })
unlockAudio()

function prepare(endAt = Date.now() - 100) {
  const state = defaultState()
  const exercise = state.templates.UPPER.exercises[0]
  state.prefs = { ...state.prefs, notifications: true, sound: true, push: false, wakeLock: false }
  state.activeWorkout = {
    id: 'workout', type: 'UPPER', date: '2026-10-07', startedAt: '2026-10-07T10:00:00Z', notes: '',
    timerEndAt: new Date(endAt).toISOString(), timer: { endAt, total: 60, label: exercise.name },
    exercises: [{ ...exercise, notes: '', skipped: false, validated: false, comparison: null,
      sets: [{ weight: 20, reps: null, cleanReps: null, rir: 2, flags: [], note: '', completed: false }],
    }],
  }
  useStore.setState({ ready: true, hasData: false, storage: 'memory', state })
  return workoutActivityState(state.activeWorkout, 'en')!
}

function mountEffects() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const effects: Array<() => unknown> = []
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
      useRef(value: unknown) { const i = cursor++; return slots[i] ??= { current: value } },
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = next }]
      },
      useEffect: (effect: () => unknown) => effects.push(effect),
    }
    try { SessionEffects() } finally { internals.H = previous }
    effects.forEach(effect => effect())
  }
}

beforeEach(() => { permission = 'granted'; exactPermission = 'denied'; platform = 'ios'; calls.length = 0; scheduled.length = 0; beeps = 0; vibrations = 0; documentStub.visibilityState = 'visible' })
after(() => {
  cap.PluginHeaders = original.headers; cap.nativePromise = original.promise; cap.isNativePlatform = original.native; cap.getPlatform = original.platform
  for (const [key, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  if (oldVibrate) Object.defineProperty(navigator, 'vibrate', oldVibrate)
  else Reflect.deleteProperty(navigator, 'vibrate')
})

test('revoked native permission enables one foreground fallback without changing the desired preference', async () => {
  const snapshot = prepare()
  const render = mountEffects()
  await nativeNotificationPermission()
  render()
  assert.deepEqual([beeps, vibrations], [0, 0], 'native alerts own the sound while authorized')
  const changes: Array<boolean | null> = []
  const unsubscribe = subscribeNativeNotificationPermission(() => { changes.push(nativeNotificationPermissionSnapshot()) })
  try {
    permission = 'denied'
    await syncRestAlert(snapshot, true, true) // Return from Settings after the deadline.
    assert.deepEqual(changes, [false])
    assert.equal(calls.includes('schedule'), false)
    render(); render()
    assert.deepEqual([beeps, vibrations], [3, 1])
    assert.equal(useStore.getState().state.prefs.notifications, true)
  } finally { unsubscribe() }
})

test('authorized native alerts do not duplicate sound in the app and grants resume scheduling', async () => {
  permission = 'denied'
  await nativeNotificationPermission()
  permission = 'granted'
  const snapshot = prepare(Date.now() + 60_000)
  await syncRestAlert(snapshot, true, true)
  assert.equal(calls.filter(call => call === 'schedule').length, 1)
  assert.equal(nativeNotificationPermissionSnapshot(), true)
  prepare()
  const render = mountEffects()
  render(); render()
  assert.deepEqual([beeps, vibrations], [0, 0])
})

test('denied permission never replays old or background rest alerts', async () => {
  permission = 'denied'
  await nativeNotificationPermission()
  prepare(Date.now() - 5000)
  mountEffects()()
  prepare()
  documentStub.visibilityState = 'hidden'
  mountEffects()()
  assert.deepEqual([beeps, vibrations], [0, 0])
})

test('Android rest scheduling uses an existing exact-alarm grant without implicitly requesting one', async () => {
  platform = 'android'
  const snapshot = prepare(Date.now() + 60_000)
  await syncRestAlert(snapshot, true, true)
  assert.equal(scheduled[0].isExactNotification, false, 'the default true would open Android Settings during the workout')
  exactPermission = 'granted'
  await syncRestAlert(snapshot, true, true)
  assert.equal(scheduled[1].isExactNotification, true)
  assert.equal(calls.filter(call => call === 'checkExactNotificationSetting').length, 2)
  assert.equal(calls.some(call => call.startsWith('request') || call.startsWith('change')), false)
  platform = 'ios'
  await syncRestAlert(snapshot, true, true)
  assert.equal(scheduled[2].isExactNotification, undefined)
  assert.equal(calls.filter(call => call === 'checkExactNotificationSetting').length, 2)
})

test('sound disabled stays silent on Android before notification channels and on iOS', async () => {
  platform = 'android'
  const snapshot = prepare(Date.now() + 60_000)
  await syncRestAlert(snapshot, true, false)
  assert.equal(scheduled[0].sound, 'lift_silence.wav')
  assert.equal(scheduled[0].channelId, 'lift-rest-silent')
  const wav = readFileSync(new URL('../android/app/src/main/res/raw/lift_silence.wav', import.meta.url))
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF')
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE')
  assert.equal(wav.toString('ascii', 36, 40), 'data')
  assert.equal(wav.readUInt32LE(40), wav.length - 44)
  assert.equal(wav.subarray(44).some(byte => byte !== 0), false, 'PCM samples contain only silence')
  platform = 'ios'
  await syncRestAlert(snapshot, true, false)
  assert.equal(scheduled[1].sound, undefined)
  await syncRestAlert(snapshot, true, true)
  assert.equal(scheduled[2].sound, 'default')
})
