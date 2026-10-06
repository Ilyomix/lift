import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { Capacitor, type PermissionState } from '@capacitor/core'

// Exercise the real Capacitor proxy against a native transport stub, never a device prompt.
const cap = Capacitor as typeof Capacitor & {
  PluginHeaders?: { name: string; methods: { name: string; rtype: string }[] }[]
  nativePromise?: (plugin: string, method: string) => Promise<{ display: PermissionState }>
}
const original = { headers: cap.PluginHeaders, promise: cap.nativePromise, native: cap.isNativePlatform }
let native = true
let status: PermissionState = 'prompt'
let answer: PermissionState = 'granted'
let error: Error | null = null
const calls: string[] = []
cap.isNativePlatform = () => native
cap.PluginHeaders = [{ name: 'LocalNotifications', methods: ['checkPermissions', 'requestPermissions'].map(name => ({ name, rtype: 'promise' })) }]
cap.nativePromise = async (plugin, method) => {
  assert.equal(plugin, 'LocalNotifications')
  calls.push(method)
  if (error) throw error
  if (method === 'requestPermissions') status = answer
  return { display: status }
}
const { nativeNotificationPermission, nativeNotificationPermissionStatus } = await import('../src/lib/native/bridge')

beforeEach(() => { native = true; status = 'prompt'; answer = 'granted'; error = null; calls.length = 0 })
after(() => { cap.PluginHeaders = original.headers; cap.nativePromise = original.promise; cap.isNativePlatform = original.native })

test('permission inspection and revisiting are read-only until the user explicitly requests it', async () => {
  assert.equal(await nativeNotificationPermissionStatus(), 'prompt')
  assert.equal(await nativeNotificationPermission(), false)
  assert.deepEqual(calls, ['checkPermissions', 'checkPermissions'])
  assert.equal(await nativeNotificationPermissionStatus(true), 'granted')
  assert.deepEqual(calls.slice(2), ['checkPermissions', 'requestPermissions'])
  assert.equal(await nativeNotificationPermission(true), true)
  assert.equal(calls.filter(c => c === 'requestPermissions').length, 1, 'already granted does not ask again')
})

test('denial is preserved without another prompt, and a grant in device settings is read on return', async () => {
  answer = 'denied'
  assert.equal(await nativeNotificationPermission(true), false)
  calls.length = 0
  assert.equal(await nativeNotificationPermissionStatus(true), 'denied')
  assert.deepEqual(calls, ['checkPermissions'])
  status = 'granted'
  assert.equal(await nativeNotificationPermissionStatus(), 'granted')
  assert.deepEqual(calls, ['checkPermissions', 'checkPermissions'])
})

test('Android rationale still requires an explicit request; web never invokes native notification APIs', async () => {
  status = 'prompt-with-rationale'
  assert.equal(await nativeNotificationPermissionStatus(), 'prompt-with-rationale')
  assert.deepEqual(calls, ['checkPermissions'])
  assert.equal(await nativeNotificationPermission(true), true)
  assert.deepEqual(calls, ['checkPermissions', 'checkPermissions', 'requestPermissions'])
  native = false
  calls.length = 0
  assert.equal(await nativeNotificationPermissionStatus(true), 'unsupported')
  assert.equal(await nativeNotificationPermission(), false)
  assert.deepEqual(calls, [])
})

test('a native transport error is not reported as a grant or a user denial', async () => {
  error = new Error('permission transport unavailable')
  await assert.rejects(nativeNotificationPermissionStatus(true), error)
  assert.deepEqual(calls, ['checkPermissions'])
})
