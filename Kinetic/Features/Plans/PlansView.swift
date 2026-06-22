import SwiftData
import SwiftUI

struct PlansView: View {
	@Query(sort: \WorkoutPlan.updatedAt, order: .reverse) private var plans: [WorkoutPlan]

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 20) {
				header

				if plans.isEmpty {
					EmptyPlansView()
				} else {
					VStack(spacing: 14) {
						ForEach(plans, id: \.id) { plan in
							WorkoutPlanCard(plan: plan)
						}
					}
				}
			}
			.padding(.horizontal, 20)
			.padding(.top, 16)
			.padding(.bottom, 32)
		}
		.kineticScreenBackground()
		.navigationTitle("Plans")
		.navigationBarTitleDisplayMode(.inline)
		.toolbar {
			ToolbarItem(placement: .topBarTrailing) {
				NavigationLink {
					PlanBuilderView()
				} label: {
					Image(systemName: "plus")
						.font(.headline)
				}
				.accessibilityLabel("Create plan")
			}
		}
	}

	private var header: some View {
		VStack(alignment: .leading, spacing: 8) {
			Text("Your training")
				.font(.system(size: 30, weight: .semibold, design: .default))
				.foregroundStyle(KineticTheme.ink)
			Text("Build a weekly plan, then start the day you are training.")
				.font(.subheadline)
				.foregroundStyle(KineticTheme.slate)
		}
		.frame(maxWidth: .infinity, alignment: .leading)
	}
}

private struct EmptyPlansView: View {
	var body: some View {
		VStack(alignment: .leading, spacing: 18) {
			Image(systemName: "figure.strengthtraining.traditional")
				.font(.system(size: 34, weight: .semibold))
				.foregroundStyle(KineticTheme.ink)
				.frame(width: 56, height: 56)
				.background(KineticTheme.volt, in: RoundedRectangle(cornerRadius: KineticTheme.cardRadius, style: .continuous))

			VStack(alignment: .leading, spacing: 8) {
				Text("Create your first plan")
					.font(.title3.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
				Text("Choose how many days you train each week, then add free-text exercises with target sets and reps.")
					.font(.body)
					.foregroundStyle(KineticTheme.slate)
			}

			NavigationLink {
				PlanBuilderView()
			} label: {
				Label("Create plan", systemImage: "plus")
					.font(.headline)
					.frame(maxWidth: .infinity)
					.frame(height: 54)
			}
			.buttonStyle(.borderedProminent)
			.tint(KineticTheme.ink)
			.controlSize(.large)
		}
		.padding(18)
		.kineticCard()
	}
}

private struct WorkoutPlanCard: View {
	let plan: WorkoutPlan

	var body: some View {
		VStack(alignment: .leading, spacing: 16) {
			HStack(alignment: .top, spacing: 12) {
				VStack(alignment: .leading, spacing: 6) {
					Text("\(plan.daysPerWeek)x per week".uppercased())
						.font(.caption2.weight(.semibold))
						.foregroundStyle(KineticTheme.slate)
					Text(plan.name)
						.font(.title3.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
				}

				Spacer()

				NavigationLink {
					PlanBuilderView(plan: plan)
				} label: {
					Image(systemName: "pencil")
						.frame(width: 38, height: 38)
				}
				.buttonStyle(.bordered)
				.tint(KineticTheme.ink)
				.accessibilityLabel("Edit \(plan.name)")
			}

			HStack(spacing: 8) {
				MetricChip(title: "Days", value: "\(plan.orderedDays.count)")
				MetricChip(title: "Exercises", value: "\(plan.exerciseCount)")
				MetricChip(title: "Sets", value: "\(plan.targetSetCount)", tint: KineticTheme.volt.opacity(0.7))
			}

			VStack(spacing: 10) {
				ForEach(plan.orderedDays, id: \.id) { day in
					PlanDayRow(plan: plan, day: day)
				}
			}
		}
		.padding(16)
		.kineticCard()
	}
}

private struct PlanDayRow: View {
	let plan: WorkoutPlan
	let day: TrainingDay

	var body: some View {
		HStack(spacing: 12) {
			VStack(alignment: .leading, spacing: 4) {
				Text(day.label)
					.font(.subheadline.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
				Text("\(day.orderedExercises.count) exercises · \(day.targetSetCount) target sets")
					.font(.caption)
					.foregroundStyle(KineticTheme.slate)
			}

			Spacer()

			NavigationLink {
				WorkoutSessionView(plan: plan, day: day)
			} label: {
				Label("Start", systemImage: "play.fill")
					.labelStyle(.iconOnly)
					.frame(width: 44, height: 44)
			}
			.buttonStyle(.borderedProminent)
			.tint(KineticTheme.volt)
			.foregroundStyle(KineticTheme.ink)
			.disabled(day.orderedExercises.isEmpty)
			.accessibilityLabel("Start \(day.label)")
		}
		.padding(.leading, 12)
		.padding(.vertical, 10)
		.padding(.trailing, 8)
		.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
	}
}

#Preview {
	NavigationStack {
		PlansView()
	}
	.modelContainer(PreviewData.container())
}
