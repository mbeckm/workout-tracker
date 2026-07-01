import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
    var nextWorkout: WorkoutDay
    var workoutsThisMonth: Int
    var onOpenActivePlan: () -> Void
    var onOpenNextWorkout: () -> Void

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
