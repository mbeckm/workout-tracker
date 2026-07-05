import CoreMotion
import SwiftUI
import UniformTypeIdentifiers

// MARK: - Motion

@MainActor
final class MotionParallaxManager: ObservableObject {
    @Published var roll: Double = 0
    @Published var pitch: Double = 0

    private let manager = CMMotionManager()

    func start() {
        guard manager.isDeviceMotionAvailable else {
            return
        }

        manager.deviceMotionUpdateInterval = 1.0 / 60.0
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let motion else {
                return
            }

            self?.roll = motion.attitude.roll
            self?.pitch = motion.attitude.pitch
        }
    }

    func stop() {
        manager.stopDeviceMotionUpdates()
        roll = 0
        pitch = 0
    }
}

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var motion = MotionParallaxManager()

    @State private var isVisible = false
    @State private var cardOffset: CGFloat = 420
    @State private var contentStep = 0
    @State private var weightScale: CGFloat = 1.5
    @State private var weightOpacity: Double = 0
    @State private var sheenOffset: CGFloat = -1.2
    @State private var glowRadius: CGFloat = 0
    @State private var glowOpacity: Double = 0
    @State private var showParticles = false
    @State private var isDismissing = false

    private let cardWidth: CGFloat = 354
    private let cornerRadius: CGFloat = 12

    var body: some View {
        ZStack {
            AppColor.base.opacity(isVisible ? 0.85 : 0)
                .ignoresSafeArea()
                .onTapGesture {
                    dismiss()
                }

            VStack(spacing: 20) {
                cardStack
                    .offset(y: cardOffset)
                    .scaleEffect(isDismissing ? 0.92 : 1)
                    .opacity(isDismissing ? 0 : 1)

                if contentStep >= 8 {
                    Button("Continue") {
                        dismiss()
                    }
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.secondaryText)
                    .opacity(isDismissing ? 0 : 1)
                }
            }
            .padding(.horizontal, 24)
        }
        .onAppear(perform: playEntrance)
        .onDisappear {
            motion.stop()
        }
    }

    private var cardStack: some View {
        ZStack {
            if showParticles {
                AchievementSparkParticles()
                    .frame(width: cardWidth, height: 520)
                    .allowsHitTesting(false)
            }

            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(AppColor.accent.opacity(glowOpacity))
                .blur(radius: glowRadius)
                .frame(width: cardWidth + 24, height: 520)

            AchievementCardContent(
                achievement: achievement,
                contentStep: contentStep,
                weightScale: weightScale,
                weightOpacity: weightOpacity,
                sheenOffset: sheenOffset,
                roll: motion.roll,
                pitch: motion.pitch,
                reduceMotion: reduceMotion
            )
            .frame(width: cardWidth)
        }
    }

    private func playEntrance() {
        if reduceMotion {
            isVisible = true
            cardOffset = 0
            contentStep = 8
            weightScale = 1
            weightOpacity = 1
            glowRadius = 12
            glowOpacity = 0.18
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            motion.start()
            return
        }

        withAnimation(.easeOut(duration: 0.35)) {
            isVisible = true
        }

        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
            cardOffset = 0
        }

        motion.start()
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        withAnimation(.linear(duration: 0.9).delay(0.15)) {
            sheenOffset = 1.4
        }

        staggerContent()

        withAnimation(.easeOut(duration: 0.55).delay(0.42)) {
            glowRadius = 40
            glowOpacity = 0.45
        }

        withAnimation(.easeOut(duration: 0.8).delay(0.95)) {
            glowRadius = 12
            glowOpacity = 0.18
        }
    }

    private func staggerContent() {
        for step in 1...8 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12 + Double(step) * 0.06) {
                withAnimation(.easeOut(duration: 0.28)) {
                    contentStep = step
                }

                if step == 6 {
                    stampWeight()
                }
            }
        }
    }

    private func stampWeight() {
        showParticles = true

        withAnimation(.spring(response: 0.34, dampingFraction: 0.62)) {
            weightScale = 1
            weightOpacity = 1
        }

        Haptics.tap(.heavy)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            showParticles = false
        }
    }

    private func dismiss() {
        motion.stop()

        if reduceMotion {
            onDismiss()
            return
        }

        withAnimation(.easeIn(duration: 0.22)) {
            isDismissing = true
            isVisible = false
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
            onDismiss()
        }
    }
}

// MARK: - Card Content

struct AchievementCardContent: View {
    var achievement: Achievement
    var contentStep: Int = 8
    var weightScale: CGFloat = 1
    var weightOpacity: Double = 1
    var sheenOffset: CGFloat = 1.4
    var roll: Double = 0
    var pitch: Double = 0
    var reduceMotion: Bool = false
    var rendersForShare: Bool = false

    private let cornerRadius: CGFloat = 12

    private var tiltX: Double {
        reduceMotion ? 0 : min(max(pitch * 12, -6), 6)
    }

    private var tiltY: Double {
        reduceMotion ? 0 : min(max(roll * 12, -6), 6)
    }

    private var sheenShift: CGFloat {
        reduceMotion ? 0 : CGFloat(roll * 18 - pitch * 12)
    }

    var body: some View {
        VStack(spacing: 16) {
            if contentStep >= 1 || rendersForShare {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 64, weight: .semibold))
                    .foregroundStyle(AppColor.accent)
                    .transition(stepTransition)
            }

            if contentStep >= 2 || rendersForShare {
                Text("Achievement Unlocked")
                    .font(AppFont.subheading)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
                    .transition(stepTransition)
            }

            if contentStep >= 3 || rendersForShare {
                captionRow
                    .transition(stepTransition)
            }

            if contentStep >= 4 || rendersForShare {
                divider
                    .transition(stepTransition)
            }

            if contentStep >= 5 || rendersForShare {
                Text(achievement.exerciseName)
                    .font(AppFont.display)
                    .foregroundStyle(AppColor.primaryText)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .transition(stepTransition)
            }

            if contentStep >= 6 || rendersForShare {
                Text(achievement.weightLabel)
                    .font(.inter(size: 96, weight: .bold, relativeTo: .largeTitle))
                    .tracking(-2.88)
                    .foregroundStyle(AppColor.accent)
                    .scaleEffect(weightScale)
                    .opacity(weightOpacity)
                    .transition(stepTransition)
            }

            if contentStep >= 7 || rendersForShare {
                Text(achievement.repsLabel)
                    .font(AppFont.h2)
                    .foregroundStyle(AppColor.primaryText)
                    .transition(stepTransition)
            }

            if contentStep >= 8 || rendersForShare {
                divider
                    .transition(stepTransition)

                sharePill
                    .transition(stepTransition)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background { cardSurface }
        .overlay { machinedBorder }
        .overlay { specularSheen }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .rotation3DEffect(.degrees(tiltX), axis: (x: 1, y: 0, z: 0))
        .rotation3DEffect(.degrees(tiltY), axis: (x: 0, y: 1, z: 0))
    }

    private var captionRow: some View {
        HStack(spacing: 24) {
            Text(achievement.formattedDate)
            if let usernameCaption = achievement.usernameCaption {
                Text(usernameCaption)
            }
        }
        .font(AppFont.caption)
        .foregroundStyle(AppColor.secondaryText)
    }

    private var divider: some View {
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
        .background(AppColor.surface1, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
    }

    private var cardSurface: some View {
        ZStack {
            LinearGradient(
                colors: [AppColor.surface2, AppColor.surface1],
                startPoint: .top,
                endPoint: .bottom
            )

            BrushedMetalTexture()
        }
    }

    private var machinedBorder: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .stroke(
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.35),
                        AppColor.border
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 1
            )
    }

    private var specularSheen: some View {
        GeometryReader { proxy in
            LinearGradient(
                colors: [
                    Color.white.opacity(0),
                    Color.white.opacity(0.10),
                    Color.white.opacity(0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .frame(width: proxy.size.width * 0.55)
            .offset(x: proxy.size.width * sheenOffset + sheenShift)
            .blendMode(.plusLighter)
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .allowsHitTesting(false)
    }

    private var stepTransition: AnyTransition {
        .opacity.combined(with: .offset(y: 8))
    }
}

private struct BrushedMetalTexture: View {
    var body: some View {
        Canvas { context, size in
            let streakCount = 18
            for index in 0..<streakCount {
                let y = size.height * CGFloat(index) / CGFloat(streakCount)
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y + 0.5))
                context.stroke(
                    path,
                    with: .color(Color.white.opacity(index.isMultiple(of: 3) ? 0.045 : 0.025)),
                    lineWidth: 1
                )
            }
        }
        .opacity(0.55)
        .allowsHitTesting(false)
    }
}

private struct AchievementSparkParticles: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { context, size in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate
                let center = CGPoint(x: size.width / 2, y: size.height * 0.58)
                let sparks: [(angle: Double, speed: Double, size: CGFloat)] = [
                    (-110, 0.9, 3), (-70, 1.1, 2.5), (-20, 0.85, 3.5),
                    (25, 1.0, 2), (70, 0.95, 3), (115, 1.05, 2.5)
                ]

                for (index, spark) in sparks.enumerated() {
                    let phase = elapsed - Double(index) * 0.04
                    guard phase > 0, phase < 0.75 else {
                        continue
                    }

                    let radians = spark.angle * .pi / 180
                    let distance = phase * 90 * spark.speed
                    let point = CGPoint(
                        x: center.x + CGFloat(cos(radians)) * distance,
                        y: center.y + CGFloat(sin(radians)) * distance
                    )
                    let opacity = max(0, 1 - phase * 1.35)

                    context.fill(
                        Path(ellipseIn: CGRect(x: point.x, y: point.y, width: spark.size, height: spark.size)),
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
            content: AchievementCardContent(achievement: achievement, rendersForShare: true)
                .frame(width: 354)
                .padding(24)
                .background(AppColor.base)
        )
        renderer.scale = UIScreen.main.scale

        guard let uiImage = renderer.uiImage,
              let data = uiImage.pngData() else {
            throw URLError(.cannotDecodeContentData)
        }

        return data
    }
}

#if DEBUG
struct AchievementCardPreview: PreviewProvider {
    static var previews: some View {
        ZStack {
            AppColor.base.ignoresSafeArea()

            AchievementCardOverlay(
                achievement: Achievement(
                    exerciseName: "Incline Barbell Bench Press",
                    weight: 70,
                    reps: 10,
                    date: Date(timeIntervalSince1970: 1_783_000_000),
                    username: "marvin"
                ),
                onDismiss: {}
            )
        }
        .frame(width: 402, height: 874)
        .preferredColorScheme(.dark)
        .previewDisplayName("Achievement Card")
    }
}
#endif
