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
        if ProcessInfo.processInfo.arguments.contains("--qa-add-exercise-library")
            || ProcessInfo.processInfo.arguments.contains("--qa-live-exercise-library") {
            CreatePlanView(
                initialStage: .search,
                searchQuery: ProcessInfo.processInfo.environment["SCRATCH_QA_QUERY"] ?? "",
                selectedTypeFilter: ProcessInfo.processInfo.environment["SCRATCH_QA_TYPE"]
                    .flatMap(WorkoutItemType.init(rawValue:)),
                exerciseCatalog: ProcessInfo.processInfo.arguments.contains("--qa-live-exercise-library")
                    ? ExerciseCatalogServiceFactory.live()
                    : ExerciseCatalogServiceFactory.seed(),
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

            let bike = ExerciseCatalogItem(
                providerExerciseId: "H1PESYI",
                name: "stationary bike run",
                bodyParts: ["cardio"],
                targetMuscles: ["cardiovascular system"],
                equipments: ["stationary bike"]
            ).prescription()
            assert(bike.itemType == .cardio)
            assert(bike.trackingMode == .duration)
            assert(bike.sets == 1 && bike.reps == 0 && bike.durationSeconds == 20 * 60)

            let inclinePress = ExerciseCatalogItem(
                name: "incline dumbbell bench press",
                bodyParts: ["chest"],
                targetMuscles: ["pectorals"],
                equipments: ["dumbbell"]
            ).prescription()
            assert(inclinePress.itemType == .strength)
            assert(inclinePress.trackingMode == .weightAndReps)
            assert(inclinePress.sets == 3 && inclinePress.reps == 12 && inclinePress.durationSeconds == nil)

            let abdominalAirBike = ExerciseCatalogItem(
                name: "air bike",
                bodyParts: ["waist"],
                targetMuscles: ["abs"],
                equipments: ["body weight"]
            ).prescription()
            assert(abdominalAirBike.itemType == .strength)
            assert(abdominalAirBike.trackingMode == .reps)

            let runnersStretch = ExerciseCatalogItem(
                name: "runners stretch",
                bodyParts: ["upper legs"],
                targetMuscles: ["hamstrings"],
                equipments: ["body weight"]
            ).prescription()
            assert(runnersStretch.itemType == .stretch)
            assert(runnersStretch.trackingMode == .duration && runnersStretch.durationSeconds == 30)

            let bundledBikeSource = SampleData.exerciseDatabase.first { $0.name == "Zone 2 Bike" }!
            let bundledBike = ExerciseCatalogItem(prescription: bundledBikeSource).prescription()
            assert(bundledBike.trackingMode == .distanceAndDuration)
            assert(bundledBike.durationSeconds == 1_800 && bundledBike.distanceMeters == 10_000)

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
