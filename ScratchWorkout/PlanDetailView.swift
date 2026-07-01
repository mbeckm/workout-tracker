import SwiftUI

struct PlanDetailView: View {
    var plan: WorkoutPlan
    var allowsEditing: Bool
    var onStartWorkout: (WorkoutDay) -> Void
    var onSave: (WorkoutPlan) -> Void

    @Namespace private var entryNamespace
    @FocusState private var planNameFocused: Bool
    @FocusState private var searchFocused: Bool
    @State private var draftPlan: WorkoutPlan
    @State private var currentDayIndex = 0
    @State private var isEditing = false
    @State private var searchQuery = ""
    @State private var isAddingExercise = false
    @State private var exerciseDraft: ExerciseDraft?
    @State private var exerciseDraftStep: ExerciseDraftStep = .sets

    init(
        plan: WorkoutPlan,
        allowsEditing: Bool,
        onStartWorkout: @escaping (WorkoutDay) -> Void,
        onSave: @escaping (WorkoutPlan) -> Void
    ) {
        self.plan = plan
        self.allowsEditing = allowsEditing
        self.onStartWorkout = onStartWorkout
        self.onSave = onSave
        _draftPlan = State(initialValue: Self.editableDisplayPlan(plan))
    }

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.top, 66)

                DayStepProgress(
                    count: max(draftPlan.days.count, 1),
                    completed: 0,
                    current: currentDayIndex,
                    selectedOnly: true,
                    onSelect: switchToDay,
                    onReorder: isEditing ? reorderDay : nil,
                    onDelete: isEditing ? deleteDay : nil
                )
                .padding(.top, 24)

                dayTitle
                    .padding(.top, 24)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        if isEditing {
                            entrySurface
                        }

                        ForEach(currentDayExercises) { exercise in
                            if let draft = exerciseDraft, draft.editingID == exercise.id {
                                ExerciseDraftSurface(
                                    draft: draftBinding(fallback: draft),
                                    step: $exerciseDraftStep,
                                    onAdvance: advanceOrSaveExerciseDraft
                                )
                                .matchedGeometryEffect(id: exercise.id, in: entryNamespace)
                                .frame(maxWidth: .infinity)
                                .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                            } else if !isEditing {
                                ExerciseCard(exercise: exercise)
                                    .matchedGeometryEffect(id: exercise.id, in: entryNamespace)
                                    .frame(maxWidth: .infinity)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        guard allowsEditing else {
                                            return
                                        }

                                        editExercise(exercise)
                                    }
                            } else {
                                EditableExerciseCard(
                                    exercise: exercise,
                                    onEdit: {
                                        editExercise(exercise)
                                    },
                                    onDelete: {
                                        deleteExercise(exercise.id)
                                    },
                                    onReorderBefore: { draggedID in
                                        reorderExercise(draggedID, before: exercise.id)
                                    }
                                )
                                .matchedGeometryEffect(id: exercise.id, in: entryNamespace)
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
                .clipped()
                .frame(maxWidth: .infinity)
                .scrollDismissesKeyboard(.interactively)
                .simultaneousGesture(
                    TapGesture()
                        .onEnded {
                            searchFocused = false
                            planNameFocused = false
                        },
                    including: .gesture
                )

                if exerciseDraft == nil {
                    HStack {
                        Spacer()
                        CTAButton(title: isEditing ? "Save" : "Start this Workout", width: 312) {
                            if isEditing {
                                savePlanEdits()
                            } else if let day = currentDay {
                                onStartWorkout(day)
                            }
                        }
                        Spacer()
                    }
                    .padding(.bottom, 106)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }
            }
            .padding(.horizontal, 24)
        }
        .animation(.spring(response: 0.26, dampingFraction: 0.88), value: currentDayIndex)
        .animation(.spring(response: 0.24, dampingFraction: 0.88), value: isEditing)
        .animation(.spring(response: 0.24, dampingFraction: 0.88), value: exerciseDraft)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: exerciseDraftStep)
        .onChange(of: plan) { _, newPlan in
            syncDraftPlan(with: newPlan)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            if isEditing {
                TextField("Plan name", text: $draftPlan.name)
                    .focused($planNameFocused)
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .tint(AppColor.primaryText)
                    .lineLimit(1)
                    .submitLabel(.done)
            } else {
                Text(displayPlanName)
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
            }

            if allowsEditing && !isEditing {
                Button {
                    beginEditing()
                } label: {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit plan")
            }
        }
        .frame(height: 38, alignment: .leading)
    }

    private var dayTitle: some View {
        Group {
            if isEditing {
                TextField("Day name", text: currentDayTitleBinding)
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .tint(AppColor.primaryText)
                    .lineLimit(1)
                    .submitLabel(.done)
            } else {
                SectionTitle(text: currentDay?.title ?? "Day \(currentDayIndex + 1)")
            }
        }
        .frame(height: 30, alignment: .leading)
    }

    @ViewBuilder
    private var entrySurface: some View {
        if let draft = exerciseDraft, draft.editingID == nil {
            ExerciseDraftSurface(
                draft: draftBinding(fallback: draft),
                step: $exerciseDraftStep,
                onAdvance: advanceOrSaveExerciseDraft
            )
            .matchedGeometryEffect(id: "plan-detail-entry-surface", in: entryNamespace)
            .frame(maxWidth: .infinity)
            .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
        } else if shouldShowSearchSurface {
            PlanEntrySurface(
                query: $searchQuery,
                focused: $searchFocused,
                results: filteredExercises,
                autoFocus: false,
                onConfigure: configureExerciseFromSearch
            )
            .matchedGeometryEffect(id: "plan-detail-entry-surface", in: entryNamespace)
            .frame(maxWidth: .infinity)
            .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
        }
    }

    private var displayPlanName: String {
        draftPlan.name == "PPL" ? "Push Pull Legs" : draftPlan.name
    }

    private var currentDay: WorkoutDay? {
        guard draftPlan.days.indices.contains(currentDayIndex) else {
            return nil
        }

        return draftPlan.days[currentDayIndex]
    }

    private var currentDayExercises: [ExercisePrescription] {
        currentDay?.exercises ?? []
    }

    private var currentDayTitleBinding: Binding<String> {
        Binding(
            get: {
                currentDay?.title ?? "Day \(currentDayIndex + 1)"
            },
            set: { newValue in
                guard draftPlan.days.indices.contains(currentDayIndex) else {
                    return
                }

                draftPlan.days[currentDayIndex].title = newValue
            }
        )
    }

    private var shouldShowSearchSurface: Bool {
        exerciseDraft == nil && (isAddingExercise || !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }

    private var filteredExercises: [ExercisePrescription] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !query.isEmpty else {
            return []
        }

        return Array(SampleData.exerciseDatabase.filter {
            $0.name.localizedCaseInsensitiveContains(query)
        })
    }

    private func beginEditing() {
        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.26, dampingFraction: 0.88)) {
            isEditing = true
            isAddingExercise = true
            searchQuery = ""
            exerciseDraft = nil
            exerciseDraftStep = .sets
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            planNameFocused = true
        }
    }

    private func switchToDay(_ index: Int) {
        guard index >= 0, index < draftPlan.days.count else {
            return
        }

        Haptics.tap()

        withAnimation(.spring(response: 0.26, dampingFraction: 0.88)) {
            currentDayIndex = index
            resetEntryState(keepSearchVisible: isEditing)
        }
    }

    private func configureExerciseFromSearch(_ exercise: ExercisePrescription) {
        Haptics.tap(.medium)

        beginDraftConfiguration(from: exercise, editingID: nil)
    }

    private func beginDraftConfiguration(from exercise: ExercisePrescription, editingID: UUID?) {
        let displayName = editingID == nil ? exercise.name.planDisplayName : exercise.name

        withAnimation(.spring(response: 0.24, dampingFraction: 0.88)) {
            exerciseDraft = ExerciseDraft(
                editingID: editingID,
                name: displayName,
                sets: exercise.sets,
                reps: exercise.reps
            )
            exerciseDraftStep = .sets
            isAddingExercise = false
            searchQuery = ""
            searchFocused = false
        }
    }

    private func editExercise(_ exercise: ExercisePrescription) {
        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.24, dampingFraction: 0.88)) {
            isEditing = true
        }

        beginDraftConfiguration(from: exercise, editingID: exercise.id)
    }

    private func advanceOrSaveExerciseDraft() {
        guard exerciseDraft != nil else {
            return
        }

        Haptics.tap(.medium)

        if exerciseDraftStep == .sets {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.88)) {
                exerciseDraftStep = .reps
            }
            return
        }

        saveExerciseDraft()
    }

    private func saveExerciseDraft() {
        guard let draft = exerciseDraft,
              exerciseDraftStep == .reps,
              draftPlan.days.indices.contains(currentDayIndex) else {
            return
        }

        var savedExercise = ExercisePrescription(name: draft.name, sets: draft.sets, reps: draft.reps)

        withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
            if let editingID = draft.editingID,
               let index = draftPlan.days[currentDayIndex].exercises.firstIndex(where: { $0.id == editingID }) {
                savedExercise.id = editingID
                draftPlan.days[currentDayIndex].exercises[index] = savedExercise
            } else {
                draftPlan.days[currentDayIndex].exercises.append(savedExercise)
            }

            exerciseDraft = nil
            exerciseDraftStep = .sets
            searchQuery = ""
            isAddingExercise = true
            searchFocused = false
        }

        if isEditing {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                searchFocused = true
            }
        }
    }

    private func deleteExercise(_ id: UUID) {
        guard draftPlan.days.indices.contains(currentDayIndex) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
            draftPlan.days[currentDayIndex].exercises.removeAll { $0.id == id }
            if exerciseDraft?.editingID == id {
                exerciseDraft = nil
                exerciseDraftStep = .sets
            }
        }
    }

    private func reorderExercise(_ draggedID: UUID, before targetID: UUID) {
        guard draftPlan.days.indices.contains(currentDayIndex),
              draggedID != targetID,
              let fromIndex = draftPlan.days[currentDayIndex].exercises.firstIndex(where: { $0.id == draggedID }),
              let targetIndex = draftPlan.days[currentDayIndex].exercises.firstIndex(where: { $0.id == targetID }) else {
            return
        }

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            let moved = draftPlan.days[currentDayIndex].exercises.remove(at: fromIndex)
            let adjustedTarget = targetIndex > fromIndex ? targetIndex - 1 : targetIndex
            draftPlan.days[currentDayIndex].exercises.insert(moved, at: adjustedTarget)
        }
    }

    private func reorderDay(_ fromIndex: Int, to targetIndex: Int) {
        guard isEditing,
              draftPlan.days.indices.contains(fromIndex),
              draftPlan.days.indices.contains(targetIndex),
              fromIndex != targetIndex else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            let movedDay = draftPlan.days.remove(at: fromIndex)
            let destination = min(targetIndex, draftPlan.days.count)
            draftPlan.days.insert(movedDay, at: destination)
            currentDayIndex = adjustedCurrentDay(afterMovingFrom: fromIndex, to: destination)
            draftPlan.daysPerWeek = draftPlan.days.count
            resetEntryState(keepSearchVisible: true)
        }
    }

    private func deleteDay(_ index: Int) {
        guard isEditing,
              draftPlan.days.count > 1,
              draftPlan.days.indices.contains(index) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            draftPlan.days.remove(at: index)
            draftPlan.daysPerWeek = draftPlan.days.count
            if currentDayIndex > index {
                currentDayIndex -= 1
            } else if currentDayIndex >= draftPlan.days.count {
                currentDayIndex = max(draftPlan.days.count - 1, 0)
            }
            resetEntryState(keepSearchVisible: true)
        }
    }

    private func adjustedCurrentDay(afterMovingFrom fromIndex: Int, to destination: Int) -> Int {
        if currentDayIndex == fromIndex {
            return destination
        }

        if fromIndex < currentDayIndex && currentDayIndex <= destination {
            return currentDayIndex - 1
        }

        if destination <= currentDayIndex && currentDayIndex < fromIndex {
            return currentDayIndex + 1
        }

        return currentDayIndex
    }

    private func savePlanEdits() {
        Haptics.tap(.medium)

        var savedPlan = draftPlan
        savedPlan.daysPerWeek = savedPlan.days.count
        onSave(savedPlan)

        withAnimation(.spring(response: 0.26, dampingFraction: 0.88)) {
            isEditing = false
            resetEntryState(keepSearchVisible: false)
        }
    }

    private func resetEntryState(keepSearchVisible: Bool) {
        searchQuery = ""
        searchFocused = false
        planNameFocused = false
        exerciseDraft = nil
        exerciseDraftStep = .sets
        isAddingExercise = keepSearchVisible
    }

    private func syncDraftPlan(with plan: WorkoutPlan) {
        guard !isEditing, exerciseDraft == nil else {
            return
        }

        let displayPlan = Self.editableDisplayPlan(plan)
        draftPlan = displayPlan
        currentDayIndex = min(currentDayIndex, max(displayPlan.days.count - 1, 0))
        resetEntryState(keepSearchVisible: false)
    }

    private func draftBinding(fallback: ExerciseDraft) -> Binding<ExerciseDraft> {
        Binding(
            get: {
                exerciseDraft ?? fallback
            },
            set: { newValue in
                exerciseDraft = newValue
            }
        )
    }

    private static func editableDisplayPlan(_ plan: WorkoutPlan) -> WorkoutPlan {
        guard plan.name == "PPL" else {
            return plan
        }

        var editablePlan = plan
        editablePlan.name = "Push Pull Legs"
        return editablePlan
    }
}
