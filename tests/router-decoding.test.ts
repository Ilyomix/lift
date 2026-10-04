import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeRouteHash } from '../src/lib/router'

test('malformed shared links recover to the home route instead of crashing render', () => {
  for (const hash of ['#/plus/%', '#/plus/%E0%A4%A', '#/progres/exercice/%FF']) {
    assert.deepEqual(decodeRouteHash(hash), [], hash)
  }
})

test('current and historical hash links preserve their routes and encoded IDs', () => {
  assert.deepEqual(decodeRouteHash('#/plus/reglages/apparence'), ['plus', 'reglages', 'apparence'])
  assert.deepEqual(decodeRouteHash('#plus/reglages'), ['plus', 'reglages'])
  assert.deepEqual(decodeRouteHash('#/progres/exercice/tirage%20%C3%A0%20la%20poulie'), ['progres', 'exercice', 'tirage à la poulie'])
  // Decode only once: a literal "%2F" inside an ID must not become a path separator.
  assert.deepEqual(decodeRouteHash('#/progres/exercice/custom%252Frow'), ['progres', 'exercice', 'custom%2Frow'])
  assert.deepEqual(decodeRouteHash('#/'), [])
})
