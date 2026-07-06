import SwiftUI

struct PlansView: View {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var archivedPlans: [WorkoutPlan]
    var onNewPlan: () -> Void
    var onOpenPlan: (WorkoutPlan) -> Void
    var onArchivePlan: (WorkoutPlan) -> Void

    @State private var isArchivedExpanded = false

    var body: some View {
        AppScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ScreenTitleBar(title: "Plans") {
                        Button {
                            Haptics.tap(.medium)
                            onNewPlan()
                        } label: {
                            Text("+")
                                .font(.custom("Inter", size: 40, relativeTo: .largeTitle).weight(.bold))
                                .foregroundStyle(.black)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("New plan")
                    }
                    .padding(.top, AppLayout.screenTitleTopPadding)

                    SectionTitle(text: "Active Plan")
                        .padding(.top, 24)

                    Button {
                        Haptics.tap(.medium)
                        onOpenPlan(activePlan)
                    } label: {
                        PlanCard(
                            title: activePlan.name,
                            lines: ["\(activePlan.daysPerWeek) days per week", "Created on \(activePlan.createdAt)"],
                            date: nil
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)

                    SectionTitle(text: "Saved Plans")
                        .padding(.top, 24)

                    VStack(spacing: 12) {
                        ForEach(displaySavedPlans) { plan in
                            SwipeablePlanCard(
                                plan: plan,
                                onOpen: {
                                    onOpenPlan(plan)
                                },
                                onDelete: {
                                    onArchivePlan(plan)
                                }
                            )
                        }
                    }
                    .padding(.top, 12)

                    if !archivedPlans.isEmpty {
                        CollapsibleSectionHeader(
                            title: "Archived Plans",
                            isExpanded: isArchivedExpanded,
                            action: {
                                withAnimation(.spring(response: 0.22, dampingFraction: 0.88)) {
                                    isArchivedExpanded.toggle()
                                }
                            }
                        )
                        .padding(.top, 24)

                        if isArchivedExpanded {
                            VStack(spacing: 12) {
                                ForEach(archivedPlans) { plan in
                                    Button {
                                        Haptics.tap(.medium)
                                        onOpenPlan(plan)
                                    } label: {
                                        PlanCard(
                                            title: plan.name,
                                            lines: ["\(plan.daysPerWeek) days per week", "Created on \(plan.createdAt)"],
                                            date: nil
                                        )
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Open archived plan \(plan.name)")
                                }
                            }
                            .padding(.top, 12)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .floatingBottomChromeScrollPadding()
                .animation(.spring(response: 0.22, dampingFraction: 0.88), value: isArchivedExpanded)
            }
            .floatingBottomChrome {
                CTAButton(title: "New Plan", width: 312, action: onNewPlan)
            }
        }
    }

    private var displaySavedPlans: [WorkoutPlan] {
        savedPlans.filter { $0.id != activePlan.id }
    }
}
