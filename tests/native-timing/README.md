# Native rest timing

Run from the repository root with Swift 6 or later (included with Xcode):

```sh
swift test --package-path tests/native-timing
```

The target links the production `ios/App/Shared/WorkoutAttributes.swift` source.
The ActivityKit shim declares only `ActivityAttributes`, allowing the real timing
and pending-action logic to run on macOS without an iOS simulator.

Coverage includes expired rest → +30 seconds, stale flags, session expiration,
skip, repeated actions, recovery before acknowledgement, and a new rest taking
priority over an old action. These tests do not emulate ActivityKit scheduling,
Live Activity rendering, notifications, or WebView suspension; verify those on iOS.

## Autonomous expiry check on iOS

The stale variant must render correctly **before** the deadline. WidgetKit may
prepare it in advance; advancing the test clock alone does not verify this path.
`activitySnapshot(at:)` chooses a deadline and encodes its reason together.
The app sends this pair on every sync and intent update. The view responds to
`context.isStale`; no timer, background task, or notification callback drives it.

On the simulator, then a physical iPhone, record this sequence using the release
build and a disposable workout:

1. Start a short rest, put the app in the background, then lock the screen. Keep
   the display awake around expiry. Do not reopen the app, tap an intent, or send
   a new activity update to make the status change.
2. Observe `00:02` → `00:00`, then **Repos terminé** (FR) / **Rest over** (EN).
   Record the countdown deadline and the actual label-change time separately;
   the label is not guaranteed to change at zero. Keep observing beyond two
   minutes after the last activity update (for example, use a three-minute test
   window), with zero remaining fixed. This is an observation window, not an OS
   delivery guarantee. If the label has not changed, record it as not observed
   and inspect the system logs before attributing the result to the app. Verify
   the same status in the expanded Island, with the compact timer still fitting
   its 52-point frame.
3. From the finished activity, tap **+30 s**. The label returns to Repos / Rest
   with a new countdown. Leave the app in the background and verify a second
   autonomous expiry. Tap **Passer**; the ready state replaces the finished rest.
4. Repeat expiry with notifications disabled, to establish that notification
   delivery is not required. Repeat once with Always-On / Reduce Motion: the
   status must still change, while the optional transition stays disabled.
5. For the strongest suspension check, start a fresh rest and terminate the app
   process without ending the activity, then observe expiry without relaunch.
   Record the device/OS and whether the system kept the activity visible; this
   check is distinct from the normal background case.

The finite opacity transition is secondary. Its presence is not evidence that
the stale status changed, and unit tests do not establish OS scheduling or visual
animation. Save before/after frames and timing separately for the status check.

## Measured build 16 limitation

On the iOS 26.5 simulator used for build 16 QA, both tested cycles scheduled the
stale transition 120 seconds after the latest ActivityKit update, even though
the requested `staleDate` was earlier:

| Rest duration | Requested deadline | System marked stale | Delay after rest |
| --- | --- | --- | --- |
| 90 seconds | 18:26:51 | 18:27:21.938 | About 30 seconds |
| +30 seconds after expiry | 18:28:36 | 18:30:06.806 | About 90 seconds |

Times are Europe/Paris on 2026-10-04. The rendered content followed the stale
transition roughly one to two seconds later. **Rest over** appeared autonomously
in both cycles, without reopening the app or tapping an intent at expiry. The
second countdown began through the +30 action after the first rest had ended.

This validates autonomous completion, not an immediate status change at zero.
The observed two-minute floor is specific evidence from this simulator run,
not a documented universal Apple guarantee. Physical-device latency, the pulse,
Always-On / Reduce Motion, and notifications-disabled variants still require
their own checks. Do not compensate by moving `staleDate` earlier: that can show
completion prematurely on a system with different scheduling behavior. The
existing local notification is a separate scheduled end signal; its delivery
does not itself update the activity. Build 16 adds no AlarmKit integration.

Local QA artifacts (not included in a fresh checkout):
[receipt and evidence hashes](../../.local-release/build16-native/expiry-validation.json),
[first expiry log](../../.local-release/build16-native/activity-expiry-system.log),
[second expiry log](../../.local-release/build16-native/activity-second-expiry-system.log),
[second payload deadline](../../.local-release/build16-native/activity-second-payload.log).

Apple references: [stale date](https://developer.apple.com/documentation/activitykit/activitycontent/staledate),
[stale UI at 16:54 in WWDC23](https://developer.apple.com/videos/play/wwdc2023/10185/?time=1014),
[supported animations and limits](https://developer.apple.com/documentation/widgetkit/animating-data-updates-in-widgets-and-live-activities).

## Reduced-cadence timer fonts

`TimerFontTests` loads the actual bundled fonts through CoreText. It verifies
that ASCII and Unicode timer dashes use Lift's segment glyph, have the same
advance as a digit, and retain a complete eight-shaped ghost. It also checks
the padded `1:00` / `0:59` boundary at the Lock Screen and Island font sizes.
Regenerate both derived fonts with `python3 scripts/generate-native-timer-ghost.py`
(fonttools 4.62.1). The upstream DSEG file remains unchanged.

Apple documents that dynamic timer Text can replace fields with dashes when the
display updates too slowly for those fields, such as reduced luminance. This is
not a countdown failure. The shipped DSEG derivative previously lacked Unicode
dashes, causing CoreText to use another font; its ghost only covered digits.
The tests establish glyph shaping, not physical-device Always-On behavior.

## Rejected immediate-label prototype (2026-10-06)

A custom `DiscreteFormatStyle` with `Text(.currentDate, format:)` compiled and
passed its date-boundary tests, but the actual iOS 26.5 Live Activity rendered a
placeholder instead of the expanded content. The prototype was removed. Do not
substitute that compilation result for WidgetKit validation. No per-second
background task, unsupported timeline, or early stale date is used as a workaround.

The supported label still follows `isStale`, or a fresh foreground/action update.
Its change at the exact zero crossing is **not guaranteed**. The repository's
`push/` service supports browser Web Push with VAPID, not APNs ActivityKit update
tokens; it cannot update the native activity without a separate implementation.

References: [dynamic Text formatting and reduced cadence](https://developer.apple.com/documentation/swiftui/text/init(_:format:)-8sfgg),
[TimeDataSource](https://developer.apple.com/documentation/swiftui/timedatasource).
Local rejected-prototype proof: `.local-release/rest-label-qa/custom-format-countdown.jpg`.
