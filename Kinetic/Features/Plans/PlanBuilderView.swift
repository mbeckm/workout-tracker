import SwiftData
import SwiftUI

struct PlanBuilderView: View {
	@Environment(\.dismiss) private var dismiss
	@Environment(\.modelContext) private var modelContext

	private let plan: WorkoutPlan?
	@State private var draft: PlanDraft
	@State private var saveError: String?

	init(plan: WorkoutPlan? = nil) {
		self.plan = plan
		_draft = State(initialValue: PlanDraft(plan: plan))
	}

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 18) {
				header
				planDetails
				daysEditor
			}
			.padding(.horizontal, 20)
			.padding(.top, 16)
			.padding(.bottom, 104)
		}
		.kineticScreenBackground()
		.navigationTitle(plan == nil ? "New Plan" : "Edit Plan")
		.navigationBarTitleDisplayMode(.inline)
		.scrollDismissesKeyboard(.interactively)
		.safeAreaInset(edge: .bottom) {
			BottomActionBar {
				Button {
					savePlan()
				} label: {
					Label(plan == nil ? "Save plan" : "Save changes", systemImage: "checkmark")
						.font(.headline)
						.frame(maxWidth: .infinity)
						.frame(height: 56)
				}
				.buttonStyle(.borderedProminent)
				.tint(draft.canSave ? KineticTheme.ink : KineticTheme.slate)
				.disabled(!draft.canSave)
			}
		}
		.alert("Plan not saved", isPresented: Binding(
			get: { saveError != nil },
			set: { if !$0 { saveError = nil } }
		)) {
			Button("OK", role: .cancel) {}
		} message: {
			Text(saveError ?? "")
		}
	}

	private var header: some View {
		VStack(alignment: .leading, spacing: 8) {
			Text(plan == nil ? "Build your week" : "Tune the plan")
				.font(.system(size: 30, weight: .semibold))
				.foregroundStyle(KineticTheme.ink)
			Text("Use free-text exercises for now. Add target sets and reps for each training day.")
				.font(.subheadline)
				.foregroundStyle(KineticTheme.slate)
		}
		.frame(maxWidth: .infinity, alignment: .leading)
	}

	private var planDetails: some View {
		VStack(alignment: .leading, spacing: 14) {
			Text("Plan")
				.font(.headline)
				.foregroundStyle(KineticTheme.ink)

			VStack(alignment: .leading, spacing: 8) {
				Text("Name")
					.font(.caption.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
				TextField("Upper Strength", text: $draft.name)
					.textInputAutocapitalization(.words)
					.padding(12)
					.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
					.overlay {
						RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
							.stroke(KineticTheme.line, lineWidth: 1)
					}
			}

			Stepper(value: Binding(
				get: { draft.daysPerWeek },
				set: { draft.resizeDays(to: $0) }
			), in: 1...7) {
				VStack(alignment: .leading, spacing: 4) {
					Text("Training days")
						.font(.subheadline.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
					Text("\(draft.daysPerWeek) days per week")
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
				}
			}
			.padding(12)
			.background(KineticTheme.mist.opacity(0.8), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		}
		.padding(16)
		.kineticCard()
	}

	private var daysEditor: some View {
		VStack(alignment: .leading, spacing: 14) {
			Text("Training days")
				.font(.headline)
				.foregroundStyle(KineticTheme.ink)

			ForEach(draft.days.indices, id: \.self) { index in
				DayDraftEditor(day: $draft.days[index], ordinal: index + 1)
			}
		}
	}

	private func savePlan() {
		guard draft.canSave else {
			HapticManager.shared.fire(.warning)
			return
		}

		let targetPlan = plan ?? WorkoutPlan(name: draft.name.trimmed, daysPerWeek: draft.daysPerWeek)
		targetPlan.name = draft.name.trimmed
		targetPlan.daysPerWeek = draft.daysPerWeek
		targetPlan.updatedAt = .now

		let existingDays = targetPlan.days
		targetPlan.days.removeAll()
		existingDays.forEach { modelContext.delete($0) }

		for (dayIndex, dayDraft) in draft.cleanedDays.enumerated() {
			let day = TrainingDay(index: dayIndex, label: dayDraft.label.trimmed)
			day.exercises = dayDraft.exercises.enumerated().map { exerciseIndex, exerciseDraft in
				PlanExercise(
					order: exerciseIndex,
					name: exerciseDraft.name.trimmed,
					targetSets: exerciseDraft.sets,
					targetReps: exerciseDraft.reps,
					notes: exerciseDraft.notes.trimmed
				)
			}
			targetPlan.days.append(day)
		}

		if plan == nil {
			modelContext.insert(targetPlan)
		}

		do {
			try modelContext.save()
			HapticManager.shared.fire(.success)
			dismiss()
		} catch {
			saveError = "Your plan could not be saved. Please try again."
			HapticManager.shared.fire(.warning)
		}
	}
}

private struct DayDraftEditor: View {
	@Binding var day: DayDraft
	let ordinal: Int

	var body: some View {
		VStack(alignment: .leading, spacing: 14) {
			HStack(alignment: .firstTextBaseline, spacing: 12) {
				Text("Day \(ordinal)")
					.font(.headline)
					.foregroundStyle(KineticTheme.ink)
				Spacer()
				Text("\(day.exercises.count) exercises")
					.font(.caption.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
			}

			TextField("Monday", text: $day.label)
				.textInputAutocapitalization(.words)
				.padding(12)
				.background(KineticTheme.mist.opacity(0.7), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))

			VStack(spacing: 12) {
				ForEach(day.exercises.indices, id: \.self) { exerciseIndex in
					ExerciseDraftRow(
						exercise: $day.exercises[exerciseIndex],
						canDelete: day.exercises.count > 1,
						onDelete: {
							day.exercises.remove(at: exerciseIndex)
							day.reorderExercises()
						}
					)
				}
			}

			Button {
				HapticManager.shared.fire(.selection)
				day.addExercise()
			} label: {
				Label("Add exercise", systemImage: "plus")
					.font(.subheadline.weight(.semibold))
					.frame(maxWidth: .infinity)
					.frame(height: 44)
			}
			.buttonStyle(.bordered)
			.tint(KineticTheme.ink)
		}
		.padding(16)
		.kineticCard()
	}
}

private struct ExerciseDraftRow: View {
	@Binding var exercise: ExerciseDraft
	let canDelete: Bool
	let onDelete: () -> Void

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			HStack(spacing: 10) {
				Image(systemName: "line.3.horizontal")
					.foregroundStyle(KineticTheme.slate)
				TextField("Exercise name", text: $exercise.name)
					.textInputAutocapitalization(.words)
				Button(role: .destructive) {
					onDelete()
				} label: {
					Image(systemName: "trash")
						.frame(width: 32, height: 32)
				}
				.disabled(!canDelete)
				.opacity(canDelete ? 1 : 0.35)
				.accessibilityLabel("Delete exercise")
			}

			HStack(spacing: 10) {
				Stepper(value: $exercise.sets, in: 1...12) {
					Text("\(exercise.sets) sets")
						.font(.subheadline.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
						.monospacedDigit()
				}

				Divider()

				Stepper(value: $exercise.reps, in: 1...50) {
					Text("\(exercise.reps) reps")
						.font(.subheadline.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
						.monospacedDigit()
				}
			}
			.font(.caption)

			TextField("Notes, optional", text: $exercise.notes)
				.textInputAutocapitalization(.sentences)
				.font(.footnote)
				.foregroundStyle(KineticTheme.slate)
		}
		.padding(12)
		.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
	}
}

private struct PlanDraft {
	var name: String
	var daysPerWeek: Int
	var days: [DayDraft]

	init(plan: WorkoutPlan?) {
		if let plan {
			name = plan.name
			daysPerWeek = max(1, min(7, plan.daysPerWeek))
			days = plan.orderedDays.map(DayDraft.init(day:))
			if days.isEmpty {
				days = Self.defaultDays(count: daysPerWeek)
			}
			resizeDays(to: daysPerWeek)
		} else {
			name = ""
			daysPerWeek = 3
			days = Self.defaultDays(count: 3)
		}
	}

	var cleanedDays: [DayDraft] {
		days.map { day in
			var cleanDay = day
			cleanDay.label = cleanDay.label.trimmed
			cleanDay.exercises = cleanDay.exercises
				.map { exercise in
					var cleanExercise = exercise
					cleanExercise.name = cleanExercise.name.trimmed
					cleanExercise.notes = cleanExercise.notes.trimmed
					return cleanExercise
				}
				.filter { !$0.name.isEmpty }
			cleanDay.reorderExercises()
			return cleanDay
		}
	}

	var canSave: Bool {
		!name.trimmed.isEmpty &&
			cleanedDays.count == daysPerWeek &&
			cleanedDays.allSatisfy { day in
				!day.label.trimmed.isEmpty && !day.exercises.isEmpty
			}
	}

	mutating func resizeDays(to newCount: Int) {
		let count = max(1, min(7, newCount))
		daysPerWeek = count

		if days.count < count {
			for index in days.count..<count {
				days.append(DayDraft.defaultDay(index: index))
			}
		} else if days.count > count {
			days.removeLast(days.count - count)
		}
	}

	private static func defaultDays(count: Int) -> [DayDraft] {
		(0..<count).map { DayDraft.defaultDay(index: $0) }
	}
}

private struct DayDraft: Identifiable {
	let id: UUID
	var label: String
	var exercises: [ExerciseDraft]

	init(id: UUID = UUID(), label: String, exercises: [ExerciseDraft]) {
		self.id = id
		self.label = label
		self.exercises = exercises
	}

	init(day: TrainingDay) {
		id = day.id
		label = day.label
		exercises = day.orderedExercises.map(ExerciseDraft.init(exercise:))
		if exercises.isEmpty {
			exercises = [ExerciseDraft(order: 0)]
		}
	}

	static func defaultDay(index: Int) -> DayDraft {
		let labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
		return DayDraft(label: labels[index % labels.count], exercises: [ExerciseDraft(order: 0)])
	}

	mutating func addExercise() {
		exercises.append(ExerciseDraft(order: exercises.count))
	}

	mutating func reorderExercises() {
		for index in exercises.indices {
			exercises[index].order = index
		}
	}
}

private struct ExerciseDraft: Identifiable {
	let id: UUID
	var order: Int
	var name: String
	var sets: Int
	var reps: Int
	var notes: String

	init(id: UUID = UUID(), order: Int, name: String = "", sets: Int = 3, reps: Int = 8, notes: String = "") {
		self.id = id
		self.order = order
		self.name = name
		self.sets = sets
		self.reps = reps
		self.notes = notes
	}

	init(exercise: PlanExercise) {
		id = exercise.id
		order = exercise.order
		name = exercise.name
		sets = exercise.targetSets
		reps = exercise.targetReps
		notes = exercise.notes
	}
}

private extension String {
	var trimmed: String {
		trimmingCharacters(in: .whitespacesAndNewlines)
	}
}

#Preview {
	NavigationStack {
		PlanBuilderView()
	}
	.modelContainer(PreviewData.container())
}
