import SwiftData
import SwiftUI

struct PlanBuilderView: View {
	@Environment(\.dismiss) private var dismiss
	@Environment(\.modelContext) private var modelContext

	private let plan: WorkoutPlan?
	@State private var draft: PlanDraft
	@State private var step: PlanBuilderStep = .basics
	@State private var activeDayIndex = 0
	@State private var saveError: String?

	init(plan: WorkoutPlan? = nil) {
		self.plan = plan
		_draft = State(initialValue: PlanDraft(plan: plan))
	}

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 18) {
				PlanBuilderHero(step: step)
				stepContent
			}
			.padding(.horizontal, 20)
			.padding(.top, 16)
			.padding(.bottom, 112)
		}
		.kineticScreenBackground()
		.navigationTitle(plan == nil ? "New Plan" : "Edit Plan")
		.navigationBarTitleDisplayMode(.inline)
		.scrollDismissesKeyboard(.interactively)
		.safeAreaInset(edge: .bottom) {
			BottomActionBar {
				bottomControls
			}
		}
		.onChange(of: draft.daysPerWeek) { _, _ in
			clampActiveDayIndex()
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

	@ViewBuilder private var stepContent: some View {
		switch step {
		case .basics:
			PlanBasicsStep(draft: $draft)
		case .days:
			DayNamesStep(draft: $draft)
		case .exercises:
			ExercisesStep(draft: $draft, activeDayIndex: $activeDayIndex)
		case .review:
			PlanReviewStep(
				draft: $draft,
				onEditDay: { index in
					activeDayIndex = index
					move(to: .exercises)
				},
				onMoveDay: moveDay(from:to:)
			)
		}
	}

	private var bottomControls: some View {
		HStack(spacing: 12) {
			if step != .basics {
				Button {
					goBack()
				} label: {
					Image(systemName: "chevron.left")
						.font(.headline)
						.frame(width: 48, height: 56)
				}
				.buttonStyle(.bordered)
				.tint(KineticTheme.ink)
				.accessibilityLabel("Back")
			}

			Button {
				advance()
			} label: {
				Label(primaryButtonTitle, systemImage: primaryButtonIcon)
					.font(.headline)
					.frame(maxWidth: .infinity)
					.frame(height: 56)
			}
			.buttonStyle(.borderedProminent)
			.tint(canAdvance ? KineticTheme.ink : KineticTheme.slate)
			.disabled(!canAdvance)
		}
	}

	private var canAdvance: Bool {
		switch step {
		case .basics:
			return draft.hasPlanBasics
		case .days:
			return draft.hasValidDayLabels
		case .exercises:
			guard draft.days.indices.contains(activeDayIndex) else { return false }
			if activeDayIndex == draft.days.indices.last {
				return draft.hasExercisesForEveryDay
			}
			return draft.days[activeDayIndex].hasSelectedExercise
		case .review:
			return draft.canSave
		}
	}

	private var primaryButtonTitle: String {
		switch step {
		case .basics:
			return "Continue"
		case .days:
			return "Add exercises"
		case .exercises:
			return activeDayIndex == draft.days.indices.last ? "Review plan" : "Next day"
		case .review:
			return plan == nil ? "Create plan" : "Save changes"
		}
	}

	private var primaryButtonIcon: String {
		switch step {
		case .review:
			return "checkmark"
		case .exercises where activeDayIndex == draft.days.indices.last:
			return "list.bullet.clipboard"
		default:
			return "arrow.right"
		}
	}

	private func advance() {
		guard canAdvance else {
			HapticManager.shared.fire(.warning)
			return
		}

		HapticManager.shared.fire(.selection)

		switch step {
		case .basics:
			move(to: .days)
		case .days:
			activeDayIndex = 0
			move(to: .exercises)
		case .exercises:
			if activeDayIndex < draft.days.count - 1 {
				withAnimation(.snappy) {
					activeDayIndex += 1
				}
			} else {
				draft.removeEmptyExercises()
				move(to: .review)
			}
		case .review:
			savePlan()
		}
	}

	private func goBack() {
		HapticManager.shared.fire(.selection)

		switch step {
		case .basics:
			break
		case .days:
			move(to: .basics)
		case .exercises:
			if activeDayIndex > 0 {
				withAnimation(.snappy) {
					activeDayIndex -= 1
				}
			} else {
				move(to: .days)
			}
		case .review:
			activeDayIndex = max(0, draft.days.count - 1)
			move(to: .exercises)
		}
	}

	private func move(to nextStep: PlanBuilderStep) {
		withAnimation(.snappy) {
			step = nextStep
		}
	}

	private func moveDay(from source: Int, to destination: Int) {
		guard source != destination else { return }
		HapticManager.shared.fire(.selection)
		withAnimation(.snappy) {
			draft.moveDay(from: source, to: destination)
			activeDayIndex = destination
		}
	}

	private func clampActiveDayIndex() {
		guard !draft.days.isEmpty else {
			activeDayIndex = 0
			return
		}
		activeDayIndex = min(activeDayIndex, draft.days.count - 1)
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
						catalogID: exerciseDraft.catalogID,
						name: exerciseDraft.name.trimmed,
						category: exerciseDraft.category,
						primaryMuscles: exerciseDraft.primaryMuscles,
						secondaryMuscles: exerciseDraft.secondaryMuscles,
						equipment: exerciseDraft.equipment,
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

private enum PlanBuilderStep: Int, CaseIterable, Identifiable {
	case basics
	case days
	case exercises
	case review

	var id: Int { rawValue }

	var progressValue: String {
		"\(rawValue + 1) of \(Self.allCases.count)"
	}
}

private struct PlanBuilderHero: View {
	let step: PlanBuilderStep

	var body: some View {
		HStack(spacing: 14) {
			Image(systemName: "slider.horizontal.3")
				.font(.system(size: 18, weight: .semibold))
				.foregroundStyle(KineticTheme.ink)
				.frame(width: 42, height: 42)
				.background(KineticTheme.volt, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
				.accessibilityHidden(true)

			HStack(spacing: 8) {
				ForEach(PlanBuilderStep.allCases) { builderStep in
					Capsule()
						.fill(builderStep.rawValue <= step.rawValue ? KineticTheme.ink : KineticTheme.line)
						.frame(height: 5)
				}
			}
			.frame(maxWidth: .infinity)
		}
		.padding(18)
		.background(
			LinearGradient(
				colors: [.white, KineticTheme.mist.opacity(0.74)],
				startPoint: .topLeading,
				endPoint: .bottomTrailing
			),
			in: RoundedRectangle(cornerRadius: KineticTheme.cardRadius, style: .continuous)
		)
		.overlay {
			RoundedRectangle(cornerRadius: KineticTheme.cardRadius, style: .continuous)
				.stroke(KineticTheme.line, lineWidth: 1)
		}
		.accessibilityElement(children: .ignore)
		.accessibilityLabel("Plan setup progress")
		.accessibilityValue(step.progressValue)
	}
}

private struct PlanBasicsStep: View {
	@Binding var draft: PlanDraft

	private let columns = [
		GridItem(.adaptive(minimum: 72), spacing: 10)
	]

	var body: some View {
		VStack(alignment: .leading, spacing: 18) {
			InputPanel(title: "Plan name") {
				TextField("Upper Strength", text: $draft.name)
					.textInputAutocapitalization(.words)
					.font(.body.weight(.medium))
					.padding(14)
					.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
					.overlay {
						RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
							.stroke(KineticTheme.line, lineWidth: 1)
					}
			}

			InputPanel(title: "Training days") {
				LazyVGrid(columns: columns, spacing: 10) {
					ForEach(1...7, id: \.self) { count in
						DayCountButton(
							count: count,
							isSelected: draft.daysPerWeek == count
						) {
							HapticManager.shared.fire(.selection)
							withAnimation(.snappy) {
								draft.resizeDays(to: count)
							}
						}
					}
				}
			}
		}
	}
}

private struct DayCountButton: View {
	let count: Int
	let isSelected: Bool
	let action: () -> Void

	var body: some View {
		Button(action: action) {
			VStack(spacing: 2) {
				Text("\(count)x")
					.font(.headline.monospacedDigit())
				Text("week")
					.font(.caption2.weight(.semibold))
			}
			.foregroundStyle(isSelected ? KineticTheme.ink : KineticTheme.slate)
			.frame(maxWidth: .infinity)
			.frame(height: 58)
			.background(isSelected ? KineticTheme.volt : KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
			.overlay {
				RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
					.stroke(isSelected ? KineticTheme.ink.opacity(0.14) : KineticTheme.line, lineWidth: 1)
			}
		}
		.buttonStyle(.plain)
		.accessibilityLabel("\(count) training days per week")
	}
}

private struct DayNamesStep: View {
	@Binding var draft: PlanDraft

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			ForEach(draft.days.indices, id: \.self) { index in
				DayNameRow(day: $draft.days[index], ordinal: index + 1)
			}
		}
	}
}

private struct DayNameRow: View {
	@Binding var day: DayDraft
	let ordinal: Int

	var body: some View {
		HStack(spacing: 12) {
			Text("\(ordinal)")
				.font(.headline.monospacedDigit())
				.foregroundStyle(KineticTheme.ink)
				.frame(width: 42, height: 42)
				.background(KineticTheme.volt.opacity(0.78), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))

			TextField("Monday", text: $day.label)
				.textInputAutocapitalization(.words)
				.font(.body.weight(.medium))
				.padding(.vertical, 13)
				.padding(.horizontal, 12)
				.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
				.overlay {
					RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
						.stroke(KineticTheme.line, lineWidth: 1)
				}
		}
		.padding(12)
		.kineticCard(cornerRadius: KineticTheme.controlRadius)
	}
}

private struct ExercisesStep: View {
	@Binding var draft: PlanDraft
	@Binding var activeDayIndex: Int

	var body: some View {
		VStack(alignment: .leading, spacing: 16) {
			daySelector

			if draft.days.indices.contains(activeDayIndex) {
				DayExerciseEditor(
					day: $draft.days[activeDayIndex],
					ordinal: activeDayIndex + 1,
					totalDays: draft.days.count
				)
			}
		}
	}

	private var daySelector: some View {
		ScrollView(.horizontal, showsIndicators: false) {
			HStack(spacing: 8) {
				ForEach(draft.days.indices, id: \.self) { index in
					Button {
						HapticManager.shared.fire(.selection)
						withAnimation(.snappy) {
							activeDayIndex = index
						}
					} label: {
						VStack(alignment: .leading, spacing: 3) {
							Text("Day \(index + 1)")
								.font(.caption2.weight(.semibold))
							Text(draft.days[index].label.trimmed.isEmpty ? "Training" : draft.days[index].label)
								.font(.subheadline.weight(.semibold))
								.lineLimit(1)
						}
						.foregroundStyle(activeDayIndex == index ? KineticTheme.ink : KineticTheme.slate)
						.frame(width: 116, alignment: .leading)
						.padding(.horizontal, 12)
						.padding(.vertical, 10)
						.background(activeDayIndex == index ? KineticTheme.volt : KineticTheme.mist.opacity(0.7), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
					}
					.buttonStyle(.plain)
				}
			}
			.padding(.horizontal, 1)
		}
	}
}

private struct DayExerciseEditor: View {
	@Binding var day: DayDraft
	let ordinal: Int
	let totalDays: Int

	var body: some View {
		VStack(alignment: .leading, spacing: 14) {
			HStack(alignment: .firstTextBaseline, spacing: 12) {
				VStack(alignment: .leading, spacing: 4) {
					Text(day.label.trimmed.isEmpty ? "Day \(ordinal)" : day.label)
						.font(.title3.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
					Text("Day \(ordinal) of \(totalDays)")
						.font(.caption.weight(.semibold))
						.foregroundStyle(KineticTheme.slate)
				}

				Spacer()

				Text("\(day.selectedExerciseCount) ready")
					.font(.caption.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
					.padding(.horizontal, 10)
					.padding(.vertical, 6)
					.background(KineticTheme.mist, in: Capsule())
			}

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
				withAnimation(.snappy) {
					day.addExercise()
				}
			} label: {
				Label("Add exercise", systemImage: "plus")
					.font(.subheadline.weight(.semibold))
					.frame(maxWidth: .infinity)
					.frame(height: 46)
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

	@State private var isShowingExerciseSearch = false

	var body: some View {
		VStack(alignment: .leading, spacing: 10) {
			Button {
				isShowingExerciseSearch = true
			} label: {
				ExerciseSelectionSummary(exercise: exercise)
			}
			.buttonStyle(.plain)

			ViewThatFits(in: .horizontal) {
				HStack(spacing: 8) {
					targetControls
				}

				VStack(spacing: 8) {
					targetControls
				}
			}

			HStack(spacing: 8) {
				Image(systemName: "line.3.horizontal")
					.font(.subheadline.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
					.frame(width: 36, height: 38)
					.background(.white.opacity(0.78), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
					.accessibilityHidden(true)

				HStack(spacing: 7) {
					Image(systemName: "note.text")
						.font(.footnote.weight(.semibold))
						.foregroundStyle(KineticTheme.slate)

					TextField("Notes", text: $exercise.notes)
						.textInputAutocapitalization(.sentences)
						.font(.footnote)
						.foregroundStyle(KineticTheme.ink)
				}
				.padding(.horizontal, 10)
				.frame(height: 38)
				.background(.white.opacity(0.82), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))

				Button(role: .destructive) {
					onDelete()
				} label: {
					Image(systemName: "trash")
						.font(.subheadline.weight(.semibold))
						.frame(width: 38, height: 38)
						.background(.white.opacity(0.82), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
				}
				.disabled(!canDelete)
				.opacity(canDelete ? 1 : 0.35)
				.accessibilityLabel("Delete exercise")
			}
		}
		.padding(12)
		.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		.overlay {
			RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
				.stroke(KineticTheme.line.opacity(0.7), lineWidth: 1)
		}
		.sheet(isPresented: $isShowingExerciseSearch) {
			ExercisePickerSheet(exercise: $exercise)
		}
	}

	@ViewBuilder private var targetControls: some View {
		ExerciseTargetControl(value: $exercise.sets, title: "Sets", range: 1...12)
			.frame(maxWidth: .infinity)
		ExerciseTargetControl(value: $exercise.reps, title: "Reps", range: 1...50)
			.frame(maxWidth: .infinity)
	}
}

private struct ExerciseSelectionSummary: View {
	let exercise: ExerciseDraft

	var body: some View {
		HStack(alignment: .center, spacing: 10) {
			Image(systemName: exercise.hasCatalogSelection ? "checkmark.circle.fill" : "magnifyingglass")
				.font(.title3.weight(.semibold))
				.foregroundStyle(exercise.hasCatalogSelection ? KineticTheme.ink : KineticTheme.slate)
				.frame(width: 30, height: 30)
				.background(exercise.hasCatalogSelection ? KineticTheme.volt.opacity(0.72) : KineticTheme.mist, in: Circle())

			VStack(alignment: .leading, spacing: 5) {
				Text(title)
					.font(.headline.weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
					.lineLimit(3)
					.fixedSize(horizontal: false, vertical: true)
					.frame(maxWidth: .infinity, alignment: .leading)

				Text(subtitle)
					.font(.caption)
					.foregroundStyle(KineticTheme.slate)
					.lineLimit(1)
					.frame(maxWidth: .infinity, alignment: .leading)
			}

			Image(systemName: "chevron.right")
				.font(.caption.weight(.semibold))
				.foregroundStyle(KineticTheme.slate)
		}
		.padding(.horizontal, 12)
		.padding(.vertical, 12)
		.frame(maxWidth: .infinity, alignment: .leading)
		.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		.overlay {
			RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
				.stroke(exercise.hasCatalogSelection ? KineticTheme.line : KineticTheme.steel.opacity(0.45), lineWidth: 1)
		}
		.accessibilityElement(children: .combine)
		.accessibilityLabel(title)
	}

	private var title: String {
		if !exercise.name.trimmed.isEmpty {
			return exercise.name
		}
		return "Search exercise"
	}

	private var subtitle: String {
		if exercise.hasCatalogSelection {
			return exercise.catalogDetailSummary
		}
		if !exercise.name.trimmed.isEmpty {
			return "Choose a catalog match"
		}
		return "Pick from the exercise database"
	}
}

private struct ExerciseTargetControl: View {
	@Binding var value: Int
	let title: String
	let range: ClosedRange<Int>

	var body: some View {
		HStack(spacing: 8) {
			VStack(alignment: .leading, spacing: 2) {
				Text(title.uppercased())
					.font(.caption2.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
				Text("\(value)")
					.font(.headline.monospacedDigit().weight(.semibold))
					.foregroundStyle(KineticTheme.ink)
			}

			Spacer(minLength: 6)

			HStack(spacing: 0) {
				Button {
					adjust(by: -1)
				} label: {
					Image(systemName: "minus")
						.frame(width: 32, height: 32)
						.contentShape(Rectangle())
				}
				.disabled(value <= range.lowerBound)
				.opacity(value > range.lowerBound ? 1 : 0.35)
				.accessibilityLabel("Decrease \(title.lowercased())")

				Rectangle()
					.fill(KineticTheme.line)
					.frame(width: 1, height: 20)

				Button {
					adjust(by: 1)
				} label: {
					Image(systemName: "plus")
						.frame(width: 32, height: 32)
						.contentShape(Rectangle())
				}
				.disabled(value >= range.upperBound)
				.opacity(value < range.upperBound ? 1 : 0.35)
				.accessibilityLabel("Increase \(title.lowercased())")
			}
			.font(.subheadline.weight(.semibold))
			.foregroundStyle(KineticTheme.ink)
			.background(KineticTheme.mist.opacity(0.9), in: Capsule())
			.buttonStyle(.plain)
		}
		.padding(.leading, 12)
		.padding(.trailing, 6)
		.padding(.vertical, 8)
		.frame(minHeight: 52)
		.background(.white, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
		.overlay {
			RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous)
				.stroke(KineticTheme.line, lineWidth: 1)
		}
		.accessibilityElement(children: .contain)
	}

	private func adjust(by delta: Int) {
		let nextValue = min(max(value + delta, range.lowerBound), range.upperBound)
		guard nextValue != value else { return }
		value = nextValue
		HapticManager.shared.fire(.selection)
	}
}

private struct ExercisePickerSheet: View {
	@Environment(\.dismiss) private var dismiss
	@Binding var exercise: ExerciseDraft
	@State private var searchText = ""

	private var results: [ExerciseCatalogItem] {
		ExerciseCatalog.search(searchText)
	}

	var body: some View {
		NavigationStack {
			List {
				if ExerciseCatalog.all.isEmpty {
					ContentUnavailableView(
						"Exercise catalog unavailable",
						systemImage: "exclamationmark.triangle",
						description: Text("The bundled exercise database could not be loaded.")
					)
					.listRowSeparator(.hidden)
				} else if results.isEmpty {
					ContentUnavailableView(
						"No exercises found",
						systemImage: "magnifyingglass",
						description: Text("Try another exercise name, muscle, or equipment.")
					)
					.listRowSeparator(.hidden)
				} else {
					Section {
						ForEach(results) { catalogExercise in
							Button {
								select(catalogExercise)
							} label: {
								ExerciseCatalogResultRow(exercise: catalogExercise)
							}
							.buttonStyle(.plain)
							.listRowInsets(.init(top: 8, leading: 16, bottom: 8, trailing: 16))
						}
					} header: {
						Text(searchText.trimmed.isEmpty ? "Common exercises" : "Results")
					} footer: {
						Text("Source: \(ExerciseCatalog.source.name)")
					}
				}
			}
			.listStyle(.insetGrouped)
			.navigationTitle("Choose Exercise")
			.navigationBarTitleDisplayMode(.inline)
			.searchable(
				text: $searchText,
				placement: .navigationBarDrawer(displayMode: .always),
				prompt: Text("Search exercises")
			)
			.toolbar {
				ToolbarItem(placement: .cancellationAction) {
					Button("Cancel") {
						dismiss()
					}
				}
			}
		}
		.presentationDetents([.large])
	}

	private func select(_ catalogExercise: ExerciseCatalogItem) {
		exercise.apply(catalogExercise)
		HapticManager.shared.fire(.selection)
		dismiss()
	}
}

private struct ExerciseCatalogResultRow: View {
	let exercise: ExerciseCatalogItem

	var body: some View {
		VStack(alignment: .leading, spacing: 7) {
			HStack(alignment: .firstTextBaseline, spacing: 8) {
				Text(exercise.name)
					.font(.headline)
					.foregroundStyle(KineticTheme.ink)
					.frame(maxWidth: .infinity, alignment: .leading)

				Text(exercise.category.uppercased())
					.font(.caption2.weight(.semibold))
					.foregroundStyle(KineticTheme.slate)
			}

			Text(exercise.detailSummary)
				.font(.subheadline)
				.foregroundStyle(KineticTheme.slate)

			if !exercise.secondaryMuscles.isEmpty {
				Text("Secondary: \(exercise.secondaryMuscleSummary)")
					.font(.caption)
					.foregroundStyle(KineticTheme.slate)
			}
		}
		.contentShape(Rectangle())
	}
}

private struct PlanReviewStep: View {
	@Binding var draft: PlanDraft
	let onEditDay: (Int) -> Void
	let onMoveDay: (Int, Int) -> Void

	var body: some View {
		VStack(alignment: .leading, spacing: 16) {
			BuilderStatBand(stats: [
				("Days", "\(draft.days.count)"),
				("Exercises", "\(draft.exerciseCount)"),
				("Target sets", "\(draft.targetSetCount)")
			])

			VStack(alignment: .leading, spacing: 12) {
				ForEach(draft.days.indices, id: \.self) { index in
					ReviewDaySection(
						day: $draft.days[index],
						ordinal: index + 1,
						canMoveUp: index > 0,
						canMoveDown: index < draft.days.count - 1,
						onEdit: { onEditDay(index) },
						onMoveUp: { onMoveDay(index, index - 1) },
						onMoveDown: { onMoveDay(index, index + 1) }
					)
				}
			}
		}
	}
}

private struct ReviewDaySection: View {
	@Binding var day: DayDraft
	let ordinal: Int
	let canMoveUp: Bool
	let canMoveDown: Bool
	let onEdit: () -> Void
	let onMoveUp: () -> Void
	let onMoveDown: () -> Void

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			HStack(spacing: 12) {
				VStack(alignment: .leading, spacing: 4) {
					Text("Day \(ordinal)")
						.font(.caption2.weight(.semibold))
						.foregroundStyle(KineticTheme.slate)
					Text(day.label)
						.font(.headline)
						.foregroundStyle(KineticTheme.ink)
				}

				Spacer()

				ReorderControls(
					canMoveUp: canMoveUp,
					canMoveDown: canMoveDown,
					onMoveUp: onMoveUp,
					onMoveDown: onMoveDown
				)

				Button(action: onEdit) {
					Image(systemName: "pencil")
						.frame(width: 36, height: 36)
				}
				.buttonStyle(.bordered)
				.tint(KineticTheme.ink)
				.accessibilityLabel("Edit \(day.label)")
			}

			VStack(spacing: 8) {
				ForEach(day.exercises.indices, id: \.self) { index in
					ReviewExerciseRow(
						exercise: day.exercises[index],
						ordinal: index + 1,
						canMoveUp: index > 0,
						canMoveDown: index < day.exercises.count - 1,
						onMoveUp: {
							withAnimation(.snappy) {
								day.moveExercise(from: index, to: index - 1)
							}
							HapticManager.shared.fire(.selection)
						},
						onMoveDown: {
							withAnimation(.snappy) {
								day.moveExercise(from: index, to: index + 1)
							}
							HapticManager.shared.fire(.selection)
						}
					)
				}
			}
		}
		.padding(16)
		.kineticCard()
	}
}

private struct ReviewExerciseRow: View {
	let exercise: ExerciseDraft
	let ordinal: Int
	let canMoveUp: Bool
	let canMoveDown: Bool
	let onMoveUp: () -> Void
	let onMoveDown: () -> Void

	var body: some View {
		HStack(spacing: 12) {
			Image(systemName: "line.3.horizontal")
				.foregroundStyle(KineticTheme.slate)
				.frame(width: 22)

				VStack(alignment: .leading, spacing: 3) {
					Text(exercise.name)
						.font(.subheadline.weight(.semibold))
						.foregroundStyle(KineticTheme.ink)
					Text("\(exercise.sets) sets x \(exercise.reps) reps")
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
					Text(exercise.catalogDetailSummary)
						.font(.caption)
						.foregroundStyle(KineticTheme.slate)
					if !exercise.secondaryMuscles.isEmpty {
						Text("Secondary: \(exercise.secondaryMuscleSummary)")
							.font(.caption2)
							.foregroundStyle(KineticTheme.slate)
					}
				}

			Spacer()

			Text("\(ordinal)")
				.font(.caption.monospacedDigit().weight(.semibold))
				.foregroundStyle(KineticTheme.slate)

			ReorderControls(
				canMoveUp: canMoveUp,
				canMoveDown: canMoveDown,
				onMoveUp: onMoveUp,
				onMoveDown: onMoveDown
			)
		}
		.padding(.horizontal, 12)
		.padding(.vertical, 10)
		.background(KineticTheme.mist.opacity(0.72), in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
	}
}

private struct ReorderControls: View {
	let canMoveUp: Bool
	let canMoveDown: Bool
	let onMoveUp: () -> Void
	let onMoveDown: () -> Void

	var body: some View {
		HStack(spacing: 2) {
			Button(action: onMoveUp) {
				Image(systemName: "chevron.up")
					.frame(width: 32, height: 32)
			}
			.disabled(!canMoveUp)
			.opacity(canMoveUp ? 1 : 0.3)
			.accessibilityLabel("Move up")

			Button(action: onMoveDown) {
				Image(systemName: "chevron.down")
					.frame(width: 32, height: 32)
			}
			.disabled(!canMoveDown)
			.opacity(canMoveDown ? 1 : 0.3)
			.accessibilityLabel("Move down")
		}
		.buttonStyle(.borderless)
		.tint(KineticTheme.ink)
	}
}

private struct InputPanel<Content: View>: View {
	let title: String
	@ViewBuilder var content: Content

	var body: some View {
		VStack(alignment: .leading, spacing: 12) {
			Text(title)
				.font(.headline)
				.foregroundStyle(KineticTheme.ink)
			content
		}
		.padding(16)
		.kineticCard()
	}
}

private struct BuilderStatBand: View {
	let stats: [(title: String, value: String)]

	var body: some View {
		HStack(spacing: 8) {
			ForEach(stats, id: \.title) { stat in
				MetricChip(title: stat.title, value: stat.value, tint: stat.title == "Target sets" ? KineticTheme.volt.opacity(0.7) : KineticTheme.mist)
			}
		}
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
				.filter(\.hasCatalogSelection)
			cleanDay.reorderExercises()
			return cleanDay
		}
	}

	var hasPlanBasics: Bool {
		!name.trimmed.isEmpty
	}

	var hasValidDayLabels: Bool {
		days.count == daysPerWeek && days.allSatisfy { !$0.label.trimmed.isEmpty }
	}

	var hasExercisesForEveryDay: Bool {
		days.count == daysPerWeek && days.allSatisfy(\.hasSelectedExercise)
	}

	var canSave: Bool {
		hasPlanBasics && hasValidDayLabels && hasExercisesForEveryDay
	}

	var exerciseCount: Int {
		cleanedDays.reduce(0) { $0 + $1.exercises.count }
	}

	var targetSetCount: Int {
		cleanedDays.reduce(0) { total, day in
			total + day.exercises.reduce(0) { $0 + $1.sets }
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

	mutating func removeEmptyExercises() {
		for index in days.indices {
			days[index].exercises = days[index].exercises.filter(\.hasCatalogSelection)
			if days[index].exercises.isEmpty {
				days[index].exercises = [ExerciseDraft(order: 0)]
			}
			days[index].reorderExercises()
		}
	}

	mutating func moveDay(from source: Int, to destination: Int) {
		guard days.indices.contains(source), days.indices.contains(destination) else { return }
		let movedDay = days.remove(at: source)
		days.insert(movedDay, at: destination)
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

	var hasSelectedExercise: Bool {
		exercises.contains(where: \.hasCatalogSelection)
	}

	var selectedExerciseCount: Int {
		exercises.filter(\.hasCatalogSelection).count
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

	mutating func moveExercise(from source: Int, to destination: Int) {
		guard exercises.indices.contains(source), exercises.indices.contains(destination) else { return }
		let movedExercise = exercises.remove(at: source)
		exercises.insert(movedExercise, at: destination)
		reorderExercises()
	}
}

private struct ExerciseDraft: Identifiable {
	let id: UUID
	var order: Int
	var catalogID: String?
	var name: String
	var category: String
	var primaryMuscles: [String]
	var secondaryMuscles: [String]
	var equipment: [String]
	var sets: Int
	var reps: Int
	var notes: String

	init(
		id: UUID = UUID(),
		order: Int,
		catalogID: String? = nil,
		name: String = "",
		category: String = "",
		primaryMuscles: [String] = [],
		secondaryMuscles: [String] = [],
		equipment: [String] = [],
		sets: Int = 3,
		reps: Int = 8,
		notes: String = ""
	) {
		self.id = id
		self.order = order
		self.catalogID = catalogID
		self.name = name
		self.category = category
		self.primaryMuscles = primaryMuscles
		self.secondaryMuscles = secondaryMuscles
		self.equipment = equipment
		self.sets = sets
		self.reps = reps
		self.notes = notes
	}

	init(exercise: PlanExercise) {
		id = exercise.id
		order = exercise.order
		catalogID = exercise.catalogID
		name = exercise.name
		category = exercise.category
		primaryMuscles = exercise.primaryMuscles
		secondaryMuscles = exercise.secondaryMuscles
		equipment = exercise.equipment
		sets = exercise.targetSets
		reps = exercise.targetReps
		notes = exercise.notes
	}

	var hasCatalogSelection: Bool {
		catalogID != nil && !name.trimmed.isEmpty
	}

	var catalogDetailSummary: String {
		let muscleText = primaryMuscles.isEmpty ? category : primaryMuscles.kineticSummary()
		let equipmentText = equipment.kineticSummary(fallback: "Bodyweight")
		return "\(muscleText) - \(equipmentText)"
	}

	var secondaryMuscleSummary: String {
		secondaryMuscles.kineticSummary()
	}

	mutating func apply(_ catalogExercise: ExerciseCatalogItem) {
		catalogID = catalogExercise.id
		name = catalogExercise.name
		category = catalogExercise.category
		primaryMuscles = catalogExercise.primaryMuscles
		secondaryMuscles = catalogExercise.secondaryMuscles
		equipment = catalogExercise.equipment
	}
}

private extension String {
	var trimmed: String {
		trimmingCharacters(in: .whitespacesAndNewlines)
	}
}

#Preview("Create plan") {
	NavigationStack {
		PlanBuilderView()
	}
	.modelContainer(PreviewData.container())
}
