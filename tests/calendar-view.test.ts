import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CalendarScreen } from '../src/screens/Calendar'
import { defaultState } from '../src/lib/backup'
import { addDays, fmtDate } from '../src/lib/date'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalState = useStore.getInitialState().state
const originalLanguage = lang()
beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T12:00:00Z') })
  setLang('en')
  configurePlan(DEFAULT_GOAL)
  useStore.getInitialState().state = defaultState()
})
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
  useStore.getInitialState().state = originalState
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

function render(saved: Record<string, unknown> = {}) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { history: { state: saved } } })
  return renderToStaticMarkup(createElement(CalendarScreen))
}
const days = (html: string) => [...html.matchAll(/<button\b[^>]*aria-label="([^"]+)"[^>]*>/g)]
  .map(match => match[1]).filter(label => / : (?:\w+ planned|\w+ done|Rest|No workout|Paused)/.test(label))

test('week view restores legacy month-only history without losing the visited month or hiding dates', () => {
  for (const [saved, monday] of [
    [{}, '2026-10-05'],
    [{ liftCalendarMonth: '2026-10' }, '2026-10-05'],
    [{ liftCalendarMonth: '2026-11' }, '2026-10-26'],
    [{ liftCalendarMonth: '2027-01' }, '2026-12-28'],
    [{ liftCalendarMonth: '2026-10', liftCalendarWeek: '2026-02-30' }, '2026-10-05'],
  ] as Array<[Record<string, unknown>, string]>) {
    const html = render(saved), labels = days(html)
    assert.equal(labels.length, 7, JSON.stringify(saved))
    for (let i = 0; i < 7; i++) assert.ok(labels.some(label => label.startsWith(`${fmtDate(addDays(monday, i), { weekday: true, long: true })} : `)))
    assert.match(html, /aria-label="Previous week"/)
    assert.match(html, /Show month/)
  }
})

test('returning from a workout preserves saved week, month expansion and the week across a year boundary', () => {
  const saved = { liftCalendarMonth: '2027-01', liftCalendarWeek: '2026-12-28', liftCalendarExpanded: false }
  const compact = render(saved)
  assert.equal(days(compact).length, 7)
  assert.match(compact, /aria-label="Calendar legend"/)
  assert.doesNotMatch(compact, /UP Upper|LO Lower|Plan the week of/)
  assert.match(compact, /28 Dec – 3 Jan/)
  const expanded = render({ ...saved, liftCalendarExpanded: true })
  assert.ok(days(expanded).length >= 28)
  assert.match(expanded, /aria-label="Calendar legend"/)
  assert.doesNotMatch(expanded, /UP Upper|LO Lower|Plan the week of/)
  assert.match(expanded, /January/)
  assert.match(expanded, /aria-label="Previous month"/)
  assert.match(expanded, /Show week/)
  assert.equal(render(saved), compact, 'collapsing or restoring the history entry returns to the same week')
})

test('week summary includes an active workout and gives the exact total above the weekly target', () => {
  const snapshot = useStore.getInitialState()
  snapshot.state = { ...snapshot.state, activeWorkout: {
    id: 'active', date: '2026-10-07', type: 'PULL', startedAt: '2026-10-07T12:00:00Z',
    exercises: [], notes: '', timer: null, timerEndAt: null,
  }, workouts: ['2026-10-05', '2026-10-05', '2026-10-06'].map((date, i) => ({
    id: `done-${i}`, date, type: 'UPPER', sessionNumber: i + 1, startedAt: `${date}T10:00:00Z`,
    completedAt: `${date}T11:00:00Z`, exercises: [], notes: '',
  })) }
  const html = render()
  assert.match(html, /3 done · 1 in progress · 3 upcoming/)
  assert.match(html, /7 workouts this week instead of 5/)
})
