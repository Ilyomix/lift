import assert from 'node:assert/strict'
import test from 'node:test'
import { pageOffsets, routeDirection, settlePageEntrance } from '../src/lib/routeTransition'

test('settling page motion consumes only the current screen entrance, so cleanup cannot replay its fade', () => {
  const page = { classList: new Set(['screen-in', 'safe-top', 'mx-auto']) }
  const modal = { classList: new Set(['sheet-enter', 'bg-surface']) }
  const untouched = { classList: new Set(['screen-in', 'safe-top']) }
  const root = (children: typeof page[]) => ({
    querySelectorAll: (selector: string) => children
      .filter(child => child.classList.has(selector.slice(1)))
      .map(child => ({ classList: { remove: (name: string) => child.classList.delete(name) } })),
  }) as unknown as HTMLElement
  const screen = root([page, modal])
  settlePageEntrance(screen)
  assert.equal(page.classList.has('screen-in'), false, 'arrival remains fully visible when temporary suppression is removed')
  assert.deepEqual([...page.classList], ['safe-top', 'mx-auto'], 'layout classes remain intact')
  assert.equal(modal.classList.has('sheet-enter'), true, 'panel entrances keep their own lifecycle')
  assert.equal(untouched.classList.has('screen-in'), true, 'initial presentation of another screen is unaffected')
  settlePageEntrance(screen)
  assert.equal(page.classList.has('screen-in'), false, 'cancellation, invalidation and disposal cannot rearm the entrance')
})

test('paired pages cover the viewport without a gap or overlap throughout either swipe', () => {
  for (const width of [320, 390, 640]) {
    for (const direction of [-1, 1]) {
      for (const progress of [0, 0.02, 0.25, 0.5, 0.8, 1]) {
        const positions = pageOffsets(direction * width * progress, direction, width)
        const pages = [positions.outgoing, positions.incoming].map(left => ({
          left: Math.max(0, left), right: Math.min(width, left + width),
        }))
        const visible = pages.reduce((sum, page) => sum + Math.max(0, page.right - page.left), 0)
        const overlap = Math.max(0, Math.min(...pages.map(p => p.right)) - Math.max(...pages.map(p => p.left)))
        assert.ok(Math.abs(visible - width) < 0.000001, `viewport ${width}, direction ${direction}, progress ${progress}`)
        assert.ok(overlap < 0.000001, 'no opaque layer can cover part of the other page')
        if (progress === 0) assert.equal(Math.abs(positions.outgoing), 0)
        if (progress === 1) assert.equal(positions.incoming, 0, 'destination finishes at its natural position')
      }
    }
  }
})

test('a released partial drag continues from both existing page positions', () => {
  for (const direction of [-1, 1]) {
    const drag = pageOffsets(direction * 87, direction, 390)
    const halfway = pageOffsets(direction * (87 + (390 - 87) / 2), direction, 390)
    const end = pageOffsets(direction * 390, direction, 390)
    assert.equal(halfway.outgoing - drag.outgoing, halfway.incoming - drag.incoming,
      'outgoing and incoming pages move by the same distance during completion')
    assert.equal(end.incoming, 0)
    assert.ok(Math.abs(end.outgoing) >= 390, 'old page exits completely')
    const cancelled = pageOffsets(0, direction, 390)
    assert.equal(cancelled.outgoing, 0)
    assert.equal(Math.abs(cancelled.incoming), 390, 'cancel removes the destination completely')
  }
})

test('main page direction follows the tab order rather than the history insertion order', () => {
  assert.equal(routeDirection('', 'seance', 0, 1), -1)
  assert.equal(routeDirection('seance', 'calendrier/programme', 1, 2), -1)
  assert.equal(routeDirection('progres/seances', 'calendrier/programme', 4, 5), 1)
  assert.equal(routeDirection('plus', 'progres/corps', 7, 8), 1)
})

test('secondary routes and replaced sub-tabs use the actual history direction', () => {
  assert.equal(routeDirection('plus', 'plus/reglages', 2, 3), -1)
  assert.equal(routeDirection('plus/reglages', 'plus', 3, 2), 1)
  assert.equal(routeDirection('calendrier/programme/PUSH', 'calendrier/programme', 6, 5), 1)
  assert.equal(routeDirection('progres/exercice/chest-press', 'progres/corps', 3, 2), 1)
  assert.equal(routeDirection('calendrier', 'calendrier/programme', 1, 1), -1)
})
