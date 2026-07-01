import Foundation

struct WorkoutStore {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    private(set) var workoutHistory: [LoggedWorkout]
    private(set) var nextDayIndex: Int

    var nextWorkoutDay: WorkoutDay {
        guard !activePlan.days.isEmpty else {
            return SampleData.nextWorkoutDay
        }

        if isSeededPPL(activePlan), normalizedNextDayIndex == 0 {
            return SampleData.nextWorkoutDay
        }

        return activePlan.days[normalizedNextDayIndex]
    }

    func plan(for id: UUID) -> WorkoutPlan? {
        if activePlan.id == id {
            return activePlan
        }

        return savedPlans.first { $0.id == id }
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
        let normalizedPlan = Self.normalizedPlan(plan)
        savedPlans.removeAll { $0.id == normalizedPlan.id }
        savedPlans.insert(normalizedPlan, at: 0)

        if activate {
            activePlan = normalizedPlan
            nextDayIndex = 0
        }

        persist()
    }

    mutating func updatePlan(_ plan: WorkoutPlan) {
        let normalizedPlan = Self.normalizedPlan(plan)

        if activePlan.id == normalizedPlan.id {
            activePlan = normalizedPlan
            nextDayIndex = min(nextDayIndex, max(normalizedPlan.days.count - 1, 0))
        }

        if let index = savedPlans.firstIndex(where: { $0.id == normalizedPlan.id }) {
            savedPlans[index] = normalizedPlan
        } else {
            savedPlans.insert(normalizedPlan, at: 0)
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
            WorkoutPlan(name: "Batman", daysPerWeek: 3, createdAt: "12.02.26", days: templateDays(for: "Batman", count: 3)),
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
        if plan.name == SampleData.activePlan.name && isLegacySeededPPL(plan) {
            var normalizedPlan = plan
            normalizedPlan.daysPerWeek = SampleData.activePlan.daysPerWeek
            normalizedPlan.createdAt = SampleData.activePlan.createdAt
            normalizedPlan.days = SampleData.activePlan.days
            return normalizedPlan
        }

        guard !plan.days.isEmpty else {
            var normalizedPlan = plan
            normalizedPlan.days = templateDays(for: plan.name, count: plan.daysPerWeek)
            return normalizedPlan
        }

        var normalizedPlan = plan
        normalizedPlan.days = normalizedDays(plan.days, for: plan.name, count: plan.daysPerWeek)
        return normalizedPlan
    }

    private static func isLegacySeededPPL(_ plan: WorkoutPlan) -> Bool {
        if plan.days.count < SampleData.activePlan.days.count {
            return true
        }

        guard let firstDay = plan.days.first,
              let firstExercise = firstDay.exercises.first else {
            return false
        }

        if firstExercise.name == "Flat Barbell Bench Press" {
            return true
        }

        return firstExercise.name == "Barbell Row" &&
            firstDay.exercises.dropFirst().first?.name == "Incline Bench Press"
    }

    private func isSeededPPL(_ plan: WorkoutPlan) -> Bool {
        (plan.name == SampleData.activePlan.name || plan.name == "Push Pull Legs") &&
        plan.createdAt == SampleData.activePlan.createdAt &&
        plan.daysPerWeek == SampleData.activePlan.daysPerWeek &&
        plan.days == SampleData.activePlan.days
    }

    private static func normalizedDays(_ days: [WorkoutDay], for planName: String, count: Int) -> [WorkoutDay] {
        guard count > 0, days.count != count else {
            return days
        }

        if days.count > count {
            return Array(days.prefix(count))
        }

        let template = templateDays(for: planName, count: count)
        return days + Array(template.dropFirst(days.count).prefix(count - days.count))
    }

    private static func templateDays(for planName: String, count: Int) -> [WorkoutDay] {
        let days: [WorkoutDay] = switch planName {
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

        guard count > 0 else {
            return days
        }

        if days.count >= count {
            return Array(days.prefix(count))
        }

        let extraDays = (days.count..<count).map { index in
            WorkoutDay(title: "Day \(index + 1)", exercises: SampleData.pushExercises)
        }
        return days + extraDays
    }
}

private struct WorkoutSnapshot: Codable {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var workoutHistory: [LoggedWorkout]
    var nextDayIndex: Int?
}
