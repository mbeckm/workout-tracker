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
			PlanExercise(order: 0, name: "Bench Press", targetSets: 3, targetReps: 8),
			PlanExercise(order: 1, name: "Chest-Supported Row", targetSets: 3, targetReps: 10)
		]
		let friday = TrainingDay(index: 1, label: "Friday")
		friday.exercises = [
			PlanExercise(order: 0, name: "Overhead Press", targetSets: 3, targetReps: 6),
			PlanExercise(order: 1, name: "Lat Pulldown", targetSets: 3, targetReps: 10)
		]
		plan.days = [monday, friday]
		context.insert(plan)

		let session = WorkoutSession(planName: "Upper Strength", dayLabel: "Monday", startedAt: .now.addingTimeInterval(-3_600))
		session.entries = [
			WorkoutSetEntry(exerciseOrder: 0, exerciseName: "Bench Press", setNumber: 1, targetReps: 8, weight: 70, reps: 8),
			WorkoutSetEntry(exerciseOrder: 0, exerciseName: "Bench Press", setNumber: 2, targetReps: 8, weight: 72.5, reps: 8),
			WorkoutSetEntry(exerciseOrder: 1, exerciseName: "Chest-Supported Row", setNumber: 1, targetReps: 10, weight: 55, reps: 10)
		]
		context.insert(session)

		return container
	}
}
