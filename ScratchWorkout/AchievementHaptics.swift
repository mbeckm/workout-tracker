import CoreHaptics
import UIKit

@MainActor
final class AchievementHaptics {
    private var engine: CHHapticEngine?
    private let supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics

    func prepare() {
        guard supportsHaptics, engine == nil else { return }

        do {
            let engine = try CHHapticEngine()
            engine.resetHandler = { [weak self] in
                Task { @MainActor in
                    try? self?.engine?.start()
                }
            }
            engine.stoppedHandler = { [weak self] reason in
                if reason == .audioSessionInterrupt {
                    Task { @MainActor in
                        try? self?.engine?.start()
                    }
                }
            }
            try engine.start()
            self.engine = engine
        } catch {
            self.engine = nil
        }
    }

    func playAnticipation() {
        guard let engine else {
            return
        }

        do {
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.2)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
            let event = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [intensity, sharpness],
                relativeTime: 0,
                duration: 0.35
            )

            let curve = CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.2),
                    .init(relativeTime: 0.35, value: 0.75)
                ],
                relativeTime: 0
            )

            let pattern = try CHHapticPattern(events: [event], parameterCurves: [curve])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            // Fall through to UIKit fallback at impact.
        }
    }

    func playImpactScore(onFillComplete: @escaping () -> Void) {
        if supportsHaptics, let engine {
            playCoreHapticScore(engine: engine, onFillComplete: onFillComplete)
        } else {
            playUIKitFallback(onFillComplete: onFillComplete)
        }
    }

    func playReduceMotionTap() {
        Haptics.tap(.medium)
    }

    func stop() {
        engine?.stop(completionHandler: nil)
        engine = nil
    }

    private func playCoreHapticScore(engine: CHHapticEngine, onFillComplete: @escaping () -> Void) {
        do {
            var events: [CHHapticEvent] = []

            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
                ],
                relativeTime: 0
            ))

            events.append(CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.55),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.7)
                ],
                relativeTime: 0.06
            ))

            let radiateIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.75)
            let radiateSharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
            events.append(CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [radiateIntensity, radiateSharpness],
                relativeTime: 0.15,
                duration: 1.4
            ))

            let tickIntensities: [Float] = [0.3, 0.25, 0.2, 0.15]
            for (index, intensity) in tickIntensities.enumerated() {
                events.append(CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                    ],
                    relativeTime: Double(index) * 0.175
                ))
            }

            let radiateIntensityCurve = CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.75),
                    .init(relativeTime: 0.15, value: 0.35),
                    .init(relativeTime: 0.3, value: 0.75),
                    .init(relativeTime: 0.45, value: 0.3),
                    .init(relativeTime: 0.65, value: 0.6),
                    .init(relativeTime: 0.8, value: 0.25),
                    .init(relativeTime: 1.0, value: 0.5),
                    .init(relativeTime: 1.15, value: 0.2),
                    .init(relativeTime: 1.4, value: 0.15)
                ],
                relativeTime: 0.15
            )

            let radiateSharpnessCurve = CHHapticParameterCurve(
                parameterID: .hapticSharpnessControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.8),
                    .init(relativeTime: 1.4, value: 0.2)
                ],
                relativeTime: 0.15
            )

            let pattern = try CHHapticPattern(
                events: events,
                parameterCurves: [radiateIntensityCurve, radiateSharpnessCurve]
            )
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                onFillComplete()
            }
        } catch {
            playUIKitFallback(onFillComplete: onFillComplete)
        }
    }

    private func playUIKitFallback(onFillComplete: @escaping () -> Void) {
        Haptics.tap(.heavy)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.06) {
            Haptics.tap(.medium)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onFillComplete()
        }
    }
}
