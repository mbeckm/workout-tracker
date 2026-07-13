import SwiftUI

@main
struct ScratchWorkoutApp: App {
    init() {
        PerformanceTrace.event(PerformanceTrace.Name.appLaunch)
#if DEBUG
        Problem4CompatibilityChecks.run()
#endif
    }

    var body: some Scene {
        WindowGroup {
            appContent
                .preferredColorScheme(.dark)
        }
    }

    @ViewBuilder
    private var appContent: some View {
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--qa-add-exercise-library") {
            CreatePlanView(
                initialStage: .search,
                searchQuery: ProcessInfo.processInfo.environment["SCRATCH_QA_QUERY"] ?? "",
                selectedTypeFilter: ProcessInfo.processInfo.environment["SCRATCH_QA_TYPE"]
                    .flatMap(WorkoutItemType.init(rawValue:)),
                exerciseCatalog: ExerciseCatalogServiceFactory.seed(),
                onFinish: { _, _ in }
            )
        } else {
            RootView()
        }
#else
        RootView()
#endif
    }
}

#if DEBUG
private enum Problem4CompatibilityChecks {
    static func run() {
        do {
            let decoder = JSONDecoder()

            let legacyStrength = Data(#"{"name":"Legacy Bench Press","sets":3,"reps":8}"#.utf8)
            let decodedLegacyStrength = try decoder.decode(ExercisePrescription.self, from: legacyStrength)
            assert(decodedLegacyStrength.itemType == .strength)
            assert(decodedLegacyStrength.trackingMode == .weightAndReps)

            let legacyEndurance = try decoder.decode(WorkoutItemType.self, from: Data(#""endurance""#.utf8))
            let legacyHealth = try decoder.decode(WorkoutItemType.self, from: Data(#""health""#.utf8))
            assert(legacyEndurance == .cardio)
            assert(legacyHealth == .mobility)

            let legacyCustom = Data(#"{"id":"00000000-0000-0000-0000-000000000001","name":"Legacy Run","equipment":"Treadmill","muscle":"Full Body","exerciseType":"endurance","trackingMode":"distanceAndDuration","createdAt":0}"#.utf8)
            let decodedLegacyCustom = try decoder.decode(CustomExerciseDefinition.self, from: legacyCustom)
            assert(decodedLegacyCustom.exerciseType == .cardio)
            assert(decodedLegacyCustom.isAvailable)

            let requiredTypes = Set(WorkoutItemType.allCases)
            let mixedItems = SampleData.exerciseDatabase.filter { requiredTypes.contains($0.itemType) }
            let roundTrippedItems = try decoder.decode(
                [ExercisePrescription].self,
                from: JSONEncoder().encode(mixedItems)
            )
            assert(Set(roundTrippedItems.map(\.itemType)) == requiredTypes)
            assert(roundTrippedItems.map(\.stableCatalogID) == mixedItems.map(\.stableCatalogID))

            let libraryTypes = Set(SeedExerciseCatalogProvider().allItems.compactMap(\.catalogItem.itemType))
            assert(libraryTypes == requiredTypes)

            let legacySet = Data(#"{"id":"00000000-0000-0000-0000-000000000002","index":1,"weight":80,"reps":8}"#.utf8)
            let decodedLegacySet = try decoder.decode(LoggedSet.self, from: legacySet)
            assert(decodedLegacySet.hasLoggedValues)
            assert(decodedLegacySet.durationSeconds == nil && decodedLegacySet.distanceMeters == nil)

            let customID = UUID()
            let activeCustom = CustomExerciseDefinition(
                id: customID,
                name: "Cloud Merge Test",
                equipment: "None",
                muscle: "Full Body",
                exerciseType: .mobility,
                trackingMode: .reps,
                createdAt: Date(timeIntervalSinceReferenceDate: 0),
                updatedAt: Date(timeIntervalSinceReferenceDate: 1),
                isArchived: false
            )
            var archivedCustom = activeCustom
            archivedCustom.updatedAt = Date(timeIntervalSinceReferenceDate: 2)
            archivedCustom.isArchived = true
            let mergedCustom = WorkoutStore.mergedCustomExercises(remote: [activeCustom], local: [archivedCustom])
            assert(mergedCustom.count == 1 && mergedCustom[0].isArchived == true)
        } catch {
            assertionFailure("Problem 4 compatibility checks failed: \(error)")
        }
    }
}
#endif
