import ActivityKit
import AppIntents
import Foundation
import UserNotifications

extension Notification.Name {
    static let workoutActionPerformed = Notification.Name("LiftWorkoutActionPerformed")
}

/// LiveActivityIntent runs in the app process. Keep its result until the WebView
/// acknowledges it, including if iOS launches the app headlessly for an action.
@MainActor
enum WorkoutActivityActions {
    private static let snapshotKey = "lift.workoutActivity.snapshot"
    private static let notificationsKey = "lift.workoutActivity.notificationsEnabled"
    private static let soundKey = "lift.workoutActivity.sound"
    private static let pendingKey = "lift.workoutActivity.pendingAction"
    private static let notificationID = "7401"
    private static var previousOperation: Task<Void, Never>?

    private static func serialized<T>(_ operation: @escaping @MainActor () async throws -> T) async throws -> T {
        let previous = previousOperation
        let result = Task { @MainActor in
            await previous?.value
            return try await operation()
        }
        previousOperation = Task { _ = try? await result.value }
        return try await result.value
    }

    private static var pendingActions: [PendingWorkoutAction] {
        guard let data = UserDefaults.standard.data(forKey: pendingKey) else { return [] }
        return (try? JSONDecoder().decode([PendingWorkoutAction].self, from: data)) ?? []
    }

    static var pendingAction: PendingWorkoutAction? { pendingActions.first }

    private static var snapshot: WorkoutAttributes.ContentState? {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey) else { return nil }
        return try? JSONDecoder().decode(WorkoutAttributes.ContentState.self, from: data)
    }

    static func acknowledge(id: String) -> Bool {
        var actions = pendingActions
        guard actions.first?.id == id else { return false }
        actions.removeFirst()
        guard let data = try? JSONEncoder().encode(actions) else { return false }
        UserDefaults.standard.set(data, forKey: pendingKey)
        return true
    }

    static func sync(_ incoming: WorkoutAttributes.ContentState?, enabled: Bool, notificationsEnabled: Bool, sound: Bool) async throws {
        try await serialized {
            guard var state = incoming else {
                UserDefaults.standard.removeObject(forKey: snapshotKey)
                UserDefaults.standard.removeObject(forKey: pendingKey)
                for activity in Activity<WorkoutAttributes>.activities {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                return
            }
            if let pending = pendingActions.last {
                // Reconcile only snapshots belonging to this action's rest. Keep
                // obsolete actions until JS acknowledges them after durable storage.
                if let result = PendingWorkoutAction.latest(matching: state.restEndAt, workoutId: state.workoutId, in: pendingActions) {
                    state.restEndAt = result.restEndAt
                    state.restTotal = result.restTotal
                } else if pending.workoutId != state.workoutId {
                    UserDefaults.standard.removeObject(forKey: pendingKey)
                }
            }
            UserDefaults.standard.set(try JSONEncoder().encode(state), forKey: snapshotKey)
            UserDefaults.standard.set(notificationsEnabled, forKey: notificationsKey)
            UserDefaults.standard.set(sound, forKey: soundKey)
            if !pendingActions.isEmpty { await updateRestNotification(state) }
            for activity in Activity<WorkoutAttributes>.activities
                where !enabled || activity.attributes.workoutId != state.workoutId {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            guard enabled else { return }
            let content = ActivityContent(state: state, staleDate: state.activityStaleDate())
            if let activity = Activity<WorkoutAttributes>.activities.first(where: { $0.attributes.workoutId == state.workoutId }) {
                await activity.update(content)
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                // Requesting is allowed only from the foreground; the bridge passes this separately.
                try startIfForeground(state: state, content: content)
            }
        }
    }

    /// Defined in a shared source; UIKit is unavailable to extension code for app-state access.
    static var mayStartActivity = false

    private static func startIfForeground(state: WorkoutAttributes.ContentState, content: ActivityContent<WorkoutAttributes.ContentState>) throws {
        guard mayStartActivity else { return }
        _ = try Activity.request(attributes: WorkoutAttributes(workoutId: state.workoutId), content: content, pushType: nil)
    }

    static func perform(action: String, workoutId: String, expectedRestEndAt: Double) async throws -> Bool {
        try await serialized {
            guard action == "add30" || action == "skip",
                  var state = snapshot,
                  state.workoutId == workoutId,
                  state.expirationDate > Date(),
                  let currentEnd = state.restEndAt else { return false }
            let previous = pendingActions
            // A repeated tap on a not-yet-redrawn button may still carry the first deadline.
            // A different session or rest cannot be changed by an obsolete notification.
            let matching = PendingWorkoutAction.latest(matching: expectedRestEndAt, workoutId: workoutId, in: previous)
            let matchesPending = matching != nil && PendingWorkoutAction.sameDeadline(matching?.restEndAt, currentEnd)
            guard PendingWorkoutAction.sameDeadline(currentEnd, expectedRestEndAt) || matchesPending else { return false }

            if action == "add30" {
                guard state.extendRest(by: 30) else { return false }
            } else {
                state.restEndAt = nil
                state.restTotal = 0
            }
            let pending = PendingWorkoutAction(
                id: UUID().uuidString, workoutId: workoutId,
                expectedRestEndAt: currentEnd,
                restEndAt: state.restEndAt, restTotal: state.restTotal, action: action
            )
            UserDefaults.standard.set(try JSONEncoder().encode(state), forKey: snapshotKey)
            UserDefaults.standard.set(try JSONEncoder().encode(previous + [pending]), forKey: pendingKey)
            if let activity = Activity<WorkoutAttributes>.activities.first(where: { $0.attributes.workoutId == workoutId }) {
                await activity.update(ActivityContent(state: state, staleDate: state.activityStaleDate()))
            }
            await updateRestNotification(state)
            NotificationCenter.default.post(name: .workoutActionPerformed, object: nil)
            return true
        }
    }

    private static func updateRestNotification(_ state: WorkoutAttributes.ContentState) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().first { $0.identifier == notificationID }
        let delivered = await center.deliveredNotifications().first { $0.request.identifier == notificationID }?.request
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        center.removeDeliveredNotifications(withIdentifiers: [notificationID])
        // Preserve the user's existing notification choice, category, sound and content.
        guard UserDefaults.standard.bool(forKey: notificationsKey),
              let end = state.restEndAt, end > Date().timeIntervalSince1970 * 1000 else { return }
        let existing = pending ?? delivered
        let content = (existing?.content.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
        if existing == nil {
            let french = state.restLabel == "Repos"
            content.title = french ? "Repos terminé" : "Rest over"
            content.body = [state.exercise, state.setLabel, state.detail].filter { !$0.isEmpty }.joined(separator: " · ")
            content.categoryIdentifier = french ? "lift-rest-fr" : "lift-rest-en"
            content.sound = UserDefaults.standard.bool(forKey: soundKey) ? .default : nil
        }
        var extra = content.userInfo["cap_extra"] as? [String: Any] ?? [:]
        extra["workoutId"] = state.workoutId
        extra["restEndAt"] = end
        extra["route"] = "seance"
        content.userInfo["cap_extra"] = extra
        if var schedule = content.userInfo["cap_schedule"] as? [String: Any] {
            schedule["at"] = ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: end / 1000))
            content.userInfo["cap_schedule"] = schedule
        }
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, end / 1000 - Date().timeIntervalSince1970), repeats: false)
        try? await center.add(UNNotificationRequest(identifier: notificationID, content: content, trigger: trigger))
    }
}

@available(iOS 17.0, *)
struct ChangeWorkoutRestIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Adjust workout rest"
    static var isDiscoverable = false

    @Parameter(title: "Workout") var workoutId: String
    @Parameter(title: "Rest deadline") var expectedRestEndAt: Double
    @Parameter(title: "Action") var action: String

    init() {}

    init(action: String, state: WorkoutAttributes.ContentState) {
        self.action = action
        self.workoutId = state.workoutId
        self.expectedRestEndAt = state.restEndAt ?? 0
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        _ = try await WorkoutActivityActions.perform(action: action, workoutId: workoutId, expectedRestEndAt: expectedRestEndAt)
        return .result()
    }
}
