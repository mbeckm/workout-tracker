import Charts
import SwiftUI

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
                .padding(.bottom, 106)
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
            Text("Stats")
                .font(AppFont.display)
                .padding(.top, 66)

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
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.top, 58)

                TenRMChartCard(points: stats.progression)
                    .padding(.top, 24)

                SectionTitle(text: "History")
                    .padding(.top, 24)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        if stats.progression.isEmpty {
                            EmptyExerciseStatsCard()
                        } else {
                            ForEach(stats.progression.reversed()) { point in
                                ExerciseStatsHistoryCard(point: point)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(.top, 12)
                    .padding(.bottom, 126)
                }
                .scrollDismissesKeyboard(.interactively)

                Spacer(minLength: 96)
            }
            .padding(.horizontal, 24)
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Button {
                Haptics.tap()
                onBack()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(AppColor.primaryText)
                    .frame(width: 36, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back to stats")

            Text(stats.exerciseName)
                .font(AppFont.display)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: 38, alignment: .leading)
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
        CardShell(height: 236) {
            if points.isEmpty {
                Text("No logged sets yet")
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.secondaryText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Estimated 10RM")
                            .font(AppFont.h2)
                            .foregroundStyle(AppColor.primaryText)
                            .lineLimit(1)

                        Spacer(minLength: 12)

                        Text("kg")
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                            .lineLimit(1)
                    }

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
                            .symbolSize(24)
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
                    .frame(maxWidth: .infinity, minHeight: 140, maxHeight: 140)

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
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("d MMM")
        return formatter.string(from: date)
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

private struct ExerciseStatsHistoryCard: View {
    var point: ExerciseStatsPoint

    var body: some View {
        CardShell(height: 80) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(dateText)
                        .font(AppFont.h2)
                        .lineLimit(1)

                    Text("Average 10RM")
                        .font(AppFont.label)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(1)
                }

                Spacer(minLength: 12)

                Text("\(formattedTenRM) kg")
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var formattedTenRM: String {
        if point.averageTenRM >= 100 {
            return String(format: "%.0f", point.averageTenRM)
        }

        return String(format: "%.1f", point.averageTenRM)
    }

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd.MM.yy"
        return formatter.string(from: point.date)
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
