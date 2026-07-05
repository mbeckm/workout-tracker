import SwiftUI
import UniformTypeIdentifiers

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
    @State private var displayedWeight: Int = 0
    @State private var showGlow = false
    @State private var glowOpacity: Double = 0
    @State private var showSparks = false
    @State private var dragTiltX: Double = 0
    @State private var dragTiltY: Double = 0
    @State private var highlightPoint: CGPoint = CGPoint(x: 177, y: 200)
    @State private var hasLanded = false

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
    }

    private var cardStack: some View {
        ZStack {
            if showGlow {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(AppColor.accent.opacity(0.18))
                    .frame(width: 354, height: 520)
                    .blur(radius: 28)
                    .opacity(glowOpacity)
            }

            ZStack {
                AchievementCardContent(
                    achievement: achievement,
                    displayedWeight: displayedWeight,
                    highlightPoint: highlightPoint,
                    showInteractiveHighlight: hasLanded,
                    rendersForShare: false
                )

                if showSparks {
                    SparkBurstView()
                        .frame(width: 354, height: 520)
                        .allowsHitTesting(false)
                }
            }
            .frame(width: 354)
            .rotation3DEffect(.degrees(dragTiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.6)
            .rotation3DEffect(.degrees(dragTiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
            .gesture(dragGesture)
        }
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard hasLanded else { return }

                highlightPoint = CGPoint(
                    x: min(max(value.location.x, 0), 354),
                    y: min(max(value.location.y, 0), 520)
                )
                dragTiltX = Double(value.translation.height / 18).clamped(to: -10...10)
                dragTiltY = Double(-value.translation.width / 18).clamped(to: -10...10)
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.45, dampingFraction: 0.72)) {
                    dragTiltX = 0
                    dragTiltY = 0
                    highlightPoint = CGPoint(x: 177, y: 200)
                }
            }
    }

    private func startEntrance() {
        if reduceMotion {
            backdropOpacity = 0.85
            cardOffsetY = 0
            hasLanded = true
            displayedWeight = achievement.weight
            return
        }

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
        Haptics.tap(.heavy)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        showSparks = true

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

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            showSparks = false
        }

        animateWeightCountUp()
    }

    private func animateWeightCountUp() {
        let target = achievement.weight
        let steps = max(target, 1)
        let stepDuration = 0.6 / Double(steps)

        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + stepDuration * Double(step)) {
                withAnimation(.easeOut(duration: 0.05)) {
                    displayedWeight = Int(round(Double(target) * Double(step) / Double(steps)))
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.62) {
            displayedWeight = target
            Haptics.tap(.light)
            showGlow = true
            withAnimation(.easeOut(duration: 0.35)) {
                glowOpacity = 1
            }
            withAnimation(.easeIn(duration: 0.45).delay(0.2)) {
                glowOpacity = 0
            }
        }
    }

    private func dismiss() {
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
    var displayedWeight: Int
    var highlightPoint: CGPoint = CGPoint(x: 177, y: 200)
    var showInteractiveHighlight = false
    var rendersForShare = false

    var body: some View {
        VStack(spacing: 24) {
            trophySection

            EmbossedText(
                text: "Achievement Unlocked",
                font: AppFont.subheading,
                color: AppColor.primaryText
            )
            .multilineTextAlignment(.center)

            captionRow

            cardDivider

            EmbossedText(
                text: achievement.exerciseName,
                font: AppFont.display,
                color: AppColor.primaryText
            )
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)

            Text("\(displayedWeight)KG")
                .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                .tracking(-2.88)
                .foregroundStyle(AppColor.accent)
                .contentTransition(.numericText())
                .shadow(color: Color.black.opacity(0.35), radius: 0, x: 0, y: -1)
                .shadow(color: Color.white.opacity(0.12), radius: 0, x: 0, y: 1)

            EmbossedText(
                text: achievement.repsLabel,
                font: AppFont.h2,
                color: AppColor.primaryText
            )
            .multilineTextAlignment(.center)

            cardDivider

            sharePill
        }
        .padding(16)
        .frame(width: 354)
        .background { metalBackground }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
    }

    private var trophySection: some View {
        ZStack {
            WeightPlateMotif()
                .frame(width: 180, height: 180)

            Image(systemName: "trophy.fill")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(AppColor.accent)
                .shadow(color: AppColor.accent.opacity(0.35), radius: 12, y: 4)
        }
        .frame(height: 96)
    }

    @ViewBuilder
    private var captionRow: some View {
        if let usernameCaption = achievement.usernameCaption {
            HStack(spacing: 24) {
                Text(achievement.formattedDate)
                Text(usernameCaption)
            }
            .font(AppFont.caption)
            .foregroundStyle(AppColor.secondaryText)
        } else {
            Text(achievement.formattedDate)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
        }
    }

    private var cardDivider: some View {
        Rectangle()
            .fill(AppColor.border)
            .frame(width: 179, height: 1)
    }

    @ViewBuilder
    private var sharePill: some View {
        if rendersForShare {
            sharePillLabel
        } else {
            ShareLink(
                item: ShareCardPayload(achievement: achievement),
                preview: SharePreview("Achievement Unlocked", image: Image(systemName: "trophy.fill"))
            ) {
                sharePillLabel
            }
            .buttonStyle(.plain)
        }
    }

    private var sharePillLabel: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 16, weight: .medium))
            Text("Share with a friend")
                .font(AppFont.subheading)
        }
        .foregroundStyle(AppColor.secondaryText)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity)
        .background(AppColor.surface1, in: Capsule())
        .overlay {
            Capsule()
                .stroke(AppColor.border, lineWidth: 1)
        }
    }

    private var metalBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    AppColor.surface2,
                    AppColor.surface1,
                    AppColor.base.opacity(0.92)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    Color.white.opacity(0.08),
                    Color.clear
                ],
                center: .topLeading,
                startRadius: 0,
                endRadius: 220
            )

            if showInteractiveHighlight {
                RadialGradient(
                    colors: [
                        Color.white.opacity(0.14),
                        Color.clear
                    ],
                    center: UnitPoint(
                        x: highlightPoint.x / 354,
                        y: highlightPoint.y / 520
                    ),
                    startRadius: 0,
                    endRadius: 140
                )
                .blendMode(.screen)
            }

            LinearGradient(
                colors: [
                    Color.white.opacity(0.06),
                    Color.clear,
                    Color.black.opacity(0.12)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

private struct EmbossedText: View {
    var text: String
    var font: Font
    var color: Color

    var body: some View {
        ZStack {
            Text(text)
                .font(font)
                .foregroundStyle(Color.black.opacity(0.4))
                .offset(y: -1)

            Text(text)
                .font(font)
                .foregroundStyle(Color.white.opacity(0.15))
                .offset(y: 1)

            Text(text)
                .font(font)
                .foregroundStyle(color)
        }
    }
}

private struct WeightPlateMotif: View {
    var body: some View {
        ZStack {
            ForEach([140.0, 110.0, 80.0], id: \.self) { diameter in
                Circle()
                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    .frame(width: diameter, height: diameter)
            }

            Circle()
                .stroke(Color.white.opacity(0.08), lineWidth: 1.5)
                .frame(width: 48, height: 48)
        }
    }
}

private struct SparkBurstView: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
            Canvas { context, size in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate
                let local = elapsed.truncatingRemainder(dividingBy: 0.45)

                for index in 0..<14 {
                    let seed = Double(index)
                    let progress = min(local / 0.45, 1)
                    let angle = (-Double.pi / 2) + (seed - 6.5) * 0.18
                    let speed = 90 + seed * 8
                    let x = size.width * 0.5 + cos(angle) * speed * progress
                    let y = size.height - 8 - sin(abs(angle)) * speed * progress * 0.85
                    let opacity = (1 - progress) * 0.85
                    let particleSize = 3 + seed * 0.15

                    let rect = CGRect(
                        x: x - particleSize / 2,
                        y: y - particleSize / 2,
                        width: particleSize,
                        height: particleSize
                    )
                    context.fill(
                        Path(ellipseIn: rect),
                        with: .color(AppColor.accent.opacity(opacity))
                    )
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
            content: AchievementCardContent(
                achievement: achievement,
                displayedWeight: achievement.weight,
                rendersForShare: true
            )
            .frame(width: 354)
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
        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardContent(
                achievement: Achievement(
                    exerciseName: "Incline Barbell Bench Press",
                    weight: 70,
                    reps: 10,
                    date: Date(timeIntervalSince1970: 1_781_500_800),
                    username: "marvin"
                ),
                displayedWeight: 70
            )
        }
        .previewDisplayName("Achievement Card")

        AchievementCardOverlay(
            achievement: Achievement(
                exerciseName: "Incline Barbell Bench Press",
                weight: 70,
                reps: 10,
                date: Date(timeIntervalSince1970: 1_781_500_800),
                username: "marvin"
            ),
            onDismiss: {}
        )
        .previewDisplayName("Achievement Overlay")
    }
}
#endif
