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
    case workoutCompleted
    case manual
}

struct WorkoutCloudSnapshot: Equatable, Codable {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var workoutHistory: [LoggedWorkout]
    var nextDayIndex: Int
    var capturedAt: Date
}
