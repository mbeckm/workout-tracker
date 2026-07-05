import CoreHaptics
import UIKit

@MainActor
final class AchievementCardHaptics {
    private var engine: CHHapticEngine?
    private let supportsHaptics: Bool
    private let reduceMotion: Bool

    private var usesFallback: Bool {
        !supportsHaptics
    }

    init(reduceMotion: Bool) {
        self.reduceMotion = reduceMotion
        supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        guard supportsHaptics else { return }
        configureEngine()
    }

    func prepare() {
        guard supportsHaptics else { return }
        try? engine?.start()
    }

    func release() {
        engine?.stop(completionHandler: nil)
        engine = nil
    }

    func playReduceMotionEntrance() {
        Haptics.tap(.medium)
    }

    func playRise() {
        guard !reduceMotion else { return }
        guard !usesFallback else { return }

        let event = CHHapticEvent(
            eventType: .hapticContinuous,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.1),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
            ],
            relativeTime: 0,
            duration: 0.9
        )

        let intensityCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                .init(relativeTime: 0, value: 0.1),
                .init(relativeTime: 0.9, value: 0.45)
            ],
            relativeTime: 0
        )

        playPattern(events: [event], parameterCurves: [intensityCurve])
    }

    func playSettle() {
        guard !reduceMotion else { return }

        if usesFallback {
            Haptics.tap(.medium)
            return
        }

        let event = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
            ],
            relativeTime: 0
        )

        playPattern(events: [event], parameterCurves: [])
    }

    func playCharge() {
        guard !reduceMotion else { return }

        if usesFallback {
            return
        }

        var events: [CHHapticEvent] = [
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.2),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
                ],
                relativeTime: 0,
                duration: 0.7
            )
        ]

        for tickTime in [0.175, 0.35, 0.525] {
            events.append(
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.2),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                    ],
                    relativeTime: tickTime
                )
            )
        }

        let intensityCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                .init(relativeTime: 0, value: 0.2),
                .init(relativeTime: 0.7, value: 0.7)
            ],
            relativeTime: 0
        )

        let sharpnessCurve = CHHapticParameterCurve(
            parameterID: .hapticSharpnessControl,
            controlPoints: [
                .init(relativeTime: 0, value: 0.3),
                .init(relativeTime: 0.7, value: 0.9)
            ],
            relativeTime: 0
        )

        playPattern(events: events, parameterCurves: [intensityCurve, sharpnessCurve])
    }

    func playStamp() {
        guard !reduceMotion else { return }

        if usesFallback {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return
        }

        let events: [CHHapticEvent] = [
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
                ],
                relativeTime: 0
            ),
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.4),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
                ],
                relativeTime: 0.02,
                duration: 0.5
            ),
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.25),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.15)
                ],
                relativeTime: 0.18
            )
        ]

        let afterglowCurve = CHHapticParameterCurve(
            parameterID: .hapticIntensityControl,
            controlPoints: [
                .init(relativeTime: 0, value: 0.4),
                .init(relativeTime: 0.5, value: 0)
            ],
            relativeTime: 0.02
        )

        playPattern(events: events, parameterCurves: [afterglowCurve])
    }

    private func configureEngine() {
        do {
            engine = try CHHapticEngine()
            engine?.playsHapticsOnly = true
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
            engine = nil
        }
    }

    private func playPattern(events: [CHHapticEvent], parameterCurves: [CHHapticParameterCurve]) {
        guard let engine else { return }

        do {
            let pattern = try CHHapticPattern(events: events, parameterCurves: parameterCurves)
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            // Haptic playback is best-effort; UI animation continues unaffected.
        }
    }
}
