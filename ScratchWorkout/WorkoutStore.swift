import Foundation
import OSLog

enum WorkoutStats {
    static let topLoggedExerciseLimit = 5
    static let overviewExerciseLimit = 2
    static let progressWindowDays = 60
    static let volumeWindowWeeks = 6
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

    var statsOverview: StatsOverview {
        let workouts = statsWorkouts

        return StatsOverview(
            progressLeaders: Self.progressLeaders(from: workouts),
            mostLoggedExercises: Self.exerciseVolumeSummaries(from: workouts)
        )
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

    func exerciseResults(for workout: LoggedWorkout, day: WorkoutDay) -> [WorkoutExerciseResult] {
        let eligibleExercises = day.exercises.enumerated().reduce(
            into: [String: (order: Int, displayName: String)]()
        ) { partialResult, entry in
            guard entry.element.trackingMode == .weightAndReps else {
                return
            }

            let key = entry.element.name.normalizedStatsKey
            guard partialResult[key] == nil else {
                return
            }

            partialResult[key] = (entry.offset, entry.element.name)
        }

        let previousBestByExercise = workoutHistory
            .filter { $0.id != workout.id }
            .flatMap(\.exercises)
            .filter { eligibleExercises[$0.exerciseName.normalizedStatsKey] != nil }
            .reduce(into: [String: Double]()) { partialResult, exercise in
                let key = exercise.exerciseName.normalizedStatsKey
                guard let best = exercise.sets.compactMap(\.estimatedTenRM).max() else {
                    return
                }

                partialResult[key] = max(partialResult[key] ?? -Double.infinity, best)
            }

        let currentSetsByExercise = workout.exercises.reduce(into: [String: [LoggedSet]]()) { partialResult, exercise in
            let key = exercise.exerciseName.normalizedStatsKey
            guard eligibleExercises[key] != nil else {
                return
            }

            partialResult[key, default: []].append(contentsOf: exercise.sets)
        }

        return currentSetsByExercise.compactMap { key, sets -> (WorkoutExerciseResult, Int)? in
            guard let exercise = eligibleExercises[key],
                  let bestSet = sets.compactMap({ set -> (set: LoggedSet, estimatedTenRM: Double)? in
                      guard let estimatedTenRM = set.estimatedTenRM else {
                          return nil
                      }
                      return (set, estimatedTenRM)
                  }).max(by: { lhs, rhs in
                      if lhs.estimatedTenRM != rhs.estimatedTenRM {
                          return lhs.estimatedTenRM < rhs.estimatedTenRM
                      }

                      let lhsWeight = lhs.set.weight ?? 0
                      let rhsWeight = rhs.set.weight ?? 0
                      if lhsWeight != rhsWeight {
                          return lhsWeight < rhsWeight
                      }

                      let lhsReps = lhs.set.reps ?? 0
                      let rhsReps = rhs.set.reps ?? 0
                      if lhsReps != rhsReps {
                          return lhsReps < rhsReps
                      }

                      return lhs.set.index > rhs.set.index
                  }),
                  let weight = bestSet.set.weight,
                  let reps = bestSet.set.reps else {
                return nil
            }

            return (
                WorkoutExerciseResult(
                    exerciseName: exercise.displayName,
                    weight: weight,
                    reps: reps,
                    estimatedTenRM: bestSet.estimatedTenRM,
                    previousBestTenRM: previousBestByExercise[key]
                ),
                exercise.order
            )
        }
        .sorted { lhs, rhs in
            if lhs.0.isPersonalBest != rhs.0.isPersonalBest {
                return lhs.0.isPersonalBest && !rhs.0.isPersonalBest
            }

            return lhs.1 < rhs.1
        }
        .map(\.0)
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

    mutating func completeWorkout(
        day: WorkoutDay,
        exerciseSets: [[LoggedSet]],
        durationMinutes: Int
    ) -> LoggedWorkout {
        let completedSetCount = exerciseSets
            .flatMap { $0 }
            .filter(\.hasLoggedValues)
            .count
        let loggedExercises = zip(day.exercises, exerciseSets).map { exercise, sets in
            LoggedExercise(exerciseName: exercise.name, sets: sets)
        }
        let workout = LoggedWorkout(
            title: day.title,
            completedAt: Date(),
            durationMinutes: max(0, durationMinutes),
            exerciseCount: day.exercises.count,
            setCount: completedSetCount,
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

    private static func progressLeaders(
        from workouts: [LoggedWorkout],
        relativeTo now: Date = Date()
    ) -> [ExerciseProgressSummary] {
        let calendar = Calendar.current
        let cutoff = calendar.date(
            byAdding: .day,
            value: -WorkoutStats.progressWindowDays,
            to: calendar.startOfDay(for: now)
        ) ?? .distantPast

        let performances = workouts
            .filter { $0.completedAt >= cutoff && $0.completedAt <= now }
            .flatMap { workout in
                workout.exercises.compactMap { exercise -> (String, String, Date, Double)? in
                    let estimates = exercise.sets.compactMap(\.estimatedTenRM)
                    guard !estimates.isEmpty else {
                        return nil
                    }

                    return (
                        exercise.exerciseName.normalizedStatsKey,
                        exercise.exerciseName,
                        workout.completedAt,
                        estimates.reduce(0, +) / Double(estimates.count)
                    )
                }
            }

        let grouped = Dictionary(grouping: performances, by: { $0.0 })

        return grouped.values
            .compactMap { entries -> ExerciseProgressSummary? in
                let sorted = entries.sorted { $0.2 < $1.2 }
                guard let baseline = sorted.first,
                      let latest = sorted.last,
                      baseline.2 < latest.2,
                      baseline.3 > 0 else {
                    return nil
                }

                let percentageChange = ((latest.3 - baseline.3) / baseline.3) * 100
                guard percentageChange >= 0.5 else {
                    return nil
                }

                return ExerciseProgressSummary(
                    exerciseName: latest.1,
                    percentageChange: percentageChange
                )
            }
            .sorted { lhs, rhs in
                if abs(lhs.percentageChange - rhs.percentageChange) < 0.05 {
                    return lhs.exerciseName < rhs.exerciseName
                }

                return lhs.percentageChange > rhs.percentageChange
            }
            .prefix(WorkoutStats.overviewExerciseLimit)
            .map { $0 }
    }

    private static func exerciseVolumeSummaries(
        from workouts: [LoggedWorkout],
        relativeTo now: Date = Date()
    ) -> [ExerciseVolumeSummary] {
        let calendar = Calendar.current
        let currentWeek = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? calendar.startOfDay(for: now)
        let weekStarts = (0..<WorkoutStats.volumeWindowWeeks)
            .compactMap { offset in
                calendar.date(byAdding: .weekOfYear, value: offset - (WorkoutStats.volumeWindowWeeks - 1), to: currentWeek)
            }

        let topExercises = Array(
            aggregateExerciseSetSummaries(from: workouts)
                .prefix(WorkoutStats.overviewExerciseLimit)
        )

        return topExercises.enumerated().map { offset, exercise in
            let key = exercise.exerciseName.normalizedStatsKey
            let countsByWeek = workouts.reduce(into: [Date: Int]()) { partialResult, workout in
                guard let weekStart = calendar.dateInterval(of: .weekOfYear, for: workout.completedAt)?.start else {
                    return
                }

                let setCount = workout.exercises
                    .filter { $0.exerciseName.normalizedStatsKey == key }
                    .flatMap(\.sets)
                    .filter(\.hasLoggedValues)
                    .count

                guard setCount > 0 else {
                    return
                }

                partialResult[weekStart, default: 0] += setCount
            }

            let rank = topExercises.prefix(offset).filter { $0.setCount > exercise.setCount }.count + 1

            return ExerciseVolumeSummary(
                rank: rank,
                exerciseName: exercise.exerciseName,
                totalSetCount: exercise.setCount,
                weeklyVolumes: weekStarts.map { weekStart in
                    WeeklyExerciseVolume(
                        weekStart: weekStart,
                        setCount: countsByWeek[weekStart, default: 0]
                    )
                }
            )
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
