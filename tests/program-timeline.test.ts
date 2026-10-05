import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProgramProgress } from '../src/components/ProgramProgress'
import { addDays, fmtDate } from '../src/lib/date'
import { setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, GOAL_DATE, PERIODS } from '../src/lib/program'
import { calendarMilestonesAt, programTimelineAt } from '../src/lib/programTimeline'

beforeEach(() => { setLang('fr'); configurePlan(DEFAULT_GOAL) })
afterEach(() => { setLang('fr'); configurePlan(DEFAULT_GOAL) })

test('current periods include both date boundaries; past and future never overlap them', () => {
  const original = structuredClone(PERIODS)
  for (const period of PERIODS.filter((p) => p.kind !== 'pre')) {
    for (const date of [period.start, period.end]) {
      const view = programTimelineAt(date)
      assert.equal(view.current?.id, period.id, date)
      assert.ok(view.past.every((p) => p.end < date))
      assert.ok(view.upcoming.every((p) => p.start > date))
      assert.ok(!view.past.includes(period) && !view.upcoming.includes(period))
    }
  }
  assert.deepEqual(PERIODS, original, 'presentation never rewrites the plan')
})

test('before the start and after the last day have no fabricated active block', () => {
  const first = PERIODS.find((p) => p.kind !== 'pre')!
  const before = programTimelineAt(addDays(first.start, -1))
  assert.equal(before.current, null, 'the imported previous program is not the new plan')
  assert.equal(before.upcoming[0], first)
  assert.equal(before.past.length, 0)
  const after = programTimelineAt(addDays(GOAL_DATE, 1))
  assert.equal(after.current, null)
  assert.equal(after.upcoming.length, 0)
  assert.equal(after.past.length, PERIODS.filter((p) => p.kind !== 'pre').length)
  assert.equal(calendarMilestonesAt(addDays(GOAL_DATE, 1)).length, 0)
})

test('an early deload keeps the real block and uses the existing adjusted context', () => {
  configurePlan(DEFAULT_GOAL, { start: '2026-10-13', end: '2026-10-19' })
  const view = programTimelineAt('2026-10-14')
  assert.equal(view.current?.kind, 'block')
  assert.equal(view.context.deload, true)
  assert.equal(view.context.title, 'Semaine allégée anticipée')
  const html = renderToStaticMarkup(createElement(ProgramProgress, { today: '2026-10-14' }))
  assert.match(html, /Semaine allégée anticipée/)
  assert.match(html, /Bloc 1 : /)
})

test('maintenance keeps a current cycle and a short calendar list of useful changes without a goal', () => {
  configurePlan(null, null, null, null, { start: '2026-09-28', foundation: null, maintenance: true, today: '2028-11-02' })
  const view = programTimelineAt('2028-11-02')
  assert.ok(view.current)
  assert.ok(view.upcoming.length)
  const next = calendarMilestonesAt('2028-11-02')
  assert.ok(next.length > 0 && next.length <= 3)
  assert.ok(next.every((m) => m.date >= '2028-11-02' && m.kind !== 'block' && m.kind !== 'goal'))
  const html = renderToStaticMarkup(createElement(ProgramProgress, { today: '2028-11-02' }))
  assert.match(html, /sans date de fin/)
  assert.doesNotMatch(html, /Le plan daté s’est terminé/)
})

test('past blocks are closed by default while current week and future stages remain visible in FR and EN', () => {
  for (const language of ['fr', 'en'] as const) {
    setLang(language)
    configurePlan(DEFAULT_GOAL)
    const date = '2027-02-10'
    const view = programTimelineAt(date)
    assert.ok(view.past.length && view.upcoming.length)
    const html = renderToStaticMarkup(createElement(ProgramProgress, { today: date }))
    const disclosures = [...html.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)]
    const past = disclosures.find((m) => m[2].includes(language === 'fr' ? 'Étapes passées' : 'Past stages'))
    assert.ok(past)
    assert.doesNotMatch(past[1], /\sopen(?:=|\s|$)/)
    const visible = html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, '')
    assert.ok(visible.includes(view.current!.label))
    assert.ok(visible.includes(view.upcoming[0].label))
    assert.ok(!visible.includes(fmtDate(view.past[0].start, { year: true })))
    assert.match(visible, language === 'fr' ? /Semaine \d+ sur \d+/ : /Week \d+ of \d+/)
  }
})
