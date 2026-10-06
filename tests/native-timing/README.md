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
The app sends this pair on every sync and intent update. The stale variant is
still a fallback. The current visual phase also uses two static variants masked
by native date-relative `ProgressView` instances, so the system renderer can
show the finished title and accent without waiting for a new content snapshot.
No Swift timer, background task, or notification callback drives this mask.
Apple documents date-relative progress, but not this compositing technique as
a guaranteed deadline-triggered state transition. Validate the real renderer.

On the simulator, then a physical iPhone, record this sequence using the release
build and a disposable workout:

1. Start a short rest, put the app in the background, then lock the screen. Keep
   the display awake around expiry. Do not reopen the app, tap an intent, or send
   a new activity update to make the status change.
2. Observe `00:02` → `00:00`, **Repos terminé** (FR) / **Rest over** (EN), and
   the neutral-to-accent color change. Record the payload deadline, first zero,
   first finished label and first accent frame separately. Check for partial
   text, overlapping colors and an early finished variant. Compare the system
   stale log to distinguish the visual mask from the fallback. If the label
   does not change, record that failure and continue beyond two minutes after
   the last update to observe the fallback; this window is not an OS delivery
   guarantee. Verify the expanded Island and the compact timer's 52-point frame.
3. From the finished activity, tap **+30 s**. The label returns to Repos / Rest
   with a new countdown. Leave the app in the background and verify a second
   autonomous expiry. Tap **Passer**; the ready state replaces the finished rest.
4. Extend a running rest before its old deadline, then keep recording through
   that date. Check the new timer and note any old-zero frame while the system
   installs the intent's updated content. Repeat expiry with notifications
   disabled, then with Always-On / Reduce Motion and both color schemes. Do not
   substitute a simulator result for a physical-device reduced-cadence check.
5. For the strongest suspension check, start a fresh rest and terminate the app
   process without ending the activity, then observe expiry without relaunch.
   Record the device/OS and whether the system kept the activity visible; this
   check is distinct from the normal background case.

The current implementation has no finite opacity pulse or repeating animation.
The mask changes pixels, not the accessibility tree. The visual heading and
ghost layers are hidden from accessibility while the countdown branch exposes
one native, updating remaining-time value. Until an actual stale/content update,
VoiceOver may read remaining time zero rather than the finished phrase. Verify
this behavior with VoiceOver; a compiled accessibility modifier is not proof.

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

Before the native progress-mask prototype below, the label only followed
`isStale`, or a fresh foreground/action update. That path does not guarantee a
change at the exact zero crossing. The repository's
`push/` service supports browser Web Push with VAPID, not APNs ActivityKit update
tokens; it cannot update the native activity without a separate implementation.

## Native timer phase colors

The single `RestClock` view uses the palette's text color during countdown
(white on the Island/dark Lock Screen, dark on a light Lock Screen) and the
theme accent for the finished readout. The countdown and finished branches are
selected visually by complementary native progress masks until a real content
or stale update chooses the finished branch. Lit digits and ghost segments inherit
the same phase color, including redacted seconds. Ready and expired-session
messages use the neutral text color. Minimal Island contains only the brand
icon and has no timer to recolor.

The existing deadline, prepared-stale, +30, skip and session-expiry tests cover
content-state logic; CoreText tests cover the actual digit and dash glyphs.
They do not exercise the date-relative mask, SwiftUI pixels or OS scheduling.
During native QA, inspect active/finished/+30 on Lock Screen and compact/expanded
Island, for both accents and light/dark appearance. Confirm whole ghost
segments and unchanged bounds. Do not force a stale date earlier to make the
color change at zero.

## Measured progress-mask prototype (2026-10-06)

An independent frame review of the iOS 26.5 simulator recording
`.local-release/rest-phase-prototype/locked-expiry-v2.mov` found these visual
boundaries. Times are original video presentation timestamps, not wall-clock
deadline measurements. The recording contains 111 frames at a variable cadence.

| Case | Last neutral `REPOS / 00:01` | First orange `REPOS TERMINÉ / 00:00` | Sampling gap |
| --- | --- | --- | --- |
| First expiry | 21.068333 s | 21.256667 s | 188.334 ms |
| Old deadline during late +30 propagation | 77.068333 s | 77.898333 s | 830 ms |
| Final expiry | 107.070000 s | 107.901667 s | 831.667 ms |

At every recorded expiry, the first zero, finished title and accent appear in
the same encoded frame. No sampled digit frame mixes the bright neutral and
orange colors. This does not rule out an intermediate artifact inside the
sampling gaps or establish exact deadline precision.

The first +30 restores a neutral `REPOS / 00:30` at 48.631667 s. During the
second +30, the old zero is visible at 77.898333 s and 78.263333 s before the
new neutral `REPOS / 00:29` appears at 78.898333 s. The action is applied, but
this recording **does not pass a no-transient-zero check** for a last-second
extension. The system log records the associated content update; archive
propagation is a plausible explanation, not a proven diagnosis.

The log schedules stale handling later than these visual expirations and has
no recorded stale transition at their boundaries. The evidence supports a
system-rendered visual phase change without waiting for the stale fallback.
It does not independently establish process suspension or physical-device
behavior. Always-On, Reduce Motion, VoiceOver and notifications-disabled cases
still require direct validation. No continuous or finite blink is claimed.

V2 predates the final complementary horizontal mask direction and explicit
accessibility value. Their subsequent Release compilation passed, but this
video must not be relabeled as validation of those later changes.
Local evidence: `expiry-v2-analysis/receipt.json` and
`expiry-v2-analysis/boundary-contact-sheet.png` under the prototype directory.

### Final mirrored mask with the app process stopped

The last cycle in `final-expiry.mov` tests the later complementary horizontal
masks and explicit accessibility value. The operator started +30 from the Lock
Screen, successfully terminated `app.lift.training` during the countdown, and
checked that its process was absent before and after expiry. This process check
is operator evidence; it is not inferred from the video alone.

An independent review of the original video frames found:

| Frame | Video time | Visible result |
| --- | --- | --- |
| 6521 | 145.645000 s | Neutral `REPOS / 00:13`, after the reported process stop |
| 6534 | 158.348333 s | Neutral `REPOS / 00:01` |
| 6535 | 158.645000 s | Orange `REPOS TERMINÉ / 00:00` |
| 6542 | 163.355000 s | The same complete, stable finished state |

The first zero, finished title and accent occur in the same recorded frame;
the final sampling gap is 296.667 ms. No partial title or mixed digit colors
were observed in the reviewed frames. The system log records its last activity
update at 05:55:25.279 Europe/Paris and schedules stale handling for 05:57:25,
after this recorded expiry. It contains no new activity update or stale event
at the visual boundary.

This validates the final Lock Screen visual transition on this simulator with
the app process stopped. It is not physical-device, Always-On, Reduce Motion,
VoiceOver or notifications-disabled validation; it does not guarantee precise
deadline delivery, a pulse, or the absence of artifacts within the sampling gap.
It also does not supersede V2's late-extension latency observation.
Proof and source hashes: `final-analysis/receipt.json` and
`final-analysis/final-proof.png` in the same prototype directory. The original
video SHA256 is `0329d83ceb808950b12df292cc20a2c35f14b4726565f5069789681edd1ec1cc`.

References: [dynamic Text formatting and reduced cadence](https://developer.apple.com/documentation/swiftui/text/init(_:format:)-8sfgg),
[TimeDataSource](https://developer.apple.com/documentation/swiftui/timedatasource).
Local rejected-prototype proof: `.local-release/rest-label-qa/custom-format-countdown.jpg`.
