import SwiftUI

enum AppLayout {
    static let screenTitleTopPadding: CGFloat = 66
    static let screenTitleHeight: CGFloat = 38
    static let sectionTitleHeight: CGFloat = 30
    static let tabBarHeight: CGFloat = 82
    static let legacyTabBarClearance: CGFloat = 106
    static let contentBottomPadding: CGFloat = 24
    static let bottomCTAHeight: CGFloat = 56
    static let floatingChromeFadeHeight: CGFloat = 48

    static func bottomChromePadding(usesNativeTabBar: Bool) -> CGFloat {
        usesNativeTabBar ? contentBottomPadding : legacyTabBarClearance
    }

    static func floatingBottomChromeClearance(usesNativeTabBar: Bool) -> CGFloat {
        bottomCTAHeight + floatingChromeFadeHeight + bottomChromePadding(usesNativeTabBar: usesNativeTabBar)
    }
}

private struct UsesNativeTabBarKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var usesNativeTabBar: Bool {
        get { self[UsesNativeTabBarKey.self] }
        set { self[UsesNativeTabBarKey.self] = newValue }
    }
}

extension View {
    func appBottomChromePadding() -> some View {
        modifier(AppBottomChromePadding())
    }

    func floatingBottomChromeScrollPadding() -> some View {
        modifier(FloatingBottomChromeScrollPadding())
    }

    @ViewBuilder
    func floatingBottomChrome<Chrome: View>(
        isVisible: Bool = true,
        @ViewBuilder chrome: () -> Chrome
    ) -> some View {
        if isVisible {
            ZStack(alignment: .bottom) {
                self
                FloatingBottomChrome(content: chrome)
            }
        } else {
            self
        }
    }
}

private struct FloatingBottomChromeScrollPadding: ViewModifier {
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar

    func body(content: Content) -> some View {
        content.padding(
            .bottom,
            AppLayout.floatingBottomChromeClearance(usesNativeTabBar: usesNativeTabBar)
        )
    }
}

struct FloatingBottomChrome<Content: View>: View {
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [AppColor.base.opacity(0), AppColor.base.opacity(0.88)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: AppLayout.floatingChromeFadeHeight)
            .allowsHitTesting(false)

            HStack {
                Spacer(minLength: 0)
                content
                Spacer(minLength: 0)
            }
            .padding(.bottom, AppLayout.bottomChromePadding(usesNativeTabBar: usesNativeTabBar))
            .background(AppColor.base.opacity(0.88))
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AppBottomChromePadding: ViewModifier {
    @Environment(\.usesNativeTabBar) private var usesNativeTabBar

    func body(content: Content) -> some View {
        content.padding(.bottom, AppLayout.bottomChromePadding(usesNativeTabBar: usesNativeTabBar))
    }
}

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
        AppTab.highlighted(selectedTab: selectedTab, route: route)
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
                        .frame(maxWidth: .infinity, minHeight: 58, maxHeight: 58, alignment: .top)
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, minHeight: 58, maxHeight: 58, alignment: .top)
                    .accessibilityLabel(tab.title)
                    .accessibilityValue(activeTab == tab ? "Selected" : "")
                }
            }
            .padding(.top, 12)
            .frame(maxWidth: 354, alignment: .topLeading)
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

private struct LiquidGlassTabBarBehavior: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}

extension View {
    func liquidGlassTabBarBehavior() -> some View {
        modifier(LiquidGlassTabBarBehavior())
    }
}

@available(iOS 18.0, *)
struct NativeAppTabView<TabContent: View, RouteOverlay: View>: View {
    @Binding var selectedTab: AppTab
    var route: AppRoute?
    var onSelect: (AppTab) -> Void
    @ViewBuilder var tabContent: (AppTab) -> TabContent
    @ViewBuilder var routeOverlay: () -> RouteOverlay

    var body: some View {
        TabView(selection: tabSelection) {
            ForEach(AppTab.allCases) { tab in
                Tab(tab.title, systemImage: tab.icon, value: tab) {
                    ZStack(alignment: .topLeading) {
                        tabContent(tab)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                        routeOverlay()
                            .allowsHitTesting(route != nil)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                    .background(AppColor.base)
                }
            }
        }
        .tint(AppColor.accent)
        .liquidGlassTabBarBehavior()
    }

    private var tabSelection: Binding<AppTab> {
        Binding(
            get: { AppTab.highlighted(selectedTab: selectedTab, route: route) },
            set: { tab in
                Haptics.tap()
                onSelect(tab)
            }
        )
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
            case .stats:
                StatsTabIcon(color: color)
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

private struct StatsTabIcon: View {
    var color: Color

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Path { path in
                path.move(to: CGPoint(x: 7, y: 29))
                path.addLine(to: CGPoint(x: 29, y: 29))
                path.move(to: CGPoint(x: 7, y: 29))
                path.addLine(to: CGPoint(x: 7, y: 7))
            }
            .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

            Path { path in
                path.move(to: CGPoint(x: 10, y: 24))
                path.addLine(to: CGPoint(x: 15, y: 19))
                path.addLine(to: CGPoint(x: 20, y: 21))
                path.addLine(to: CGPoint(x: 28, y: 12))
            }
            .stroke(color, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
        }
        .frame(width: 36, height: 36)
    }
}

struct ScreenTitle: View {
    var title: String
    var minimumScaleFactor: CGFloat = 1

    var body: some View {
        Text(title)
            .font(AppFont.display)
            .lineLimit(1)
            .minimumScaleFactor(minimumScaleFactor)
            .frame(
                maxWidth: .infinity,
                minHeight: AppLayout.screenTitleHeight,
                maxHeight: AppLayout.screenTitleHeight,
                alignment: .leading
            )
    }
}

struct ScreenTitleBar<Accessory: View>: View {
    var title: String
    @ViewBuilder var accessory: () -> Accessory

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(title)
                .font(AppFont.display)
                .lineLimit(1)

            Spacer(minLength: 12)

            accessory()
        }
        .frame(
            maxWidth: .infinity,
            minHeight: AppLayout.screenTitleHeight,
            maxHeight: AppLayout.screenTitleHeight,
            alignment: .leading
        )
    }
}

struct ScreenNavigationTitle: View {
    var title: String
    var backAccessibilityLabel: String
    var minimumScaleFactor: CGFloat = 0.72
    var onBack: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Button {
                Haptics.tap()
                onBack()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(AppColor.primaryText)
                    .frame(width: 36, height: AppLayout.screenTitleHeight)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(backAccessibilityLabel)

            Text(title)
                .font(AppFont.display)
                .lineLimit(1)
                .minimumScaleFactor(minimumScaleFactor)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: AppLayout.screenTitleHeight, alignment: .leading)
    }
}

struct SectionTitle: View {
    var text: String

    var body: some View {
        Text(text)
            .font(AppFont.h1)
            .lineLimit(1)
            .foregroundStyle(AppColor.primaryText)
            .frame(height: AppLayout.sectionTitleHeight, alignment: .leading)
    }
}

struct ScreenSectionRow<Trailing: View>: View {
    var title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            SectionTitle(text: title)

            Spacer(minLength: 12)

            trailing()
        }
        .frame(height: AppLayout.sectionTitleHeight, alignment: .leading)
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

struct SwipeablePlanCard: View {
    var plan: WorkoutPlan
    var onOpen: () -> Void
    var onDelete: () -> Void

    @State private var horizontalOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .trailing) {
            if horizontalOffset < -1 {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(AppColor.destructive.opacity(0.22))
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

            PlanCard(
                title: plan.name,
                lines: ["\(plan.daysPerWeek) days per week", "Created on \(plan.createdAt)"],
                date: nil
            )
            .offset(x: horizontalOffset)
            .contentShape(Rectangle())
            .onTapGesture {
                if horizontalOffset < -1 {
                    withAnimation(.spring(response: 0.2, dampingFraction: 0.88)) {
                        horizontalOffset = 0
                    }
                } else {
                    Haptics.tap(.medium)
                    onOpen()
                }
            }
            .simultaneousGesture(
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

                        Haptics.tap(.medium)
                        onDelete()
                    }
            )
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityLabel("Open \(plan.name)")
        .accessibilityAction(named: "Archive") {
            onDelete()
        }
    }

    private var deleteBackgroundOpacity: Double {
        min(1, max(0, Double(-horizontalOffset / 48)))
    }
}

struct CollapsibleSectionHeader: View {
    var title: String
    var isExpanded: Bool
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                Text(title)
                    .font(AppFont.h1)
                    .lineLimit(1)
                    .foregroundStyle(AppColor.primaryText)

                Spacer(minLength: 12)

                Image(systemName: "chevron.down")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(AppColor.secondaryText)
                    .rotationEffect(.degrees(isExpanded ? 0 : -90))
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
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

            HStack(spacing: 0) {
                RepeatingRoundStepButton(symbol: "minus", accessibilityLabel: "Decrease \(label)") {
                    value = max(minimum, value - 1)
                }

                Spacer(minLength: 0)

                Text("\(value)")
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    .frame(width: 48, height: 45)
                    .accessibilityLabel("\(label) value")

                Spacer(minLength: 0)

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
