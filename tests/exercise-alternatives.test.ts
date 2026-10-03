import assert from 'node:assert/strict'
import test from 'node:test'
import { alternativeEquipment, alternativesFor } from '../src/lib/exerciseAlternatives'
import { LIBRARY } from '../src/lib/library'
import { setLang } from '../src/lib/i18n'

test('machine alternatives cover multiple useful options without unrelated muscle swaps', () => {
  assert(alternativesFor('chest-press').length >= 5)
  assert(alternativesFor('triceps-overhead-rope').length >= 5)
  assert.deepEqual(alternativesFor('shoulder-press-machine').map(info => info.id), ['db-shoulder-press', 'pike-push-up'])
  assert.deepEqual(alternativesFor('leg-extension').map(info => info.id), ['sissy-squat'])
  assert(!alternativesFor('leg-curl').some(info => info.id === 'romanian-deadlift'))
  assert.deepEqual(alternativesFor('custom-import'), [])
  for (const id of Object.keys(LIBRARY)) {
    const choices = alternativesFor(id)
    assert(choices.every(info => info.id !== id && LIBRARY[info.id] && info.cues.length > 0))
    assert.equal(choices.length, new Set(choices.map(info => info.id)).size)
  }
})

test('home alternatives use owned equipment and still let people browse all choices', () => {
  const none = { place: 'home' as const, equipment: [] }
  assert.deepEqual(alternativesFor('chest-press', none).map(info => info.id), ['push-up', 'feet-elevated-push-up', 'close-grip-push-up'])
  assert.deepEqual(alternativesFor('triceps-overhead-rope', none), [])
  const bands = alternativesFor('triceps-overhead-rope', { place: 'home', equipment: ['bands'] }).map(info => info.id)
  assert.deepEqual(bands, ['band-overhead-extension', 'band-pushdown'])
  assert(alternativesFor('triceps-overhead-rope').some(info => info.id === 'triceps-rope'))
  assert(!alternativesFor('chest-press', { place: 'home', equipment: ['dumbbells'] }).some(info => info.id === 'db-bench-press'))
})

test('equipment and choice names follow French and English without rebuilding the catalogue', () => {
  try {
    setLang('fr')
    assert.equal(alternativeEquipment('db-bench-press'), 'Haltères · Banc')
    const option = alternativesFor('triceps-overhead-rope')[0]
    assert.match(option.name, /triceps/)
    setLang('en')
    assert.equal(alternativeEquipment('db-bench-press'), 'Dumbbells · Bench')
    assert.equal(alternativeEquipment('lat-pulldown'), 'Machine or cable')
    assert.equal(alternativeEquipment('push-up'), 'Bodyweight')
    assert.match(option.name, /Overhead/)
  } finally { setLang('fr') }
})
