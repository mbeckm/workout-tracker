import Foundation

struct WorkoutStore {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    private(set) var workoutHistory: [LoggedWorkout]
    private(set) var nextDayIndex: Int

    var nextWorkoutDay: WorkoutDay {
        guard !activePlan.days.isEmpty else {
            return SampleData.activePlan.days[0]
        }

        return activePlan.days[normalizedNextDayIndex]
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
    private let storageKey = "scratchWorkout.appState.v2"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        if let data = defaults.data(forKey: storageKey),
           let snapshot = try? JSONDecoder().decode(WorkoutSnapshot.self, from: data) {
            activePlan = Self.normalizedPlan(snapshot.activePlan)
            savedPlans = snapshot.savedPlans.map(Self.normalizedPlan)
            workoutHistory = snapshot.workoutHistory
            nextDayIndex = snapshot.nextDayIndex ?? 0
        } else {
            activePlan = SampleData.activePlan
            savedPlans = Self.defaultSavedPlans
            workoutHistory = []
            nextDayIndex = 0
        }
    }

    mutating func savePlan(_ plan: WorkoutPlan, activate: Bool) {
        savedPlans.removeAll { $0.id == plan.id }
        savedPlans.insert(plan, at: 0)

        if activate {
            activePlan = plan
            nextDayIndex = 0
        }

        persist()
    }

    mutating func activatePlan(_ plan: WorkoutPlan) {
        let normalizedPlan = Self.normalizedPlan(plan)
        activePlan = normalizedPlan
        nextDayIndex = 0

        if let index = savedPlans.firstIndex(where: { $0.id == plan.id }) {
            savedPlans[index] = normalizedPlan
        } else {
            savedPlans.insert(normalizedPlan, at: 0)
        }

        persist()
    }

    mutating func completeWorkout(day: WorkoutDay, exerciseSets: [[LoggedSet]]) -> LoggedWorkout {
        let completedSetCount = exerciseSets
            .flatMap { $0 }
            .filter { $0.weight != nil && $0.reps != nil }
            .count
        let prescribedSetCount = day.exercises.reduce(0) { $0 + $1.sets }
        let workout = LoggedWorkout(
            title: day.title,
            completedAt: Date(),
            durationMinutes: 93,
            exerciseCount: day.exercises.count,
            setCount: completedSetCount == 0 ? prescribedSetCount : completedSetCount
        )
        workoutHistory.insert(workout, at: 0)
        advancePastCompletedDay(day)
        persist()
        return workout
    }

    private func persist() {
        let snapshot = WorkoutSnapshot(
            activePlan: activePlan,
            savedPlans: savedPlans,
            workoutHistory: workoutHistory,
            nextDayIndex: normalizedNextDayIndex
        )

        guard let data = try? JSONEncoder().encode(snapshot) else {
            return
        }

        defaults.set(data, forKey: storageKey)
    }

    private var normalizedNextDayIndex: Int {
        guard !activePlan.days.isEmpty else {
            return 0
        }

        return min(max(nextDayIndex, 0), activePlan.days.count - 1)
    }

    private mutating func advancePastCompletedDay(_ day: WorkoutDay) {
        guard !activePlan.days.isEmpty else {
            nextDayIndex = 0
            return
        }

        let completedIndex = activePlan.days.firstIndex { $0.id == day.id } ?? normalizedNextDayIndex
        nextDayIndex = (completedIndex + 1) % activePlan.days.count
    }

    private static var defaultSavedPlans: [WorkoutPlan] {
        [
            WorkoutPlan(name: "Batman", daysPerWeek: 3, createdAt: "12.02.26", days: SampleData.activePlan.days),
            WorkoutPlan(name: "Superman", daysPerWeek: 3, createdAt: "12.02.26", days: [
                WorkoutDay(title: "Pull", exercises: SampleData.pullExercises),
                WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                WorkoutDay(title: "Legs", exercises: SampleData.legExercises)
            ]),
            WorkoutPlan(name: "Leg Focus", daysPerWeek: 3, createdAt: "12.02.26", days: [
                WorkoutDay(title: "Legs", exercises: SampleData.legExercises),
                WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                WorkoutDay(title: "Legs 2", exercises: SampleData.legExercises)
            ])
        ]
    }

    private static func normalizedPlan(_ plan: WorkoutPlan) -> WorkoutPlan {
        if plan.name == SampleData.activePlan.name {
            var normalizedPlan = plan
            normalizedPlan.daysPerWeek = SampleData.activePlan.daysPerWeek
            normalizedPlan.createdAt = SampleData.activePlan.createdAt
            normalizedPlan.days = SampleData.activePlan.days
            return normalizedPlan
        }

        guard plan.days.isEmpty else {
            return plan
        }

        var normalizedPlan = plan
        normalizedPlan.days = templateDays(for: plan.name)
        return normalizedPlan
    }

    private static func templateDays(for planName: String) -> [WorkoutDay] {
        switch planName {
        case "Superman":
            [
                WorkoutDay(title: "Pull", exercises: SampleData.pullExercises),
                WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                WorkoutDay(title: "Legs", exercises: SampleData.legExercises)
            ]
        case "Leg Focus":
            [
                WorkoutDay(title: "Legs", exercises: SampleData.legExercises),
                WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                WorkoutDay(title: "Legs 2", exercises: SampleData.legExercises)
            ]
        default:
            SampleData.activePlan.days
        }
    }
}

private struct WorkoutSnapshot: Codable {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var workoutHistory: [LoggedWorkout]
    var nextDayIndex: Int?
}
