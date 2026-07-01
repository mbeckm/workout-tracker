import SwiftUI

struct CreatePlanView: View {
    enum Stage: String {
        case frequency
        case search
        case finalReview
        case activatePrompt
    }

    var onFinish: (WorkoutPlan, Bool) -> Void

    @Namespace private var searchNamespace
    @Namespace private var activationNamespace
    @FocusState private var searchFocused: Bool
    @State private var stage: Stage
    @State private var daysPerWeek: Int
    @State private var currentDayIndex = 0
    @State private var completedDays = 0
    @State private var planDays: [[ExercisePrescription]]
    @State private var searchQuery: String
    @State private var isAddingExercise = false
    @State private var exerciseDraft: ExerciseDraft?
    @State private var exerciseDraftStep: ExerciseDraftStep = .sets

    init(
        initialStage: Stage = .frequency,
        daysPerWeek: Int = 3,
        searchQuery: String = "",
        onFinish: @escaping (WorkoutPlan, Bool) -> Void
    ) {
        let seededDays: [[ExercisePrescription]]
        let seededCompletedDays: Int

        if initialStage == .finalReview || initialStage == .activatePrompt {
            seededDays = Array(SampleData.activePlan.days.prefix(daysPerWeek).map(\.exercises))
            seededCompletedDays = daysPerWeek
        } else {
            seededDays = Array(repeating: [], count: daysPerWeek)
            seededCompletedDays = 0
        }

        self.onFinish = onFinish
        _stage = State(initialValue: initialStage)
        _daysPerWeek = State(initialValue: daysPerWeek)
        _searchQuery = State(initialValue: searchQuery)
        _planDays = State(initialValue: seededDays)
        _completedDays = State(initialValue: seededCompletedDays)
    }

    var body: some View {
        AppScreen {
            ZStack(alignment: .topLeading) {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        searchFocused = false
                    }

                baseContent

                if stage == .activatePrompt {
                    activationPrompt
                        .transition(.scale(scale: 0.94, anchor: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 24)
        }
        .animation(.spring(response: 0.28, dampingFraction: 0.86), value: stage)
        .animation(.spring(response: 0.26, dampingFraction: 0.88), value: currentDayIndex)
        .animation(.spring(response: 0.24, dampingFraction: 0.86), value: completedDays)
        .animation(.spring(response: 0.24, dampingFraction: 0.88), value: isAddingExercise)
        .animation(.spring(response: 0.24, dampingFraction: 0.88), value: exerciseDraft)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: exerciseDraftStep)
    }

    @ViewBuilder
    private var baseContent: some View {
        switch stage {
        case .frequency:
            frequencyView
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
        case .search:
            dayBuilderView
                .transition(.opacity)
        case .finalReview, .activatePrompt:
            finalReviewView
                .transition(.opacity.combined(with: .move(edge: .trailing)))
        }
    }

    private var frequencyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            VStack(spacing: 16) {
                HStack(spacing: 24) {
                    RoundStepButton(symbol: "minus", fill: AppColor.border, accessibilityLabel: "Decrease workouts per week") {
                        daysPerWeek = max(1, daysPerWeek - 1)
                    }

                    Text("\(daysPerWeek)")
                        .font(.custom("Inter", size: 128, relativeTo: .largeTitle).weight(.bold))
                        .frame(width: 83, height: 105)
                        .contentTransition(.numericText())

                    RoundStepButton(symbol: "plus", fill: AppColor.border, accessibilityLabel: "Increase workouts per week") {
                        daysPerWeek = min(7, daysPerWeek + 1)
                    }
                }
                .offset(x: 2.5)

                Text("Workouts per week")
                    .font(AppFont.h1)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 257)

            Spacer(minLength: 24)

            HStack {
                Spacer()
                CTAButton(title: "Next", width: 312) {
                    startBuildingPlan()
                }
                Spacer()
            }
            .padding(.bottom, 106)
        }
    }

    private var dayBuilderView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Create Plan")
                .font(AppFont.display)
                .padding(.top, 66)

            DayStepProgress(
                count: daysPerWeek,
                completed: completedDays,
                current: currentDayIndex,
                onSelect: switchToDay,
                onReorder: reorderDay,
                onDelete: deleteDay
            )
                .padding(.top, 24)

            SectionTitle(text: currentDayTitle)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    if let draft = exerciseDraft, draft.editingID == nil {
                        ExerciseDraftSurface(
                            draft: draftBinding(fallback: draft),
                            step: $exerciseDraftStep,
                            onAdvance: advanceOrSaveExerciseDraft
                        )
                        .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                        .frame(maxWidth: .infinity)
                        .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                    } else if shouldShowSearchSurface {
                        PlanEntrySurface(
                            query: $searchQuery,
                            focused: $searchFocused,
                            results: filteredExercises,
                            onSelect: addExerciseFromSearch
                        )
                        .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                        .frame(maxWidth: .infinity)
                        .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                    } else if currentDayExercises.isEmpty {
                        EmptyDayState(onAdd: beginExerciseSearch)
                            .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                    }

                    ForEach(currentDayExercises) { exercise in
                        if let draft = exerciseDraft, draft.editingID == exercise.id {
                            ExerciseDraftSurface(
                                draft: draftBinding(fallback: draft),
                                step: $exerciseDraftStep,
                                onAdvance: advanceOrSaveExerciseDraft
                            )
                            .matchedGeometryEffect(id: exercise.id, in: searchNamespace)
                            .frame(maxWidth: .infinity)
                            .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
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
                            .matchedGeometryEffect(id: exercise.id, in: searchNamespace)
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.top, currentDayExercises.isEmpty ? 24 : 12)
                .padding(.bottom, 24)
            }
            .frame(maxWidth: .infinity)
            .clipped()
            .scrollDismissesKeyboard(.interactively)
            .simultaneousGesture(
                TapGesture()
                    .onEnded {
                        searchFocused = false
                    }
            )

            if !currentDayExercises.isEmpty && exerciseDraft == nil {
                HStack {
                    Spacer()
                    CTAButton(title: "Save Day", width: 312) {
                        saveCurrentDay()
                    }
                    Spacer()
                }
                .padding(.bottom, 106)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
    }

    private var finalReviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Review")
                .font(AppFont.display)
                .padding(.top, 66)

            DayStepProgress(
                count: daysPerWeek,
                completed: daysPerWeek,
                current: currentDayIndex,
                onSelect: switchToDay,
                onReorder: reorderDay,
                onDelete: deleteDay
            )
                .padding(.top, 24)

            SectionTitle(text: currentDayTitle)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    if let draft = exerciseDraft, draft.editingID == nil {
                        ExerciseDraftSurface(
                            draft: draftBinding(fallback: draft),
                            step: $exerciseDraftStep,
                            onAdvance: advanceOrSaveExerciseDraft
                        )
                        .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                        .frame(maxWidth: .infinity)
                        .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                    } else if shouldShowSearchSurface {
                        PlanEntrySurface(
                            query: $searchQuery,
                            focused: $searchFocused,
                            results: filteredExercises,
                            onSelect: addExerciseFromSearch
                        )
                        .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                        .frame(maxWidth: .infinity)
                        .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
                    } else if currentDayExercises.isEmpty {
                        EmptyDayState(onAdd: {
                            beginExerciseSearch()
                        })
                    }

                    ForEach(currentDayExercises) { exercise in
                        if let draft = exerciseDraft, draft.editingID == exercise.id {
                            ExerciseDraftSurface(
                                draft: draftBinding(fallback: draft),
                                step: $exerciseDraftStep,
                                onAdvance: advanceOrSaveExerciseDraft
                            )
                            .matchedGeometryEffect(id: exercise.id, in: searchNamespace)
                            .frame(maxWidth: .infinity)
                            .transition(.scale(scale: 0.98, anchor: .top).combined(with: .opacity))
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
                            .matchedGeometryEffect(id: exercise.id, in: searchNamespace)
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            .clipped()

            HStack {
                Spacer()
                if stage == .finalReview && exerciseDraft == nil && !shouldShowSearchSurface {
                    CTAButton(title: "Save Plan", width: 294) {
                        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                            stage = .activatePrompt
                        }
                    }
                    .matchedGeometryEffect(id: "activation-surface", in: activationNamespace)
                } else {
                    Color.clear
                        .frame(width: 294, height: 56)
                }
                Spacer()
            }
            .padding(.bottom, 106)
        }
    }

    private var activationPrompt: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Mark plan as active?")
                    .font(AppFont.subheading)
                Text("Your active workout plan is shown on your home screen.")
                    .font(AppFont.body)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack {
                Button {
                    finish(activate: false)
                } label: {
                    Text("Save to plans")
                        .font(AppFont.subheading)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)
                        .padding(.horizontal, 16)
                        .frame(height: 45)
                        .background(AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(AppColor.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Spacer(minLength: 12)

                Button {
                    finish(activate: true)
                } label: {
                    Text("Save & activate")
                        .font(AppFont.subheading)
                        .foregroundStyle(AppColor.surface1)
                        .lineLimit(1)
                        .padding(.horizontal, 16)
                        .frame(height: 45)
                        .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(24)
        .frame(width: 350)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .matchedGeometryEffect(id: "activation-surface", in: activationNamespace)
        .offset(x: 2, y: 589)
        .zIndex(4)
    }

    private var currentDayTitle: String {
        "Day \(currentDayIndex + 1)"
    }

    private var currentDayExercises: [ExercisePrescription] {
        exercisesForDay(at: currentDayIndex)
    }

    private var isSearchExpanded: Bool {
        !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var shouldShowSearchSurface: Bool {
        exerciseDraft == nil && (isAddingExercise || isSearchExpanded)
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

    private var generatedDays: [WorkoutDay] {
        (0..<daysPerWeek).map { index in
            WorkoutDay(title: "Day \(index + 1)", exercises: exercisesForDay(at: index))
        }
    }

    private func exercisesForDay(at index: Int) -> [ExercisePrescription] {
        guard planDays.indices.contains(index) else {
            return []
        }

        return planDays[index]
    }

    private func startBuildingPlan() {
        planDays = Array(repeating: [], count: daysPerWeek)
        completedDays = 0
        currentDayIndex = 0
        isAddingExercise = false
        resetExerciseEntry()

        withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
            stage = .search
        }
    }

    private func beginExerciseSearch() {
        Haptics.tap(.medium)
        exerciseDraft = nil
        exerciseDraftStep = .sets
        searchQuery = ""
        isAddingExercise = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
            searchFocused = true
        }
    }

    private func addExerciseFromSearch(_ exercise: ExercisePrescription) {
        Haptics.tap(.medium)

        let draft = ExerciseDraft(
            editingID: nil,
            name: exercise.name.planDisplayName,
            sets: exercise.sets,
            reps: exercise.reps
        )

        withAnimation(.spring(response: 0.24, dampingFraction: 0.88)) {
            exerciseDraft = draft
            exerciseDraftStep = .sets
            isAddingExercise = false
            searchQuery = ""
            searchFocused = false
        }
    }

    private func editExercise(_ exercise: ExercisePrescription) {
        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.24, dampingFraction: 0.88)) {
            exerciseDraft = ExerciseDraft(
                editingID: exercise.id,
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps
            )
            exerciseDraftStep = .sets
            isAddingExercise = false
            searchQuery = ""
            searchFocused = false
        }
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
        guard let draft = exerciseDraft else {
            return
        }

        ensurePlanDays()

        let shouldResumeSearch = stage == .search
        var savedExercise = ExercisePrescription(name: draft.name, sets: draft.sets, reps: draft.reps)

        withAnimation(.spring(response: 0.26, dampingFraction: 0.86)) {
            if let editingID = draft.editingID,
               let index = planDays[currentDayIndex].firstIndex(where: { $0.id == editingID }) {
                savedExercise.id = editingID
                planDays[currentDayIndex][index] = savedExercise
            } else {
                planDays[currentDayIndex].append(savedExercise)
            }

            exerciseDraft = nil
            exerciseDraftStep = .sets
            searchQuery = ""
            isAddingExercise = shouldResumeSearch
            searchFocused = false
        }

        if shouldResumeSearch {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                searchFocused = true
            }
        }
    }

    private func saveCurrentDay() {
        guard !currentDayExercises.isEmpty else {
            return
        }

        Haptics.tap(.medium)
        completedDays = max(completedDays, currentDayIndex + 1)
        isAddingExercise = false
        resetExerciseEntry()

        withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
            if currentDayIndex >= daysPerWeek - 1 {
                stage = .finalReview
            } else {
                currentDayIndex += 1
                stage = .search
            }
        }
    }

    private func switchToDay(_ index: Int) {
        guard index >= 0, index < daysPerWeek else {
            return
        }

        Haptics.tap()
        let shouldRemainInReview = stage == .finalReview || stage == .activatePrompt
        isAddingExercise = false
        resetExerciseEntry()

        withAnimation(.spring(response: 0.26, dampingFraction: 0.88)) {
            currentDayIndex = index
            stage = shouldRemainInReview ? .finalReview : .search
        }
    }

    private func deleteExercise(_ id: UUID) {
        guard planDays.indices.contains(currentDayIndex) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.36, dampingFraction: 0.86)) {
            planDays[currentDayIndex].removeAll { $0.id == id }
            if exerciseDraft?.editingID == id {
                exerciseDraft = nil
                exerciseDraftStep = .sets
            }
            if planDays[currentDayIndex].isEmpty {
                completedDays = min(completedDays, currentDayIndex)
            }
        }
    }

    private func reorderExercise(_ draggedID: UUID, before targetID: UUID) {
        guard planDays.indices.contains(currentDayIndex),
              draggedID != targetID,
              let fromIndex = planDays[currentDayIndex].firstIndex(where: { $0.id == draggedID }),
              let targetIndex = planDays[currentDayIndex].firstIndex(where: { $0.id == targetID }) else {
            return
        }

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            let moved = planDays[currentDayIndex].remove(at: fromIndex)
            let adjustedTarget = targetIndex > fromIndex ? targetIndex - 1 : targetIndex
            planDays[currentDayIndex].insert(moved, at: adjustedTarget)
        }
    }

    private func reorderDay(_ fromIndex: Int, to targetIndex: Int) {
        guard planDays.indices.contains(fromIndex),
              planDays.indices.contains(targetIndex),
              fromIndex != targetIndex else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            let movedDay = planDays.remove(at: fromIndex)
            let destination = min(targetIndex, planDays.count)
            planDays.insert(movedDay, at: destination)
            currentDayIndex = adjustedCurrentDay(afterMovingFrom: fromIndex, to: destination)
            completedDays = min(completedDays, daysPerWeek)
        }
    }

    private func deleteDay(_ index: Int) {
        guard daysPerWeek > 1,
              planDays.indices.contains(index) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            planDays.remove(at: index)
            daysPerWeek = planDays.count
            if currentDayIndex > index {
                currentDayIndex -= 1
            } else if currentDayIndex >= daysPerWeek {
                currentDayIndex = max(daysPerWeek - 1, 0)
            }
            if completedDays > index {
                completedDays -= 1
            }
            completedDays = min(completedDays, daysPerWeek)
            resetExerciseEntry()
            isAddingExercise = false
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

    private func finish(activate: Bool) {
        Haptics.tap(.medium)
        let plan = WorkoutPlan(
            name: "Custom Plan",
            daysPerWeek: daysPerWeek,
            createdAt: "30.06.26",
            days: generatedDays
        )
        onFinish(plan, activate)
    }

    private func ensurePlanDays() {
        if planDays.count != daysPerWeek {
            planDays = Array(repeating: [], count: daysPerWeek)
        }
    }

    private func resetExerciseEntry() {
        searchQuery = ""
        searchFocused = false
        exerciseDraft = nil
        exerciseDraftStep = .sets
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
}

enum ExerciseDraftStep: Equatable {
    case sets
    case reps

    var subtitle: String {
        switch self {
        case .sets:
            "Number of sets"
        case .reps:
            "Number of reps"
        }
    }
}

struct ExerciseDraft: Identifiable, Equatable {
    var id = UUID()
    var editingID: UUID?
    var name: String
    var sets: Int
    var reps: Int
}

private struct EmptyDayState: View {
    var onAdd: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("No exercises yet")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)

            Button {
                onAdd()
            } label: {
                HStack(spacing: 16) {
                    Image(systemName: "plus")
                        .font(.system(size: 30, weight: .semibold))
                        .frame(width: 23, height: 23)

                    Text("Add first exercise")
                        .font(AppFont.h1)
                        .lineLimit(1)
                }
                .foregroundStyle(AppColor.primaryText)
                .frame(width: 294, height: 56)
                .background(AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AppColor.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .accessibilityLabel("No exercises yet")
    }
}

struct ExerciseDraftSurface: View {
    @Binding var draft: ExerciseDraft
    @Binding var step: ExerciseDraftStep
    var onAdvance: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(draft.name)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)

                Text(step.subtitle)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 0) {
                HStack(spacing: 0) {
                    DraftRoundButton(symbol: "minus", fill: AppColor.surface2, foreground: AppColor.primaryText, accessibilityLabel: "Decrease \(step.subtitle)") {
                        updateValue(by: -1)
                    }

                    Spacer(minLength: 0)

                    Text("\(currentValue)")
                        .font(AppFont.display)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)
                        .contentTransition(.numericText())
                        .frame(width: 48, height: 45)
                        .accessibilityLabel(step.subtitle)

                    Spacer(minLength: 0)

                    DraftRoundButton(symbol: "plus", fill: AppColor.surface2, foreground: AppColor.primaryText, accessibilityLabel: "Increase \(step.subtitle)") {
                        updateValue(by: 1)
                    }
                }
                .frame(width: 164, height: 45)

                Spacer(minLength: 24)

                DraftRoundButton(symbol: "chevron.right", fill: AppColor.accent, foreground: AppColor.base, strokeWidth: 0, accessibilityLabel: step == .sets ? "Continue to reps" : "Save exercise", action: onAdvance)
            }
            .frame(height: 45)
        }
        .padding(24)
        .frame(maxWidth: .infinity, minHeight: 157, maxHeight: 157, alignment: .topLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: step)
        .animation(.spring(response: 0.2, dampingFraction: 0.88), value: currentValue)
        .accessibilityElement(children: .contain)
    }

    private var currentValue: Int {
        switch step {
        case .sets:
            draft.sets
        case .reps:
            draft.reps
        }
    }

    private func updateValue(by delta: Int) {
        switch step {
        case .sets:
            draft.sets = min(99, max(1, draft.sets + delta))
        case .reps:
            draft.reps = min(99, max(1, draft.reps + delta))
        }
    }
}

private struct DraftRoundButton: View {
    var symbol: String
    var fill: Color
    var foreground: Color
    var stroke: Color = AppColor.border
    var strokeWidth: CGFloat = 1
    var accessibilityLabel: String
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: symbol == "chevron.right" ? 32 : 30, weight: .bold))
                .foregroundStyle(foreground)
                .frame(width: 45, height: 45)
                .background(fill, in: Circle())
                .overlay(
                    Circle()
                        .stroke(stroke, lineWidth: strokeWidth)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

struct EditableExerciseCard: View {
    var exercise: ExercisePrescription
    var onEdit: () -> Void
    var onDelete: () -> Void
    var onReorderBefore: (UUID) -> Void

    @State private var horizontalOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            if horizontalOffset < -1 {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.red.opacity(0.22))
                    .opacity(deleteBackgroundOpacity)
                    .overlay(alignment: .trailing) {
                        Image(systemName: "trash")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(AppColor.primaryText)
                            .padding(.trailing, 22)
                            .opacity(deleteBackgroundOpacity)
                    }
                    .transition(.opacity)
                }

            ExerciseCard(exercise: exercise)
                .offset(x: horizontalOffset)
                .contentShape(Rectangle())
                .onTapGesture {
                    if horizontalOffset < -1 {
                        withAnimation(.spring(response: 0.2, dampingFraction: 0.88)) {
                            horizontalOffset = 0
                        }
                    } else {
                        onEdit()
                    }
                }
                .simultaneousGesture(
                    DragGesture(minimumDistance: 20)
                        .onChanged { value in
                            guard abs(value.translation.width) > abs(value.translation.height) else {
                                return
                            }

                            horizontalOffset = min(0, value.translation.width)
                        }
                        .onEnded { value in
                            guard value.translation.width < -90 else {
                                withAnimation(.spring(response: 0.2, dampingFraction: 0.88)) {
                                    horizontalOffset = 0
                                }
                                return
                            }

                            onDelete()
                        }
                )
        }
        .draggable(exercise.id.uuidString)
        .dropDestination(for: String.self) { items, _ in
            guard let first = items.first, let id = UUID(uuidString: first) else {
                return false
            }

            onReorderBefore(id)
            return true
        }
    }

    private var deleteBackgroundOpacity: Double {
        min(1, max(0, Double(-horizontalOffset / 48)))
    }
}

struct PlanEntrySurface: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var results: [ExercisePrescription]
    var autoFocus = true
    var onSelect: (ExercisePrescription) -> Void

    private var isExpanded: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var resultViewportHeight: CGFloat {
        let visibleRows = max(1, min(results.count, 5))
        return CGFloat(visibleRows * 26 + max(0, visibleRows - 1) * 16)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            searchField

            if isExpanded {
                Rectangle()
                    .fill(AppColor.border)
                    .frame(height: 1)
                    .transition(.opacity)

                ScrollView(showsIndicators: results.count > 5) {
                    VStack(alignment: .leading, spacing: 16) {
                        if results.isEmpty {
                            Text("No matching exercises")
                                .font(AppFont.h2)
                                .foregroundStyle(AppColor.secondaryText)
                                .frame(maxWidth: .infinity, minHeight: 26, alignment: .leading)
                        } else {
                            ForEach(results) { exercise in
                                Button {
                                    onSelect(exercise)
                                } label: {
                                    Text(exercise.name.planDisplayName)
                                        .font(AppFont.h2)
                                        .foregroundStyle(AppColor.primaryText)
                                        .lineLimit(1)
                                        .frame(maxWidth: .infinity, minHeight: 26, alignment: .leading)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .frame(height: resultViewportHeight)
                .scrollDismissesKeyboard(.interactively)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(maxWidth: .infinity, minHeight: 56, alignment: .topLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: isExpanded)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: results.count)
    }

    private var searchField: some View {
        HStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(AppColor.secondaryText)
                .frame(width: 22, height: 22)

            TextField("", text: $query)
                .focused(focused)
                .font(AppFont.h2)
                .tint(AppColor.accent)
                .foregroundStyle(AppColor.primaryText)
                .submitLabel(.search)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Exercise search")
        }
        .frame(maxWidth: .infinity, minHeight: 26, maxHeight: 26, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture {
            focused.wrappedValue = true
        }
        .onAppear {
            guard autoFocus else {
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) {
                focused.wrappedValue = true
            }
        }
    }
}

struct DayStepProgress: View {
    var count: Int
    var completed: Int
    var current: Int
    var selectedOnly = false
    var onSelect: ((Int) -> Void)?
    var onReorder: ((Int, Int) -> Void)?
    var onDelete: ((Int) -> Void)?

    private var barSpacing: CGFloat {
        count <= 4 ? 45 : 12
    }

    private func barWidth(for availableWidth: CGFloat) -> CGFloat {
        if count <= 3 {
            return 90
        }

        if count == 4 {
            return 55
        }

        let safeCount = CGFloat(max(count, 1))
        let usableWidth = availableWidth - (barSpacing * CGFloat(max(count - 1, 0)))
        return floor(max(0, usableWidth) / safeCount)
    }

    var body: some View {
        GeometryReader { proxy in
            HStack(spacing: barSpacing) {
                ForEach(0..<max(count, 1), id: \.self) { index in
                    dayBar(index: index, width: barWidth(for: proxy.size.width))
                }
            }
            .frame(width: proxy.size.width, alignment: .leading)
        }
        .frame(maxWidth: .infinity, minHeight: 24, maxHeight: 24, alignment: .leading)
        .animation(.spring(response: 0.24, dampingFraction: 0.86), value: completed)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: current)
    }

    @ViewBuilder
    private func dayBar(index: Int, width: CGFloat) -> some View {
        let button = Button {
            onSelect?(index)
        } label: {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(fill(for: index))
                .frame(width: width, height: 24)
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(index == current ? AppColor.accent.opacity(0.65) : .clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Day \(index + 1)")

        if onReorder != nil || onDelete != nil {
            button
                .draggable(String(index))
                .dropDestination(for: String.self) { items, _ in
                    guard let rawIndex = items.first,
                          let fromIndex = Int(rawIndex),
                          fromIndex != index else {
                        return false
                    }

                    onReorder?(fromIndex, index)
                    return true
                }
                .simultaneousGesture(deleteSwipe(for: index))
        } else {
            button
        }
    }

    private func deleteSwipe(for index: Int) -> some Gesture {
        DragGesture(minimumDistance: 24)
            .onEnded { value in
                let horizontal = value.translation.width
                let vertical = abs(value.translation.height)
                guard horizontal < -36,
                      abs(horizontal) > vertical * 1.4 else {
                    return
                }

                onDelete?(index)
            }
    }

    private func fill(for index: Int) -> Color {
        if selectedOnly {
            if index == current {
                return AppColor.accent
            }

            return index == current + 1 ? AppColor.surface2 : AppColor.border
        }

        if index < completed {
            return AppColor.accent
        } else if index == current {
            return AppColor.border.opacity(0.88)
        } else {
            return AppColor.border
        }
    }
}

extension String {
    var planDisplayName: String {
        guard let parenthesis = firstIndex(of: "(") else {
            return self
        }

        return String(self[..<parenthesis]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
