import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var nextWorkout: WorkoutDay
    var recentWorkout: LoggedWorkout?
    var workoutDaysThisMonth: Set<Date>
    var accountSession: AuthSession
    var accountSyncState: AccountSyncState
    var onOpenActivePlan: () -> Void
    var onOpenNextWorkout: () -> Void
    var onOpenAccount: () -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 12) {
                    Text("Overview")
                        .font(AppFont.display)
                        .lineLimit(1)

                    Spacer(minLength: 12)

                    AccountEntryButton(
                        session: accountSession,
                        syncState: accountSyncState,
                        action: onOpenAccount
                    )
                }
                .padding(.top, 66)

                SectionTitle(text: "Workouts this month")
                    .padding(.top, 24)

                MonthlyWorkoutCalendar(workoutDays: workoutDaysThisMonth)
                    .padding(.top, 12)

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
                    PlanCard(title: nextWorkoutTitle, lines: ["\(nextWorkoutExerciseCount) Exercises"], date: "Mon., 11.08.", height: 80)
                }
                .buttonStyle(.plain)
                .padding(.top, 12)

                Spacer(minLength: 96)
            }
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

private struct MonthlyWorkoutCalendar: View {
    var workoutDays: Set<Date>
    var referenceDate: Date = Date()

    private let weekdaySymbols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let columnSpacing: CGFloat = 19
    private let rowSpacing: CGFloat = 16
    private let dotSize: CGFloat = 24

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
        VStack(alignment: .leading, spacing: rowSpacing) {
            HStack(spacing: columnSpacing) {
                ForEach(weekdaySymbols, id: \.self) { symbol in
                    Text(symbol)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: dotSize)
                        .multilineTextAlignment(.center)
                }
            }

            ForEach(dayRows.indices, id: \.self) { row in
                HStack(spacing: columnSpacing) {
                    ForEach(0..<7, id: \.self) { column in
                        if let day = dayRows[row][column] {
                            WorkoutDayDot(hasWorkout: workoutDays.contains(day))
                        } else {
                            Color.clear
                                .frame(width: dotSize, height: dotSize)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Workouts this month")
        .accessibilityValue("\(workoutDays.count) workouts logged")
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
