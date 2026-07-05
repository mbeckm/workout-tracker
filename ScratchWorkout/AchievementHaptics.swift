import CoreHaptics
import UIKit

@MainActor
final class AchievementHaptics {
    static let shared = AchievementHaptics()

    private var engine: CHHapticEngine?
    private var supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var usesFallback = true

    private init() {}

    func prepare() {
        guard supportsHaptics else {
            usesFallback = true
            return
        }

        do {
            let engine = try CHHapticEngine()
            engine.resetHandler = { [weak self] in
                Task { @MainActor in
                    self?.restartEngine()
                }
            }
            engine.stoppedHandler = { [weak self] reason in
                Task { @MainActor in
                    switch reason {
                    case .gameControllerDisconnect, .systemError:
                        self?.restartEngine()
                    default:
                        break
                    }
                }
            }
            try engine.start()
            self.engine = engine
            usesFallback = false
        } catch {
            usesFallback = true
        }
    }

    func release() {
        engine?.stop(completionHandler: nil)
        engine = nil
        usesFallback = true
    }

    func playRise() {
        guard playPattern(named: "rise", events: riseEvents(), curves: riseCurves()) else {
            return
        }
    }

    func playSettle() {
        if usesFallback {
            Haptics.tap(.medium)
            return
        }

        _ = playPattern(
            named: "settle",
            events: [
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)
                    ],
                    relativeTime: 0
                )
            ]
        )
    }

    func playStaggerTick() {
        if usesFallback {
            return
        }

        _ = playPattern(
            named: "staggerTick",
            events: [
                CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.15),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
                    ],
                    relativeTime: 0
                )
            ]
        )
    }

    func playLock() {
        if usesFallback {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return
        }

        _ = playPattern(named: "lock", events: lockEvents(), curves: lockCurves())
    }

    func playReduceMotionFallback() {
        Haptics.tap(.medium)
    }

    private func restartEngine() {
        do {
            try engine?.start()
        } catch {
            usesFallback = true
        }
    }

    @discardableResult
    private func playPattern(
        named name: String,
        events: [CHHapticEvent],
        curves: [CHHapticParameterCurve] = []
    ) -> Bool {
        guard !usesFallback, let engine else {
            return false
        }

        do {
            let pattern = try CHHapticPattern(events: events, parameterCurves: curves)
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
            return true
        } catch {
            usesFallback = true
            return false
        }
    }

    private func riseEvents() -> [CHHapticEvent] {
        [
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.3)
                ],
                relativeTime: 0,
                duration: 0.9
            )
        ]
    }

    private func riseCurves() -> [CHHapticParameterCurve] {
        [
            CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.1),
                    .init(relativeTime: 0.9, value: 0.45)
                ],
                relativeTime: 0
            )
        ]
    }

    private func lockEvents() -> [CHHapticEvent] {
        [
            CHHapticEvent(
                eventType: .hapticTransient,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.9),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
                ],
                relativeTime: 0
            ),
            CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.2)
                ],
                relativeTime: 0.02,
                duration: 0.4
            )
        ]
    }

    private func lockCurves() -> [CHHapticParameterCurve] {
        [
            CHHapticParameterCurve(
                parameterID: .hapticIntensityControl,
                controlPoints: [
                    .init(relativeTime: 0, value: 0.3),
                    .init(relativeTime: 0.4, value: 0)
                ],
                relativeTime: 0.02
            )
        ]
    }
}
