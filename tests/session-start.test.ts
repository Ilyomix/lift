import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { useSessionStart } from '../src/components/useSessionStart'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL, isRestDay, scheduleFromDays } from '../src/lib/program'
import { useStore } from '../src/lib/store'

const TODAY = '2026-10-08'
const originalStore = useStore.getState(), originalLanguage = lang()
const state = () => useStore.getState().state

function mountStart(onStarted: () => void) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  let pending: unknown = null
  return () => {
    const previous = internals.H
    internals.H = { useState: () => [pending, (next: unknown) => { pending = next }] }
    try { return useSessionStart(onStarted) } finally { internals.H = previous }
  }
}
function action(node: ReactNode, label: string): ReactElement<{ onClick: () => void }> | undefined {
  for (const item of React.Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(item)) continue
    if (item.props.onClick && item.props.children === label) return item as ReactElement<{ onClick: () => void }>
    const found = action(item.props.children, label)
    if (found) return found
  }
}
const text = (node: ReactNode): string => React.Children.toArray(node).map(item => isValidElement<{ children?: ReactNode }>(item) ? text(item.props.children) : String(item)).join('')

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(`${TODAY}T12:00:00Z`) })
  setLang('fr')
  configurePlan(DEFAULT_GOAL)
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' })
})
afterEach(async () => {
  await useStore.getState().flush()
  useStore.setState(originalStore, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

test('a paused program requires explicit resumption; cancelling or closing preserves the full state', () => {
  useStore.getState().startPause({ reason: 'vacation', plannedEnd: '2026-10-11', note: 'QA pause' })
  assert.equal(isRestDay(state(), TODAY), false, 'a pause is distinct from a scheduled rest day')
  const before = state()
  let started = 0
  const render = mountStart(() => { started++ })
  render().start('UPPER')
  let sheet = render().confirmation
  assert.equal(sheet.props.open, true)
  assert.equal(sheet.props.title, 'Reprendre le programme ?')
  assert.match(text(sheet.props.children), /La pause sera terminée/)
  assert.match(text(sheet.props.children), /même si tu abandonnes/)
  assert.equal(state(), before, 'opening confirmation must not start a workout or end the pause')
  action(sheet.props.footer, 'Annuler')!.props.onClick()
  assert.equal(render().confirmation.props.open, false)
  assert.equal(state(), before)
  render().start('LOWER')
  sheet = render().confirmation
  sheet.props.onClose()
  assert.equal(state(), before, 'backdrop, Close and swipe cancellation also leave the pause unchanged')
  assert.equal(started, 0)
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state(), []))).state.programPause, before.programPause)
})

test('confirmed resumption starts the selected workout, persists ending the pause, and keeps history on discard', () => {
  setLang('en')
  useStore.getState().startPause({ reason: 'vacation', plannedEnd: '2026-10-11', note: 'QA pause' })
  const before = state()
  let started = 0
  const render = mountStart(() => { started++ })
  render().start('LOWER')
  const sheet = render().confirmation
  assert.equal(sheet.props.title, 'Resume the program?')
  assert.match(text(sheet.props.children), /Your pause will end/)
  action(sheet.props.footer, 'Resume and start')!.props.onClick()
  assert.equal(started, 1)
  assert.equal(render().confirmation.props.open, false)
  assert.equal(state().activeWorkout?.type, 'LOWER')
  assert.equal(state().activeWorkout?.date, TODAY)
  assert.equal(state().programPause.active, false)
  assert.equal(state().programPause.history.length, before.programPause.history.length + 1)
  assert.equal(state().programPause.history.at(-1)?.startedAt, before.programPause.startedAt)
  assert.equal(state().workouts, before.workouts)
  const resumedPause = state().programPause
  useStore.getState().discardSession()
  assert.equal(state().activeWorkout, null)
  assert.equal(state().workouts, before.workouts)
  assert.equal(state().programPause, resumedPause, 'explicit resumption remains effective when the workout is discarded')
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(state(), []))).state.programPause, resumedPause)
})

test('ordinary rest confirmation and a normal scheduled start retain their previous behavior', () => {
  let started = 0
  const render = mountStart(() => { started++ })
  useStore.setState({ state: { ...state(), schedule: scheduleFromDays([1, 2, 5, 6]) } })
  assert.equal(isRestDay(state(), TODAY), true)
  const before = state()
  render().start('UPPER')
  const sheet = render().confirmation
  assert.equal(sheet.props.title, 'S’entraîner un jour de repos ?')
  action(sheet.props.footer, 'Garder mon repos')!.props.onClick()
  assert.equal(state(), before)
  assert.equal(started, 0)
  useStore.setState({ state: { ...state(), schedule: scheduleFromDays([1, 2, 4, 5, 6]) } })
  render().start('UPPER')
  assert.equal(started, 1)
  assert.equal(render().confirmation.props.open, false)
  assert.equal(state().activeWorkout?.type, 'UPPER')
  assert.equal(state().programPause.active, false)
})
