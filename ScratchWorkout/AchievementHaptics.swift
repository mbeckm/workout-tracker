import CoreHaptics
import UIKit

@MainActor
final class AchievementHaptics {
    private var engine: CHHapticEngine?
    private var supportsHaptics = false
    private(set) var isReady = false

    func prepare() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            supportsHaptics = false
            isReady = false
            return
        }

        do {
            engine = try CHHapticEngine()
            engine?.resetHandler = { [weak self] in
                Task { @MainActor in
                    try? self?.engine?.start()
                }
            }
            engine?.stoppedHandler = { _ in }
            try engine?.start()
            supportsHaptics = true
            isReady = true
        } catch {
            supportsHaptics = false
            isReady = false
        }
    }

    func release() {
        engine?.stop(completionHandler: nil)
        engine = nil
        supportsHaptics = false
        isReady = false
    }

    func playEntrance(reduceMotion: Bool) {
        if reduceMotion {
            Haptics.tap(.medium)
            return
        }

        guard supportsHaptics, let engine else {
            return
        }

        playPattern(on: engine) {
            let intensity = CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.1),
                    .init(relativeTime: 0.9, value: 0.45)
                ],
                relativeTime: 0
            )
            let sharpness = CHHapticParameterCurve(
                parameterID: .hapticSharpnessControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.3),
                    .init(relativeTime: 0.9, value: 0.3)
                ],
                relativeTime: 0
            )
            let rise = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [],
                relativeTime: 0,
                duration: 0.9
            )
            return (events: [rise], curves: [intensity, sharpness])
        }
    }

    func playSettle(fallback: Bool = false) {
        if fallback || !supportsHaptics {
            Haptics.tap(.medium)
            return
        }

        guard let engine else { return }

        playPattern(on: engine) {
            let settle = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
                ],
                relativeTime: 0
            )
            return (events: [settle], curves: [])
        }
    }

    func playPass(fallback: Bool = false) {
        if fallback || !supportsHaptics {
            return
        }

        guard let engine else { return }

        playPattern(on: engine) {
            let intensity = CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.1),
                    .init(relativeTime: 0.225, value: 0.4),
                    .init(relativeTime: 0.45, value: 0.1)
                ],
                relativeTime: 0
            )
            let sharpness = CHHapticParameterCurve(
                parameterID: .hapticSharpnessControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.8),
                    .init(relativeTime: 0.45, value: 0.8)
                ],
                relativeTime: 0
            )
            let pass = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [],
                relativeTime: 0,
                duration: 0.45
            )
            return (events: [pass], curves: [intensity, sharpness])
        }
    }

    func playLockAndBloom(fallback: Bool = false) {
        if fallback || !supportsHaptics {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return
        }

        guard let engine else { return }

        playPattern(on: engine) {
            let lock = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ],
                relativeTime: 0
            )
            let afterglowIntensity = CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.5),
                    .init(relativeTime: 0.3, value: 0.25),
                    .init(relativeTime: 0.6, value: 0)
                ],
                relativeTime: 0.05
            )
            let afterglow = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [],
                relativeTime: 0.05,
                duration: 0.6
            )
            let pulse = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.25),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
                ],
                relativeTime: 0.35
            )
            return (events: [lock, afterglow, pulse], curves: [afterglowIntensity])
        }
    }

    private func playPattern(
        on engine: CHHapticEngine,
        build: () -> (events: [CHHapticEvent], curves: [CHHapticParameterCurve])
    ) {
        let pattern = build()
        do {
            let hapticPattern = try CHHapticPattern(events: pattern.events, parameterCurves: pattern.curves)
            let player = try engine.makePlayer(with: hapticPattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            // Silent fallback — caller handles UIKit feedback when needed.
        }
    }
}
