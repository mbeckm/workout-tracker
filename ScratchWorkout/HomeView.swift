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

                    MonthlyWorkoutSummaryCard(
                        workoutCount: workoutsThisMonth,
                        workoutDays: workoutDaysThisMonth
                    )
                    .padding(.top, 24)

                    SectionTitle(text: "Active Plan")
                        .padding(.top, 36)

                    Button {
                        Haptics.tap(.medium)
                        onOpenActivePlan()
                    } label: {
                        PlanCard(title: activePlanTitle, lines: ["\(activePlan.daysPerWeek) days / week"], date: nil, height: 80)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)

                    SectionTitle(text: "Next in plan")
                        .padding(.top, 24)

                    Button {
                        Haptics.tap(.medium)
                        onOpenNextWorkout()
                    } label: {
                        PlanCard(title: nextWorkoutTitle, lines: ["\(nextWorkoutExerciseCount) Exercises"], date: nil, height: 80)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)
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

private struct MonthlyWorkoutSummaryCard: View {
    var workoutCount: Int
    var workoutDays: Set<Date>
    var referenceDate: Date = Date()

    private let weekdaySymbols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let rowSpacing: CGFloat = 16

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
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(workoutCount)")
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .contentTransition(.numericText())

                Text(workoutCount == 1 ? "Workout this month" : "Workouts this month")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }

            Rectangle()
                .fill(AppColor.border)
                .frame(height: 1)

            VStack(alignment: .leading, spacing: rowSpacing) {
                HStack(spacing: 0) {
                    ForEach(weekdaySymbols.indices, id: \.self) { column in
                        let symbol = weekdaySymbols[column]

                        Text(symbol)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(width: 24)
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
                                    .frame(width: 24, height: 24)
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
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(
                    LinearGradient(
                        stops: [
                            .init(color: AppColor.base, location: 0.85),
                            .init(color: AppColor.surface1, location: 1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
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
            .frame(width: 24, height: 24)
            .overlay {
                if !hasWorkout {
                    Circle()
                        .strokeBorder(AppColor.border, lineWidth: 4)
                }
            }
    }
}
