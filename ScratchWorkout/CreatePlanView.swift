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
                        .transition(.move(edge: .bottom).combined(with: .opacity))
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

            DayStepProgress(count: daysPerWeek, completed: completedDays)
                .padding(.top, 24)

            SectionTitle(text: currentDayTitle)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    ForEach(currentDayExercises) { exercise in
                        ExerciseCard(exercise: exercise)
                    }
                }
                .padding(.top, currentDayExercises.isEmpty ? 0 : 12)
                .padding(.bottom, 16)
            }
            .frame(maxHeight: 302)

            Spacer(minLength: 16)

            bottomBuilder
                .padding(.bottom, 106)
        }
    }

    @ViewBuilder
    private var bottomBuilder: some View {
        VStack(spacing: 12) {
            Group {
                switch stage {
                case .configureSets:
                    ExerciseConfigCard(
                        exercise: selectedExerciseName,
                        label: "Number of sets",
                        value: $configuredSets,
                        onConfirm: confirmSets
                    )
                    .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                case .configureReps:
                    ExerciseConfigCard(
                        exercise: selectedExerciseName,
                        label: "Number of reps",
                        value: $configuredReps,
                        onConfirm: addConfiguredExercise
                    )
                    .matchedGeometryEffect(id: "plan-entry-surface", in: searchNamespace)
                default:
                    SearchSurface(
                        query: $searchQuery,
                        focused: $searchFocused,
                        namespace: searchNamespace,
                        results: filteredExercises,
                        isExpanded: isSearchExpanded,
                        onSelect: selectExercise
                    )
                }
            }
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .scale(scale: 0.96, anchor: .bottom)),
                removal: .opacity.combined(with: .scale(scale: 0.98, anchor: .bottom))
            ))

            if stage == .search && !currentDayExercises.isEmpty && !isSearchExpanded {
                CTAButton(title: "Save Day", width: 294) {
                    saveCurrentDay()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var finalReviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Review")
                .font(AppFont.display)
                .padding(.top, 66)

            DayStepProgress(count: daysPerWeek, completed: daysPerWeek)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    ForEach(0..<daysPerWeek, id: \.self) { index in
                        DayReviewSection(
                            title: "Day \(index + 1)",
                            exercises: exercisesForDay(at: index)
                        )
                    }
                }
                .padding(.top, 24)
                .padding(.bottom, 24)
            }

            HStack {
                Spacer()
                CTAButton(title: "Save Plan", width: 294) {
                    withAnimation(.spring(response: 0.42, dampingFraction: 0.84)) {
                        stage = .activatePrompt
                    }
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

private struct SearchSurface: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var namespace: Namespace.ID
    var results: [ExercisePrescription]
    var isExpanded: Bool
    var onSelect: (ExercisePrescription) -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 18) {
                content
            }
        } else {
            content
        }
    }

    @ViewBuilder
    private var content: some View {
        if isExpanded {
            expanded
        } else {
            fieldOnly
        }
    }

    private var fieldOnly: some View {
        searchField
            .matchedGeometryEffect(id: "plan-entry-surface", in: namespace)
            .frame(width: 360, height: 54)
            .transition(.scale(scale: 0.98, anchor: .bottom).combined(with: .opacity))
    }

    private var expanded: some View {
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
        .matchedGeometryEffect(id: "plan-entry-surface", in: namespace)
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
            DispatchQueue.main.async {
                focused.wrappedValue = true
            }
        }
    }
}

private struct ExerciseConfigCard: View {
    var exercise: String
    var label: String
    @Binding var value: Int
    var onConfirm: () -> Void

    var body: some View {
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
                        value = max(1, value - 1)
                    }

                    Text("\(value)")
                        .font(AppFont.display)
                        .frame(width: 42)
                        .contentTransition(.numericText())

                    RoundStepButton(symbol: "plus", fill: AppColor.border, accessibilityLabel: "Increase \(label.lowercased())") {
                        value = min(30, value + 1)
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
    }
}

private struct DayStepProgress: View {
    var count: Int
    var completed: Int

    private var barSpacing: CGFloat {
        count <= 3 ? 45 : 12
    }

    private var barWidth: CGFloat {
        let safeCount = CGFloat(max(count, 1))
        let availableWidth = 360 - (barSpacing * CGFloat(max(count - 1, 0)))
        return floor(availableWidth / safeCount)
    }

    var body: some View {
        StepProgress(
            count: max(count, 1),
            active: min(completed, count),
            width: barWidth,
            spacing: barSpacing
        )
        .frame(width: 360, alignment: .leading)
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
    @ViewBuilder
    func liquidGlassSurface(cornerRadius: CGFloat, interactive: Bool = false) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        if #available(iOS 26.0, *) {
            self
                .background(AppColor.surface1.opacity(0.18), in: shape)
                .glassEffect(glassEffect(interactive: interactive), in: shape)
                .overlay(
                    shape
                        .stroke(AppColor.border.opacity(0.72), lineWidth: 1)
                )
        } else {
            self
                .background(.ultraThinMaterial, in: shape)
                .background(AppColor.surface1.opacity(0.82), in: shape)
                .overlay(
                    shape
                        .stroke(AppColor.border, lineWidth: 1)
                )
        }
    }

    @available(iOS 26.0, *)
    private func glassEffect(interactive: Bool) -> Glass {
        let glass = Glass.regular.tint(AppColor.surface1.opacity(0.24))
        return interactive ? glass.interactive() : glass
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
