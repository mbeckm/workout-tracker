import SwiftUI

struct HomeView: View {
    var activePlan: WorkoutPlan
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

                MetricLabel(value: "14", label: "workouts this month")
                    .padding(.top, 24)

                HeatmapGrid(rows: heatmap)
                    .padding(.top, 12)

                SectionTitle(text: "Last")
                    .padding(.top, 36)

                PlanCard(title: "Pull", lines: ["8 Exercises", "1h 22min"], date: "yesterday")
                    .padding(.top, 12)

                SectionTitle(text: "Next in plan")
                    .padding(.top, 42)

                Button {
                    Haptics.tap(.medium)
                    onOpenWorkout()
                } label: {
                    PlanCard(title: activePlan.days.first?.title ?? "Push", lines: ["8 Exercises"], date: "Mon., 11.08.", height: 80)
                }
                .buttonStyle(.plain)

                Spacer(minLength: 96)
            }
            .padding(.horizontal, 24)
        }
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

