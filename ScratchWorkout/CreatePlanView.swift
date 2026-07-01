import SwiftUI

struct CreatePlanView: View {
    enum Stage: String {
        case frequency
        case search
        case configureSets
        case configureReps
        case dayReview
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
    @State private var configuredSets = 3
    @State private var configuredReps = 12
    @State private var selectedExerciseName = "Incline Bench Press"

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
                baseContent

                if stage == .activatePrompt {
                    activationPrompt
                        .transition(.scale(scale: 0.9, anchor: .bottom).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 24)
        }
        .animation(.spring(response: 0.44, dampingFraction: 0.84), value: stage)
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: currentDayIndex)
        .animation(.spring(response: 0.38, dampingFraction: 0.82), value: completedDays)
    }

    @ViewBuilder
    private var baseContent: some View {
        switch stage {
        case .frequency:
            frequencyView
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
        case .search, .configureSets, .configureReps, .dayReview:
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
                CTAButton(title: "Next", width: 294) {
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

            DayStepProgress(count: daysPerWeek, completed: completedDays, current: currentDayIndex, onSelect: switchToDay)
                .padding(.top, 24)

            SectionTitle(text: currentDayTitle)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    if currentDayExercises.isEmpty {
                        EmptyDayState()
                    } else {
                        ForEach(currentDayExercises) { exercise in
                            EditableExerciseCard(
                                exercise: exercise,
                                onDelete: {
                                    deleteExercise(exercise.id)
                                },
                                onReorderBefore: { draggedID in
                                    reorderExercise(draggedID, before: exercise.id)
                                }
                            )
                        }

                        if stage == .search && !isSearchExpanded {
                            CTAButton(title: "Save Day", width: 294) {
                                saveCurrentDay()
                            }
                            .padding(.top, 4)
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                    }
                }
                .padding(.top, 12)
                .padding(.bottom, 16)
            }
            .frame(maxWidth: .infinity)
            .clipped()

            bottomBuilder
                .padding(.bottom, 106)
        }
    }

    @ViewBuilder
    private var bottomBuilder: some View {
        PlanEntrySurface(
            mode: entrySurfaceMode,
            query: $searchQuery,
            focused: $searchFocused,
            results: filteredExercises,
            exercise: selectedExerciseName,
            sets: $configuredSets,
            reps: $configuredReps,
            onSelect: selectExercise,
            onConfirmSets: confirmSets,
            onConfirmReps: addConfiguredExercise
        )
        .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
        .frame(maxWidth: .infinity)
    }

    private var finalReviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Review")
                .font(AppFont.display)
                .padding(.top, 66)

            DayStepProgress(count: daysPerWeek, completed: daysPerWeek, current: currentDayIndex, onSelect: switchToDay)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    ForEach(0..<daysPerWeek, id: \.self) { index in
                        EditableDayReviewSection(
                            title: "Day \(index + 1)",
                            exercises: exercisesForDay(at: index),
                            onSelect: {
                                switchToDay(index)
                            },
                            onDelete: {
                                deleteDay(at: index)
                            },
                            onReorderBefore: { draggedIndex in
                                reorderDay(from: draggedIndex, before: index)
                            }
                        )
                    }
                }
                .padding(.top, 24)
                .padding(.bottom, 24)
            }

            HStack {
                Spacer()
                if stage == .finalReview {
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
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.primaryText)
                        .frame(width: 113, height: 45)
                        .background(AppColor.border, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    finish(activate: true)
                } label: {
                    Text("Save & activate")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.base)
                        .frame(width: 127, height: 45)
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

    private var entrySurfaceMode: PlanEntrySurface.Mode {
        switch stage {
        case .configureSets:
            .sets
        case .configureReps:
            .reps
        default:
            .search(expanded: isSearchExpanded)
        }
    }

    private var filteredExercises: [ExercisePrescription] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !query.isEmpty else {
            return []
        }

        return Array(SampleData.exerciseDatabase.filter {
            $0.name.localizedCaseInsensitiveContains(query)
        }.prefix(8))
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
        resetExerciseEntry()

        withAnimation(.spring(response: 0.46, dampingFraction: 0.82)) {
            stage = .search
        }
    }

    private func selectExercise(_ exercise: ExercisePrescription) {
        Haptics.tap(.medium)
        selectedExerciseName = exercise.name.planDisplayName
        configuredSets = exercise.sets
        configuredReps = exercise.reps
        searchFocused = false

        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
            searchQuery = ""
            stage = .configureSets
        }
    }

    private func confirmSets() {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.82)) {
            stage = .configureReps
        }
    }

    private func addConfiguredExercise() {
        ensurePlanDays()

        let exercise = ExercisePrescription(
            name: selectedExerciseName,
            sets: configuredSets,
            reps: configuredReps
        )
        planDays[currentDayIndex].append(exercise)
        resetExerciseEntry()

        withAnimation(.spring(response: 0.44, dampingFraction: 0.84)) {
            stage = .search
        }
    }

    private func saveCurrentDay() {
        guard !currentDayExercises.isEmpty else {
            return
        }

        Haptics.tap(.medium)
        completedDays = max(completedDays, currentDayIndex + 1)
        resetExerciseEntry()

        withAnimation(.spring(response: 0.46, dampingFraction: 0.84)) {
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
        resetExerciseEntry()

        withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
            currentDayIndex = index
            stage = .search
        }
    }

    private func deleteExercise(_ id: UUID) {
        guard planDays.indices.contains(currentDayIndex) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.36, dampingFraction: 0.86)) {
            planDays[currentDayIndex].removeAll { $0.id == id }
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

    private func deleteDay(at index: Int) {
        guard daysPerWeek > 1, planDays.indices.contains(index) else {
            return
        }

        Haptics.tap(.medium)

        withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) {
            planDays.remove(at: index)
            daysPerWeek -= 1
            currentDayIndex = min(currentDayIndex, daysPerWeek - 1)
            completedDays = min(completedDays, daysPerWeek)
        }
    }

    private func reorderDay(from sourceIndex: Int, before targetIndex: Int) {
        guard planDays.indices.contains(sourceIndex),
              planDays.indices.contains(targetIndex),
              sourceIndex != targetIndex else {
            return
        }

        withAnimation(.spring(response: 0.36, dampingFraction: 0.86)) {
            let moved = planDays.remove(at: sourceIndex)
            let adjustedTarget = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
            planDays.insert(moved, at: adjustedTarget)
            if currentDayIndex == sourceIndex {
                currentDayIndex = adjustedTarget
            }
        }
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
        selectedExerciseName = "Incline Bench Press"
        configuredSets = 3
        configuredReps = 12
        searchFocused = false
    }
}

private struct EmptyDayState: View {
    var body: some View {
        CardShell(height: 84) {
            Text("No exercises yet")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityLabel("No exercises yet")
    }
}

private struct EditableExerciseCard: View {
    var exercise: ExercisePrescription
    var onDelete: () -> Void
    var onReorderBefore: (UUID) -> Void

    @State private var horizontalOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.red.opacity(0.22))
                .overlay(alignment: .trailing) {
                    Image(systemName: "trash")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.primaryText)
                        .padding(.trailing, 22)
                }

            ExerciseCard(exercise: exercise)
                .offset(x: horizontalOffset)
                .contentShape(Rectangle())
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
                                withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
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
}

private struct EditableDayReviewSection: View {
    var title: String
    var exercises: [ExercisePrescription]
    var onSelect: () -> Void
    var onDelete: () -> Void
    var onReorderBefore: (Int) -> Void

    @State private var horizontalOffset: CGFloat = 0

    private var dayIndex: Int {
        let numberText = title.replacingOccurrences(of: "Day ", with: "")
        return max((Int(numberText) ?? 1) - 1, 0)
    }

    var body: some View {
        ZStack(alignment: .trailing) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.red.opacity(0.18))
                .overlay(alignment: .trailing) {
                    Image(systemName: "trash")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(AppColor.primaryText)
                        .padding(.trailing, 22)
                }

            Button(action: onSelect) {
                DayReviewSection(title: title, exercises: exercises)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .offset(x: horizontalOffset)
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
                            withAnimation(.spring(response: 0.28, dampingFraction: 0.86)) {
                                horizontalOffset = 0
                            }
                            return
                        }

                        onDelete()
                    }
            )
        }
        .draggable(String(dayIndex))
        .dropDestination(for: String.self) { items, _ in
            guard let first = items.first, let sourceIndex = Int(first) else {
                return false
            }

            onReorderBefore(sourceIndex)
            return true
        }
    }
}

private struct PlanEntrySurface: View {
    enum Mode: Equatable {
        case search(expanded: Bool)
        case sets
        case reps
    }

    var mode: Mode
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var results: [ExercisePrescription]
    var exercise: String
    @Binding var sets: Int
    @Binding var reps: Int
    var onSelect: (ExercisePrescription) -> Void
    var onConfirmSets: () -> Void
    var onConfirmReps: () -> Void

    var body: some View {
        content
        .animation(.spring(response: 0.4, dampingFraction: 0.84), value: mode)
        .onChange(of: mode) { _, newMode in
            focusSearchIfNeeded(for: newMode)
        }
    }

    @ViewBuilder
    private var content: some View {
        switch mode {
        case .search(let expanded):
            if expanded {
                expandedSearch
            } else {
                searchField
                    .frame(width: 360, height: 54)
                    .transition(.scale(scale: 0.98, anchor: .bottom).combined(with: .opacity))
            }
        case .sets:
            configuration(label: "Number of sets", value: $sets, onConfirm: onConfirmSets)
                .transition(.opacity)
        case .reps:
            configuration(label: "Number of reps", value: $reps, onConfirm: onConfirmReps)
                .transition(.opacity)
        }
    }

    private var expandedSearch: some View {
        VStack(spacing: 0) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 16) {
                    if results.isEmpty {
                        Text("No matching exercises")
                            .font(AppFont.subheading)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                    } else {
                        ForEach(results) { exercise in
                            Button {
                                onSelect(exercise)
                            } label: {
                                Text(exercise.name)
                                    .font(AppFont.subheading)
                                    .foregroundStyle(AppColor.primaryText)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 12)
            }
            .frame(height: 292)

            searchField
                .frame(height: 54)
        }
        .frame(width: 360, height: 360)
        .liquidGlassSurface(cornerRadius: 20, interactive: true)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private var searchField: some View {
        HStack(spacing: 0) {
            TextField("Search to add an exercise", text: $query)
                .focused(focused)
                .font(AppFont.body)
                .tint(AppColor.accent)
                .foregroundStyle(AppColor.primaryText)
                .submitLabel(.search)
                .accessibilityLabel("Exercise search")
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .liquidGlassSurface(cornerRadius: 20, interactive: true)
        .onAppear {
            focusSearchIfNeeded(for: mode)
        }
    }

    private func focusSearchIfNeeded(for mode: Mode) {
        guard case .search(let expanded) = mode, !expanded else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            focused.wrappedValue = true
        }
    }

    private func configuration(label: String, value: Binding<Int>, onConfirm: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(exercise)
                    .font(AppFont.subheading)
                    .lineLimit(1)
                Text(label)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
            }
            .frame(width: 150, alignment: .leading)

            HStack(alignment: .center) {
                HStack(spacing: 16) {
                    RoundStepButton(symbol: "minus", fill: AppColor.border, accessibilityLabel: "Decrease \(label.lowercased())") {
                        value.wrappedValue = max(1, value.wrappedValue - 1)
                    }

                    Text("\(value.wrappedValue)")
                        .font(AppFont.display)
                        .frame(width: 42)
                        .contentTransition(.numericText())

                    RoundStepButton(symbol: "plus", fill: AppColor.border, accessibilityLabel: "Increase \(label.lowercased())") {
                        value.wrappedValue = min(30, value.wrappedValue + 1)
                    }
                }

                Spacer()

                Button {
                    Haptics.tap(.medium)
                    onConfirm()
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(AppColor.base)
                        .frame(width: 45, height: 45)
                        .background(AppColor.accent, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Confirm \(label.lowercased())")
            }
        }
        .padding(24)
        .frame(width: 360, height: 153, alignment: .topLeading)
        .liquidGlassSurface(cornerRadius: 20, interactive: true)
        .animation(.spring(response: 0.38, dampingFraction: 0.82), value: value.wrappedValue)
    }
}

private struct DayStepProgress: View {
    var count: Int
    var completed: Int
    var current: Int
    var onSelect: ((Int) -> Void)?

    private var barSpacing: CGFloat {
        count <= 3 ? 45 : 12
    }

    private var barWidth: CGFloat {
        let safeCount = CGFloat(max(count, 1))
        let availableWidth = 360 - (barSpacing * CGFloat(max(count - 1, 0)))
        return floor(availableWidth / safeCount)
    }

    var body: some View {
        HStack(spacing: barSpacing) {
            ForEach(0..<max(count, 1), id: \.self) { index in
                Button {
                    onSelect?(index)
                } label: {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(fill(for: index))
                        .frame(width: barWidth, height: 24)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(index == current ? AppColor.accent.opacity(0.65) : .clear, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .disabled(onSelect == nil)
                .accessibilityLabel("Day \(index + 1)")
            }
        }
        .frame(width: 360, alignment: .leading)
        .animation(.spring(response: 0.38, dampingFraction: 0.78), value: completed)
        .animation(.spring(response: 0.34, dampingFraction: 0.82), value: current)
    }

    private func fill(for index: Int) -> Color {
        if index < completed {
            AppColor.accent
        } else if index == current {
            AppColor.border.opacity(0.88)
        } else {
            AppColor.border
        }
    }
}

private struct DayReviewSection: View {
    var title: String
    var exercises: [ExercisePrescription]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(text: title)

            VStack(spacing: 12) {
                ForEach(exercises) { exercise in
                    ExerciseCard(exercise: exercise)
                }
            }
        }
    }
}

private extension View {
    func liquidGlassSurface(cornerRadius: CGFloat, interactive: Bool = false) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        return self
            .background(.ultraThinMaterial, in: shape)
            .background(AppColor.surface1.opacity(interactive ? 0.76 : 0.84), in: shape)
            .overlay(
                shape
                    .stroke(AppColor.border.opacity(interactive ? 0.72 : 1), lineWidth: 1)
            )
    }
}

private extension String {
    var planDisplayName: String {
        guard let parenthesis = firstIndex(of: "(") else {
            return self
        }

        return String(self[..<parenthesis]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
