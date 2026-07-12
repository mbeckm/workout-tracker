import Foundation
import OSLog

enum WorkoutStats {
    static let topLoggedExerciseLimit = 5
}

struct WorkoutStore {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var archivedPlans: [WorkoutPlan]
    private(set) var customExercises: [CustomExerciseDefinition]
    private(set) var workoutHistory: [LoggedWorkout]
    private(set) var nextDayIndex: Int
    private let persistence: WorkoutSnapshotPersistence

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

        if let savedPlan = savedPlans.first(where: { $0.id == id }) {
            return savedPlan
        }

        return archivedPlans.first { $0.id == id }
    }

    var recentWorkout: LoggedWorkout? {
        workoutHistory.first
    }

    var cloudSnapshot: WorkoutCloudSnapshot {
        WorkoutCloudSnapshot(
            activePlan: activePlan,
            savedPlans: savedPlans,
            archivedPlans: archivedPlans,
            customExercises: customExercises,
            workoutHistory: workoutHistory,
            nextDayIndex: normalizedNextDayIndex,
            capturedAt: Date()
        )
    }

    var workoutsThisMonth: Int {
        workoutDaysThisMonth.count
    }

    var workoutDaysThisMonth: Set<Date> {
        let calendar = Calendar.current
        let today = Date()

        return Set(
            workoutHistory
                .filter { calendar.isDate($0.completedAt, equalTo: today, toGranularity: .month) }
                .map { calendar.startOfDay(for: $0.completedAt) }
        )
    }

    var topLoggedExercises: [ExerciseSetSummary] {
        let summaries = Self.aggregateExerciseSetSummaries(from: statsWorkouts)
        return Array(summaries.prefix(WorkoutStats.topLoggedExerciseLimit))
    }

    func personalBestWeight(for exerciseName: String) -> Int? {
        let key = exerciseName.normalizedStatsKey
        let weights = statsWorkouts
            .flatMap(\.exercises)
            .filter { $0.exerciseName.normalizedStatsKey == key }
            .flatMap(\.sets)
            .compactMap { set -> Int? in
                guard let weight = set.weight,
                      let reps = set.reps,
                      weight > 0,
                      reps > 0 else {
                    return nil
                }

                return weight
            }

        return weights.max()
    }

    func exerciseStats(for exerciseName: String) -> ExerciseStatsDetails {
        let key = exerciseName.normalizedStatsKey
        let calendar = Calendar.current
        let points = statsWorkouts
            .flatMap { workout in
                workout.exercises
                    .filter { $0.exerciseName.normalizedStatsKey == key }
                    .map { (workout.completedAt, $0) }
            }
            .reduce(into: [Date: (totalTenRM: Double, setCount: Int)]()) { partialResult, entry in
                let day = calendar.startOfDay(for: entry.0)
                let tenRMs = entry.1.sets.compactMap(\.estimatedTenRM)

                guard !tenRMs.isEmpty else {
                    return
                }

                var aggregate = partialResult[day] ?? (0, 0)
                aggregate.totalTenRM += tenRMs.reduce(0, +)
                aggregate.setCount += tenRMs.count
                partialResult[day] = aggregate
            }
            .map { day, aggregate in
                ExerciseStatsPoint(
                    date: day,
                    averageTenRM: aggregate.totalTenRM / Double(aggregate.setCount),
                    setCount: aggregate.setCount,
                    isPersonalBest: false
                )
            }
            .sorted { $0.date < $1.date }

        var bestTenRMSoFar = -Double.infinity
        let progression = points.map { point in
            let isPersonalBest = point.averageTenRM > bestTenRMSoFar
            if isPersonalBest {
                bestTenRMSoFar = point.averageTenRM
            }

            return ExerciseStatsPoint(
                date: point.date,
                averageTenRM: point.averageTenRM,
                setCount: point.setCount,
                isPersonalBest: isPersonalBest
            )
        }

        return ExerciseStatsDetails(
            exerciseName: exerciseName,
            totalLoggedSets: progression.reduce(0) { $0 + $1.setCount },
            progression: progression
        )
    }

    private static let storageKey = "scratchWorkout.appState.v2"

    init(defaults: UserDefaults = .standard) {
        persistence = WorkoutSnapshotPersistence(defaults: defaults, storageKey: Self.storageKey)

        if let data = defaults.data(forKey: Self.storageKey),
           let snapshot = try? JSONDecoder().decode(WorkoutSnapshot.self, from: data) {
            activePlan = Self.normalizedPlan(snapshot.activePlan)
            savedPlans = snapshot.savedPlans.map(Self.normalizedPlan)
            archivedPlans = snapshot.archivedPlans?.map(Self.normalizedPlan) ?? []
            customExercises = snapshot.customExercises ?? []
            workoutHistory = snapshot.workoutHistory
            nextDayIndex = snapshot.nextDayIndex ?? 0
        } else {
            activePlan = SampleData.activePlan
            savedPlans = Self.defaultSavedPlans
            archivedPlans = []
            customExercises = []
            workoutHistory = []
            nextDayIndex = 0
        }
    }

    mutating func hydrate(from snapshot: WorkoutCloudSnapshot) {
        activePlan = Self.normalizedPlan(snapshot.activePlan)
        savedPlans = snapshot.savedPlans.map(Self.normalizedPlan)
        archivedPlans = snapshot.archivedPlans.map(Self.normalizedPlan)
        customExercises = Self.mergedCustomExercises(remote: snapshot.customExercises, local: customExercises)
        workoutHistory = snapshot.workoutHistory
        nextDayIndex = snapshot.nextDayIndex
        persist()
    }

    mutating func savePlan(_ plan: WorkoutPlan, activate: Bool) {
        let normalizedPlan = Self.normalizedPlan(plan)
        savedPlans.removeAll { $0.id == normalizedPlan.id }
        archivedPlans.removeAll { $0.id == normalizedPlan.id }
        savedPlans.insert(normalizedPlan, at: 0)

        if activate {
            activePlan = normalizedPlan
            nextDayIndex = 0
        }

        persist()
    }

    mutating func saveCustomExercise(_ exercise: CustomExerciseDefinition) {
        var updatedExercise = exercise
        updatedExercise.updatedAt = Date()
        updatedExercise.isArchived = false
        customExercises.removeAll { $0.id == exercise.id || $0.name.caseInsensitiveCompare(exercise.name) == .orderedSame }
        customExercises.insert(updatedExercise, at: 0)
        persist()
    }

    mutating func archiveCustomExercise(id: UUID) {
        guard let index = customExercises.firstIndex(where: { $0.id == id }) else { return }
        customExercises[index].isArchived = true
        customExercises[index].updatedAt = Date()
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
        } else if let index = archivedPlans.firstIndex(where: { $0.id == normalizedPlan.id }) {
            archivedPlans[index] = normalizedPlan
        } else {
            savedPlans.insert(normalizedPlan, at: 0)
        }

        persist()
    }

    mutating func archivePlan(_ plan: WorkoutPlan) {
        guard plan.id != activePlan.id else {
            return
        }

        let normalizedPlan = Self.normalizedPlan(plan)
        savedPlans.removeAll { $0.id == normalizedPlan.id }
        archivedPlans.removeAll { $0.id == normalizedPlan.id }
        archivedPlans.insert(normalizedPlan, at: 0)
        persist()
    }

    mutating func activatePlan(_ plan: WorkoutPlan) {
        let normalizedPlan = Self.normalizedPlan(plan)
        activePlan = normalizedPlan
        nextDayIndex = 0

        archivedPlans.removeAll { $0.id == normalizedPlan.id }

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
            .filter(\.hasLoggedValues)
            .count
        let prescribedSetCount = day.exercises.reduce(0) { $0 + $1.sets }
        let loggedExercises = zip(day.exercises, exerciseSets).map { exercise, sets in
            LoggedExercise(exerciseName: exercise.name, sets: sets)
        }
        let workout = LoggedWorkout(
            title: day.title,
            completedAt: Date(),
            durationMinutes: 93,
            exerciseCount: day.exercises.count,
            setCount: completedSetCount == 0 ? prescribedSetCount : completedSetCount,
            exercises: loggedExercises
        )
        workoutHistory.insert(workout, at: 0)
        advancePastCompletedDay(day)
        persist()
        return workout
    }

    func flushPersistence() {
        persistence.flush()
    }

    private func persist() {
        let snapshot = WorkoutSnapshot(
            activePlan: activePlan,
            savedPlans: savedPlans,
            archivedPlans: archivedPlans,
            customExercises: customExercises,
            workoutHistory: workoutHistory,
            nextDayIndex: normalizedNextDayIndex
        )

        persistence.schedule(snapshot)
    }

    private var normalizedNextDayIndex: Int {
        guard !activePlan.days.isEmpty else {
            return 0
        }

        return min(max(nextDayIndex, 0), activePlan.days.count - 1)
    }

    private var statsWorkouts: [LoggedWorkout] {
        if Self.hasLoggedExerciseData(in: workoutHistory) {
            return workoutHistory
        }

        return SampleData.loggedStatsHistory
    }

    private static func hasLoggedExerciseData(in workouts: [LoggedWorkout]) -> Bool {
        workouts.contains { workout in
            workout.exercises.contains { exercise in
                exercise.sets.contains(where: \.hasLoggedValues)
            }
        }
    }

    private static func aggregateExerciseSetSummaries(from workouts: [LoggedWorkout]) -> [ExerciseSetSummary] {
        workouts
            .flatMap(\.exercises)
            .reduce(into: [String: ExerciseSetSummary]()) { partialResult, exercise in
                let setCount = exercise.sets.filter(\.hasLoggedValues).count
                guard setCount > 0 else {
                    return
                }

                let key = exercise.exerciseName.normalizedStatsKey
                if var existing = partialResult[key] {
                    existing.setCount += setCount
                    partialResult[key] = existing
                } else {
                    partialResult[key] = ExerciseSetSummary(exerciseName: exercise.exerciseName, setCount: setCount)
                }
            }
            .values
            .sorted { lhs, rhs in
                if lhs.setCount == rhs.setCount {
                    return lhs.exerciseName < rhs.exerciseName
                }

                return lhs.setCount > rhs.setCount
            }
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

    static func mergedCustomExercises(
        remote: [CustomExerciseDefinition],
        local: [CustomExerciseDefinition]
    ) -> [CustomExerciseDefinition] {
        var newestByName: [String: CustomExerciseDefinition] = [:]

        for exercise in remote + local {
            let key = exercise.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            let exerciseModifiedAt = exercise.updatedAt ?? exercise.createdAt
            let shouldReplace = newestByName[key].map {
                exerciseModifiedAt >= ($0.updatedAt ?? $0.createdAt)
            } ?? true

            if shouldReplace {
                newestByName[key] = exercise
            }
        }

        return newestByName.values.sorted {
            ($0.updatedAt ?? $0.createdAt) > ($1.updatedAt ?? $1.createdAt)
        }
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
        guard plan.createdAt == SampleData.activePlan.createdAt else {
            return false
        }

        guard let firstDay = plan.days.first,
              let firstExercise = firstDay.exercises.first else {
            return false
        }

        if firstExercise.name == "Flat Barbell Bench Press" {
            return true
        }

        return plan.days.count == SampleData.activePlan.days.count &&
            firstDay.title == "Day 1" &&
            firstDay.matchesLegacySeededDayOne
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
    var archivedPlans: [WorkoutPlan]?
    var customExercises: [CustomExerciseDefinition]?
    var workoutHistory: [LoggedWorkout]
    var nextDayIndex: Int?
}

private final class WorkoutSnapshotPersistence: @unchecked Sendable {
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.marvinbeckmann.ScratchWorkout",
        category: "Persistence"
    )
    private let defaults: UserDefaults
    private let storageKey: String
    private let queue = DispatchQueue(label: "com.marvinbeckmann.ScratchWorkout.persistence", qos: .utility)

    init(defaults: UserDefaults, storageKey: String) {
        self.defaults = defaults
        self.storageKey = storageKey
    }

    func schedule(_ snapshot: WorkoutSnapshot) {
        queue.async { [defaults, storageKey] in
            let signpostID = PerformanceTrace.begin(PerformanceTrace.Name.persistenceWrite)
            defer {
                PerformanceTrace.end(PerformanceTrace.Name.persistenceWrite, id: signpostID)
            }

            do {
                let data = try JSONEncoder().encode(snapshot)
                defaults.set(data, forKey: storageKey)
            } catch {
                Self.logger.error("Failed to encode workout snapshot: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    func flush() {
        queue.sync {}
    }
}

private extension WorkoutDay {
    var matchesLegacySeededDayOne: Bool {
        let legacyExercises = [
            ("Barbell Row", 4, 10),
            ("Incline Bench Press", 4, 8),
            ("Pull-Ups", 4, 8),
            ("Seated Cable Row", 3, 12),
            ("Overhead Press", 4, 10),
            ("Lateral Raises", 3, 15),
            ("Tricep Pushdowns", 3, 15),
            ("Cable Chest Fly", 3, 15)
        ]

        guard exercises.count == legacyExercises.count else {
            return false
        }

        return zip(exercises, legacyExercises).allSatisfy { exercise, legacy in
            exercise.name == legacy.0 &&
                exercise.sets == legacy.1 &&
                exercise.reps == legacy.2
        }
    }
}
