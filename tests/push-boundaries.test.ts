import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cors, readBody, selfHost, validSubscription } from '../push/api/_validation.js'

const subscription = (endpoint: string) => ({ endpoint, keys: { p256dh: 'test-key', auth: 'test-auth' } })

test('JSON bodies that are null, arrays or primitives are safely rejected as empty input', () => {
  for (const body of ['null', '[]', '42', 'false', '"text"', Buffer.from('null')]) assert.deepEqual(readBody({ body }), {})
  assert.deepEqual(readBody({ body: '{"endAt":123}' }), { endAt: 123 })
})

test('untrusted forwarded host cannot allow an arbitrary echo endpoint or self-call target', () => {
  const req = { headers: { host: 'golgoth-push.vercel.app', 'x-forwarded-host': '127.0.0.1' } }
  assert.equal(validSubscription(subscription('https://127.0.0.1/api/echo'), req), false)
  assert.notEqual(selfHost(req), '127.0.0.1')
})

test('push endpoint validation accepts services and rejects userinfo, ports and suffix lookalikes', () => {
  const req = { headers: { host: 'golgoth-push.vercel.app' } }
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/test', 'https://web.push.apple.com/token', 'https://updates.push.services.mozilla.com/token']) assert.equal(validSubscription(subscription(endpoint), req), true)
  for (const endpoint of ['https://fcm.googleapis.com:444/token', 'https://name:password@fcm.googleapis.com/token', 'https://fcm.googleapis.com.evil.example/token', 'http://fcm.googleapis.com/token']) assert.equal(validSubscription(subscription(endpoint), req), false)
})

test('foreign browser origins are rejected before handlers process a simple POST', () => {
  let status = 0
  const res = { setHeader() {}, status(value: number) { status = value; return this }, end() {} }
  assert.equal(cors({ method: 'POST', headers: { origin: 'https://unrelated.example' } }, res), true)
  assert.equal(status, 403)
  assert.equal(cors({ method: 'POST', headers: { origin: 'https://ilyomix.github.io' } }, res), false)
  assert.equal(cors({ method: 'POST', headers: {} }, res), false, 'server handoffs do not carry an Origin header')
})
