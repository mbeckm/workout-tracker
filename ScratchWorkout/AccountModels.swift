import Foundation

enum AccountProvider: String, CaseIterable, Codable, Identifiable {
    case iCloud

    var id: String { rawValue }

    var title: String {
        "iCloud"
    }
}

struct AccountUser: Identifiable, Equatable, Codable {
    var id: String
    var displayName: String
    var email: String?
    var provider: AccountProvider
    var createdAt: Date
}

enum AccountError: LocalizedError, Equatable {
    case network
    case backendFailed(String)
    case migrationFailed
    case iCloudUnavailable

    var errorDescription: String? {
        switch self {
        case .network:
            "You appear to be offline. Check your connection and try again."
        case .backendFailed(let message):
            message
        case .migrationFailed:
            "We couldn't sync your device data. Please try again."
        case .iCloudUnavailable:
            "iCloud is unavailable. Your workouts are still saved on this device. Sign in to iCloud in Settings to enable sync."
        }
    }
}

/// Launch and local workouts stay usable when iCloud is unavailable.
enum AuthSession: Equatable {
    case loading
    case signedOut
    case signedIn(AccountUser)

    var user: AccountUser? {
        guard case let .signedIn(user) = self else {
            return nil
        }

        return user
    }
}

enum AccountSyncState: Equatable {
    case idle
    case syncing
    case synced(Date)
    case failed(String)
    case signedOut

    var label: String {
        switch self {
        case .idle:
            "Ready"
        case .syncing:
            "Syncing"
        case .synced:
            "Synced"
        case .failed:
            "Needs retry"
        case .signedOut:
            "Local"
        }
    }
}

enum WorkoutSyncReason: String {
    case planSaved
    case planUpdated
    case exerciseLibraryUpdated
    case workoutCompleted
    case manual
}

enum WorkoutSnapshotConflictDecision: Equatable {
    case useRemote
    case pushLocal
}

enum WorkoutSnapshotConflictPolicy {
    static func decide(
        hasPersistedLocalSnapshot: Bool,
        localModifiedAt: Date,
        remoteCapturedAt: Date
    ) -> WorkoutSnapshotConflictDecision {
        guard hasPersistedLocalSnapshot else {
            return .useRemote
        }

        return remoteCapturedAt >= localModifiedAt ? .useRemote : .pushLocal
    }
}

struct WorkoutCloudSnapshot: Equatable, Codable {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var archivedPlans: [WorkoutPlan]
    var customExercises: [CustomExerciseDefinition]
    var workoutHistory: [LoggedWorkout]
    var nextDayIndex: Int
    var capturedAt: Date

    init(
        activePlan: WorkoutPlan,
        savedPlans: [WorkoutPlan],
        archivedPlans: [WorkoutPlan] = [],
        customExercises: [CustomExerciseDefinition] = [],
        workoutHistory: [LoggedWorkout],
        nextDayIndex: Int,
        capturedAt: Date
    ) {
        self.activePlan = activePlan
        self.savedPlans = savedPlans
        self.archivedPlans = archivedPlans
        self.customExercises = customExercises
        self.workoutHistory = workoutHistory
        self.nextDayIndex = nextDayIndex
        self.capturedAt = capturedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        activePlan = try container.decode(WorkoutPlan.self, forKey: .activePlan)
        savedPlans = try container.decode([WorkoutPlan].self, forKey: .savedPlans)
        archivedPlans = try container.decodeIfPresent([WorkoutPlan].self, forKey: .archivedPlans) ?? []
        customExercises = try container.decodeIfPresent([CustomExerciseDefinition].self, forKey: .customExercises) ?? []
        workoutHistory = try container.decode([LoggedWorkout].self, forKey: .workoutHistory)
        nextDayIndex = try container.decode(Int.self, forKey: .nextDayIndex)
        capturedAt = try container.decode(Date.self, forKey: .capturedAt)
    }
}
