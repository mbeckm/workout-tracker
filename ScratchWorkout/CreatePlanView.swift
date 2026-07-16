import SwiftUI

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

    var actionSymbol: String {
        switch self {
        case .sets:
            "chevron.right"
        case .reps:
            "checkmark"
        }
    }

    var actionAccessibilityLabel: String {
        switch self {
        case .sets:
            "Continue to reps"
        case .reps:
            "Save exercise"
        }
    }
}
struct ExerciseDraft: Identifiable, Equatable {
    var id = UUID()
    var editingID: UUID?
    var name: String
    var sets: Int
    var reps: Int
    var sourceExercise: ExercisePrescription? = nil
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
                        .stroke(AppColor.surfaceOutline, lineWidth: 1)
                )
            }
            .buttonStyle(AppPressFeedbackStyle())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 24)
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.surfaceOutline, lineWidth: 1)
        )
        .accessibilityLabel("No exercises yet")
    }
}

struct ExerciseDraftSurface: View {
    @Binding var draft: ExerciseDraft
    @Binding var step: ExerciseDraftStep
    var onAdvance: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
                        .monospacedDigit()
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

                DraftRoundButton(symbol: step.actionSymbol, fill: AppColor.accent, foreground: AppColor.base, strokeWidth: 0, accessibilityLabel: step.actionAccessibilityLabel, action: onAdvance)
            }
            .frame(height: 45)
        }
        .padding(24)
        .frame(maxWidth: .infinity, minHeight: 157, maxHeight: 157, alignment: .topLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(AppColor.surfaceOutline, lineWidth: 1)
        )
        .animation(AppMotion.stateChange(reduceMotion: reduceMotion), value: step)
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
        .buttonStyle(AppPressFeedbackStyle())
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
                .highPriorityGesture(
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
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var deleteBackgroundOpacity: Double {
        min(1, max(0, Double(-horizontalOffset / 48)))
    }
}

struct PlanEntrySurface: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var results: [ExercisePrescription]
    var searchState: PlanEntrySearchState = .idle
    var autoFocus = true
    var onConfigure: (ExercisePrescription) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isExpanded: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var resultViewportHeight: CGFloat {
        let visibleRows = max(1, min(results.count + statusRowCount, 5))
        return CGFloat(visibleRows * 44 + max(0, visibleRows - 1) * 8)
    }

    private var statusMessage: String? {
        switch searchState {
        case .idle, .loaded:
            nil
        case .loading:
            "Searching exercises"
        case .message(let message):
            message
        }
    }

    private var statusRowCount: Int {
        statusMessage == nil ? 0 : 1
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
                    VStack(alignment: .leading, spacing: 8) {
                        if let statusMessage {
                            Text(statusMessage)
                                .font(AppFont.h2)
                                .foregroundStyle(AppColor.secondaryText)
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }

                        if results.isEmpty && statusMessage == nil {
                            Text("No matching exercises")
                                .font(AppFont.h2)
                                .foregroundStyle(AppColor.secondaryText)
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        } else {
                            ForEach(results) { exercise in
                                Button {
                                    onConfigure(exercise)
                                } label: {
                                    Text(exercise.name.planDisplayName)
                                        .font(AppFont.h2)
                                        .foregroundStyle(AppColor.primaryText)
                                        .lineLimit(1)
                                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(AppPressFeedbackStyle())
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, minHeight: resultViewportHeight, maxHeight: resultViewportHeight, alignment: .topLeading)
                .scrollDismissesKeyboard(.interactively)
                .transition(
                    reduceMotion
                        ? .opacity
                        : .opacity.combined(with: .offset(y: -12))
                )

                providerAttribution
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 56, alignment: .topLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.surfaceOutline, lineWidth: 1)
        )
        .animation(AppMotion.searchExpansion(reduceMotion: reduceMotion), value: isExpanded)
    }

    private var providerAttribution: some View {
        Link(destination: URL(string: "https://ascendapi.com")!) {
            Text("Exercise data by AscendAPI")
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityLabel("Exercise data by AscendAPI")
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

enum PlanEntrySearchState: Equatable {
    case idle
    case loading
    case loaded
    case message(String)
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
        .frame(maxWidth: .infinity, minHeight: 44, maxHeight: 44, alignment: .leading)
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
                .frame(width: width, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(AppPressFeedbackStyle())
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
            return AppColor.accent
        } else {
            return AppColor.border
        }
    }
}

extension String {
    var planDisplayName: String {
        let base: String
        if let parenthesis = firstIndex(of: "(") {
            base = String(self[..<parenthesis]).trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            base = self
        }

        return base.exerciseCatalogDisplayText
    }
}
