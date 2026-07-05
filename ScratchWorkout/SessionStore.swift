import Foundation
import Security

protocol SessionStoring {
    func load() throws -> StoredSession?
    func save(_ session: StoredSession) throws
    func clear() throws
}

/// Persists the active auth session in Keychain instead of UserDefaults.
final class KeychainSessionStore: SessionStoring {
    private let service = "com.marvinbeckmann.ScratchWorkout.auth"
    private let account = "primarySession"

    func load() throws -> StoredSession? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw AccountError.secureStorageFailed
        }

        guard let data = result as? Data else {
            throw AccountError.secureStorageFailed
        }

        return try JSONDecoder().decode(StoredSession.self, from: data)
    }

    func save(_ session: StoredSession) throws {
        try clear()

        let data: Data
        do {
            data = try JSONEncoder().encode(session)
        } catch {
            throw AccountError.secureStorageFailed
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AccountError.secureStorageFailed
        }
    }

    func clear() throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]

        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw AccountError.secureStorageFailed
        }
    }
}

final class InMemorySessionStore: SessionStoring {
    var session: StoredSession?

    func load() throws -> StoredSession? {
        session
    }

    func save(_ session: StoredSession) throws {
        self.session = session
    }

    func clear() throws {
        session = nil
    }
}
