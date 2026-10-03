import ActivityKit
import Foundation

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
        var timerRange: ClosedRange<Date>? {
            guard let end = endDate else { return nil }
            return end.addingTimeInterval(-max(1, restTotal))...end
        }
    }
    var workoutId: String
}
