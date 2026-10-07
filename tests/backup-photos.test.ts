import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'

test('backup import preserves different photos with the same size and trailing bytes', () => {
  const image = (color: string) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="${color}"/><!--${' '.repeat(96)}--></svg>`).toString('base64')}`
  const photos = ['red', 'tan'].map((color, i) => ({ id: `photo-${i}`, date: '2026-10-07', dataUrl: image(color), name: `${color}.svg` }))
  assert.notEqual(photos[0].dataUrl, photos[1].dataUrl)
  assert.equal(photos[0].dataUrl.length, photos[1].dataUrl.length)
  assert.equal(photos[0].dataUrl.slice(-64), photos[1].dataUrl.slice(-64))
  const restored = parseBackup(JSON.stringify(makeBackup(defaultState(), [...photos, { ...photos[0], id: 'duplicate' }])))
  assert.deepEqual(restored.photos, photos, 'only a byte-identical photo on the same date is a duplicate')
  assert.equal(restored.summary.photos, 2)
})
