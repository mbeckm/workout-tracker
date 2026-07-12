import SwiftUI

struct RootView: View {
    @StateObject private var accountController = AccountController()
    @State private var selectedTab: AppTab = .home
    @State private var route: AppRoute?
    @State private var store = WorkoutStore()
    @State private var completedWorkout: LoggedWorkout?
    @State private var workoutSessionDay: WorkoutDay?
    @State private var activeExerciseIndex = 0
    @State private var loggedExerciseSets: [[LoggedSet]] = []
    @State private var isAccountPresented = false
    @State private var activeAchievement: Achievement?
    @State private var achievementFiredExerciseKeys: Set<String> = []
    @State private var deferredExerciseCompletion: (sets: [LoggedSet], day: WorkoutDay, index: Int)?
    @State private var navigationDirection: AppNavigationDirection = .forward
    @State private var exerciseSlideDirection: AppNavigationDirection = .forward
    @State private var didTraceFirstRender = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if #available(iOS 18.0, *) {
                nativeTabRoot
            } else {
                legacyTabRoot
            }
        }
        .task {
            await accountController.restoreSession()
        }
        .onAppear {
            guard !didTraceFirstRender else { return }
            didTraceFirstRender = true
            PerformanceTrace.event(PerformanceTrace.Name.firstRender)
        }
        .onChange(of: accountController.hydratedSnapshot) { _, newValue in
            if let snap = newValue {
                store.hydrate(from: snap)
                accountController.hydratedSnapshot = nil
            }
        }
        .onChange(of: scenePhase) { _, newValue in
            if newValue == .background {
                store.flushPersistence()
            }
        }
        .sheet(isPresented: $isAccountPresented) {
            AccountView(controller: accountController, currentSnapshot: store.cloudSnapshot)
                .preferredColorScheme(.dark)
        }
    }

    @available(iOS 18.0, *)
    private var nativeTabRoot: some View {
        ZStack {
            NativeAppTabView(
                selectedTab: $selectedTab,
                route: route,
                onSelect: selectTab,
                tabContent: { tab in
                    tabContent(for: tab)
                },
                routeOverlay: {
                    routeContent
                        .id(screenIdentity)
                        .transition(AppScreenTransition.slide(navigationDirection, reduceMotion: reduceMotion))
                        .transaction { transaction in
                            if navigationDirection == .none {
                                transaction.disablesAnimations = true
                            }
                        }
                }
            )

            if let activeAchievement {
                AchievementCardOverlay(achievement: activeAchievement) {
                    dismissAchievement()
                }
                .zIndex(100)
            }
        }
        .environment(\.usesNativeTabBar, true)
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    private var legacyTabRoot: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                tabContent(for: selectedTab)
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)

                routeContent
                    .id(screenIdentity)
                    .transition(AppScreenTransition.slide(navigationDirection, reduceMotion: reduceMotion))
                    .transaction { transaction in
                        if navigationDirection == .none {
                            transaction.disablesAnimations = true
                        }
                    }
                    .allowsHitTesting(route != nil)
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)

                AppTabBar(selectedTab: $selectedTab, route: route) { tab in
                    selectTab(tab)
                }
                .frame(width: proxy.size.width, height: 82)
                .position(x: proxy.size.width / 2, y: proxy.size.height - 41)
                .zIndex(10)

                if let activeAchievement {
                    AchievementCardOverlay(achievement: activeAchievement) {
                        dismissAchievement()
                    }
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .zIndex(100)
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(AppColor.base)
        }
        .environment(\.usesNativeTabBar, false)
        .ignoresSafeArea(.container, edges: .bottom)
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    @ViewBuilder
    private var routeContent: some View {
        switch route {
        case .startWorkout:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                push {
                    beginWorkout()
                }
            })
        case .nextWorkoutPreview:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                push {
                    beginWorkout(day: store.nextWorkoutDay)
                }
            })
            .swipeToGoBack {
                pop {
                    selectedTab = .home
                    route = nil
                }
            }
        case .activePlanDetail:
            PlanDetailView(
                plan: store.activePlan,
                allowsEditing: false,
                onStartWorkout: { day in
                    push {
                        beginWorkout(day: day)
                    }
                },
                onSave: { plan in
                    store.updatePlan(plan)
                    syncAccount(reason: .planUpdated)
                }
            )
            .swipeToGoBack {
                pop {
                    selectedTab = .home
                    route = nil
                }
            }
        case .planDetail(let planID):
            if let plan = store.plan(for: planID) {
                PlanDetailView(
                    plan: plan,
                    allowsEditing: true,
                    onStartWorkout: { day in
                        push {
                            beginWorkout(day: day)
                        }
                    },
                    onSave: { plan in
                        store.updatePlan(plan)
                        syncAccount(reason: .planUpdated)
                    }
                )
                .swipeToGoBack {
                    pop {
                        selectedTab = .plans
                        route = nil
                    }
                }
            } else {
                PlansView(
                    activePlan: store.activePlan,
                    savedPlans: store.savedPlans,
                    archivedPlans: store.archivedPlans,
                    onNewPlan: {
                        push {
                            route = .createPlan
                        }
                    },
                    onOpenPlan: { plan in
                        push {
                            route = .planDetail(plan.id)
                        }
                    },
                    onArchivePlan: { plan in
                        store.archivePlan(plan)
                        syncAccount(reason: .planUpdated)
                    }
                )
            }
        case .logWorkout:
            let day = workoutSessionDay ?? store.nextWorkoutDay
            if day.exercises.isEmpty {
                StartWorkoutView(day: day, onStart: {
                    push {
                        beginWorkout(day: day)
                    }
                })
            } else {
                LogWorkoutSessionView(
                    day: day,
                    activeExerciseIndex: $activeExerciseIndex,
                    exerciseSlideDirection: $exerciseSlideDirection,
                    previousBestWeight: { store.personalBestWeight(for: $0) },
                    username: accountUsername,
                    achievementFiredExerciseKeys: achievementFiredExerciseKeys,
                    initialLoggedSets: loggedExerciseSets,
                    onAchievementUnlocked: { achievement, pendingSets in
                        activeAchievement = achievement
                        let index = min(activeExerciseIndex, day.exercises.count - 1)
                        achievementFiredExerciseKeys.insert(day.exercises[index].name.normalizedStatsKey)
                        if let pendingSets {
                            deferredExerciseCompletion = (pendingSets, day, index)
                        }
                    },
                    onSetsChange: { index, sets in
                        persistExerciseSets(sets, at: index, in: day)
                    },
                    onExerciseComplete: { sets in
                        push {
                            completeExercise(sets, in: day, at: activeExerciseIndex)
                        }
                    }
                )
            }
        case .workoutComplete:
            WorkoutCompleteView(workout: completedWorkout, onFinish: {
                pop {
                    selectedTab = .home
                    route = nil
                    clearWorkoutSession()
                }
            })
        case .createPlan:
            CreatePlanView(
                customExercises: store.customExercises,
                onSaveCustomExercise: { exercise in
                    store.saveCustomExercise(exercise)
                    syncAccount(reason: .exerciseLibraryUpdated)
                },
                onFinish: { plan, activate in
                    store.savePlan(plan, activate: activate)
                    syncAccount(reason: .planSaved)
                    pop {
                        selectedTab = .plans
                        route = nil
                    }
                }
            )
        case .exerciseStats(let exerciseName):
            ExerciseStatsView(
                stats: store.exerciseStats(for: exerciseName)
            )
            .swipeToGoBack {
                pop {
                    selectedTab = .stats
                    route = nil
                }
            }
        case nil:
            EmptyView()
        }
    }

    @ViewBuilder
    private func tabContent(for tab: AppTab) -> some View {
        switch tab {
        case .home:
            HomeView(
                activePlan: store.activePlan,
                nextWorkout: store.nextWorkoutDay,
                recentWorkout: store.recentWorkout,
                workoutDaysThisMonth: store.workoutDaysThisMonth,
                accountSession: accountController.session,
                accountSyncState: accountController.syncState,
                onOpenActivePlan: {
                    push {
                        route = .activePlanDetail
                    }
                },
                onOpenNextWorkout: {
                    push {
                        route = .nextWorkoutPreview
                    }
                },
                onOpenAccount: {
                    isAccountPresented = true
                }
            )
        case .plans:
            PlansView(
                activePlan: store.activePlan,
                savedPlans: store.savedPlans,
                archivedPlans: store.archivedPlans,
                onNewPlan: {
                    push {
                        route = .createPlan
                    }
                },
                onOpenPlan: { plan in
                    push {
                        route = .planDetail(plan.id)
                    }
                },
                onArchivePlan: { plan in
                    store.archivePlan(plan)
                    syncAccount(reason: .planUpdated)
                }
            )
        case .workout:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                push {
                    beginWorkout()
                }
            })
        case .stats:
            StatsView(
                topExercises: store.topLoggedExercises,
                onOpenExercise: { exerciseName in
                    push {
                        route = .exerciseStats(exerciseName)
                    }
                }
            )
        }
    }

    private var screenIdentity: String {
        switch route {
        case nil:
            return "route-overlay-empty"
        case .logWorkout:
            let day = workoutSessionDay ?? store.nextWorkoutDay
            return "logWorkout-\(day.id.uuidString)"
        case .planDetail(let planID):
            return "planDetail-\(planID.uuidString)"
        case .exerciseStats(let exerciseName):
            return "exerciseStats-\(exerciseName)"
        case .startWorkout:
            return "startWorkout"
        case .nextWorkoutPreview:
            return "nextWorkoutPreview"
        case .activePlanDetail:
            return "activePlanDetail"
        case .workoutComplete:
            return "workoutComplete"
        case .createPlan:
            return "createPlan"
        }
    }

    private func push(_ changes: () -> Void) {
        PerformanceTrace.event(PerformanceTrace.Name.routePush)
        navigationDirection = .forward
        withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion), changes)
    }

    private func pop(_ changes: () -> Void) {
        PerformanceTrace.event(PerformanceTrace.Name.routePop)
        navigationDirection = .backward
        withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion), changes)
    }

    private func selectTab(_ tab: AppTab) {
        PerformanceTrace.event(PerformanceTrace.Name.tabSwitch)
        navigationDirection = .none
        selectedTab = tab
        route = nil
        completedWorkout = nil
        clearWorkoutSession()
    }

    private func beginWorkout(day selectedDay: WorkoutDay? = nil) {
        PerformanceTrace.event(PerformanceTrace.Name.workoutStart)
        let day = selectedDay ?? store.nextWorkoutDay
        selectedTab = .workout
        workoutSessionDay = day
        activeExerciseIndex = 0
        loggedExerciseSets = Array(repeating: [], count: day.exercises.count)
        achievementFiredExerciseKeys = []
        deferredExerciseCompletion = nil
        activeAchievement = nil
        exerciseSlideDirection = .forward
        route = .logWorkout
    }

    private func persistExerciseSets(_ sets: [LoggedSet], at index: Int, in day: WorkoutDay) {
        PerformanceTrace.event(PerformanceTrace.Name.logSet)
        if loggedExerciseSets.count != day.exercises.count {
            loggedExerciseSets = Array(repeating: [], count: day.exercises.count)
        }

        loggedExerciseSets[index] = sets
    }

    private func completeExercise(_ sets: [LoggedSet], in day: WorkoutDay, at index: Int) {
        PerformanceTrace.event(PerformanceTrace.Name.exerciseComplete)
        let sessionDay = workoutSessionDay ?? day
        loggedExerciseSets = normalizedLoggedExerciseSets(
            loggedExerciseSets,
            for: sessionDay,
            assigning: sets,
            at: index
        )

        if index >= sessionDay.exercises.count - 1 {
            PerformanceTrace.event(PerformanceTrace.Name.workoutFinish)
            navigationDirection = .forward
            completedWorkout = store.completeWorkout(day: sessionDay, exerciseSets: loggedExerciseSets)
            syncAccount(reason: .workoutCompleted)
            route = .workoutComplete
        } else {
            exerciseSlideDirection = .forward
            activeExerciseIndex = index + 1
        }
    }

    private func normalizedLoggedExerciseSets(
        _ exerciseSets: [[LoggedSet]],
        for day: WorkoutDay,
        assigning sets: [LoggedSet],
        at index: Int
    ) -> [[LoggedSet]] {
        let targetCount = day.exercises.count
        var normalized = exerciseSets

        if normalized.count < targetCount {
            normalized.append(contentsOf: Array(repeating: [], count: targetCount - normalized.count))
        } else if normalized.count > targetCount {
            normalized = Array(normalized.prefix(targetCount))
        }

        guard normalized.indices.contains(index) else {
            return normalized
        }

        normalized[index] = sets
        return normalized
    }

    private func clearWorkoutSession() {
        workoutSessionDay = nil
        activeExerciseIndex = 0
        loggedExerciseSets = []
        achievementFiredExerciseKeys = []
        deferredExerciseCompletion = nil
        activeAchievement = nil
    }

    private var accountUsername: String? {
        guard case let .signedIn(user) = accountController.session else {
            return nil
        }

        let trimmed = user.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func dismissAchievement() {
        activeAchievement = nil

        if let deferredExerciseCompletion {
            let sets = deferredExerciseCompletion.sets
            let day = deferredExerciseCompletion.day
            let index = deferredExerciseCompletion.index
            self.deferredExerciseCompletion = nil

            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                completeExercise(sets, in: day, at: index)
            }
        }
    }

    private func syncAccount(reason: WorkoutSyncReason) {
        let snapshot = store.cloudSnapshot
        accountController.enqueueSync(snapshot: snapshot, reason: reason)
    }
}

#if DEBUG
private struct ScreenPreviewShell<Content: View>: View {
    @State private var selectedTab: AppTab
    private let route: AppRoute?
    private let content: Content

    init(tab: AppTab, route: AppRoute? = nil, @ViewBuilder content: () -> Content) {
        _selectedTab = State(initialValue: tab)
        self.route = route
        self.content = content()
    }

    var body: some View {
        Group {
            if #available(iOS 18.0, *) {
                TabView(selection: $selectedTab) {
                    ForEach(AppTab.allCases) { tab in
                        Tab(tab.title, systemImage: tab.icon, value: tab) {
                            content
                        }
                    }
                }
                .tint(AppColor.accent)
                .liquidGlassTabBarBehavior()
            } else {
                ZStack(alignment: .bottom) {
                    content

                    AppTabBar(selectedTab: $selectedTab, route: route) { tab in
                        selectedTab = tab
                    }
                }
            }
        }
        .frame(width: 402, height: 874)
        .background(AppColor.base)
        .ignoresSafeArea()
    }
}

private enum PreviewFixtures {
    static let savedPlans = [
        WorkoutPlan(name: "Batman", daysPerWeek: 3, createdAt: "12.02.26", days: Array(SampleData.activePlan.days.prefix(3))),
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

    static let archivedPlans = [
        WorkoutPlan(name: "Old PPL", daysPerWeek: 3, createdAt: "01.01.26", days: Array(SampleData.activePlan.days.prefix(3)))
    ]

    static let loggedWorkout = LoggedWorkout(
        title: "Push",
        completedAt: Date(timeIntervalSince1970: 1_783_000_000),
        durationMinutes: 93,
        exerciseCount: 8,
        setCount: 32
    )

    static let recentWorkout = LoggedWorkout(
        title: "Pull",
        completedAt: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date(),
        durationMinutes: 82,
        exerciseCount: 8,
        setCount: 32
    )

    static let logExercise = ExercisePrescription(name: "Incline Bench Press", sets: 4, reps: 12)
}

struct ScratchWorkoutScreenPreviews: PreviewProvider {
    private static let previewWorkoutDays: Set<Date> = {
        let suiteName = "com.scratchworkout.preview.home-calendar"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            return []
        }
        defaults.removePersistentDomain(forName: suiteName)
        return WorkoutStore(defaults: defaults).workoutDaysThisMonth
    }()

    static var previews: some View {
        Group {
            ScreenPreviewShell(tab: .home) {
                HomeView(
                    activePlan: SampleData.activePlan,
                    nextWorkout: SampleData.activePlan.days[0],
                    recentWorkout: nil,
                    workoutDaysThisMonth: previewWorkoutDays,
                    accountSession: .signedOut,
                    accountSyncState: .signedOut,
                    onOpenActivePlan: {},
                    onOpenNextWorkout: {},
                    onOpenAccount: {}
                )
            }
            .previewDisplayName("Overview")

            ScreenPreviewShell(tab: .home) {
                HomeView(
                    activePlan: SampleData.activePlan,
                    nextWorkout: WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                    recentWorkout: PreviewFixtures.recentWorkout,
                    workoutDaysThisMonth: previewWorkoutDays,
                    accountSession: .signedIn(AccountUser(id: "preview-apple", displayName: "Apple Account", email: nil, provider: .apple, createdAt: Date())),
                    accountSyncState: .synced(Date()),
                    onOpenActivePlan: {},
                    onOpenNextWorkout: {},
                    onOpenAccount: {}
                )
            }
            .previewDisplayName("Overview - Recent")

            ScreenPreviewShell(tab: .plans) {
                PlansView(
                    activePlan: SampleData.activePlan,
                    savedPlans: PreviewFixtures.savedPlans,
                    archivedPlans: PreviewFixtures.archivedPlans,
                    onNewPlan: {},
                    onOpenPlan: { _ in },
                    onArchivePlan: { _ in }
                )
            }
            .previewDisplayName("Plans")

            ScreenPreviewShell(tab: .home, route: .startWorkout) {
                StartWorkoutView(day: SampleData.activePlan.days[0], onStart: {})
            }
            .previewDisplayName("Start Workout")

            ScreenPreviewShell(tab: .workout, route: .logWorkout) {
                LogWorkoutView(
                    exercise: PreviewFixtures.logExercise,
                    exerciseIndex: 1,
                    exerciseCount: 5,
                    onExerciseComplete: { _ in }
                )
            }
            .previewDisplayName("Log Workout")

            ScreenPreviewShell(tab: .workout, route: .workoutComplete) {
                WorkoutCompleteView(workout: PreviewFixtures.loggedWorkout, onFinish: {})
            }
            .previewDisplayName("Workout Complete")

            ScreenPreviewShell(tab: .plans, route: .createPlan) {
                CreatePlanView(onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Frequency")

            ScreenPreviewShell(tab: .plans, route: .createPlan) {
                CreatePlanView(initialStage: .search, searchQuery: "Inclin", onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Search")

            ScreenPreviewShell(tab: .plans, route: .createPlan) {
                CreatePlanView(initialStage: .composer, onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Empty Day")

            ScreenPreviewShell(tab: .plans, route: .createPlan) {
                CreatePlanView(initialStage: .finalReview, onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Review")

            ScreenPreviewShell(tab: .plans, route: .createPlan) {
                CreatePlanView(initialStage: .activatePrompt, onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Activation")
        }
    }
}
#endif
