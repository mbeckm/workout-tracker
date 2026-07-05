import Foundation
import Combine

protocol AuthProviderAuthorizing {
    func authorize(_ provider: AccountProvider) async throws -> AuthProviderCredential
}

protocol AuthServicing {
    func restoreSession() async throws -> StoredSession?
    func signIn(with credential: AuthProviderCredential) async throws -> StoredSession
    func signOut() async throws
    func deleteAccount(for user: AccountUser) async throws
}

protocol CloudWorkoutRepository {
    func loadSnapshot(for user: AccountUser) async throws -> WorkoutCloudSnapshot?
    func saveSnapshot(_ snapshot: WorkoutCloudSnapshot, for user: AccountUser) async throws
    func deleteData(for user: AccountUser) async throws
}

final class LocalPreviewProviderAuthorizer: AuthProviderAuthorizing {
    func authorize(_ provider: AccountProvider) async throws -> AuthProviderCredential {
        try await Task.sleep(nanoseconds: 250_000_000)

        return AuthProviderCredential(
            provider: provider,
            idToken: "preview-id-token-\(UUID().uuidString)",
            authorizationCode: "preview-auth-code",
            nonce: nil,
            displayName: nil,
            email: nil
        )
    }
}

final class LocalPreviewAuthService: AuthServicing {
    private let sessionStore: SessionStoring

    init(sessionStore: SessionStoring = KeychainSessionStore()) {
        self.sessionStore = sessionStore
    }

    func restoreSession() async throws -> StoredSession? {
        try sessionStore.load()
    }

    func signIn(with credential: AuthProviderCredential) async throws -> StoredSession {
        try await Task.sleep(nanoseconds: 250_000_000)

        let user = AccountUser(
            id: "preview-\(credential.provider.rawValue)",
            displayName: credential.displayName ?? "\(credential.provider.title) Account",
            email: credential.email,
            provider: credential.provider,
            createdAt: Date()
        )

        let session = StoredSession(
            user: user,
            tokens: AuthTokens(
                accessToken: UUID().uuidString,
                refreshToken: UUID().uuidString,
                idToken: credential.idToken,
                expiresAt: Date().addingTimeInterval(3600)
            ),
            issuedAt: Date()
        )

        try sessionStore.save(session)
        return session
    }

    func signOut() async throws {
        try sessionStore.clear()
    }

    /// Real implementation will also revoke provider tokens at the identity provider.
    func deleteAccount(for user: AccountUser) async throws {
        try sessionStore.clear()
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
    @Published var authError: AccountError?
    @Published var alertMessage: String?
    @Published var pendingMigration: MigrationRequest?
    @Published var hydratedSnapshot: WorkoutCloudSnapshot?

    private let authService: AuthServicing
    private let providerAuthorizer: AuthProviderAuthorizing
    private let repository: CloudWorkoutRepository
    private let migrationCoordinator: AccountMigrating
    private var didRestoreSession = false

    init(
        authService: AuthServicing = LocalPreviewAuthService(),
        providerAuthorizer: AuthProviderAuthorizing = LocalPreviewProviderAuthorizer(),
        repository: CloudWorkoutRepository = LocalPreviewWorkoutRepository(),
        migrationCoordinator: AccountMigrating? = nil
    ) {
        let repo = repository
        self.authService = authService
        self.providerAuthorizer = providerAuthorizer
        self.repository = repo
        self.migrationCoordinator = migrationCoordinator ?? RepositoryMigrationCoordinator(repository: repo)
    }

    func restoreSession() async {
        guard !didRestoreSession else {
            return
        }

        didRestoreSession = true
        session = .loading

        do {
            if let stored = try await authService.restoreSession() {
                let user = stored.user
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

    func signIn(with provider: AccountProvider, snapshot localSnapshot: WorkoutCloudSnapshot) async {
        await performAccountWork {
            let credential = try await providerAuthorizer.authorize(provider)
            let stored = try await authService.signIn(with: credential)
            session = .signedIn(stored.user)

            let remote = try await repository.loadSnapshot(for: stored.user)
            if let remote {
                hydratedSnapshot = remote
                syncState = .synced(Date())
                pendingMigration = nil
            } else {
                pendingMigration = MigrationRequest(localSnapshot: localSnapshot)
                syncState = .idle
            }
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

    func signOut() async {
        await performAccountWork {
            try await authService.signOut()
            session = .signedOut
            syncState = .signedOut
            pendingMigration = nil
        }
    }

    func deleteAccount() async {
        guard let user = session.user else {
            authError = .missingSession
            alertMessage = authError?.localizedDescription
            return
        }

        await performAccountWork {
            try await repository.deleteData(for: user)
            try await authService.deleteAccount(for: user)
            session = .signedOut
            syncState = .signedOut
            pendingMigration = nil
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
