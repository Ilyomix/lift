import Foundation
import XCTest
@testable import WorkoutTiming

final class WorkoutTimingTests: XCTestCase {
    let now = Date(timeIntervalSince1970: 1_000_000)

    func state(rest: Double? = 60, expiry: Double = 28_800) -> WorkoutAttributes.ContentState {
        .init(version: 1, workoutId: "fictional-test", workoutType: "Pull",
              exercise: "Lat pulldown", setLabel: "Set 1/3", detail: "",
              completedSets: 1, totalSets: 33,
              restEndAt: rest.map { now.addingTimeInterval($0).timeIntervalSince1970 * 1000 },
              restTotal: 60, expiresAt: now.addingTimeInterval(expiry).timeIntervalSince1970 * 1000,
              restLabel: "Rest", readyLabel: "Ready", progressLabel: "sets")
    }

    func testFutureRestSchedulesItsDeadlineAndAllowsActions() {
        let s = state()
        XCTAssertEqual(s.activityStaleDate(at: now), now.addingTimeInterval(60))
        XCTAssertEqual(s.presentation(at: now), .countdown)
        XCTAssertTrue(s.presentation(at: now).canAdjustRest)
    }

    func testDeadlineRefreshShowsZeroButKeepsActions() {
        let s = state()
        XCTAssertEqual(s.presentation(isStale: true, at: now.addingTimeInterval(60)), .restFinished)
        XCTAssertTrue(s.presentation(isStale: true, at: now.addingTimeInterval(60)).canAdjustRest)
    }

    func testStaleVariantPreparedBeforeDeadlineShowsFinishedRest() {
        // WidgetKit may prepare both variants while the deadline is still future.
        // The stale view must not require the extension's clock to reach it first.
        let s = state()
        XCTAssertEqual(s.presentation(isStale: false, at: now), .countdown)
        XCTAssertEqual(s.presentation(isStale: true, at: now), .restFinished)
        let snapshot = s.activitySnapshot(at: now)
        XCTAssertEqual(snapshot.staleDate, s.endDate)
        XCTAssertEqual(snapshot.state.staleReason, .restEnded)
        XCTAssertEqual(snapshot.state.presentation(isStale: true, at: now), .restFinished)
    }

    func testBoundaryAndPastInitialSnapshotShowZeroWithoutStaleFlag() {
        for deadline in [0.0, -1.0, -600.0] {
            let s = state(rest: deadline)
            XCTAssertEqual(s.presentation(at: now), .restFinished)
            XCTAssertEqual(s.activityStaleDate(at: now), s.expirationDate)
        }
    }

    func testSessionExpiryWinsOverRestAndDisablesActions() {
        for deadline: Double? in [nil, -1, 0, 60] {
            let s = state(rest: deadline, expiry: 0)
            XCTAssertEqual(s.presentation(at: now), .sessionExpired)
            XCTAssertFalse(s.presentation(at: now).canAdjustRest)
        }
    }

    func testStaleDateCannotExceedSessionExpiry() {
        let s = state(rest: 90, expiry: 30)
        XCTAssertEqual(s.activityStaleDate(at: now), now.addingTimeInterval(30))
        XCTAssertEqual(s.presentation(isStale: true, at: now.addingTimeInterval(30)), .sessionExpired)
    }

    func testAddThirtyDuringRestPreservesRemainingTime() {
        var s = state()
        XCTAssertTrue(s.extendRest(by: 30, at: now))
        XCTAssertEqual(s.endDate, now.addingTimeInterval(90))
        XCTAssertEqual(s.restTotal, 90)
        XCTAssertEqual(s.activityStaleDate(at: now), s.endDate)
        XCTAssertEqual(s.presentation(at: now), .countdown)
    }

    func testAddThirtyAfterExpiryRestartsThirtySeconds() {
        var s = state(rest: -120)
        XCTAssertTrue(s.extendRest(by: 30, at: now))
        XCTAssertEqual(s.endDate, now.addingTimeInterval(30))
        XCTAssertEqual(s.restTotal, 30)
        XCTAssertEqual(s.presentation(at: now), .countdown)
        XCTAssertEqual(s.activityStaleDate(at: now), s.endDate)
    }

    func testNextRestProvidesFreshCountdownAndFutureFinishedVariant() {
        let nextRest = state(rest: 120).activitySnapshot(at: now)
        XCTAssertEqual(nextRest.staleDate, now.addingTimeInterval(120))
        XCTAssertEqual(nextRest.state.presentation(isStale: false, at: now), .countdown)
        XCTAssertEqual(nextRest.state.presentation(isStale: true, at: now), .restFinished)
    }

    func testAddThirtyAfterExpiryReplacesStaleReasonAndDeadline() {
        var s = state(rest: -120).activitySnapshot(at: now).state
        XCTAssertEqual(s.staleReason, .sessionExpired)
        XCTAssertTrue(s.extendRest(by: 30, at: now))
        let updated = s.activitySnapshot(at: now)
        XCTAssertEqual(updated.staleDate, now.addingTimeInterval(30))
        XCTAssertEqual(updated.state.staleReason, .restEnded)
        XCTAssertEqual(updated.state.presentation(isStale: false, at: now), .countdown)
        XCTAssertEqual(updated.state.presentation(isStale: true, at: now), .restFinished)
    }

    func testSkipReplacesStaleReasonWithSessionExpiry() {
        var s = state().activitySnapshot(at: now).state
        s.restEndAt = nil
        s.restTotal = 0
        let updated = s.activitySnapshot(at: now)
        XCTAssertEqual(updated.staleDate, s.expirationDate)
        XCTAssertEqual(updated.state.staleReason, .sessionExpired)
        XCTAssertEqual(updated.state.presentation(isStale: false, at: now), .ready)
        XCTAssertEqual(updated.state.presentation(isStale: true, at: now), .sessionExpired)
    }

    func testAlreadyEndedRestHasFinishedFreshViewAndExpiredStaleView() {
        let snapshot = state(rest: -1).activitySnapshot(at: now)
        XCTAssertEqual(snapshot.staleDate, snapshot.state.expirationDate)
        XCTAssertEqual(snapshot.state.presentation(isStale: false, at: now), .restFinished)
        XCTAssertEqual(snapshot.state.presentation(isStale: true, at: now), .sessionExpired)
    }

    func testAddThirtyCannotSchedulePastTheSessionExpiry() {
        var s = state(rest: -1, expiry: 15)
        XCTAssertTrue(s.extendRest(by: 30, at: now))
        let snapshot = s.activitySnapshot(at: now)
        XCTAssertEqual(snapshot.staleDate, now.addingTimeInterval(15))
        XCTAssertEqual(snapshot.state.staleReason, .sessionExpired)
        XCTAssertEqual(snapshot.state.presentation(isStale: false, at: now), .countdown)
        XCTAssertEqual(snapshot.state.presentation(isStale: true, at: now), .sessionExpired)
        XCTAssertFalse(snapshot.state.presentation(isStale: true, at: now).canAdjustRest)
    }

    func testExpiryAtOrBeforeRestDeadlineHasExpiredStaleView() {
        for rest in [60.0, 60.001, 90.0] {
            let snapshot = state(rest: rest, expiry: 60).activitySnapshot(at: now)
            XCTAssertEqual(snapshot.staleDate, snapshot.state.expirationDate)
            XCTAssertEqual(snapshot.state.staleReason, .sessionExpired)
            XCTAssertEqual(snapshot.state.presentation(isStale: false, at: now), .countdown)
            XCTAssertEqual(snapshot.state.presentation(isStale: true, at: now), .sessionExpired)
        }
        let beforeExpiry = state(rest: 59.999, expiry: 60).activitySnapshot(at: now)
        XCTAssertEqual(beforeExpiry.state.staleReason, .restEnded)
        XCTAssertEqual(beforeExpiry.state.presentation(isStale: true, at: now), .restFinished)
    }

    func testActivitySnapshotRoundTripAndLegacyDecoding() throws {
        let original = state().activitySnapshot(at: now).state
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(WorkoutAttributes.ContentState.self, from: encoded)
        XCTAssertEqual(decoded, original)
        XCTAssertEqual(decoded.presentation(isStale: true, at: now), .restFinished)

        var legacyJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        legacyJSON.removeValue(forKey: "staleReason")
        let legacy = try JSONDecoder().decode(WorkoutAttributes.ContentState.self,
                                              from: JSONSerialization.data(withJSONObject: legacyJSON))
        XCTAssertNil(legacy.staleReason)
        XCTAssertEqual(legacy.presentation(isStale: false, at: now), .countdown)
        XCTAssertEqual(legacy.presentation(isStale: true, at: now), .restFinished)
    }

    func testSkippedRestReturnsReadyAndSchedulesSessionExpiry() {
        var s = state(rest: -120)
        // The production skip action clears precisely these two values.
        s.restEndAt = nil
        s.restTotal = 0
        XCTAssertEqual(s.presentation(at: now), .ready)
        XCTAssertFalse(s.presentation(at: now).canAdjustRest)
        XCTAssertEqual(s.activityStaleDate(at: now), s.expirationDate)
        XCTAssertNil(s.timerRange)
    }

    func testExpiredSessionCannotRestartRest() {
        var s = state(rest: -1, expiry: 0)
        let original = s
        XCTAssertFalse(s.extendRest(by: 30, at: now))
        XCTAssertEqual(s, original)
    }

    func testMissingRestCannotBeExtended() {
        var s = state(rest: nil)
        let original = s
        XCTAssertFalse(s.extendRest(by: 30, at: now))
        XCTAssertEqual(s, original)
    }
}
