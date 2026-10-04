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

    func testFutureDeadlineWinsOverAnOldStaleFlag() {
        let nextRest = state(rest: 120)
        XCTAssertEqual(nextRest.presentation(isStale: true, at: now), .countdown)
    }

    func testAddThirtyAfterExpiryRestartsEvenWithAnOldStaleFlag() {
        var s = state(rest: -120)
        XCTAssertTrue(s.extendRest(by: 30, at: now))
        XCTAssertEqual(s.presentation(isStale: true, at: now), .countdown)
        XCTAssertEqual(s.presentation(isStale: true, at: now.addingTimeInterval(30)), .restFinished)
    }

    func testSkippedRestDoesNotBecomeAnExpiredSessionFromAnOldStaleFlag() {
        XCTAssertEqual(state(rest: nil).presentation(isStale: true, at: now), .ready)
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
