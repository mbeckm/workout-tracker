import SwiftUI

struct RootView: View {
    @State private var selectedTab: AppTab = .home
    @State private var route: AppRoute?
    @State private var store = WorkoutStore()

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
            StartWorkoutView(onStart: {
                withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
                    route = .logWorkout
                }
            })
        case .logWorkout:
            LogWorkoutView(onComplete: { sets in
                store.completeWorkout(sets: sets)
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    route = .workoutComplete
                }
            })
        case .workoutComplete:
            WorkoutCompleteView(onFinish: {
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
                HomeView(activePlan: store.activePlan, onOpenWorkout: {
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
                StartWorkoutView(onStart: {
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
