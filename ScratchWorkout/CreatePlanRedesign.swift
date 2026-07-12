import SwiftUI

struct CreatePlanView: View {
    enum Stage: String {
        case frequency
        case composer
        case search
        case finalReview
        case activatePrompt
    }

    var onFinish: (WorkoutPlan, Bool) -> Void
    var onSaveCustomExercise: (CustomExerciseDefinition) -> Void
    private let exerciseCatalog: any ExerciseCatalogService

    @Namespace private var searchCardNamespace
    @FocusState private var searchFocused: Bool
    @FocusState private var dayNameFocused: Bool
    @FocusState private var customNameFocused: Bool
    @State private var stage: Stage
    @State private var daysPerWeek: Int
    @State private var currentDayIndex = 0
    @State private var completedDays = 0
    @State private var planDays: [[ExercisePrescription]]
    @State private var dayNames: [String]
    @State private var searchQuery: String
    @State private var searchResults: [ExercisePrescription] = []
    @State private var searchState: PlanEntrySearchState = .idle
    @State private var configurationDraft: PlanExerciseConfigurationDraft?
    @State private var customExercises: [CustomExerciseDefinition]
    @State private var customRoute: CustomExerciseRoute?
    @State private var customName = ""
    @State private var customEquipment: String?
    @State private var customMuscle: String?
    @State private var customType: CustomExerciseType?
    @State private var customTrackingMode: ExerciseTrackingMode?
    @State private var stageDirection: AppNavigationDirection = .forward
    @State private var daySlideDirection: AppNavigationDirection = .forward
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        initialStage: Stage = .frequency,
        daysPerWeek: Int = 3,
        searchQuery: String = "",
        customExercises: [CustomExerciseDefinition] = [],
        exerciseCatalog: any ExerciseCatalogService = ExerciseCatalogServiceFactory.live(),
        onSaveCustomExercise: @escaping (CustomExerciseDefinition) -> Void = { _ in },
        onFinish: @escaping (WorkoutPlan, Bool) -> Void
    ) {
        let safeDayCount = min(7, max(1, daysPerWeek))
        let seededDays: [[ExercisePrescription]]
        let seededNames: [String]
        let seededCompletedDays: Int

        if initialStage == .finalReview || initialStage == .activatePrompt {
            let sampleDays = Array(SampleData.activePlan.days.prefix(safeDayCount))
            seededDays = sampleDays.map(\.exercises) + Array(repeating: [], count: max(0, safeDayCount - sampleDays.count))
            seededNames = sampleDays.map(\.title) + (sampleDays.count..<safeDayCount).map { "Day \($0 + 1)" }
            seededCompletedDays = safeDayCount
        } else {
            seededDays = Array(repeating: [], count: safeDayCount)
            seededNames = (0..<safeDayCount).map { "Day \($0 + 1)" }
            seededCompletedDays = 0
        }

        self.onFinish = onFinish
        self.onSaveCustomExercise = onSaveCustomExercise
        self.exerciseCatalog = exerciseCatalog
        _stage = State(initialValue: initialStage)
        _daysPerWeek = State(initialValue: safeDayCount)
        _planDays = State(initialValue: seededDays)
        _dayNames = State(initialValue: seededNames)
        _completedDays = State(initialValue: seededCompletedDays)
        _searchQuery = State(initialValue: searchQuery)
        _customExercises = State(initialValue: customExercises)
    }

    var body: some View {
        AppScreen {
            ZStack(alignment: .topLeading) {
                content

                if stage == .activatePrompt {
                    activationPrompt
                        .transition(activationTransition)
                        .zIndex(10)
                }
            }
            .padding(.horizontal, 24)
        }
        .task(id: searchTaskID) {
            await updateExerciseSearch()
        }
        .onChange(of: stage) { _, newValue in
            if newValue == .search, customRoute == nil {
                focusSearch()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        Group {
            switch stage {
            case .frequency:
                frequencyView
            case .composer:
                composerView
            case .search:
                if let customRoute {
                    customExerciseView(route: customRoute)
                } else {
                    exerciseSearchView
                }
            case .finalReview, .activatePrompt:
                reviewView
            }
        }
        .id(contentIdentity)
        .transition(AppScreenTransition.slide(stageDirection, reduceMotion: reduceMotion))
        .animation(navigationAnimation, value: contentIdentity)
    }

    private var contentIdentity: String {
        if let customRoute {
            return "custom-\(customRoute.rawValue)"
        }
        return stage.rawValue
    }

    private var frequencyView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenTitle(title: "Create Plan")
                .padding(.top, AppLayout.screenTitleTopPadding)

            Spacer(minLength: 0)

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
                .frame(maxWidth: .infinity)

                Text("Workouts per week")
                    .font(AppFont.h1)
                    .frame(maxWidth: .infinity)
            }

            Spacer(minLength: 0)
        }
        .floatingBottomChrome {
            CTAButton(title: "Next", width: 312, action: startComposing)
        }
    }

    private var composerView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenTitleBar(title: "Create Plan") {
                Button(action: openExerciseSearch) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(AppColor.primaryText)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.94))
                .accessibilityLabel("Add exercise")
            }
            .padding(.top, AppLayout.screenTitleTopPadding)

            DayStepProgress(
                count: daysPerWeek,
                completed: completedDays,
                current: currentDayIndex,
                onSelect: switchToDay,
                onReorder: reorderDay,
                onDelete: deleteDay
            )
            .padding(.top, 24)

            HStack(spacing: 4) {
                TextField("Day \(currentDayIndex + 1)", text: currentDayNameBinding)
                    .focused($dayNameFocused)
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .tint(AppColor.accent)
                    .submitLabel(.done)
                    .disabled(!dayNameFocused)

                Button {
                    dayNameFocused = true
                } label: {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.94))
                .accessibilityLabel("Edit day name")
            }
            .frame(height: AppLayout.sectionTitleHeight)
            .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    if currentDayExercises.isEmpty {
                        RedesignedEmptyDayState(onAdd: openExerciseSearch)
                    } else {
                        ForEach(currentDayExercises) { exercise in
                            PlanExerciseSummaryCard(
                                exercise: exercise,
                                onEdit: { editExercise(exercise) },
                                onDelete: { deleteExercise(exercise.id) }
                            )
                        }

                        PlanAddExerciseButton(action: openExerciseSearch)
                    }
                }
                .padding(.top, 12)
                .padding(.bottom, composerBottomPadding)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .floatingBottomChrome(isVisible: !currentDayExercises.isEmpty) {
            CTAButton(title: "Save Day", width: 312, action: saveCurrentDay)
        }
    }

    private var exerciseSearchView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenNavigationTitle(title: "Create Plan", backAccessibilityLabel: "Back to plan", onBack: returnToComposer)
                .padding(.top, AppLayout.screenTitleTopPadding)

            Text("Add exercise")
                .font(AppFont.h2)
                .padding(.top, 24)

            RedesignedExerciseSearchField(query: $searchQuery, focused: $searchFocused)
                .padding(.top, 12)

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    if searchState == .loading && displayedSearchExercises.isEmpty {
                        ProgressView()
                            .tint(AppColor.accent)
                            .frame(maxWidth: .infinity, minHeight: 88)
                    }

                    ForEach(displayedSearchExercises) { exercise in
                        if configurationDraft?.source.id == exercise.id,
                           let draft = configurationDraft {
                            ExerciseSearchConfigurationCard(
                                draft: configurationBinding(fallback: draft),
                                onAdvance: advanceConfiguration
                            )
                            .matchedGeometryEffect(id: exercise.id, in: searchCardNamespace)
                        } else {
                            ExerciseSearchResultCard(exercise: exercise) {
                                configure(exercise)
                            }
                            .matchedGeometryEffect(id: exercise.id, in: searchCardNamespace)
                        }
                    }

                    if displayedSearchExercises.isEmpty && searchState != .loading {
                        Text(searchEmptyMessage)
                            .font(AppFont.body)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(maxWidth: .infinity, minHeight: 72, alignment: .center)
                    }

                    Button(action: beginCustomExercise) {
                        Text("Add custom exercise")
                            .font(AppFont.label)
                            .foregroundStyle(AppColor.primaryText)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 48)
                            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(AppColor.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Text("Exercise data by ExerciseDB")
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
                .padding(.top, 8)
                .padding(.bottom, AppLayout.bottomChromePadding(usesNativeTabBar: usesNativeTabBar) + 24)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var reviewView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenTitle(title: "Review")
                .padding(.top, AppLayout.screenTitleTopPadding)

            DayStepProgress(
                count: daysPerWeek,
                completed: daysPerWeek,
                current: currentDayIndex,
                selectedOnly: true,
                onSelect: switchReviewDay
            )
            .padding(.top, 24)

            SectionTitle(text: currentDayName)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    ForEach(currentDayExercises) { exercise in
                        PlanExerciseSummaryCard(exercise: exercise, onEdit: {}, onDelete: nil)
                    }
                }
                .padding(.top, 12)
                .padding(.bottom, composerBottomPadding)
            }
        }
        .floatingBottomChrome(isVisible: stage == .finalReview) {
            CTAButton(title: "Save Plan", width: 312) {
                withAnimation(cardExpansionAnimation) {
                    stage = .activatePrompt
                }
            }
        }
    }

    private var activationPrompt: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Mark plan as active?")
                    .font(AppFont.subheading)
                Text("Your active workout plan is shown on your home screen.")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
            }

            HStack(spacing: 12) {
                activationButton(title: "Save to plans", isPrimary: false) { finish(activate: false) }
                activationButton(title: "Save & activate", isPrimary: true) { finish(activate: true) }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .padding(.top, 580)
    }

    private func activationButton(title: String, isPrimary: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(AppFont.label)
                .foregroundStyle(isPrimary ? AppColor.base : AppColor.primaryText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 45)
                .background(isPrimary ? AppColor.accent : AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(AppPressFeedbackStyle())
    }

    @ViewBuilder
    private func customExerciseView(route: CustomExerciseRoute) -> some View {
        switch route {
        case .details:
            customDetailsView
        case .equipment:
            customEquipmentView
        case .muscle:
            customMuscleView
        case .type:
            customTypeView
        case .metrics:
            customMetricsView
        }
    }

    private var customDetailsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenNavigationTitle(title: "Custom Exercise", backAccessibilityLabel: "Back to exercise search", onBack: leaveCustomExercise)
                .padding(.top, AppLayout.screenTitleTopPadding)

            Text("Name")
                .font(AppFont.h2)
                .padding(.top, 24)

            TextField("Exercise name", text: $customName)
                .focused($customNameFocused)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.primaryText)
                .tint(AppColor.accent)
                .submitLabel(.done)
                .padding(.horizontal, 16)
                .frame(height: 54)
                .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AppColor.border, lineWidth: 1)
                )
                .padding(.top, 12)

            VStack(spacing: 12) {
                CustomExercisePropertyRow(symbol: "dumbbell.fill", title: "Equipment", value: customEquipment) { customRoute = .equipment }
                CustomExercisePropertyRow(symbol: "figure.arms.open", title: "Muscle", value: customMuscle) { customRoute = .muscle }
                CustomExercisePropertyRow(symbol: "tag.fill", title: "Type", value: customType?.title) { customRoute = .type }
                CustomExercisePropertyRow(symbol: "chart.bar.fill", title: "Metrics", value: customTrackingMode?.title) { customRoute = .metrics }
            }
            .padding(.top, 12)

            Spacer(minLength: 0)
        }
        .floatingBottomChrome {
            CTAButton(title: "Save", width: 312, action: saveCustomExercise)
                .disabled(!isCustomExerciseValid)
                .opacity(isCustomExerciseValid ? 1 : 0.45)
        }
    }

    private var customEquipmentView: some View {
        customPickerShell(title: "Choose Equipment", onBack: { customRoute = .details }) {
            LazyVGrid(columns: twoColumnGrid, spacing: 12) {
                ForEach(CustomExerciseAssets.equipment) { option in
                    VisualPickerTile(option: option, isSelected: customEquipment == option.title) {
                        customEquipment = option.title
                        customRoute = .details
                    }
                }
            }
        }
    }

    private var customMuscleView: some View {
        customPickerShell(title: "Choose Muscle", onBack: { customRoute = .details }) {
            LazyVGrid(columns: fourColumnGrid, spacing: 12) {
                ForEach(CustomExerciseAssets.muscles) { option in
                    VisualPickerTile(option: option, isSelected: customMuscle == option.title, compact: true) {
                        customMuscle = option.title
                        customRoute = .details
                    }
                }
            }
        }
    }

    private var customTypeView: some View {
        customPickerShell(title: "Choose Type", onBack: { customRoute = .details }) {
            LazyVGrid(columns: twoColumnGrid, spacing: 16) {
                ForEach(CustomExerciseType.allCases) { type in
                    Button {
                        customType = type
                        customRoute = .details
                    } label: {
                        VStack(spacing: 12) {
                            Image(systemName: type.symbol)
                                .font(.system(size: 26, weight: .semibold))
                                .foregroundStyle(AppColor.base)
                                .frame(width: 44, height: 44)
                                .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                            Text(type.title)
                                .font(AppFont.h2)
                                .foregroundStyle(AppColor.primaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 118)
                        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(customType == type ? AppColor.accent : AppColor.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(AppPressFeedbackStyle())
                }
            }
        }
    }

    private var customMetricsView: some View {
        customPickerShell(title: "Choose Metrics", onBack: { customRoute = .details }) {
            LazyVStack(spacing: 8) {
                ForEach(ExerciseTrackingMode.allCases) { mode in
                    Button {
                        customTrackingMode = mode
                        customRoute = .details
                    } label: {
                        VStack(spacing: 4) {
                            Text(mode.title)
                                .font(AppFont.subheading)
                                .foregroundStyle(AppColor.primaryText)
                            Text(mode.example)
                                .font(AppFont.label)
                                .foregroundStyle(AppColor.secondaryText)
                        }
                        .frame(maxWidth: .infinity, minHeight: 72)
                        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(customTrackingMode == mode ? AppColor.accent : AppColor.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
                }
            }
        }
    }

    private func customPickerShell<Content: View>(
        title: String,
        onBack: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenNavigationTitle(title: "Custom Exercise", backAccessibilityLabel: "Back to custom exercise", onBack: onBack)
                .padding(.top, AppLayout.screenTitleTopPadding)

            Text(title)
                .font(AppFont.h2)
                .padding(.top, 24)

            ScrollView(showsIndicators: false) {
                content()
                    .padding(.top, 12)
                    .padding(.bottom, AppLayout.bottomChromePadding(usesNativeTabBar: usesNativeTabBar) + 24)
            }
        }
    }

    private var twoColumnGrid: [GridItem] {
        [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    }

    private var fourColumnGrid: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)
    }

    private var searchTaskID: String {
        "\(stage.rawValue)-\(customRoute?.rawValue ?? "none")-\(searchQuery)"
    }

    private var currentDayExercises: [ExercisePrescription] {
        guard planDays.indices.contains(currentDayIndex) else { return [] }
        return planDays[currentDayIndex]
    }

    private var currentDayName: String {
        guard dayNames.indices.contains(currentDayIndex) else { return "Day \(currentDayIndex + 1)" }
        let trimmed = dayNames[currentDayIndex].trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Day \(currentDayIndex + 1)" : trimmed
    }

    private var currentDayNameBinding: Binding<String> {
        Binding(
            get: { currentDayName },
            set: { newValue in
                guard dayNames.indices.contains(currentDayIndex) else { return }
                dayNames[currentDayIndex] = newValue
            }
        )
    }

    private var composerBottomPadding: CGFloat {
        AppLayout.floatingBottomChromeClearance(usesNativeTabBar: usesNativeTabBar)
    }

    private var navigationAnimation: Animation {
        AppNavigationAnimation.push(reduceMotion: reduceMotion)
    }

    private var cardExpansionAnimation: Animation {
        reduceMotion ? AppNavigationAnimation.reduced : .spring(response: 0.24, dampingFraction: 0.96)
    }

    private var activationTransition: AnyTransition {
        reduceMotion
            ? .opacity
            : .scale(scale: 0.94, anchor: .bottom).combined(with: .opacity)
    }

    private var displayedSearchExercises: [ExercisePrescription] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let customMatches = customExercises
            .filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }
            .map { $0.prescription() }
        var seen = Set<String>()
        var exercises = (customMatches + searchResults).filter { exercise in
            let key = exercise.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            return seen.insert(key).inserted
        }

        if let configuredSource = configurationDraft?.source {
            let configuredKey = configuredSource.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            if let index = exercises.firstIndex(where: {
                $0.id == configuredSource.id ||
                    $0.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) == configuredKey
            }) {
                exercises[index] = configuredSource
            } else {
                exercises.append(configuredSource)
            }
        }

        return exercises
    }

    private var searchEmptyMessage: String {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            return customExercises.isEmpty ? "Search the exercise catalog" : "No saved custom exercises"
        }
        if case .message(let message) = searchState { return message }
        return "No matching exercises"
    }

    private var isCustomExerciseValid: Bool {
        !customName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            customEquipment != nil && customMuscle != nil && customType != nil && customTrackingMode != nil
    }

    private func startComposing() {
        planDays = Array(repeating: [], count: daysPerWeek)
        dayNames = (0..<daysPerWeek).map { "Day \($0 + 1)" }
        currentDayIndex = 0
        completedDays = 0
        stageDirection = .forward
        withAnimation(navigationAnimation) { stage = .composer }
    }

    private func openExerciseSearch() {
        Haptics.tap(.medium)
        configurationDraft = nil
        searchQuery = ""
        searchResults = []
        searchState = .idle
        customRoute = nil
        stageDirection = .forward
        withAnimation(navigationAnimation) { stage = .search }
    }

    private func returnToComposer() {
        searchFocused = false
        configurationDraft = nil
        stageDirection = .backward
        withAnimation(navigationAnimation) { stage = .composer }
    }

    private func focusSearch() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { searchFocused = true }
    }

    private func configure(_ exercise: ExercisePrescription, editingID: UUID? = nil) {
        Haptics.tap(.medium)
        withAnimation(cardExpansionAnimation) {
            configurationDraft = PlanExerciseConfigurationDraft(exercise: exercise, editingID: editingID)
        }
        searchFocused = false
    }

    private func editExercise(_ exercise: ExercisePrescription) {
        searchQuery = exercise.name
        searchResults = [exercise]
        customRoute = nil
        stageDirection = .forward
        stage = .search
        configure(exercise, editingID: exercise.id)
    }

    private func advanceConfiguration() {
        guard var draft = configurationDraft else { return }
        Haptics.tap(.medium)
        if draft.stepIndex < draft.steps.count - 1 {
            draft.stepIndex += 1
            withAnimation(cardExpansionAnimation) { configurationDraft = draft }
        } else {
            saveConfiguration(draft)
        }
    }

    private func saveConfiguration(_ draft: PlanExerciseConfigurationDraft) {
        var exercise = draft.configuredExercise
        guard planDays.indices.contains(currentDayIndex) else { return }

        if let editingID = draft.editingID,
           let index = planDays[currentDayIndex].firstIndex(where: { $0.id == editingID }) {
            exercise.id = editingID
            planDays[currentDayIndex][index] = exercise
        } else {
            planDays[currentDayIndex].append(exercise)
        }

        Task { await exerciseCatalog.recordSelection(exercise) }
        returnToComposer()
    }

    private func configurationBinding(fallback: PlanExerciseConfigurationDraft) -> Binding<PlanExerciseConfigurationDraft> {
        Binding(get: { configurationDraft ?? fallback }, set: { configurationDraft = $0 })
    }

    private func saveCurrentDay() {
        guard !currentDayExercises.isEmpty else { return }
        completedDays = max(completedDays, currentDayIndex + 1)
        if currentDayIndex >= daysPerWeek - 1 {
            stageDirection = .forward
            withAnimation(navigationAnimation) { stage = .finalReview }
        } else {
            daySlideDirection = .forward
            currentDayIndex += 1
        }
    }

    private func switchToDay(_ index: Int) {
        guard planDays.indices.contains(index) else { return }
        daySlideDirection = .forIndexChange(from: currentDayIndex, to: index)
        currentDayIndex = index
    }

    private func switchReviewDay(_ index: Int) {
        guard planDays.indices.contains(index) else { return }
        currentDayIndex = index
    }

    private func deleteExercise(_ id: UUID) {
        guard planDays.indices.contains(currentDayIndex) else { return }
        withAnimation(cardExpansionAnimation) {
            planDays[currentDayIndex].removeAll { $0.id == id }
        }
    }

    private func reorderDay(_ fromIndex: Int, to targetIndex: Int) {
        guard planDays.indices.contains(fromIndex), planDays.indices.contains(targetIndex), fromIndex != targetIndex else { return }
        let movedExercises = planDays.remove(at: fromIndex)
        let movedName = dayNames.remove(at: fromIndex)
        planDays.insert(movedExercises, at: targetIndex)
        dayNames.insert(movedName, at: targetIndex)
        currentDayIndex = targetIndex
    }

    private func deleteDay(_ index: Int) {
        guard daysPerWeek > 1, planDays.indices.contains(index), dayNames.indices.contains(index) else { return }
        planDays.remove(at: index)
        dayNames.remove(at: index)
        daysPerWeek -= 1
        currentDayIndex = min(currentDayIndex, daysPerWeek - 1)
        completedDays = min(completedDays, daysPerWeek)
    }

    private func beginCustomExercise() {
        searchFocused = false
        configurationDraft = nil
        customName = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        customEquipment = nil
        customMuscle = nil
        customType = nil
        customTrackingMode = nil
        customRoute = .details
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { customNameFocused = customName.isEmpty }
    }

    private func leaveCustomExercise() {
        customNameFocused = false
        customRoute = nil
        focusSearch()
    }

    private func saveCustomExercise() {
        guard isCustomExerciseValid,
              let equipment = customEquipment,
              let muscle = customMuscle,
              let type = customType,
              let trackingMode = customTrackingMode else { return }

        let definition = CustomExerciseDefinition(
            name: customName.trimmingCharacters(in: .whitespacesAndNewlines),
            equipment: equipment,
            muscle: muscle,
            exerciseType: type,
            trackingMode: trackingMode
        )
        customExercises.removeAll { $0.id == definition.id || $0.name.caseInsensitiveCompare(definition.name) == .orderedSame }
        customExercises.insert(definition, at: 0)
        onSaveCustomExercise(definition)
        searchQuery = definition.name
        searchResults = []
        customRoute = nil
        configure(definition.prescription())
    }

    private func updateExerciseSearch() async {
        guard stage == .search, customRoute == nil else { return }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            searchResults = []
            searchState = .idle
            return
        }

        searchState = .loading
        do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
        guard !Task.isCancelled else { return }
        let response = await exerciseCatalog.search(query: query)
        guard !Task.isCancelled else { return }
        searchResults = response.exercises
        if response.exercises.isEmpty {
            searchState = .message(response.notice?.message ?? "No matching exercises")
        } else if let notice = response.notice {
            searchState = .message(notice.message)
        } else {
            searchState = .loaded
        }
    }

    private func finish(activate: Bool) {
        let days = planDays.indices.map { index in
            WorkoutDay(title: dayNames.indices.contains(index) ? dayNames[index] : "Day \(index + 1)", exercises: planDays[index])
        }
        let plan = WorkoutPlan(name: "Custom Plan", daysPerWeek: daysPerWeek, createdAt: Self.todayFormatted, days: days)
        onFinish(plan, activate)
    }

    private static var todayFormatted: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd.MM.yy"
        return formatter.string(from: Date())
    }
}

private enum CustomExerciseRoute: String {
    case details
    case equipment
    case muscle
    case type
    case metrics
}

private enum PlanConfigurationStep: Equatable {
    case sets
    case metric(ExercisePrescriptionMetric)

    var title: String {
        switch self {
        case .sets: "Number of sets"
        case .metric(let metric): metric.editorTitle
        }
    }
}

private struct PlanExerciseConfigurationDraft: Equatable {
    var editingID: UUID?
    var source: ExercisePrescription
    var stepIndex = 0
    var sets: Int
    var reps: Int
    var targetWeight: Int
    var targetCounterweight: Int
    var durationSeconds: Int
    var distanceMeters: Int

    init(exercise: ExercisePrescription, editingID: UUID? = nil) {
        self.editingID = editingID
        source = exercise
        sets = exercise.sets
        reps = max(1, exercise.reps)
        targetWeight = exercise.targetWeight ?? 20
        targetCounterweight = exercise.targetCounterweight ?? 20
        durationSeconds = exercise.durationSeconds ?? 30
        distanceMeters = exercise.distanceMeters ?? 100
    }

    var steps: [PlanConfigurationStep] {
        let metrics: [ExercisePrescriptionMetric]
        if source.customExerciseID == nil {
            metrics = [.reps]
        } else {
            metrics = source.trackingMode.prescriptionMetrics
        }
        return [.sets] + metrics.map(PlanConfigurationStep.metric)
    }

    var currentStep: PlanConfigurationStep {
        steps[min(stepIndex, steps.count - 1)]
    }

    var currentValue: Int {
        get {
            switch currentStep {
            case .sets: sets
            case .metric(.weight): targetWeight
            case .metric(.counterweight): targetCounterweight
            case .metric(.reps): reps
            case .metric(.duration): durationSeconds
            case .metric(.distance): distanceMeters
            }
        }
        set {
            switch currentStep {
            case .sets: sets = newValue
            case .metric(.weight): targetWeight = newValue
            case .metric(.counterweight): targetCounterweight = newValue
            case .metric(.reps): reps = newValue
            case .metric(.duration): durationSeconds = newValue
            case .metric(.distance): distanceMeters = newValue
            }
        }
    }

    var currentStepAmount: Int {
        switch currentStep {
        case .sets: 1
        case .metric(let metric): metric.step
        }
    }

    var currentMaximum: Int {
        switch currentStep {
        case .sets: 99
        case .metric(let metric): metric.maximum
        }
    }

    var isLastStep: Bool { stepIndex >= steps.count - 1 }

    var configuredExercise: ExercisePrescription {
        var exercise = source
        exercise.sets = sets
        exercise.reps = source.trackingMode.prescriptionMetrics.contains(.reps) || source.customExerciseID == nil ? reps : 0
        exercise.targetWeight = source.customExerciseID != nil && source.trackingMode.prescriptionMetrics.contains(.weight) ? targetWeight : nil
        exercise.targetCounterweight = source.trackingMode.prescriptionMetrics.contains(.counterweight) ? targetCounterweight : nil
        exercise.durationSeconds = source.trackingMode.prescriptionMetrics.contains(.duration) ? durationSeconds : nil
        exercise.distanceMeters = source.trackingMode.prescriptionMetrics.contains(.distance) ? distanceMeters : nil
        return exercise
    }
}

private struct RedesignedEmptyDayState: View {
    var onAdd: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("No exercises yet")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)

            Button(action: onAdd) {
                Label("Add first exercise", systemImage: "plus")
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(AppPressFeedbackStyle())
        }
        .padding(16)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }
}

private struct PlanAddExerciseButton: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(AppColor.base)
                    .frame(width: 32, height: 32)
                    .background(AppColor.accent, in: Circle())

                Text("Add exercise")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.primaryText)

                Spacer(minLength: 8)

                Image(systemName: "chevron.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(AppColor.secondaryText)
            }
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: 52)
            .contentShape(Rectangle())
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
        .accessibilityLabel("Add exercise")
    }
}

private struct RedesignedExerciseSearchField: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(AppColor.secondaryText)

            TextField("Search exercises", text: $query)
                .focused(focused)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(AppFont.h2)
                .foregroundStyle(AppColor.primaryText)
                .tint(AppColor.accent)
                .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(AppColor.secondaryText)
                }
                .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.9))
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }
}

private struct ExerciseSearchResultCard: View {
    var exercise: ExercisePrescription
    var onAdd: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            ExerciseIdentityContent(exercise: exercise)
                .padding(10)

            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(AppColor.base)
                    .frame(width: 56, height: 112)
                    .background(AppColor.accent)
            }
            .buttonStyle(AppPressFeedbackStyle(pressedScale: 1))
            .accessibilityLabel("Configure \(exercise.name)")
        }
        .frame(maxWidth: .infinity, minHeight: 112)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }
}

private struct ExerciseSearchConfigurationCard: View {
    @Binding var draft: PlanExerciseConfigurationDraft
    var onAdvance: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 16) {
                ExerciseIdentityContent(exercise: draft.source)

                VStack(alignment: .leading, spacing: 8) {
                    Text(draft.currentStep.title)
                        .font(AppFont.label)

                    HStack {
                        metricButton(symbol: "minus", delta: -draft.currentStepAmount)
                        Spacer()
                        Text("\(draft.currentValue)")
                            .font(AppFont.display)
                            .contentTransition(.numericText())
                        Spacer()
                        metricButton(symbol: "plus", delta: draft.currentStepAmount)
                    }
                }
            }
            .padding(10)

            Button(action: onAdvance) {
                Image(systemName: draft.isLastStep ? "checkmark" : "chevron.right")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(AppColor.base)
                    .frame(width: 56)
                    .frame(maxHeight: .infinity)
                    .background(AppColor.accent)
            }
            .buttonStyle(AppPressFeedbackStyle(pressedScale: 1))
            .accessibilityLabel(draft.isLastStep ? "Add exercise to plan" : "Next metric")
        }
        .frame(maxWidth: .infinity, minHeight: 190)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: draft.stepIndex)
    }

    private func metricButton(symbol: String, delta: Int) -> some View {
        Button {
            draft.currentValue = min(draft.currentMaximum, max(1, draft.currentValue + delta))
            Haptics.tap()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(AppColor.primaryText)
                .frame(width: 40, height: 40)
                .background(AppColor.surface2, in: Circle())
                .overlay(Circle().stroke(AppColor.border, lineWidth: 1))
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.92))
    }
}

private struct ExerciseIdentityContent: View {
    var exercise: ExercisePrescription

    var body: some View {
        HStack(spacing: 10) {
            ExerciseArtwork(exercise: exercise)
                .frame(width: 80, height: 80)

            VStack(alignment: .leading, spacing: 6) {
                Text(exercise.name.planDisplayName)
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(2)

                Text(exercise.equipmentLabel)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Circle().fill(AppColor.accent).frame(width: 6, height: 6)
                    Text(exercise.muscleLabel)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ExerciseArtwork: View {
    var exercise: ExercisePrescription

    var body: some View {
        Group {
            if let localName = exercise.localImageAssetName {
                Image(localName)
                    .resizable()
                    .scaledToFill()
            } else if let url = exercise.thumbnailURL ?? exercise.imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image): image.resizable().scaledToFill()
                    case .empty: ProgressView().tint(AppColor.accent)
                    case .failure: fallback
                    @unknown default: fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.surface2)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var fallback: some View {
        if let asset = CustomExerciseAssets.muscleAssetName(for: exercise.muscleLabel) {
            Image(asset).resizable().scaledToFill()
        } else {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(AppColor.accent)
        }
    }
}

private struct PlanExerciseSummaryCard: View {
    var exercise: ExercisePrescription
    var onEdit: () -> Void
    var onDelete: (() -> Void)?

    var body: some View {
        Button(action: onEdit) {
            HStack(spacing: 12) {
                ExerciseArtwork(exercise: exercise)
                    .frame(width: 80, height: 80)

                VStack(alignment: .leading, spacing: 6) {
                    Text(exercise.name.planDisplayName)
                        .font(AppFont.body)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(2)
                    Text(exercise.equipmentLabel)
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.primaryText)
                    HStack(spacing: 4) {
                        Circle().fill(AppColor.accent).frame(width: 6, height: 6)
                        Text(exercise.muscleLabel)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                    }
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(exercise.sets) sets")
                    Text(exercise.prescriptionSummary)
                }
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)
            }
            .padding(10)
            .frame(maxWidth: .infinity, minHeight: 112)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.border, lineWidth: 1)
            )
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
        .contextMenu {
            if let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Label("Remove exercise", systemImage: "trash")
                }
            }
        }
    }
}

private struct CustomExercisePropertyRow: View {
    var symbol: String
    var title: String
    var value: String?
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(AppColor.accent)
                    .frame(width: 20)
                Text(title)
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.primaryText)
                Spacer()
                Text(value ?? "Select")
                    .font(AppFont.label)
                    .foregroundStyle(value == nil ? AppColor.secondaryText : AppColor.primaryText)
                    .lineLimit(1)
            }
            .padding(.horizontal, 16)
            .frame(height: 54)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.border, lineWidth: 1)
            )
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
    }
}

private struct CustomExerciseVisualOption: Identifiable {
    var title: String
    var imageAssetName: String
    var id: String { title }
}

private struct VisualPickerTile: View {
    var option: CustomExerciseVisualOption
    var isSelected: Bool
    var compact = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: compact ? 4 : 8) {
                Image(option.imageAssetName)
                    .resizable()
                    .scaledToFill()
                    .frame(width: compact ? 59 : 100, height: compact ? 47 : 58)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                Text(option.title)
                    .font(compact ? AppFont.caption : AppFont.label)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .padding(compact ? 8 : 12)
            .frame(maxWidth: .infinity, minHeight: compact ? 83 : 103)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isSelected ? AppColor.accent : AppColor.border, lineWidth: 1)
            )
        }
        .buttonStyle(AppPressFeedbackStyle())
    }
}

private enum CustomExerciseAssets {
    static let equipment: [CustomExerciseVisualOption] = [
        .init(title: "Machine", imageAssetName: "EquipmentMachine"),
        .init(title: "Cable", imageAssetName: "EquipmentCable"),
        .init(title: "Smith Machine", imageAssetName: "EquipmentSmithMachine"),
        .init(title: "Trap Bar", imageAssetName: "EquipmentTrapBar"),
        .init(title: "Barbell", imageAssetName: "EquipmentBarbell"),
        .init(title: "EZ Bar", imageAssetName: "EquipmentEZBar"),
        .init(title: "Dumbbells", imageAssetName: "EquipmentDumbbells"),
        .init(title: "Kettlebells", imageAssetName: "EquipmentKettlebells"),
        .init(title: "Resistance Bands", imageAssetName: "EquipmentResistanceBands"),
        .init(title: "TRX", imageAssetName: "EquipmentTRX"),
        .init(title: "Bodyweight", imageAssetName: "EquipmentBodyweight"),
        .init(title: "Misc", imageAssetName: "EquipmentMisc")
    ]

    static let muscles: [CustomExerciseVisualOption] = [
        .init(title: "Traps", imageAssetName: "MuscleTraps"),
        .init(title: "Front delts", imageAssetName: "MuscleFrontDelts"),
        .init(title: "Side delts", imageAssetName: "MuscleSideDelts"),
        .init(title: "Rear delts", imageAssetName: "MuscleRearDelts"),
        .init(title: "Chest", imageAssetName: "MuscleChest"),
        .init(title: "Upper back", imageAssetName: "MuscleUpperBack"),
        .init(title: "Lats", imageAssetName: "MuscleLats"),
        .init(title: "Abs", imageAssetName: "MuscleAbs"),
        .init(title: "Biceps", imageAssetName: "MuscleBiceps"),
        .init(title: "Triceps", imageAssetName: "MuscleTriceps"),
        .init(title: "Forearms", imageAssetName: "MuscleForearms"),
        .init(title: "Lower back", imageAssetName: "MuscleLowerBack"),
        .init(title: "Abductors", imageAssetName: "MuscleAbductors"),
        .init(title: "Adductors", imageAssetName: "MuscleAdductors"),
        .init(title: "Glutes", imageAssetName: "MuscleGlutes"),
        .init(title: "Quads", imageAssetName: "MuscleQuads"),
        .init(title: "Hams", imageAssetName: "MuscleHams"),
        .init(title: "Calves", imageAssetName: "MuscleCalves")
    ]

    static func muscleAssetName(for label: String) -> String? {
        let normalized = label.lowercased()
        return muscles.first { option in
            normalized.contains(option.title.lowercased()) || option.title.lowercased().contains(normalized)
        }?.imageAssetName
    }
}

extension ExercisePrescription {
    var prescriptionSummary: String {
        var parts: [String] = []
        if let targetWeight { parts.append("\(targetWeight) kg") }
        if let targetCounterweight { parts.append("\(targetCounterweight) kg assist") }
        if reps > 0 { parts.append("\(reps) reps") }
        if let durationSeconds { parts.append(Self.durationText(durationSeconds)) }
        if let distanceMeters { parts.append(Self.distanceText(distanceMeters)) }
        return parts.isEmpty ? trackingMode.title : parts.joined(separator: " · ")
    }

    static func durationText(_ seconds: Int) -> String {
        if seconds >= 60 {
            return "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
        }
        return "\(seconds) sec"
    }

    static func distanceText(_ meters: Int) -> String {
        meters >= 1_000 && meters % 1_000 == 0 ? "\(meters / 1_000) km" : "\(meters) m"
    }
}
