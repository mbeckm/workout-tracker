import Foundation
import Combine
import CloudKit

private enum CloudConfiguration {
    static let containerIdentifier = "iCloud.com.marvinbeckmann.ScratchWorkout"

    static func makeContainer() -> CKContainer? {
        #if LOCAL_ONLY_BUILD || targetEnvironment(simulator)
        nil
        #else
        CKContainer(identifier: containerIdentifier)
        #endif
    }
}

protocol AuthServicing {
    func restoreUser() async throws -> AccountUser?
}

protocol CloudWorkoutRepository {
    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot?
    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws
    func deleteData(for user: AccountUser) async throws
}

/// Uses the device's existing iCloud account. ScratchWorkout does not create or
/// store a separate application account for the user.
final class ICloudAccountService: AuthServicing {
    private let container: CKContainer?

    init(container: CKContainer? = CloudConfiguration.makeContainer()) {
        self.container = container
    }

    func restoreUser() async throws -> AccountUser? {
        guard container != nil else {
            return nil
        }
        let status = try await accountStatus()
        guard status == .available else {
            return nil
        }

        return AccountUser(
            id: "icloud-private-database",
            displayName: "iCloud",
            email: nil,
            provider: .iCloud,
            createdAt: Date()
        )
    }

    private func accountStatus() async throws -> CKAccountStatus {
        guard let container else {
            return .couldNotDetermine
        }
        return try await withCheckedThrowingContinuation { continuation in
            container.accountStatus { status, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: status)
                }
            }
        }
    }
}

actor CloudKitWorkoutRepository: CloudWorkoutRepository {
    private enum Schema {
        static let recordType = "WorkoutSnapshot"
        static let recordName = "primary"
        static let snapshot = "snapshot"
        static let capturedAt = "capturedAt"
    }

    private let database: CKDatabase?
    private let recordID = CKRecord.ID(recordName: Schema.recordName)

    init(container: CKContainer? = CloudConfiguration.makeContainer()) {
        database = container?.privateCloudDatabase
    }

    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot? {
        do {
            let record = try await fetchRecord()
            let data: Data
            if let asset = record[Schema.snapshot] as? CKAsset,
               let fileURL = asset.fileURL {
                data = try Data(contentsOf: fileURL)
            } else if let inlineData = record.encryptedValues[Schema.snapshot] as? Data {
                // Backward-compatible with development records written before
                // snapshots moved to CKAsset storage.
                data = inlineData
            } else {
                throw AccountError.backendFailed("Your iCloud workout backup could not be read.")
            }
            return try JSONDecoder().decode(WorkoutCloudSnapshot.self, from: data)
        } catch let error as CKError where error.code == .unknownItem {
            return nil
        } catch {
            throw mapCloudKitError(error)
        }
    }

    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws {
        do {
            let record: CKRecord
            do {
                record = try await fetchRecord()
            } catch let error as CKError where error.code == .unknownItem {
                record = CKRecord(recordType: Schema.recordType, recordID: recordID)
            }

            let uploadURL = try makeUploadFile(for: snapshot)
            defer { try? FileManager.default.removeItem(at: uploadURL) }

            // CloudKit encrypts CKAsset fields automatically. CKAsset must be
            // assigned as a normal record value, not through encryptedValues.
            record[Schema.snapshot] = CKAsset(fileURL: uploadURL)
            record[Schema.capturedAt] = snapshot.capturedAt as CKRecordValue
            _ = try await saveRecord(record)
        } catch {
            throw mapCloudKitError(error)
        }
    }

    func deleteData(for user: AccountUser) async throws {
        do {
            _ = try await deleteRecord()
        } catch let error as CKError where error.code == .unknownItem {
            return
        } catch {
            throw mapCloudKitError(error)
        }
    }

    private func fetchRecord() async throws -> CKRecord {
        guard let database else {
            throw AccountError.iCloudUnavailable
        }
        return try await withCheckedThrowingContinuation { continuation in
            database.fetch(withRecordID: recordID) { record, error in
                if let record {
                    continuation.resume(returning: record)
                } else {
                    continuation.resume(throwing: error ?? AccountError.backendFailed("iCloud returned no workout backup."))
                }
            }
        }
    }

    private func saveRecord(_ record: CKRecord) async throws -> CKRecord {
        guard let database else {
            throw AccountError.iCloudUnavailable
        }
        return try await withCheckedThrowingContinuation { continuation in
            database.save(record) { saved, error in
                if let saved {
                    continuation.resume(returning: saved)
                } else {
                    continuation.resume(throwing: error ?? AccountError.backendFailed("iCloud did not save the workout backup."))
                }
            }
        }
    }

    private func deleteRecord() async throws -> CKRecord.ID {
        guard let database else {
            throw AccountError.iCloudUnavailable
        }
        return try await withCheckedThrowingContinuation { continuation in
            database.delete(withRecordID: recordID) { deletedID, error in
                if let deletedID {
                    continuation.resume(returning: deletedID)
                } else {
                    continuation.resume(throwing: error ?? AccountError.backendFailed("iCloud did not delete the workout backup."))
                }
            }
        }
    }

    private func makeUploadFile(for snapshot: WorkoutCloudSnapshot) throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ScratchWorkoutCloudUploads", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let fileURL = directory.appendingPathComponent("snapshot-\(UUID().uuidString).json")
        try JSONEncoder().encode(snapshot).write(to: fileURL, options: .atomic)
        return fileURL
    }

    private func mapCloudKitError(_ error: Error) -> AccountError {
        guard let cloudError = error as? CKError else {
            return .backendFailed(error.localizedDescription)
        }

        switch cloudError.code {
        case .networkFailure, .networkUnavailable, .serviceUnavailable, .requestRateLimited, .zoneBusy:
            return .network
        case .notAuthenticated, .accountTemporarilyUnavailable:
            return .iCloudUnavailable
        default:
            return .backendFailed(cloudError.localizedDescription)
        }
    }
}

actor LocalPreviewWorkoutRepository: CloudWorkoutRepository {
    private let defaults: UserDefaults
    private let keyPrefix = "scratchWorkout.account.previewCloudSnapshot.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot? {
        guard let data = defaults.data(forKey: storageKey(for: user)) else {
            return nil
        }

        return try JSONDecoder().decode(WorkoutCloudSnapshot.self, from: data)
    }

    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws {
        let data = try JSONEncoder().encode(snapshot)
        defaults.set(data, forKey: storageKey(for: user))
    }

    func deleteData(for user: AccountUser) async throws {
        defaults.removeObject(forKey: storageKey(for: user))
    }

    private func storageKey(for user: AccountUser) -> String {
        "\(keyPrefix).\(user.id)"
    }
}

@MainActor
final class AccountController: ObservableObject {
    @Published private(set) var session: AuthSession = .loading
    @Published private(set) var syncState: AccountSyncState = .signedOut
    @Published private(set) var isWorking = false
    @Published var authError: AccountError?
    @Published var alertMessage: String?
    @Published var pendingMigration: MigrationRequest?
    @Published var hydratedSnapshot: WorkoutCloudSnapshot?

    private let authService: AuthServicing
    private let repository: CloudWorkoutRepository
    private let migrationCoordinator: AccountMigrating
    private var didRestoreSession = false
    private var pendingSync: PendingWorkoutSync?
    private var syncWorker: Task<Void, Never>?

    convenience init() {
        let repository = CloudKitWorkoutRepository()
        self.init(
            authService: ICloudAccountService(),
            repository: repository
        )
    }

    init(
        authService: AuthServicing,
        repository: CloudWorkoutRepository,
        migrationCoordinator: AccountMigrating? = nil
    ) {
        let repo = repository
        self.authService = authService
        self.repository = repo
        self.migrationCoordinator = migrationCoordinator ?? RepositoryMigrationCoordinator(repository: repo)
    }

    func restoreSession() async {
        guard !didRestoreSession else {
            return
        }

        didRestoreSession = true
        session = .loading

        let signpostID = PerformanceTrace.begin(PerformanceTrace.Name.accountRestore)
        defer {
            PerformanceTrace.end(PerformanceTrace.Name.accountRestore, id: signpostID)
        }

        do {
            if let user = try await authService.restoreUser() {
                session = .signedIn(user)

                if let remote = try await repository.loadSnapshot(for: user) {
                    hydratedSnapshot = remote
                    syncState = .synced(Date())
                } else {
                    syncState = .idle
                }
            } else {
                session = .signedOut
                syncState = .signedOut
            }
        } catch {
            session = .signedOut
            syncState = .signedOut
            setAuthError(from: error)
        }
    }

    func confirmMigration() async {
        guard let request = pendingMigration, let user = session.user else {
            return
        }

        await performAccountWork {
            syncState = .syncing
            try await migrationCoordinator.migrate(request.localSnapshot, for: user)
            syncState = .synced(Date())
            pendingMigration = nil
        }
    }

    func dismissMigration() {
        pendingMigration = nil
    }

    func prepareInitialSync(localSnapshot: WorkoutCloudSnapshot) {
        guard session.user != nil, syncState == .idle, pendingMigration == nil else {
            return
        }
        pendingMigration = MigrationRequest(localSnapshot: localSnapshot)
    }

    func deleteCloudData(localSnapshot: WorkoutCloudSnapshot) async {
        guard let user = session.user else {
            authError = .iCloudUnavailable
            alertMessage = authError?.localizedDescription
            return
        }

        await performAccountWork {
            try await repository.deleteData(for: user)
            syncState = .idle
            pendingMigration = MigrationRequest(localSnapshot: localSnapshot)
            alertMessage = "Your workout backup was deleted from iCloud. Workouts on this device were not removed."
        }
    }

    func sync(snapshot: WorkoutCloudSnapshot, reason: WorkoutSyncReason) async {
        enqueueSync(snapshot: snapshot, reason: reason)
        await syncWorker?.value
    }

    func enqueueSync(snapshot: WorkoutCloudSnapshot, reason: WorkoutSyncReason) {
        pendingSync = PendingWorkoutSync(snapshot: snapshot, reason: reason)
        startSyncWorkerIfNeeded()
    }

    private func startSyncWorkerIfNeeded() {
        guard syncWorker == nil else { return }

        syncWorker = Task {
            while let request = pendingSync {
                pendingSync = nil
                await performSync(snapshot: request.snapshot, reason: request.reason)
            }

            syncWorker = nil
            if pendingSync != nil {
                startSyncWorkerIfNeeded()
            }
        }
    }

    private func performSync(snapshot: WorkoutCloudSnapshot, reason: WorkoutSyncReason) async {
        guard let user = session.user else {
            syncState = .signedOut
            return
        }

        let signpostID = PerformanceTrace.begin(PerformanceTrace.Name.cloudSync)
        defer {
            PerformanceTrace.end(PerformanceTrace.Name.cloudSync, id: signpostID)
        }

        await performAccountWork {
            try await save(snapshot: snapshot, for: user, reason: reason)
        }
    }

    private func save(snapshot: WorkoutCloudSnapshot, for user: AccountUser, reason: WorkoutSyncReason) async throws {
        syncState = .syncing
        try await repository.saveSnapshot(snapshot, for: user)
        syncState = .synced(Date())
    }

    private func performAccountWork(_ operation: () async throws -> Void) async {
        isWorking = true
        defer { isWorking = false }

        do {
            try await operation()
        } catch {
            syncState = .failed(readableMessage(from: error))
            setAuthError(from: error)
        }
    }

    private func setAuthError(from error: Error) {
        if let accountError = error as? AccountError {
            authError = accountError
        } else {
            authError = .backendFailed(readableMessage(from: error))
        }

        alertMessage = authError?.localizedDescription
    }

    private func readableMessage(from error: Error) -> String {
        if let localizedError = error as? LocalizedError,
           let description = localizedError.errorDescription {
            return description
        }

        return error.localizedDescription
    }

}

private struct PendingWorkoutSync {
    var snapshot: WorkoutCloudSnapshot
    var reason: WorkoutSyncReason
}
