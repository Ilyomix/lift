import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'
import { PauseScreen } from '../src/screens/Calendar'
import { DataScreen, ImportSheet } from '../src/screens/More'
import { SettingsScreen } from '../src/screens/Settings'

const initialStore = useStore.getInitialState()
const originalState = initialStore.state
const originalLanguage = lang()
const originalTimezone = process.env.TZ

beforeEach(() => {
  process.env.TZ = 'Europe/Paris'
  setLang('en')
  configurePlan(DEFAULT_GOAL)
  initialStore.state = defaultState()
})
afterEach(() => {
  initialStore.state = originalState
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
})

for (const language of ['fr', 'en'] as const) {
  test(`an export just after local midnight is today in backup, settings and import (${language})`, t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T22:45:00.000Z') })
    setLang(language)
    const backup = makeBackup(initialStore.state, [])
    initialStore.state = { ...initialStore.state, meta: { ...initialStore.state.meta, lastBackupAt: backup.exportedAt } }

    const backupPage = renderToStaticMarkup(createElement(DataScreen))
    assert.match(backupPage, language === 'fr' ? /Dernier export[\s\S]*?aujourd’hui/ : /Last export[\s\S]*?today/)
    assert.doesNotMatch(backupPage, /yesterday|hier/)

    const settings = renderToStaticMarkup(createElement(SettingsScreen, { section: 'donnees' }))
    assert.ok(settings.includes(language === 'fr' ? 'Dernier export : 9 oct.' : 'Last export: 9 Oct'))

    const preview = ImportSheet({ parsed: parseBackup(JSON.stringify(backup)), upgrade: false, setUpgrade() {}, onClose() {}, onConfirm() {} })!
    const contents = renderToStaticMarkup(createElement('div', null, preview.props.children))
    assert.ok(contents.includes(language === 'fr' ? '9 oct. 2026' : '9 Oct 2026'))
    assert.equal(initialStore.state.meta.lastBackupAt, '2026-10-08T22:45:00.000Z', 'display conversion must not rewrite the stored timestamp')
  })
}

test('an export before local midnight is not reported as tomorrow west of UTC', t => {
  process.env.TZ = 'America/Los_Angeles'
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-10T06:45:00.000Z') })
  initialStore.state = { ...initialStore.state, meta: { ...initialStore.state.meta, lastBackupAt: new Date().toISOString() } }
  assert.match(renderToStaticMarkup(createElement(DataScreen)), /Last export[\s\S]*?today/)
  assert.match(renderToStaticMarkup(createElement(SettingsScreen, { section: 'donnees' })), /Last export: 9 Oct/)
})

test('a pause lasting six local days does not preview a seven-day return adjustment', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T22:45:00.000Z') })
  initialStore.state = { ...initialStore.state, workouts: [], programPause: { active: true, startedAt: '2026-10-02T22:45:00.000Z', plannedEnd: null, reason: 'vacances', history: [] } }
  const page = renderToStaticMarkup(createElement(PauseScreen))
  assert.match(page, /Started[\s\S]*?6 days ago/)
  assert.match(page, /Normal return/)
})
