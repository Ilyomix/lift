# Lift push server

This server sends Lift's end-of-rest notification at the right moment, so it arrives even with the phone locked or the app in the background. It is a few Vercel Functions (Node 22, [`web-push`](https://github.com/web-push-libs/web-push), [`@vercel/functions`](https://www.npmjs.com/package/@vercel/functions)), with no database and no accounts.

**Address: https://golgoth-push.vercel.app**. This internal address kept the app's former name. The app calls it from [`src/lib/push.ts`](../src/lib/push.ts), and [`public/push-sw.js`](../public/push-sw.js) displays the notification.

## How it works

1. With lock-screen notifications on, the app subscribes to Web Push with the server's VAPID public key (`GET /api/key`).
2. When a rest starts, the app posts its subscription and the rest's end time to `/api/rest`. Adjusting the timer posts again; stopping it posts to `/api/cancel`.
3. The function waits until the end time, checks the rest is still the current one, then sends the notification through the browser's push service.

## Endpoints

All endpoints share these rules:

- **CORS**: requests are accepted from `https://ilyomix.github.io` (the app), `http://localhost:5173` (dev) and `http://localhost:4173` (preview).
- **Bodies**: sent as `text/plain` (a "simple" request, so no preflight) or as JSON.
- **Caching**: every reply carries `Cache-Control: no-store`.

A `subscription` is the browser's `PushSubscription` JSON (`endpoint`, `keys.p256dh`, `keys.auth`). Its endpoint must be HTTPS on a known push service (Apple, Google FCM, Mozilla or Windows) or this deployment's own `/api/echo`; anything else gets `400`.

| Endpoint | Body | Reply |
|---|---|---|
| `POST /api/rest` | `{ subscription, endAt, token, title?, body? }` | `202 { ok: true, in }` |
| `POST /api/cancel` | `{ subscription }` | `200 { ok: true }` |
| `GET /api/key` | none | `200 { publicKey, cache }` · `503` when not configured |
| `POST /api/test` | `{ subscription }` | `200 { ok: true }` · `502` when the push service refuses |
| `POST`, `GET /api/echo?id=…` | ignored | `201` · `200 { id, received }` |

### `POST /api/rest`

Schedules the end-of-rest notification.

- `endAt`: delivery time in ms since the epoch, from 10 s in the past to 30 min ahead.
- `token`: a random string (≤ 80 characters) naming this rest.
- `title` (≤ 80 characters) and `body` (≤ 160 characters): the notification text, with French defaults when omitted.

The server replies at once; `in` is the number of milliseconds left before `endAt`. The wait runs in the background (`waitUntil`).

- **Replacing and cancelling**: a newer call for the same subscription replaces the pending one, and `/api/cancel` drops it. Only the latest token is ever sent.
- **Long waits**: waits over 270 s hand over to a fresh invocation, so each one stays under the 300 s function limit.
- **Delivery**: the push goes out with a 120 s TTL and high urgency.

### `POST /api/cancel`

Drops the pending notification for that subscription.

### `GET /api/key`

Returns the VAPID public key the app subscribes with, plus `cache`, which says where the pending rests are kept:

- `runtime` or `runtime-env`: Vercel's Runtime Cache.
- `memory`: the in-memory fallback.

### `POST /api/test`

Sends a notification immediately. On failure, the `502` reply carries the push service's HTTP `status`. The app's **Test** button uses `/api/rest` with an 8 s rest instead, which leaves time to lock the phone.

### `/api/echo?id=…`

A test sink that stands in for a push service, to time the whole chain without a phone. To use it:

1. Post to `/api/rest` (or `/api/test`) a subscription whose endpoint is `https://<this deployment>/api/echo?id=<id>`. The keys must be real: a P-256 `p256dh` and a 16-byte `auth`, because web-push encrypts the payload.
2. The `POST` that web-push sends to the sink records its arrival time and gets `201`.
3. `GET /api/echo?id=<id>` lists the arrivals: `{ id, received: [ms, …] }`.

`id` is 6 to 40 characters among `a–z`, `0–9` and `-`. The last 20 arrivals are kept for 15 minutes.

## What is stored

- During a rest, one Runtime Cache entry per subscription: the key is a hash of the endpoint, the value is `{ token, endAt }`. It has a 1-hour TTL and is deleted once the notification is sent or cancelled.
- The subscription itself only lives in the running invocation, which passes it to the next one on a hand-over.
- Nothing else: no accounts, no database.

## Configuration

These variables are set in the Vercel project (Settings → Environment Variables), never in the repository:

| Variable | Role |
|---|---|
| `VAPID_PUBLIC_KEY` | Public key, served by `/api/key` |
| `VAPID_PRIVATE_KEY` | Private key, signs each push |

- **Generating keys**: create a pair once with `npx web-push generate-vapid-keys` and paste the values straight into Vercel.
- **VAPID subject**: the app's URL, set in `api/_lib.js`; no e-mail address is sent to the push services.
- **Changing keys**: a new pair invalidates existing subscriptions. In the app, turn lock-screen notifications off and on again to re-subscribe.

## Deploy

`push/` is a standalone Vercel project with its own `package.json` (Node 22.x) and `vercel.json` (maximum durations: 300 s for `rest`, 10–15 s for the others).

With the Vercel CLI, from `push/`:

```bash
npx vercel link                                   # once: link or create the project
npx vercel env add VAPID_PUBLIC_KEY production    # paste the value when prompted
npx vercel env add VAPID_PRIVATE_KEY production
npx vercel deploy --prod
```

You can also import the repository in the Vercel dashboard with **Root Directory** set to `push`. Changes to environment variables apply from the next deployment.

**Check**: run `curl https://golgoth-push.vercel.app/api/key`. A `publicKey` with `"cache": "runtime"` (or `"runtime-env"`) means the server is ready.

**Running it at another address**:

1. Change `PUSH_API` in `src/lib/push.ts`.
2. If the app is not served from `ilyomix.github.io`, add its origin to `ORIGINS` in `api/_lib.js`.
