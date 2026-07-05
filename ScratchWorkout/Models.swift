import Foundation
import SwiftUI

enum AppTab: CaseIterable, Hashable, Identifiable {
    case home
    case plans
    case workout
    case stats

    var id: Self { self }

    var title: String {
        switch self {
        case .home: "Home"
        case .plans: "Plans"
        case .workout: "Workout"
        case .stats: "Stats"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .plans: "rectangle.portrait"
        case .workout: "dumbbell.fill"
        case .stats: "chart.line.uptrend.xyaxis"
        }
    }

    static func highlighted(selectedTab: AppTab, route: AppRoute?) -> AppTab {
        switch route {
        case .createPlan, .activePlanDetail, .planDetail:
            .plans
        case .logWorkout, .workoutComplete:
            .workout
        case .startWorkout, .nextWorkoutPreview:
            .home
        case .exerciseStats:
            .stats
        case nil:
            selectedTab
        }
    }
}

enum AppRoute: Equatable {
    case startWorkout
    case logWorkout
    case workoutComplete
    case createPlan
    case activePlanDetail
    case planDetail(UUID)
    case nextWorkoutPreview
    case exerciseStats(String)
}

struct WorkoutPlan: Identifiable, Equatable, Codable {
    var id = UUID()
    var name: String
    var daysPerWeek: Int
    var createdAt: String
    var days: [WorkoutDay]
}

struct WorkoutDay: Identifiable, Equatable, Codable {
    var id = UUID()
    var title: String
    var exercises: [ExercisePrescription]
}

struct ExercisePrescription: Identifiable, Equatable, Codable {
    var id = UUID()
    var name: String
    var sets: Int
    var reps: Int
    var providerExerciseId: String?
    var exerciseType: String?
    var bodyParts: [String]
    var targetMuscles: [String]
    var equipments: [String]
    var thumbnailURL: URL?
    var imageURL: URL?
    var imageURLs: [String: URL]
    var videoURL: URL?

    init(
        id: UUID = UUID(),
        name: String,
        sets: Int,
        reps: Int,
        providerExerciseId: String? = nil,
        exerciseType: String? = nil,
        bodyParts: [String] = [],
        targetMuscles: [String] = [],
        equipments: [String] = [],
        thumbnailURL: URL? = nil,
        imageURL: URL? = nil,
        imageURLs: [String: URL] = [:],
        videoURL: URL? = nil
    ) {
        self.id = id
        self.name = name
        self.sets = sets
        self.reps = reps
        self.providerExerciseId = providerExerciseId
        self.exerciseType = exerciseType
        self.bodyParts = bodyParts
        self.targetMuscles = targetMuscles
        self.equipments = equipments
        self.thumbnailURL = thumbnailURL
        self.imageURL = imageURL
        self.imageURLs = imageURLs
        self.videoURL = videoURL
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case sets
        case reps
        case providerExerciseId
        case exerciseType
        case bodyParts
        case targetMuscles
        case equipments
        case thumbnailURL
        case imageURL
        case imageURLs
        case videoURL
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        name = try container.decode(String.self, forKey: .name)
        sets = try container.decodeIfPresent(Int.self, forKey: .sets) ?? 3
        reps = try container.decodeIfPresent(Int.self, forKey: .reps) ?? 12
        providerExerciseId = try container.decodeIfPresent(String.self, forKey: .providerExerciseId)
        exerciseType = try container.decodeIfPresent(String.self, forKey: .exerciseType)
        bodyParts = try container.decodeIfPresent([String].self, forKey: .bodyParts) ?? []
        targetMuscles = try container.decodeIfPresent([String].self, forKey: .targetMuscles) ?? []
        equipments = try container.decodeIfPresent([String].self, forKey: .equipments) ?? []
        thumbnailURL = try container.decodeIfPresent(URL.self, forKey: .thumbnailURL)
        imageURL = try container.decodeIfPresent(URL.self, forKey: .imageURL)
        imageURLs = try container.decodeIfPresent([String: URL].self, forKey: .imageURLs) ?? [:]
        videoURL = try container.decodeIfPresent(URL.self, forKey: .videoURL)
    }
}

struct LoggedSet: Identifiable, Equatable, Codable {
    var id = UUID()
    var index: Int
    var weight: Int?
    var reps: Int?
}

struct LoggedExercise: Identifiable, Equatable, Codable {
    var id = UUID()
    var exerciseName: String
    var sets: [LoggedSet]
}

struct LoggedWorkout: Identifiable, Equatable, Codable {
    var id = UUID()
    var title: String
    var completedAt: Date
    var durationMinutes: Int
    var exerciseCount: Int
    var setCount: Int
    var exercises: [LoggedExercise]

    init(
        id: UUID = UUID(),
        title: String,
        completedAt: Date,
        durationMinutes: Int,
        exerciseCount: Int,
        setCount: Int,
        exercises: [LoggedExercise] = []
    ) {
        self.id = id
        self.title = title
        self.completedAt = completedAt
        self.durationMinutes = durationMinutes
        self.exerciseCount = exerciseCount
        self.setCount = setCount
        self.exercises = exercises
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case completedAt
        case durationMinutes
        case exerciseCount
        case setCount
        case exercises
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        title = try container.decode(String.self, forKey: .title)
        completedAt = try container.decode(Date.self, forKey: .completedAt)
        durationMinutes = try container.decode(Int.self, forKey: .durationMinutes)
        exerciseCount = try container.decode(Int.self, forKey: .exerciseCount)
        setCount = try container.decode(Int.self, forKey: .setCount)
        exercises = try container.decodeIfPresent([LoggedExercise].self, forKey: .exercises) ?? []
    }
}

struct ExerciseSetSummary: Identifiable, Equatable {
    var id: String { exerciseName.normalizedStatsKey }
    var exerciseName: String
    var setCount: Int
}

struct ExerciseStatsPoint: Identifiable, Equatable {
    var id: Date { date }
    var date: Date
    var averageTenRM: Double
    var setCount: Int
    var isPersonalBest: Bool
}

struct ExerciseStatsDetails: Equatable {
    var exerciseName: String
    var totalLoggedSets: Int
    var progression: [ExerciseStatsPoint]
}

enum SampleData {
    static let exerciseDatabase = [
        ExercisePrescription(name: "Flat Barbell Bench Press", sets: 4, reps: 8),
        ExercisePrescription(name: "Incline Dumbbell Press", sets: 3, reps: 12),
        ExercisePrescription(name: "Incline Bench Press (Dumbbells)", sets: 3, reps: 12),
        ExercisePrescription(name: "Incline Bicep Curls", sets: 3, reps: 12),
        ExercisePrescription(name: "Incline Bench Press (Barbell)", sets: 4, reps: 8),
        ExercisePrescription(name: "Overhead Press", sets: 4, reps: 10),
        ExercisePrescription(name: "Lateral Raises", sets: 3, reps: 15),
        ExercisePrescription(name: "Tricep Pushdowns", sets: 3, reps: 15),
        ExercisePrescription(name: "Cable Chest Fly", sets: 3, reps: 15),
        ExercisePrescription(name: "Pull-Ups", sets: 4, reps: 8),
        ExercisePrescription(name: "Lat Pulldown", sets: 3, reps: 12),
        ExercisePrescription(name: "Barbell Row", sets: 4, reps: 10),
        ExercisePrescription(name: "Seated Cable Row", sets: 3, reps: 12),
        ExercisePrescription(name: "Face Pulls", sets: 3, reps: 15),
        ExercisePrescription(name: "Barbell Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Hammer Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Barbell Back Squat", sets: 5, reps: 5),
        ExercisePrescription(name: "Romanian Deadlift", sets: 4, reps: 10),
        ExercisePrescription(name: "Leg Press", sets: 3, reps: 15),
        ExercisePrescription(name: "Leg Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Standing Calf Raise", sets: 4, reps: 20)
    ]

    static let pushExercises = [
        ExercisePrescription(name: "Flat Barbell Bench Press", sets: 4, reps: 8),
        ExercisePrescription(name: "Incline Dumbbell Press", sets: 3, reps: 12),
        ExercisePrescription(name: "Overhead Press", sets: 4, reps: 10),
        ExercisePrescription(name: "Lateral Raises", sets: 3, reps: 15),
        ExercisePrescription(name: "Tricep Pushdowns", sets: 3, reps: 15),
        ExercisePrescription(name: "Dips", sets: 5, reps: 10),
        ExercisePrescription(name: "Cable Chest Fly", sets: 5, reps: 15),
        ExercisePrescription(name: "Skull Crushers", sets: 5, reps: 12)
    ]

    static let dayOneExercises = [
        ExercisePrescription(name: "Barbell Row", sets: 4, reps: 10),
        ExercisePrescription(name: "Incline Bench Press", sets: 4, reps: 8),
        ExercisePrescription(name: "Pull-Ups", sets: 4, reps: 8),
        ExercisePrescription(name: "Seated Cable Row", sets: 4, reps: 12),
        ExercisePrescription(name: "Overhead Press", sets: 4, reps: 10),
        ExercisePrescription(name: "Lateral Raises", sets: 4, reps: 15),
        ExercisePrescription(name: "Tricep Pushdowns", sets: 4, reps: 15),
        ExercisePrescription(name: "Cable Chest Fly", sets: 4, reps: 15)
    ]

    static let legExercises = [
        ExercisePrescription(name: "Barbell Back Squat", sets: 5, reps: 5),
        ExercisePrescription(name: "Front Squat", sets: 4, reps: 8),
        ExercisePrescription(name: "Romanian Deadlift", sets: 4, reps: 10),
        ExercisePrescription(name: "Leg Press", sets: 3, reps: 15),
        ExercisePrescription(name: "Leg Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Walking Lunges", sets: 3, reps: 12),
        ExercisePrescription(name: "Standing Calf Raise", sets: 4, reps: 20),
        ExercisePrescription(name: "Leg Extension", sets: 3, reps: 15)
    ]

    static let pullExercises = [
        ExercisePrescription(name: "Pull-Ups", sets: 4, reps: 8),
        ExercisePrescription(name: "Lat Pulldown", sets: 3, reps: 12),
        ExercisePrescription(name: "Barbell Row", sets: 4, reps: 10),
        ExercisePrescription(name: "Seated Cable Row", sets: 3, reps: 12),
        ExercisePrescription(name: "Face Pulls", sets: 3, reps: 15),
        ExercisePrescription(name: "Barbell Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Hammer Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Rear Delt Fly", sets: 3, reps: 15)
    ]

    static let nextWorkoutDay = WorkoutDay(title: "Day 1", exercises: pushExercises)

    static let activePlan = WorkoutPlan(
        name: "PPL",
        daysPerWeek: 4,
        createdAt: "12.02.26",
        days: [
            WorkoutDay(title: "Day 1", exercises: dayOneExercises),
            WorkoutDay(title: "Day 2", exercises: pullExercises),
            WorkoutDay(title: "Day 3", exercises: legExercises),
            WorkoutDay(title: "Day 4", exercises: Array(pushExercises.prefix(4)) + Array(pullExercises.prefix(4)))
        ]
    )

    static var loggedStatsHistory: [LoggedWorkout] {
        [
            statsWorkout(
                title: "Day 1",
                daysAgo: 42,
                durationMinutes: 86,
                exercises: [
                    statsExercise("Flat Barbell Bench Press", weights: [72, 75, 75, 77], reps: [10, 10, 8, 8]),
                    statsExercise("Barbell Row", weights: [70, 70, 72, 72], reps: [10, 10, 9, 9]),
                    statsExercise("Lateral Raises", weights: [12, 12, 12], reps: [15, 14, 13])
                ]
            ),
            statsWorkout(
                title: "Pull",
                daysAgo: 34,
                durationMinutes: 82,
                exercises: [
                    statsExercise("Pull-Ups", weights: [0, 0, 0, 0], reps: [8, 7, 7, 6]),
                    statsExercise("Barbell Row", weights: [72, 75, 75, 77], reps: [10, 9, 9, 8]),
                    statsExercise("Hammer Curl", weights: [16, 16, 18], reps: [12, 11, 10])
                ]
            ),
            statsWorkout(
                title: "Push",
                daysAgo: 27,
                durationMinutes: 91,
                exercises: [
                    statsExercise("Flat Barbell Bench Press", weights: [77, 80, 80, 82], reps: [10, 9, 8, 7]),
                    statsExercise("Overhead Press", weights: [45, 47, 47, 50], reps: [10, 9, 8, 7]),
                    statsExercise("Lateral Raises", weights: [14, 14, 14], reps: [14, 13, 12])
                ]
            ),
            statsWorkout(
                title: "Day 1",
                daysAgo: 19,
                durationMinutes: 94,
                exercises: [
                    statsExercise("Flat Barbell Bench Press", weights: [82, 82, 85, 85], reps: [10, 9, 8, 7]),
                    statsExercise("Barbell Row", weights: [77, 80, 80, 82], reps: [10, 9, 8, 8]),
                    statsExercise("Tricep Pushdowns", weights: [35, 35, 37], reps: [15, 14, 12])
                ]
            ),
            statsWorkout(
                title: "Push",
                daysAgo: 11,
                durationMinutes: 88,
                exercises: [
                    statsExercise("Flat Barbell Bench Press", weights: [85, 87, 87, 90], reps: [10, 9, 8, 6]),
                    statsExercise("Overhead Press", weights: [50, 50, 52, 52], reps: [10, 9, 8, 7]),
                    statsExercise("Lateral Raises", weights: [14, 16, 16], reps: [15, 13, 12])
                ]
            ),
            statsWorkout(
                title: "Pull",
                daysAgo: 4,
                durationMinutes: 84,
                exercises: [
                    statsExercise("Barbell Row", weights: [82, 85, 85, 87], reps: [10, 9, 8, 7]),
                    statsExercise("Hammer Curl", weights: [18, 18, 20], reps: [12, 11, 9]),
                    statsExercise("Face Pulls", weights: [25, 27, 27], reps: [15, 14, 12])
                ]
            )
        ]
    }

    private static func statsWorkout(title: String, daysAgo: Int, durationMinutes: Int, exercises: [LoggedExercise]) -> LoggedWorkout {
        let setCount = exercises.reduce(0) { partialResult, exercise in
            partialResult + exercise.sets.filter(\.hasLoggedValues).count
        }

        return LoggedWorkout(
            title: title,
            completedAt: statsDate(daysAgo: daysAgo),
            durationMinutes: durationMinutes,
            exerciseCount: exercises.count,
            setCount: setCount,
            exercises: exercises
        )
    }

    private static func statsExercise(_ name: String, weights: [Int], reps: [Int]) -> LoggedExercise {
        let sets = zip(weights, reps).enumerated().map { offset, values in
            LoggedSet(index: offset + 1, weight: values.0, reps: values.1)
        }

        return LoggedExercise(exerciseName: name, sets: sets)
    }

    private static func statsDate(daysAgo: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: -daysAgo, to: Date()) ?? Date()
    }
}

extension LoggedSet {
    var hasLoggedValues: Bool {
        weight != nil && reps != nil
    }

    var estimatedTenRM: Double? {
        guard let weight,
              let reps,
              weight > 0,
              reps > 0 else {
            return nil
        }

        let estimatedOneRM = Double(weight) * (1 + Double(reps) / 30)
        return estimatedOneRM / (1 + 10.0 / 30.0)
    }
}

extension String {
    var normalizedStatsKey: String {
        folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var exerciseCatalogDisplayText: String {
        lowercased()
            .split(separator: " ")
            .map { word in
                guard let first = word.first else {
                    return ""
                }

                return first.uppercased() + word.dropFirst()
            }
            .joined(separator: " ")
    }
}
