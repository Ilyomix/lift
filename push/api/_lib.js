// Shared helpers of the Lift push server.
import { createHash } from 'node:crypto'
import webpush from 'web-push'
import { getCache } from '@vercel/functions'

export { cors, readBody, selfHost, validSubscription } from './_validation.js'

export const cache = getCache({ namespace: 'golgoth-push' })

export const keyOf = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40)

export const text = (x, fallback, max) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : fallback)

export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)))

let configured = false
export function send(subscription, payload) {
  if (!configured) {
    // Subject: the app's page (a contact URL for the push services), no e-mail address.
    webpush.setVapidDetails('https://ilyomix.github.io/lift/', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
    configured = true
  }
  return webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 120, urgency: 'high', topic: 'golgoth-rest' })
}
