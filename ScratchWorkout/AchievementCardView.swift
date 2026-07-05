import SwiftUI
import UniformTypeIdentifiers

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var haptics = AchievementHaptics()

    @State private var backdropOpacity: Double = 0
    @State private var cardOffsetY: CGFloat = 60
    @State private var cardRotationY: Double = 360
    @State private var cardScale: CGFloat = 0.9
    @State private var contentOpacity: Double = 0.6
    @State private var cardOpacity: Double = 1

    @State private var lightPassOffset: CGFloat = -420
    @State private var showLightPass = false

    @State private var displayedWeight: Int = 0
    @State private var weightScale: CGFloat = 1

    @State private var underglowRadius: CGFloat = 0
    @State private var underglowOpacity: Double = 0

    @State private var hasSettled = false

    private let cardWidth: CGFloat = 354
    private let entranceDuration: TimeInterval = 0.9
    private let passDuration: TimeInterval = 0.45
    private let countUpDuration: TimeInterval = 0.5

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

    private var cardStack: some View {
        AchievementCardContent(
            achievement: achievement,
            displayedWeight: displayedWeight,
            weightScale: weightScale,
            showLightPass: showLightPass,
            lightPassOffset: lightPassOffset,
            rendersForShare: false
        )
        .frame(width: cardWidth)
        .opacity(contentOpacity)
        .scaleEffect(cardScale)
        .rotation3DEffect(
            .degrees(cardRotationY),
            axis: (x: 0, y: 1, z: 0),
            perspective: 0.5
        )
        .offset(y: cardOffsetY)
        .shadow(
            color: AppColor.accent.opacity(underglowOpacity),
            radius: underglowRadius,
            x: 0,
            y: 8
        )
    }

    private func startEntrance() {
        haptics.prepare()

        if reduceMotion {
            withAnimation(.easeOut(duration: 0.3)) {
                backdropOpacity = 0.85
                cardOffsetY = 0
                cardScale = 1
                contentOpacity = 1
                cardRotationY = 0
            }
            displayedWeight = achievement.weight
            underglowRadius = 16
            underglowOpacity = 0.10
            hasSettled = true
            haptics.playEntrance(reduceMotion: true)
            return
        }

        haptics.playEntrance(reduceMotion: false)

        withAnimation(.easeOut(duration: 0.3)) {
            backdropOpacity = 0.85
        }

        withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
            cardOffsetY = 0
            cardRotationY = 0
            cardScale = 1
            contentOpacity = 1
        }

        let settleDelay = entranceDuration
        DispatchQueue.main.asyncAfter(deadline: .now() + settleDelay) {
            haptics.playSettle(fallback: !haptics.isReady)
        }

        let passStartDelay = entranceDuration * 0.75
        DispatchQueue.main.asyncAfter(deadline: .now() + passStartDelay) {
            triggerLightPass()
        }
    }

    private func triggerLightPass() {
        showLightPass = true
        lightPassOffset = -420
        haptics.playPass(fallback: !haptics.isReady)

        withAnimation(.easeInOut(duration: passDuration)) {
            lightPassOffset = 420
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + passDuration) {
            showLightPass = false
            animateWeightCountUp()
        }
    }

    private func animateWeightCountUp() {
        let target = achievement.weight
        let steps = 30
        let stepDuration = countUpDuration / Double(steps)

        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + stepDuration * Double(step)) {
                withAnimation(.linear(duration: stepDuration)) {
                    displayedWeight = Int(round(Double(target) * Double(step) / Double(steps)))
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + countUpDuration) {
            displayedWeight = target
            triggerBloom()
        }
    }

    private func triggerBloom() {
        hasSettled = true
        haptics.playLockAndBloom(fallback: !haptics.isReady)

        withAnimation(.easeOut(duration: 0.35)) {
            underglowRadius = 28
            underglowOpacity = 0.22
        }

        withAnimation(.spring(response: 0.28, dampingFraction: 0.55)) {
            weightScale = 1.06
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) {
                weightScale = 1
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            withAnimation(.easeOut(duration: 0.4)) {
                underglowRadius = 16
                underglowOpacity = 0.10
            }
        }
    }

    private func dismiss() {
        haptics.release()

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
    var weightScale: CGFloat = 1
    var showLightPass = false
    var lightPassOffset: CGFloat = -420
    var rendersForShare = false

    private let cardShape = RoundedRectangle(cornerRadius: 12, style: .continuous)

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "trophy.fill")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(AppColor.accent)

            Text("Achievement Unlocked")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)

            captionRow

            cardDivider

            Text(achievement.exerciseName)
                .font(AppFont.display)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            weightDisplay

            Text(achievement.repsLabel)
                .font(AppFont.h2)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)

            cardDivider

            sharePill
        }
        .padding(16)
        .frame(width: 354)
        .background(AppColor.surface1, in: cardShape)
        .overlay(cardShape.stroke(AppColor.border, lineWidth: 1))
        .overlay {
            if showLightPass {
                lightPassOverlay
                    .mask(cardShape)
            }
        }
    }

    private var weightDisplay: some View {
        Text("\(displayedWeight)KG")
            .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
            .tracking(-2.88)
            .foregroundStyle(AppColor.accent)
            .contentTransition(.numericText())
            .scaleEffect(weightScale)
            .overlay {
                if showLightPass {
                    lightPassBand(peakOpacity: 0.18)
                        .mask {
                            Text("\(displayedWeight)KG")
                                .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                                .tracking(-2.88)
                        }
                }
            }
    }

    private var lightPassOverlay: some View {
        lightPassBand(peakOpacity: 0.10)
    }

    private func lightPassBand(peakOpacity: Double) -> some View {
        LinearGradient(
            stops: [
                .init(color: .clear, location: 0),
                .init(color: Color.white.opacity(peakOpacity), location: 0.5),
                .init(color: .clear, location: 1)
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: 80)
        .rotationEffect(.degrees(25))
        .offset(x: lightPassOffset)
        .blendMode(.screen)
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
        .background(AppColor.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
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

#if DEBUG
struct AchievementCardPreview: PreviewProvider {
    private static let sampleAchievement = Achievement(
        exerciseName: "Incline Barbell Bench Press",
        weight: 70,
        reps: 10,
        date: Date(timeIntervalSince1970: 1_781_500_800),
        username: "marvin"
    )

    static var previews: some View {
        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardContent(
                achievement: sampleAchievement,
                displayedWeight: 70
            )
            .shadow(color: AppColor.accent.opacity(0.10), radius: 16, x: 0, y: 8)
        }
        .previewDisplayName("Settled Card")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Overlay Entrance")
    }
}
#endif
