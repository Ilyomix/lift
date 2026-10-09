import assert from 'node:assert/strict'
import test from 'node:test'
import { browseExercises } from '../src/lib/encyclopedia'
import { setLang } from '../src/lib/i18n'
import { LIBRARY } from '../src/lib/library'

const ids = (groups: ReturnType<typeof browseExercises>) => groups.flatMap(g => g.items.map(x => x.id))

test('the encyclopedia lists every exercise once, under a muscle or among the others', () => {
  const all = ids(browseExercises(''))
  assert.equal(all.length, Object.keys(LIBRARY).length)
  assert.deepEqual([...new Set(all)].sort(), Object.keys(LIBRARY).sort())
  assert(browseExercises('').some(g => g.muscle === 'other' && g.items.some(x => x.id === 'hip-adduction')))
})

test('search ignores accents and case, in either language or by the English identifier', () => {
  try {
    setLang('fr')
    assert(ids(browseExercises('DEVELOPPE couche')).includes('db-bench-press'))
    assert(ids(browseExercises('bench press')).includes('db-bench-press'))
    assert.deepEqual(browseExercises('zzz'), [])
  } finally { setLang('en') }
})

test('muscle and equipment filters keep direct work and the right place', () => {
  const glutes = browseExercises('', 'glutes')
  assert.equal(glutes.length, 1)
  assert(glutes[0].items.every(x => x.groups.glutes === 1))
  assert(glutes[0].items.some(x => x.id === 'romanian-deadlift'), 'filed under hamstrings, still listed for glutes')
  assert(ids(browseExercises('', 'all', 'home')).every(id => LIBRARY[id].requires))
  assert(ids(browseExercises('', 'all', 'gym')).every(id => !LIBRARY[id].requires))
})
