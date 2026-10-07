import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { buildIcs, firstTrainingDate, icsEventCount, type IcsOptions } from '../src/lib/ics'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, GOAL_DATE, projectSessions, scheduleFromDays } from '../src/lib/program'

const originalLanguage = lang()
const training: IcsOptions = { training: true, weighIn: false, waist: false, photos: false, deloads: false, phases: false }
const all: IcsOptions = { training: true, weighIn: true, waist: true, photos: true, deloads: true, phases: true }
const events = (ics: string) => ics.replace(/\r\n /g, '').split('BEGIN:VEVENT\r\n').slice(1).map(event => event.split('END:VEVENT')[0])
const starts = (ics: string) => events(ics).map(event => event.match(/^DTSTART(?:;VALUE=DATE)?:(\d{8})/m)![1])

beforeEach(() => {
  setLang('en')
  configurePlan('2026-12-23', null, null, null, { start: '2026-09-28', foundation: null })
})
afterEach(() => { setLang(originalLanguage); configurePlan(DEFAULT_GOAL) })

test('a weekday with rotating workouts has an honest generic title and an explicitly estimated duration in FR and EN', () => {
  for (const locale of ['fr', 'en'] as const) {
    setLang(locale)
    configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-09-28', foundation: null, maintenance: true, today: '2026-10-05', days: 3 })
    const state = { ...defaultState(), schedule: scheduleFromDays([1, 4, 6]) }
    const before = structuredClone(state)
    const mondays = projectSessions(state, GOAL_DATE, '2026-10-05').filter(item => ['2026-10-05', '2026-10-12', '2026-10-19'].includes(item.date))
    assert.deepEqual(mondays.map(item => item.type), ['UPPER', 'PULL', 'LOWER'])
    const monday = events(buildIcs(state, training, '2026-10-05')).find(event => event.includes('UID:golgoth-training-MO@'))!
    assert.match(monday, locale === 'fr' ? /^SUMMARY:Séance · Lift$/m : /^SUMMARY:Workout · Lift$/m)
    assert.match(monday, locale === 'fr' ? /Durée estimée : \d+ min/ : /Estimated duration: \d+ min/)
    assert.doesNotMatch(monday, /SUMMARY:.*Upper/)
    assert.match(monday, /RRULE:FREQ=WEEKLY;BYDAY=MO;/, 'keep existing weekday UIDs and recurrence')
    assert.deepEqual(state, before)
  }
})

test('a stable five-day weekday keeps its specific workout title', () => {
  const monday = events(buildIcs(defaultState(), training, '2026-10-05')).find(event => event.includes('UID:golgoth-training-MO@'))!
  assert.match(monday, /^SUMMARY:Upper workout · Lift$/m)
})

test('a one-week schedule change cannot leave a stale workout type in subsequent reminders', () => {
  const state = defaultState()
  state.weekSchedules = { '2026-10-12': { days: [1, 2, 5, 6], target: 4 } }
  const mondays = projectSessions(state, GOAL_DATE, '2026-10-05').filter(item => ['2026-10-05', '2026-10-19'].includes(item.date))
  assert.deepEqual(mondays.map(item => item.type), ['UPPER', 'LEGS'])
  const monday = events(buildIcs(state, training, '2026-10-05')).find(event => event.includes('UID:golgoth-training-MO@'))!
  assert.match(monday, /^SUMMARY:Workout · Lift$/m)
})

test('a first Sunday after the goal creates no waist or photo reminder', () => {
  const state = defaultState()
  const measurements = { ...training, training: false, waist: true, photos: true }
  assert.equal(icsEventCount(buildIcs(state, measurements, '2026-12-22')), 0)
  assert.ok(starts(buildIcs(state, all, '2026-12-22')).every(date => date <= '20261223'))
})

test('after the dated goal the export is a valid empty calendar, with no past goal event', () => {
  const state = defaultState()
  const ics = buildIcs(state, all, '2026-12-24')
  assert.equal(icsEventCount(ics), 0)
  assert.equal(firstTrainingDate(state, '2026-12-24'), null)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
})

test('the goal day itself is inclusive for reminders and the goal event', () => {
  configurePlan('2026-12-27', null, null, null, { start: '2026-09-28', foundation: null })
  const ics = buildIcs(defaultState(), { ...all, training: false, deloads: false }, '2026-12-27')
  assert.equal(icsEventCount(ics), 4)
  assert.ok(starts(ics).every(date => date === '20261227'))
})

test('maintenance exports remain available beyond the former dated goal', () => {
  configurePlan(DEFAULT_GOAL, null, null, null, { start: '2026-09-28', foundation: null, maintenance: true, today: '2027-08-01' })
  const ics = buildIcs(defaultState(), all, '2027-08-01')
  assert.ok(icsEventCount(ics) > 3)
  assert.doesNotMatch(ics, /UID:golgoth-goal@/)
  assert.ok(starts(ics).every(date => date <= GOAL_DATE.replace(/-/g, '')))
})
