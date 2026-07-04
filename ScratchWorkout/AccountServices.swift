import Foundation
import Combine

protocol AuthServicing {
    func restoreSession() async throws -> AccountUser?
    func signIn(with provider: AccountProvider) async throws -> AccountUser
    func signOut() async throws
    func deleteAccount(for user: AccountUser) async throws
}

protocol CloudWorkoutRepository {
    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot?
    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws
    func deleteData(for user: AccountUser) async throws
}

enum AccountServiceError: LocalizedError {
    case missingSession
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .missingSession:
            "No signed-in account is available."
        case .encodingFailed:
            "Account data could not be saved."
        }
    }
}

final class LocalPreviewAuthService: AuthServicing {
    private let defaults: UserDefaults
    private let sessionKey = "scratchWorkout.auth.previewSession.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func restoreSession() async throws -> AccountUser? {
        guard let data = defaults.data(forKey: sessionKey) else {
            return nil
        }

        return try JSONDecoder().decode(AccountUser.self, from: data)
    }

    func signIn(with provider: AccountProvider) async throws -> AccountUser {
        try await Task.sleep(nanoseconds: 250_000_000)

        let user = AccountUser(
            id: "preview-\(provider.rawValue)",
            displayName: "\(provider.title) Account",
            email: nil,
            provider: provider,
            createdAt: Date()
        )

        let data = try JSONEncoder().encode(user)
        defaults.set(data, forKey: sessionKey)
        return user
    }

    func signOut() async throws {
        defaults.removeObject(forKey: sessionKey)
    }

    func deleteAccount(for user: AccountUser) async throws {
        defaults.removeObject(forKey: sessionKey)
    }
}

final class LocalPreviewWorkoutRepository: CloudWorkoutRepository {
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
    @Published var alertMessage: String?

    private let authService: AuthServicing
    private let repository: CloudWorkoutRepository
    private var didRestoreSession = false

    init(
        authService: AuthServicing = LocalPreviewAuthService(),
        repository: CloudWorkoutRepository = LocalPreviewWorkoutRepository()
    ) {
        self.authService = authService
        self.repository = repository
    }

    func restoreSession() async {
        guard !didRestoreSession else {
            return
        }

        didRestoreSession = true
        session = .loading

        do {
            if let user = try await authService.restoreSession() {
                session = .signedIn(user)
                syncState = .idle
            } else {
                session = .signedOut
                syncState = .signedOut
            }
        } catch {
            session = .signedOut
            syncState = .signedOut
            alertMessage = readableMessage(from: error)
        }
    }

    func signIn(with provider: AccountProvider, snapshot: WorkoutCloudSnapshot) async {
        await performAccountWork {
            let user = try await authService.signIn(with: provider)
            session = .signedIn(user)
            try await save(snapshot: snapshot, for: user, reason: .signIn)
        }
    }

    func signOut() async {
        await performAccountWork {
            try await authService.signOut()
            session = .signedOut
            syncState = .signedOut
        }
    }

    func deleteAccount() async {
        guard let user = session.user else {
            alertMessage = AccountServiceError.missingSession.localizedDescription
            return
        }

        await performAccountWork {
            try await repository.deleteData(for: user)
            try await authService.deleteAccount(for: user)
            session = .signedOut
            syncState = .signedOut
        }
    }

    func sync(snapshot: WorkoutCloudSnapshot, reason: WorkoutSyncReason) async {
        guard let user = session.user else {
            syncState = .signedOut
            return
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
            alertMessage = readableMessage(from: error)
        }
    }

    private func readableMessage(from error: Error) -> String {
        if let localizedError = error as? LocalizedError,
           let description = localizedError.errorDescription {
            return description
        }

        return error.localizedDescription
    }
}
