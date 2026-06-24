import SwiftData
import SwiftUI

struct WorkoutSessionView: View {
	@Environment(\.dismiss) private var dismiss
	@Environment(\.modelContext) private var modelContext

	let plan: WorkoutPlan
	let day: TrainingDay

	@State private var startedAt: Date
	@State private var activeSets: [ActiveSetDraft]
	@State private var summary: WorkoutSummary?
	@State private var saveError: String?

	init(plan: WorkoutPlan, day: TrainingDay) {
		self.plan = plan
		self.day = day
		_startedAt = State(initialValue: .now)
		_activeSets = State(initialValue: ActiveSetDraft.makeSets(from: day))
	}

	var body: some View {
		Group {
			if let summary {
				WorkoutCompleteView(summary: summary) {
					dismiss()
				}
			} else {
				activeWorkout
			}
		}
		.kineticScreenBackground()
		.navigationTitle(summary == nil ? "Workout" : "Complete")
		.navigationBarTitleDisplayMode(.inline)
		.navigationBarBackButtonHidden(summary != nil)
		.alert("Workout not saved", isPresented: Binding(
			get: { saveError != nil },
			set: { if !$0 { saveError = nil } }
		)) {
			Button("OK", role: .cancel) {}
		} message: {
			Text(saveError ?? "")
		}
	}

	private var activeWorkout: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 18) {
				workoutHeader

				VStack(spacing: 14) {
					ForEach(day.orderedExercises, id: \.id) { exercise in
						ExerciseLoggingSection(
							exercise: exercise,
							setIDs: activeSets
								.filter { $0.exerciseID == exercise.id }
								.map(\.id),
							activeSets: $activeSets
						)
					}
				}
			}
			.padding(.horizontal, 20)
			.padding(.top, 16)
			.padding(.bottom, 112)
		}
		.scrollDismissesKeyboard(.interactively)
		.safeAreaInset(edge: .bottom) {
			BottomActionBar {
				VStack(spacing: 10) {
					HStack {
						Text("\(loggedSetCount)/\(activeSets.count) sets logged")
							.font(.caption.weight(.semibold))
							.foregroundStyle(KineticTheme.slate)
						Spacer()
						Text("\(currentVolume.kineticVolumeText) kg volume")
							.font(.caption.weight(.semibold))
							.foregroundStyle(KineticTheme.slate)
							.monospacedDigit()
					}

					Button {
						finishWorkout()
					} label: {
						Label("Finish workout", systemImage: "checkmark.circle.fill")
							.font(.headline)
							.frame(maxWidth: .infinity)
							.frame(height: 56)
					}
					.buttonStyle(.borderedProminent)
					.tint(canFinish ? KineticTheme.ink : KineticTheme.slate)
					.disabled(!canFinish)
				}
			}
		}
	}

	private var workoutHeader: some View {
		VStack(alignment: .leading, spacing: 14) {
			VStack(alignment: .leading, spacing: 6) {
				Text(day.label.uppercased())
					.font(.caption.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
				Text(plan.name)
					.font(.system(size: 30, weight: .semibold))
					.foregroundStyle(KineticTheme.ink)
				Text("Log each target set, then finish to save the workout.")
					.font(.subheadline)
					.foregroundStyle(KineticTheme.slate)
			}

			ProgressView(value: Double(loggedSetCount), total: Double(max(activeSets.count, 1)))
				.tint(KineticTheme.volt)

			HStack(spacing: 8) {
				MetricChip(title: "Exercises", value: "\(day.orderedExercises.count)")
				MetricChip(title: "Sets", value: "\(activeSets.count)")
				MetricChip(title: "Logged", value: "\(loggedSetCount)", tint: KineticTheme.volt.opacity(0.7))
			}
		}
		.padding(16)
		.kineticCard()
	}

	private var loggedSetCount: Int {
		activeSets.filter(\.isLogged).count
	}

	private var currentVolume: Double {
		activeSets.reduce(0) { $0 + $1.loggedVolume }
	}

	private var canFinish: Bool {
		!activeSets.isEmpty && activeSets.allSatisfy { $0.isLogged && $0.canLog }
	}

	private func finishWorkout() {
		guard canFinish else {
			HapticManager.shared.fire(.warning)
			return
		}

		let completedAt = Date()
		let session = WorkoutSession(planName: plan.name, dayLabel: day.label, startedAt: startedAt, completedAt: completedAt)
		session.entries = activeSets.sorted().compactMap { activeSet in
			guard let weight = activeSet.weight, let reps = activeSet.reps else {
				return nil
			}
			return WorkoutSetEntry(
				exerciseOrder: activeSet.exerciseOrder,
				exerciseName: activeSet.exerciseName,
				setNumber: activeSet.setNumber,
				targetReps: activeSet.targetReps,
				weight: weight,
				reps: reps,
				completedAt: completedAt
			)
		}

		modelContext.insert(session)

		do {
			try modelContext.save()
			HapticManager.shared.fire(.success)
			summary = WorkoutSummary(
				planName: plan.name,
				dayLabel: day.label,
				setCount: session.entries.count,
				exerciseCount: session.exerciseCount,
				totalVolume: session.totalVolume,
				duration: completedAt.timeIntervalSince(startedAt)
			)
		} catch {
			saveError = "Your workout entries could not be saved. Please try again."
			HapticManager.shared.fire(.warning)
		}
	}
}

private struct ExerciseLoggingSection: View {
	let exercise: PlanExercise
	let setIDs: [UUID]
	@Binding var activeSets: [ActiveSetDraft]

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			HStack(alignment: .top, spacing: 12) {
				VStack(alignment: .leading, spacing: 4) {
					Text(exercise.name)
						.font(.headline)
						.foregroundStyle(KineticTheme.ink)
					Text("\(exercise.targetSets) sets · \(exercise.targetReps) reps target")
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
					Text(exercise.trainingTargetSummary)
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
				}
				Spacer()
				if !exercise.notes.isEmpty {
					Image(systemName: "note.text")
						.foregroundStyle(KineticTheme.steel)
						.accessibilityLabel("Exercise has notes")
				}
			}

			if !exercise.notes.isEmpty {
				Text(exercise.notes)
					.font(.footnote)
					.foregroundStyle(KineticTheme.slate)
					.frame(maxWidth: .infinity, alignment: .leading)
					.padding(10)
					.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
			}

			VStack(spacing: 8) {
				ForEach(setIDs, id: \.self) { setID in
					if let index = activeSets.firstIndex(where: { $0.id == setID }) {
						SetLoggerRow(set: $activeSets[index])
					}
				}
			}
		}
		.padding(16)
		.kineticCard()
	}
}

private struct SetLoggerRow: View {
	@Binding var set: ActiveSetDraft

	var body: some View {
		HStack(spacing: 10) {
			VStack(alignment: .leading, spacing: 2) {
				Text("Set")
					.font(.caption2.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
				Text("\(set.setNumber)")
					.font(.headline.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
					.monospacedDigit()
			}
			.frame(width: 42, alignment: .leading)

			LogInput(label: "kg", text: $set.weightText, keyboardType: .decimalPad)
				.onChange(of: set.weightText) { _, _ in
					if !set.canLog {
						set.isLogged = false
					}
				}

			LogInput(label: "reps", text: $set.repsText, keyboardType: .numberPad)
				.onChange(of: set.repsText) { _, _ in
					if !set.canLog {
						set.isLogged = false
					}
				}

			Button {
				guard set.canLog else {
					HapticManager.shared.fire(.warning)
					return
				}
				set.isLogged.toggle()
				HapticManager.shared.fire(set.isLogged ? .saved : .selection)
			} label: {
				Image(systemName: set.isLogged ? "checkmark.circle.fill" : "circle")
					.font(.title3.weight(.semibold))
					.foregroundStyle(set.isLogged ? KineticTheme.ink : KineticTheme.slate)
					.frame(width: 44, height: 44)
			}
			.accessibilityLabel(set.isLogged ? "Set logged" : "Log set")
		}
		.padding(.leading, 12)
		.padding(.vertical, 8)
		.padding(.trailing, 6)
		.background(set.isLogged ? KineticTheme.volt.opacity(0.72) : KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		.animation(.snappy(duration: 0.18), value: set.isLogged)
	}
}

private struct LogInput: View {
	let label: String
	@Binding var text: String
	let keyboardType: UIKeyboardType

	var body: some View {
		VStack(alignment: .leading, spacing: 3) {
			Text(label.uppercased())
				.font(.caption2.weight(.semibold))
				.foregroundStyle(KineticTheme.slate)
			TextField("0", text: $text)
				.keyboardType(keyboardType)
				.multilineTextAlignment(.leading)
				.font(.headline.weight(.semibold))
				.foregroundStyle(KineticTheme.ink)
				.monospacedDigit()
		}
		.padding(.horizontal, 10)
		.padding(.vertical, 8)
		.frame(maxWidth: .infinity)
		.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		.overlay {
			RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
				.stroke(KineticTheme.line, lineWidth: 1)
		}
	}
}

private struct WorkoutCompleteView: View {
	let summary: WorkoutSummary
	let onDone: () -> Void

	var body: some View {
		VStack(spacing: 24) {
			Spacer(minLength: 36)

			Image(systemName: "checkmark.seal.fill")
				.font(.system(size: 64, weight: .semibold))
				.foregroundStyle(KineticTheme.ink, KineticTheme.volt)
				.symbolRenderingMode(.palette)

			VStack(spacing: 8) {
				Text("Nice work")
					.font(.system(size: 34, weight: .semibold))
					.foregroundStyle(KineticTheme.ink)
				Text("\(summary.dayLabel) is saved to your history.")
					.font(.body)
					.foregroundStyle(KineticTheme.slate)
					.multilineTextAlignment(.center)
			}

			VStack(spacing: 8) {
				HStack(spacing: 8) {
					MetricChip(title: "Sets", value: "\(summary.setCount)", tint: KineticTheme.volt.opacity(0.7))
					MetricChip(title: "Exercises", value: "\(summary.exerciseCount)")
				}
				HStack(spacing: 8) {
					MetricChip(title: "Volume", value: "\(summary.totalVolume.kineticVolumeText) kg")
					MetricChip(title: "Time", value: summary.durationText)
				}
			}
			.padding(16)
			.kineticCard()

			Spacer()

			Button {
				onDone()
			} label: {
				Text("Back to plans")
					.font(.headline)
					.frame(maxWidth: .infinity)
					.frame(height: 56)
			}
			.buttonStyle(.borderedProminent)
			.tint(KineticTheme.ink)
		}
		.padding(20)
	}
}

private struct ActiveSetDraft: Identifiable, Comparable {
	let id: UUID
	let exerciseID: UUID
	let exerciseOrder: Int
	let exerciseName: String
	let setNumber: Int
	let targetReps: Int
	var weightText: String
	var repsText: String
	var isLogged: Bool

	init(exercise: PlanExercise, setNumber: Int) {
		id = UUID()
		exerciseID = exercise.id
		exerciseOrder = exercise.order
		exerciseName = exercise.name
		self.setNumber = setNumber
		targetReps = exercise.targetReps
		weightText = ""
		repsText = "\(exercise.targetReps)"
		isLogged = false
	}

	var weight: Double? {
		Double(weightText.replacingOccurrences(of: ",", with: "."))
	}

	var reps: Int? {
		Int(repsText.trimmingCharacters(in: .whitespacesAndNewlines))
	}

	var canLog: Bool {
		guard let weight, let reps else {
			return false
		}
		return weight >= 0 && reps > 0
	}

	var loggedVolume: Double {
		guard isLogged, let weight, let reps else {
			return 0
		}
		return weight * Double(reps)
	}

	static func makeSets(from day: TrainingDay) -> [ActiveSetDraft] {
		day.orderedExercises.flatMap { exercise in
			(1...max(1, exercise.targetSets)).map { setNumber in
				ActiveSetDraft(exercise: exercise, setNumber: setNumber)
			}
		}
	}

	static func < (lhs: ActiveSetDraft, rhs: ActiveSetDraft) -> Bool {
		if lhs.exerciseOrder == rhs.exerciseOrder {
			return lhs.setNumber < rhs.setNumber
		}
		return lhs.exerciseOrder < rhs.exerciseOrder
	}
}

private struct WorkoutSummary {
	let planName: String
	let dayLabel: String
	let setCount: Int
	let exerciseCount: Int
	let totalVolume: Double
	let duration: TimeInterval

	var durationText: String {
		let minutes = max(1, Int(duration / 60))
		return "\(minutes)m"
	}
}

#Preview {
	let container = PreviewData.container()
	let descriptor = FetchDescriptor<WorkoutPlan>()
	let plan = try! container.mainContext.fetch(descriptor).first!
	let day = plan.orderedDays.first!

	return NavigationStack {
		WorkoutSessionView(plan: plan, day: day)
	}
	.modelContainer(container)
}
