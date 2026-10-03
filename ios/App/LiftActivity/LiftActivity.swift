import ActivityKit
import SwiftUI
import WidgetKit

private let accent = Color(red: 0.35, green: 0.65, blue: 1)
private let muted = Color(red: 0.65, green: 0.70, blue: 0.79)
private let activityBackground = Color(red: 0.035, green: 0.05, blue: 0.085)

private extension WorkoutAttributes.ContentState {
    var workoutURL: URL? {
        var components = URLComponents()
        components.scheme = "lift"
        components.host = "workout"
        components.queryItems = [URLQueryItem(name: "workoutId", value: workoutId)]
        return components.url
    }
}

private struct LiftMark: View {
    var size: CGFloat

    var body: some View {
        // Both targets copy the same official app-icon source, so they cannot drift.
        Image("AppIcon-512", bundle: .main)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            // Trim the icon's outer safe area so its official mark remains legible at 24 pt.
            .scaleEffect(1.5)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.23, style: .continuous))
            .accessibilityLabel("Lift")
    }
}

private struct RestClock: View {
    let state: WorkoutAttributes.ContentState
    var size: CGFloat
    var isStale = false

    var body: some View {
        Group {
            if isStale {
                Text(state.restLabel == "Repos" ? "Ouvrir Lift" : "Open Lift")
                    .font(.system(size: min(size, 15), weight: .semibold))
            } else if let range = state.timerRange {
                // ActivityKit renders the countdown while the host app is suspended.
                // Use the same DSEG7 face as the in-app timer, without a per-second update loop.
                Text(timerInterval: range, countsDown: true, showsHours: false)
                    .font(.custom("DSEG7ClassicMini-BoldItalic", fixedSize: size))
                    .monospacedDigit()
            } else {
                Text(state.totalSets > 0 && state.completedSets >= state.totalSets
                     ? (state.restLabel == "Repos" ? "Terminé" : "Done") : state.readyLabel)
                    .font(.system(size: min(size, 24), weight: .semibold))
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.65)
        .multilineTextAlignment(.trailing)
        .foregroundStyle(accent)
    }
}

private struct WorkoutProgress: View {
    let state: WorkoutAttributes.ContentState

    var body: some View {
        HStack(spacing: 10) {
            ProgressView(value: Double(state.completedSets), total: Double(max(1, state.totalSets)))
                .tint(accent)
            Text("\(state.completedSets)/\(state.totalSets) \(state.progressLabel)")
                .font(.system(size: 10, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(muted)
                .fixedSize()
        }
    }
}

private struct WorkoutActions: View {
    let state: WorkoutAttributes.ContentState
    let isStale: Bool

    var body: some View {
        HStack(spacing: 7) {
            if #available(iOS 17.0, *), state.restEndAt != nil, !isStale {
                Button(intent: ChangeWorkoutRestIntent(action: "add30", state: state)) {
                    actionLabel("30 s", symbol: "plus")
                }
                .accessibilityLabel(state.restLabel == "Repos" ? "Ajouter 30 secondes" : "Add 30 seconds")
                Button(intent: ChangeWorkoutRestIntent(action: "skip", state: state)) {
                    actionLabel(state.restLabel == "Repos" ? "Passer" : "Skip", symbol: "forward.end.fill")
                }
                .accessibilityLabel(state.restLabel == "Repos" ? "Passer le repos" : "Skip rest")
            }
            if let url = state.workoutURL {
                Link(destination: url) {
                    actionLabel(state.restLabel == "Repos" ? "Reprendre" : "Resume", symbol: "arrow.up.right")
                }
                .accessibilityLabel(state.restLabel == "Repos" ? "Reprendre la séance" : "Resume workout")
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
    }

    private func actionLabel(_ title: String, symbol: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 10, weight: .bold))
            Text(title).font(.system(size: 11, weight: .semibold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(.white.opacity(0.08), in: Capsule())
    }
}

private struct LockScreenWorkout: View {
    let state: WorkoutAttributes.ContentState
    let isStale: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                LiftMark(size: 24)
                Text("Lift")
                    .font(.system(size: 14, weight: .bold))
                Text("· \(state.workoutType)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(muted)
                    .lineLimit(1)
                Spacer(minLength: 8)
                Text(state.setLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(accent.opacity(0.12), in: Capsule())
                    .fixedSize()
            }

            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(state.exercise)
                        .font(.system(size: 17, weight: .semibold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if !state.detail.isEmpty {
                        Text(state.detail)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(muted)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 7) {
                    if state.timerRange != nil && !isStale {
                        Text(state.restLabel.uppercased())
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1.7)
                            .foregroundStyle(muted)
                    }
                    RestClock(state: state, size: 32, isStale: isStale)
                }
                .frame(width: 136, alignment: .trailing)
            }

            WorkoutActions(state: state, isStale: isStale)
            WorkoutProgress(state: state)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .activityBackgroundTint(activityBackground)
        .activitySystemActionForegroundColor(.white)
        .foregroundStyle(.white)
    }
}

struct LiftActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            LockScreenWorkout(state: context.state, isStale: context.isStale)
                .widgetURL(context.state.workoutURL)
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        LiftMark(size: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Lift")
                                .font(.system(size: 12, weight: .bold))
                            Text(state.workoutType)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(muted)
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 5) {
                        if state.timerRange != nil && !context.isStale {
                            Text(state.restLabel.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .tracking(1.2)
                                .foregroundStyle(muted)
                        }
                        RestClock(state: state, size: 25, isStale: context.isStale)
                    }
                    .frame(width: 112, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(state.exercise)
                            .font(.system(size: 17, weight: .semibold))
                            .lineLimit(2)
                        Text([state.setLabel, state.detail].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(muted)
                            .lineLimit(1)
                        WorkoutActions(state: state, isStale: context.isStale)
                        WorkoutProgress(state: state)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 6)
                }
            } compactLeading: {
                LiftMark(size: 26)
            } compactTrailing: {
                RestClock(state: state, size: 12, isStale: context.isStale)
                    .frame(width: 52, alignment: .trailing)
            } minimal: {
                LiftMark(size: 26)
            }
            .keylineTint(accent)
            .widgetURL(state.workoutURL)
        }
    }
}

@main
struct LiftActivityBundle: WidgetBundle {
    var body: some Widget { LiftActivity() }
}
