# Lift

A research-based hypertrophy program, as a web app you install on your phone.

**App: https://ilyomix.github.io/lift/**

## What it is

You tell Lift where you train, on which days, a few body measurements and the look you want by a given date. It lays out the whole plan (recomposition, a cut if needed, then a stabilization ending on that date, in blocks separated by deloads). Then it guides each session set by set, times your rests and adjusts your loads from what you actually lift.

- **Installable PWA**, designed for the iPhone: open the app in Safari, then Share → Add to Home Screen. It then runs full screen and offline, and can receive notifications.
- **Bilingual**: French and English. It follows the phone's language, and you can switch in Settings.
- **Private**: no account, everything is stored on the device.

## Features

- **Onboarding**: language; gym or home training (home equipment: dumbbells, bench, pull-up bar, bands; body weight is always available); training days; body (sex, age, height, weight, optional waist); then either a look, up to three optional priority zones and a goal date, or maintenance mode with no date, with a preview of the plan. You can also start by importing a backup.
- **Program**: an Upper / Lower / Push / Pull / Legs rotation that runs continuously over your training days (five a week is the program's pace). With four or three days, each session takes more sets so that the week keeps its volume (the “Longer sessions” setting, on by default; off keeps one-hour sessions). At home, each gym exercise of the program is replaced by the best version your equipment allows; you can switch between gym and home in Settings, and your gym sessions come back as they were. Sessions are editable.
- **Guided sessions**: the day's prescription for each exercise (sets, rep range, RIR (reps in reserve), rest, load), your last performance, clean reps, failure / technique / pain flags, supersets and exercise swaps. Machine loads and history are kept per gym; free weights are shared.
- **Automatic loads**: double progression after each session. When every set reaches the top of the range, the load goes one step above the load really lifted; when every set falls under it, the load goes down. A set pushed past the planned effort (logged RIR, or a failure) counts for fewer reps, so effort alone never raises a load. On a machine whose loads fall off the standard 2.5 kg steps, the loads already used on it are proposed again. Dips, pull-ups, chin-ups and back extensions take added load: 2.5 kg more at the top of the range. A trial session sets the starting load. Within a session, the next sets follow the one just done. Sessions are compared on the sets they share, and on the estimated level when a load changed. A drop counts from one rep per set on average (less is the normal variation from one session to the next): two such drops in a row remove a set until the end of the block, and a general drop offers an early deload, which can be cancelled. An exercise that two sessions have in the same rep range and at the same load moves in both at once (sheets that already differ each keep their own load until they meet); with two different ranges, each is compared within its own. Pain that comes back and four sessions without progress are flagged at the end of the session. Every change can be undone or applied later from the session that made it, and the last finished session can be reopened to fix a set: its verdicts and its changes are worked out again.
- **Rest timer**: seven-segment dial, sound and vibration, screen kept awake, and a push notification that arrives even with the phone locked.
- **Calendar**: blocks, deloads, phases and holidays up to the goal date. A missed session shifts the rotation instead of being skipped. Pauses (holiday, illness, injury…) end with return-to-training rules. Reminders for sessions, weigh-ins, waist, photos, deloads and phases export as an `.ics` file for the phone's calendar.
- **Visual goal**: four looks, from athletic to shredded, each defined by a body-fat range. Lift estimates your body fat and derives a target weight and a cut length. It then checks that the cut fits before your goal date (or proposes a later date) and gives up to three priority zones an extra set: the screen lists the exercises that take it and the date it starts (week 3 of block 2 if performance is rising, week 1 of every cut block). Before the cut starts, a new waist measurement that changes its length by three weeks or more prompts you to update the goal.
- **Nutrition**: protein follows your 7-day average weight. Calorie changes (±150 kcal) are suggested from the weight trend against the phase's target rate, and from the waist during recomposition. In a cut, a loss slower than the bottom of the range (−0.5 % a week) asks for fewer calories, once the three-week trend lies inside the cut and after the last calorie change (until then, only a loss under −0.3 % does). The advice needs a weigh-in from the last seven days, and never goes under your estimated energy at rest (Mifflin–St Jeor) nor under 1,500 kcal (1,200 for a woman): at that floor it points at portions and steps instead. One step per cut is not 150 kcal but the plan's deficit taken at once: the middle of the range (−0.6 % a week, −0.5 at the end of the cut) at 7,700 kcal per kilogram, 500 kcal a day at most, less what the trend already shows. The plan counts on its pace from the first day, and 150 kcal at a time takes weeks to get there. The trend has to be able to size it: a weigh-in every three days or so, a pace that was already slow two weeks before, three weeks without a calorie change (up to a week short of that, the advice waits), and three normal weeks, which Lift asks about. If they were not (holidays, a diet already started), the step is a regular one and the full one comes later. In the nine weeks after it, each time the trend is clean of the last change and still above the range, 150 kcal of it go back. In simulation a cut started from a stable weight then ends between a fifth short of the loss its length counts on and on plan, where 150 kcal steps alone ended up to 30 % short. The advice still only acts under the bottom of the range, while the length is sized on its middle. Body weight never changes training loads.
- **Progress**: estimated 1RM per exercise, 7-day average weight against the plan's path, body measurements, hard sets per muscle per week against the 10–20 band, and before/after photos.
- **AI coach** (optional): send a session or whole-program brief to the AI assistant of your choice, then paste its reply back. The JSON plan update is previewed before it applies.
- **Exercise sheets**: demo images, technique cues, the evidence behind the exercise, and a YouTube search or your own video.
- **Backups**: JSON export and import, photos included. Golgoth backups import as they are. Data from the older Golgoth Tracker can be moved onto the research program with loads and history kept.

## Evidence base

The rules come from a research report dated 26 September 2026. It cites 31 publications, all checked; studies the report could not verify are left out. Six more, checked since, support three rules the report does not cover: weeks of fewer than five sessions, the margin of the fatigue signal, and the size of a cut's full calorie step. One piece of general health guidance backs the floor of the calorie advice, a guard rather than a finding. They are all listed in the app and in [`src/lib/research.ts`](src/lib/research.ts), each rule tagged with its level of evidence.

| Topic | Rule in Lift | Evidence |
|---|---|---|
| Volume | 10–20 hard sets per muscle per week, counted fractionally (direct set 1, indirect 0.5) | Strong |
| Frequency, split | Each muscle twice a week; Upper / Lower / Push / Pull / Legs | Strong |
| Fewer than 5 days | Same weekly volume in fewer sessions: sets ×1.25 at four days, ×1.67 at three, at most about 11 per muscle per session | Moderate |
| Effort | RIR 1–2 on compound lifts, 0–1 on isolation; within a block, week 1 at RIR 3, week 2 at RIR 2, last week 0–1 | Strong |
| Reps | 6–12 on compound lifts, 10–20 on isolation | Strong |
| Rest | At least 90 s; 2–3 min on compound lifts | Moderate |
| Machines | As good as free weights for muscle growth | Strong |
| Range of motion | Full range, with emphasis on the stretched position | Moderate |
| Progression | Double progression, no complex periodization | Strong |
| Fatigue signal | Two drops in a row of one rep per set or more: one set fewer until the end of the block | Expert opinion; the margin is measured |
| Deloads | One lighter week every ~6 weeks: half the sets, loads −10 %, RIR 3–4 | Expert opinion |
| Breaks | One to three weeks off cost little | Moderate |
| Cut | −0.5 to −0.7 % of body weight per week, deficit ≤ 500 kcal/day | Moderate |
| Protein | ≥ 1.6 g/kg/day (Lift aims for about 2 g/kg, a little more during the cut) | Strong |
| Creatine | 5 g/day | Moderate |

Five sessions a week are not optimal in themselves: at equal volume, training a muscle once, twice or three times a week gives similar growth. The five sessions spread the volume and keep each one around an hour. With four or three training days, Lift keeps the rotation and moves the sets of the missing sessions into the others (about 70–80 and 90–100 minutes a session), on average over a turn of the rotation. One limit: past about 11 sets for a muscle in one session no extra gain can be detected (a preprint, not yet peer-reviewed), so added sets stop there. Three days hold about 97 % of the planned volume, two days about 64 %. Loads still go up on the sets of the session sheet, not on the added ones. Supersets of opposing exercises shorten a session by about a third for similar growth (from only three long-term studies), at a higher perceived effort.

The fatigue signal has a margin. At a fixed load, the reps of a set move by 0.7 to 1.1 from one week to the next with no change of level (24 trained lifters on the bench press), and a change in one person is likely real only beyond 1.5 to 2 times that. So a drop counts from one rep per set on average, and from two reps in all. This applies the two figures rather than quoting a result: the study measured single sets to failure on one exercise, and the threshold assumes that part of the variation is specific to each set. Simulated on the app's own code over blocks of five sessions, with three sets or more and half of the variation shared by the sets of a day: a lifter whose level does not move gets a false alert on an exercise in about 1 to 6 % of blocks instead of about 30 %, at the cost of sensitivity to small declines (a loss of one rep per set at every session is caught in about half the blocks, one and a half in about four out of five, two almost always). If all the sets of a day always moved together, the margin would change nothing.

**The plan** is built backwards from the goal date, which can be 8 weeks to 5 years away:

- **Stabilization**: about 2.5 weeks, ending on the goal date.
- **Cut**: just before it, as long as your look needs, capped by the time available.
- **Recomposition**: fills the time from the start.

**Maintenance mode** has no goal date: blocks of about five weeks and their deloads follow each other with no end, the Christmas weeks at maintenance, with no cut and no stabilization, and calories aim for a stable weight. The calendar is laid out to the end of next year's holidays and grows each year without moving the blocks already planned. Onboarding and Settings → Goal switch between the two; the goal date is kept for when you come back to it.

Blocks last about five weeks, each followed by a deload week; the last block of a phase hands over to the next phase instead. The Christmas weeks become maintenance, and in a long cut the middle deload doubles as a diet break. After a break, the return scales with its length:

- **1–2 weeks off**: two sessions at −5 to −10 % load.
- **2–3 weeks off**: one week run like week 1.
- **More than 3 weeks off**: two restart weeks.

**Estimates**: body fat comes from waist and height (relative fat mass, Woolcott & Bergman 2018). At onboarding without a waist measurement, it comes from BMI, age and sex instead (Deurenberg 1991). Starting calories come from Mifflin–St Jeor (1990). Your weight trend and waist then correct these estimates.

**Limits**: muscle-length trials mostly involve beginners over 8–12 weeks, and the meta-analyses mostly include young men. Deload frequency, the diet break and the return thresholds are expert opinion. Lift is not medical advice.

## Privacy

- Sessions, measurements, photos and settings stay on the device, in IndexedDB. There is no account and no analytics.
- The one exception applies when lock-screen notifications are on. For each rest, the push subscription and the notification text are sent to the [push server](push/README.md), which keeps a cache entry for one hour at most.
- Backups and coach briefs leave the phone only when you export or share them.
- A video you pin to an exercise loads from YouTube's privacy-enhanced domain (youtube-nocookie.com).

## Development

```bash
git clone https://github.com/Ilyomix/lift.git && cd lift
npm install
npm run dev         # http://localhost:5173/lift/
npm test            # logic tests (node:test + tsx, no DOM)
npm run typecheck   # tsc --noEmit
npm run build       # typecheck, then the PWA build in dist/
npm run preview     # serves dist/ at http://localhost:4173/lift/
```

- **Node 22**, as in CI.
- **Base path**: `/lift/` by default; set `LIFT_BASE` to build for another path, e.g. `LIFT_BASE=/ npm run build`.
- **Service worker**: offline mode and push notifications need it, and the dev server doesn't run it. Test those with `npm run build && npm run preview`.
- **Translations**: every string is written inline, French first, e.g. `L('Repos terminé', 'Rest over')`, so neither language can miss one.
- **Stack**: Vite 8 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · idb-keyval (IndexedDB) · vite-plugin-pwa (Workbox) · Lucide · NumberFlow.

| Path | Contents |
|---|---|
| `src/lib/program.ts` | Program, plan generator, calendar engine, home versions of the exercises |
| `src/lib/research.ts` | Sources and evidence levels |
| `src/lib/training.ts` | Load decisions, comparisons, volume per muscle |
| `src/lib/stats.ts` | Weight trend, protein and calorie targets |
| `src/lib/visual.ts` | Visual goal: body fat, target weight, cut length, priority zones |
| `src/lib/onboarding.ts` | First run → complete initial state |
| `src/screens/`, `src/components/` | Interface |
| `tests/` | Logic tests |
| `public/push-sw.js` | Push handler, imported by the Workbox service worker |
| `push/` | Push server (Vercel) |
| `scripts/icons.py` | App icon generator (Pillow) |
| `scripts/og.html`, `scripts/og.py` | Link-preview image (`public/og.png`, 1200 × 630), rendered with Playwright |

## Deployment

Every push to `main` (or a manual run) triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): Node 22, `npm ci`, `npm test`, `npm run build`, then `dist/` is published to GitHub Pages. A failing test stops the deploy.

- In the repository settings, Pages → Source must be **GitHub Actions**.
- The site is served at https://ilyomix.github.io/lift/, so the base path `/lift/` matches the repository name.
- Installed apps offer each new version through an in-app update prompt.

## Push server

The end-of-rest notification with the phone locked comes from a small Vercel server in [`push/`](push/README.md) (Node 22, `web-push`). It runs at https://golgoth-push.vercel.app, an internal address that kept its original name. The server's VAPID keys are set as Vercel environment variables (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) and never appear in the repository.

The client side is [`src/lib/push.ts`](src/lib/push.ts) and [`public/push-sw.js`](public/push-sw.js). On iPhone, notifications need the app installed on the Home Screen. Endpoints and deployment are covered in [`push/README.md`](push/README.md).

## Credits

- Demo images: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), public domain (Unlicense).
- Geologica font: SIL Open Font License (`src/assets/fonts/Geologica-LICENSE.txt`).
- DSEG7 font: SIL Open Font License, © keshikan (`src/assets/fonts/DSEG-LICENSE.txt`).

Author: [Ilyomix](https://github.com/Ilyomix).
