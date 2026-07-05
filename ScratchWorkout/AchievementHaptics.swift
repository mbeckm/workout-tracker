import CoreHaptics
import UIKit

final class AchievementHaptics {
    private var engine: CHHapticEngine?
    private var isSupported = CHHapticEngine.capabilitiesForHardware().supportsHaptics

    func prepare() {
        guard isSupported else { return }

        do {
            engine = try CHHapticEngine()
            engine?.stoppedHandler = { [weak self] _ in
                try? self?.engine?.start()
            }
            engine?.resetHandler = { [weak self] in
                try? self?.engine?.start()
            }
            try engine?.start()
        } catch {
            isSupported = false
        }
    }

    func release() {
        engine?.stop(completionHandler: nil)
        engine = nil
    }

    func playReduceMotionTap() {
        Haptics.tap(.medium)
    }

    func playEntranceScore() {
        guard isSupported, let engine else {
            playFallbackEntrance()
            return
        }

        do {
            let pattern = try CHHapticPattern(events: Self.entranceEvents, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            playFallbackEntrance()
        }
    }

    func playSpinTick() {
        guard isSupported, let engine else {
            Haptics.tap(.light)
            return
        }

        do {
            let event = CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.25),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                ],
                relativeTime: 0
            )
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            Haptics.tap(.light)
        }
    }

    private func playFallbackEntrance() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            Haptics.tap(.heavy)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.7) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private static var entranceEvents: [CHHapticEvent] {
        var events: [CHHapticEvent] = []

        // RISE — continuous swell through the spin (0 → 0.9s)
        events.append(
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.15),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.25)
                ],
                relativeTime: 0,
                duration: 0.9
            )
        )

        // ARRIVAL — sharp settle transient
        events.append(
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
                ],
                relativeTime: 0.9
            )
        )

        // LAP — continuous sweep following the light (0.9 → 1.7s)
        events.append(
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                ],
                relativeTime: 0.9,
                duration: 0.8
            )
        )

        // LAP bloom transient
        events.append(
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
                ],
                relativeTime: 1.7
            )
        )

        // RADIATE — decaying wave train with three peaks (1.7 → 2.9s)
        let radiatePeaks: [(time: TimeInterval, intensity: Float, sharpness: Float)] = [
            (1.75, 0.55, 0.65),
            (2.05, 0.42, 0.5),
            (2.35, 0.28, 0.35),
            (2.65, 0.14, 0.22)
        ]
        for peak in radiatePeaks {
            events.append(
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: peak.intensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: peak.sharpness)
                    ],
                    relativeTime: peak.time
                )
            )
        }

        events.append(
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.35),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.45)
                ],
                relativeTime: 1.75,
                duration: 1.15
            )
        )

        return events
    }
}
