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
                    ScreenTitle(title: "Plans")
                    .padding(.top, AppLayout.screenTitleTopPadding)

                    Text("ACTIVE PLAN")
                        .font(AppFont.label)
                        .tracking(1.2)
                        .foregroundStyle(AppColor.secondaryText)
                        .padding(.top, 28)

                    Button {
                        Haptics.tap(.medium)
                        onOpenPlan(activePlan)
                    } label: {
                        ActivePlanFeature(plan: activePlan)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)

                    Text("SAVED PLANS")
                        .font(AppFont.label)
                        .tracking(1.2)
                        .foregroundStyle(AppColor.secondaryText)
                        .padding(.top, 28)

                    VStack(spacing: 0) {
                        ForEach(Array(displaySavedPlans.enumerated()), id: \.element.id) { index, plan in
                            if index > 0 {
                                FlatRowDivider(leadingInset: 0)
                            }

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
                    .padding(.top, 6)

                    if !archivedPlans.isEmpty {
                        CollapsibleSectionHeader(
                            title: "Archived Plans",
                            isExpanded: isArchivedExpanded,
                            action: {
                                withAnimation(.snappy(duration: 0.24, extraBounce: 0)) {
                                    isArchivedExpanded.toggle()
                                }
                            }
                        )
                        .padding(.top, 24)

                        if isArchivedExpanded {
                            VStack(spacing: 0) {
                                ForEach(Array(archivedPlans.enumerated()), id: \.element.id) { index, plan in
                                    if index > 0 {
                                        FlatRowDivider(leadingInset: 0)
                                    }

                                    Button {
                                        Haptics.tap(.medium)
                                        onOpenPlan(plan)
                                    } label: {
                                        PlanFlatRow(plan: plan)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Open archived plan \(plan.name)")
                                }
                            }
                            .padding(.top, 12)
                            .transition(.opacity.combined(with: .offset(y: -8)))
                        }
                    }

                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 24)
                .floatingBottomChromeScrollPadding()
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

private struct ActivePlanFeature: View {
    var plan: WorkoutPlan

    private var exerciseCount: Int {
        plan.days.reduce(0) { $0 + $1.exercises.count }
    }

    var body: some View {
        SemanticSurface(style: .feature) {
            HStack(alignment: .center, spacing: 16) {
                AccentRail(height: 82)

                VStack(alignment: .leading, spacing: 8) {
                    Text(plan.name)
                        .font(AppFont.h1)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)

                    Text("\(plan.daysPerWeek) \(plan.daysPerWeek == 1 ? "day" : "days") per week")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)

                    Text("\(exerciseCount) \(exerciseCount == 1 ? "exercise" : "exercises") across the plan")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                }

                Spacer(minLength: 8)

                Image(systemName: "arrow.right")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(AppColor.accent)
                    .frame(width: 44, height: 44)
            }
            .padding(16)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Active plan, \(plan.name)")
    }
}
