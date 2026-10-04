import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Field } from '../src/components/ui'

test('native field controls retain their label and expose the actual error as a description', () => {
  for (const type of ['input', 'textarea', 'select']) {
    const html = renderToStaticMarkup(createElement(Field, {
      label: 'Target', hint: 'In kilograms', error: 'Enter a positive number',
      children: createElement(type, { name: 'target', 'aria-describedby': 'existing-help' }),
    }))
    const control = html.match(new RegExp(`<${type}\\b([^>]*)>`))![1]
    const references = control.match(/aria-describedby="([^"]+)"/)![1].split(' ')
    assert.equal(references[0], 'existing-help')
    assert.equal(references.length, 3)
    assert.ok(control.includes('aria-invalid="true"'))
    assert.ok(control.includes('name="target"'))
    assert.ok(html.includes(`id="${references[1]}"`))
    assert.ok(html.includes(`id="${references[2]}"`))
    const label = html.match(/<label\b[^>]*>([\s\S]*?)<\/label>/)![1]
    assert.ok(label.includes('Target') && label.includes(`<${type}`))
    assert.ok(!label.includes('Enter a positive number'), 'error is a description, not part of the control name')
  }
})

test('valid fields do not become invalid or lose caller-provided descriptions', () => {
  const html = renderToStaticMarkup(createElement(Field, {
    label: 'Target', children: createElement('input', { 'aria-describedby': 'existing-help' }),
  }))
  assert.ok(html.includes('aria-describedby="existing-help"'))
  assert.ok(!html.includes('aria-invalid'))
  assert.ok(!html.includes('-error'))
})

test('multiple invalid fields have distinct message IDs', () => {
  const html = renderToStaticMarkup(createElement('form', null,
    ...['Minimum', 'Maximum'].map(label => createElement(Field, {
      key: label, label, error: `${label} is invalid`, children: createElement('input'),
    })),
  ))
  const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(match => match[1])
  assert.equal(ids.length, 2)
  assert.equal(new Set(ids).size, 2)
  for (const id of ids) assert.ok(html.includes(`id="${id}"`))
})
