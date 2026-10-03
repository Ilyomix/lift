import ActivityKit
import SwiftUI
import WidgetKit

private let accent = Color(red: 0.35, green: 0.65, blue: 1)

struct RestClock: View {
    let state: WorkoutAttributes.ContentState
    var body: some View {
        if let range = state.timerRange {
            // The system renders this timer, including while the host app is suspended.
            Text(timerInterval: range, countsDown: true).monospacedDigit()
        } else {
            Text(state.readyLabel)
        }
    }
}

struct LiftActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            let s = context.state
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label("Lift · \(s.workoutType)", systemImage: "dumbbell.fill").font(.headline)
                    Spacer()
                    RestClock(state: s).font(.title2.bold()).foregroundStyle(accent)
                }
                HStack {
                    Text(s.exercise).font(.headline).lineLimit(1)
                    Spacer()
                    Text(s.setLabel).font(.subheadline)
                }
                Text(s.detail).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                ProgressView(value: Double(s.completedSets), total: Double(max(1, s.totalSets))).tint(accent)
                Text("\(s.completedSets)/\(s.totalSets) \(s.progressLabel)").font(.caption2).foregroundStyle(.secondary)
            }
            .padding(16)
            .activityBackgroundTint(Color(red: 0.025, green: 0.04, blue: 0.075))
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(s.workoutType, systemImage: "dumbbell.fill").font(.headline).foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestClock(state: s).font(.title2.bold()).frame(maxWidth: 90)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(s.exercise).font(.headline).lineLimit(1)
                        Text("\(s.setLabel) · \(s.detail)").font(.caption).lineLimit(1)
                        ProgressView(value: Double(s.completedSets), total: Double(max(1, s.totalSets))).tint(accent)
                    }
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill").foregroundStyle(accent)
            } compactTrailing: {
                RestClock(state: s).font(.caption).frame(maxWidth: 52)
            } minimal: {
                Image(systemName: "dumbbell.fill").foregroundStyle(accent)
            }
            .keylineTint(accent)
        }
    }
}

@main
struct LiftActivityBundle: WidgetBundle {
    var body: some Widget { LiftActivity() }
}
