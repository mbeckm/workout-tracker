import SwiftUI

struct RootView: View {
    @State private var selectedTab: AppTab = .home
    @State private var route: AppRoute?
    @State private var store = WorkoutStore()
    @State private var completedWorkout: LoggedWorkout?
    @State private var workoutSessionDay: WorkoutDay?
    @State private var activeExerciseIndex = 0
    @State private var loggedExerciseSets: [[LoggedSet]] = []

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                currentScreen
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)

                AppTabBar(selectedTab: $selectedTab, route: route) { tab in
                    selectedTab = tab
                    route = nil
                    completedWorkout = nil
                    clearWorkoutSession()
                }
                .frame(width: proxy.size.width, height: 82)
                .position(x: proxy.size.width / 2, y: proxy.size.height - 41)
                .zIndex(10)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(AppColor.base)
        }
        .ignoresSafeArea(.container, edges: .bottom)
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch route {
        case .startWorkout:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    beginWorkout()
                }
            })
        case .nextWorkoutPreview:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    beginWorkout(day: store.nextWorkoutDay)
                }
            })
        case .activePlanDetail:
            PlanDetailView(
                plan: store.activePlan,
                allowsEditing: false,
                onStartWorkout: { day in
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                        beginWorkout(day: day)
                    }
                },
                onSave: { plan in
                    store.updatePlan(plan)
                }
            )
        case .planDetail(let planID):
            if let plan = store.plan(for: planID) {
                PlanDetailView(
                    plan: plan,
                    allowsEditing: true,
                    onStartWorkout: { day in
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                            beginWorkout(day: day)
                        }
                    },
                    onSave: { plan in
                        store.updatePlan(plan)
                    }
                )
            } else {
                PlansView(
                    activePlan: store.activePlan,
                    savedPlans: store.savedPlans,
                    onNewPlan: {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .createPlan
                        }
                    },
                    onOpenPlan: { plan in
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .planDetail(plan.id)
                        }
                    }
                )
            }
        case .logWorkout:
            let day = workoutSessionDay ?? store.nextWorkoutDay
            if day.exercises.isEmpty {
                StartWorkoutView(day: day, onStart: {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                        beginWorkout(day: day)
                    }
                })
            } else {
                let index = min(activeExerciseIndex, day.exercises.count - 1)
                LogWorkoutView(
                    exercise: day.exercises[index],
                    exerciseIndex: index,
                    exerciseCount: day.exercises.count,
                    onExerciseComplete: { sets in
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                            completeExercise(sets, in: day, at: index)
                        }
                    }
                )
                .id(day.exercises[index].id)
            }
        case .workoutComplete:
            WorkoutCompleteView(workout: completedWorkout, onFinish: {
                withAnimation(.spring(response: 0.44, dampingFraction: 0.86)) {
                    selectedTab = .home
                    route = nil
                    clearWorkoutSession()
                }
            })
        case .createPlan:
            CreatePlanView { plan, activate in
                store.savePlan(plan, activate: activate)
                withAnimation(.spring(response: 0.44, dampingFraction: 0.86)) {
                    selectedTab = .plans
                    route = nil
                }
            }
        case nil:
            switch selectedTab {
            case .home:
                HomeView(
                    activePlan: store.activePlan,
                    nextWorkout: store.nextWorkoutDay,
                    recentWorkout: store.recentWorkout,
                    workoutsThisMonth: store.workoutsThisMonth,
                    onOpenActivePlan: {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .activePlanDetail
                        }
                    },
                    onOpenNextWorkout: {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .nextWorkoutPreview
                        }
                    }
                )
            case .plans:
                PlansView(
                    activePlan: store.activePlan,
                    savedPlans: store.savedPlans,
                    onNewPlan: {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .createPlan
                        }
                    },
                    onOpenPlan: { plan in
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            route = .planDetail(plan.id)
                        }
                    }
                )
            case .workout:
                StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                        beginWorkout()
                    }
                })
            }
        }
    }

    private func beginWorkout(day selectedDay: WorkoutDay? = nil) {
        let day = selectedDay ?? store.nextWorkoutDay
        workoutSessionDay = day
        activeExerciseIndex = 0
        loggedExerciseSets = Array(repeating: [], count: day.exercises.count)
        route = .logWorkout
    }

    private func completeExercise(_ sets: [LoggedSet], in day: WorkoutDay, at index: Int) {
        if loggedExerciseSets.count != day.exercises.count {
            loggedExerciseSets = Array(repeating: [], count: day.exercises.count)
        }

        loggedExerciseSets[index] = sets

        if index >= day.exercises.count - 1 {
            completedWorkout = store.completeWorkout(day: day, exerciseSets: loggedExerciseSets)
            route = .workoutComplete
        } else {
            activeExerciseIndex = index + 1
        }
    }

    private func clearWorkoutSession() {
        workoutSessionDay = nil
        activeExerciseIndex = 0
        loggedExerciseSets = []
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
        ZStack(alignment: .bottom) {
            content

            AppTabBar(selectedTab: $selectedTab, route: route) { tab in
                selectedTab = tab
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
    static var previews: some View {
        Group {
            ScreenPreviewShell(tab: .home) {
                HomeView(
                    activePlan: SampleData.activePlan,
                    nextWorkout: SampleData.activePlan.days[0],
                    recentWorkout: nil,
                    workoutsThisMonth: 14,
                    onOpenActivePlan: {},
                    onOpenNextWorkout: {}
                )
            }
            .previewDisplayName("Overview")

            ScreenPreviewShell(tab: .home) {
                HomeView(
                    activePlan: SampleData.activePlan,
                    nextWorkout: WorkoutDay(title: "Push", exercises: SampleData.pushExercises),
                    recentWorkout: PreviewFixtures.recentWorkout,
                    workoutsThisMonth: 14,
                    onOpenActivePlan: {},
                    onOpenNextWorkout: {}
                )
            }
            .previewDisplayName("Overview - Recent")

            ScreenPreviewShell(tab: .plans) {
                PlansView(
                    activePlan: SampleData.activePlan,
                    savedPlans: PreviewFixtures.savedPlans,
                    onNewPlan: {},
                    onOpenPlan: { _ in }
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
                CreatePlanView(initialStage: .search, onFinish: { _, _ in })
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
