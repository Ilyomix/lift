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
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "performAction", returnType: CAPPluginReturnPromise)
    ]
    private var actionObserver: NSObjectProtocol?

    public override func load() {
        actionObserver = NotificationCenter.default.addObserver(forName: .workoutActionPerformed, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                self?.notifyListeners("actionPerformed", data: self?.pendingActionData() ?? [:], retainUntilConsumed: true)
            }
        }
    }

    deinit {
        if let actionObserver { NotificationCenter.default.removeObserver(actionObserver) }
    }

    @MainActor
    private func pendingActionData() -> JSObject {
        guard let action = WorkoutActivityActions.pendingAction,
              let data = try? JSONEncoder().encode(action),
              var json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
        // Swift's synthesized encoder omits nil, while the JS contract requires null.
        if action.restEndAt == nil { json["restEndAt"] = NSNull() }
        guard let object = JSTypes.coerceDictionaryToJSObject(json) else { return [:] }
        return ["action": object]
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["supported": true, "enabled": ActivityAuthorizationInfo().areActivitiesEnabled])
    }

    @objc func pendingAction(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(pendingActionData()) }
    }

    @objc func acknowledgeAction(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let id = call.getString("id") else { call.reject("Missing action id"); return }
            call.resolve(["acknowledged": WorkoutActivityActions.acknowledge(id: id)])
        }
    }

    @objc func performAction(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let action = call.getString("action"), let workoutId = call.getString("workoutId"),
                  let expectedRestEndAt = call.getDouble("expectedRestEndAt") else {
                call.reject("Missing workout action parameters"); return
            }
            do {
                let applied = try await WorkoutActivityActions.perform(action: action, workoutId: workoutId, expectedRestEndAt: expectedRestEndAt)
                call.resolve(["applied": applied])
            } catch {
                call.reject("Unable to apply workout action: \(error.localizedDescription)")
            }
        }
    }

    @objc func sync(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                var state: WorkoutAttributes.ContentState?
                if let object = call.getObject("state") {
                    let data = try JSONSerialization.data(withJSONObject: object)
                    state = try JSONDecoder().decode(WorkoutAttributes.ContentState.self, from: data)
                    guard state?.version == 1 else { call.reject("Unknown workout state version"); return }
                }
                WorkoutActivityActions.mayStartActivity = UIApplication.shared.applicationState == .active
                try await WorkoutActivityActions.sync(
                    state, enabled: call.getBool("enabled") ?? true,
                    notificationsEnabled: call.getBool("notificationsEnabled") ?? false,
                    sound: call.getBool("sound") ?? false
                )
                call.resolve()
            } catch {
                call.reject("Unable to update workout activity: \(error.localizedDescription)")
            }
        }
    }
}
