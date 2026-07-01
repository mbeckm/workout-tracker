import SwiftUI

struct GrainBackground: View {
    var body: some View {
        AppColor.base
    }
}

struct AppScreen<Content: View>: View {
    var content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            GrainBackground()
                .ignoresSafeArea()

            content
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(AppColor.primaryText)
    }
}

struct AppTabBar: View {
    @Binding var selectedTab: AppTab
    var route: AppRoute?
    var onSelect: (AppTab) -> Void

    private var activeTab: AppTab {
        switch route {
        case .createPlan, .activePlanDetail, .planDetail:
            .plans
        case .logWorkout, .workoutComplete:
            .workout
        case .startWorkout, .nextWorkoutPreview:
            .home
        case nil:
            selectedTab
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 0) {
                ForEach(AppTab.allCases) { tab in
                    Button {
                        Haptics.tap()
                        onSelect(tab)
                    } label: {
                        VStack(spacing: 4) {
                            TabIcon(tab: tab, color: activeTab == tab ? AppColor.accent : AppColor.secondaryText)
                                .frame(width: 36, height: 36)

                            Text(tab.title)
                                .font(AppFont.caption)
                                .lineLimit(1)
                                .frame(height: 16)
                        }
                        .foregroundStyle(activeTab == tab ? AppColor.accent : AppColor.secondaryText)
                        .frame(width: AppTab.slotWidth, height: 58, alignment: .top)
                    }
                    .buttonStyle(.plain)
                    .frame(width: AppTab.slotWidth, height: 58, alignment: .top)
                    .accessibilityLabel(tab.title)
                    .accessibilityValue(activeTab == tab ? "Selected" : "")

                    if tab != .workout {
                        Spacer(minLength: 0)
                            .frame(width: AppTab.slotSpacing)
                    }
                }
            }
            .padding(.top, 12)
            .frame(width: 310, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, minHeight: 82, maxHeight: 82, alignment: .top)
        .background(AppColor.surface1)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(AppColor.border)
                .frame(height: 1)
        }
        .transaction { transaction in
            transaction.animation = nil
        }
    }
}

private extension AppTab {
    static var slotWidth: CGFloat {
        72
    }

    static var slotSpacing: CGFloat {
        47
    }
}

private struct TabIcon: View {
    var tab: AppTab
    var color: Color

    var body: some View {
        ZStack {
            switch tab {
            case .home:
                HomeTabIcon(color: color)
            case .plans:
                PlansTabIcon(color: color)
            case .workout:
                WorkoutTabIcon(color: color)
            }
        }
        .frame(width: 36, height: 36)
    }
}

private struct HomeTabIcon: View {
    var color: Color

    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 7, y: 16))
            path.addLine(to: CGPoint(x: 18, y: 7))
            path.addLine(to: CGPoint(x: 29, y: 16))
            path.addLine(to: CGPoint(x: 29, y: 30))
            path.addLine(to: CGPoint(x: 22, y: 30))
            path.addLine(to: CGPoint(x: 22, y: 20))
            path.addLine(to: CGPoint(x: 14, y: 20))
            path.addLine(to: CGPoint(x: 14, y: 30))
            path.addLine(to: CGPoint(x: 7, y: 30))
            path.closeSubpath()
        }
        .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
    }
}

private struct PlansTabIcon: View {
    var color: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .stroke(color, lineWidth: 2)
                .frame(width: 22, height: 27)

            Path { path in
                path.move(to: CGPoint(x: 7, y: 27))
                path.addLine(to: CGPoint(x: 29, y: 27))
            }
            .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
        .frame(width: 36, height: 36)
    }
}

private struct WorkoutTabIcon: View {
    var color: Color

    var body: some View {
        ZStack {
            Capsule()
                .fill(color)
                .frame(width: 23, height: 4)
                .rotationEffect(.degrees(45))

            dumbbellPlate
                .offset(x: -9, y: -9)
            dumbbellPlate
                .offset(x: -13, y: -5)
            dumbbellPlate
                .offset(x: 9, y: 9)
            dumbbellPlate
                .offset(x: 13, y: 5)
        }
        .frame(width: 36, height: 36)
    }

    private var dumbbellPlate: some View {
        RoundedRectangle(cornerRadius: 1.2, style: .continuous)
            .fill(color)
            .frame(width: 4, height: 13)
            .rotationEffect(.degrees(45))
    }
}

struct SectionTitle: View {
    var text: String

    var body: some View {
        Text(text)
            .font(AppFont.h1)
            .lineLimit(1)
            .foregroundStyle(AppColor.primaryText)
    }
}

struct MetricLabel: View {
    var value: String
    var label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(AppFont.display)
                .lineLimit(1)

            Text(label)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
        }
        .accessibilityElement(children: .combine)
    }
}

struct CardShell<Content: View>: View {
    var height: CGFloat?
    var cornerRadius: CGFloat = 12
    var fill: Color = AppColor.surface1
    var content: Content

    init(height: CGFloat? = nil, cornerRadius: CGFloat = 12, fill: Color = AppColor.surface1, @ViewBuilder content: () -> Content) {
        self.height = height
        self.cornerRadius = cornerRadius
        self.fill = fill
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: height, maxHeight: height, alignment: .center)
            .background(fill, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(AppColor.border, lineWidth: 1)
            )
    }
}

struct PlanCard: View {
    var title: String
    var lines: [String]
    var date: String?
    var height: CGFloat = 102

    var body: some View {
        CardShell(height: height) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(AppFont.h2)
                        .lineLimit(1)

                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(lines, id: \.self) { line in
                            Text(line)
                                .font(AppFont.label)
                                .foregroundStyle(AppColor.secondaryText)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer(minLength: 12)

                VStack(alignment: .trailing, spacing: 14) {
                    if let date {
                        Text(date)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.secondaryText)
                            .lineLimit(1)
                    }

                    Image(systemName: "chevron.right")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: 36, height: 36)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct ExerciseCard: View {
    var exercise: ExercisePrescription

    var body: some View {
        CardShell(height: 84) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(exercise.name)
                        .font(AppFont.h2)
                        .lineLimit(1)

                    HStack(spacing: 25) {
                        Text("\(exercise.sets) Sets")
                        Text("\(exercise.reps) Reps")
                    }
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
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

struct CTAButton: View {
    var title: String
    var width: CGFloat = 312
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap(.medium)
            action()
        } label: {
            Text(title)
                .font(AppFont.h1)
                .foregroundStyle(AppColor.base)
                .lineLimit(1)
                .frame(width: width, height: 56)
                .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct StepProgress: View {
    var count: Int
    var active: Int
    var width: CGFloat
    var spacing: CGFloat

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(index < active ? AppColor.accent : AppColor.border)
                    .frame(width: width, height: 24)
            }
        }
        .animation(.spring(response: 0.38, dampingFraction: 0.78), value: active)
    }
}

struct RoundStepButton: View {
    var symbol: String
    var fill: Color = AppColor.surface2
    var accessibilityLabel: String?
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 45, height: 45)
                .background(fill, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel ?? defaultAccessibilityLabel)
    }

    private var defaultAccessibilityLabel: String {
        switch symbol {
        case "minus":
            "Decrease"
        case "plus":
            "Increase"
        default:
            symbol
        }
    }
}

struct NumberStepper: View {
    var label: String
    @Binding var value: Int
    var minimum: Int = 1
    var maximum: Int = 999

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)

            HStack(spacing: 16) {
                RepeatingRoundStepButton(symbol: "minus", accessibilityLabel: "Decrease \(label)") {
                    value = max(minimum, value - 1)
                }

                Text("\(value)")
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .contentTransition(.numericText())
                    .frame(width: 42, height: 45)
                    .accessibilityLabel("\(label) value")

                RepeatingRoundStepButton(symbol: "plus", accessibilityLabel: "Increase \(label)") {
                    value = min(maximum, value + 1)
                }
            }
            .frame(width: 164, alignment: .center)
            .animation(.spring(response: 0.22, dampingFraction: 0.88), value: value)
        }
        .frame(width: 164, alignment: .leading)
        .accessibilityElement(children: .contain)
    }
}

private struct RepeatingRoundStepButton: View {
    var symbol: String
    var accessibilityLabel: String
    var action: () -> Void

    @State private var isPressing = false
    @State private var repeatTask: Task<Void, Never>?

    var body: some View {
        Button {
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 45, height: 45)
                .background(AppColor.surface2, in: Circle())
                .overlay(
                    Circle()
                        .stroke(AppColor.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .onChanged { _ in
                    startRepeating()
                }
                .onEnded { _ in
                    stopRepeating()
                }
        )
        .onDisappear(perform: stopRepeating)
    }

    private func startRepeating() {
        guard !isPressing else {
            return
        }

        isPressing = true
        repeatTask?.cancel()
        repeatTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            var delay: UInt64 = 125_000_000

            while !Task.isCancelled {
                await MainActor.run {
                    action()
                }

                try? await Task.sleep(nanoseconds: delay)
                delay = max(38_000_000, UInt64(Double(delay) * 0.84))
            }
        }
    }

    private func stopRepeating() {
        isPressing = false
        repeatTask?.cancel()
        repeatTask = nil
    }
}
