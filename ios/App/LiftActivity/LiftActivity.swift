import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

private struct ActivityPalette {
    let isDark: Bool
    let background: Color
    let text: Color
    let muted: Color
    let accent: Color
    let progress: Color
    let actionBackground: Color
    let accentBackground: Color

    init(isDark: Bool, accent: String?) {
        self.isDark = isDark
        let orange = accent != "blue"
        // sRGB equivalents of the app's surface/text/muted tokens in index.css.
        // Signal text uses the contrast-safe variant, not the brighter fill token.
        background = Self.color(isDark ? (orange ? 0x121315 : 0x0D131D) : 0xFFFFFF)
        text = Self.color(isDark ? (orange ? 0xF5F5F6 : 0xF3F5F9) : (orange ? 0x151619 : 0x0F1623))
        muted = Self.color(isDark ? (orange ? 0x919295 : 0x8B939F) : (orange ? 0x68696B : 0x636975))
        self.accent = Self.color(isDark ? (orange ? 0xFF9A3D : 0x7AA7FF) : (orange ? 0xB34F00 : 0x1D4ED8))
        progress = Self.color(isDark ? (orange ? 0xFF8A1F : 0x5B93FF) : (orange ? 0xE06A00 : 0x2563EB))
        actionBackground = Self.color(isDark ? (orange ? 0x1B1C1E : 0x151C28) : (orange ? 0xEFF0F2 : 0xECF0F8))
        accentBackground = Self.color(orange ? 0xFF7B00 : (isDark ? 0x3068F5 : 0x2563EB))
            .opacity(isDark ? 0.18 : 0.10)
    }

    private static func color(_ hex: UInt32) -> Color {
        Color(.sRGB, red: Double((hex >> 16) & 0xFF) / 255,
              green: Double((hex >> 8) & 0xFF) / 255,
              blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}

private extension WorkoutAttributes.ContentState {
    func restHeading(isStale: Bool) -> String {
        presentation(isStale: isStale) == .restFinished
            ? (restLabel == "Repos" ? "Repos terminé" : "Rest over")
            : restLabel
    }

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
    let accent: String?

    private static let orangeIcon = loadIcon(named: "AppIcon-512@2x")
    private static let blueIcon = loadIcon(named: "AppIconBlue")

    private static func loadIcon(named name: String) -> UIImage {
        guard let path = Bundle.main.path(forResource: name, ofType: "png"),
              let source = UIImage(contentsOfFile: path) else { return UIImage() }
        // This PNG is a shared bundle resource, not an asset-catalog image.
        // Decode it explicitly and keep WidgetKit's archived image small while
        // preserving enough pixels for the largest 24 pt mark @3x.
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let bounds = CGRect(x: 0, y: 0, width: 128, height: 128)
        return UIGraphicsImageRenderer(size: bounds.size, format: format).image { _ in
            source.draw(in: bounds)
        }
    }

    var body: some View {
        // Both targets copy the same official app-icon source, so they cannot drift.
        Image(uiImage: accent == "blue" ? Self.blueIcon : Self.orangeIcon)
            .resizable()
            .interpolation(.high)
            .scaledToFit()
            .frame(width: size, height: size)
            // Preserve the official artwork's safe area on every activity surface.
            .clipShape(RoundedRectangle(cornerRadius: size * 0.23, style: .continuous))
            .accessibilityLabel("Lift")
    }
}

private struct RestClock: View {
    let state: WorkoutAttributes.ContentState
    let palette: ActivityPalette
    var size: CGFloat
    var isStale = false

    var body: some View {
        let presentation = state.presentation(isStale: isStale)
        Group {
            if presentation == .sessionExpired {
                Text(state.restLabel == "Repos" ? "Ouvrir Lift" : "Open Lift")
                    .font(.custom("Geologica-SemiBold", fixedSize: min(size, 15)))
            } else if presentation == .restFinished {
                finishedReadout
                    .accessibilityLabel(state.restLabel == "Repos" ? "Repos terminé" : "Rest over")
            } else if let range = state.timerRange {
                ZStack(alignment: .trailing) {
                    countdownReadout(range: range)
                        .foregroundStyle(palette.text)
                        .mask { RestPhaseMask(deadline: range.upperBound, finished: false) }
                    finishedReadout
                        .mask { RestPhaseMask(deadline: range.upperBound, finished: true) }
                }
                // A visual mask does not hide children from VoiceOver. Expose
                // exactly one native, self-updating remaining-time value.
                .accessibilityRepresentation {
                    Text(timerInterval: range, countsDown: true, showsHours: false)
                        .accessibilityLabel(state.restLabel == "Repos" ? "Temps de repos restant" : "Rest time remaining")
                        .accessibilityValue(Text(timerInterval: range, countsDown: true, showsHours: false))
                }
            } else {
                Text(state.totalSets > 0 && state.completedSets >= state.totalSets
                     ? (state.restLabel == "Repos" ? "Terminé" : "Done") : state.readyLabel)
                    .font(.custom("Geologica-SemiBold", fixedSize: min(size, 24)))
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.65)
        .multilineTextAlignment(.trailing)
        .foregroundStyle(palette.text)
    }

    private var finishedReadout: some View {
        ZStack(alignment: .trailing) {
            Text("00:00")
                .font(.custom("LiftSegmentGhost-BoldItalic", fixedSize: size))
                .opacity(0.10)
                .accessibilityHidden(true)
            Text("00:00")
                .font(.custom("LiftTimer-BoldItalic", fixedSize: size))
        }
        .monospacedDigit()
        .foregroundStyle(palette.accent)
    }

    private func countdownReadout(range: ClosedRange<Date>) -> some View {
        ZStack(alignment: .trailing) {
            Text(timerInterval: range, countsDown: true, showsHours: false)
                .font(.custom("LiftSegmentGhost-BoldItalic", fixedSize: size))
                .opacity(0.10)
                .accessibilityHidden(true)
            Text(timerInterval: range, countsDown: true, showsHours: false)
                .font(.custom("LiftTimer-BoldItalic", fixedSize: size))
        }
        .monospacedDigit()
    }
}

// The system advances a timer ProgressView even while Lift is suspended.
// Use its endpoint to reveal the finished title/readout: isStale can arrive
// well after the deadline. The two mirrored masks meet within a 100 ms window;
// clip the enlarged rail before filtering so composition stays label-sized.
// System-renderer regression recordings and device limits: tests/native-timing.
private struct RestPhaseMask: View {
    let deadline: Date
    let finished: Bool

    var body: some View {
        GeometryReader { geometry in
            ProgressView(timerInterval: deadline.addingTimeInterval(-0.05)...deadline.addingTimeInterval(0.05),
                         countsDown: !finished) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear)
                .tint(.white)
                .environment(\.colorScheme, .dark)
                .frame(width: 100, height: 4)
                .scaleEffect(x: finished ? -8 : 8, y: 32)
                .frame(width: geometry.size.width, height: geometry.size.height)
                .clipped()
                .background(.black)
                .compositingGroup()
                .contrast(100)
                .luminanceToAlpha()
                .clipped()
        }
        .accessibilityHidden(true)
    }
}

private struct RestHeading: View {
    let state: WorkoutAttributes.ContentState
    let isStale: Bool

    var body: some View {
        if let end = state.endDate, state.presentation(isStale: isStale) == .countdown {
            ZStack(alignment: .trailing) {
                Text(state.restLabel.uppercased())
                    .mask { RestPhaseMask(deadline: end, finished: false) }
                Text(state.restLabel == "Repos" ? "REPOS TERMINÉ" : "REST OVER")
                    .mask { RestPhaseMask(deadline: end, finished: true) }
            }
            .accessibilityHidden(true)
        } else {
            Text(state.restHeading(isStale: isStale).uppercased())
        }
    }
}

private struct WorkoutProgress: View {
    let state: WorkoutAttributes.ContentState
    let palette: ActivityPalette

    var body: some View {
        HStack(spacing: 10) {
            ProgressView(value: Double(state.completedSets), total: Double(max(1, state.totalSets)))
                .tint(palette.progress)
            Text("\(state.completedSets)/\(state.totalSets) \(state.progressLabel)")
                .font(.custom("Geologica-Medium", fixedSize: 10))
                .monospacedDigit()
                .foregroundStyle(palette.muted)
                .fixedSize()
        }
    }
}

private struct WorkoutActions: View {
    let state: WorkoutAttributes.ContentState
    let palette: ActivityPalette
    let isStale: Bool

    var body: some View {
        HStack(spacing: 7) {
            if #available(iOS 17.0, *), state.presentation(isStale: isStale).canAdjustRest {
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
        .foregroundStyle(palette.accent)
    }

    private func actionLabel(_ title: String, symbol: String) -> some View {
        HStack(spacing: 5) {
            Image(systemName: symbol).font(.system(size: 10, weight: .bold))
            Text(title).font(.custom("Geologica-SemiBold", fixedSize: 11))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(palette.actionBackground, in: Capsule())
    }
}

private struct LockScreenWorkout: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isLuminanceReduced) private var isLuminanceReduced
    let state: WorkoutAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let palette = ActivityPalette(isDark: state.usesDarkAppearance(systemIsDark: colorScheme == .dark,
                                                                      isLuminanceReduced: isLuminanceReduced),
                                      accent: state.accent)
        let showRest = state.presentation(isStale: isStale).canAdjustRest
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                LiftMark(size: 24, accent: state.accent)
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text("Lift")
                        .font(.custom("Geologica-Bold", fixedSize: 14))
                        .foregroundStyle(palette.text)
                    Text("·")
                        .accessibilityHidden(true)
                    Text(state.workoutType)
                        .lineLimit(1)
                }
                .font(.custom("Geologica-Medium", fixedSize: 14))
                .foregroundStyle(palette.muted)
                Spacer(minLength: 8)
                Text(state.setLabel)
                    .font(.custom("Geologica-SemiBold", fixedSize: 11))
                    .foregroundStyle(palette.accent)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(palette.accentBackground, in: Capsule())
                    .fixedSize()
            }

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(state.exercise)
                        .font(.custom("Geologica-SemiBold", fixedSize: 16))
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if !state.detail.isEmpty {
                        Text(state.detail)
                            .font(.custom("Geologica-Medium", fixedSize: 10))
                            .foregroundStyle(palette.muted)
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                RestClock(state: state, palette: palette, size: 30, isStale: isStale)
                    .frame(width: 128, alignment: .trailing)
                    .overlay(alignment: .topTrailing) {
                        if showRest {
                            RestHeading(state: state, isStale: isStale)
                                .font(.custom("Geologica-Bold", fixedSize: 9))
                                .tracking(1.7)
                                .foregroundStyle(palette.muted)
                                .lineLimit(1)
                                .offset(y: -12)
                        }
                    }
            }
            // Reserve label space above the row: align the actual readout, rather
            // than the combined label/readout height, with the exercise details.
            .padding(.top, showRest ? 10 : 0)

            WorkoutActions(state: state, palette: palette, isStale: isStale)
            WorkoutProgress(state: state, palette: palette)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .activityBackgroundTint(palette.background)
        .activitySystemActionForegroundColor(palette.text)
        .foregroundStyle(palette.text)
        .environment(\.colorScheme, palette.isDark ? .dark : .light)
    }
}

struct LiftActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            LockScreenWorkout(state: context.state, isStale: context.isStale)
                .widgetURL(context.state.workoutURL)
        } dynamicIsland: { context in
            let state = context.state
            // Apple keeps every Island presentation on an opaque black surface,
            // independently of the app's appearance or the Lock Screen palette.
            let palette = ActivityPalette(isDark: true, accent: state.accent)
            let showRest = state.presentation(isStale: context.isStale).canAdjustRest
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 7) {
                        LiftMark(size: 24, accent: state.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Lift")
                                .font(.custom("Geologica-Bold", fixedSize: 12))
                            Text(state.workoutType)
                                .font(.custom("Geologica-Medium", fixedSize: 11))
                                .foregroundStyle(palette.muted)
                                .lineLimit(1)
                        }
                    }
                    .foregroundStyle(palette.text)
                    // Both regions share one vertical centre, even when the
                    // status changes from one short word to the finished label.
                    .frame(height: 40, alignment: .center)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 3) {
                        if showRest {
                            RestHeading(state: state, isStale: context.isStale)
                                .font(.custom("Geologica-Bold", fixedSize: 9))
                                .tracking(1.2)
                                .foregroundStyle(palette.muted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                        RestClock(state: state, palette: palette, size: 23, isStale: context.isStale)
                    }
                    // All regions use the same outer margins. The heading and
                    // digits share the body/progress/actions trailing edge.
                    .frame(width: 100, alignment: .trailing)
                    .frame(height: 40, alignment: .center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    // Keep the full summary and progress inside the expanded height budget.
                    VStack(alignment: .leading, spacing: 3) {
                        Text(state.exercise)
                            .font(.custom("Geologica-SemiBold", fixedSize: 16))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        Text([state.setLabel, state.detail].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.custom("Geologica-Medium", fixedSize: 11))
                            .foregroundStyle(palette.muted)
                            .lineLimit(1)
                        WorkoutProgress(state: state, palette: palette)
                        WorkoutActions(state: state, palette: palette, isStale: context.isStale)
                    }
                    .foregroundStyle(palette.text)
                    .environment(\.colorScheme, .dark)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                LiftMark(size: 20, accent: state.accent)
                    .padding(3)
                    .frame(width: 26, height: 26)
            } compactTrailing: {
                RestClock(state: state, palette: palette, size: 12, isStale: context.isStale)
                    .frame(width: 52, alignment: .trailing)
            } minimal: {
                LiftMark(size: 20, accent: state.accent)
                    .padding(3)
                    .frame(width: 26, height: 26)
            }
            // One shared safe inset aligns logo, summary, progress and actions;
            // it also protects the top heading from the curved right corner.
            .contentMargins(.horizontal, 36, for: .expanded)
            .contentMargins(.top, 16, for: .expanded)
            .contentMargins(.bottom, 16, for: .expanded)
            .keylineTint(palette.accent)
            .widgetURL(state.workoutURL)
        }
    }
}

@main
struct LiftActivityBundle: WidgetBundle {
    var body: some Widget { LiftActivity() }
}
