import SwiftUI
import UniformTypeIdentifiers

private let cardWidth: CGFloat = 354
private let cardHeight: CGFloat = 480
private let medallionSize: CGFloat = 96
private let medallionOverlap: CGFloat = 48

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var backdropOpacity: Double = 0
    @State private var cardOffsetY: CGFloat = -520
    @State private var cardScale: CGFloat = 1
    @State private var cardOpacity: Double = 1
    @State private var shakeOffsetY: CGFloat = 0
    @State private var glowOpacity: Double = 0
    @State private var glowBreathingOffset: Double = 0
    @State private var shockwaveProgress: Double = 0
    @State private var moltenFillProgress: Double = 0
    @State private var showNumeralFlash = false
    @State private var showEmbers = false
    @State private var dragTiltX: Double = 0
    @State private var dragTiltY: Double = 0
    @State private var highlightPoint: CGPoint = CGPoint(x: 120, y: 140)
    @State private var hasLanded = false
    @State private var haptics = AchievementHaptics()

    var body: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            VStack(spacing: 24) {
                cardStack
                    .offset(y: cardOffsetY + shakeOffsetY)
                    .scaleEffect(cardScale)
                    .opacity(cardOpacity)

                Button("Continue") {
                    dismiss()
                }
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .opacity(hasLanded ? 1 : 0)
            }
            .padding(.horizontal, 24)
        }
        .onAppear(perform: startEntrance)
        .onDisappear {
            haptics.stop()
        }
    }

    private var cardStack: some View {
        ZStack(alignment: .top) {
            ZStack {
                AchievementCardContent(
                    achievement: achievement,
                    moltenFillProgress: moltenFillProgress,
                    showSettledGlow: hasLanded && moltenFillProgress >= 1,
                    showNumeralFlash: showNumeralFlash,
                    glowOpacity: settledGlowOpacity,
                    highlightPoint: highlightPoint,
                    showInteractiveHighlight: hasLanded,
                    showIgnitionEffects: hasLanded && !reduceMotion,
                    shockwaveProgress: shockwaveProgress,
                    rendersForShare: false
                )

                if showEmbers {
                    EmberParticlesView(progress: moltenFillProgress)
                        .frame(width: cardWidth, height: cardHeight)
                        .allowsHitTesting(false)
                }
            }
            .frame(width: cardWidth, height: cardHeight)
            .rotation3DEffect(.degrees(dragTiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .rotation3DEffect(.degrees(dragTiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .gesture(dragGesture)

            MachinedMedallion()
                .frame(width: medallionSize, height: medallionSize)
                .offset(y: -medallionOverlap)
                .rotation3DEffect(.degrees(dragTiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
                .rotation3DEffect(.degrees(dragTiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
        }
        .frame(width: cardWidth, height: cardHeight + medallionOverlap)
    }

    private var settledGlowOpacity: Double {
        guard hasLanded else { return 0 }
        if reduceMotion { return 0.22 }
        return min(1, glowOpacity + glowBreathingOffset)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard hasLanded else { return }

                highlightPoint = CGPoint(
                    x: min(max(value.location.x, 0), cardWidth),
                    y: min(max(value.location.y, 0), cardHeight)
                )
                dragTiltX = Double(value.translation.height / 18).clamped(to: -10...10)
                dragTiltY = Double(-value.translation.width / 18).clamped(to: -10...10)
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.45, dampingFraction: 0.72)) {
                    dragTiltX = 0
                    dragTiltY = 0
                    highlightPoint = CGPoint(x: 120, y: 140)
                }
            }
    }

    private func startEntrance() {
        haptics.prepare()

        if reduceMotion {
            backdropOpacity = 0.85
            cardOffsetY = 0
            hasLanded = true
            moltenFillProgress = 1
            glowOpacity = 0.22
            haptics.playReduceMotionTap()
            return
        }

        haptics.playAnticipation()

        withAnimation(.easeOut(duration: 0.25)) {
            backdropOpacity = 0.85
        }

        withAnimation(.spring(response: 0.52, dampingFraction: 0.62)) {
            cardOffsetY = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.48) {
            handleLanding()
        }
    }

    private func handleLanding() {
        hasLanded = true
        showEmbers = true

        haptics.playImpactScore {
            // Fill completion haptic handled inside score for fallback path.
        }

        withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = 3 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.07) {
            withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = -2 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = 1 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.21) {
            withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = 0 }
        }

        igniteMetal()

        withAnimation(.easeOut(duration: 0.7)) {
            moltenFillProgress = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            withAnimation(.easeOut(duration: 0.1)) {
                showNumeralFlash = true
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                showNumeralFlash = false
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            showEmbers = false
        }
    }

    private func igniteMetal() {
        withAnimation(.easeOut(duration: 0.12)) {
            glowOpacity = 0.85
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.easeOut(duration: 0.25)) {
                glowOpacity = 0.22
            }
            startGlowBreathing()
        }

        shockwaveProgress = 0
        withAnimation(.easeOut(duration: 0.5)) {
            shockwaveProgress = 1
        }
    }

    private func startGlowBreathing() {
        guard !reduceMotion else { return }

        for cycle in 0..<3 {
            let delay = Double(cycle) * 2.0
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                withAnimation(.easeInOut(duration: 1.0)) {
                    glowBreathingOffset = 0.06
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    withAnimation(.easeInOut(duration: 1.0)) {
                        glowBreathingOffset = 0
                    }
                }
            }
        }
    }

    private func dismiss() {
        haptics.stop()

        if reduceMotion {
            onDismiss()
            return
        }

        withAnimation(.easeIn(duration: 0.22)) {
            backdropOpacity = 0
            cardScale = 0.92
            cardOpacity = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            onDismiss()
        }
    }
}

// MARK: - Card Content

struct AchievementCardContent: View {
    var achievement: Achievement
    var moltenFillProgress: Double = 1
    var showSettledGlow = true
    var showNumeralFlash = false
    var glowOpacity: Double = 0.22
    var highlightPoint: CGPoint = CGPoint(x: 120, y: 140)
    var showInteractiveHighlight = false
    var showIgnitionEffects = false
    var shockwaveProgress: Double = 1
    var rendersForShare = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: medallionOverlap + 8)

            Text("ACHIEVEMENT UNLOCKED")
                .font(AppFont.caption)
                .tracking(2)
                .foregroundStyle(AppColor.secondaryText)
                .textCase(.uppercase)
                .padding(.bottom, 12)

            MoltenWeightView(
                weight: achievement.weight,
                fillProgress: moltenFillProgress,
                showFlash: showNumeralFlash,
                showSettledGlow: showSettledGlow
            )
            .padding(.bottom, 8)

            Text(achievement.exerciseName.uppercased())
                .font(AppFont.subheading)
                .tracking(1)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 16)

            metadataRow
                .padding(.bottom, 20)

            engravedGroove
                .padding(.bottom, 0)

            shareBar
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 0)
        .frame(width: cardWidth, height: cardHeight)
        .background { metalSlabBackground }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay { bevelOverlay }
        .overlay { ignitionGlowOverlay }
        .overlay { shockwaveOverlay }
    }

    private var metadataRow: some View {
        HStack(spacing: 12) {
            Text("×\(achievement.reps) REPS")
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)

            metadataDivider

            Text(achievement.formattedDate)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)

            if let usernameCaption = achievement.usernameCaption {
                metadataDivider

                Text(usernameCaption.replacingOccurrences(of: "by ", with: ""))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.secondaryText)
            }
        }
    }

    private var metadataDivider: some View {
        Rectangle()
            .fill(AppColor.border)
            .frame(width: 1, height: 12)
    }

    private var engravedGroove: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Color.black.opacity(0.5))
                .frame(height: 1)
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var shareBar: some View {
        if rendersForShare {
            shareBarLabel
        } else {
            ShareLink(
                item: ShareCardPayload(achievement: achievement),
                preview: SharePreview("Achievement Unlocked", image: Image(systemName: "medal.fill"))
            ) {
                shareBarLabel
            }
            .buttonStyle(.plain)
        }
    }

    private var shareBarLabel: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 16, weight: .medium))
            Text("Share")
                .font(AppFont.subheading)
        }
        .foregroundStyle(AppColor.secondaryText)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
    }

    private var metalSlabBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    AppColor.surface2,
                    AppColor.surface1,
                    AppColor.base.opacity(0.95)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            BrushedMetalTexture()

            RadialGradient(
                colors: [
                    Color.white.opacity(0.07),
                    Color.clear
                ],
                center: .topLeading,
                startRadius: 0,
                endRadius: 180
            )

            if showInteractiveHighlight {
                RadialGradient(
                    colors: [
                        Color.white.opacity(0.1),
                        Color.clear
                    ],
                    center: UnitPoint(
                        x: highlightPoint.x / cardWidth,
                        y: highlightPoint.y / cardHeight
                    ),
                    startRadius: 0,
                    endRadius: 120
                )
                .blendMode(.screen)
            }
        }
    }

    private var bevelOverlay: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.45),
                            AppColor.border,
                            Color.black.opacity(0.6)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )

            VStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
                    .padding(1.5)
                Spacer()
            }

            VStack(spacing: 0) {
                Spacer()
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                    .stroke(Color.black.opacity(0.4), lineWidth: 1)
                    .padding(1.5)
            }
        }
    }

    @ViewBuilder
    private var ignitionGlowOverlay: some View {
        if showIgnitionEffects || (rendersForShare && showSettledGlow) {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(AppColor.accent, lineWidth: 16)
                .blur(radius: 18)
                .opacity(glowOpacity)
                .mask {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white)
                }
        }
    }

    @ViewBuilder
    private var shockwaveOverlay: some View {
        if showIgnitionEffects && shockwaveProgress < 1 {
            let maxRadius = max(cardWidth, cardHeight) * 0.75
            let inner = maxRadius * (1 - shockwaveProgress)
            let outer = inner + 40

            RadialGradient(
                colors: [
                    Color.clear,
                    AppColor.accent.opacity(0.25),
                    Color.clear
                ],
                center: .center,
                startRadius: inner,
                endRadius: outer
            )
            .opacity(1 - shockwaveProgress)
            .mask {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white)
            }
        }
    }
}

// MARK: - Metal Components

private struct BrushedMetalTexture: View {
    private let streakOffsets: [CGFloat] = [0.08, 0.15, 0.24, 0.33, 0.47, 0.58, 0.71, 0.86]
    private let streakOpacities: [Double] = [0.03, 0.05, 0.02, 0.04, 0.03, 0.05, 0.02, 0.04]
    private let streakHeights: [CGFloat] = [0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1]

    var body: some View {
        GeometryReader { geometry in
            ForEach(0..<streakOffsets.count, id: \.self) { index in
                Rectangle()
                    .fill(Color.white.opacity(streakOpacities[index]))
                    .frame(height: streakHeights[index])
                    .offset(y: geometry.size.height * streakOffsets[index])
            }
        }
    }
}

private struct MachinedMedallion: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            AppColor.surface2,
                            AppColor.surface1,
                            AppColor.base.opacity(0.95)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            ForEach([88.0, 72.0, 56.0, 40.0], id: \.self) { diameter in
                Circle()
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    .frame(width: diameter, height: diameter)
            }

            ForEach(0..<4, id: \.self) { index in
                let angle = Double(index) * .pi / 2
                Circle()
                    .fill(AppColor.base.opacity(0.8))
                    .overlay {
                        Circle()
                            .stroke(Color.black.opacity(0.5), lineWidth: 0.5)
                    }
                    .frame(width: 8, height: 8)
                    .offset(
                        x: cos(angle) * 34,
                        y: sin(angle) * 34
                    )
            }

            DebossedText(
                text: "PR",
                font: AppFont.h2,
                baseColor: AppColor.tertiaryText,
                highlightOpacity: 0.15
            )

            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.4),
                            AppColor.border,
                            Color.black.opacity(0.55)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.5
                )
        }
        .shadow(color: Color.black.opacity(0.45), radius: 8, y: 4)
    }
}

private struct MoltenWeightView: View {
    var weight: Int
    var fillProgress: Double
    var showFlash: Bool
    var showSettledGlow: Bool

    private var weightText: String { "\(weight)KG" }
    private var weightFont: Font {
        .inter(size: 96, weight: .bold, relativeTo: .largeTitle)
    }

    var body: some View {
        ZStack {
            DebossedText(
                text: weightText,
                font: weightFont,
                baseColor: AppColor.tertiaryText,
                highlightOpacity: 0.12,
                tracking: -2.88
            )

            Text(weightText)
                .font(weightFont)
                .tracking(-2.88)
                .foregroundStyle(AppColor.accent)
                .mask(alignment: .bottom) {
                    Rectangle()
                        .frame(height: 110 * fillProgress)
                }
                .shadow(color: showSettledGlow ? AppColor.accent.opacity(0.35) : .clear, radius: 12)

            if fillProgress > 0.02 && fillProgress < 1 {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.6),
                                AppColor.accent
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: 200, height: 2)
                    .blur(radius: 3)
                    .offset(y: 55 - 110 * fillProgress)
            }

            if showFlash {
                Text(weightText)
                    .font(weightFont)
                    .tracking(-2.88)
                    .foregroundStyle(Color.white.opacity(0.35))
            }
        }
        .frame(height: 110)
    }
}

private struct DebossedText: View {
    var text: String
    var font: Font
    var baseColor: Color
    var highlightOpacity: Double
    var tracking: CGFloat = 0

    var body: some View {
        ZStack {
            Text(text)
                .font(font)
                .tracking(tracking)
                .foregroundStyle(Color.black.opacity(0.5))
                .offset(y: -1)

            Text(text)
                .font(font)
                .tracking(tracking)
                .foregroundStyle(Color.white.opacity(highlightOpacity))
                .offset(y: 1)

            Text(text)
                .font(font)
                .tracking(tracking)
                .foregroundStyle(baseColor)
        }
    }
}

private struct EmberParticlesView: View {
    var progress: Double

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            Canvas { context, size in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate
                guard elapsed < 1.5 else { return }

                let weightBottomY = size.height * 0.38

                for index in 0..<8 {
                    let seed = Double(index)
                    let birthOffset = seed * 0.08
                    let localTime = elapsed - birthOffset
                    guard localTime > 0, localTime < 1.0 else { continue }

                    let x = size.width * 0.5 + (seed - 3.5) * 18 + sin(localTime * 4 + seed) * 6
                    let y = weightBottomY - localTime * 50 - seed * 4
                    let opacity = (1 - localTime) * 0.85 * progress
                    let particleSize = 1.5 + seed * 0.2
                    let color = index.isMultiple(of: 2)
                        ? AppColor.accent.opacity(opacity)
                        : Color.white.opacity(opacity * 0.7)

                    let rect = CGRect(
                        x: x - particleSize / 2,
                        y: y - particleSize / 2,
                        width: particleSize,
                        height: particleSize
                    )
                    context.fill(Path(ellipseIn: rect), with: .color(color))
                }
            }
        }
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
            content: ZStack(alignment: .top) {
                AchievementCardContent(
                    achievement: achievement,
                    moltenFillProgress: 1,
                    showSettledGlow: true,
                    glowOpacity: 0.22,
                    showIgnitionEffects: false,
                    shockwaveProgress: 1,
                    rendersForShare: true
                )
                .frame(width: cardWidth, height: cardHeight)

                MachinedMedallion()
                    .frame(width: medallionSize, height: medallionSize)
                    .offset(y: -medallionOverlap)
            }
            .frame(width: cardWidth, height: cardHeight + medallionOverlap)
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
    static var previews: some View {
        ZStack(alignment: .top) {
            AppColor.base.ignoresSafeArea()

            ZStack(alignment: .top) {
                AchievementCardContent(
                    achievement: sampleAchievement,
                    moltenFillProgress: 1,
                    showSettledGlow: true,
                    glowOpacity: 0.22,
                    rendersForShare: false
                )
                .frame(width: cardWidth, height: cardHeight)

                MachinedMedallion()
                    .frame(width: medallionSize, height: medallionSize)
                    .offset(y: -medallionOverlap)
            }
            .padding(.top, 80)
        }
        .previewDisplayName("Molten Slab — Settled")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Molten Slab — Overlay")
    }

    private static var sampleAchievement: Achievement {
        Achievement(
            exerciseName: "Incline Barbell Bench Press",
            weight: 70,
            reps: 10,
            date: Date(timeIntervalSince1970: 1_781_500_800),
            username: "marvin"
        )
    }
}
#endif
