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

    static func logWorkoutChromeClearance(usesNativeTabBar: Bool) -> CGFloat {
        196 + floatingBottomChromeClearance(usesNativeTabBar: usesNativeTabBar)
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
        ZStack {
            AppColor.base

            Canvas { context, size in
                let spacing: CGFloat = 3
                let columns = Int(size.width / spacing) + 1
                let rows = Int(size.height / spacing) + 1

                for row in 0..<rows {
                    for column in 0..<columns {
                        let seed = UInt64(row &* 7_919 &+ column &* 104_729)
                        let value = (seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407) >> 56
                        guard value > 205 else { continue }

                        let opacity = Double(value - 205) / 50 * 0.055
                        let rect = CGRect(
                            x: CGFloat(column) * spacing,
                            y: CGFloat(row) * spacing,
                            width: 1,
                            height: 1
                        )
                        context.fill(Path(rect), with: .color(.white.opacity(opacity)))
                    }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
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
                .frame(
                    maxWidth: .infinity,
                    minHeight: AppLayout.screenTitleHeight,
                    alignment: .leading
                )

            accessory()
        }
        .frame(
            maxWidth: .infinity,
            minHeight: 44,
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
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(AppPressFeedbackStyle())
            .accessibilityLabel(backAccessibilityLabel)

            Text(title)
                .font(AppFont.display)
                .lineLimit(1)
                .minimumScaleFactor(minimumScaleFactor)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 44, alignment: .leading)
    }
}

struct SectionTitle: View {
    var text: String

    var body: some View {
        Text(text)
            .font(AppFont.h1)
            .lineLimit(1)
            .foregroundStyle(AppColor.primaryText)
            .frame(minHeight: AppLayout.sectionTitleHeight, alignment: .leading)
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
        .frame(minHeight: AppLayout.sectionTitleHeight, alignment: .leading)
    }
}

struct MetricLabel: View {
    var value: String
    var label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(AppFont.display)
                .monospacedDigit()
                .lineLimit(1)

            Text(label)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
        }
        .accessibilityElement(children: .combine)
    }
}

struct SuccessBadge: View {
    var text: String

    var body: some View {
        Text(text)
            .font(AppFont.label)
            .foregroundStyle(AppColor.base)
            .padding(.horizontal, 10)
            .frame(minHeight: 30)
            .background(AppColor.accent, in: Capsule())
    }
}

struct SuccessMetric: Identifiable {
    let id: String
    var value: String
    var label: String

    init(value: String, label: String) {
        id = label
        self.value = value
        self.label = label
    }
}

struct SuccessMetricStrip: View {
    var metrics: [SuccessMetric]

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(metrics) { metric in
                VStack(spacing: 4) {
                    Text(metric.value)
                        .font(AppFont.h1)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    Text(metric.label)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.secondaryText)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

struct SuccessSecondaryButton: View {
    var title: String
    var width: CGFloat = 312
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(AppFont.h1)
                .foregroundStyle(AppColor.primaryText)
                .lineLimit(1)
                .frame(
                    minWidth: width,
                    maxWidth: width,
                    minHeight: AppLayout.bottomCTAHeight
                )
                .background(AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(AppColor.surfaceOutline, lineWidth: 1)
                }
        }
        .buttonStyle(AppPressFeedbackStyle())
        .accessibilityLabel(title)
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
            .frame(maxWidth: .infinity, minHeight: height, alignment: .center)
            .background(fill, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(AppColor.surfaceOutline, lineWidth: 1)
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
                        .lineLimit(2)

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
    @State private var cardWidth: CGFloat = 0
    @State private var isCommittingArchive = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
            .background {
                GeometryReader { proxy in
                    Color.clear
                        .onAppear {
                            cardWidth = proxy.size.width
                        }
                        .onChange(of: proxy.size.width) { _, newWidth in
                            cardWidth = newWidth
                        }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if horizontalOffset < -1 {
                    withAnimation(AppMotion.settle) {
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
                        guard !isCommittingArchive else {
                            return
                        }

                        guard abs(value.translation.width) > abs(value.translation.height) else {
                            return
                        }

                        let horizontal = value.translation.width
                        horizontalOffset = horizontal > 0
                            ? appRubberBanded(horizontal, dimension: max(cardWidth, 1))
                            : horizontal
                    }
                    .onEnded { value in
                        guard !isCommittingArchive else {
                            return
                        }

                        let shouldArchive = value.translation.width < -90
                            || value.predictedEndTranslation.width < -160

                        guard shouldArchive else {
                            withAnimation(AppMotion.settle) {
                                horizontalOffset = 0
                            }
                            return
                        }

                        commitArchive()
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

    private func commitArchive() {
        guard !isCommittingArchive else {
            return
        }

        Haptics.tap(.medium)

        guard !reduceMotion else {
            onDelete()
            return
        }

        isCommittingArchive = true

        withAnimation(AppMotion.archiveExit, completionCriteria: .logicallyComplete) {
            horizontalOffset = -(max(cardWidth, 320) + 40)
        } completion: {
            onDelete()
        }
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
                    .animation(.snappy(duration: 0.2, extraBounce: 0), value: isExpanded)
            }
        }
        .buttonStyle(AppPressFeedbackStyle())
        .accessibilityLabel(title)
        .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
    }
}

struct ExerciseCard: View {
    var exercise: ExercisePrescription
    var showsChevron: Bool = true

    var body: some View {
        CardShell(height: 112) {
            HStack(alignment: .center, spacing: 12) {
                ExerciseArtwork(exercise: exercise)
                    .frame(width: 80, height: 80)

                VStack(alignment: .leading, spacing: 6) {
                    Text(exercise.name)
                        .font(AppFont.body)
                        .lineLimit(2)

                    Text(exercise.equipmentLabel)
                        .font(AppFont.label)

                    HStack(spacing: 4) {
                        Circle()
                            .fill(AppColor.accent)
                            .frame(width: 6, height: 6)
                        Text(exercise.muscleLabel)
                    }
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(exercise.sets) sets")
                    Text(exercise.prescriptionSummary)
                }
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .lineLimit(1)

                if showsChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(AppColor.secondaryText)
                        .frame(width: 24, height: 36)
                }
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
                .contentTransition(.opacity)
                .frame(minWidth: width, maxWidth: width, minHeight: 56)
                .background(AppColor.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(AppPressFeedbackStyle())
        .accessibilityLabel(title)
    }
}

struct AppPressFeedbackStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var isStatic = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion || isStatic ? 1 : (configuration.isPressed ? 0.96 : 1))
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(
                .easeOut(duration: configuration.isPressed ? 0.1 : 0.14),
                value: configuration.isPressed
            )
    }
}

struct ContextualSymbol: View {
    var activeSymbol: String
    var inactiveSymbol: String
    var isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            symbol(activeSymbol, isVisible: isActive)
            symbol(inactiveSymbol, isVisible: !isActive)
        }
        .animation(
            reduceMotion ? nil : .timingCurve(0.2, 0, 0, 1, duration: 0.3),
            value: isActive
        )
        .accessibilityHidden(true)
    }

    private func symbol(_ name: String, isVisible: Bool) -> some View {
        Image(systemName: name)
            .scaleEffect(isVisible || reduceMotion ? 1 : 0.25)
            .opacity(isVisible ? 1 : 0)
            .blur(radius: isVisible || reduceMotion ? 0 : 4)
    }
}

struct StepProgress: View {
    var count: Int
    var isSegmentComplete: (Int) -> Bool
    var currentIndex: Int
    var width: CGFloat
    var spacing: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: spacing) {
            ForEach(0..<count, id: \.self) { index in
                progressBar(at: index)
            }
        }
        .animation(AppMotion.stateChange(reduceMotion: reduceMotion), value: progressAnimationToken)
    }

    private var progressAnimationToken: String {
        (0..<count).map { index in
            "\(index)-\(isSegmentComplete(index))-\(index == currentIndex)"
        }.joined(separator: "|")
    }

    @ViewBuilder
    private func progressBar(at index: Int) -> some View {
        let isComplete = isSegmentComplete(index)
        let isCurrent = index == currentIndex && !isComplete

        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .fill(isComplete ? AppColor.accent : AppColor.border)
            .frame(width: width, height: 24)
            .overlay {
                if isCurrent {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(AppColor.accent.opacity(0.85), lineWidth: 2)
                        .shadow(color: AppColor.accent.opacity(0.42), radius: 10, x: 0, y: 0)
                }
            }
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
        .buttonStyle(AppPressFeedbackStyle())
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
                    .monospacedDigit()
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
                        .stroke(AppColor.surfaceOutline, lineWidth: 1)
                )
        }
        .buttonStyle(AppPressFeedbackStyle())
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
