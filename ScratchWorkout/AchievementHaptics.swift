import CoreHaptics
import UIKit

@MainActor
final class AchievementHaptics {
    private var engine: CHHapticEngine?
    private var supportsHaptics: Bool
    private var isPlaying = false

    init() {
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    func prepare() {
        guard supportsHaptics else { return }

        do {
            engine = try CHHapticEngine()
            engine?.resetHandler = { [weak self] in
                Task { @MainActor in
                    try? self?.engine?.start()
                }
            }
            engine?.stoppedHandler = { [weak self] _ in
                Task { @MainActor in
                    try? self?.engine?.start()
                }
            }
            try engine?.start()
        } catch {
            supportsHaptics = false
            engine = nil
        }
    }

    func play(reduceMotion: Bool) {
        if reduceMotion {
            Haptics.tap(.medium)
            return
        }

        guard supportsHaptics, let engine else {
            playFallback()
            return
        }

        do {
            let pattern = try buildPattern()
            let player = try engine.makePlayer(with: pattern)
            isPlaying = true
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            playFallback()
        }
    }

    func stop() {
        isPlaying = false
        engine?.stop(completionHandler: nil)
    }

    private func playFallback() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            Haptics.tap(.heavy)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func buildPattern() throws -> CHHapticPattern {
        var events: [CHHapticEvent] = []

        // 1. Fall — continuous ramp t=0.1→0.5s
        let fall = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.15),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.4)
            ],
            relativeTime: 0.1,
            duration: 0.4
        )
        events.append(fall)

        // 2. Slam — impact transient
        events.append(transient(at: 0.5, intensity: 1.0, sharpness: 1.0))
        // Plinth dip — 80ms later
        events.append(transient(at: 0.58, intensity: 0.5, sharpness: 0.8))

        // 3. Wobble — 8 decaying transients, spacing shrinks
        let wobbleTimes: [TimeInterval] = [0.50, 0.68, 0.83, 0.95, 1.04, 1.11, 1.16, 1.20]
        let wobbleIntensities: [Float] = [0.50, 0.44, 0.38, 0.32, 0.26, 0.20, 0.15, 0.10]
        for index in 0..<8 {
            events.append(
                transient(
                    at: wobbleTimes[index],
                    intensity: wobbleIntensities[index],
                    sharpness: 0.6
                )
            )
        }

        // 4. Charge — continuous arc sweep t=1.6→2.1s
        let charge = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.35),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
            ],
            relativeTime: 1.6,
            duration: 0.5
        )
        events.append(charge)
        events.append(transient(at: 2.1, intensity: 0.7, sharpness: 1.0))

        // 5. Afterglow — fade with soft pulses starting +1s after charge (t=3.1)
        let afterglow = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.3),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
            ],
            relativeTime: 3.1,
            duration: 1.2
        )
        events.append(afterglow)
        events.append(transient(at: 3.5, intensity: 0.15, sharpness: 0.1))
        events.append(transient(at: 3.9, intensity: 0.08, sharpness: 0.05))

        var curves: [CHHapticParameterCurve] = []

        // Fall intensity ramp 0.15→0.7
        curves.append(
            CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0.1, value: 0.15),
                    .init(relativeTime: 0.5, value: 0.7)
                ],
                relativeTime: 0
            )
        )

        // Charge sharpness 0.9→0.5
        curves.append(
            CHHapticParameterCurve(
                parameterID: .hapticSharpnessControl,
                controlPoints: [
                    .init(relativeTime: 1.6, value: 0.9),
                    .init(relativeTime: 2.1, value: 0.5)
                ],
                relativeTime: 0
            )
        )

        // Afterglow fade 0.3→0
        curves.append(
            CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 3.1, value: 0.3),
                    .init(relativeTime: 4.3, value: 0)
                ],
                relativeTime: 0
            )
        )

        return try CHHapticPattern(events: events, parameterCurves: curves)
    }

    private func transient(at time: TimeInterval, intensity: Float, sharpness: Float) -> CHHapticEvent {
        CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
            ],
            relativeTime: time
        )
    }
}
