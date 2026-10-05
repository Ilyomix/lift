import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultState, makeBackup, parseBackup } from '../src/lib/backup'

test('new profiles use orange without changing the default dark appearance', () => {
  const { prefs } = defaultState()
  assert.equal(prefs.accent, 'orange')
  assert.equal(prefs.theme, 'dark')
})

test('imports without a valid accent use orange', () => {
  for (const prefs of [undefined, {}, { accent: null }, { accent: 'purple' }]) {
    const imported = parseBackup(JSON.stringify({ ...defaultState(), prefs })).state
    assert.equal(imported.prefs.accent, 'orange')
  }
})

test('an explicitly saved blue choice survives backup import and re-export', () => {
  const original = defaultState()
  original.prefs.accent = 'blue'
  original.prefs.theme = 'light'
  const imported = parseBackup(JSON.stringify(makeBackup(original, []))).state
  assert.deepEqual(imported.prefs, original.prefs)
  assert.equal(makeBackup(imported, []).state.prefs.accent, 'blue')
})

test('first paint uses orange by default and respects saved blue and automatic appearance', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const bootstrap = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
  assert.ok(bootstrap)
  const initialTheme = html.match(/data-theme="([^"]+)"/)?.[1]
  const initialAccent = html.match(/data-accent="([^"]+)"/)?.[1]
  const initialColor = html.match(/name="theme-color" content="([^"]+)"/)?.[1]

  // Execute the shipped head script; no alternate implementation of its rules.
  for (const savedAccent of [undefined, 'invalid', 'orange', 'blue']) {
    for (const savedTheme of [undefined, 'light', 'dark', 'auto']) {
      for (const systemDark of [false, true]) {
        const attributes: Record<string, string | undefined> = { 'data-theme': initialTheme, 'data-accent': initialAccent }
        let color = initialColor
        runInNewContext(bootstrap, {
          navigator: { language: 'en-GB' },
          localStorage: { getItem: (key: string) => key === 'golgoth-accent' ? savedAccent ?? null : savedTheme ?? null },
          matchMedia: () => ({ matches: systemDark }),
          document: {
            documentElement: { setAttribute: (name: string, value: string) => { attributes[name] = value } },
            querySelector: () => ({ setAttribute: (_name: string, value: string) => { color = value } }),
          },
        })
        const blue = savedAccent === 'blue'
        const dark = savedTheme === 'auto' ? systemDark : savedTheme !== 'light'
        assert.equal(attributes['data-accent'], blue ? 'blue' : 'orange')
        assert.equal(attributes['data-theme'], savedTheme ?? 'dark')
        assert.equal(color, blue ? (dark ? '#060A13' : '#F9FAFD') : (dark ? '#0B0B0E' : '#FAFAFA'))
      }
    }
  }
})
