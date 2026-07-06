import Charts
import SwiftUI

private enum ExerciseStatsFormatting {
    private static let progressionDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter
    }()

    static func progressionDateText(for date: Date) -> String {
        progressionDateFormatter.string(from: date)
    }
}

struct StatsView: View {
    var topExercises: [ExerciseSetSummary]
    var onOpenExercise: (String) -> Void
    private let exerciseCatalog: any ExerciseCatalogService

    @FocusState private var searchFocused: Bool
    @State private var searchQuery = ""
    @State private var searchResults: [ExercisePrescription] = []
    @State private var searchState: PlanEntrySearchState = .idle

    init(
        topExercises: [ExerciseSetSummary],
        exerciseCatalog: any ExerciseCatalogService = ExerciseCatalogServiceFactory.live(),
        onOpenExercise: @escaping (String) -> Void
    ) {
        self.topExercises = topExercises
        self.exerciseCatalog = exerciseCatalog
        self.onOpenExercise = onOpenExercise
    }

    var body: some View {
        AppScreen {
            ZStack(alignment: .bottom) {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        searchFocused = false
                    }

                content

                StatsSearchSurface(
                    query: $searchQuery,
                    focused: $searchFocused,
                    results: searchResults,
                    searchState: searchState,
                    onSelect: openExercise
                )
                .appBottomChromePadding()
            }
            .padding(.horizontal, 24)
        }
        .animation(.spring(response: 0.24, dampingFraction: 0.88), value: searchQuery.isEmpty)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: searchResults.count)
        .task(id: searchQuery) {
            await updateExerciseSearch()
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScreenTitle(title: "Stats")
                .padding(.top, AppLayout.screenTitleTopPadding)

            SectionTitle(text: "Most logged")
                .padding(.top, 24)

            VStack(spacing: 12) {
                if topExercises.isEmpty {
                    EmptyStatsCard()
                } else {
                    ForEach(topExercises) { exercise in
                        Button {
                            openExercise(exercise.exerciseName)
                        } label: {
                            FrequentExerciseCard(summary: exercise)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(exercise.exerciseName), \(exercise.setCount) logged sets")
                    }
                }
            }
            .padding(.top, 12)

            Spacer(minLength: 220)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func openExercise(_ exerciseName: String) {
        Haptics.tap(.medium)
        searchFocused = false
        searchQuery = ""
        searchResults = []
        searchState = .idle
        onOpenExercise(exerciseName.planDisplayName)
    }

    private func updateExerciseSearch() async {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !query.isEmpty else {
            searchResults = []
            searchState = .idle
            return
        }

        searchState = .loading

        do {
            try await Task.sleep(for: .milliseconds(180))
        } catch {
            return
        }

        guard !Task.isCancelled else {
            return
        }

        let response = await exerciseCatalog.search(query: query)

        guard !Task.isCancelled else {
            return
        }

        searchResults = response.exercises

        if response.exercises.isEmpty {
            searchState = .message(response.notice?.message ?? "No matching exercises")
        } else if let notice = response.notice {
            searchState = .message(notice.message)
        } else {
            searchState = .loaded
        }
    }
}

struct ExerciseStatsView: View {
    var stats: ExerciseStatsDetails
    var onBack: () -> Void

    var body: some View {
        AppScreen {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    ScreenNavigationTitle(
                        title: stats.exerciseName,
                        backAccessibilityLabel: "Back to stats",
                        onBack: onBack
                    )
                        .padding(.top, AppLayout.screenTitleTopPadding)

                    chartSectionHeader
                        .padding(.top, 24)

                    TenRMChartCard(points: stats.progression)
                        .padding(.top, 8)

                    SectionTitle(text: "History")
                        .padding(.top, 24)

                    Group {
                        if stats.progression.isEmpty {
                            EmptyExerciseStatsCard()
                        } else {
                            ExerciseStatsHistoryList(points: stats.progression.reversed())
                        }
                    }
                    .padding(.top, 12)
                    .padding(.bottom, AppLayout.contentBottomPadding)
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .scrollDismissesKeyboard(.interactively)
            .padding(.horizontal, 24)
        }
    }

    private var chartSectionHeader: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("10RM")
                .font(AppFont.h2)
                .foregroundStyle(AppColor.primaryText)
                .lineLimit(1)

            Spacer(minLength: 12)

            Text("kg")
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)
        }
    }
}

private struct FrequentExerciseCard: View {
    var summary: ExerciseSetSummary

    var body: some View {
        CardShell(height: 80) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(summary.exerciseName)
                        .font(AppFont.h2)
                        .lineLimit(1)

                    Text("\(summary.setCount) Sets")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }

                Spacer(minLength: 12)

                Image(systemName: "chevron.right")
                    .font(.system(size: 20, weight: .regular))
                    .foregroundStyle(AppColor.secondaryText)
                    .frame(width: 36, height: 36)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct EmptyStatsCard: View {
    var body: some View {
        CardShell(height: 102) {
            VStack(alignment: .leading, spacing: 4) {
                Text("No logged sets yet")
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)

                Text("Finish a workout to build your stats.")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct StatsSearchSurface: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding
    var results: [ExercisePrescription]
    var searchState: PlanEntrySearchState
    var onSelect: (String) -> Void

    private var isExpanded: Bool {
        !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var resultViewportHeight: CGFloat {
        let visibleRows = max(1, min(results.count + statusRowCount, 5))
        return CGFloat(visibleRows * 26 + max(0, visibleRows - 1) * 16)
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
            if isExpanded {
                resultList
                    .transition(.opacity.combined(with: .move(edge: .bottom)))

                providerAttribution
                    .transition(.opacity)

                Rectangle()
                    .fill(AppColor.border)
                    .frame(height: 1)
                    .transition(.opacity)
            }

            searchField
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 15)
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 56, alignment: .bottomLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: isExpanded)
        .animation(.spring(response: 0.22, dampingFraction: 0.88), value: results.count)
    }

    private var resultList: some View {
        ScrollView(showsIndicators: results.count > 5) {
            VStack(alignment: .leading, spacing: 16) {
                if let statusMessage {
                    Text(statusMessage)
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(maxWidth: .infinity, minHeight: 26, alignment: .leading)
                }

                if results.isEmpty && statusMessage == nil {
                    Text("No matching exercises")
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(maxWidth: .infinity, minHeight: 26, alignment: .leading)
                } else {
                    ForEach(results) { exercise in
                        Button {
                            onSelect(exercise.name)
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
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, minHeight: resultViewportHeight, maxHeight: resultViewportHeight, alignment: .bottomLeading)
        .scrollDismissesKeyboard(.interactively)
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
    }
}

private struct TenRMChartCard: View {
    var points: [ExerciseStatsPoint]

    var body: some View {
        CardShell(height: 204) {
            if points.isEmpty {
                Text("No logged sets yet")
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.secondaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Chart {
                        ForEach(yAxisValues, id: \.self) { value in
                            RuleMark(y: .value("Guide", value))
                                .foregroundStyle(AppColor.border.opacity(0.82))
                                .lineStyle(StrokeStyle(lineWidth: 1))
                        }

                        ForEach(points) { point in
                            LineMark(
                                x: .value("Date", point.date),
                                y: .value("10RM", point.averageTenRM)
                            )
                            .foregroundStyle(AppColor.accent)
                            .interpolationMethod(.catmullRom)
                            .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

                            PointMark(
                                x: .value("Date", point.date),
                                y: .value("10RM", point.averageTenRM)
                            )
                            .foregroundStyle(AppColor.accent)
                            .symbolSize(point.isPersonalBest ? 36 : 24)
                        }
                    }
                    .chartYScale(domain: yDomain)
                    .chartXAxis(.hidden)
                    .chartYAxis {
                        AxisMarks(position: .leading, values: yAxisValues) { value in
                            AxisValueLabel {
                                if let yValue = value.as(Double.self) {
                                    Text(yAxisText(for: yValue))
                                        .font(AppFont.caption)
                                        .foregroundStyle(AppColor.secondaryText.opacity(0.72))
                                        .frame(width: 24, alignment: .leading)
                                }
                            }
                        }
                    }
                    .chartPlotStyle { plotArea in
                        plotArea
                            .background(AppColor.surface1)
                    }
                    .frame(maxWidth: .infinity, minHeight: 156, maxHeight: 156)

                    HStack(spacing: 0) {
                        ForEach(Array(xAxisDates.enumerated()), id: \.offset) { index, date in
                            Text(axisDateText(for: date))
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.secondaryText.opacity(0.78))
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: xAxisAlignment(for: index))
                        }
                    }
                    .padding(.leading, 42)
                    .frame(height: 16)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
    }

    private var xAxisDates: [Date] {
        let dates = points.map(\.date).sorted()

        guard let first = dates.first else {
            return []
        }

        guard let last = dates.last, first != last else {
            return [first]
        }

        let midpoint = Date(timeIntervalSince1970: (first.timeIntervalSince1970 + last.timeIntervalSince1970) / 2)
        return [first, midpoint, last]
    }

    private var yAxisValues: [Double] {
        let lower = yAxisScale.lower
        let step = yAxisScale.step

        return (0...3).map { index in
            lower + step * Double(index)
        }
    }

    private var yDomain: ClosedRange<Double> {
        yAxisScale.lower...yAxisScale.upper
    }

    private var yAxisScale: (lower: Double, upper: Double, step: Double) {
        let values = points.map(\.averageTenRM)
        guard let minValue = values.min(),
              let maxValue = values.max() else {
            return (0, 100, 25)
        }

        if minValue == maxValue {
            let step = 5.0
            let lower = max(0, floor((minValue - step) / step) * step)
            return (lower, lower + step * 3, step)
        }

        let step = niceAxisStep(for: (maxValue - minValue) / 3)
        let padding = max(step * 0.28, 1)
        let lower = max(0, floor((minValue - padding) / step) * step)
        let upper = lower + step * 3

        if upper >= maxValue {
            return (lower, upper, step)
        }

        let adjustedUpper = ceil((maxValue + padding) / step) * step
        let adjustedLower = max(0, adjustedUpper - step * 3)
        return (adjustedLower, adjustedUpper, step)
    }

    private func axisDateText(for date: Date) -> String {
        ExerciseStatsFormatting.progressionDateText(for: date)
    }

    private func yAxisText(for value: Double) -> String {
        "\(Int(value.rounded()))"
    }

    private func niceAxisStep(for rawStep: Double) -> Double {
        let magnitude = pow(10, floor(log10(max(rawStep, 1))))
        let normalized = rawStep / magnitude
        let factor: Double

        switch normalized {
        case ...1:
            factor = 1
        case ...2:
            factor = 2
        case ...5:
            factor = 5
        default:
            factor = 10
        }

        return factor * magnitude
    }

    private func xAxisAlignment(for index: Int) -> Alignment {
        switch index {
        case 0:
            .leading
        case xAxisDates.count - 1:
            .trailing
        default:
            .center
        }
    }
}

private struct ExerciseStatsHistoryList: View {
    var points: [ExerciseStatsPoint]

    var body: some View {
        CardShell {
            VStack(spacing: 0) {
                ForEach(Array(points.enumerated()), id: \.element.id) { index, point in
                    if index > 0 {
                        historyDivider
                    }

                    ExerciseStatsHistoryRow(
                        point: point,
                        delta: deltaFromPrevious(at: index)
                    )
                }
            }
        }
    }

    private var historyDivider: some View {
        Rectangle()
            .fill(AppColor.border)
            .frame(height: 1)
    }

    private func deltaFromPrevious(at index: Int) -> Double? {
        guard index + 1 < points.count else {
            return nil
        }

        return points[index].averageTenRM - points[index + 1].averageTenRM
    }
}

private struct ExerciseStatsHistoryRow: View {
    var point: ExerciseStatsPoint
    var delta: Double?

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(dateText)
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.primaryText)
                        .lineLimit(1)

                    if point.isPersonalBest {
                        PersonalBestBadge()
                    }
                }

                Text(setCountText)
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            VStack(alignment: .trailing, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(formattedTenRM)
                        .font(AppFont.h2)
                        .foregroundStyle(point.isPersonalBest ? AppColor.accent : AppColor.primaryText)
                        .lineLimit(1)

                    Text("kg")
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }

                if let deltaText {
                    Text(deltaText)
                        .font(AppFont.caption)
                        .foregroundStyle(deltaColor)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, 14)
        .accessibilityElement(children: .combine)
    }

    private var formattedTenRM: String {
        if point.averageTenRM >= 100 {
            return String(format: "%.0f", point.averageTenRM)
        }

        return String(format: "%.1f", point.averageTenRM)
    }

    private var setCountText: String {
        point.setCount == 1 ? "1 set" : "\(point.setCount) sets"
    }

    private var dateText: String {
        ExerciseStatsFormatting.progressionDateText(for: point.date)
    }

    private var deltaText: String? {
        guard let delta, abs(delta) >= 0.05 else {
            return nil
        }

        let formatted = abs(delta) >= 100
            ? String(format: "%.0f", abs(delta))
            : String(format: "%.1f", abs(delta))

        if delta > 0 {
            return "+\(formatted) kg"
        }

        return "−\(formatted) kg"
    }

    private var deltaColor: Color {
        guard let delta else {
            return AppColor.secondaryText
        }

        if delta > 0 {
            return AppColor.accent
        }

        if delta < 0 {
            return AppColor.destructive
        }

        return AppColor.secondaryText
    }
}

private struct PersonalBestBadge: View {
    var body: some View {
        Text("PR")
            .font(AppFont.caption)
            .foregroundStyle(AppColor.base)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(AppColor.accent, in: Capsule())
            .accessibilityLabel("Personal best")
    }
}

private struct EmptyExerciseStatsCard: View {
    var body: some View {
        CardShell(height: 102) {
            VStack(alignment: .leading, spacing: 4) {
                Text("No history yet")
                    .font(AppFont.h2)

                Text("Log this exercise to see progress.")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
