import SwiftUI

struct StartWorkoutView: View {
    var day: WorkoutDay
    var onStart: () -> Void

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                Text("Start Workout")
                    .font(AppFont.display)
                    .padding(.top, AppLayout.screenTitleTopPadding)

                HStack(alignment: .firstTextBaseline) {
                    SectionTitle(text: day.title)
                    Spacer()
                    Text("\(day.exercises.count) Exercises")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                }
                .padding(.top, 24)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        ForEach(day.exercises) { exercise in
                            ExerciseCard(exercise: exercise)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
                .scrollDismissesKeyboard(.interactively)

                HStack {
                    Spacer()
                    CTAButton(title: "Start Workout", width: 312, action: onStart)
                    Spacer()
                }
                .appBottomChromePadding()
            }
            .padding(.horizontal, 24)
        }
    }
}

struct LogWorkoutView: View {
    var exercise: ExercisePrescription
    var exerciseIndex: Int
    var exerciseCount: Int
    var previousBestWeight: Int?
    var username: String?
    var hasFiredAchievementForExercise: Bool
    var onAchievementUnlocked: (Achievement, [LoggedSet]?) -> Void
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
        onAchievementUnlocked: @escaping (Achievement, [LoggedSet]?) -> Void = { _, _ in },
        onExerciseComplete: @escaping ([LoggedSet]) -> Void
    ) {
        self.exercise = exercise
        self.exerciseIndex = exerciseIndex
        self.exerciseCount = exerciseCount
        self.previousBestWeight = previousBestWeight
        self.username = username
        self.hasFiredAchievementForExercise = hasFiredAchievementForExercise
        self.onAchievementUnlocked = onAchievementUnlocked
        self.onExerciseComplete = onExerciseComplete
        _sets = State(initialValue: Self.initialSets(for: exercise))
    }

    var body: some View {
        AppScreen {
            VStack(alignment: .leading, spacing: 0) {
                StepProgress(count: progressCount, active: activeProgress, width: progressBarWidth, spacing: progressBarSpacing)
                    .padding(.top, AppLayout.screenTitleTopPadding)

                SectionTitle(text: exercise.name)
                    .padding(.top, 24)

                SetTable(sets: sets, recentlyLoggedSetID: recentlyLoggedSetID)
                    .padding(.top, 22)

                Spacer(minLength: 0)

                VStack(alignment: .center, spacing: 24) {
                    NumberStepper(label: "Weight", value: $weight, minimum: 0, maximum: 300)
                    NumberStepper(label: "Reps", value: $reps, minimum: 0, maximum: 50)
                }
                .frame(maxWidth: .infinity)
                .padding(.bottom, 16)

                HStack {
                    Spacer()
                    CTAButton(title: logButtonTitle, width: 312) {
                        logSet()
                    }
                    .scaleEffect(recentlyLoggedSetID == nil ? 1 : 1.025)
                    .shadow(color: recentlyLoggedSetID == nil ? .clear : AppColor.accent.opacity(0.22), radius: 14, x: 0, y: 0)
                    .animation(.spring(response: 0.2, dampingFraction: 0.72), value: recentlyLoggedSetID)
                    Spacer()
                }
                .appBottomChromePadding()
            }
            .padding(.horizontal, 24)
        }
        .onDisappear {
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

    private static func initialSets(for exercise: ExercisePrescription) -> [LoggedSet] {
        (1...exercise.sets).map { index in
            LoggedSet(index: index, weight: nil, reps: nil)
        }
    }

    private var progressCount: Int {
        max(exerciseCount, 1)
    }

    private var activeProgress: Int {
        min(exerciseIndex + 1, progressCount)
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
                                isRecentlyLogged: set.id == recentlyLoggedSetID
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
            header("kg")
            header("Reps")
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
        if set.isLogged {
            return .completed
        }

        if set.id == activeSetID {
            return .active
        }

        return .upcoming
    }

    private var activeSetID: LoggedSet.ID? {
        sets.first { !$0.isLogged }?.id
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

    var body: some View {
        HStack(spacing: 12) {
            setCell
                .frame(width: 68, alignment: .leading)
            valueCell(set.weight.map(String.init) ?? "-", isEmpty: set.weight == nil)
            valueCell(set.reps.map(String.init) ?? "-", isEmpty: set.reps == nil)
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
        let weightText = set.weight.map { "\($0) kilograms" } ?? "no weight logged"
        let repsText = set.reps.map { "\($0) reps" } ?? "no reps logged"
        return "Set \(set.index), \(phase.accessibilityText), \(weightText), \(repsText)"
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
    var isLogged: Bool {
        weight != nil && reps != nil
    }
}

struct WorkoutCompleteView: View {
    var workout: LoggedWorkout?
    var onFinish: () -> Void

    var body: some View {
        AppScreen {
            VStack(spacing: 0) {
                Text("Well done!")
                    .font(AppFont.display)
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

                CTAButton(title: "Finish", width: 312, action: onFinish)
                    .appBottomChromePadding()
            }
            .frame(maxWidth: .infinity)
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
