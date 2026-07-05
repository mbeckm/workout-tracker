import Foundation

struct AuthConfig {
    var backendBaseURL: URL?

    static var appDefault: AuthConfig {
        let defaultsValue = UserDefaults.standard.string(forKey: "scratchWorkout.auth.backendBaseURL")
        let environmentValue = ProcessInfo.processInfo.environment["AUTH_BACKEND_BASE_URL"]
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "AuthBackendBaseURL") as? String
        let candidate = [defaultsValue, environmentValue, bundleValue]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !$0.contains("$(") }

        return AuthConfig(backendBaseURL: candidate.flatMap(URL.init(string:)))
    }

    var isConfigured: Bool { backendBaseURL != nil }
}
