import ActivityKit
import Capacitor
import Foundation
import UIKit

@objc(WorkoutActivityPlugin)
public class WorkoutActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WorkoutActivityPlugin"
    public let jsName = "WorkoutActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled])
    }

    @objc func sync(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let object = call.getObject("state") else {
                    for activity in Activity<WorkoutAttributes>.activities {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                    call.resolve()
                    return
                }
                let data = try JSONSerialization.data(withJSONObject: object)
                let state = try JSONDecoder().decode(WorkoutAttributes.ContentState.self, from: data)
                guard state.version == 1 else { call.reject("Unknown workout state version"); return }
                let content = ActivityContent(state: state, staleDate: state.expirationDate)
                for activity in Activity<WorkoutAttributes>.activities where activity.attributes.workoutId != state.workoutId {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                if let activity = Activity<WorkoutAttributes>.activities.first(where: { $0.attributes.workoutId == state.workoutId }) {
                    await activity.update(content)
                } else if ActivityAuthorizationInfo().areActivitiesEnabled && UIApplication.shared.applicationState == .active {
                    _ = try Activity.request(attributes: WorkoutAttributes(workoutId: state.workoutId), content: content, pushType: nil)
                }
                call.resolve()
            } catch {
                call.reject("Unable to update workout activity: \(error.localizedDescription)")
            }
        }
    }
}
