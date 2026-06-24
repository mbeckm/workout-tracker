import Foundation
import SwiftData

@Model
final class WorkoutPlan {
	@Attribute(.unique) var id: UUID
	var name: String
	var daysPerWeek: Int
	var createdAt: Date
	var updatedAt: Date

	@Relationship(deleteRule: .cascade, inverse: \TrainingDay.plan)
	var days: [TrainingDay] = []

	init(id: UUID = UUID(), name: String, daysPerWeek: Int, createdAt: Date = .now, updatedAt: Date = .now) {
		self.id = id
		self.name = name
		self.daysPerWeek = daysPerWeek
		self.createdAt = createdAt
		self.updatedAt = updatedAt
	}

	var orderedDays: [TrainingDay] {
		days.sorted { $0.index < $1.index }
	}

	var exerciseCount: Int {
		days.reduce(0) { count, day in count + day.exercises.count }
	}

	var targetSetCount: Int {
		days.reduce(0) { count, day in
			count + day.exercises.reduce(0) { $0 + $1.targetSets }
		}
	}
}

@Model
final class TrainingDay {
	@Attribute(.unique) var id: UUID
	var index: Int
	var label: String

	@Relationship(deleteRule: .cascade, inverse: \PlanExercise.day)
	var exercises: [PlanExercise] = []

	var plan: WorkoutPlan?

	init(id: UUID = UUID(), index: Int, label: String) {
		self.id = id
		self.index = index
		self.label = label
	}

	var orderedExercises: [PlanExercise] {
		exercises.sorted { $0.order < $1.order }
	}

	var targetSetCount: Int {
		exercises.reduce(0) { $0 + $1.targetSets }
	}
}

@Model
final class PlanExercise {
	@Attribute(.unique) var id: UUID
	var order: Int
	var catalogID: String?
	var name: String
	var category: String = ""
	var primaryMuscles: [String] = []
	var secondaryMuscles: [String] = []
	var equipment: [String] = []
	var targetSets: Int
	var targetReps: Int
	var notes: String
	var day: TrainingDay?

	init(
		id: UUID = UUID(),
		order: Int,
		catalogID: String? = nil,
		name: String,
		category: String = "",
		primaryMuscles: [String] = [],
		secondaryMuscles: [String] = [],
		equipment: [String] = [],
		targetSets: Int,
		targetReps: Int,
		notes: String = ""
	) {
		self.id = id
		self.order = order
		self.catalogID = catalogID
		self.name = name
		self.category = category
		self.primaryMuscles = primaryMuscles
		self.secondaryMuscles = secondaryMuscles
		self.equipment = equipment
		self.targetSets = targetSets
		self.targetReps = targetReps
		self.notes = notes
	}
}

extension PlanExercise {
	var trainingTargetSummary: String {
		let muscleText = primaryMuscles.isEmpty ? category : primaryMuscles.kineticSummary()
		let equipmentText = equipment.kineticSummary(fallback: "Bodyweight")

		if muscleText.isEmpty {
			return equipmentText
		}

		return "\(muscleText) - \(equipmentText)"
	}
}

@Model
final class WorkoutSession {
	@Attribute(.unique) var id: UUID
	var planName: String
	var dayLabel: String
	var startedAt: Date
	var completedAt: Date

	@Relationship(deleteRule: .cascade, inverse: \WorkoutSetEntry.session)
	var entries: [WorkoutSetEntry] = []

	init(id: UUID = UUID(), planName: String, dayLabel: String, startedAt: Date, completedAt: Date = .now) {
		self.id = id
		self.planName = planName
		self.dayLabel = dayLabel
		self.startedAt = startedAt
		self.completedAt = completedAt
	}

	var orderedEntries: [WorkoutSetEntry] {
		entries.sorted {
			if $0.exerciseOrder == $1.exerciseOrder {
				return $0.setNumber < $1.setNumber
			}
			return $0.exerciseOrder < $1.exerciseOrder
		}
	}

	var exerciseCount: Int {
		Set(entries.map(\.exerciseName)).count
	}

	var totalVolume: Double {
		entries.reduce(0) { $0 + ($1.weight * Double($1.reps)) }
	}
}

@Model
final class WorkoutSetEntry {
	@Attribute(.unique) var id: UUID
	var exerciseOrder: Int
	var exerciseName: String
	var setNumber: Int
	var targetReps: Int
	var weight: Double
	var reps: Int
	var completedAt: Date
	var session: WorkoutSession?

	init(
		id: UUID = UUID(),
		exerciseOrder: Int,
		exerciseName: String,
		setNumber: Int,
		targetReps: Int,
		weight: Double,
		reps: Int,
		completedAt: Date = .now
	) {
		self.id = id
		self.exerciseOrder = exerciseOrder
		self.exerciseName = exerciseName
		self.setNumber = setNumber
		self.targetReps = targetReps
		self.weight = weight
		self.reps = reps
		self.completedAt = completedAt
	}
}
