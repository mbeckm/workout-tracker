import SwiftUI

struct RootView: View {
    @State private var selectedTab: AppTab = .home
    @State private var route: AppRoute?
    @State private var store = WorkoutStore()
    @State private var completedWorkout: LoggedWorkout?

    var body: some View {
        ZStack(alignment: .bottom) {
            currentScreen
                .id(screenID)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.985)),
                    removal: .opacity.combined(with: .scale(scale: 1.015))
                ))

            AppTabBar(selectedTab: $selectedTab, route: route) { tab in
                withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) {
                    selectedTab = tab
                    route = nil
                    completedWorkout = nil
                }
            }
        }
        .background(AppColor.base)
        .ignoresSafeArea()
    }

    @ViewBuilder
    private var currentScreen: some View {
        switch route {
        case .startWorkout:
            StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    route = .logWorkout
                }
            })
        case .logWorkout:
            LogWorkoutView(exercise: store.nextExerciseToLog, onComplete: { sets in
                completedWorkout = store.completeWorkout(day: store.nextWorkoutDay, sets: sets)
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    route = .workoutComplete
                }
            })
        case .workoutComplete:
            WorkoutCompleteView(workout: completedWorkout, onFinish: {
                withAnimation(.spring(response: 0.44, dampingFraction: 0.86)) {
                    selectedTab = .home
                    route = nil
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
                HomeView(activePlan: store.activePlan, recentWorkout: store.recentWorkout, workoutsThisMonth: store.workoutsThisMonth, onOpenWorkout: {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                        route = .startWorkout
                    }
                })
            case .plans:
                PlansView(activePlan: store.activePlan, savedPlans: store.savedPlans, onNewPlan: {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                        route = .createPlan
                    }
                })
            case .workout:
                StartWorkoutView(day: store.nextWorkoutDay, onStart: {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                        route = .logWorkout
                    }
                })
            }
        }
    }

    private var screenID: String {
        if let route {
            return "route-\(String(describing: route))"
        }
        return "tab-\(String(describing: selectedTab))"
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
        WorkoutPlan(name: "Batman", daysPerWeek: 3, createdAt: "12.02.26", days: SampleData.activePlan.days),
        WorkoutPlan(name: "Superman", daysPerWeek: 3, createdAt: "12.02.26", days: SampleData.activePlan.days),
        WorkoutPlan(name: "Leg Focus", daysPerWeek: 3, createdAt: "12.02.26", days: SampleData.activePlan.days)
    ]

    static let loggedWorkout = LoggedWorkout(
        title: "Push",
        completedAt: Date(timeIntervalSince1970: 1_783_000_000),
        durationMinutes: 93,
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
                    recentWorkout: nil,
                    workoutsThisMonth: 14,
                    onOpenWorkout: {}
                )
            }
            .previewDisplayName("Overview")

            ScreenPreviewShell(tab: .plans) {
                PlansView(
                    activePlan: SampleData.activePlan,
                    savedPlans: PreviewFixtures.savedPlans,
                    onNewPlan: {}
                )
            }
            .previewDisplayName("Plans")

            ScreenPreviewShell(tab: .home, route: .startWorkout) {
                StartWorkoutView(day: SampleData.activePlan.days[0], onStart: {})
            }
            .previewDisplayName("Start Workout")

            ScreenPreviewShell(tab: .workout, route: .logWorkout) {
                LogWorkoutView(exercise: PreviewFixtures.logExercise, onComplete: { _ in })
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
                CreatePlanView(initialStage: .configureSets, onFinish: { _, _ in })
            }
            .previewDisplayName("Create Plan - Configure")

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
