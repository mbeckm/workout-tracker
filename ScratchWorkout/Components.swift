import SwiftUI

struct GrainBackground: View {
    var body: some View {
        ZStack {
            AppColor.base
            Canvas { context, size in
                for index in 0..<1800 {
                    let x = pseudoRandom(index, salt: 17) * size.width
                    let y = pseudoRandom(index, salt: 41) * size.height
                    let alpha = 0.015 + pseudoRandom(index, salt: 83) * 0.035
                    let rect = CGRect(x: x, y: y, width: 0.7, height: 0.7)
                    context.fill(Path(rect), with: .color(.white.opacity(alpha)))
                }
            }
            .blendMode(.screen)
        }
    }

    private func pseudoRandom(_ value: Int, salt: Int) -> CGFloat {
        let seed = Double((value * 1103515245 + salt * 12345) & 0x7fffffff)
        return CGFloat(seed.truncatingRemainder(dividingBy: 10_000) / 10_000)
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

            Rectangle()
                .fill(AppColor.statusStrip)
                .frame(height: 46)
                .ignoresSafeArea(edges: .top)

            content
        }
        .foregroundStyle(AppColor.primaryText)
    }
}

struct AppTabBar: View {
    @Binding var selectedTab: AppTab
    var route: AppRoute?
    var onSelect: (AppTab) -> Void

    private var activeTab: AppTab {
        switch route {
        case .createPlan:
            .plans
        case .logWorkout, .workoutComplete:
            .workout
        case .startWorkout:
            .home
        case nil:
            selectedTab
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(AppColor.border)
                .frame(height: 1)

            HStack(alignment: .top, spacing: 95) {
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
                        }
                        .foregroundStyle(activeTab == tab ? AppColor.accent : AppColor.secondaryText)
                        .frame(height: 58)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tab.title)
                    .accessibilityValue(activeTab == tab ? "Selected" : "")
                }
            }
            .padding(.top, 12)
            .frame(maxWidth: .infinity)
        }
        .frame(height: 82)
        .background(AppColor.surface1)
        .ignoresSafeArea(edges: .bottom)
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
                RoundStepButton(symbol: "minus", accessibilityLabel: "Decrease \(label)") {
                    value = max(minimum, value - 1)
                }

                Text("\(value)")
                    .font(AppFont.display)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .contentTransition(.numericText())
                    .frame(width: 42)

                RoundStepButton(symbol: "plus", accessibilityLabel: "Increase \(label)") {
                    value = min(maximum, value + 1)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}
