import SwiftUI

struct PlansView: View {
    var activePlan: WorkoutPlan
    var savedPlans: [WorkoutPlan]
    var onNewPlan: () -> Void
    var onOpenPlan: (WorkoutPlan) -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .topLeading) {
                    Text("Plans")
                        .font(AppFont.display)
                        .padding(.top, 66)

                    HStack {
                        Spacer()

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
                        .padding(.trailing, -4)
                    }
                    .padding(.top, 54)
                }
                .frame(height: 104)

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
                    CTAButton(title: "New Plan", width: 294, action: onNewPlan)
                    Spacer()
                }
                .padding(.bottom, 106)
            }
            .padding(.horizontal, 24)
        }
    }

    private var displaySavedPlans: [WorkoutPlan] {
        savedPlans.filter { $0.id != activePlan.id }
    }
}
