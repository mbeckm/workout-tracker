import SwiftUI
import UniformTypeIdentifiers

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var backdropOpacity: Double = 0
    @State private var cardOffsetY: CGFloat = 60
    @State private var cardScale: CGFloat = 0.9
    @State private var cardOpacity: Double = 0
    @State private var cardRotationY: Double = 360
    @State private var chargeProgress: CGFloat = 0
    @State private var trophyChargeProgress: Double = 0
    @State private var borderIsComplete = false
    @State private var showWeight = false
    @State private var weightScale: CGFloat = 1.3
    @State private var weightOpacity: Double = 0
    @State private var showEcho = false
    @State private var echoScale: CGFloat = 1
    @State private var echoOpacity: Double = 0
    @State private var showContinue = false
    @State private var haptics: AchievementCardHaptics?

    var body: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            VStack(spacing: 24) {
                cardView
                    .offset(y: cardOffsetY)
                    .scaleEffect(cardScale)
                    .opacity(cardOpacity)
                    .rotation3DEffect(
                        .degrees(cardRotationY),
                        axis: (x: 0, y: 1, z: 0),
                        perspective: 0.5
                    )

                Button("Continue") {
                    dismiss()
                }
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .opacity(showContinue ? 1 : 0)
            }
            .padding(.horizontal, 24)
        }
        .onAppear(perform: startSequence)
        .onDisappear {
            haptics?.release()
        }
    }

    private var cardView: some View {
        ZStack {
            AchievementCardContent(
                achievement: achievement,
                showWeight: showWeight,
                weightScale: weightScale,
                weightOpacity: weightOpacity,
                chargeProgress: chargeProgress,
                trophyChargeProgress: trophyChargeProgress,
                borderIsComplete: borderIsComplete,
                rendersForShare: false
            )

            if showEcho {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.accent, lineWidth: 1)
                    .scaleEffect(echoScale)
                    .opacity(echoOpacity)
                    .allowsHitTesting(false)
            }
        }
        .frame(width: 354)
    }

    private func startSequence() {
        let engine = AchievementCardHaptics(reduceMotion: reduceMotion)
        haptics = engine
        engine.prepare()

        if reduceMotion {
            engine.playReduceMotionEntrance()
            withAnimation(.easeOut(duration: 0.3)) {
                backdropOpacity = 0.85
                cardOpacity = 1
                cardOffsetY = 0
                cardScale = 1
            }
            applySettledState(showContinueImmediately: true)
            return
        }

        engine.playRise()

        withAnimation(.easeOut(duration: 0.3)) {
            backdropOpacity = 0.85
        }

        withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
            cardOffsetY = 0
            cardScale = 1
            cardRotationY = 0
            cardOpacity = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            beginCharge()
        }
    }

    private func beginCharge() {
        haptics?.playSettle()
        haptics?.playCharge()

        withAnimation(.easeIn(duration: 0.7)) {
            chargeProgress = 1
            trophyChargeProgress = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            stampRecord()
        }
    }

    private func stampRecord() {
        borderIsComplete = true
        showWeight = true
        haptics?.playStamp()

        withAnimation(.easeOut(duration: 0.1)) {
            weightOpacity = 1
        }

        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            weightScale = 1
        }

        showEcho = true
        echoScale = 1
        echoOpacity = 1

        withAnimation(.easeOut(duration: 0.35)) {
            echoScale = 1.06
            echoOpacity = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
            showEcho = false
        }

        showContinue = true
    }

    private func applySettledState(showContinueImmediately: Bool) {
        chargeProgress = 1
        trophyChargeProgress = 1
        borderIsComplete = true
        showWeight = true
        weightScale = 1
        weightOpacity = 1
        cardRotationY = 0
        if showContinueImmediately {
            showContinue = true
        }
    }

    private func dismiss() {
        haptics?.release()
        haptics = nil

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
    var showWeight = true
    var weightScale: CGFloat = 1
    var weightOpacity: Double = 1
    var chargeProgress: CGFloat = 1
    var trophyChargeProgress: Double = 1
    var borderIsComplete = true
    var rendersForShare = false

    var body: some View {
        VStack(spacing: 24) {
            trophySection

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

            weightSection

            Text(achievement.repsLabel)
                .font(AppFont.h2)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)

            cardDivider

            sharePill
        }
        .padding(16)
        .frame(width: 354)
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(borderIsComplete ? AppColor.accent : AppColor.border, lineWidth: 1)
        }
        .overlay {
            if !borderIsComplete, chargeProgress > 0 {
                ChargeBorderView(progress: chargeProgress)
            }
        }
    }

    private var trophySection: some View {
        ZStack {
            Image(systemName: "trophy.fill")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(AppColor.secondaryText)

            Image(systemName: "trophy.fill")
                .font(.system(size: 64, weight: .semibold))
                .foregroundStyle(AppColor.accent)
                .opacity(trophyChargeProgress)
        }
        .frame(height: 64)
    }

    private var weightSection: some View {
        ZStack {
            Text(achievement.weightLabel)
                .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                .tracking(-2.88)
                .foregroundStyle(AppColor.accent)
                .opacity(0)

            if showWeight {
                Text(achievement.weightLabel)
                    .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                    .tracking(-2.88)
                    .foregroundStyle(AppColor.accent)
                    .scaleEffect(weightScale)
                    .opacity(weightOpacity)
            }
        }
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

private struct ChargeBorderView: View {
    var progress: CGFloat

    private let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
    private let headTrimLength: CGFloat = 0.012

    var body: some View {
        ZStack {
            shape
                .trim(from: 0, to: progress)
                .stroke(
                    AppColor.accent,
                    style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round)
                )
                .rotationEffect(.degrees(-90))

            if progress > headTrimLength {
                shape
                    .trim(from: progress - headTrimLength, to: progress)
                    .stroke(
                        AppColor.accent,
                        style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round)
                    )
                    .blur(radius: 2)
                    .rotationEffect(.degrees(-90))
            }
        }
        .allowsHitTesting(false)
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

            AchievementCardContent(
                achievement: sampleAchievement
            )
        }
        .previewDisplayName("Achievement Card — Charged")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Achievement Overlay")
    }
}
#endif
