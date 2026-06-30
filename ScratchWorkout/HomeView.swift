import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var recentWorkout: LoggedWorkout?
    var workoutsThisMonth: Int
    var onOpenWorkout: () -> Void

    private let heatmap = [
        [true, false, true, false, true, true, false],
        [false, true, false, true, false, true, false],
        [false, true, false, true, false, true, false],
        [false, true, false, true, false, true, true]
    ]

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                Text("Overview")
                    .font(AppFont.display)
                    .padding(.top, 66)

                MetricLabel(value: "\(workoutsThisMonth)", label: "workouts this month")
                    .padding(.top, 24)

                HeatmapGrid(rows: heatmap)
                    .padding(.top, 12)

                SectionTitle(text: "Last")
                    .padding(.top, 36)

                PlanCard(title: lastWorkoutTitle, lines: lastWorkoutLines, date: lastWorkoutDate)
                    .padding(.top, 12)

                SectionTitle(text: "Next in plan")
                    .padding(.top, 42)

                Button {
                    Haptics.tap(.medium)
                    onOpenWorkout()
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

    private var nextWorkout: WorkoutDay? {
        activePlan.days.first
    }

    private var nextWorkoutTitle: String {
        nextWorkout?.title ?? "Push"
    }

    private var nextWorkoutExerciseCount: Int {
        nextWorkout?.exercises.count ?? 8
    }

    private var lastWorkoutTitle: String {
        recentWorkout?.title ?? "Pull"
    }

    private var lastWorkoutLines: [String] {
        guard let recentWorkout else {
            return ["8 Exercises", "1h 22min"]
        }

        return [
            "\(recentWorkout.exerciseCount) Exercises",
            formatDuration(minutes: recentWorkout.durationMinutes)
        ]
    }

    private var lastWorkoutDate: String {
        guard let recentWorkout else {
            return "yesterday"
        }

        return Calendar.current.isDateInToday(recentWorkout.completedAt) ? "today" : "recently"
    }

    private func formatDuration(minutes: Int) -> String {
        let hours = minutes / 60
        let remainingMinutes = minutes % 60
        return "\(hours)h \(remainingMinutes)min"
    }
}

private struct HeatmapGrid: View {
    var rows: [[Bool]]

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ForEach(rows.indices, id: \.self) { row in
                HStack(spacing: 24) {
                    ForEach(rows[row].indices, id: \.self) { column in
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .fill(rows[row][column] ? AppColor.accent : AppColor.border)
                            .frame(width: 24, height: 24)
                    }
                }
            }
        }
    }
}
