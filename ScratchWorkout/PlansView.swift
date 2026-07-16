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
                        .foregroundStyle(AppColor.secondaryText)
                        .tracking(0.7)
                        .padding(.top, 24)

                    Button {
                        Haptics.tap(.medium)
                        onOpenPlan(activePlan)
                    } label: {
                        FeaturedPlanCard(plan: activePlan)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)

                    SectionTitle(text: "Saved plans")
                        .padding(.top, 32)

                    VStack(spacing: 0) {
                        ForEach(displaySavedPlans) { plan in
                            SwipeableEditorialPlanRow(
                                plan: plan,
                                onOpen: { onOpenPlan(plan) },
                                onArchive: { onArchivePlan(plan) }
                            )
                        }
                    }
                    .padding(.top, 6)

                    if !archivedPlans.isEmpty {
                        CollapsibleSectionHeader(
                            title: "Archived plans",
                            isExpanded: isArchivedExpanded,
                            action: {
                                withAnimation(.snappy(duration: 0.24, extraBounce: 0)) {
                                    isArchivedExpanded.toggle()
                                }
                            }
                        )
                        .padding(.top, 28)

                        if isArchivedExpanded {
                            VStack(spacing: 0) {
                                ForEach(archivedPlans) { plan in
                                    Button {
                                        Haptics.tap(.medium)
                                        onOpenPlan(plan)
                                    } label: {
                                        EditorialPlanListRow(plan: plan)
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityLabel("Open archived plan \(plan.name)")
                                }
                            }
                            .padding(.top, 6)
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

private struct FeaturedPlanCard: View {
    var plan: WorkoutPlan

    private var exerciseCount: Int {
        plan.days.reduce(0) { $0 + $1.exercises.count }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(plan.name)
                        .font(.inter(size: 30, weight: .bold, relativeTo: .title))
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(2)

                    Text(plan.daysPerWeek == 1 ? "1 day per week" : "\(plan.daysPerWeek) days per week")
                        .font(AppFont.subheading)
                        .foregroundStyle(AppColor.secondaryText)
                }

                Spacer(minLength: 12)

                Image(systemName: "arrow.up.right")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(AppColor.base)
                    .frame(width: 44, height: 44)
                    .background(AppColor.accent, in: Circle())
            }

            HStack(spacing: 24) {
                PlanMetric(value: "\(plan.days.count)", label: plan.days.count == 1 ? "day" : "days")
                PlanMetric(value: "\(exerciseCount)", label: exerciseCount == 1 ? "exercise" : "exercises")

                Spacer(minLength: 0)

                Text("Created \(plan.createdAt)")
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 170, alignment: .leading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(AppColor.accent)
                .frame(width: 4)
                .padding(.vertical, 20)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct PlanMetric: View {
    var value: String
    var label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(AppFont.h1)
                .foregroundStyle(AppColor.primaryText)

            Text(label)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
        }
    }
}

private struct EditorialPlanListRow: View {
    var plan: WorkoutPlan

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(plan.name)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)

                Text("\(plan.daysPerWeek) \(plan.daysPerWeek == 1 ? "day" : "days") per week · \(plan.createdAt)")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }

            Spacer(minLength: 12)

            Image(systemName: "chevron.right")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(AppColor.secondaryText)
                .frame(width: 44, height: 44)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 72)
        .background(AppColor.base)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) {
            Rectangle().fill(AppColor.border).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct SwipeableEditorialPlanRow: View {
    var plan: WorkoutPlan
    var onOpen: () -> Void
    var onArchive: () -> Void

    @State private var horizontalOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            if horizontalOffset < -1 {
                AppColor.destructive.opacity(0.22)
                    .overlay(alignment: .trailing) {
                        Image(systemName: "archivebox")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(AppColor.primaryText)
                            .padding(.trailing, 16)
                            .opacity(deleteBackgroundOpacity)
                    }
            }

            EditorialPlanListRow(plan: plan)
                .offset(x: horizontalOffset)
                .onTapGesture {
                    if horizontalOffset < -1 {
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.88)) {
                            horizontalOffset = 0
                        }
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
                                withAnimation(.spring(response: 0.2, dampingFraction: 0.88)) {
                                    horizontalOffset = 0
                                }
                                return
                            }

                            Haptics.tap(.medium)
                            onArchive()
                        }
                )
        }
        .clipped()
        .accessibilityLabel("Open \(plan.name)")
        .accessibilityAction(named: "Archive") { onArchive() }
    }

    private var deleteBackgroundOpacity: Double {
        min(1, max(0, Double(-horizontalOffset / 48)))
    }
}
