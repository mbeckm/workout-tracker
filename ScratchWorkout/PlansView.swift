import SwiftUI

struct PlansView: View {
    var activePlan: WorkoutPlan
    var nextWorkoutID: UUID? = nil
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

                    SectionTitle(text: "Active Plan")
                        .padding(.top, 24)

                    Button {
                        Haptics.tap(.medium)
                        onOpenPlan(activePlan)
                    } label: {
                        VStack(alignment: .leading, spacing: 18) {
                            HStack(alignment: .firstTextBaseline, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(activePlan.name)
                                        .font(AppFont.h1)
                                        .foregroundStyle(AppColor.primaryText)
                                        .lineLimit(1)

                                    Text("\(activePlan.daysPerWeek) \(activePlan.daysPerWeek == 1 ? "day" : "days") per week")
                                        .font(AppFont.label)
                                        .foregroundStyle(AppColor.secondaryText)
                                }

                                Spacer(minLength: 12)

                                Image(systemName: "chevron.right")
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundStyle(AppColor.secondaryText)
                                    .frame(width: 44, height: 44)
                            }

                            PlanRhythmPath(
                                days: activePlan.days,
                                highlightedDayID: nextWorkoutID,
                                maxVisibleDays: 4
                            )
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(AppColor.border, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)

                    SectionTitle(text: "Saved Plans")
                        .padding(.top, 24)

                    VStack(spacing: 12) {
                        ForEach(displaySavedPlans) { plan in
                            SwipeablePlanRow(
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
                                withAnimation(.snappy(duration: 0.24, extraBounce: 0)) {
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
                                        PlanListRow(plan: plan)
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

private struct PlanListRow: View {
    var plan: WorkoutPlan

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(plan.name)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)

                Text("\(plan.daysPerWeek) \(plan.daysPerWeek == 1 ? "day" : "days") per week · \(plan.createdAt)")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }

            Spacer(minLength: 12)

            Image(systemName: "chevron.right")
                .font(.system(size: 18, weight: .regular))
                .foregroundStyle(AppColor.secondaryText)
                .frame(width: 44, height: 44)
        }
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppColor.border).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct SwipeablePlanRow: View {
    var plan: WorkoutPlan
    var onOpen: () -> Void
    var onDelete: () -> Void

    @State private var horizontalOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            if horizontalOffset < -1 {
                AppColor.destructive.opacity(0.2)
                    .overlay(alignment: .trailing) {
                        Image(systemName: "archivebox")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(AppColor.primaryText)
                            .padding(.trailing, 18)
                    }
            }

            PlanListRow(plan: plan)
                .background(AppColor.base)
                .offset(x: horizontalOffset)
                .onTapGesture {
                    if horizontalOffset < -1 {
                        withAnimation(.snappy(duration: 0.2, extraBounce: 0)) { horizontalOffset = 0 }
                    } else {
                        Haptics.tap(.medium)
                        onOpen()
                    }
                }
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            guard abs(value.translation.width) > abs(value.translation.height) else { return }
                            horizontalOffset = min(0, value.translation.width)
                        }
                        .onEnded { value in
                            guard value.translation.width < -90 else {
                                withAnimation(.snappy(duration: 0.2, extraBounce: 0)) { horizontalOffset = 0 }
                                return
                            }
                            Haptics.tap(.medium)
                            onDelete()
                        }
                )
        }
        .frame(maxWidth: .infinity, minHeight: 68)
        .clipped()
        .accessibilityLabel("Open \(plan.name)")
        .accessibilityAction(named: "Archive") { onDelete() }
    }
}
