import Foundation
import XCTest
@testable import WorkoutTiming

final class PendingRestTests: XCTestCase {
    private let workout = "fictional-workout"
    private let r1 = 1_000_000.0
    private let r2 = 2_000_000.0

    private func action(_ id: String, from expected: Double, to end: Double?, workoutId: String? = nil) -> PendingWorkoutAction {
        .init(id: id, workoutId: workoutId ?? workout, expectedRestEndAt: expected,
              restEndAt: end, restTotal: end == nil ? 0 : 90,
              action: end == nil ? "skip" : "add30")
    }

    private func latest(_ expected: Double?, _ actions: [PendingWorkoutAction]) -> PendingWorkoutAction? {
        PendingWorkoutAction.latest(matching: expected, workoutId: workout, in: actions)
    }

    func testExpiredPendingRestDoesNotReplaceNewRest() {
        let oldAction = action("old-add30", from: r1, to: r1 + 30_000)
        XCTAssertNil(latest(r2, [oldAction]), "An unacknowledged action for R1 must not overwrite a later R2 deadline.")
    }

    func testSnapshotCapturedBeforeAddThirtyReceivesPendingDeadline() {
        let added = action("add30", from: r1, to: r1 + 30_000)
        XCTAssertEqual(latest(r1, [added])?.id, added.id)
        XCTAssertEqual(latest(r1, [added])?.restEndAt, r1 + 30_000)
    }

    func testReplayingLatestAbsoluteDeadlineIsIdempotent() {
        let added = action("add30", from: r1, to: r1 + 30_000)
        XCTAssertEqual(latest(r1 + 30_000, [added])?.restEndAt, r1 + 30_000)
    }

    func testTwoExtensionsAndSkipResolveEverySnapshotInSameChain() {
        let actions = [action("first", from: r1, to: r1 + 30_000),
                       action("second", from: r1 + 30_000, to: r1 + 60_000),
                       action("skip", from: r1 + 60_000, to: nil)]
        for deadline: Double? in [r1, r1 + 30_000, r1 + 60_000, nil] {
            let pending = latest(deadline, actions)
            XCTAssertEqual(pending?.id, "skip")
            XCTAssertNil(pending?.restEndAt)
        }
    }

    func testNewRestChainRejectsOldRestEvenWhenOlderActionRemainsJournaled() {
        let actions = [action("old", from: r1, to: r1 + 30_000),
                       action("new-first", from: r2, to: r2 + 30_000),
                       action("new-second", from: r2 + 30_000, to: r2 + 60_000)]
        XCTAssertNil(latest(r1, actions))
        XCTAssertNil(latest(r1 + 30_000, actions))
        XCTAssertEqual(latest(r2, actions)?.id, "new-second")
        XCTAssertEqual(latest(r2 + 30_000, actions)?.id, "new-second")
        XCTAssertEqual(latest(r2 + 60_000, actions)?.id, "new-second")
    }

    func testAnotherWorkoutCannotSupplyPendingAction() {
        let other = action("other", from: r1, to: r1 + 30_000, workoutId: "different-workout")
        XCTAssertNil(latest(r1, [other]))
        XCTAssertNil(latest(r1, []))
    }
}
