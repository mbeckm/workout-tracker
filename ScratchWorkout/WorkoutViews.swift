import SwiftUI

struct StartWorkoutView: View {
    var day: WorkoutDay
    var showsExerciseChevrons: Bool = false
    var onStart: () -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                ScreenTitle(title: "Start Workout")
                    .padding(.top, AppLayout.screenTitleTopPadding)

                ScreenSectionRow(title: day.title) {
                    Text("\(day.exercises.count) Exercises")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }
                .padding(.top, 24)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        ForEach(day.exercises) { exercise in
                            ExerciseCard(exercise: exercise, showsChevron: showsExerciseChevrons)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.top, 12)
                    .floatingBottomChromeScrollPadding()
                }
                .scrollDismissesKeyboard(.interactively)
            }
            .padding(.horizontal, 24)
            .floatingBottomChrome {
                CTAButton(title: "Start Workout", width: 312, action: onStart)
            }
        }
    }
}

struct LogWorkoutSessionView: View {
    var day: WorkoutDay
    @Binding var activeExerciseIndex: Int
    @Binding var exerciseSlideDirection: AppNavigationDirection
    var previousBestWeight: (String) -> Int?
    var username: String?
    var achievementFiredExerciseKeys: Set<String>
    var initialLoggedSets: [[LoggedSet]]
    var onAchievementUnlocked: (Achievement, [LoggedSet]?) -> Void
    var onSetsChange: (Int, [LoggedSet]) -> Void
    var onExerciseComplete: ([LoggedSet]) -> Void

    @State private var exerciseStates: [ExerciseLogState]
    @State private var feedbackResetTask: Task<Void, Never>?
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar

    init(
        day: WorkoutDay,
        activeExerciseIndex: Binding<Int>,
        exerciseSlideDirection: Binding<AppNavigationDirection>,
        previousBestWeight: @escaping (String) -> Int?,
        username: String? = nil,
        achievementFiredExerciseKeys: Set<String> = [],
        initialLoggedSets: [[LoggedSet]] = [],
        onAchievementUnlocked: @escaping (Achievement, [LoggedSet]?) -> Void = { _, _ in },
        onSetsChange: @escaping (Int, [LoggedSet]) -> Void = { _, _ in },
        onExerciseComplete: @escaping ([LoggedSet]) -> Void
    ) {
        self.day = day
        _activeExerciseIndex = activeExerciseIndex
        _exerciseSlideDirection = exerciseSlideDirection
        self.previousBestWeight = previousBestWeight
        self.username = username
        self.achievementFiredExerciseKeys = achievementFiredExerciseKeys
        self.initialLoggedSets = initialLoggedSets
        self.onAchievementUnlocked = onAchievementUnlocked
        self.onSetsChange = onSetsChange
        self.onExerciseComplete = onExerciseComplete

        let states = day.exercises.enumerated().map { index, exercise in
            let savedSets = initialLoggedSets.indices.contains(index) && !initialLoggedSets[index].isEmpty
                ? initialLoggedSets[index]
                : LogWorkoutView.initialSets(for: exercise)
            return ExerciseLogState(
                sets: savedSets,
                weight: exercise.targetWeight ?? 0,
                counterweight: exercise.targetCounterweight ?? 0,
                reps: max(exercise.reps, 0),
                durationSeconds: exercise.durationSeconds ?? 30,
                distanceMeters: exercise.distanceMeters ?? 100
            )
        }
        _exerciseStates = State(initialValue: states)
    }

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                StepProgress(
                    count: progressCount,
                    isSegmentComplete: isExerciseComplete,
                    currentIndex: activeExerciseIndex,
                    width: progressBarWidth,
                    spacing: progressBarSpacing
                )
                .padding(.top, AppLayout.screenTitleTopPadding)

                HorizontalSwipePager(
                    selection: $activeExerciseIndex,
                    pageCount: day.exercises.count,
                    direction: $exerciseSlideDirection
                ) {
                    exerciseContent(for: min(activeExerciseIndex, day.exercises.count - 1))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, 24)
            .floatingBottomChrome {
                VStack(spacing: 16) {
                    VStack(alignment: .center, spacing: 24) {
                        ForEach(currentTrackingMetrics) { metric in
                            NumberStepper(
                                label: metric.title,
                                value: metricBinding(metric),
                                minimum: metric == .zone ? 1 : 0,
                                maximum: metric.maximum
                            )
                        }
                    }
                    .frame(maxWidth: .infinity)

                    CTAButton(title: logButtonTitle, width: 312) {
                        logSet()
                    }
                    .scaleEffect(recentlyLoggedSetID == nil ? 1 : 1.025)
                    .shadow(color: recentlyLoggedSetID == nil ? .clear : AppColor.accent.opacity(0.22), radius: 14, x: 0, y: 0)
                    .animation(.spring(response: 0.2, dampingFraction: 0.72), value: recentlyLoggedSetID)
                }
            }
        }
        .onDisappear {
            persistCurrentExerciseSets()
            feedbackResetTask?.cancel()
            feedbackResetTask = nil
        }
    }

    @ViewBuilder
    private func exerciseContent(for index: Int) -> some View {
        let exercise = day.exercises[index]

        VStack(alignment: .leading, spacing: 0) {
            SectionTitle(text: exercise.name)
                .padding(.top, 24)

            SetTable(
                sets: exerciseStates[index].sets,
                recentlyLoggedSetID: exerciseStates[index].recentlyLoggedSetID,
                trackingMode: exercise.trackingMode
            )
            .padding(.top, 22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.bottom, AppLayout.logWorkoutChromeClearance(usesNativeTabBar: usesNativeTabBar))
    }

    private var weightBinding: Binding<Int> {
        Binding(
            get: {
                guard exerciseStates.indices.contains(activeExerciseIndex) else {
                    return 0
                }
                return exerciseStates[activeExerciseIndex].weight
            },
            set: { newValue in
                guard exerciseStates.indices.contains(activeExerciseIndex) else {
                    return
                }
                exerciseStates[activeExerciseIndex].weight = newValue
            }
        )
    }

    private var repsBinding: Binding<Int> {
        Binding(
            get: {
                guard exerciseStates.indices.contains(activeExerciseIndex) else {
                    return 0
                }
                return exerciseStates[activeExerciseIndex].reps
            },
            set: { newValue in
                guard exerciseStates.indices.contains(activeExerciseIndex) else {
                    return
                }
                exerciseStates[activeExerciseIndex].reps = newValue
            }
        )
    }

    private var currentTrackingMetrics: [ExercisePrescriptionMetric] {
        guard day.exercises.indices.contains(activeExerciseIndex) else {
            return [.weight, .reps]
        }
        return day.exercises[activeExerciseIndex].trackingMode.prescriptionMetrics
    }

    private func metricBinding(_ metric: ExercisePrescriptionMetric) -> Binding<Int> {
        Binding(
            get: {
                guard exerciseStates.indices.contains(activeExerciseIndex) else { return 0 }
                let state = exerciseStates[activeExerciseIndex]
                return switch metric {
                case .weight: state.weight
                case .counterweight: state.counterweight
                case .reps: state.reps
                case .duration: state.durationSeconds
                case .distance: state.distanceMeters
                case .rest, .zone, .rounds: 0
                }
            },
            set: { newValue in
                guard exerciseStates.indices.contains(activeExerciseIndex) else { return }
                switch metric {
                case .weight: exerciseStates[activeExerciseIndex].weight = newValue
                case .counterweight: exerciseStates[activeExerciseIndex].counterweight = newValue
                case .reps: exerciseStates[activeExerciseIndex].reps = newValue
                case .duration: exerciseStates[activeExerciseIndex].durationSeconds = newValue
                case .distance: exerciseStates[activeExerciseIndex].distanceMeters = newValue
                case .rest, .zone, .rounds: break
                }
            }
        )
    }

    private var recentlyLoggedSetID: LoggedSet.ID? {
        guard exerciseStates.indices.contains(activeExerciseIndex) else {
            return nil
        }
        return exerciseStates[activeExerciseIndex].recentlyLoggedSetID
    }

    private func logSet() {
        guard exerciseStates.indices.contains(activeExerciseIndex),
              day.exercises.indices.contains(activeExerciseIndex) else {
            return
        }

        let exercise = day.exercises[activeExerciseIndex]
        var state = exerciseStates[activeExerciseIndex]
        let weight = state.weight
        let reps = state.reps

        guard let nextIndex = state.sets.firstIndex(where: { !$0.isLogged(for: exercise.trackingMode) }) else {
            onExerciseComplete(state.sets)
            return
        }

        let sessionLoggedMaxWeight = AchievementDetector.sessionLoggedMaxWeight(in: state.sets)
        let isLastSet = nextIndex >= state.sets.count - 1

        for metric in exercise.trackingMode.prescriptionMetrics {
            switch metric {
            case .weight: state.sets[nextIndex].weight = state.weight
            case .counterweight: state.sets[nextIndex].counterweight = state.counterweight
            case .reps: state.sets[nextIndex].reps = state.reps
            case .duration: state.sets[nextIndex].durationSeconds = state.durationSeconds
            case .distance: state.sets[nextIndex].distanceMeters = state.distanceMeters
            case .rest, .zone, .rounds: break
            }
        }
        state.recentlyLoggedSetID = state.sets[nextIndex].id

        withAnimation(.spring(response: 0.4, dampingFraction: 0.78)) {
            exerciseStates[activeExerciseIndex] = state
        }

        onSetsChange(activeExerciseIndex, state.sets)
        showLogFeedback(for: state.sets[nextIndex].id, at: activeExerciseIndex)

        if exercise.trackingMode.prescriptionMetrics.contains(.weight),
           exercise.trackingMode.prescriptionMetrics.contains(.reps),
           AchievementDetector.shouldUnlock(
            weight: weight,
            reps: reps,
            previousBestWeight: previousBestWeight(exercise.name),
            sessionLoggedMaxWeight: sessionLoggedMaxWeight,
            hasAlreadyFiredThisExercise: achievementFiredExerciseKeys.contains(exercise.name.normalizedStatsKey)
        ) {
            let achievement = Achievement(
                exerciseName: exercise.name,
                weight: weight,
                reps: reps,
                date: Date(),
                username: username,
                previousBest: max(previousBestWeight(exercise.name) ?? 0, sessionLoggedMaxWeight)
            )
            onAchievementUnlocked(achievement, isLastSet ? state.sets : nil)
            if isLastSet {
                return
            }
        }

        if isLastSet {
            onExerciseComplete(state.sets)
        }
    }

    private func showLogFeedback(for setID: LoggedSet.ID, at index: Int) {
        feedbackResetTask?.cancel()
        feedbackResetTask = Task {
            try? await Task.sleep(nanoseconds: 360_000_000)
            guard !Task.isCancelled else {
                return
            }

            await MainActor.run {
                guard exerciseStates.indices.contains(index),
                      exerciseStates[index].recentlyLoggedSetID == setID else {
                    return
                }

                withAnimation(.spring(response: 0.18, dampingFraction: 0.9)) {
                    exerciseStates[index].recentlyLoggedSetID = nil
                }
                feedbackResetTask = nil
            }
        }
    }

    private func persistCurrentExerciseSets() {
        guard exerciseStates.indices.contains(activeExerciseIndex) else {
            return
        }
        onSetsChange(activeExerciseIndex, exerciseStates[activeExerciseIndex].sets)
    }

    private func isExerciseComplete(at index: Int) -> Bool {
        guard exerciseStates.indices.contains(index) else {
            return false
        }

        guard day.exercises.indices.contains(index) else { return false }
        return exerciseStates[index].sets.allSatisfy { $0.isLogged(for: day.exercises[index].trackingMode) }
    }

    private var progressCount: Int {
        max(day.exercises.count, 1)
    }

    private var progressBarSpacing: CGFloat {
        progressCount <= 5 ? 24 : 12
    }

    private var progressBarWidth: CGFloat {
        guard progressCount > 5 else {
            return 48
        }

        let availableWidth = 336 - (progressBarSpacing * CGFloat(progressCount - 1))
        return floor(availableWidth / CGFloat(progressCount))
    }

    private var logButtonTitle: String {
        recentlyLoggedSetID == nil ? "Log" : "Logged"
    }
}

private struct ExerciseLogState {
    var sets: [LoggedSet]
    var weight: Int = 0
    var counterweight: Int = 0
    var reps: Int = 0
    var durationSeconds: Int = 30
    var distanceMeters: Int = 100
    var recentlyLoggedSetID: LoggedSet.ID?
}

struct LogWorkoutView: View {
    var exercise: ExercisePrescription
    var exerciseIndex: Int
    var exerciseCount: Int
    var previousBestWeight: Int?
    var username: String?
    var hasFiredAchievementForExercise: Bool
    var onAchievementUnlocked: (Achievement, [LoggedSet]?) -> Void
    var onSetsChange: ([LoggedSet]) -> Void
    var onExerciseComplete: ([LoggedSet]) -> Void

    @State private var weight = 0
    @State private var reps = 0
    @State private var sets: [LoggedSet]
    @State private var recentlyLoggedSetID: LoggedSet.ID?
    @State private var feedbackResetTask: Task<Void, Never>?

    init(
        exercise: ExercisePrescription,
        exerciseIndex: Int,
        exerciseCount: Int,
        previousBestWeight: Int? = nil,
        username: String? = nil,
        hasFiredAchievementForExercise: Bool = false,
        initialSets: [LoggedSet]? = nil,
        onAchievementUnlocked: @escaping (Achievement, [LoggedSet]?) -> Void = { _, _ in },
        onSetsChange: @escaping ([LoggedSet]) -> Void = { _ in },
        onExerciseComplete: @escaping ([LoggedSet]) -> Void
    ) {
        self.exercise = exercise
        self.exerciseIndex = exerciseIndex
        self.exerciseCount = exerciseCount
        self.previousBestWeight = previousBestWeight
        self.username = username
        self.hasFiredAchievementForExercise = hasFiredAchievementForExercise
        self.onAchievementUnlocked = onAchievementUnlocked
        self.onSetsChange = onSetsChange
        self.onExerciseComplete = onExerciseComplete
        _sets = State(initialValue: initialSets ?? Self.initialSets(for: exercise))
    }

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                StepProgress(
                    count: progressCount,
                    isSegmentComplete: { _ in sets.allSatisfy { $0.isLogged(for: exercise.trackingMode) } },
                    currentIndex: exerciseIndex,
                    width: progressBarWidth,
                    spacing: progressBarSpacing
                )
                    .padding(.top, AppLayout.screenTitleTopPadding)

                SectionTitle(text: exercise.name)
                    .padding(.top, 24)

                SetTable(sets: sets, recentlyLoggedSetID: recentlyLoggedSetID, trackingMode: exercise.trackingMode)
                    .padding(.top, 22)

                Spacer(minLength: 0)

                VStack(alignment: .center, spacing: 24) {
                    NumberStepper(label: "Weight", value: $weight, minimum: 0, maximum: 300)
                    NumberStepper(label: "Reps", value: $reps, minimum: 0, maximum: 50)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 24)
            .floatingBottomChrome {
                CTAButton(title: logButtonTitle, width: 312) {
                    logSet()
                }
                .scaleEffect(recentlyLoggedSetID == nil ? 1 : 1.025)
                .shadow(color: recentlyLoggedSetID == nil ? .clear : AppColor.accent.opacity(0.22), radius: 14, x: 0, y: 0)
                .animation(.spring(response: 0.2, dampingFraction: 0.72), value: recentlyLoggedSetID)
            }
        }
        .onDisappear {
            onSetsChange(sets)
            feedbackResetTask?.cancel()
            feedbackResetTask = nil
        }
    }

    private func logSet() {
        guard let nextIndex = sets.firstIndex(where: { $0.weight == nil || $0.reps == nil }) else {
            onExerciseComplete(sets)
            return
        }

        let sessionLoggedMaxWeight = AchievementDetector.sessionLoggedMaxWeight(in: sets)
        let isLastSet = nextIndex >= sets.count - 1

        var updatedSets = sets
        updatedSets[nextIndex].weight = weight
        updatedSets[nextIndex].reps = reps

        withAnimation(.spring(response: 0.4, dampingFraction: 0.78)) {
            sets = updatedSets
            recentlyLoggedSetID = updatedSets[nextIndex].id
        }
        onSetsChange(updatedSets)
        showLogFeedback(for: updatedSets[nextIndex].id)

        if AchievementDetector.shouldUnlock(
            weight: weight,
            reps: reps,
            previousBestWeight: previousBestWeight,
            sessionLoggedMaxWeight: sessionLoggedMaxWeight,
            hasAlreadyFiredThisExercise: hasFiredAchievementForExercise
        ) {
            let achievement = Achievement(
                exerciseName: exercise.name,
                weight: weight,
                reps: reps,
                date: Date(),
                username: username,
                previousBest: max(previousBestWeight ?? 0, sessionLoggedMaxWeight)
            )
            onAchievementUnlocked(achievement, isLastSet ? updatedSets : nil)
            if isLastSet {
                return
            }
        }

        if isLastSet {
            onExerciseComplete(updatedSets)
        }
    }

    private func showLogFeedback(for setID: LoggedSet.ID) {
        feedbackResetTask?.cancel()
        feedbackResetTask = Task {
            try? await Task.sleep(nanoseconds: 360_000_000)
            guard !Task.isCancelled else {
                return
            }

            await MainActor.run {
                guard recentlyLoggedSetID == setID else {
                    return
                }

                withAnimation(.spring(response: 0.18, dampingFraction: 0.9)) {
                    recentlyLoggedSetID = nil
                }
                feedbackResetTask = nil
            }
        }
    }

    static func initialSets(for exercise: ExercisePrescription) -> [LoggedSet] {
        let entryCount = exercise.itemType == .timer ? (exercise.rounds ?? exercise.sets) : exercise.sets
        return (1...max(entryCount, 1)).map { index in
            LoggedSet(index: index, weight: nil, reps: nil)
        }
    }

    private var progressCount: Int {
        max(exerciseCount, 1)
    }

    private var progressBarSpacing: CGFloat {
        progressCount <= 5 ? 24 : 12
    }

    private var progressBarWidth: CGFloat {
        guard progressCount > 5 else {
            return 48
        }

        let availableWidth = 336 - (progressBarSpacing * CGFloat(progressCount - 1))
        return floor(availableWidth / CGFloat(progressCount))
    }

    private var logButtonTitle: String {
        recentlyLoggedSetID == nil ? "Log" : "Logged"
    }
}

private struct SetTable: View {
    var sets: [LoggedSet]
    var recentlyLoggedSetID: LoggedSet.ID?
    var trackingMode: ExerciseTrackingMode

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            headerRow
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: isScrollable) {
                    VStack(spacing: rowSpacing) {
                        ForEach(sets) { set in
                            SetTableRow(
                                set: set,
                                phase: phase(for: set),
                                isRecentlyLogged: set.id == recentlyLoggedSetID,
                                trackingMode: trackingMode
                            )
                            .id(set.id)
                        }
                    }
                }
                .frame(height: rowViewportHeight)
                .scrollDisabled(!isScrollable)
                .onChange(of: activeSetID) { _, newValue in
                    guard isScrollable, let newValue else {
                        return
                    }

                    withAnimation(.spring(response: 0.3, dampingFraction: 0.86)) {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }

    private var headerRow: some View {
        HStack(spacing: 12) {
            header("Set")
                .frame(width: 68, alignment: .leading)
            ForEach(trackingMode.prescriptionMetrics) { metric in
                header(metric.tableTitle)
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 2)
    }

    private func header(_ text: String) -> some View {
        Text(text)
            .font(AppFont.caption)
            .foregroundStyle(AppColor.secondaryText)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func phase(for set: LoggedSet) -> SetRowPhase {
        if set.isLogged(for: trackingMode) {
            return .completed
        }

        if set.id == activeSetID {
            return .active
        }

        return .upcoming
    }

    private var activeSetID: LoggedSet.ID? {
        sets.first { !$0.isLogged(for: trackingMode) }?.id
    }

    private var isScrollable: Bool {
        sets.count > maxFullyVisibleRows
    }

    private var rowViewportHeight: CGFloat {
        guard isScrollable else {
            return fullRowsHeight
        }

        let rowCount = scrollVisibleRows
        return ceil((rowCount * rowHeight) + ((rowCount - 1) * rowSpacing))
    }

    private var fullRowsHeight: CGFloat {
        guard !sets.isEmpty else {
            return 0
        }

        return (CGFloat(sets.count) * rowHeight) + (CGFloat(sets.count - 1) * rowSpacing)
    }

    private var maxFullyVisibleRows: Int {
        5
    }

    private var scrollVisibleRows: CGFloat {
        4.35
    }

    private var rowHeight: CGFloat {
        58
    }

    private var rowSpacing: CGFloat {
        8
    }
}

private struct SetTableRow: View {
    var set: LoggedSet
    var phase: SetRowPhase
    var isRecentlyLogged: Bool
    var trackingMode: ExerciseTrackingMode

    var body: some View {
        HStack(spacing: 12) {
            setCell
                .frame(width: 68, alignment: .leading)
            ForEach(trackingMode.prescriptionMetrics) { metric in
                let value = set.displayValue(for: metric)
                valueCell(value ?? "-", isEmpty: value == nil)
            }
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, minHeight: 58, maxHeight: 58, alignment: .leading)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(phase.fill)
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(isRecentlyLogged ? AppColor.accent.opacity(0.08) : .clear)
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(isRecentlyLogged ? AppColor.accent : phase.stroke, lineWidth: isRecentlyLogged || phase == .active ? 1.5 : 1)
        )
        .animation(.spring(response: 0.3, dampingFraction: 0.82), value: phase)
        .animation(.spring(response: 0.18, dampingFraction: 0.86), value: isRecentlyLogged)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
    }

    private var setCell: some View {
        HStack(spacing: 8) {
            Image(systemName: phase.symbol)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(phase.symbolColor)
                .frame(width: 18, height: 18)

            Text("\(set.index)")
                .font(AppFont.h2)
                .foregroundStyle(phase.numberColor)
                .monospacedDigit()
        }
    }

    private func valueCell(_ text: String, isEmpty: Bool) -> some View {
        Text(text)
            .font(Font.inter(size: 24, weight: .semibold, relativeTo: .title3))
            .monospacedDigit()
            .foregroundStyle(isEmpty ? phase.emptyValueColor : phase.valueColor)
            .contentTransition(.numericText())
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var accessibilityLabel: String {
        let values = trackingMode.prescriptionMetrics.map { metric in
            set.displayValue(for: metric).map { "\(metric.title) \($0)" } ?? "no \(metric.title.lowercased()) logged"
        }
        return "Set \(set.index), \(phase.accessibilityText), \(values.joined(separator: ", "))"
    }
}

private enum SetRowPhase: Equatable {
    case completed
    case active
    case upcoming

    var accessibilityText: String {
        switch self {
        case .completed:
            return "logged"
        case .active:
            return "next to log"
        case .upcoming:
            return "upcoming"
        }
    }

    var symbol: String {
        switch self {
        case .completed:
            return "checkmark.circle.fill"
        case .active:
            return "circle.fill"
        case .upcoming:
            return "circle"
        }
    }

    var fill: Color {
        switch self {
        case .completed:
            return AppColor.surface2
        case .active:
            return AppColor.surface2
        case .upcoming:
            return AppColor.surface1
        }
    }

    var stroke: Color {
        switch self {
        case .completed:
            return AppColor.border
        case .active:
            return AppColor.accent.opacity(0.72)
        case .upcoming:
            return AppColor.border.opacity(0.65)
        }
    }

    var symbolColor: Color {
        switch self {
        case .completed, .active:
            return AppColor.accent
        case .upcoming:
            return AppColor.tertiaryText
        }
    }

    var numberColor: Color {
        switch self {
        case .completed:
            return AppColor.primaryText
        case .active:
            return AppColor.accent
        case .upcoming:
            return AppColor.secondaryText
        }
    }

    var valueColor: Color {
        switch self {
        case .completed:
            return AppColor.primaryText
        case .active:
            return AppColor.accent
        case .upcoming:
            return AppColor.tertiaryText
        }
    }

    var emptyValueColor: Color {
        switch self {
        case .active:
            return AppColor.secondaryText
        case .completed, .upcoming:
            return AppColor.tertiaryText
        }
    }
}

private extension LoggedSet {
    func isLogged(for trackingMode: ExerciseTrackingMode) -> Bool {
        trackingMode.prescriptionMetrics.allSatisfy { metric in
            switch metric {
            case .weight: weight != nil
            case .counterweight: counterweight != nil
            case .reps: reps != nil
            case .duration: durationSeconds != nil
            case .distance: distanceMeters != nil
            case .rest, .zone, .rounds: true
            }
        }
    }

    func displayValue(for metric: ExercisePrescriptionMetric) -> String? {
        switch metric {
        case .weight: weight.map { "\($0)" }
        case .counterweight: counterweight.map { "\($0)" }
        case .reps: reps.map { "\($0)" }
        case .duration: durationSeconds.map(ExercisePrescription.durationText)
        case .distance: distanceMeters.map(ExercisePrescription.distanceText)
        case .rest, .zone, .rounds: nil
        }
    }
}

private extension ExercisePrescriptionMetric {
    var tableTitle: String {
        switch self {
        case .weight, .counterweight: "kg"
        case .reps: "Reps"
        case .duration: "Time"
        case .distance: "Distance"
        case .rest: "Rest"
        case .zone: "Zone"
        case .rounds: "Rounds"
        }
    }
}

struct WorkoutCompleteView: View {
    var workout: LoggedWorkout?
    var onFinish: () -> Void

    var body: some View {
        AppScreen {
            VStack(spacing: 0) {
                ScreenTitle(title: "Well done!")
                    .padding(.top, AppLayout.screenTitleTopPadding)

                VStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(AppColor.accent)
                            .frame(width: 100, height: 100)

                        Image(systemName: "checkmark")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundStyle(AppColor.base)
                    }
                    .frame(width: 120, height: 120)

                    SummaryCard(workout: workout)
                }
                .padding(.top, 48)
                .padding(.horizontal, 24)

                Spacer(minLength: 24)
            }
            .frame(maxWidth: .infinity)
            .floatingBottomChrome {
                CTAButton(title: "Finish", width: 312, action: onFinish)
            }
        }
    }
}

private struct SummaryCard: View {
    var workout: LoggedWorkout?

    var body: some View {
        VStack(spacing: 24) {
            summary(value: durationText, label: "Duration")
            divider
            summary(value: "\(workout?.exerciseCount ?? 8)", label: "Exercises")
            divider
            summary(value: "\(workout?.setCount ?? 32)", label: "Sets")
        }
        .padding(.vertical, 16)
        .frame(width: 354, height: 310)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }

    private var durationText: String {
        guard let minutes = workout?.durationMinutes else {
            return "1h 33min"
        }

        return "\(minutes / 60)h \(minutes % 60)min"
    }

    private func summary(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(AppFont.display)
                .tracking(-0.64)
            Text(label)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle()
            .fill(AppColor.border)
            .frame(height: 1)
            .frame(width: 338)
    }
}
