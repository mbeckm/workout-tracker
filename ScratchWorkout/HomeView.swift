import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var nextWorkout: WorkoutDay
    var recentWorkout: LoggedWorkout?
    var workoutsThisWeek: Int
    var workoutDaysThisWeek: Set<Date>
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

                    WeeklyConsistencyStrip(
                        workoutCount: workoutsThisWeek,
                        workoutDays: workoutDaysThisWeek
                    )
                    .padding(.top, 28)

                    NextWorkoutInstrument(
                        day: nextWorkout,
                        action: onOpenNextWorkout
                    )
                    .padding(.top, 28)

                    Text("TRAINING CONTEXT")
                        .font(AppFont.label)
                        .tracking(1.2)
                        .foregroundStyle(AppColor.secondaryText)
                        .padding(.top, 28)

                    VStack(spacing: 0) {
                        Button {
                            Haptics.tap(.medium)
                            onOpenActivePlan()
                        } label: {
                            FlatInfoRow(
                                symbol: "calendar",
                                title: activePlanTitle,
                                subtitle: String(activePlan.daysPerWeek) + " " + (activePlan.daysPerWeek == 1 ? "day" : "days") + " per week",
                                showsChevron: true
                            )
                        }
                        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))

                        if let recentWorkout {
                            FlatRowDivider()

                            FlatInfoRow(
                                symbol: "clock.arrow.circlepath",
                                title: recentWorkout.title,
                                subtitle: recentWorkoutSubtitle(recentWorkout),
                                value: String(recentWorkout.setCount) + " sets"
                            )
                        }
                    }
                    .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, AppLayout.legacyTabBarClearance)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var activePlanTitle: String {
        activePlan.name == "PPL" ? "Push Pull Legs" : activePlan.name
    }

    private func recentWorkoutSubtitle(_ workout: LoggedWorkout) -> String {
        String(workout.exerciseCount) + " "
            + (workout.exerciseCount == 1 ? "exercise" : "exercises")
            + " · " + (workout.durationMinutes == 0 ? "<1" : String(workout.durationMinutes)) + " min"
    }
}

private struct NextWorkoutInstrument: View {
    var day: WorkoutDay
    var action: () -> Void

    private var totalSets: Int {
        day.exercises.reduce(0) { $0 + $1.sets }
    }

    private var firstExercise: ExercisePrescription? {
        day.exercises.first
    }

    var body: some View {
        SemanticSurface(style: .feature) {
            HStack(alignment: .top, spacing: 18) {
                AccentRail()

                VStack(alignment: .leading, spacing: 18) {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(day.title)
                            .font(AppFont.display)
                            .foregroundStyle(AppColor.primaryText)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)

                        Spacer(minLength: 8)

                        Text("NEXT")
                            .font(AppFont.label)
                            .tracking(1.2)
                            .foregroundStyle(AppColor.accent)
                    }

                    HStack(spacing: 28) {
                        compactMetric(value: "\(day.exercises.count)", label: day.exercises.count == 1 ? "exercise" : "exercises")
                        compactMetric(value: "\(totalSets)", label: totalSets == 1 ? "set" : "sets")
                    }

                    Rectangle()
                        .fill(AppColor.border)
                        .frame(height: 1)

                    if let firstExercise {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("FIRST UP")
                                .font(AppFont.caption)
                                .tracking(1.1)
                                .foregroundStyle(AppColor.secondaryText)

                            Text(firstExercise.name.planDisplayName)
                                .font(AppFont.subheading)
                                .foregroundStyle(AppColor.primaryText)
                                .lineLimit(2)

                            Text("\(firstExercise.planVolumeSummary) · \(firstExercise.prescriptionSummary)")
                                .font(AppFont.label)
                                .foregroundStyle(AppColor.secondaryText)
                                .lineLimit(2)
                        }
                    } else {
                        Text("Add exercises to this day before starting.")
                            .font(AppFont.body)
                            .foregroundStyle(AppColor.secondaryText)
                    }

                    Button {
                        Haptics.tap(.medium)
                        action()
                    } label: {
                        HStack(spacing: 8) {
                            Text("Open workout")
                                .font(AppFont.h2)

                            Spacer(minLength: 8)

                            Image(systemName: "arrow.right")
                                .font(.system(size: 18, weight: .bold))
                        }
                        .foregroundStyle(AppColor.accent)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(AppColor.surface2.opacity(0.7), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(AppColor.border, lineWidth: 1)
                        }
                    }
                    .buttonStyle(AppPressFeedbackStyle())
                    .accessibilityHint("Shows the exercises before starting")
                }
            }
            .padding(16)
        }
        .accessibilityElement(children: .contain)
    }

    private func compactMetric(value: String, label: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(value)
                .font(AppFont.h1)
                .foregroundStyle(AppColor.primaryText)
                .contentTransition(.numericText())

            Text(label)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct WeeklyConsistencyStrip: View {
    var workoutCount: Int
    var workoutDays: Set<Date>
    var referenceDate = Date()

    private var calendar: Calendar {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        return calendar
    }

    private var weekDates: [Date] {
        guard let interval = calendar.dateInterval(of: .weekOfYear, for: referenceDate) else {
            return []
        }

        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: interval.start).map(calendar.startOfDay(for:))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("THIS WEEK")
                    .font(AppFont.label)
                    .tracking(1.2)
                    .foregroundStyle(AppColor.secondaryText)

                Spacer(minLength: 12)

                Text("\(workoutCount) \(workoutCount == 1 ? "session" : "sessions")")
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.primaryText)
                    .contentTransition(.numericText())
            }

            HStack(spacing: 0) {
                ForEach(Array(weekDates.enumerated()), id: \.element) { index, date in
                    VStack(spacing: 8) {
                        Text(calendar.shortWeekdaySymbols[calendar.component(.weekday, from: date) - 1].prefix(1))
                            .font(AppFont.caption)
                            .foregroundStyle(calendar.isDateInToday(date) ? AppColor.primaryText : AppColor.secondaryText)

                        Circle()
                            .fill(workoutDays.contains(date) ? AppColor.accent : Color.clear)
                            .frame(width: 22, height: 22)
                            .overlay {
                                Circle()
                                    .stroke(workoutDays.contains(date) ? AppColor.accent : AppColor.border, lineWidth: workoutDays.contains(date) ? 0 : 3)
                            }
                    }
                    .frame(maxWidth: .infinity)

                    if index < weekDates.count - 1 {
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Training consistency this week")
        .accessibilityValue("\(workoutCount) \(workoutCount == 1 ? "session" : "sessions") logged")
    }
}
