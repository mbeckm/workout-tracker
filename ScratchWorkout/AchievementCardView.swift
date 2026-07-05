import CoreMotion
import SwiftUI

// MARK: - Device tilt (CoreMotion)

@MainActor
private final class DeviceTiltObserver: ObservableObject {
    @Published var roll: Double = 0
    @Published var pitch: Double = 0

    private let manager = CMMotionManager()

    func start() {
        guard manager.isDeviceMotionAvailable, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = 1.0 / 60.0
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let motion else { return }
            self.roll = motion.attitude.roll
            self.pitch = motion.attitude.pitch
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
    }

    var parallaxX: Double {
        (-pitch * 7).clamped(to: -7...7)
    }

    var parallaxY: Double {
        (roll * 7).clamped(to: -7...7)
    }

    var foilCenter: UnitPoint {
        UnitPoint(
            x: (0.5 + roll * 0.22).clamped(to: 0...1),
            y: (0.5 + pitch * 0.22).clamped(to: 0...1)
        )
    }

    var foilAngle: Angle {
        .degrees(roll * 40 + pitch * 30)
    }
}

// MARK: - Overlay

struct AchievementOverlayView: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var tilt = DeviceTiltObserver()

    @State private var backdropOpacity: Double = 0
    @State private var cardFlipDegrees: Double = 90
    @State private var cardScale: CGFloat = 0.9
    @State private var cardOpacity: Double = 0
    @State private var dismissScale: CGFloat = 1
    @State private var dismissOpacity: Double = 1
    @State private var glowTrim: CGFloat = 0
    @State private var glowSettled = false
    @State private var showContinue = false
    @State private var contentVisible = false
    @State private var weightShimmerPhase: CGFloat = -1

    var body: some View {
        ZStack {
            backdrop

            VStack(spacing: 24) {
                cardLayer
                    .scaleEffect(cardScale * dismissScale)
                    .opacity(cardOpacity * dismissOpacity)

                Button("Continue") {
                    dismiss()
                }
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .opacity(showContinue ? 1 : 0)
            }
            .padding(.horizontal, 24)
        }
        .onAppear {
            if reduceMotion {
                startReducedMotionEntrance()
            } else {
                startEntrance()
            }
            if !reduceMotion {
                tilt.start()
            }
        }
        .onDisappear {
            tilt.stop()
        }
    }

    private var backdrop: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity * 0.85)
                .ignoresSafeArea()

            RadialGradient(
                colors: [
                    AppColor.accent.opacity(0.06 * backdropOpacity),
                    Color.clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: 220
            )
            .ignoresSafeArea()
        }
        .contentShape(Rectangle())
        .onTapGesture {
            dismiss()
        }
    }

    private var cardLayer: some View {
        ZStack {
            if glowSettled {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(AppColor.accent.opacity(0.35), lineWidth: 1.5)
                    .frame(width: 354)
                    .blur(radius: 1)
                    .shadow(color: AppColor.accent.opacity(0.25), radius: 24)
            }

            AchievementCardContent(
                achievement: achievement,
                foilCenter: reduceMotion ? UnitPoint(x: 0.35, y: 0.3) : tilt.foilCenter,
                foilAngle: reduceMotion ? .degrees(45) : tilt.foilAngle,
                weightShimmerPhase: weightShimmerPhase,
                contentVisible: contentVisible
            )
            .frame(width: 354)
            .rotation3DEffect(.degrees(cardFlipDegrees), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
            .rotation3DEffect(.degrees(reduceMotion ? 0 : tilt.parallaxX), axis: (x: 1, y: 0, z: 0), perspective: 0.55)
            .rotation3DEffect(.degrees(reduceMotion ? 0 : tilt.parallaxY), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
            .overlay {
                glowRing
            }
        }
    }

    private var glowRing: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .trim(from: 0, to: glowTrim)
            .stroke(
                AngularGradient(
                    colors: [
                        AppColor.accent.opacity(0.9),
                        AppColor.accent.opacity(0.2),
                        Color.white.opacity(0.4),
                        AppColor.accent.opacity(0.9)
                    ],
                    center: .center
                ),
                style: StrokeStyle(lineWidth: 1.5, lineCap: .round)
            )
            .blur(radius: 2)
            .shadow(color: AppColor.accent.opacity(0.55), radius: 10)
            .allowsHitTesting(false)
    }

    private func startReducedMotionEntrance() {
        withAnimation(.easeOut(duration: 0.3)) {
            backdropOpacity = 1
            cardOpacity = 1
            cardScale = 1
            cardFlipDegrees = 0
            contentVisible = true
            showContinue = true
            glowSettled = true
        }
        Haptics.tap(.heavy)
    }

    private func startEntrance() {
        withAnimation(.easeOut(duration: 0.28)) {
            backdropOpacity = 1
        }

        withAnimation(.spring(response: 0.55, dampingFraction: 0.8)) {
            cardFlipDegrees = 0
            cardScale = 1
            cardOpacity = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.55) {
            Haptics.tap(.heavy)
            withAnimation(.easeOut(duration: 0.55)) {
                contentVisible = true
            }
            startWeightShimmer()
            showContinue = true
        }

        withAnimation(.easeInOut(duration: 0.85)) {
            glowTrim = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            glowSettled = true
        }
    }

    private func startWeightShimmer() {
        weightShimmerPhase = -0.4
        withAnimation(.easeInOut(duration: 0.75)) {
            weightShimmerPhase = 1.4
        }
    }

    private func dismiss() {
        tilt.stop()
        withAnimation(.easeIn(duration: 0.22)) {
            dismissScale = 0.92
            dismissOpacity = 0
            backdropOpacity = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            onDismiss()
        }
    }

}

// MARK: - Card content

struct AchievementCardContent: View {
    var achievement: Achievement
    var foilCenter: UnitPoint = UnitPoint(x: 0.35, y: 0.3)
    var foilAngle: Angle = .degrees(45)
    var weightShimmerPhase: CGFloat = -1
    var contentVisible = true
    var rendersForShare = false

    var body: some View {
        VStack(spacing: 24) {
            trophySection
                .opacity(contentVisible ? 1 : 0)
                .offset(y: contentVisible ? 0 : 8)

            Text("Achievement Unlocked")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .opacity(contentVisible ? 1 : 0)
                .offset(y: contentVisible ? 0 : 8)

            captionRow
                .opacity(contentVisible ? 1 : 0)

            cardDivider

            Text(achievement.exerciseName)
                .font(AppFont.display)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
                .opacity(contentVisible ? 1 : 0)
                .offset(y: contentVisible ? 0 : 10)

            weightLabel
                .opacity(contentVisible ? 1 : 0)

            Text(achievement.repsLabel)
                .font(AppFont.h2)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .opacity(contentVisible ? 1 : 0)

            cardDivider

            sharePill
                .opacity(contentVisible ? 1 : 0)
        }
        .padding(16)
        .frame(width: 354)
        .background { cardSurface }
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
    }

    private var trophySection: some View {
        Image(systemName: "trophy.fill")
            .font(.system(size: 64, weight: .semibold))
            .foregroundStyle(AppColor.accent)
            .frame(height: 64)
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

    private var weightLabel: some View {
        Text(achievement.weightLabel)
            .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
            .tracking(-2.88)
            .foregroundStyle(AppColor.accent)
            .overlay {
                strongFoilGradient
                    .mask {
                        Text(achievement.weightLabel)
                            .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                            .tracking(-2.88)
                    }
            }
            .overlay {
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color.white.opacity(0.35),
                        Color.clear
                    ],
                    startPoint: UnitPoint(x: weightShimmerPhase - 0.15, y: 0.5),
                    endPoint: UnitPoint(x: weightShimmerPhase + 0.15, y: 0.5)
                )
                .blendMode(.screen)
                .mask {
                    Text(achievement.weightLabel)
                        .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                        .tracking(-2.88)
                }
            }
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
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        }
    }

    private var cardSurface: some View {
        ZStack {
            LinearGradient(
                colors: [AppColor.surface1, AppColor.surface2],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            foilGradient
                .blendMode(.screen)
        }
    }

    private var foilGradient: some View {
        AngularGradient(
            gradient: Gradient(stops: [
                .init(color: Color.white.opacity(0.12), location: 0),
                .init(color: AppColor.accent.opacity(0.10), location: 0.25),
                .init(color: AppColor.secondaryText.opacity(0.08), location: 0.5),
                .init(color: Color.clear, location: 1)
            ]),
            center: foilCenter,
            angle: foilAngle
        )
    }

    private var strongFoilGradient: some View {
        AngularGradient(
            gradient: Gradient(stops: [
                .init(color: Color.white.opacity(0.45), location: 0),
                .init(color: AppColor.accent.opacity(0.55), location: 0.3),
                .init(color: AppColor.secondaryText.opacity(0.2), location: 0.6),
                .init(color: AppColor.accent.opacity(0.35), location: 1)
            ]),
            center: foilCenter,
            angle: foilAngle
        )
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
                foilCenter: UnitPoint(x: 0.35, y: 0.3),
                foilAngle: .degrees(45),
                weightShimmerPhase: 0.5,
                contentVisible: true,
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
                )
            )
        }
        .previewDisplayName("Achievement Card")

        AchievementOverlayView(
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
