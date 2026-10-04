import ActivityKit
import Foundation

struct PendingWorkoutAction: Codable {
    var id: String
    var workoutId: String
    var expectedRestEndAt: Double
    var restEndAt: Double?
    var restTotal: Double
    var action: String

    // Intent parameters can lose sub-millisecond precision during transport.
    static func sameDeadline(_ lhs: Double?, _ rhs: Double?) -> Bool {
        switch (lhs, rhs) {
        case (nil, nil): return true
        case let (left?, right?): return abs(left - right) < 1
        default: return false
        }
    }

    static func latest(matching expectedRestEndAt: Double?, workoutId: String, in actions: [Self]) -> Self? {
        guard let latest = actions.last, latest.workoutId == workoutId else { return nil }
        if sameDeadline(expectedRestEndAt, latest.restEndAt) { return latest }
        var expected = latest.expectedRestEndAt
        if sameDeadline(expectedRestEndAt, expected) { return latest }
        // Only follow the latest rest's contiguous +30/skip chain. Older,
        // unacknowledged actions for a previous set must not overwrite a new rest.
        for previous in actions.dropLast().reversed() {
            guard previous.workoutId == workoutId,
                  sameDeadline(previous.restEndAt, expected) else { break }
            expected = previous.expectedRestEndAt
            if sameDeadline(expectedRestEndAt, expected) { return latest }
        }
        return nil
    }
}

enum WorkoutActivityPresentation: Equatable {
    case countdown, restFinished, ready, sessionExpired

    var canAdjustRest: Bool { self == .countdown || self == .restFinished }
}

struct WorkoutAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var version: Int
        var workoutId: String
        var workoutType: String
        var exercise: String
        var setLabel: String
        var detail: String
        var completedSets: Int
        var totalSets: Int
        var restEndAt: Double?
        var restTotal: Double
        var expiresAt: Double
        var restLabel: String
        var readyLabel: String
        var progressLabel: String

        var endDate: Date? { restEndAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
        var expirationDate: Date { Date(timeIntervalSince1970: expiresAt / 1000) }

        func activityStaleDate(at now: Date = Date()) -> Date {
            // One system refresh at the rest deadline; no background timer loop.
            // An already-finished rest renders immediately and next becomes stale
            // only when the workout snapshot itself expires.
            guard let end = endDate, end > now else { return expirationDate }
            return min(end, expirationDate)
        }

        func presentation(isStale _: Bool = false, at now: Date = Date()) -> WorkoutActivityPresentation {
            guard expirationDate > now else { return .sessionExpired }
            // Freshness describes ActivityKit's content, not whether this rest ended.
            // A new deadline (+30 s or the next set) wins over an old stale flag.
            guard let end = endDate else { return .ready }
            return end <= now ? .restFinished : .countdown
        }

        @discardableResult
        mutating func extendRest(by seconds: TimeInterval, at now: Date = Date()) -> Bool {
            guard let currentEnd = restEndAt, expirationDate > now, seconds > 0 else { return false }
            let nowMilliseconds = (now.timeIntervalSince1970 * 1000).rounded(.down)
            restEndAt = max(currentEnd.rounded(), nowMilliseconds) + seconds * 1000
            restTotal = currentEnd <= nowMilliseconds ? seconds : restTotal + seconds
            return true
        }

        var timerRange: ClosedRange<Date>? {
            guard let end = endDate else { return nil }
            return end.addingTimeInterval(-max(1, restTotal))...end
        }
    }
    var workoutId: String
}
