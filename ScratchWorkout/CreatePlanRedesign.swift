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
    var onArchiveCustomExercise: (UUID) -> Void
    private let exerciseCatalog: any ExerciseCatalogService
    private let editingPlan: WorkoutPlan?
    private let onCancel: (() -> Void)?

    @FocusState private var searchFocused: Bool
    @FocusState private var planNameFocused: Bool
    @FocusState private var dayNameFocused: Bool
    @FocusState private var customNameFocused: Bool
    @State private var stage: Stage
    @State private var planName: String
    @State private var daysPerWeek: Int
    @State private var currentDayIndex = 0
    @State private var completedDays = 0
    @State private var planDays: [[ExercisePrescription]]
    @State private var dayNames: [String]
    @State private var searchQuery: String
    @State private var searchResults: [ExercisePrescription] = []
    @State private var customSearchResults: [ExercisePrescription] = []
    @State private var selectedLibraryExercises: [ExercisePrescription] = []
    @State private var selectedTypeFilter: WorkoutItemType?
    @State private var isDiscardSelectionConfirmationPresented = false
    @State private var searchState: PlanEntrySearchState = .idle
    @State private var configurationDraft: PlanExerciseConfigurationDraft?
    @State private var customExercises: [CustomExerciseDefinition]
    @State private var customRoute: CustomExerciseRoute?
    @State private var customName = ""
    @State private var customEquipment: String?
    @State private var customMuscle: String?
    @State private var customType: CustomExerciseType?
    @State private var customTrackingMode: ExerciseTrackingMode?
    @State private var customErrorMessage: String?
    @State private var editingCustomExerciseID: UUID?
    @State private var stageDirection: AppNavigationDirection = .forward
    @State private var daySlideDirection: AppNavigationDirection = .forward
    @State private var didFinish = false
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(
        initialStage: Stage = .frequency,
        daysPerWeek: Int = 3,
        searchQuery: String = "",
        selectedTypeFilter: WorkoutItemType? = nil,
        editingPlan: WorkoutPlan? = nil,
        customExercises: [CustomExerciseDefinition] = [],
        exerciseCatalog: any ExerciseCatalogService = ExerciseCatalogServiceFactory.live(),
        onCancel: (() -> Void)? = nil,
        onSaveCustomExercise: @escaping (CustomExerciseDefinition) -> Void = { _ in },
        onArchiveCustomExercise: @escaping (UUID) -> Void = { _ in },
        onFinish: @escaping (WorkoutPlan, Bool) -> Void
    ) {
        let safeDayCount = min(7, max(1, editingPlan?.days.count ?? daysPerWeek))
        let seededDays: [[ExercisePrescription]]
        let seededNames: [String]
        let seededCompletedDays: Int

        if let editingPlan {
            seededDays = editingPlan.days.map(\.exercises)
            seededNames = editingPlan.days.map(\.title)
            seededCompletedDays = editingPlan.days.count
        } else if initialStage == .finalReview || initialStage == .activatePrompt {
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
        self.onArchiveCustomExercise = onArchiveCustomExercise
        self.exerciseCatalog = exerciseCatalog
        self.editingPlan = editingPlan
        self.onCancel = onCancel
        _stage = State(initialValue: editingPlan == nil ? initialStage : .composer)
        _planName = State(initialValue: editingPlan?.name ?? (initialStage == .finalReview || initialStage == .activatePrompt ? "Push Pull Legs" : ""))
        _daysPerWeek = State(initialValue: safeDayCount)
        _planDays = State(initialValue: seededDays)
        _dayNames = State(initialValue: seededNames)
        _completedDays = State(initialValue: seededCompletedDays)
        _searchQuery = State(initialValue: searchQuery)
        _selectedTypeFilter = State(initialValue: selectedTypeFilter)
        _customExercises = State(initialValue: customExercises.filter(\.isAvailable))
    }

    var body: some View {
        AppScreen {
            content
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
        .confirmationDialog(
            "Discard selected exercises?",
            isPresented: $isDiscardSelectionConfirmationPresented,
            titleVisibility: .visible
        ) {
            Button("Discard Selection", role: .destructive) {
                selectedLibraryExercises = []
                returnToComposer()
            }
            Button("Keep Selecting", role: .cancel) {}
        } message: {
            Text("Your current day will remain unchanged.")
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
            composerHeader
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
                    .id(currentDayIndex)
                    .focused($dayNameFocused)
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .tint(AppColor.accent)
                    .submitLabel(.done)
                    .onSubmit {
                        commitCurrentDayName()
                        dayNameFocused = false
                    }

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
                                draft: configurationBinding(for: exercise),
                                onEdit: { editExercise(exercise) },
                                onAdvance: advanceConfiguration,
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

    private var composerHeader: some View {
        HStack(spacing: 8) {
            if editingPlan != nil {
                Button {
                    Haptics.tap()
                    onCancel?()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 24, weight: .semibold))
                        .foregroundStyle(AppColor.primaryText)
                        .frame(width: 36, height: AppLayout.screenTitleHeight)
                }
                .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.94))
                .accessibilityLabel("Cancel editing")
            }

            Text(editingPlan == nil ? "Create Plan" : "Edit Plan")
                .font(AppFont.display)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: AppLayout.screenTitleHeight)
    }

    private var exerciseSearchView: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Button(action: attemptReturnToComposer) {
                    Image(systemName: "xmark")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(AppColor.primaryText)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.94))
                .accessibilityLabel("Close exercise library")

                Text("Add Exercise")
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                Spacer(minLength: 8)

                Button("Create New", action: beginCustomExercise)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(minHeight: 44)
                    .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.96))
            }
            .frame(height: AppLayout.screenTitleHeight)
                .padding(.top, AppLayout.screenTitleTopPadding)

            RedesignedExerciseSearchField(query: $searchQuery, focused: $searchFocused)
                .padding(.top, 20)

            WorkoutItemTypeFilters(selection: $selectedTypeFilter)
                .padding(.top, 12)

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 8) {
                    if !selectedLibraryExercises.isEmpty {
                        LibrarySectionLabel(title: "Selected", count: selectedLibraryExercises.count)

                        ForEach(selectedLibraryExercises, id: \.stableCatalogID) { exercise in
                            ExerciseSearchResultCard(
                                exercise: exercise,
                                isSelected: true,
                                onToggle: { toggleLibrarySelection(exercise) }
                            )
                            .contextMenu { customExerciseActions(for: exercise) }
                        }

                        LibrarySectionLabel(title: searchQuery.isEmpty ? "Library" : "Results")
                            .padding(.top, 8)
                    }

                    if searchState == .loading && displayedSearchExercises.isEmpty {
                        ProgressView()
                            .tint(AppColor.accent)
                            .frame(maxWidth: .infinity, minHeight: 88)
                    }

                    if shouldOfferCreateExercise {
                        CreateExerciseResultRow(name: normalizedCreateName, action: beginCustomExercise)
                    }

                    ForEach(unselectedDisplayedSearchExercises, id: \.stableCatalogID) { exercise in
                        ExerciseSearchCard(
                            exercise: exercise,
                            draft: configurationBinding(for: exercise),
                            onAction: configurationDraft?.source.id == exercise.id
                                ? advanceConfiguration
                                : { configure(exercise) }
                        )
                        .contextMenu { customExerciseActions(for: exercise) }
                    }

                    if unselectedDisplayedSearchExercises.isEmpty && !shouldOfferCreateExercise && searchState != .loading {
                        Text(searchEmptyMessage)
                            .font(AppFont.body)
                            .foregroundStyle(AppColor.secondaryText)
                            .frame(maxWidth: .infinity, minHeight: 72, alignment: .center)
                    }

                    Text("Exercise data by ExerciseDB")
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, 4)
                }
                .padding(.top, 8)
                .padding(.bottom, selectedLibraryExercises.isEmpty ? 24 : composerBottomPadding)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(AppColor.surface1.opacity(0.16))
        .floatingBottomChrome(isVisible: !selectedLibraryExercises.isEmpty) {
            CTAButton(title: addSelectedButtonTitle, width: 312, action: addSelectedExercisesToDay)
        }
    }

    private var reviewView: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                SuccessBadge(text: editingPlan == nil ? "PLAN READY" : "CHANGES READY")

                Text(editingPlan == nil ? "Your plan is ready" : "Review your changes")
                    .font(AppFont.h1)
                    .padding(.top, 16)
                    .accessibilityAddTraits(.isHeader)

                Text("Built around \(daysPerWeek) workouts per week.")
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.secondaryText)
                    .padding(.top, 8)

                Text("PLAN NAME")
                    .font(AppFont.label)
                    .tracking(1.3)
                    .foregroundStyle(AppColor.secondaryText)
                    .padding(.top, 20)

                TextField("Name your plan", text: $planName)
                    .focused($planNameFocused)
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .tint(AppColor.accent)
                    .lineLimit(1)
                    .submitLabel(.done)
                    .onSubmit { planNameFocused = false }
                    .padding(.top, 8)
                    .padding(.bottom, 10)
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(planNameFocused ? AppColor.accent : AppColor.border)
                            .frame(height: 1)
                    }

                SuccessMetricStrip(metrics: planMetrics)
                    .padding(.top, 20)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Training focus")
                        .font(AppFont.h2)

                    Text(trainingFocusText)
                        .font(AppFont.body)
                        .foregroundStyle(trainingFocus.isEmpty ? AppColor.secondaryText : AppColor.primaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 16)

                VStack(alignment: .leading, spacing: 0) {
                    Text("Your week")
                        .font(AppFont.h2)
                        .padding(.bottom, 12)

                    ForEach(Array(planDays.indices), id: \.self) { index in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text(displayName(for: index))
                                .font(AppFont.subheading)
                                .foregroundStyle(AppColor.primaryText)

                            Spacer(minLength: 12)

                            Text(exerciseCountText(planDays[index].count))
                                .font(AppFont.body)
                                .foregroundStyle(AppColor.secondaryText)
                                .multilineTextAlignment(.trailing)
                        }
                        .padding(.vertical, 14)
                        .accessibilityElement(children: .combine)

                        if index < planDays.count - 1 {
                            Rectangle()
                                .fill(AppColor.border)
                                .frame(height: 1)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .padding(.top, 16)
            }
            .padding(.top, AppLayout.screenTitleTopPadding)
            .padding(.bottom, composerBottomPadding + AppLayout.bottomCTAHeight + 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .floatingBottomChrome {
            VStack(spacing: 12) {
                if editingPlan == nil {
                    CTAButton(title: "Save & activate", width: 312) {
                        finish(activate: true)
                    }

                    SuccessSecondaryButton(title: "Save only", width: 312) {
                        finish(activate: false)
                    }
                } else {
                    CTAButton(title: "Save changes", width: 312) {
                        finish(activate: false)
                    }
                }
            }
            .opacity(isPlanNameValid ? 1 : 0.45)
            .allowsHitTesting(isPlanNameValid)
            .disabled(!isPlanNameValid)
            .accessibilityHint(isPlanNameValid ? "" : "Enter a plan name first")
        }
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

            if let customErrorMessage {
                Text(customErrorMessage)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.destructive)
                    .padding(.top, 12)
                    .accessibilityLabel("Custom exercise error: \(customErrorMessage)")
            }

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
                        customTrackingMode = type.defaultTrackingMode
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

    private var planMetrics: [SuccessMetric] {
        [
            SuccessMetric(value: "\(daysPerWeek)", label: "Days"),
            SuccessMetric(value: "\(planDays.reduce(0) { $0 + $1.count })", label: "Exercises"),
            SuccessMetric(
                value: "\(planDays.flatMap { $0 }.reduce(0) { $0 + $1.sets })",
                label: "Sets / week"
            )
        ]
    }

    private var trainingFocus: [String] {
        var seen = Set<String>()
        return planDays
            .flatMap { $0 }
            .map(\.muscleLabel)
            .filter { label in
                seen.insert(label.lowercased()).inserted
            }
            .prefix(4)
            .map { $0 }
    }

    private var trainingFocusText: String {
        trainingFocus.isEmpty ? "Add exercises to define your training focus." : trainingFocus.joined(separator: " · ")
    }

    private func displayName(for index: Int) -> String {
        guard dayNames.indices.contains(index) else { return "Day \(index + 1)" }
        let trimmed = dayNames[index].trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Day \(index + 1)" : trimmed
    }

    private func exerciseCountText(_ count: Int) -> String {
        "\(count) \(count == 1 ? "exercise" : "exercises")"
    }

    private var currentDayNameBinding: Binding<String> {
        Binding(
            get: {
                guard dayNames.indices.contains(currentDayIndex) else {
                    return "Day \(currentDayIndex + 1)"
                }
                return dayNames[currentDayIndex]
            },
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

    private var displayedSearchExercises: [ExercisePrescription] {
        var seen = Set<String>()
        let uniqueExercises = (customSearchResults + searchResults)
            .filter { exercise in
                let key = exercise.name.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                return seen.insert(key).inserted
            }

        var exercises = uniqueExercises
            .enumerated()
            .sorted { lhs, rhs in
                let lhsPriority = searchArtworkPriority(for: lhs.element)
                let rhsPriority = searchArtworkPriority(for: rhs.element)
                return lhsPriority == rhsPriority ? lhs.offset < rhs.offset : lhsPriority < rhsPriority
            }
            .map(\.element)

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

        guard let selectedTypeFilter else {
            return exercises
        }

        return exercises.filter { $0.itemType == selectedTypeFilter }
    }

    private var unselectedDisplayedSearchExercises: [ExercisePrescription] {
        let selectedIDs = Set(selectedLibraryExercises.map(\.stableCatalogID))
        return displayedSearchExercises.filter { !selectedIDs.contains($0.stableCatalogID) }
    }

    private var normalizedSearchQuery: String {
        searchQuery
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
    }

    private var normalizedCreateName: String {
        searchQuery
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }

    private var shouldOfferCreateExercise: Bool {
        guard normalizedSearchQuery.filter({ !$0.isWhitespace }).count >= 3 else {
            return false
        }

        return !(customSearchResults + searchResults).contains {
            $0.name
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
                .lowercased() == normalizedSearchQuery
        }
    }

    private var addSelectedButtonTitle: String {
        let count = selectedLibraryExercises.count
        let noun = count == 1 ? "Exercise" : "Exercises"
        return "Add \(count) \(noun) to \(currentDayName)"
    }

    private func searchArtworkPriority(for exercise: ExercisePrescription) -> Int {
        if exercise.customExerciseID != nil { return 0 }
        if exercise.thumbnailURL != nil || exercise.imageURLs["360p"] != nil || exercise.imageURL != nil { return 1 }
        return 2
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

    private var isPlanNameValid: Bool {
        !planName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
        PerformanceTrace.event(PerformanceTrace.Name.createPlanSearchOpen)
        Haptics.tap(.medium)
        configurationDraft = nil
        searchQuery = ""
        searchResults = []
        customSearchResults = Array(customExercises.prefix(20)).map { $0.prescription() }
        selectedLibraryExercises = []
        selectedTypeFilter = nil
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

    private func attemptReturnToComposer() {
        if selectedLibraryExercises.isEmpty {
            returnToComposer()
        } else {
            isDiscardSelectionConfirmationPresented = true
        }
    }

    private func toggleLibrarySelection(_ exercise: ExercisePrescription) {
        Haptics.tap()
        withAnimation(.spring(response: 0.22, dampingFraction: 0.88)) {
            if let index = selectedLibraryExercises.firstIndex(where: { $0.stableCatalogID == exercise.stableCatalogID }) {
                selectedLibraryExercises.remove(at: index)
            } else {
                selectedLibraryExercises.append(exercise)
            }
        }
    }

    private func addSelectedExercisesToDay() {
        guard planDays.indices.contains(currentDayIndex), !selectedLibraryExercises.isEmpty else {
            return
        }

        let existingIDs = Set(planDays[currentDayIndex].map(\.stableCatalogID))
        let newExercises = selectedLibraryExercises.filter { !existingIDs.contains($0.stableCatalogID) }
        planDays[currentDayIndex].append(contentsOf: newExercises)
        for exercise in newExercises {
            Task { await exerciseCatalog.recordSelection(exercise) }
        }
        selectedLibraryExercises = []
        returnToComposer()
    }

    private func focusSearch() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { searchFocused = true }
    }

    private func configure(_ exercise: ExercisePrescription, editingID: UUID? = nil) {
        PerformanceTrace.event(PerformanceTrace.Name.exerciseConfigure)
        Haptics.tap(.medium)
        withAnimation(cardExpansionAnimation) {
            configurationDraft = PlanExerciseConfigurationDraft(exercise: exercise, editingID: editingID)
        }
        searchFocused = false
    }

    private func editExercise(_ exercise: ExercisePrescription) {
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

        if stage == .search {
            withAnimation(cardExpansionAnimation) {
                selectedLibraryExercises.removeAll { $0.stableCatalogID == exercise.stableCatalogID }
                selectedLibraryExercises.append(exercise)
                configurationDraft = nil
            }
            return
        }

        if let editingID = draft.editingID,
           let index = planDays[currentDayIndex].firstIndex(where: { $0.id == editingID }) {
            exercise.id = editingID
            planDays[currentDayIndex][index] = exercise
        } else {
            planDays[currentDayIndex].append(exercise)
        }

        Task { await exerciseCatalog.recordSelection(exercise) }
        if stage == .composer {
            withAnimation(cardExpansionAnimation) {
                configurationDraft = nil
            }
        } else {
            returnToComposer()
        }
    }

    private func configurationBinding(fallback: PlanExerciseConfigurationDraft) -> Binding<PlanExerciseConfigurationDraft> {
        Binding(get: { configurationDraft ?? fallback }, set: { configurationDraft = $0 })
    }

    private func configurationBinding(for exercise: ExercisePrescription) -> Binding<PlanExerciseConfigurationDraft>? {
        guard let draft = configurationDraft, draft.source.id == exercise.id else {
            return nil
        }

        return configurationBinding(fallback: draft)
    }

    private func saveCurrentDay() {
        guard !currentDayExercises.isEmpty else { return }
        commitCurrentDayName()
        dayNameFocused = false
        PerformanceTrace.event(PerformanceTrace.Name.saveDay)
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
        commitCurrentDayName()
        dayNameFocused = false
        daySlideDirection = .forIndexChange(from: currentDayIndex, to: index)
        currentDayIndex = index
    }

    private func commitCurrentDayName() {
        guard dayNames.indices.contains(currentDayIndex) else { return }
        let trimmedName = dayNames[currentDayIndex].trimmingCharacters(in: .whitespacesAndNewlines)
        dayNames[currentDayIndex] = trimmedName.isEmpty ? "Day \(currentDayIndex + 1)" : trimmedName
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
        customName = normalizedCreateName
        customEquipment = nil
        customMuscle = nil
        customType = nil
        customTrackingMode = nil
        customErrorMessage = nil
        editingCustomExerciseID = nil
        customRoute = .details
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { customNameFocused = customName.isEmpty }
    }

    private func leaveCustomExercise() {
        customNameFocused = false
        customRoute = nil
        focusSearch()
    }

    @ViewBuilder
    private func customExerciseActions(for exercise: ExercisePrescription) -> some View {
        if let customID = exercise.customExerciseID {
            Button {
                beginEditingCustomExercise(id: customID)
            } label: {
                Label("Edit custom exercise", systemImage: "pencil")
            }

            Button(role: .destructive) {
                archiveCustomExercise(id: customID)
            } label: {
                Label("Archive custom exercise", systemImage: "archivebox")
            }
        }
    }

    private func beginEditingCustomExercise(id: UUID) {
        guard let existing = customExercises.first(where: { $0.id == id }) else { return }
        editingCustomExerciseID = id
        customName = existing.name
        customEquipment = existing.equipment
        customMuscle = existing.muscle
        customType = existing.exerciseType
        customTrackingMode = existing.trackingMode
        customErrorMessage = nil
        customRoute = .details
    }

    private func archiveCustomExercise(id: UUID) {
        customExercises.removeAll { $0.id == id }
        selectedLibraryExercises.removeAll { $0.customExerciseID == id }
        customSearchResults.removeAll { $0.customExerciseID == id }
        onArchiveCustomExercise(id)
    }

    private func saveCustomExercise() {
        guard isCustomExerciseValid,
              let equipment = customEquipment,
              let muscle = customMuscle,
              let type = customType,
              let trackingMode = customTrackingMode else { return }

        let trimmedName = customName.trimmingCharacters(in: .whitespacesAndNewlines)
        if editingCustomExerciseID == nil, let existing = customExercises.first(where: {
            $0.name.trimmingCharacters(in: .whitespacesAndNewlines).caseInsensitiveCompare(trimmedName) == .orderedSame
        }) {
            customErrorMessage = "This exercise already exists. The saved version has been selected."
            customRoute = nil
            searchQuery = existing.name
            toggleLibrarySelection(existing.prescription())
            return
        }

        let existingDefinition = editingCustomExerciseID.flatMap { id in
            customExercises.first(where: { $0.id == id })
        }
        let definition = CustomExerciseDefinition(
            id: editingCustomExerciseID ?? UUID(),
            name: trimmedName,
            equipment: equipment,
            muscle: muscle,
            exerciseType: type,
            trackingMode: trackingMode,
            createdAt: existingDefinition?.createdAt ?? Date(),
            updatedAt: Date(),
            isArchived: false,
            notes: existingDefinition?.notes
        )
        customExercises.removeAll { $0.id == definition.id || $0.name.caseInsensitiveCompare(definition.name) == .orderedSame }
        customExercises.insert(definition, at: 0)
        onSaveCustomExercise(definition)
        searchQuery = definition.name
        searchResults = []
        customSearchResults = [definition.prescription()]
        customRoute = nil
        customErrorMessage = nil
        editingCustomExerciseID = nil
        selectedLibraryExercises.removeAll { $0.customExerciseID == definition.id }
        toggleLibrarySelection(definition.prescription())
    }

    private func updateExerciseSearch() async {
        guard stage == .search, customRoute == nil else { return }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let customExerciseSnapshot = customExercises
        if !query.isEmpty {
            PerformanceTrace.event(PerformanceTrace.Name.searchQueryChanged)
        }

        let localSearchTask = Task.detached(priority: .userInitiated) { () -> [ExercisePrescription] in
            var matches: [ExercisePrescription] = []

            for exercise in customExerciseSnapshot {
                guard !Task.isCancelled else { return [] }
                guard query.isEmpty || exercise.name.localizedCaseInsensitiveContains(query) else { continue }
                matches.append(exercise.prescription())
                if matches.count == 20 { break }
            }

            return matches
        }
        let localMatches = await withTaskCancellationHandler {
            await localSearchTask.value
        } onCancel: {
            localSearchTask.cancel()
        }
        guard !Task.isCancelled else { return }
        customSearchResults = localMatches
        if !query.isEmpty {
            PerformanceTrace.event(PerformanceTrace.Name.searchResultsUpdated)
        }

        if !query.isEmpty {
            searchState = .loading
            do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
        } else {
            searchState = .idle
        }
        guard !Task.isCancelled else { return }
        let response = await exerciseCatalog.search(query: query)
        guard !Task.isCancelled else { return }
        searchResults = response.exercises
        PerformanceTrace.event(PerformanceTrace.Name.searchResultsUpdated)
        if response.exercises.isEmpty {
            searchState = .message(response.notice?.message ?? "No matching exercises")
        } else if let notice = response.notice {
            searchState = .message(notice.message)
        } else {
            searchState = .loaded
        }
    }

    private func finish(activate: Bool) {
        guard !didFinish else { return }
        didFinish = true
        PerformanceTrace.event(PerformanceTrace.Name.savePlan)
        let days = planDays.indices.map { index in
            let exercises = planDays[index].map { exercise in
                var workoutTimeLoadExercise = exercise
                workoutTimeLoadExercise.targetWeight = nil
                workoutTimeLoadExercise.targetCounterweight = nil
                return workoutTimeLoadExercise
            }
            return WorkoutDay(
                title: dayNames.indices.contains(index) ? dayNames[index] : "Day \(index + 1)",
                exercises: exercises
            )
        }
        let finalPlanName = planName.trimmingCharacters(in: .whitespacesAndNewlines)
        let plan = WorkoutPlan(
            id: editingPlan?.id ?? UUID(),
            name: finalPlanName,
            daysPerWeek: daysPerWeek,
            createdAt: editingPlan?.createdAt ?? Self.todayFormatted,
            days: days
        )
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
    var durationSeconds: Int
    var distanceMeters: Int
    var restSeconds: Int
    var intensityZone: Int
    var rounds: Int

    init(exercise: ExercisePrescription, editingID: UUID? = nil) {
        self.editingID = editingID
        source = exercise
        sets = exercise.sets
        reps = max(1, exercise.reps)
        durationSeconds = exercise.durationSeconds ?? 30
        distanceMeters = exercise.distanceMeters ?? 100
        restSeconds = exercise.restSeconds ?? 60
        intensityZone = exercise.intensityZone ?? 2
        rounds = exercise.rounds ?? 4
    }

    var steps: [PlanConfigurationStep] {
        var metrics = source.trackingMode.planPrescriptionMetrics
        switch source.itemType {
        case .strength:
            if source.restSeconds != nil { metrics.append(.rest) }
        case .cardio:
            if source.intensityZone != nil { metrics.append(.zone) }
        case .timer:
            metrics.append(.rounds)
            if source.restSeconds != nil { metrics.append(.rest) }
        case .mobility, .stability, .stretch:
            break
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
            case .metric(.weight), .metric(.counterweight): 0
            case .metric(.reps): reps
            case .metric(.duration): durationSeconds
            case .metric(.distance): distanceMeters
            case .metric(.rest): restSeconds
            case .metric(.zone): intensityZone
            case .metric(.rounds): rounds
            }
        }
        set {
            switch currentStep {
            case .sets: sets = newValue
            case .metric(.weight), .metric(.counterweight): break
            case .metric(.reps): reps = newValue
            case .metric(.duration): durationSeconds = newValue
            case .metric(.distance): distanceMeters = newValue
            case .metric(.rest): restSeconds = newValue
            case .metric(.zone): intensityZone = newValue
            case .metric(.rounds): rounds = newValue
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
        let planMetrics = source.trackingMode.planPrescriptionMetrics
        exercise.sets = sets
        exercise.reps = planMetrics.contains(.reps) ? reps : 0
        exercise.targetWeight = nil
        exercise.targetCounterweight = nil
        exercise.durationSeconds = planMetrics.contains(.duration) ? durationSeconds : nil
        exercise.distanceMeters = planMetrics.contains(.distance) ? distanceMeters : nil
        exercise.restSeconds = steps.contains(.metric(.rest)) ? restSeconds : nil
        exercise.intensityZone = steps.contains(.metric(.zone)) ? intensityZone : nil
        exercise.rounds = steps.contains(.metric(.rounds)) ? rounds : nil
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

private struct WorkoutItemTypeFilters: View {
    @Binding var selection: WorkoutItemType?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterButton(title: "All", type: nil)
                ForEach(WorkoutItemType.allCases) { type in
                    filterButton(title: type.title, type: type)
                }
            }
            .padding(.horizontal, 1)
        }
        .accessibilityLabel("Exercise type filters")
    }

    private func filterButton(title: String, type: WorkoutItemType?) -> some View {
        let isSelected = selection == type
        return Button {
            Haptics.tap()
            selection = type
        } label: {
            Text(title)
                .font(AppFont.label)
                .foregroundStyle(isSelected ? AppColor.base : AppColor.secondaryText)
                .padding(.horizontal, 14)
                .frame(height: 36)
                .background(isSelected ? AppColor.accent : AppColor.surface2, in: Capsule())
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.96))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

private struct LibrarySectionLabel: View {
    var title: String
    var count: Int?

    init(title: String, count: Int? = nil) {
        self.title = title
        self.count = count
    }

    var body: some View {
        HStack {
            Text(title)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
            Spacer()
            if let count {
                Text("\(count)")
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
        .frame(height: 28)
    }
}

private struct CreateExerciseResultRow: View {
    var name: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(AppColor.accent)

                VStack(alignment: .leading, spacing: 3) {
                    Text("Create \"\(name)\"")
                        .font(AppFont.subheading)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)
                    Text("Add it to your personal exercise library")
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                }

                Spacer(minLength: 8)
            }
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))
        .accessibilityLabel("Create custom exercise \(name)")
    }
}

private struct ExerciseSearchResultCard: View {
    var exercise: ExercisePrescription
    var isSelected: Bool
    var onToggle: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            ExerciseIdentityContent(exercise: exercise)
                .padding(10)

            Button(action: onToggle) {
                Image(systemName: isSelected ? "checkmark" : "plus")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(isSelected ? AppColor.base : AppColor.primaryText)
                    .frame(width: 56, height: 112)
                    .background(isSelected ? AppColor.accent : AppColor.surface2)
            }
            .buttonStyle(AppPressFeedbackStyle(pressedScale: 1))
            .accessibilityLabel(isSelected ? "Remove \(exercise.name) from selection" : "Add \(exercise.name) to selection")
        }
        .frame(maxWidth: .infinity, minHeight: 112)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(exercise.name), \(exercise.itemType.title), \(exercise.equipmentLabel), \(exercise.muscleLabel), \(isSelected ? "selected" : "not selected")")
    }
}

private struct ExerciseSearchCard: View {
    var exercise: ExercisePrescription
    var draft: Binding<PlanExerciseConfigurationDraft>?
    var onAction: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                ExerciseIdentityContent(exercise: exercise)
                    .padding(10)

                if let draft {
                    VStack(alignment: .leading, spacing: 10) {
                        Rectangle()
                            .fill(AppColor.border)
                            .frame(height: 1)

                        Text(draft.wrappedValue.currentStep.title)
                            .font(AppFont.subheading)
                            .foregroundStyle(AppColor.primaryText)

                        HStack {
                            metricButton(
                                symbol: "minus",
                                delta: -draft.wrappedValue.currentStepAmount,
                                draft: draft
                            )
                            Spacer()
                            Text("\(draft.wrappedValue.currentValue)")
                                .font(AppFont.display)
                                .contentTransition(.numericText())
                            Spacer()
                            metricButton(
                                symbol: "plus",
                                delta: draft.wrappedValue.currentStepAmount,
                                draft: draft
                            )
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 12)
                    .transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)

            Button(action: onAction) {
                Image(systemName: actionSymbol)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(AppColor.base)
                    .frame(width: 56)
                    .frame(maxHeight: .infinity)
                    .background(AppColor.accent)
            }
            .buttonStyle(AppPressFeedbackStyle(pressedScale: 1))
            .accessibilityLabel(actionAccessibilityLabel)
        }
        .frame(maxWidth: .infinity, minHeight: 112)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .animation(.snappy(duration: 0.24, extraBounce: 0), value: draft != nil)
        .animation(.snappy(duration: 0.2, extraBounce: 0), value: draft?.wrappedValue.stepIndex)
    }

    private var actionSymbol: String {
        guard let draft else { return "plus" }
        return draft.wrappedValue.isLastStep ? "checkmark" : "chevron.right"
    }

    private var actionAccessibilityLabel: String {
        guard let draft else { return "Configure \(exercise.name)" }
        return draft.wrappedValue.isLastStep ? "Add exercise to plan" : "Next metric"
    }

    private func metricButton(
        symbol: String,
        delta: Int,
        draft: Binding<PlanExerciseConfigurationDraft>
    ) -> some View {
        Button {
            var value = draft.wrappedValue
            value.currentValue = min(value.currentMaximum, max(1, value.currentValue + delta))
            draft.wrappedValue = value
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
                .frame(width: 88, height: 88)

            VStack(alignment: .leading, spacing: 8) {
                Text(exercise.name.planDisplayName)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(2, reservesSpace: true)
                    .frame(maxWidth: .infinity, minHeight: 48, maxHeight: 48, alignment: .leading)
                    .layoutPriority(1)

                HStack(spacing: 6) {
                    Text(exercise.itemType.title)
                    Text("·")
                    Text(exercise.equipmentLabel)
                    Text("·")
                    Text(exercise.muscleLabel)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Spacer(minLength: 0)
                }
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ExerciseArtwork: View {
    var exercise: ExercisePrescription

    var body: some View {
        Group {
            if let url = exercise.thumbnailURL ?? exercise.imageURLs["360p"] ?? exercise.imageURL {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .empty:
                        AppColor.surface2
                            .overlay {
                                ProgressView()
                                    .tint(AppColor.secondaryText)
                            }
                    case .failure:
                        exerciseImageFallback
                    @unknown default:
                        exerciseImageFallback
                    }
                }
            } else {
                exerciseImageFallback
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

    private var exerciseImageFallback: some View {
        ZStack {
            AppColor.surface2
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 28, weight: .medium))
                .foregroundStyle(AppColor.secondaryText)
        }
    }
}

private struct PlanExerciseSummaryCard: View {
    var exercise: ExercisePrescription
    var draft: Binding<PlanExerciseConfigurationDraft>? = nil
    var onEdit: () -> Void
    var onAdvance: () -> Void = {}
    var onDelete: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
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
                .contentShape(Rectangle())
            }
            .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.98))

            if let draft {
                VStack(alignment: .leading, spacing: 12) {
                    Rectangle()
                        .fill(AppColor.border)
                        .frame(height: 1)

                    Text(draft.wrappedValue.currentStep.title)
                        .font(AppFont.subheading)
                        .foregroundStyle(AppColor.primaryText)

                    HStack(spacing: 12) {
                        configurationButton(
                            symbol: "minus",
                            delta: -draft.wrappedValue.currentStepAmount,
                            draft: draft
                        )

                        Text("\(draft.wrappedValue.currentValue)")
                            .font(AppFont.display)
                            .contentTransition(.numericText())
                            .frame(maxWidth: .infinity)

                        configurationButton(
                            symbol: "plus",
                            delta: draft.wrappedValue.currentStepAmount,
                            draft: draft
                        )

                        Button(action: onAdvance) {
                            Image(systemName: draft.wrappedValue.isLastStep ? "checkmark" : "chevron.right")
                                .font(.system(size: 19, weight: .bold))
                                .foregroundStyle(AppColor.base)
                                .frame(width: 44, height: 44)
                                .background(AppColor.accent, in: Circle())
                        }
                        .buttonStyle(AppPressFeedbackStyle(pressedScale: 0.92))
                        .accessibilityLabel(draft.wrappedValue.isLastStep ? "Save exercise settings" : "Next exercise setting")
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 14)
                .transition(.opacity)
            }
        }
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .animation(.snappy(duration: 0.24, extraBounce: 0), value: draft != nil)
        .animation(.snappy(duration: 0.2, extraBounce: 0), value: draft?.wrappedValue.stepIndex)
        .contextMenu {
            if let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Label("Remove exercise", systemImage: "trash")
                }
            }
        }
    }

    private func configurationButton(
        symbol: String,
        delta: Int,
        draft: Binding<PlanExerciseConfigurationDraft>
    ) -> some View {
        Button {
            var value = draft.wrappedValue
            value.currentValue = min(value.currentMaximum, max(1, value.currentValue + delta))
            draft.wrappedValue = value
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
        if reps > 0 { parts.append("\(reps) reps") }
        if let durationSeconds { parts.append(Self.durationText(durationSeconds)) }
        if let distanceMeters { parts.append(Self.distanceText(distanceMeters)) }
        if let intensityZone { parts.append("Zone \(intensityZone)") }
        if let rounds { parts.append("\(rounds) rounds") }
        if let side, !side.isEmpty { parts.append(side) }
        if let restSeconds { parts.append("\(restSeconds)s rest") }
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
