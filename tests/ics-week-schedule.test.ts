import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { addDays } from '../src/lib/date'
import { buildIcs, firstTrainingDate, type IcsOptions } from '../src/lib/ics'
import { configurePlan, DEFAULT_GOAL, projectSessions } from '../src/lib/program'

const TODAY = '2026-10-05'
const END = '2026-12-23'
const options: IcsOptions = { training: true, weighIn: false, waist: false, photos: false, deloads: false, phases: false }
const iso = (compact: string) => `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`

/** Expand the actual recurrence and exclusions written to the calendar file. */
function trainingDates(ics: string): string[] {
  const dates: string[] = []
  const events = ics.replace(/\r\n /g, '').split('BEGIN:VEVENT\r\n').slice(1)
  for (const event of events) {
    const start = iso(event.match(/^DTSTART:(\d{8})T/m)![1])
    const until = event.match(/^RRULE:FREQ=WEEKLY;BYDAY=\w+;UNTIL=(\d{8})T/m)?.[1]
    const excluded = new Set((event.match(/^EXDATE:([^\r\n]+)/m)?.[1] ?? '').split(',').filter(Boolean).map(iso))
    if (until) {
      for (let date = start; date <= iso(until); date = addDays(date, 7)) {
        if (!excluded.has(date)) dates.push(date)
      }
    } else dates.push(start)
  }
  return dates.sort()
}

beforeEach(() => configurePlan(END, null, null, null, { start: '2026-09-28', foundation: null }))
afterEach(() => configurePlan(DEFAULT_GOAL))

test('calendar reminders follow moved and added days without changing the following weeks', () => {
  const state = defaultState()
  state.weekSchedules = { '2026-10-12': { days: [1, 2, 3, 5, 6], target: 5 } }
  const ics = buildIcs(state, options, TODAY)
  const actual = trainingDates(ics)
  assert.deepEqual(actual, projectSessions(state, END, TODAY).map(session => session.date))
  assert.ok(actual.includes('2026-10-14'), 'Wednesday was explicitly added')
  assert.ok(!actual.includes('2026-10-15'), 'Thursday was moved to recovery')
  assert.ok(actual.includes('2026-10-22'), 'next Thursday remains on the regular schedule')
  assert.match(ics, /UID:golgoth-training-TH@golgoth/)
  assert.match(ics, /EXDATE:20261015T180000/)
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75)
})

test('empty week and recorded workouts suppress only their own reminders', () => {
  const state = defaultState()
  state.weekSchedules = { [TODAY]: { days: [], target: 0 } }
  state.workouts = [{ id: 'done', date: '2026-10-15', type: 'UPPER', sessionNumber: 1, startedAt: '2026-10-15T12:00:00', completedAt: '2026-10-15T13:00:00', exercises: [], notes: '' }]
  assert.equal(firstTrainingDate(state, TODAY), '2026-10-12')
  assert.deepEqual(trainingDates(buildIcs(state, options, TODAY)), projectSessions(state, END, TODAY).map(session => session.date))
  assert.ok(!trainingDates(buildIcs(state, options, TODAY)).includes('2026-10-15'))
})

test('paused sessions do not become calendar alarms, and dated return matches the app', () => {
  const state = defaultState()
  state.programPause = { active: true, startedAt: `${TODAY}T08:00:00`, plannedEnd: '2026-10-11', history: [] }
  assert.equal(firstTrainingDate(state, TODAY), '2026-10-12')
  assert.deepEqual(trainingDates(buildIcs(state, options, TODAY)), projectSessions(state, END, TODAY).map(session => session.date))
  state.programPause.plannedEnd = null
  assert.equal(firstTrainingDate(state, TODAY), null)
  assert.deepEqual(trainingDates(buildIcs(state, options, TODAY)), [], 'tentative outlook is not a promise to train')
})
