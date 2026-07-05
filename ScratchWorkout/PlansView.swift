import SwiftUI

struct PlansView: View {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var onNewPlan: () -> Void
    var onOpenPlan: (WorkoutPlan) -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 12) {
                    Text("Plans")
                        .font(AppFont.display)
                        .lineLimit(1)

                    Spacer(minLength: 12)

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
                    PlanCard(title: activePlan.name, lines: ["\(activePlan.daysPerWeek) days per week", "Created on \(activePlan.createdAt)"], date: nil)
                }
                .buttonStyle(.plain)
                    .padding(.top, 12)

                SectionTitle(text: "Saved Plans")
                    .padding(.top, 24)

                VStack(spacing: 12) {
                    ForEach(displaySavedPlans.prefix(3)) { plan in
                        Button {
                            Haptics.tap(.medium)
                            onOpenPlan(plan)
                        } label: {
                            PlanCard(title: plan.name, lines: ["\(plan.daysPerWeek) days per week", "Created on \(plan.createdAt)"], date: nil)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Open \(plan.name)")
                    }
                }
                .padding(.top, 12)

                Spacer(minLength: 24)

                HStack {
                    Spacer()
                    CTAButton(title: "New Plan", width: 312, action: onNewPlan)
                    Spacer()
                }
                .appBottomChromePadding()
            }
            .padding(.horizontal, 24)
        }
    }

    private var displaySavedPlans: [WorkoutPlan] {
        savedPlans.filter { $0.id != activePlan.id }
    }
}
