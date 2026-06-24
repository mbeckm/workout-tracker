import SwiftData

@MainActor
enum PreviewData {
	static func container() -> ModelContainer {
		let schema = Schema([
			WorkoutPlan.self,
			TrainingDay.self,
			PlanExercise.self,
			WorkoutSession.self,
			WorkoutSetEntry.self
		])
		let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
		let container = try! ModelContainer(for: schema, configurations: [configuration])
		let context = container.mainContext

		let plan = WorkoutPlan(name: "Upper Strength", daysPerWeek: 3)
		let monday = TrainingDay(index: 0, label: "Monday")
		monday.exercises = [
			planExercise(order: 0, catalogName: "Bench Press", targetSets: 3, targetReps: 8),
			planExercise(order: 1, catalogName: "Incline Chest-Supported Dumbbell Row", targetSets: 3, targetReps: 10)
		]
		let friday = TrainingDay(index: 1, label: "Friday")
		friday.exercises = [
			planExercise(order: 0, catalogName: "Overhead Press", targetSets: 3, targetReps: 6),
			planExercise(order: 1, catalogName: "Lat Pulldown (Wide Grip)", targetSets: 3, targetReps: 10)
		]
		plan.days = [monday, friday]
		context.insert(plan)

		let session = WorkoutSession(planName: "Upper Strength", dayLabel: "Monday", startedAt: .now.addingTimeInterval(-3_600))
		session.entries = [
			WorkoutSetEntry(exerciseOrder: 0, exerciseName: "Bench Press", setNumber: 1, targetReps: 8, weight: 70, reps: 8),
			WorkoutSetEntry(exerciseOrder: 0, exerciseName: "Bench Press", setNumber: 2, targetReps: 8, weight: 72.5, reps: 8),
			WorkoutSetEntry(exerciseOrder: 1, exerciseName: "Incline Chest-Supported Dumbbell Row", setNumber: 1, targetReps: 10, weight: 55, reps: 10)
		]
		context.insert(session)

		return container
	}

	private static func planExercise(order: Int, catalogName: String, targetSets: Int, targetReps: Int) -> PlanExercise {
		guard let exercise = ExerciseCatalog.all.first(where: { $0.name == catalogName }) else {
			return PlanExercise(order: order, name: catalogName, targetSets: targetSets, targetReps: targetReps)
		}

		return PlanExercise(
			order: order,
			catalogID: exercise.id,
			name: exercise.name,
			category: exercise.category,
			primaryMuscles: exercise.primaryMuscles,
			secondaryMuscles: exercise.secondaryMuscles,
			equipment: exercise.equipment,
			targetSets: targetSets,
			targetReps: targetReps
		)
	}
}
