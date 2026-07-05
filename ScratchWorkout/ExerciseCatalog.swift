import Foundation

struct ExerciseCatalogItem: Identifiable, Equatable, Codable {
    var providerExerciseId: String?
    var name: String
    var exerciseType: String?
    var bodyParts: [String]
    var targetMuscles: [String]
    var equipments: [String]
    var thumbnailURL: URL?
    var imageURL: URL?
    var imageURLs: [String: URL]
    var videoURL: URL?

    var id: String {
        providerExerciseId ?? "seed-\(name.normalizedExerciseCatalogKey)"
    }

    init(
        providerExerciseId: String? = nil,
        name: String,
        exerciseType: String? = nil,
        bodyParts: [String] = [],
        targetMuscles: [String] = [],
        equipments: [String] = [],
        thumbnailURL: URL? = nil,
        imageURL: URL? = nil,
        imageURLs: [String: URL] = [:],
        videoURL: URL? = nil
    ) {
        self.providerExerciseId = providerExerciseId
        self.name = name.exerciseCatalogDisplayText
        self.exerciseType = exerciseType?.exerciseCatalogDisplayText
        self.bodyParts = bodyParts.map(\.exerciseCatalogDisplayText)
        self.targetMuscles = targetMuscles.map(\.exerciseCatalogDisplayText)
        self.equipments = equipments.map(\.exerciseCatalogDisplayText)
        self.thumbnailURL = thumbnailURL ?? imageURLs["360p"] ?? imageURL
        self.imageURL = imageURL
        self.imageURLs = imageURLs
        self.videoURL = videoURL
    }

    init(prescription: ExercisePrescription) {
        self.init(
            providerExerciseId: prescription.providerExerciseId,
            name: prescription.name,
            exerciseType: prescription.exerciseType,
            bodyParts: prescription.bodyParts,
            targetMuscles: prescription.targetMuscles,
            equipments: prescription.equipments,
            thumbnailURL: prescription.thumbnailURL,
            imageURL: prescription.imageURL,
            imageURLs: prescription.imageURLs,
            videoURL: prescription.videoURL
        )
    }

    func prescription(defaultSets: Int = 3, defaultReps: Int = 12) -> ExercisePrescription {
        ExercisePrescription(
            name: name,
            sets: defaultSets,
            reps: defaultReps,
            providerExerciseId: providerExerciseId,
            exerciseType: exerciseType,
            bodyParts: bodyParts,
            targetMuscles: targetMuscles,
            equipments: equipments,
            thumbnailURL: thumbnailURL,
            imageURL: imageURL,
            imageURLs: imageURLs,
            videoURL: videoURL
        )
    }
}

struct ExerciseCatalogSearchResponse: Equatable {
    var exercises: [ExercisePrescription]
    var notice: ExerciseCatalogNotice?
}

enum ExerciseCatalogNotice: Equatable {
    case cachedFallback
    case seedFallback
    case rateLimited
    case offline
    case unavailable

    var message: String {
        switch self {
        case .cachedFallback:
            "Using saved exercise results"
        case .seedFallback:
            "Using built-in exercises"
        case .rateLimited:
            "Too many searches. Try again soon"
        case .offline:
            "Offline. Check your connection"
        case .unavailable:
            "Exercise search unavailable"
        }
    }
}

protocol ExerciseCatalogService: Sendable {
    func search(query: String) async -> ExerciseCatalogSearchResponse
    func exercise(id: String) async -> ExerciseCatalogItem?
    func recordSelection(_ exercise: ExercisePrescription) async
}

enum ExerciseCatalogServiceFactory {
    static func live() -> any ExerciseCatalogService {
        LiveExerciseCatalogService(
            provider: OpenExerciseDBProvider(configuration: .appDefault),
            seedProvider: SeedExerciseCatalogProvider(),
            cache: ExerciseCatalogCache()
        )
    }

    static func seed() -> any ExerciseCatalogService {
        SeedExerciseCatalogService(provider: SeedExerciseCatalogProvider())
    }
}

final class LiveExerciseCatalogService: ExerciseCatalogService {
    private let provider: any ExerciseCatalogProvider
    private let seedProvider: SeedExerciseCatalogProvider
    private let cache: ExerciseCatalogCache

    init(provider: any ExerciseCatalogProvider, seedProvider: SeedExerciseCatalogProvider, cache: ExerciseCatalogCache) {
        self.provider = provider
        self.seedProvider = seedProvider
        self.cache = cache
    }

    func search(query: String) async -> ExerciseCatalogSearchResponse {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedQuery.isEmpty else {
            return ExerciseCatalogSearchResponse(exercises: [], notice: nil)
        }

        do {
            let items = try await provider.search(query: trimmedQuery, limit: 20)
            await cache.save(items: items, for: trimmedQuery)

            return ExerciseCatalogSearchResponse(
                exercises: items.map { $0.prescription() },
                notice: nil
            )
        } catch let error as ExerciseCatalogError {
            return await fallbackSearch(query: trimmedQuery, error: error)
        } catch {
            return await fallbackSearch(query: trimmedQuery, error: .unavailable)
        }
    }

    func exercise(id: String) async -> ExerciseCatalogItem? {
        if let cached = await cache.item(id: id) {
            return cached
        }

        do {
            let item = try await provider.exercise(id: id)
            await cache.save(selected: item)
            return item
        } catch {
            return nil
        }
    }

    func recordSelection(_ exercise: ExercisePrescription) async {
        guard exercise.providerExerciseId != nil else {
            return
        }

        await cache.save(selected: ExerciseCatalogItem(prescription: exercise))
    }

    private func fallbackSearch(query: String, error: ExerciseCatalogError) async -> ExerciseCatalogSearchResponse {
        if let cachedItems = await cache.items(for: query), !cachedItems.isEmpty {
            return ExerciseCatalogSearchResponse(
                exercises: cachedItems.map { $0.prescription() },
                notice: .cachedFallback
            )
        }

        let seedItems = seedProvider.searchSeed(query: query, limit: 20)
        return ExerciseCatalogSearchResponse(
            exercises: seedItems.map { $0.catalogItem.prescription(defaultSets: $0.seedSets, defaultReps: $0.seedReps) },
            notice: seedItems.isEmpty ? notice(for: error) : .seedFallback
        )
    }

    private func notice(for error: ExerciseCatalogError) -> ExerciseCatalogNotice {
        switch error {
        case .rateLimited:
            .rateLimited
        case .offline:
            .offline
        case .unavailable, .invalidResponse, .unauthorized:
            .unavailable
        }
    }
}

final class SeedExerciseCatalogService: ExerciseCatalogService {
    private let provider: SeedExerciseCatalogProvider

    init(provider: SeedExerciseCatalogProvider) {
        self.provider = provider
    }

    func search(query: String) async -> ExerciseCatalogSearchResponse {
        let items = provider.searchSeed(query: query, limit: 20)
        return ExerciseCatalogSearchResponse(
            exercises: items.map { $0.catalogItem.prescription(defaultSets: $0.seedSets, defaultReps: $0.seedReps) },
            notice: nil
        )
    }

    func exercise(id: String) async -> ExerciseCatalogItem? {
        provider.item(id: id)
    }

    func recordSelection(_ exercise: ExercisePrescription) async {}
}

protocol ExerciseCatalogProvider: Sendable {
    func search(query: String, limit: Int) async throws -> [ExerciseCatalogItem]
    func exercise(id: String) async throws -> ExerciseCatalogItem
}

struct ExerciseCatalogConfiguration: Sendable {
    var apiBaseURL: URL

    static var appDefault: ExerciseCatalogConfiguration {
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "ExerciseCatalogBaseURL") as? String
        let defaultsValue = UserDefaults.standard.string(forKey: "scratchWorkout.exerciseCatalog.baseURL")
            ?? UserDefaults.standard.string(forKey: "scratchWorkout.exerciseCatalog.proxyBaseURL")
        let environmentValue = ProcessInfo.processInfo.environment["EXERCISE_CATALOG_BASE_URL"]
        let candidate = [defaultsValue, environmentValue, bundleValue]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !$0.contains("$(") }
        let defaultURL = URL(string: "https://oss.exercisedb.dev")!

        return ExerciseCatalogConfiguration(apiBaseURL: candidate.flatMap(URL.init(string:)) ?? defaultURL)
    }
}

struct OpenExerciseDBProvider: ExerciseCatalogProvider {
    var configuration: ExerciseCatalogConfiguration
    var session: URLSession = .shared

    func search(query: String, limit: Int) async throws -> [ExerciseCatalogItem] {
        var components = URLComponents(
            url: configuration.apiBaseURL.appendingPathComponent("api/v1/exercises"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "name", value: query),
            URLQueryItem(name: "limit", value: String(min(max(limit, 1), 25)))
        ]

        guard let url = components?.url else {
            throw ExerciseCatalogError.invalidResponse
        }

        let response: FlexibleExerciseCatalogResponse = try await fetch(url: url)
        return response.items
    }

    func exercise(id: String) async throws -> ExerciseCatalogItem {
        let url = configuration.apiBaseURL
            .appendingPathComponent("api/v1/exercises")
            .appendingPathComponent(id)
        let response: FlexibleExerciseCatalogResponse = try await fetch(url: url)

        guard let item = response.items.first else {
            throw ExerciseCatalogError.invalidResponse
        }

        return item
    }

    private func fetch<Response: Decodable>(url: URL) async throws -> Response {
        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        request.cachePolicy = .returnCacheDataElseLoad

        do {
            let (data, urlResponse) = try await session.data(for: request)

            guard let httpResponse = urlResponse as? HTTPURLResponse else {
                throw ExerciseCatalogError.invalidResponse
            }

            switch httpResponse.statusCode {
            case 200..<300:
                do {
                    return try JSONDecoder.exerciseCatalog.decode(Response.self, from: data)
                } catch {
                    throw ExerciseCatalogError.invalidResponse
                }
            case 401, 403:
                throw ExerciseCatalogError.unauthorized
            case 429:
                throw ExerciseCatalogError.rateLimited
            case 500..<600:
                throw ExerciseCatalogError.unavailable
            default:
                throw ExerciseCatalogError.invalidResponse
            }
        } catch let error as ExerciseCatalogError {
            throw error
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost:
                throw ExerciseCatalogError.offline
            case .timedOut:
                throw ExerciseCatalogError.unavailable
            default:
                throw ExerciseCatalogError.unavailable
            }
        } catch {
            throw ExerciseCatalogError.unavailable
        }
    }
}

struct ProxyExerciseCatalogProvider: ExerciseCatalogProvider {
    var configuration: ExerciseCatalogConfiguration
    var session: URLSession = .shared

    func search(query: String, limit: Int) async throws -> [ExerciseCatalogItem] {
        var components = URLComponents(
            url: configuration.apiBaseURL.appendingPathComponent("exercises/search"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "limit", value: String(limit))
        ]

        guard let url = components?.url else {
            throw ExerciseCatalogError.invalidResponse
        }

        let response: FlexibleExerciseCatalogResponse = try await fetch(url: url)
        return response.items
    }

    func exercise(id: String) async throws -> ExerciseCatalogItem {
        let url = configuration.apiBaseURL
            .appendingPathComponent("exercises")
            .appendingPathComponent(id)
        let response: FlexibleExerciseCatalogResponse = try await fetch(url: url)

        guard let item = response.items.first else {
            throw ExerciseCatalogError.invalidResponse
        }

        return item
    }

    private func fetch<Response: Decodable>(url: URL) async throws -> Response {
        var request = URLRequest(url: url)
        request.timeoutInterval = 12
        request.cachePolicy = .returnCacheDataElseLoad

        do {
            let (data, urlResponse) = try await session.data(for: request)

            guard let httpResponse = urlResponse as? HTTPURLResponse else {
                throw ExerciseCatalogError.invalidResponse
            }

            switch httpResponse.statusCode {
            case 200..<300:
                do {
                    return try JSONDecoder.exerciseCatalog.decode(Response.self, from: data)
                } catch {
                    throw ExerciseCatalogError.invalidResponse
                }
            case 401, 403:
                throw ExerciseCatalogError.unauthorized
            case 429:
                throw ExerciseCatalogError.rateLimited
            case 500..<600:
                throw ExerciseCatalogError.unavailable
            default:
                throw ExerciseCatalogError.invalidResponse
            }
        } catch let error as ExerciseCatalogError {
            throw error
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost:
                throw ExerciseCatalogError.offline
            case .timedOut:
                throw ExerciseCatalogError.unavailable
            default:
                throw ExerciseCatalogError.unavailable
            }
        } catch {
            throw ExerciseCatalogError.unavailable
        }
    }
}

enum ExerciseCatalogError: Error, Equatable {
    case offline
    case rateLimited
    case unavailable
    case unauthorized
    case invalidResponse
}

struct SeedExerciseCatalogProvider: ExerciseCatalogProvider {
    private let items: [SeedExerciseCatalogItem]

    init(items: [ExercisePrescription] = SampleData.exerciseDatabase) {
        self.items = items.map(SeedExerciseCatalogItem.init)
    }

    func search(query: String, limit: Int) async throws -> [ExerciseCatalogItem] {
        searchSeed(query: query, limit: limit).map(\.catalogItem)
    }

    func exercise(id: String) async throws -> ExerciseCatalogItem {
        guard let item = item(id: id) else {
            throw ExerciseCatalogError.invalidResponse
        }

        return item
    }

    func searchSeed(query: String, limit: Int) -> [SeedExerciseCatalogItem] {
        let normalizedQuery = query.normalizedExerciseCatalogKey

        guard !normalizedQuery.isEmpty else {
            return []
        }

        let matches = items.filter {
            $0.catalogItem.name.normalizedExerciseCatalogKey.contains(normalizedQuery)
        }

        return Array(matches.prefix(limit))
    }

    func item(id: String) -> ExerciseCatalogItem? {
        items.first { $0.catalogItem.id == id }?.catalogItem
    }
}

struct SeedExerciseCatalogItem: Equatable {
    var catalogItem: ExerciseCatalogItem
    var seedSets: Int
    var seedReps: Int

    init(prescription: ExercisePrescription) {
        catalogItem = ExerciseCatalogItem(prescription: prescription)
        seedSets = prescription.sets
        seedReps = prescription.reps
    }
}

actor ExerciseCatalogCache {
    private let defaults: UserDefaults
    private let storageKey = "scratchWorkout.exerciseCatalog.cache.v1"
    private let expiry: TimeInterval

    init(defaults: UserDefaults = .standard, expiry: TimeInterval = 7 * 24 * 60 * 60) {
        self.defaults = defaults
        self.expiry = expiry
    }

    func items(for query: String) -> [ExerciseCatalogItem]? {
        let key = query.normalizedExerciseCatalogKey
        guard let entry = snapshot().queryResults[key],
              Date().timeIntervalSince(entry.createdAt) <= expiry else {
            return nil
        }

        return entry.items
    }

    func item(id: String) -> ExerciseCatalogItem? {
        snapshot().selected[id]
    }

    func save(items: [ExerciseCatalogItem], for query: String) {
        let key = query.normalizedExerciseCatalogKey
        guard !key.isEmpty else {
            return
        }

        var currentSnapshot = snapshot()
        currentSnapshot.queryResults[key] = CacheEntry(createdAt: Date(), items: items)

        for item in items where item.providerExerciseId != nil {
            currentSnapshot.selected[item.id] = item
        }

        persist(currentSnapshot)
    }

    func save(selected item: ExerciseCatalogItem) {
        guard item.providerExerciseId != nil else {
            return
        }

        var currentSnapshot = snapshot()
        currentSnapshot.selected[item.id] = item
        persist(currentSnapshot)
    }

    private func snapshot() -> Snapshot {
        guard let data = defaults.data(forKey: storageKey),
              let snapshot = try? JSONDecoder.exerciseCatalog.decode(Snapshot.self, from: data),
              snapshot.version == Snapshot.currentVersion else {
            return Snapshot()
        }

        return snapshot
    }

    private func persist(_ snapshot: Snapshot) {
        guard let data = try? JSONEncoder.exerciseCatalog.encode(snapshot) else {
            return
        }

        defaults.set(data, forKey: storageKey)
    }
}

private struct Snapshot: Codable {
    static let currentVersion = 1

    var version = currentVersion
    var queryResults: [String: CacheEntry] = [:]
    var selected: [String: ExerciseCatalogItem] = [:]
}

private struct CacheEntry: Codable {
    var createdAt: Date
    var items: [ExerciseCatalogItem]
}

private struct FlexibleExerciseCatalogResponse: Decodable {
    var items: [ExerciseCatalogItem]

    init(from decoder: Decoder) throws {
        if let dtos = try? [AscendExerciseDTO](from: decoder) {
            items = dtos.map(\.catalogItem)
            return
        }

        if let dto = try? AscendExerciseDTO(from: decoder) {
            items = [dto.catalogItem]
            return
        }

        let container = try decoder.container(keyedBy: DynamicCodingKey.self)

        for key in ["data", "items", "results", "exercises"] {
            let codingKey = DynamicCodingKey(key)

            if let dtos = try? container.decode([AscendExerciseDTO].self, forKey: codingKey) {
                items = dtos.map(\.catalogItem)
                return
            }

            if let nested = try? container.decode(FlexibleExerciseCatalogResponse.self, forKey: codingKey) {
                items = nested.items
                return
            }
        }

        throw DecodingError.dataCorrupted(
            DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "No exercise list found")
        )
    }
}

private struct AscendExerciseDTO: Decodable {
    var exerciseId: String?
    var id: String?
    var name: String
    var bodyParts: [String]
    var targetMuscles: [String]
    var secondaryMuscles: [String]
    var equipments: [String]
    var exerciseType: String?
    var imageUrl: URL?
    var imageUrls: [String: URL]
    var gifUrl: URL?
    var videoUrl: URL?

    var catalogItem: ExerciseCatalogItem {
        let mediaURL = imageUrl ?? gifUrl
        return ExerciseCatalogItem(
            providerExerciseId: exerciseId ?? id,
            name: name,
            exerciseType: exerciseType,
            bodyParts: bodyParts,
            targetMuscles: targetMuscles.isEmpty ? secondaryMuscles : targetMuscles,
            equipments: equipments,
            thumbnailURL: imageUrls["360p"] ?? mediaURL,
            imageURL: mediaURL,
            imageURLs: imageUrls,
            videoURL: videoUrl
        )
    }

    private enum CodingKeys: String, CodingKey {
        case exerciseId
        case id
        case name
        case bodyParts
        case targetMuscles
        case secondaryMuscles
        case equipments
        case exerciseType
        case imageUrl
        case imageUrls
        case gifUrl
        case videoUrl
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        exerciseId = try container.decodeIfPresent(String.self, forKey: .exerciseId)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        bodyParts = try container.decodeIfPresent([String].self, forKey: .bodyParts) ?? []
        targetMuscles = try container.decodeIfPresent([String].self, forKey: .targetMuscles) ?? []
        secondaryMuscles = try container.decodeIfPresent([String].self, forKey: .secondaryMuscles) ?? []
        equipments = try container.decodeIfPresent([String].self, forKey: .equipments) ?? []
        exerciseType = try container.decodeIfPresent(String.self, forKey: .exerciseType)
        imageUrl = try container.decodeURLIfPresent(forKey: .imageUrl)
        imageUrls = try container.decodeURLDictionaryIfPresent(forKey: .imageUrls)
        gifUrl = try container.decodeURLIfPresent(forKey: .gifUrl)
        videoUrl = try container.decodeURLIfPresent(forKey: .videoUrl)
    }
}

private struct DynamicCodingKey: CodingKey {
    var stringValue: String
    var intValue: Int?

    init(_ stringValue: String) {
        self.stringValue = stringValue
    }

    init?(stringValue: String) {
        self.stringValue = stringValue
    }

    init?(intValue: Int) {
        self.stringValue = "\(intValue)"
        self.intValue = intValue
    }
}

private extension KeyedDecodingContainer {
    func decodeURLIfPresent(forKey key: Key) throws -> URL? {
        guard let string = try decodeIfPresent(String.self, forKey: key) else {
            return nil
        }

        return URL(string: string)
    }

    func decodeURLDictionaryIfPresent(forKey key: Key) throws -> [String: URL] {
        let strings = try decodeIfPresent([String: String].self, forKey: key) ?? [:]
        return strings.reduce(into: [:]) { result, entry in
            result[entry.key] = URL(string: entry.value)
        }
    }
}

private extension JSONDecoder {
    static var exerciseCatalog: JSONDecoder {
        JSONDecoder()
    }
}

private extension JSONEncoder {
    static var exerciseCatalog: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        return encoder
    }
}

private extension String {
    var normalizedExerciseCatalogKey: String {
        folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
