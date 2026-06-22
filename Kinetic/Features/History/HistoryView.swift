import SwiftData
import SwiftUI

struct HistoryView: View {
	@Query(sort: \WorkoutSession.completedAt, order: .reverse) private var sessions: [WorkoutSession]

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 20) {
				header

				if sessions.isEmpty {
					EmptyHistoryView()
				} else {
					VStack(spacing: 14) {
						ForEach(sessions, id: \.id) { session in
							WorkoutHistoryCard(session: session)
						}
					}
				}
			}
			.padding(.horizontal, 20)
			.padding(.top, 16)
			.padding(.bottom, 32)
		}
		.kineticScreenBackground()
		.navigationTitle("History")
		.navigationBarTitleDisplayMode(.inline)
	}

	private var header: some View {
		VStack(alignment: .leading, spacing: 8) {
			Text("Saved workouts")
				.font(.system(size: 30, weight: .semibold))
				.foregroundStyle(KineticTheme.ink)
			Text("Completed sessions and set entries stay here.")
				.font(.subheadline)
				.foregroundStyle(KineticTheme.slate)
		}
		.frame(maxWidth: .infinity, alignment: .leading)
	}
}

private struct EmptyHistoryView: View {
	var body: some View {
		VStack(alignment: .leading, spacing: 14) {
			Image(systemName: "clock.badge.checkmark")
				.font(.system(size: 32, weight: .semibold))
				.foregroundStyle(KineticTheme.ink)
				.frame(width: 56, height: 56)
				.background(KineticTheme.mist, in: RoundedRectangle(cornerRadius: KineticTheme.cardRadius, style: .continuous))
			Text("No workouts yet")
				.font(.title3.weight(.semibold))
				.foregroundStyle(KineticTheme.ink)
			Text("Finish a workout from one of your plan days and it will be saved here.")
				.font(.body)
				.foregroundStyle(KineticTheme.slate)
		}
		.frame(maxWidth: .infinity, alignment: .leading)
		.padding(18)
		.kineticCard()
	}
}

private struct WorkoutHistoryCard: View {
	let session: WorkoutSession

	var body: some View {
		VStack(alignment: .leading, spacing: 16) {
			HStack(alignment: .top, spacing: 12) {
				VStack(alignment: .leading, spacing: 5) {
					Text(session.dayLabel.uppercased())
						.font(.caption2.weight(.semibold))
						.foregroundStyle(KineticTheme.slate)
					Text(session.planName)
						.font(.title3.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
					Text(session.completedAt.kineticHistoryDate)
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
				}

				Spacer()

				Image(systemName: "checkmark.seal.fill")
					.font(.title3)
					.foregroundStyle(KineticTheme.ink, KineticTheme.volt)
					.symbolRenderingMode(.palette)
			}

			HStack(spacing: 8) {
				MetricChip(title: "Sets", value: "\(session.entries.count)", tint: KineticTheme.volt.opacity(0.7))
				MetricChip(title: "Exercises", value: "\(session.exerciseCount)")
				MetricChip(title: "Volume", value: "\(session.totalVolume.kineticVolumeText) kg")
			}

			VStack(spacing: 10) {
				ForEach(Array(groupedEntries.enumerated()), id: \.offset) { _, group in
					HistoryExerciseGroup(name: group.name, entries: group.entries)
				}
			}
		}
		.padding(16)
		.kineticCard()
	}

	private var groupedEntries: [(name: String, entries: [WorkoutSetEntry])] {
		var groups: [(name: String, entries: [WorkoutSetEntry])] = []
		for entry in session.orderedEntries {
			if let lastIndex = groups.indices.last, groups[lastIndex].name == entry.exerciseName {
				groups[lastIndex].entries.append(entry)
			} else {
				groups.append((name: entry.exerciseName, entries: [entry]))
			}
		}
		return groups
	}
}

private struct HistoryExerciseGroup: View {
	let name: String
	let entries: [WorkoutSetEntry]

	var body: some View {
		VStack(alignment: .leading, spacing: 8) {
			Text(name)
				.font(.subheadline.weight(.semibold))
				.foregroundStyle(KineticTheme.ink)

			VStack(spacing: 6) {
				ForEach(entries, id: \.id) { entry in
					HStack(spacing: 8) {
						Text("Set \(entry.setNumber)")
							.frame(width: 54, alignment: .leading)
						Spacer()
						Text("\(entry.weight.kineticWeightText) kg")
						Text("x")
							.foregroundStyle(KineticTheme.slate)
						Text("\(entry.reps)")
					}
					.font(.footnote.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
					.monospacedDigit()
				}
			}
			.padding(10)
			.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		}
	}
}

#Preview {
	NavigationStack {
		HistoryView()
	}
	.modelContainer(PreviewData.container())
}
