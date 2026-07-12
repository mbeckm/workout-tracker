import Foundation

enum AccountProvider: String, CaseIterable, Codable, Identifiable {
    case apple
    case google

    var id: String { rawValue }

    var title: String {
        switch self {
        case .apple:
            "Apple"
        case .google:
            "Google"
        }
    }

    var buttonTitle: String {
        "Continue with \(title)"
    }
}

struct AccountUser: Identifiable, Equatable, Codable {
    var id: String
    var displayName: String
    var email: String?
    var provider: AccountProvider
    var createdAt: Date
}

struct AuthTokens: Equatable, Codable {
    var accessToken: String
    var refreshToken: String?
    var idToken: String?
    var expiresAt: Date?

    var isExpired: Bool {
        guard let expiresAt else {
            return false
        }

        return Date() >= expiresAt
    }
}

struct StoredSession: Equatable, Codable {
    var user: AccountUser
    var tokens: AuthTokens
    var issuedAt: Date
}

struct AuthProviderCredential: Equatable {
    var provider: AccountProvider
    var idToken: String?
    var authorizationCode: String?
    var nonce: String?
    var displayName: String?
    var email: String?
}

enum AccountError: LocalizedError, Equatable {
    case cancelled
    case network
    case providerFailed(String)
    case backendFailed(String)
    case migrationFailed
    case missingSession
    case secureStorageFailed

    var errorDescription: String? {
        switch self {
        case .cancelled:
            "Sign-in was cancelled."
        case .network:
            "You appear to be offline. Check your connection and try again."
        case .providerFailed(let message):
            message
        case .backendFailed(let message):
            message
        case .migrationFailed:
            "We couldn't sync your device data. Please try again."
        case .missingSession:
            "No signed-in account is available."
        case .secureStorageFailed:
            "Your sign-in session could not be saved securely. Please try again."
        }
    }
}

/// Launch and session state stay usable when auth fails; errors surface via `authError` on the controller.
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
    case signIn
    case planSaved
    case planUpdated
    case exerciseLibraryUpdated
    case workoutCompleted
    case manual
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
