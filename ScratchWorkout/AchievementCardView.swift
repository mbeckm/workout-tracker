import SwiftUI
import UniformTypeIdentifiers

// MARK: - Layout Constants

private enum ForgedLayout {
    static let cardWidth: CGFloat = 354
    static let medalDiameter: CGFloat = 200
    static let medalOverlap: CGFloat = 48
    static let medalContentInset: CGFloat = medalDiameter - medalOverlap
    static let cardRadius: CGFloat = 12
}

// MARK: - Overlay

struct AchievementCardOverlay: View {
    var achievement: Achievement
    var onDismiss: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var backdropOpacity: Double = 0
    @State private var allowsTapDismiss = false
    @State private var plinthScale: CGFloat = 0.96
    @State private var plinthOpacity: Double = 0
    @State private var plinthDipY: CGFloat = 0
    @State private var groupOffsetY: CGFloat = 0
    @State private var groupScale: CGFloat = 1
    @State private var groupOpacity: Double = 1
    @State private var shakeOffsetY: CGFloat = 0

    @State private var medalOffsetY: CGFloat = -350
    @State private var medalScale: CGFloat = 1.15
    @State private var medalFallRotationX: Double = 35
    @State private var wobbleStartDate: Date?
    @State private var isWobbling = false

    @State private var dustRingScale: CGFloat = 1
    @State private var dustRingOpacity: Double = 0

    @State private var accentArcProgress: Double = 0
    @State private var accentRimOpacity: Double = 0
    @State private var innerBleedOpacity: Double = 0
    @State private var numberGlowRadius: CGFloat = 10
    @State private var displayedWeight: Int = 0
    @State private var isCharged = false
    @State private var hasSettled = false

    @State private var dragTiltX: Double = 0
    @State private var dragTiltY: Double = 0
    @State private var specularAngle: Double = -45

    @State private var haptics = AchievementHaptics()

    var body: some View {
        ZStack {
            AppColor.base
                .opacity(backdropOpacity)
                .ignoresSafeArea()
                .onTapGesture {
                    guard allowsTapDismiss else { return }
                    dismiss()
                }

            VStack(spacing: 24) {
                compositionStack
                    .offset(y: shakeOffsetY)
                    .offset(y: groupOffsetY)
                    .scaleEffect(groupScale)
                    .opacity(groupOpacity)

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
            haptics.stop()
        }
    }

    private var compositionStack: some View {
        ZStack(alignment: .top) {
            PlinthCardView(
                achievement: achievement,
                rendersForShare: false
            )
            .offset(y: plinthDipY)
            .scaleEffect(plinthScale)
            .opacity(plinthOpacity)

            ZStack {
                if dustRingOpacity > 0 {
                    Circle()
                        .stroke(Color.white.opacity(0.15), lineWidth: 1.5)
                        .frame(width: ForgedLayout.medalDiameter, height: ForgedLayout.medalDiameter)
                        .scaleEffect(dustRingScale)
                        .opacity(dustRingOpacity)
                        .allowsHitTesting(false)
                }

                medalView
            }
            .offset(y: medalOffsetY)
        }
        .frame(width: ForgedLayout.cardWidth)
    }

    @ViewBuilder
    private var medalView: some View {
        if isWobbling, let startDate = wobbleStartDate {
            TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { timeline in
                let wobble = wobbleState(at: timeline.date, start: startDate)
                forgedMedal(
                    wobbleDegrees: wobble.angle,
                    wobbleAxis: wobble.axis,
                    specularAngle: wobble.specularAngle + dragSpecularOffset
                )
            }
        } else {
            forgedMedal(
                wobbleDegrees: 0,
                wobbleAxis: (0, 1, 0),
                specularAngle: specularAngle + dragSpecularOffset
            )
        }
    }

    private var dragSpecularOffset: Double {
        dragTiltX * 2 + dragTiltY
    }

    private func forgedMedal(
        wobbleDegrees: Double,
        wobbleAxis: (x: Double, y: Double, z: Double),
        specularAngle: Double
    ) -> some View {
        ForgedMedalView(
            displayedWeight: displayedWeight,
            accentArcProgress: accentArcProgress,
            accentRimOpacity: accentRimOpacity,
            innerBleedOpacity: innerBleedOpacity,
            numberGlowRadius: numberGlowRadius,
            specularAngle: specularAngle,
            isCharged: isCharged
        )
        .scaleEffect(medalScale)
        .rotation3DEffect(.degrees(medalFallRotationX + dragTiltX), axis: (x: 1, y: 0, z: 0), perspective: 0.55)
        .rotation3DEffect(.degrees(dragTiltY), axis: (x: 0, y: 1, z: 0), perspective: 0.55)
        .rotation3DEffect(
            .degrees(wobbleDegrees),
            axis: (x: wobbleAxis.x, y: wobbleAxis.y, z: wobbleAxis.z),
            perspective: 0.55
        )
        .gesture(medalDragGesture)
    }

    private var medalDragGesture: some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                guard hasSettled else { return }
                dragTiltX = Double(value.translation.height / 14).clamped(to: -12...12)
                dragTiltY = Double(-value.translation.width / 14).clamped(to: -12...12)
            }
            .onEnded { _ in
                withAnimation(.spring(response: 0.45, dampingFraction: 0.72)) {
                    dragTiltX = 0
                    dragTiltY = 0
                }
            }
    }

    // MARK: - Wobble Physics

    private struct WobbleState {
        var angle: Double
        var axis: (x: Double, y: Double, z: Double)
        var specularAngle: Double
    }

    private func wobbleState(at date: Date, start: Date) -> WobbleState {
        let t = date.timeIntervalSince(start)
        let duration = 1.1

        guard t >= 0, t <= duration else {
            return WobbleState(angle: 0, axis: (0, 1, 0), specularAngle: -45)
        }

        let amplitude = 12.0 * exp(-3.0 * t)
        let frequency = 3.0 + (8.0 - 3.0) * (t / duration)
        let angle = amplitude * cos(2 * .pi * frequency * t)
        let precession = t * 2.8
        let axis = (cos(precession), sin(precession), 0.0)
        let specular = -45 + sin(2 * .pi * frequency * t) * amplitude * 1.5

        return WobbleState(angle: angle, axis: axis, specularAngle: specular)
    }

    // MARK: - Choreography

    private func startEntrance() {
        if reduceMotion {
            backdropOpacity = 0.85
            plinthScale = 1
            plinthOpacity = 1
            medalOffsetY = 0
            medalScale = 1
            medalFallRotationX = 0
            displayedWeight = achievement.weight
            accentArcProgress = 1
            accentRimOpacity = 0.35
            innerBleedOpacity = 1
            isCharged = true
            hasSettled = true
            allowsTapDismiss = true
            haptics.play(reduceMotion: true)
            return
        }

        haptics.prepare()
        haptics.play(reduceMotion: false)

        withAnimation(.easeOut(duration: 0.25)) {
            backdropOpacity = 0.85
        }

        withAnimation(.easeOut(duration: 0.25)) {
            plinthScale = 1
            plinthOpacity = 1
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            allowsTapDismiss = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            withAnimation(.timingCurve(0.55, 0.0, 0.85, 0.6, duration: 0.4)) {
                medalOffsetY = 0
                medalScale = 1
                medalFallRotationX = 0
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            handleImpact()
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            startCharge()
        }
    }

    private func handleImpact() {
        withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = 3 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.07) {
            withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = -3 }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.14) {
            withAnimation(.easeInOut(duration: 0.07)) { shakeOffsetY = 0 }
        }

        withAnimation(.spring(response: 0.18, dampingFraction: 0.45)) {
            plinthDipY = 4
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.65)) {
                plinthDipY = 0
            }
        }

        dustRingOpacity = 1
        dustRingScale = 1
        withAnimation(.easeOut(duration: 0.4)) {
            dustRingScale = 1.4
            dustRingOpacity = 0
        }

        wobbleStartDate = Date()
        isWobbling = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
            isWobbling = false
            wobbleStartDate = nil
        }
    }

    private func startCharge() {
        withAnimation(.easeInOut(duration: 0.5)) {
            accentArcProgress = 1
            accentRimOpacity = 0.35
            innerBleedOpacity = 1
        }

        withAnimation(.easeOut(duration: 0.25)) {
            numberGlowRadius = 22
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            withAnimation(.easeOut(duration: 0.25)) {
                numberGlowRadius = 12
            }
        }

        animateWeightCountUp()
    }

    private func animateWeightCountUp() {
        let target = achievement.weight
        let steps = max(min(target, 30), 1)
        let stepDuration = 0.5 / Double(steps)

        for step in 0...steps {
            DispatchQueue.main.asyncAfter(deadline: .now() + stepDuration * Double(step)) {
                withAnimation(.easeOut(duration: 0.04)) {
                    displayedWeight = Int(round(Double(target) * Double(step) / Double(steps)))
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            displayedWeight = target
            isCharged = true
            hasSettled = true
        }
    }

    private func dismiss() {
        haptics.stop()

        if reduceMotion {
            onDismiss()
            return
        }

        withAnimation(.easeIn(duration: 0.28)) {
            backdropOpacity = 0
            groupOffsetY = 80
            groupScale = 0.92
            groupOpacity = 0
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            onDismiss()
        }
    }
}

// MARK: - Forged Medal

private struct ForgedMedalView: View {
    var displayedWeight: Int
    var accentArcProgress: Double
    var accentRimOpacity: Double
    var innerBleedOpacity: Double
    var numberGlowRadius: CGFloat
    var specularAngle: Double
    var isCharged: Bool

    private let diameter = ForgedLayout.medalDiameter

    var body: some View {
        ZStack {
            medalBody

            if accentRimOpacity > 0 {
                accentRimLight
            }

            engravedFace
        }
        .frame(width: diameter, height: diameter)
    }

    private var medalBody: some View {
        ZStack {
            // Outer rim — 8pt beveled ring
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.5),
                            Color.black.opacity(0.5)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 8
                )
                .frame(width: diameter, height: diameter)

            // Knurled band
            KnurledBandView(tickCount: 48, diameter: diameter - 4)
                .frame(width: diameter, height: diameter)

            // Inner face
            Circle()
                .fill(
                    RadialGradient(
                        colors: [AppColor.surface2, AppColor.surface1],
                        center: .center,
                        startRadius: 0,
                        endRadius: diameter * 0.42
                    )
                )
                .frame(width: diameter - 20, height: diameter - 20)

            // Specular blob — rotates with wobble/drag
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.10), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 50
                    )
                )
                .frame(width: 80, height: 80)
                .offset(x: -28, y: -32)
                .rotationEffect(.degrees(specularAngle))
                .frame(width: diameter - 20, height: diameter - 20)
                .clipShape(Circle())

            // Recessed groove — carved ring
            ZStack {
                Circle()
                    .stroke(Color.black.opacity(0.5), lineWidth: 1)
                    .frame(width: diameter - 36, height: diameter - 36)
                Circle()
                    .stroke(Color.white.opacity(0.10), lineWidth: 1)
                    .frame(width: diameter - 34, height: diameter - 34)
            }

            // Inner bleed — accent glow from rim inward
            if innerBleedOpacity > 0 {
                Circle()
                    .stroke(AppColor.accent.opacity(0.12 * innerBleedOpacity), lineWidth: 18)
                    .blur(radius: 14)
                    .frame(width: diameter - 24, height: diameter - 24)
                    .clipShape(Circle().inset(by: 10))
            }
        }
    }

    private var accentRimLight: some View {
        Circle()
            .trim(from: 0, to: accentArcProgress)
            .stroke(
                AppColor.accent.opacity(accentRimOpacity),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )
            .rotationEffect(.degrees(-90))
            .frame(width: diameter - 6, height: diameter - 6)
            .blur(radius: 4)
    }

    private var engravedFace: some View {
        VStack(spacing: 2) {
            Text("\(displayedWeight)")
                .font(.inter(size: weightFontSize, weight: .bold, relativeTo: .largeTitle))
                .tracking(-2)
                .foregroundStyle(AppColor.accent)
                .contentTransition(.numericText())
                .shadow(color: AppColor.accent.opacity(isCharged ? 0.55 : 0.35), radius: numberGlowRadius)

            Text("KG")
                .font(AppFont.label)
                .foregroundStyle(AppColor.secondaryText)
                .textCase(.uppercase)
                .tracking(2)
        }
    }

    private var weightFontSize: CGFloat {
        let digits = String(displayedWeight).count
        switch digits {
        case 1: return 72
        case 2: return 68
        case 3: return 58
        default: return 48
        }
    }
}

private struct KnurledBandView: View {
    var tickCount: Int
    var diameter: CGFloat

    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let radius = min(size.width, size.height) / 2 - 6

            for index in 0..<tickCount {
                let angle = (Double(index) / Double(tickCount)) * 2 * .pi - .pi / 2
                let innerR = radius - 5
                let outerR = radius - 2
                let start = CGPoint(
                    x: center.x + cos(angle) * innerR,
                    y: center.y + sin(angle) * innerR
                )
                let end = CGPoint(
                    x: center.x + cos(angle) * outerR,
                    y: center.y + sin(angle) * outerR
                )
                var path = Path()
                path.move(to: start)
                path.addLine(to: end)
                context.stroke(path, with: .color(Color.white.opacity(0.12)), lineWidth: 1)
            }
        }
        .frame(width: diameter, height: diameter)
    }
}

// MARK: - Plinth Card

private struct PlinthCardView: View {
    var achievement: Achievement
    var rendersForShare: Bool

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
                .frame(height: ForgedLayout.medalContentInset)

            Text("Achievement Unlocked")
                .font(AppFont.subheading)
                .foregroundStyle(AppColor.secondaryText)
                .textCase(.uppercase)
                .tracking(2)
                .multilineTextAlignment(.center)

            Text(achievement.exerciseName)
                .font(AppFont.h1)
                .foregroundStyle(AppColor.primaryText)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            Text(metadataLine)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.secondaryText)
                .multilineTextAlignment(.center)

            EngravedSeam()
                .padding(.vertical, 4)

            shareRow
        }
        .padding(16)
        .frame(width: ForgedLayout.cardWidth)
        .background { plinthBackground }
        .clipShape(RoundedRectangle(cornerRadius: ForgedLayout.cardRadius, style: .continuous))
        .overlay { plinthBorder }
    }

    private var metadataLine: String {
        var parts = ["\(achievement.reps) REPS", achievement.formattedDate.uppercased()]
        if let username = achievement.usernameHandle {
            parts.append(username)
        }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private var shareRow: some View {
        if rendersForShare {
            shareRowLabel
        } else {
            ShareLink(
                item: ShareCardPayload(achievement: achievement),
                preview: SharePreview("Achievement Unlocked", image: Image(systemName: "medal.fill"))
            ) {
                shareRowLabel
            }
            .buttonStyle(.plain)
        }
    }

    private var shareRowLabel: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: 16, weight: .medium))
            Text("Share with a friend")
                .font(AppFont.subheading)
            Spacer(minLength: 0)
        }
        .foregroundStyle(AppColor.secondaryText)
        .frame(maxWidth: .infinity)
    }

    private var plinthBackground: some View {
        ZStack {
            LinearGradient(
                colors: [AppColor.surface1, AppColor.surface2],
                startPoint: .top,
                endPoint: .bottom
            )

            BrushedStreaksView()
                .opacity(0.03)

            // Inner top-edge highlight
            VStack {
                LinearGradient(
                    colors: [Color.white.opacity(0.06), Color.clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 2)
                Spacer()
            }
        }
    }

    private var plinthBorder: some View {
        RoundedRectangle(cornerRadius: ForgedLayout.cardRadius, style: .continuous)
            .strokeBorder(
                LinearGradient(
                    colors: [
                        Color.white.opacity(0.4),
                        Color.black.opacity(0.5)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 1.5
            )
    }
}

private struct BrushedStreaksView: View {
    var body: some View {
        Canvas { context, size in
            for index in 0..<24 {
                let y = size.height * (Double(index) / 24.0)
                var path = Path()
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y + 0.5))
                context.stroke(path, with: .color(Color.white), lineWidth: 0.5)
            }
        }
    }
}

private struct EngravedSeam: View {
    var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Color.black.opacity(0.5))
                .frame(height: 1)
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 1)
        }
    }
}

// MARK: - Static Composition (Share / Preview)

struct ForgedAchievementComposition: View {
    var achievement: Achievement
    var rendersForShare: Bool

    var body: some View {
        ZStack(alignment: .top) {
            PlinthCardView(
                achievement: achievement,
                rendersForShare: rendersForShare
            )

            ForgedMedalView(
                displayedWeight: achievement.weight,
                accentArcProgress: 1,
                accentRimOpacity: 0.35,
                innerBleedOpacity: 1,
                numberGlowRadius: 12,
                specularAngle: -45,
                isCharged: true
            )
        }
        .frame(width: ForgedLayout.cardWidth)
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
            content: ForgedAchievementComposition(
                achievement: achievement,
                rendersForShare: true
            )
            .frame(width: ForgedLayout.cardWidth)
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

// MARK: - Achievement Helpers

private extension Achievement {
    var usernameHandle: String? {
        guard let username, !username.isEmpty else { return nil }
        return username.hasPrefix("@") ? username : "@\(username)"
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

            ForgedAchievementComposition(
                achievement: sampleAchievement,
                rendersForShare: false
            )
        }
        .previewDisplayName("Forged Medal — Settled")

        AchievementCardOverlay(
            achievement: sampleAchievement,
            onDismiss: {}
        )
        .previewDisplayName("Forged Medal — Overlay")
    }
}
#endif
