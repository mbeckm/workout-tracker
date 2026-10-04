import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var nextWorkout: WorkoutDay
    var recentWorkout: LoggedWorkout?
    var workoutsThisMonth: Int
    var workoutDaysThisMonth: Set<Date>
    var accountSession: AuthSession
    var accountSyncState: AccountSyncState
    var onViewPlan: () -> Void
    var onStartNextWorkout: () -> Void
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
                    .padding(.top, 18)

                    SectionTitle(text: "Next in plan")
                        .padding(.top, 24)

                    NextWorkoutCard(
                        workout: nextWorkout,
                        planName: activePlanTitle,
                        onStart: onStartNextWorkout,
                        onViewPlan: onViewPlan
                    )
                    .padding(.top, 12)
                }
                .padding(.bottom, AppLayout.legacyTabBarClearance)
            }
            .scrollDismissesKeyboard(.interactively)
            .padding(.horizontal, 24)
        }
    }

    private var activePlanTitle: String {
        activePlan.name == "PPL" ? "Push Pull Legs" : activePlan.name
    }
}

private struct NextWorkoutCard: View {
    var workout: WorkoutDay
    var planName: String
    var onStart: () -> Void
    var onViewPlan: () -> Void

    var body: some View {
        CardShell {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(workout.title)
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)

                    Spacer(minLength: 8)

                    Text(exerciseCountLabel)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }

                exercisePreviewStrip
                    .padding(.top, 12)

                Button {
                    Haptics.tap(.medium)
                    onStart()
                } label: {
                    Text("Start this Workout")
                        .font(AppFont.h1)
                        .foregroundStyle(AppColor.base)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(AppPressFeedbackStyle())
                .disabled(workout.exercises.isEmpty)
                .opacity(workout.exercises.isEmpty ? 0.45 : 1)
                .padding(.top, 16)

                Button {
                    Haptics.tap()
                    onViewPlan()
                } label: {
                    Text("View Plan")
                        .font(AppFont.body)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(AppPressFeedbackStyle())
                .accessibilityLabel("View \(planName)")
                .padding(.top, 4)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Next workout, \(workout.title)")
    }

    @ViewBuilder
    private var exercisePreviewStrip: some View {
        if workout.exercises.isEmpty {
            HStack(spacing: 8) {
                Image(systemName: "rectangle.stack.badge.plus")
                    .foregroundStyle(AppColor.secondaryText)

                Text("No exercises yet")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .overlay {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(AppColor.border, lineWidth: 1)
            }
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 8) {
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { index, exercise in
                        ExercisePreviewThumbnail(
                            exercise: exercise,
                            position: index + 1,
                            exerciseCount: workout.exercises.count
                        )
                    }
                }
                .scrollTargetLayout()
            }
            .frame(height: 64)
            .scrollTargetBehavior(.viewAligned)
            .accessibilityLabel("Exercises in next workout")
        }
    }

    private var exerciseCountLabel: String {
        let count = workout.exercises.count
        return "\(count) \(count == 1 ? "exercise" : "exercises")"
    }
}

private struct ExercisePreviewThumbnail: View {
    var exercise: ExercisePrescription
    var position: Int
    var exerciseCount: Int

    var body: some View {
        ExerciseArtwork(exercise: exercise, cornerRadius: 8)
            .frame(width: 64, height: 64)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Exercise \(position) of \(exerciseCount), \(exercise.name)")
            .accessibilityValue("\(exercise.planVolumeSummary), \(exercise.prescriptionSummary)")
    }
}

private struct MonthlyWorkoutSummaryCard: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var workoutCount: Int
    var workoutDays: Set<Date>
    var referenceDate: Date = Date()

    private let weekdaySymbols = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let compactWeekdaySymbols = ["M", "T", "W", "T", "F", "S", "S"]
    private let rowSpacing: CGFloat = 16

    private var displayedWeekdaySymbols: [String] {
        dynamicTypeSize.isAccessibilitySize ? compactWeekdaySymbols : weekdaySymbols
    }

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
                    .monospacedDigit()
                    .foregroundStyle(AppColor.primaryText)
                    .contentTransition(.numericText())

                Text(workoutCount == 1 ? "Workout this month" : "Workouts this month")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }

            Rectangle()
                .fill(AppColor.border)
                .frame(height: 1)

            VStack(alignment: .leading, spacing: rowSpacing) {
                HStack(spacing: 0) {
                    ForEach(displayedWeekdaySymbols.indices, id: \.self) { column in
                        let symbol = displayedWeekdaySymbols[column]

                        Text(symbol)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(width: 24)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)

                        if column < displayedWeekdaySymbols.count - 1 {
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
                .stroke(AppColor.surfaceOutline, lineWidth: 1)
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
