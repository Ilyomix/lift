import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultState, makeBackup, normalizeState, parseBackup } from '../src/lib/backup'

test('different imported photos sharing an id receive distinct persistent keys', () => {
  const photos = ['a', 'b', 'c'].map((value, i) => ({ id: i < 2 ? 'photo' : 'photo-import-1', date: '2026-10-07', name: value, dataUrl: `data:image/jpeg;base64,${value}` }))
  const parsed = parseBackup(JSON.stringify(makeBackup(defaultState(), photos)))
  assert.equal(new Set(parsed.photos.map(photo => photo.id)).size, 3)
  assert.equal(parsed.photos[0].id, 'photo', 'keep an existing visual-goal reference on the first occurrence')
  assert.equal(new Map(parsed.photos.map(photo => [photo.id, photo])).size, 3, 'IndexedDB put must not silently replace a different photo')
})

test('malformed optional video settings cannot reach the string input in ExerciseSheet', () => {
  const state = normalizeState({ ...defaultState(), exerciseVideos: { 'chest-press': {}, 'lat-pulldown': 42, valid: 'https://youtu.be/abcdefghijk' } })
  assert.deepEqual(state.exerciseVideos, { valid: 'https://youtu.be/abcdefghijk' })
})

test('an invalid optional rest timestamp is discarded without rejecting the rest of a backup', () => {
  const state = { ...defaultState(), activeWorkout: { id: 'active', type: 'UPPER', exercises: [], timer: { endAt: 1e100, total: 60 } } }
  const parsed = parseBackup(JSON.stringify(makeBackup(state as any, [])))
  assert.equal(parsed.state.activeWorkout?.timer, null)
  assert.equal(parsed.state.activeWorkout?.id, 'active')
})

test('invalid imported reminder preferences cannot create malformed calendar times or truthy false permissions', () => {
  const state = normalizeState({ ...defaultState(), prefs: { trainingTime: 19, weighInTime: '99:75', notifications: 'false', sound: 'false', wakeLock: null } })
  assert.equal(state.prefs.trainingTime, '18:00')
  assert.equal(state.prefs.weighInTime, '07:30')
  assert.equal(state.prefs.notifications, false)
  assert.equal(typeof state.prefs.sound, 'boolean')
  assert.equal(typeof state.prefs.wakeLock, 'boolean')
})
