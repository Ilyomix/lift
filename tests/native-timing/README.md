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
