import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyText, saveFile } from '../src/lib/share'
import { useStore } from '../src/lib/store'

test('a denied clipboard fallback reports failure instead of claiming success', async () => {
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const doc = Object.getOwnPropertyDescriptor(globalThis, 'document')
  let removed = false
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async () => { throw new Error('denied') } } } })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ style: {}, value: '', select() {}, remove() { removed = true } }), body: { appendChild() {} }, execCommand: () => false } })
  const original = useStore.getState()
  try {
    await copyText('Synthetic test')
    assert.equal(useStore.getState().toast?.tone, 'bad')
    assert.equal(removed, true)
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else Reflect.deleteProperty(globalThis, 'navigator')
    if (doc) Object.defineProperty(globalThis, 'document', doc); else Reflect.deleteProperty(globalThis, 'document')
    useStore.setState(original, true)
  }
})

test('cancelled web export returns false without an error or download', async () => {
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const original = useStore.getState()
  useStore.setState({ toast: null })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone', canShare: () => true, share: async () => { throw new DOMException('cancelled', 'AbortError') } } })
  try {
    assert.equal(await saveFile('lift-test.json', '{}', 'application/json'), false)
    assert.equal(useStore.getState().toast, null)
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav); else Reflect.deleteProperty(globalThis, 'navigator')
    useStore.setState(original, true)
  }
})
