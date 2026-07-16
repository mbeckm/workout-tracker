import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var nextWorkout: WorkoutDay
    var recentWorkout: LoggedWorkout?
    var workoutsThisMonth: Int
    var workoutDaysThisMonth: Set<Date>
    var accountSession: AuthSession
    var accountSyncState: AccountSyncState
    var onOpenActivePlan: () -> Void
    var onOpenNextWorkout: () -> Void
    var onOpenAccount: () -> Void

    var body: some View {
        AppScreen {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    ScreenTitleBar(title: "Overview") {
                        AccountEntryButton(
                            session: accountSession,
                            syncState: accountSyncState,
                            action: onOpenAccount
                        )
                    }
                    .padding(.top, AppLayout.screenTitleTopPadding)

                    Button {
                        Haptics.tap(.medium)
                        onOpenActivePlan()
                    } label: {
                        HStack(alignment: .center, spacing: 12) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("ACTIVE PLAN")
                                    .font(AppFont.caption.weight(.semibold))
                                    .tracking(1)
                                    .foregroundStyle(AppColor.secondaryText)

                                Text(activePlanTitle)
                                    .font(AppFont.h1)
                                    .foregroundStyle(AppColor.primaryText)
                                    .lineLimit(1)

                                Text("\(activePlan.daysPerWeek) \(activePlan.daysPerWeek == 1 ? "day" : "days") / week")
                                    .font(AppFont.label)
                                    .foregroundStyle(AppColor.secondaryText)
                            }

                            Spacer(minLength: 12)

                            Image(systemName: "chevron.right")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(AppColor.secondaryText)
                                .frame(width: 44, height: 44)
                        }
                        .frame(maxWidth: .infinity, minHeight: 88, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 28)

                    SectionTitle(text: "Next in plan")
                        .padding(.top, 28)

                    PlanRhythmPath(
                        days: activePlan.days,
                        highlightedDayID: nextWorkout.id,
                        maxVisibleDays: 4
                    )
                    .padding(.top, 18)

                    CTAButton(title: "Begin \(nextWorkoutTitle)", action: onOpenNextWorkout)
                        .padding(.top, 4)

                    CompactMonthlyConsistency(
                        workoutCount: workoutsThisMonth,
                        workoutDays: workoutDaysThisMonth
                    )
                    .padding(.top, 32)
                }
                .padding(.bottom, AppLayout.legacyTabBarClearance)
            }
            .scrollDismissesKeyboard(.interactively)
            .padding(.horizontal, 24)
        }
    }

    private var nextWorkoutTitle: String {
        nextWorkout.title
    }

    private var nextWorkoutExerciseCount: Int {
        nextWorkout.exercises.count
    }

    private var activePlanTitle: String {
        activePlan.name == "PPL" ? "Push Pull Legs" : activePlan.name
    }
}

private struct CompactMonthlyConsistency: View {
    var workoutCount: Int
    var workoutDays: Set<Date>
    var referenceDate: Date = Date()

    private let weekdaySymbols = ["M", "T", "W", "T", "F", "S", "S"]
    private let rowSpacing: CGFloat = 8

    private var calendar: Calendar {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        return calendar
    }

    private var dayRows: [[Date?]] {
        guard let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: referenceDate)),
              let daysInMonth = calendar.range(of: .day, in: .month, for: referenceDate)?.count else {
            return []
        }

        let leadingEmptyDays = (calendar.component(.weekday, from: monthStart) + 5) % 7
        var cells: [Date?] = Array(repeating: nil, count: leadingEmptyDays)

        for day in 1...daysInMonth {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: monthStart) {
                cells.append(calendar.startOfDay(for: date))
            }
        }

        while cells.count % 7 != 0 {
            cells.append(nil)
        }

        return stride(from: 0, to: cells.count, by: 7).map { start in
            Array(cells[start..<min(start + 7, cells.count)])
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("This month")
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)

                Spacer(minLength: 12)

                Text("\(workoutCount) \(workoutCount == 1 ? "workout" : "workouts")")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .contentTransition(.numericText())
            }

            VStack(alignment: .leading, spacing: rowSpacing) {
                HStack(spacing: 0) {
                    ForEach(weekdaySymbols.indices, id: \.self) { column in
                        let symbol = weekdaySymbols[column]

                        Text(symbol)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(width: 14)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)

                        if column < weekdaySymbols.count - 1 {
                            Spacer(minLength: 8)
                        }
                    }
                }

                ForEach(dayRows.indices, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { column in
                            if let day = dayRows[row][column] {
                                WorkoutDayDot(hasWorkout: workoutDays.contains(day))
                                    .accessibilityHidden(true)
                            } else {
                                Color.clear
                                    .frame(width: 14, height: 14)
                                    .accessibilityHidden(true)
                            }

                            if column < 6 {
                                Spacer(minLength: 8)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 18)
        .overlay(alignment: .top) { Rectangle().fill(AppColor.border).frame(height: 1) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Workouts this month")
        .accessibilityValue("\(workoutCount) workouts logged")
    }
}

private struct WorkoutDayDot: View {
    var hasWorkout: Bool

    var body: some View {
        Circle()
            .fill(hasWorkout ? AppColor.accent : Color.clear)
            .frame(width: 14, height: 14)
            .overlay {
                if !hasWorkout {
                    Circle()
                        .strokeBorder(AppColor.border, lineWidth: 2)
                }
            }
    }
}
