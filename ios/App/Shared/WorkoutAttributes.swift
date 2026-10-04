import ActivityKit
import Foundation

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

        func presentation(isStale: Bool = false, at now: Date = Date()) -> WorkoutActivityPresentation {
            guard expirationDate > now else { return .sessionExpired }
            guard let end = endDate else { return isStale ? .sessionExpired : .ready }
            if end <= now || (isStale && end < expirationDate) { return .restFinished }
            return isStale ? .sessionExpired : .countdown
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
