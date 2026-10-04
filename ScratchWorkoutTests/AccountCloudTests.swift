import XCTest
@testable import ScratchWorkout

final class WorkoutSnapshotConflictPolicyTests: XCTestCase {
    func testFreshInstallUsesRemoteSnapshot() {
        let decision = WorkoutSnapshotConflictPolicy.decide(
            hasPersistedLocalSnapshot: false,
            localModifiedAt: Date(),
            remoteCapturedAt: .distantPast
        )

        XCTAssertEqual(decision, .useRemote)
    }

    func testNewerRemoteSnapshotWins() {
        let local = Date(timeIntervalSince1970: 100)
        let remote = Date(timeIntervalSince1970: 200)

        XCTAssertEqual(
            WorkoutSnapshotConflictPolicy.decide(
                hasPersistedLocalSnapshot: true,
                localModifiedAt: local,
                remoteCapturedAt: remote
            ),
            .useRemote
        )
    }

    func testNewerOfflineLocalSnapshotIsPushed() {
        let local = Date(timeIntervalSince1970: 200)
        let remote = Date(timeIntervalSince1970: 100)

        XCTAssertEqual(
            WorkoutSnapshotConflictPolicy.decide(
                hasPersistedLocalSnapshot: true,
                localModifiedAt: local,
                remoteCapturedAt: remote
            ),
            .pushLocal
        )
    }
}

final class RepositoryMigrationCoordinatorTests: XCTestCase {
    func testMigrationUploadsAndVerifiesExactSnapshot() async throws {
        let repository = TestCloudRepository()
        let coordinator = RepositoryMigrationCoordinator(repository: repository)
        let snapshot = TestFixtures.snapshot(capturedAt: Date(timeIntervalSince1970: 123))

        try await coordinator.migrate(snapshot, for: TestFixtures.user)

        let stored = try await repository.loadSnapshot(for: TestFixtures.user)
        XCTAssertEqual(stored, snapshot)
    }

    func testMigrationFailsWhenReadBackDoesNotMatch() async {
        let repository = TestCloudRepository(replacesSavedSnapshot: true)
        let coordinator = RepositoryMigrationCoordinator(repository: repository)

        do {
            try await coordinator.migrate(TestFixtures.snapshot(), for: TestFixtures.user)
            XCTFail("Expected migration verification to fail")
        } catch {
            XCTAssertEqual(error as? AccountError, .migrationFailed)
        }
    }
}

@MainActor
final class AccountControllerTests: XCTestCase {
    func testUnavailableICloudKeepsAppLocal() async {
        let controller = AccountController(
            authService: TestAccountService(user: nil),
            repository: TestCloudRepository()
        )

        await controller.restoreSession()

        XCTAssertEqual(controller.session, .signedOut)
        XCTAssertEqual(controller.syncState, .signedOut)
    }

    func testExistingRemoteSnapshotIsOfferedForHydration() async {
        let snapshot = TestFixtures.snapshot(capturedAt: Date(timeIntervalSince1970: 456))
        let repository = TestCloudRepository(snapshot: snapshot)
        let controller = AccountController(
            authService: TestAccountService(user: TestFixtures.user),
            repository: repository
        )

        await controller.restoreSession()

        XCTAssertEqual(controller.session, .signedIn(TestFixtures.user))
        XCTAssertEqual(controller.hydratedSnapshot, snapshot)
        guard case .synced = controller.syncState else {
            return XCTFail("Expected synced state")
        }
    }

    func testEmptyCloudPromptsAndMigratesLocalSnapshot() async {
        let repository = TestCloudRepository()
        let controller = AccountController(
            authService: TestAccountService(user: TestFixtures.user),
            repository: repository
        )
        let local = TestFixtures.snapshot(capturedAt: Date(timeIntervalSince1970: 789))

        await controller.restoreSession()
        controller.prepareInitialSync(localSnapshot: local)
        XCTAssertEqual(controller.pendingMigration?.localSnapshot, local)

        await controller.confirmMigration()

        XCTAssertNil(controller.pendingMigration)
        let stored = try? await repository.loadSnapshot(for: TestFixtures.user)
        XCTAssertEqual(stored, local)
    }

    func testDeleteCloudDataPreservesLocalSnapshotForOptionalRemigration() async {
        let local = TestFixtures.snapshot(capturedAt: Date(timeIntervalSince1970: 987))
        let repository = TestCloudRepository(snapshot: local)
        let controller = AccountController(
            authService: TestAccountService(user: TestFixtures.user),
            repository: repository
        )

        await controller.restoreSession()
        await controller.deleteCloudData(localSnapshot: local)

        let stored = try? await repository.loadSnapshot(for: TestFixtures.user)
        XCTAssertNil(stored)
        XCTAssertEqual(controller.pendingMigration?.localSnapshot, local)
        XCTAssertEqual(controller.session, .signedIn(TestFixtures.user))
    }
}

private struct TestAccountService: AuthServicing {
    var user: AccountUser?

    func restoreUser() async throws -> AccountUser? {
        user
    }
}

private actor TestCloudRepository: CloudWorkoutRepository {
    private var snapshot: WorkoutCloudSnapshot?
    private let replacesSavedSnapshot: Bool

    init(snapshot: WorkoutCloudSnapshot? = nil, replacesSavedSnapshot: Bool = false) {
        self.snapshot = snapshot
        self.replacesSavedSnapshot = replacesSavedSnapshot
    }

    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot? {
        snapshot
    }

    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws {
        self.snapshot = replacesSavedSnapshot
            ? TestFixtures.snapshot(capturedAt: snapshot.capturedAt.addingTimeInterval(1))
            : snapshot
    }

    func deleteData(for user: AccountUser) async throws {
        snapshot = nil
    }
}

private enum TestFixtures {
    static let user = AccountUser(
        id: "test-icloud-user",
        displayName: "iCloud",
        email: nil,
        provider: .iCloud,
        createdAt: Date(timeIntervalSince1970: 1)
    )

    static func snapshot(capturedAt: Date = Date(timeIntervalSince1970: 10)) -> WorkoutCloudSnapshot {
        WorkoutCloudSnapshot(
            activePlan: SampleData.activePlan,
            savedPlans: [],
            archivedPlans: [],
            customExercises: [],
            workoutHistory: [],
            nextDayIndex: 0,
            capturedAt: capturedAt
        )
    }
}
