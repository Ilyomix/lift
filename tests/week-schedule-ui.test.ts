import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WeekScheduleSheet } from '../src/components/WeekScheduleSheet'
import { Button } from '../src/components/ui'
import { defaultState } from '../src/lib/backup'
import { fmtDate } from '../src/lib/date'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, weekSchedule } from '../src/lib/program'
import { useStore } from '../src/lib/store'

const TODAY = '2026-10-07', MONDAY = '2026-10-05', THURSDAY = '2026-10-08'
const originalStore = useStore.getState(), originalLanguage = lang()

// The existing native-effects hook host also lets us exercise real sheet state
// and actions while rendering its contents without the browser-only portal.
function mountSheet(onClose: () => void) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useCallback: (callback: unknown) => callback,
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
      useDebugValue() {},
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
    }
    try { return WeekScheduleSheet({ weekDate: TODAY, onClose }) } finally { internals.H = previous }
  }
}

function findAction(node: ReactNode, label: string): ReactElement<{ onClick: () => void }> | undefined {
  for (const item of React.Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(item)) continue
    if (item.props.onClick && item.props.children === label) return item as ReactElement<{ onClick: () => void }>
    const found = findAction(item.props.children, label)
    if (found) return found
  }
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T12:00:00Z`) })
  setLang('fr')
  configurePlan(DEFAULT_GOAL)
  const state = defaultState()
  state.workouts = [MONDAY, '2026-10-06', TODAY].map((date, i) => ({
    id: `done-${i}`, date, type: 'UPPER', sessionNumber: i + 1, startedAt: `${date}T10:00:00Z`,
    completedAt: `${date}T11:00:00Z`, exercises: [], notes: '',
  }))
  useStore.setState({ state, hasData: false, storage: 'memory', ready: true })
})

afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('restoring usual days reopens the sheet on saved training days, not a new recovery suggestion', () => {
  const store = () => useStore.getState()
  assert.equal(store().setWeekSchedule(MONDAY, [5, 6]), true)
  const history = store().state.workouts
  let closed = false
  const sheet = mountSheet(() => { closed = true })()
  const content = (element: ReturnType<typeof WeekScheduleSheet>) => renderToStaticMarkup(createElement(Fragment, null, element.props.children, element.props.footer))
  assert.ok(content(sheet).includes(`aria-label="${fmtDate(THURSDAY, { weekday: true, long: true })} : Repos"`))

  const reset = findAction(sheet.props.children, 'Rétablir les jours habituels')
  assert.ok(reset, 'the saved exception exposes its real reset action')
  // Run the real Button's validation-before-exit contract. This component test
  // uses the default immediate close context; motion is covered separately.
  const previous = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H
  ;(React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = { useContext: () => (action: () => void, validate?: () => boolean) => { if (!validate || validate()) action() } }
  try { Button(reset.props).props.onClick?.({ preventDefault() {} } as any) } finally { (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = previous }
  assert.equal(closed, true)
  assert.equal(store().state.workouts, history, 'reset preserves workout history')
  assert.equal(store().state.weekSchedules, undefined)
  const restored = weekSchedule(store().state, TODAY, TODAY)
  assert.ok(restored.planned.includes(THURSDAY))
  assert.ok(restored.adaptedRest.includes(THURSDAY), 'recovery is still suggested, but was not saved')

  const reopened = mountSheet(() => {})()
  const html = content(reopened)
  const thursday = [...html.matchAll(/<button\b[^>]*>/g)].map(match => match[0])
    .find(button => button.includes(`aria-label="${fmtDate(THURSDAY, { weekday: true, long: true })} : Séance"`))
  assert.ok(thursday, 'Thursday is visibly a workout after reopening')
  assert.match(thursday, /aria-pressed="true"/)
  assert.doesNotMatch(html, /Rester à|Garder \d+ séances/)
  assert.equal(findAction(reopened.props.children, 'Rétablir les jours habituels'), undefined)
})
