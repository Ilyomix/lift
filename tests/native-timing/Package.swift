// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "WorkoutTimingTests", targets: [
    .target(name: "ActivityKit"),
    .target(name: "WorkoutTiming", dependencies: ["ActivityKit"]),
    .testTarget(name: "WorkoutTimingTests", dependencies: ["WorkoutTiming"]),
])
