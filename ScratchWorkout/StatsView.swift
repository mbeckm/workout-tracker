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
    var overview: StatsOverview
    var onOpenExercise: (String) -> Void
    private let exerciseCatalog: any ExerciseCatalogService

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var searchFocused: Bool
    @State private var isSearchPresented = false
    @State private var searchQuery = ""
    @State private var searchResults: [ExercisePrescription] = []
    @State private var searchState: PlanEntrySearchState = .idle

    init(
        overview: StatsOverview,
        exerciseCatalog: any ExerciseCatalogService = ExerciseCatalogServiceFactory.live(),
        onOpenExercise: @escaping (String) -> Void
    ) {
        self.overview = overview
        self.exerciseCatalog = exerciseCatalog
        self.onOpenExercise = onOpenExercise
    }

    var body: some View {
        AppScreen {
            ZStack(alignment: .bottom) {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture {
                        dismissSearchIfEmpty()
                    }

                content

            }
            .padding(.horizontal, 24)
            .floatingBottomChrome {
                Group {
                    if isSearchPresented {
                        StatsSearchSurface(
                            query: $searchQuery,
                            focused: $searchFocused,
                            results: searchResults,
                            searchState: searchState,
                            onDismiss: dismissSearch,
                            onSelect: openExercise
                        )
                        .frame(maxWidth: 312)
                        .transition(
                            reduceMotion
                                ? .opacity
                                : .opacity.combined(with: .scale(scale: 0.96, anchor: .bottomTrailing))
                        )
                    } else {
                        StatsSearchButton(action: presentSearch)
                            .frame(maxWidth: 312, alignment: .trailing)
                            .transition(
                                reduceMotion
                                    ? .opacity
                                    : .opacity.combined(with: .scale(scale: 0.96, anchor: .bottomTrailing))
                            )
                    }
                }
                .animation(AppMotion.searchExpansion(reduceMotion: reduceMotion), value: isSearchPresented)
            }
        }
        .task(id: searchQuery) {
            await updateExerciseSearch()
        }
    }

    private var content: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                ScreenTitle(title: "Stats")
                    .padding(.top, AppLayout.screenTitleTopPadding)

                VStack(alignment: .leading, spacing: 4) {
                    SectionTitle(text: "Biggest Gains")

                    Text("Estimated 10RM · First to latest session · 60 days")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, 24)

                progressLeaders
                    .padding(.top, 12)

                SectionTitle(text: "Most Logged")
                    .padding(.top, 24)

                VStack(spacing: 12) {
                    if overview.mostLoggedExercises.isEmpty {
                        EmptyStatsCard()
                    } else {
                        ForEach(overview.mostLoggedExercises) { exercise in
                            Button {
                                openExercise(exercise.exerciseName)
                            } label: {
                                MostLoggedExerciseCard(summary: exercise)
                            }
                            .buttonStyle(AppPressFeedbackStyle())
                            .accessibilityLabel(
                                "Rank \(exercise.rank), \(exercise.exerciseName), \(exercise.totalSetCount) total logged sets"
                            )
                        }
                    }
                }
                .padding(.top, 12)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .floatingBottomChromeScrollPadding()
        }
        .scrollDismissesKeyboard(.interactively)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var progressLeaders: some View {
        if overview.progressLeaders.isEmpty {
            EmptyProgressCard()
        } else if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 12) {
                progressLeaderButtons
            }
        } else {
            HStack(alignment: .top, spacing: 12) {
                progressLeaderButtons
            }
        }
    }

    @ViewBuilder
    private var progressLeaderButtons: some View {
        ForEach(overview.progressLeaders) { exercise in
            Button {
                openExercise(exercise.exerciseName)
            } label: {
                ProgressLeaderCard(summary: exercise)
            }
            .buttonStyle(AppPressFeedbackStyle())
            .accessibilityLabel(
                "\(exercise.exerciseName), \(exercise.percentageChange.rounded().formatted()) percent estimated 10 rep max progress in 60 days"
            )
        }
    }

    private func openExercise(_ exerciseName: String) {
        Haptics.tap(.medium)
        isSearchPresented = false
        searchFocused = false
        searchQuery = ""
        searchResults = []
        searchState = .idle
        onOpenExercise(exerciseName.planDisplayName)
    }

    private func presentSearch() {
        Haptics.tap()
        isSearchPresented = true

        Task { @MainActor in
            await Task.yield()
            searchFocused = true
        }
    }

    private func dismissSearchIfEmpty() {
        searchFocused = false

        if searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            isSearchPresented = false
        }
    }

    private func dismissSearch() {
        searchFocused = false
        searchQuery = ""
        searchResults = []
        searchState = .idle
        isSearchPresented = false
    }

    private func updateExerciseSearch() async {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !query.isEmpty else {
            searchResults = []
            searchState = .idle
            return
        }

        PerformanceTrace.event(PerformanceTrace.Name.searchQueryChanged)
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
        PerformanceTrace.event(PerformanceTrace.Name.searchResultsUpdated)

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

    var body: some View {
        AppScreen {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    ScreenTitle(title: stats.exerciseName, minimumScaleFactor: 0.72)
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

private struct ProgressLeaderCard: View {
    var summary: ExerciseProgressSummary

    var body: some View {
        CardShell(height: 108) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .center, spacing: 8) {
                    Text("+\(summary.percentageChange.rounded().formatted())%")
                        .font(AppFont.metric)
                        .foregroundStyle(AppColor.accent)
                        .monospacedDigit()
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: 20, height: 44)
                }

                Spacer(minLength: 0)

                Text(summary.exerciseName)
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct MostLoggedExerciseCard: View {
    var summary: ExerciseVolumeSummary

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var maxSetCount: Int {
        max(summary.weeklyVolumes.map(\.setCount).max() ?? 0, 1)
    }

    private var chartAccessibilityText: String {
        summary.weeklyVolumes
            .map { volume in
                "Week of \(volume.weekStart.formatted(.dateTime.month(.wide).day())), \(volume.setCount) sets"
            }
            .joined(separator: ", ")
    }

    var body: some View {
        CardShell(height: 176) {
            VStack(alignment: .leading, spacing: 10) {
                cardHeader

                Text("Set volume · Last 6 weeks")
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)

                Chart(summary.weeklyVolumes) { volume in
                    let isCurrentWeek = volume.id == summary.weeklyVolumes.last?.id

                    BarMark(
                        x: .value("Week", volume.weekStart, unit: .weekOfYear),
                        y: .value("Sets", volume.setCount)
                    )
                    .foregroundStyle(
                        isCurrentWeek
                            ? AppColor.accent
                            : AppColor.secondaryText.opacity(0.68)
                    )
                    .cornerRadius(4)
                    .annotation(position: .overlay, alignment: .center) {
                        if volume.setCount > 0 {
                            Text("\(volume.setCount)")
                                .font(AppFont.caption)
                                .foregroundStyle(isCurrentWeek ? AppColor.base : AppColor.primaryText)
                                .monospacedDigit()
                        }
                    }
                }
                .chartYScale(domain: 0...Double(maxSetCount + 1))
                .chartYAxis(.hidden)
                .chartXAxis {
                    AxisMarks(values: summary.weeklyVolumes.map(\.weekStart)) { value in
                        AxisValueLabel {
                            if let date = value.as(Date.self) {
                                let isCurrentWeek = date == summary.weeklyVolumes.last?.weekStart

                                Text(date, format: .dateTime.month(.abbreviated).day())
                                    .font(AppFont.caption)
                                    .foregroundStyle(isCurrentWeek ? AppColor.accent : AppColor.secondaryText)
                            }
                        }
                    }
                }
                .frame(height: 70)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Weekly logged sets")
                .accessibilityValue(chartAccessibilityText)
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var cardHeader: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 8) {
                    rankLabel

                    Text(summary.exerciseName)
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.primaryText)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 0)

                    chevron
                }

                Text("\(summary.totalSetCount) total sets")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .monospacedDigit()
            }
        } else {
            HStack(alignment: .center, spacing: 10) {
                rankLabel

                Text(summary.exerciseName)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)

                Spacer(minLength: 6)

                Text("\(summary.totalSetCount) total")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
                    .monospacedDigit()
                    .lineLimit(1)

                chevron
            }
        }
    }

    private var rankLabel: some View {
        Text("#\(summary.rank)")
            .font(AppFont.label)
            .foregroundStyle(AppColor.secondaryText)
            .monospacedDigit()
            .lineLimit(1)
    }

    private var chevron: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(AppColor.secondaryText)
            .frame(width: 20, height: 44)
    }
}

private struct EmptyProgressCard: View {
    var body: some View {
        CardShell(height: 102) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Keep building your baseline")
                        .font(AppFont.h2)
                        .foregroundStyle(AppColor.primaryText)

                    Text("Log the same weighted exercise twice to see your 10RM progress.")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
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
    var onDismiss: () -> Void
    var onSelect: (String) -> Void

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
            if isExpanded {
                resultList
                    .transition(
                        reduceMotion
                            ? .opacity
                            : .opacity.combined(with: .offset(y: 12))
                    )

                providerAttribution
                    .transition(.opacity)

                Rectangle()
                    .fill(AppColor.border)
                    .frame(height: 1)
                    .transition(.opacity)
            }

            searchField
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 12)
        .frame(minWidth: 0, maxWidth: .infinity, minHeight: 52, alignment: .bottomLeading)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.surfaceOutline, lineWidth: 1)
        )
        .animation(AppMotion.searchExpansion(reduceMotion: reduceMotion), value: isExpanded)
    }

    private var resultList: some View {
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
                            onSelect(exercise.name)
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
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(AppColor.secondaryText)
                .frame(width: 22, height: 22)

            TextField(
                "",
                text: $query,
                prompt: Text("Search exercises")
                    .foregroundStyle(AppColor.secondaryText)
            )
                .focused(focused)
                .font(AppFont.subheading)
                .tint(AppColor.accent)
                .foregroundStyle(AppColor.primaryText)
                .submitLabel(.search)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Exercise search")

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AppColor.secondaryText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(AppPressFeedbackStyle())
            .accessibilityLabel("Close exercise search")
        }
        .frame(maxWidth: .infinity, minHeight: 28, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture {
            focused.wrappedValue = true
        }
    }
}

private struct StatsSearchButton: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18, weight: .semibold))

                Text("Search")
                    .font(AppFont.subheading)
                    .lineLimit(1)
            }
            .foregroundStyle(AppColor.primaryText)
            .padding(.leading, 14)
            .padding(.trailing, 16)
            .frame(minHeight: 48)
            .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.surfaceOutline, lineWidth: 1)
            }
        }
        .buttonStyle(AppPressFeedbackStyle())
        .accessibilityLabel("Search exercises")
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
                                        .foregroundStyle(AppColor.secondaryText)
                                        .frame(width: 24, alignment: .leading)
                                }
                            }
                        }
                    }
                    .chartPlotStyle { plotArea in
                        plotArea
                            .background(AppColor.surface1)
                            .clipShape(Rectangle())
                    }
                    .frame(maxWidth: .infinity, minHeight: 156, maxHeight: 156)

                    HStack(spacing: 0) {
                        ForEach(Array(xAxisDates.enumerated()), id: \.offset) { index, date in
                            Text(axisDateText(for: date))
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.secondaryText)
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

        // Keep exactly 3 nice steps (4 labels) while ensuring every data point
        // stays inside the domain. The previous adjust-from-the-top path could
        // raise `lower` above `minValue`, which drew the line outside the plot.
        var step = niceAxisStep(for: (maxValue - minValue) / 3)
        for _ in 0..<8 {
            let padding = max(step * 0.28, 1)
            let lower = max(0, floor((minValue - padding) / step) * step)
            let upper = lower + step * 3
            if lower <= minValue && upper >= maxValue {
                return (lower, upper, step)
            }
            step = nextNiceAxisStep(after: step)
        }

        let padding = max(step * 0.28, 1)
        let lower = max(0, floor((minValue - padding) / step) * step)
        return (lower, lower + step * 3, step)
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

    private func nextNiceAxisStep(after step: Double) -> Double {
        let magnitude = pow(10, floor(log10(max(step, 1))))
        let normalized = step / magnitude

        let nextFactor: Double
        switch normalized {
        case ..<2:
            nextFactor = 2
        case ..<5:
            nextFactor = 5
        default:
            nextFactor = 10
        }

        let candidate = nextFactor * magnitude
        if candidate > step {
            return candidate
        }

        return 10 * magnitude
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
