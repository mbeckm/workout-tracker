import SwiftUI
import UniformTypeIdentifiers

// MARK: - Stagger Groups

enum AchievementStaggerGroup: Int, CaseIterable {
    case trophy
    case title
    case caption
    case divider1
    case exercise
    case weight
    case reps
    case divider2
    case share
    case wordmark
}

// MARK: - Tap Ripple

struct AchievementTapRipple: Identifiable, Equatable {
    let id = UUID()
    let point: CGPoint
}

private struct AchievementTapRippleView: View {
    let center: CGPoint
    let diameter: CGFloat
    let onComplete: () -> Void

    @State private var scale: CGFloat = 0
    @State private var opacity: Double = 1

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [AppColor.accent.opacity(0.16), Color.clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: diameter / 2
                )
            )
            .frame(width: diameter, height: diameter)
            .scaleEffect(scale)
            .opacity(opacity)
            .position(center)
            .blendMode(.screen)
            .allowsHitTesting(false)
            .onAppear {
                withAnimation(.easeOut(duration: 0.9)) {
                    scale = 2.2
                    opacity = 0
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
                    onComplete()
                }
            }
    }
}

// MARK: - Card Surface

private extension View {
    @ViewBuilder
    func achievementCardGrain(rendersForShare: Bool) -> some View {
        if rendersForShare {
            self
        } else {
            colorEffect(ShaderLibrary.achievementGrain(.float(0.05)))
        }
    }
}

private enum AchievementCardSurface {
    static let cornerRadius: CGFloat = 12
    static let width: CGFloat = 354

    static var cardShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
    }

    static var borderGradient: LinearGradient {
        LinearGradient(
            stops: [
                .init(color: Color.white.opacity(0.14), location: 0),
                .init(color: AppColor.border, location: 0.35),
                .init(color: AppColor.border, location: 1)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    @ViewBuilder
    static func background(rendersForShare: Bool, ripples: [AchievementTapRipple]) -> some View {
        ZStack {
            AppColor.surface1

            LinearGradient(
                colors: [Color.black.opacity(0), Color.black.opacity(0.30)],
                startPoint: .top,
                endPoint: .bottom
            )

            RadialGradient(
                colors: [AppColor.accent.opacity(0.05), Color.clear],
                center: UnitPoint(x: 0.5, y: 0.6),
                startRadius: 0,
                endRadius: 190
            )
        }
        .achievementCardGrain(rendersForShare: rendersForShare)
        .overlay {
            ForEach(ripples) { ripple in
                AchievementTapRippleView(
                    center: ripple.point,
                    diameter: width,
                    onComplete: {}
                )
            }
        }
        .clipShape(cardShape)
    }
}

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var backdropOpacity: Double = 0
    @State private var cardOffsetY: CGFloat = 60
    @State private var cardRotationY: Double = 360
    @State private var cardScale: CGFloat = 0.9
    @State private var cardOpacity: Double = 1
    @State private var tapDipScale: CGFloat = 1
    @State private var revealedGroups: Set<AchievementStaggerGroup> = []
    @State private var displayedWeight: Int = 0
    @State private var weightScale: CGFloat = 1
    @State private var weightBloomOpacity: Double = 0
    @State private var showContinue = false
    @State private var isEntranceSettled = false
    @State private var activeRipples: [AchievementTapRipple] = []

    private static let entranceDuration: TimeInterval = 0.9
    private static let staggerStep: TimeInterval = 0.07
    private static let weightCountDuration: TimeInterval = 0.5

    var body: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            VStack(spacing: 24) {
                AchievementCardContent(
                    achievement: achievement,
                    displayedWeight: displayedWeight,
                    weightScale: weightScale,
                    weightBloomOpacity: weightBloomOpacity,
                    revealedGroups: revealedGroups,
                    showAllContent: false,
                    rendersForShare: false,
                    activeRipples: activeRipples
                )
                .scaleEffect(cardScale * tapDipScale)
                .offset(y: cardOffsetY)
                .opacity(cardOpacity)
                .rotation3DEffect(
                    .degrees(cardRotationY),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.5
                )
                .simultaneousGesture(cardTapGesture)

                Button("Continue") {
                    dismiss()
                }
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .opacity(showContinue ? 1 : 0)
            }
            .padding(.horizontal, 24)
        }
        .onAppear(perform: startEntrance)
    }

    private var cardTapGesture: some Gesture {
        SpatialTapGesture()
            .onEnded { value in
                guard isEntranceSettled else { return }

                if reduceMotion {
                    AchievementHaptics.shared.tapPulse()
                    return
                }

                handleCardTap(at: value.location)
            }
    }

    private func handleCardTap(at location: CGPoint) {
        AchievementHaptics.shared.tapPulse()

        let ripple = AchievementTapRipple(point: location)
        activeRipples.append(ripple)

        withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) {
            tapDipScale = 0.99
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) {
                tapDipScale = 1
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            activeRipples.removeAll { $0.id == ripple.id }
        }
    }

    private func startEntrance() {
        if reduceMotion {
            AchievementHaptics.shared.playReduceMotionFallback()
            withAnimation(.easeOut(duration: 0.3)) {
                backdropOpacity = 0.85
                cardOffsetY = 0
                cardRotationY = 0
                cardScale = 1
                revealedGroups = Set(AchievementStaggerGroup.allCases)
                displayedWeight = achievement.weight
                weightBloomOpacity = 0.30
                showContinue = true
                isEntranceSettled = true
            }
            return
        }

        AchievementHaptics.shared.prepare()
        AchievementHaptics.shared.playRise()

        withAnimation(.easeOut(duration: 0.3)) {
            backdropOpacity = 0.85
        }

        withAnimation(.spring(response: 0.7, dampingFraction: 0.85)) {
            cardOffsetY = 0
            cardRotationY = 0
            cardScale = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.entranceDuration) {
            handleSettle()
        }
    }

    private func handleSettle() {
        isEntranceSettled = true
        AchievementHaptics.shared.playSettle()
        startStaggerReveal()
    }

    private func startStaggerReveal() {
        for (index, group) in AchievementStaggerGroup.allCases.enumerated() {
            let delay = Self.staggerStep * Double(index)

            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                _ = withAnimation(.easeOut(duration: 0.25)) {
                    revealedGroups.insert(group)
                }
                AchievementHaptics.shared.playStaggerTick()

                if group == .weight {
                    startWeightCountUp()
                }
            }
        }

        let weightRevealDelay = Self.staggerStep * Double(AchievementStaggerGroup.weight.rawValue)
        let continueDelay = weightRevealDelay + Self.weightCountDuration + 0.2

        DispatchQueue.main.asyncAfter(deadline: .now() + continueDelay) {
            withAnimation(.easeOut(duration: 0.3)) {
                showContinue = true
            }
        }
    }

    private func startWeightCountUp() {
        let target = achievement.weight
        let steps = max(target, 1)

        for step in 0...steps {
            let progress = Double(step) / Double(steps)
            let delay = Self.weightCountDuration * progress

            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                withAnimation(.easeOut(duration: 0.05)) {
                    displayedWeight = Int(round(Double(target) * progress))
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + Self.weightCountDuration) {
            displayedWeight = target
            playWeightLock()
        }
    }

    private func playWeightLock() {
        AchievementHaptics.shared.playLock()

        withAnimation(.easeOut(duration: 0.1)) {
            weightScale = 1.06
            weightBloomOpacity = 0.30
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.easeOut(duration: 0.1)) {
                weightScale = 1
            }
        }
    }

    private func dismiss() {
        AchievementHaptics.shared.release()

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
    var weightBloomOpacity: Double = 0
    var revealedGroups: Set<AchievementStaggerGroup> = Set(AchievementStaggerGroup.allCases)
    var showAllContent = true
    var rendersForShare = false
    var activeRipples: [AchievementTapRipple] = []

    private static let weightAccentBright = Color(red: 0.727, green: 1.0, blue: 0.395)

    var body: some View {
        VStack(spacing: 24) {
            staggerGroup(.trophy) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64, weight: .semibold))
                    .foregroundStyle(AppColor.accent)
            }

            staggerGroup(.title) {
                Text("Achievement Unlocked")
                    .font(AppFont.h1)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
            }

            staggerGroup(.caption) {
                captionRow
            }

            staggerGroup(.divider1) {
                cardDivider
            }

            staggerGroup(.exercise) {
                Text(achievement.exerciseName)
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            staggerGroup(.weight) {
                weightDisplay
            }

            staggerGroup(.reps) {
                Text(achievement.repsLabel)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
            }

            staggerGroup(.divider2) {
                cardDivider
            }

            staggerGroup(.share) {
                sharePill
            }

            staggerGroup(.wordmark) {
                Text("SCRATCH")
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.tertiaryText)
                    .textCase(.uppercase)
                    .tracking(4)
            }
        }
        .padding(16)
        .frame(width: AchievementCardSurface.width)
        .background {
            AchievementCardSurface.background(
                rendersForShare: rendersForShare,
                ripples: activeRipples
            )
        }
        .overlay {
            AchievementCardSurface.cardShape
                .stroke(AchievementCardSurface.borderGradient, lineWidth: 1)
        }
    }

    private var weightDisplay: some View {
        ZStack {
            weightNumberText
                .foregroundStyle(AppColor.accent)
                .blur(radius: 14)
                .opacity(weightBloomOpacity)

            weightNumberText
                .foregroundStyle(
                    LinearGradient(
                        colors: [Self.weightAccentBright, AppColor.accent],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .shadow(color: AppColor.accent.opacity(0.45), radius: 2)
        }
        .contentTransition(.numericText())
        .scaleEffect(weightScale)
    }

    private var weightNumberText: some View {
        Text("\(displayedWeight)KG")
            .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
            .tracking(-2.88)
    }

    @ViewBuilder
    private func staggerGroup<Content: View>(
        _ group: AchievementStaggerGroup,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .opacity(isGroupVisible(group) ? 1 : 0)
            .offset(y: isGroupVisible(group) ? 0 : 8)
    }

    private func isGroupVisible(_ group: AchievementStaggerGroup) -> Bool {
        showAllContent || revealedGroups.contains(group)
    }

    @ViewBuilder
    private var captionRow: some View {
        if let usernameCaption = achievement.usernameCaption {
            HStack(spacing: 24) {
                Text(achievement.formattedDate)
                Text(usernameCaption)
            }
            .font(AppFont.label)
            .foregroundStyle(AppColor.secondaryText)
        } else {
            Text(achievement.formattedDate)
                .font(AppFont.label)
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
                weightBloomOpacity: 0.30,
                rendersForShare: true
            )
            .frame(width: AchievementCardSurface.width)
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
                displayedWeight: 70,
                weightBloomOpacity: 0.30
            )
        }
        .previewDisplayName("Settled Card")

        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardContent(
                achievement: sampleAchievement,
                displayedWeight: 70,
                weightBloomOpacity: 0.30,
                rendersForShare: true
            )
        }
        .previewDisplayName("Share Card")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Achievement Overlay")
    }
}
#endif
