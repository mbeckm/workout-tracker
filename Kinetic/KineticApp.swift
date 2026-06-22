import SwiftData
import SwiftUI

@main
struct KineticApp: App {
	var body: some Scene {
		WindowGroup {
			RootView()
		}
		.modelContainer(for: [
			WorkoutPlan.self,
			TrainingDay.self,
			PlanExercise.self,
			WorkoutSession.self,
			WorkoutSetEntry.self
		])
	}
}
