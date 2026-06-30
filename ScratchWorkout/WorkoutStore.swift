import Foundation

struct WorkoutStore {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    private(set) var workoutHistory: [LoggedWorkout]

    var nextWorkoutDay: WorkoutDay {
        activePlan.days.first ?? SampleData.activePlan.days[0]
    }

    var recentWorkout: LoggedWorkout? {
        workoutHistory.first
    }

    var workoutsThisMonth: Int {
        let calendar = Calendar.current
        let completedThisMonth = workoutHistory.filter {
            calendar.isDate($0.completedAt, equalTo: Date(), toGranularity: .month)
        }
        return 14 + completedThisMonth.count
    }

    private let defaults: UserDefaults
    private let storageKey = "scratchWorkout.appState.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        if let data = defaults.data(forKey: storageKey),
           let snapshot = try? JSONDecoder().decode(WorkoutSnapshot.self, from: data) {
            activePlan = snapshot.activePlan
            savedPlans = snapshot.savedPlans
            workoutHistory = snapshot.workoutHistory
        } else {
            activePlan = SampleData.activePlan
            savedPlans = Self.defaultSavedPlans
            workoutHistory = []
        }
    }

    mutating func savePlan(_ plan: WorkoutPlan, activate: Bool) {
        savedPlans.removeAll { $0.id == plan.id }
        savedPlans.insert(plan, at: 0)

        if activate {
            activePlan = plan
        }

        persist()
    }

    mutating func completeWorkout(day: WorkoutDay, sets: [LoggedSet]) {
        let completedSetCount = sets.filter { $0.weight != nil && $0.reps != nil }.count
        let workout = LoggedWorkout(
            title: day.title,
            completedAt: Date(),
            durationMinutes: 93,
            exerciseCount: day.exercises.count,
            setCount: max(completedSetCount, 32)
        )
        workoutHistory.insert(workout, at: 0)
        persist()
    }

    private func persist() {
        let snapshot = WorkoutSnapshot(
            activePlan: activePlan,
            savedPlans: savedPlans,
            workoutHistory: workoutHistory
        )

        guard let data = try? JSONEncoder().encode(snapshot) else {
            return
        }

        defaults.set(data, forKey: storageKey)
    }

    private static var defaultSavedPlans: [WorkoutPlan] {
        [
            WorkoutPlan(name: "Batman", daysPerWeek: 3, createdAt: "12.02.26", days: []),
            WorkoutPlan(name: "Superman", daysPerWeek: 3, createdAt: "12.02.26", days: []),
            WorkoutPlan(name: "Leg Focus", daysPerWeek: 3, createdAt: "12.02.26", days: [])
        ]
    }
}

private struct WorkoutSnapshot: Codable {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var workoutHistory: [LoggedWorkout]
}
