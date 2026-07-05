import SwiftUI
import UniformTypeIdentifiers

private let cardWidth: CGFloat = 354
private let cardHeight: CGFloat = 440
private let cardCornerRadius: CGFloat = 12

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var backdropOpacity: Double = 0
    @State private var cardOffsetY: CGFloat = 80
    @State private var cardScale: CGFloat = 0.85
    @State private var cardOpacity: Double = 0
    @State private var rotationY: Double = 360
    @State private var rotationX: Double = 0
    @State private var angularVelocity: Double = 0
    @State private var lastSpinTickIndex = 0
    @State private var dragBaseRotationY: Double = 0
    @State private var isDragging = false
    @State private var lapPhase: Double = 0
    @State private var lapTrailOpacity: Double = 0
    @State private var innerGlowOpacity: Double = 0
    @State private var hasSettled = false
    @State private var isCharged = false
    @State private var spinPhysicsActive = false
    @State private var lastPhysicsTimestamp: TimeInterval = 0
    @State private var haptics = AchievementHaptics()

    private var sheenPhase: CGFloat {
        CGFloat(rotationY.truncatingRemainder(dividingBy: 360) / 360)
    }

    private var showCardBack: Bool {
        let normalized = rotationY.truncatingRemainder(dividingBy: 360)
        let positive = normalized < 0 ? normalized + 360 : normalized
        return positive > 90 && positive < 270
    }

    var body: some View {
        ZStack {
            backdrop

            VStack(spacing: 24) {
                cardStack
                    .offset(y: cardOffsetY)
                    .scaleEffect(cardScale)
                    .opacity(cardOpacity)

                Button("Continue") {
                    dismiss()
                }
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .opacity(hasSettled ? 1 : 0)
            }
            .padding(.horizontal, 24)
        }
        .onAppear(perform: startEntrance)
        .onDisappear {
            haptics.release()
        }
    }

    private var backdrop: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity)
                .ignoresSafeArea()

            if backdropOpacity > 0 {
                RadialGradient(
                    colors: [Color.white.opacity(0.05), Color.clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: 260
                )
                .opacity(backdropOpacity)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }
        }
        .onTapGesture {
            dismiss()
        }
    }

    private var cardStack: some View {
        ZStack {
            Group {
                if showCardBack {
                    AchievementCardBack(achievement: achievement)
                        .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                } else {
                    AchievementCardFront(
                        achievement: achievement,
                        sheenPhase: reduceMotion ? 0.35 : sheenPhase,
                        lapPhase: lapPhase,
                        lapTrailOpacity: lapTrailOpacity,
                        innerGlowOpacity: innerGlowOpacity,
                        rotationY: rotationY,
                        isCharged: isCharged,
                        rendersForShare: false
                    )
                }
            }
            .frame(width: cardWidth, height: cardHeight)
            .rotation3DEffect(.degrees(rotationY), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
            .rotation3DEffect(.degrees(rotationX), axis: (x: 1, y: 0, z: 0), perspective: 0.55)
            .gesture(interactiveGesture)
        }
        .overlay {
            if spinPhysicsActive {
                TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
                    Color.clear
                        .onChange(of: timeline.date) { _, date in
                            stepSpinPhysics(at: date)
                        }
                }
                .allowsHitTesting(false)
            }
        }
    }

    private var interactiveGesture: some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard hasSettled else { return }

                if !isDragging {
                    dragBaseRotationY = rotationY
                    isDragging = true
                }

                rotationX = Double(value.translation.height / 22).clamped(to: -8...8)

                if abs(value.translation.width) > abs(value.translation.height) {
                    rotationY = dragBaseRotationY + Double(value.translation.width / 3.5)
                    angularVelocity = Double(value.velocity.width / 12)
                    checkSpinTickCrossing()
                }
            }
            .onEnded { value in
                guard hasSettled else { return }
                isDragging = false

                withAnimation(.spring(response: 0.45, dampingFraction: 0.72)) {
                    rotationX = 0
                }

                if abs(value.velocity.width) > abs(value.velocity.height) {
                    angularVelocity = Double(value.velocity.width / 10)
                    spinPhysicsActive = true
                    lastPhysicsTimestamp = 0
                    lastSpinTickIndex = Int(floor((rotationY + 45) / 90))
                } else {
                    snapToFaceForward()
                }
            }
    }

    private func startEntrance() {
        haptics.prepare()

        if reduceMotion {
            backdropOpacity = 0.85
            cardOffsetY = 0
            cardScale = 1
            cardOpacity = 1
            rotationY = 0
            innerGlowOpacity = 0.18
            hasSettled = true
            isCharged = true
            haptics.playReduceMotionTap()
            return
        }

        haptics.playEntranceScore()

        withAnimation(.easeOut(duration: 0.3)) {
            backdropOpacity = 0.85
            cardOpacity = 1
        }

        withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
            cardOffsetY = 0
            cardScale = 1
            rotationY = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            handleSettle()
        }
    }

    private func handleSettle() {
        hasSettled = true
        playLapOfLight()
    }

    private func playLapOfLight() {
        withAnimation(.easeInOut(duration: 0.8)) {
            lapPhase = 1
        }

        withAnimation(.easeOut(duration: 0.5).delay(0.3)) {
            lapTrailOpacity = 0.6
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            withAnimation(.easeInOut(duration: 0.35)) {
                innerGlowOpacity = 0.35
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.15)) {
                innerGlowOpacity = 0.18
                lapTrailOpacity = 0
            }
            isCharged = true
        }
    }

    private func stepSpinPhysics(at date: Date) {
        let timestamp = date.timeIntervalSinceReferenceDate
        defer { lastPhysicsTimestamp = timestamp }

        guard lastPhysicsTimestamp > 0 else { return }

        let delta = min(timestamp - lastPhysicsTimestamp, 1.0 / 30.0)
        let frameScale = delta * 60

        rotationY += angularVelocity * delta
        checkSpinTickCrossing()

        let deceleration = 2.5 * frameScale
        if angularVelocity > 0 {
            angularVelocity = max(0, angularVelocity - deceleration)
        } else {
            angularVelocity = min(0, angularVelocity + deceleration)
        }

        if abs(angularVelocity) < 40 {
            spinPhysicsActive = false
            snapToFaceForward()
        }
    }

    private func checkSpinTickCrossing() {
        guard hasSettled else { return }
        let quadrant = Int(floor((rotationY + 45) / 90))
        guard quadrant != lastSpinTickIndex else { return }
        lastSpinTickIndex = quadrant
        haptics.playSpinTick()
    }

    private func snapToFaceForward() {
        let normalized = rotationY.truncatingRemainder(dividingBy: 360)
        let target: Double
        if normalized > 180 || normalized < -180 {
            target = rotationY + (normalized > 0 ? 360 - normalized : -360 - normalized)
        } else {
            target = rotationY - normalized
        }

        withAnimation(.spring(response: 0.5, dampingFraction: 0.78)) {
            rotationY = target
        }
        angularVelocity = 0
    }

    private func dismiss() {
        haptics.release()

        if reduceMotion {
            onDismiss()
            return
        }

        withAnimation(.easeIn(duration: 0.28)) {
            backdropOpacity = 0
            cardOffsetY = 120
            cardScale = 0.88
            cardOpacity = 0
            rotationY += 45
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            onDismiss()
        }
    }
}

// MARK: - Card Front

struct AchievementCardFront: View {
    var achievement: Achievement
    var sheenPhase: CGFloat
    var lapPhase: Double
    var lapTrailOpacity: Double
    var innerGlowOpacity: Double
    var rotationY: Double
    var isCharged: Bool
    var rendersForShare: Bool

    var body: some View {
        ZStack {
            chromeFace
            innerAccentBleed
            cardContent
            chromeBezel
            bezelLapLight
        }
        .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
    }

    private var chromeFace: some View {
        ZStack {
            LinearGradient(
                colors: [AppColor.surface1, AppColor.surface2],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            ChromeSheenBands(phase: sheenPhase)

            LinearGradient(
                colors: [Color.black.opacity(0.08), Color.clear, Color.white.opacity(0.04)],
                startPoint: .bottom,
                endPoint: .top
            )
        }
    }

    private var innerAccentBleed: some View {
        let lightEdge = edgeFacingLight
        return RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
            .stroke(AppColor.accent, lineWidth: 6)
            .blur(radius: 14)
            .opacity(innerGlowOpacity)
            .mask {
                RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: edgeGradientColors(for: lightEdge),
                            startPoint: edgeStartPoint(for: lightEdge),
                            endPoint: edgeEndPoint(for: lightEdge)
                        )
                    )
            }
            .allowsHitTesting(false)
    }

    private var edgeFacingLight: Int {
        let normalized = rotationY.truncatingRemainder(dividingBy: 360)
        let positive = normalized < 0 ? normalized + 360 : normalized
        switch positive {
        case 315...360, 0..<45: return 0 // leading
        case 45..<135: return 1 // top
        case 135..<225: return 2 // trailing
        default: return 3 // bottom
        }
    }

    private func edgeGradientColors(for edge: Int) -> [Color] {
        (0..<4).map { index in
            index == edge ? Color.white : Color.clear
        }
    }

    private func edgeStartPoint(for edge: Int) -> UnitPoint {
        switch edge {
        case 0: return .leading
        case 1: return .top
        case 2: return .trailing
        default: return .bottom
        }
    }

    private func edgeEndPoint(for edge: Int) -> UnitPoint {
        switch edge {
        case 0: return .trailing
        case 1: return .bottom
        case 2: return .leading
        default: return .top
        }
    }

    private var cardContent: some View {
        VStack(spacing: 0) {
            topRow
                .padding(.bottom, 8)

            Spacer(minLength: 8)

            heroSection

            Spacer(minLength: 16)

            bottomRow
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var topRow: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("PERSONAL RECORD")
                .font(AppFont.caption)
                .tracking(2)
                .foregroundStyle(AppColor.secondaryText)

            Spacer()

            Text(achievement.formattedDate)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
        }
    }

    private var heroSection: some View {
        ZStack {
            Image(systemName: "trophy.fill")
                .font(.system(size: 120, weight: .semibold))
                .foregroundStyle(AppColor.accent.opacity(0.08))
                .offset(y: 8)

            VStack(spacing: 6) {
                ChromeWeightText(
                    text: achievement.weightLabel,
                    sheenPhase: sheenPhase
                )

                Text(achievement.exerciseName)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)

                Text("for \(achievement.reps) reps")
                    .font(AppFont.label)
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
    }

    private var bottomRow: some View {
        HStack(alignment: .center) {
            if let username = achievement.usernameCaption {
                Text(username.replacingOccurrences(of: "by ", with: ""))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)
            } else {
                Color.clear.frame(width: 1, height: 1)
            }

            Spacer()

            shareButton
        }
    }

    @ViewBuilder
    private var shareButton: some View {
        if rendersForShare {
            shareButtonLabel
        } else {
            ShareLink(
                item: ShareCardPayload(achievement: achievement),
                preview: SharePreview("Personal Record", image: Image(systemName: "trophy.fill"))
            ) {
                shareButtonLabel
            }
            .buttonStyle(.plain)
        }
    }

    private var shareButtonLabel: some View {
        ZStack {
            Circle()
                .fill(AppColor.surface2)
                .frame(width: 36, height: 36)

            Circle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.35),
                            AppColor.border,
                            Color.white.opacity(0.12)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
                .frame(width: 36, height: 36)

            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(AppColor.secondaryText)
        }
    }

    private var chromeBezel: some View {
        ZStack {
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(Color.black.opacity(0.5), lineWidth: 1)
                .padding(0)

            RoundedRectangle(cornerRadius: cardCornerRadius - 0.5, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.5),
                            AppColor.border,
                            Color.white.opacity(0.15)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
                .padding(0.75)

            RoundedRectangle(cornerRadius: cardCornerRadius - 1.5, style: .continuous)
                .stroke(Color.black.opacity(0.35), lineWidth: 0.5)
                .padding(1.75)
        }
        .allowsHitTesting(false)
    }

    private var bezelLapLight: some View {
        ZStack {
            if lapTrailOpacity > 0 {
                BezelLapSegment(phase: lapPhase - 0.06, trim: 0.08)
                    .opacity(lapTrailOpacity * 0.35)
                BezelLapSegment(phase: lapPhase - 0.03, trim: 0.1)
                    .opacity(lapTrailOpacity * 0.55)
            }

            if lapPhase > 0 && lapPhase < 1 {
                BezelLapSegment(phase: lapPhase, trim: 0.12)
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Card Back

struct AchievementCardBack: View {
    var achievement: Achievement

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    AppColor.surface2,
                    AppColor.surface1,
                    AppColor.surface2.opacity(0.95)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Brushed metal lines
            Canvas { context, size in
                for index in 0..<24 {
                    let y = CGFloat(index) * (size.height / 24)
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y + 2))
                    context.stroke(
                        path,
                        with: .color(Color.white.opacity(index.isMultiple(of: 3) ? 0.025 : 0.012)),
                        lineWidth: 1
                    )
                }
            }
            .allowsHitTesting(false)

            VStack(spacing: 16) {
                Text("SCRATCH")
                    .font(.inter(size: 36, weight: .bold, relativeTo: .largeTitle))
                    .tracking(4)
                    .foregroundStyle(AppColor.tertiaryText)

                Text(achievement.formattedDate)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.tertiaryText.opacity(0.7))
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
                .stroke(AppColor.border.opacity(0.8), lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous))
    }
}

// MARK: - Chrome Components

private struct ChromeSheenBands: View {
    var phase: CGFloat

    var body: some View {
        ZStack {
            sheenBand(width: 0.55, angle: 25, offset: phase * 1.4)
            sheenBand(width: 0.35, angle: -18, offset: phase * 0.9 + 0.2)
            sheenBand(width: 0.28, angle: 42, offset: phase * 1.1 + 0.55)
        }
        .allowsHitTesting(false)
    }

    private func sheenBand(width: CGFloat, angle: Double, offset: CGFloat) -> some View {
        LinearGradient(
            colors: [Color.white.opacity(0.10), Color.clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: cardWidth * width)
        .rotationEffect(.degrees(angle))
        .offset(x: (offset - 0.5) * cardWidth * 1.6, y: (offset - 0.5) * cardHeight * 0.3)
        .blendMode(.screen)
    }
}

private struct ChromeWeightText: View {
    var text: String
    var sheenPhase: CGFloat

    var body: some View {
        ZStack {
            Text(text)
                .font(.inter(size: 110, weight: .bold, relativeTo: .largeTitle))
                .tracking(-3)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.85),
                            AppColor.secondaryText.opacity(0.9),
                            Color.white.opacity(0.55)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: AppColor.accent.opacity(0.65), radius: 8)

            Text(text)
                .font(.inter(size: 110, weight: .bold, relativeTo: .largeTitle))
                .tracking(-3)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.clear, Color.white.opacity(0.45), Color.clear],
                        startPoint: UnitPoint(x: sheenPhase, y: 0),
                        endPoint: UnitPoint(x: sheenPhase + 0.25, y: 1)
                    )
                )
                .mask {
                    Text(text)
                        .font(.inter(size: 110, weight: .bold, relativeTo: .largeTitle))
                        .tracking(-3)
                }
        }
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
}

private struct BezelLapSegment: View {
    var phase: Double
    var trim: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cardCornerRadius, style: .continuous)
            .inset(by: 1)
            .trim(from: max(0, phase - Double(trim)), to: min(1, phase))
            .stroke(
                AppColor.accent,
                style: StrokeStyle(lineWidth: 2.5, lineCap: .round)
            )
            .shadow(color: AppColor.accent.opacity(0.8), radius: 6)
    }
}

// MARK: - Share

struct ShareCardPayload: Transferable {
    let achievement: Achievement

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { payload in
            try await payload.renderPNGData()
        }
    }

    @MainActor
    func renderPNGData() throws -> Data {
        let renderer = ImageRenderer(
            content: AchievementCardFront(
                achievement: achievement,
                sheenPhase: 0.42,
                lapPhase: 1,
                lapTrailOpacity: 0,
                innerGlowOpacity: 0.18,
                rotationY: 0,
                isCharged: true,
                rendersForShare: true
            )
            .frame(width: cardWidth, height: cardHeight)
            .padding(24)
            .background(AppColor.base)
        )
        renderer.scale = 3

        guard let uiImage = renderer.uiImage,
              let data = uiImage.pngData() else {
            throw URLError(.cannotDecodeContentData)
        }

        return data
    }
}

private extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        min(max(self, range.lowerBound), range.upperBound)
    }
}

#if DEBUG
struct AchievementCardPreview: PreviewProvider {
    static var sampleAchievement: Achievement {
        Achievement(
            exerciseName: "Incline Barbell Bench Press",
            weight: 70,
            reps: 10,
            date: Date(timeIntervalSince1970: 1_781_500_800),
            username: "marvin"
        )
    }

    static var previews: some View {
        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardFront(
                achievement: sampleAchievement,
                sheenPhase: 0.35,
                lapPhase: 1,
                lapTrailOpacity: 0,
                innerGlowOpacity: 0.18,
                rotationY: 0,
                isCharged: true,
                rendersForShare: false
            )
            .frame(width: cardWidth, height: cardHeight)
        }
        .previewDisplayName("Card Front — Charged")

        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardBack(achievement: sampleAchievement)
                .frame(width: cardWidth, height: cardHeight)
        }
        .previewDisplayName("Card Back")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Achievement Overlay")
    }
}
#endif
