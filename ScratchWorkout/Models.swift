import Foundation
import SwiftUI

enum AppTab: CaseIterable, Identifiable {
    case home
    case plans
    case workout

    var id: Self { self }

    var title: String {
        switch self {
        case .home: "Home"
        case .plans: "Plans"
        case .workout: "Workout"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .plans: "rectangle.portrait"
        case .workout: "dumbbell.fill"
        }
    }
}

enum AppRoute: Equatable {
    case startWorkout
    case logWorkout
    case workoutComplete
    case createPlan
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
}

struct LoggedSet: Identifiable, Equatable, Codable {
    var id = UUID()
    var index: Int
    var weight: Int?
    var reps: Int?
}

struct LoggedWorkout: Identifiable, Equatable, Codable {
    var id = UUID()
    var title: String
    var completedAt: Date
    var durationMinutes: Int
    var exerciseCount: Int
    var setCount: Int
}

enum SampleData {
    static let pushExercises = [
        ExercisePrescription(name: "Flat Barbell Bench Press", sets: 4, reps: 8),
        ExercisePrescription(name: "Incline Bench Press", sets: 4, reps: 12),
        ExercisePrescription(name: "Overhead Press", sets: 3, reps: 10),
        ExercisePrescription(name: "Lateral Raises", sets: 3, reps: 15),
        ExercisePrescription(name: "Tricep Pushdowns", sets: 3, reps: 15)
    ]

    static let legExercises = [
        ExercisePrescription(name: "Barbell Back Squat", sets: 5, reps: 5),
        ExercisePrescription(name: "Romanian Deadlift", sets: 4, reps: 10),
        ExercisePrescription(name: "Leg Press", sets: 3, reps: 15),
        ExercisePrescription(name: "Leg Curl", sets: 3, reps: 12),
        ExercisePrescription(name: "Standing Calf Raise", sets: 4, reps: 20)
    ]

    static let pullExercises = [
        ExercisePrescription(name: "Pull-Ups", sets: 4, reps: 8),
        ExercisePrescription(name: "Barbell Row", sets: 4, reps: 10),
        ExercisePrescription(name: "Seated Cable Row", sets: 3, reps: 12),
        ExercisePrescription(name: "Face Pulls", sets: 3, reps: 15),
        ExercisePrescription(name: "Barbell Curl", sets: 3, reps: 12)
    ]

    static let activePlan = WorkoutPlan(
        name: "PPL",
        daysPerWeek: 3,
        createdAt: "12.02.26",
        days: [
            WorkoutDay(title: "Push", exercises: pushExercises),
            WorkoutDay(title: "Pull", exercises: pullExercises),
            WorkoutDay(title: "Legs", exercises: legExercises)
        ]
    )
}
