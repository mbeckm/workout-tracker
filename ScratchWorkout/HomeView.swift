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

                    NextWorkoutEditorialHero(
                        workout: nextWorkout,
                        action: onOpenNextWorkout
                    )
                    .padding(.top, 24)

                    MonthlyConsistencyStrip(
                        workoutCount: workoutsThisMonth,
                        workoutDays: workoutDaysThisMonth
                    )
                    .padding(.top, 24)

                    SectionTitle(text: "Active plan")
                        .padding(.top, 32)

                    Button {
                        Haptics.tap(.medium)
                        onOpenActivePlan()
                    } label: {
                        EditorialPlanRow(
                            title: activePlanTitle,
                            detail: "\(activePlan.daysPerWeek) days / week",
                            symbol: "calendar"
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)
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

private struct NextWorkoutEditorialHero: View {
    var workout: WorkoutDay
    var action: () -> Void

    private var exerciseCountText: String {
        let count = workout.exercises.count
        return "\(count) \(count == 1 ? "exercise" : "exercises")"
    }

    private var leadExercise: ExercisePrescription? {
        workout.exercises.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("NEXT WORKOUT")
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
                .tracking(0.7)

            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(workout.title)
                        .font(.inter(size: 38, weight: .bold, relativeTo: .largeTitle))
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(2)
                        .minimumScaleFactor(0.74)

                    Text(exerciseCountText)
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.secondaryText)

                    if let leadExercise {
                        Text(leadExercise.name.planDisplayName)
                            .font(AppFont.label)
                            .foregroundStyle(AppColor.primaryText)
                            .lineLimit(2)
                            .padding(.top, 8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if let leadExercise {
                    ExerciseArtwork(exercise: leadExercise)
                        .frame(width: 116, height: 132)
                        .accessibilityHidden(true)
                }
            }

            Button {
                Haptics.tap(.medium)
                action()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 15, weight: .bold))

                    Text("Start workout")
                        .font(AppFont.h1)
                }
                .foregroundStyle(AppColor.base)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(AppPressFeedbackStyle())
            .accessibilityLabel("Start \(workout.title), \(exerciseCountText)")
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
    }
}

private struct MonthlyConsistencyStrip: View {
    var workoutCount: Int
    var workoutDays: Set<Date>
    var referenceDate: Date = Date()

    private var calendar: Calendar {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        return calendar
    }

    private var recentDays: [Date] {
        let today = calendar.startOfDay(for: referenceDate)
        return (0..<7).compactMap { offset in
            calendar.date(byAdding: .day, value: offset - 6, to: today)
        }
    }

    private var weekdayFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("EEEEE")
        return formatter
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("This month")
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.primaryText)

                Spacer(minLength: 12)

                Text("\(workoutCount) \(workoutCount == 1 ? "workout" : "workouts")")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .contentTransition(.numericText())
            }

            HStack(spacing: 0) {
                ForEach(recentDays, id: \.self) { date in
                    let hasWorkout = workoutDays.contains(calendar.startOfDay(for: date))

                    VStack(spacing: 7) {
                        Text(weekdayFormatter.string(from: date))
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)

                        Circle()
                            .fill(hasWorkout ? AppColor.accent : Color.clear)
                            .frame(width: 18, height: 18)
                            .overlay {
                                if !hasWorkout {
                                    Circle().strokeBorder(AppColor.border, lineWidth: 3)
                                }
                            }
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(date.formatted(date: .complete, time: .omitted))
                    .accessibilityValue(hasWorkout ? "Workout logged" : "No workout logged")
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct EditorialPlanRow: View {
    var title: String
    var detail: String
    var symbol: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(AppColor.primaryText)
                .frame(width: 44, height: 44)
                .background(AppColor.surface1, in: Circle())
                .overlay(Circle().stroke(AppColor.border, lineWidth: 1))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)

                Text(detail)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
            }

            Spacer(minLength: 12)

            Image(systemName: "chevron.right")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(AppColor.secondaryText)
                .frame(width: 44, height: 44)
        }
        .frame(maxWidth: .infinity, minHeight: 64)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(AppColor.border)
                .frame(height: 1)
        }
        .accessibilityElement(children: .combine)
    }
}
