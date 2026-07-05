import Foundation

struct MigrationRequest: Equatable {
    var localSnapshot: WorkoutCloudSnapshot
}

protocol AccountMigrating {
    func migrate(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws
}

/// Overwrites remote with the local snapshot. Callers invoke only when remote was empty.
final class RepositoryMigrationCoordinator: AccountMigrating {
    private let repository: CloudWorkoutRepository

    init(repository: CloudWorkoutRepository) {
        self.repository = repository
    }

    func migrate(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws {
        try await repository.saveSnapshot(snapshot, for: user)
        let verified = try await repository.loadSnapshot(for: user)
        guard verified != nil else {
            throw AccountError.migrationFailed
        }
    }
}
