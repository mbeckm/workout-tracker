import AVFoundation
import CoreHaptics
import ExpoModulesCore

/// Trim's device feel: named Core Haptics patterns (SPEC §8) and short sounds (SPEC §9).
/// Every call hops onto one serial queue, so the engine and players are never touched concurrently.
public class TrimDeviceModule: Module {
  private let queue = DispatchQueue(label: "trim.device", qos: .userInteractive)
  private let supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics

  private var engine: CHHapticEngine?
  private var engineNeedsStart = true
  private var patterns: [String: CHHapticPattern] = [:]
  private var continuousPlayer: CHHapticAdvancedPatternPlayer?

  private var players: [String: AVAudioPlayer] = [:]
  /// Bumped to cancel a running `print` sequence.
  private var printGeneration = 0

  public func definition() -> ModuleDefinition {
    Name("TrimDevice")

    Constant("supportsHaptics") { self.supportsHaptics }

    OnCreate {
      self.queue.async {
        self.prepareAudio()
        self.prepareHaptics()
      }
    }

    OnDestroy {
      self.queue.async {
        try? self.continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
        self.continuousPlayer = nil
        self.engine?.stop()
        self.engine = nil
        self.players.values.forEach { $0.stop() }
      }
    }

    Function("play") { (name: String) in
      self.queue.async { self.playPattern(name) }
    }

    Function("startContinuous") { (name: String) in
      self.queue.async { self.startContinuousPattern(name) }
    }

    Function("stopContinuous") {
      self.queue.async {
        try? self.continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
        self.continuousPlayer = nil
      }
    }

    Function("playSound") { (name: String) in
      self.queue.async { self.playSoundNamed(name) }
    }
  }

  // MARK: - Haptics

  private func prepareHaptics() {
    guard supportsHaptics else { return }
    patterns = Self.buildPatterns()
    _ = ensureEngine()
  }

  /// Creates the engine on first use and restarts it after the system stopped or reset it.
  private func ensureEngine() -> CHHapticEngine? {
    guard supportsHaptics else { return nil }
    if engine == nil {
      do {
        let created = try CHHapticEngine()
        created.playsHapticsOnly = true
        created.isAutoShutdownEnabled = false
        created.stoppedHandler = { [weak self] _ in
          self?.queue.async {
            self?.engineNeedsStart = true
            self?.continuousPlayer = nil
          }
        }
        created.resetHandler = { [weak self] in
          self?.queue.async {
            self?.engineNeedsStart = true
            self?.continuousPlayer = nil
            _ = self?.ensureEngine()
          }
        }
        engine = created
        engineNeedsStart = true
      } catch {
        return nil
      }
    }
    if engineNeedsStart, let engine {
      do {
        try engine.start()
        engineNeedsStart = false
      } catch {
        return nil
      }
    }
    return engine
  }

  private func playPattern(_ name: String) {
    guard let pattern = patterns[name], let engine = ensureEngine() else { return }
    do {
      try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
    } catch {
      // The engine died between start and play: start it again on the next call.
      engineNeedsStart = true
    }
  }

  private func startContinuousPattern(_ name: String) {
    guard name == "holdFinish", let engine = ensureEngine() else { return }
    try? continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
    do {
      let player = try engine.makeAdvancedPlayer(with: Self.holdFinishPattern())
      try player.start(atTime: CHHapticTimeImmediate)
      continuousPlayer = player
    } catch {
      continuousPlayer = nil
      engineNeedsStart = true
    }
  }

  private static func transient(_ time: TimeInterval, _ intensity: Float, _ sharpness: Float) -> CHHapticEvent {
    CHHapticEvent(
      eventType: .hapticTransient,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
      ],
      relativeTime: time
    )
  }

  private static func continuous(
    _ time: TimeInterval, _ intensity: Float, _ sharpness: Float, duration: TimeInterval
  ) -> CHHapticEvent {
    CHHapticEvent(
      eventType: .hapticContinuous,
      parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
      ],
      relativeTime: time,
      duration: duration
    )
  }

  /// SPEC §8, one entry per named pattern (keep in step with `HapticPattern` in index.ts).
  private static func buildPatterns() -> [String: CHHapticPattern] {
    let events: [String: [CHHapticEvent]] = [
      "wheelNotch": [transient(0, 0.5, 0.9)],
      "wheelNotchMajor": [transient(0, 0.8, 0.9)],
      "key": [transient(0, 0.6, 0.5)],
      "bigKeyPress": [transient(0, 0.9, 0.4)],
      "logSet": [transient(0, 1.0, 0.6), transient(0.04, 0.4, 0.3)],
      "rockerMove": [transient(0, 0.7, 0.8)],
      "restGo": [transient(0, 0.8, 0.5), transient(0.12, 0.8, 0.5), transient(0.24, 0.8, 0.5)],
      "finishComplete": [transient(0, 1.0, 0.3)],
      "receiptPrint": (0..<18).map { transient(Double($0) * 0.1, 0.25, 0.9) },
      "stamp": [transient(0, 0.9, 0.2)],
      "cartridgeClick": [
        transient(0, 1.0, 1.0),
        transient(0.065, 1.0, 0.2),
        continuous(0.065, 0.3, 0.1, duration: 0.08),
      ],
      "dayTick": [transient(0, 0.4, 0.7)],
      "swatch": [transient(0, 0.5, 0.6)],
    ]
    var built: [String: CHHapticPattern] = [:]
    for (name, list) in events {
      if let pattern = try? CHHapticPattern(events: list, parameters: []) {
        built[name] = pattern
      }
    }
    return built
  }

  /// Hold to finish: a continuous buzz whose intensity ramps .2 → .9 over 1.1 s, sharpness .3.
  private static func holdFinishPattern() throws -> CHHapticPattern {
    let duration: TimeInterval = 1.1
    let ramp = CHHapticParameterCurve(
      parameterID: .hapticIntensityControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.2),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration, value: 0.9),
      ],
      relativeTime: 0
    )
    return try CHHapticPattern(
      events: [continuous(0, 1.0, 0.3, duration: duration)],
      parameterCurves: [ramp]
    )
  }

  // MARK: - Sounds

  /// `print` is 18 stepper ticks 100 ms apart (one `print-tick` file), in step with the feed.
  private static let soundFiles = ["cartridge", "print-tick", "stamp", "key"]
  /// The key click is meant to be barely there (SPEC §9); the WAV itself peaks at −3 dBFS.
  private static let soundVolumes: [String: Float] = ["key": 0.3]

  private func prepareAudio() {
    // Ambient: mixes with the user's music and is silenced by the silent switch (D14).
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.ambient, options: [.mixWithOthers])
    try? session.setActive(true)
    let bundles = [Bundle(for: TrimDeviceModule.self), Bundle.main]
    for name in Self.soundFiles {
      guard
        let url = bundles.lazy.compactMap({ $0.url(forResource: name, withExtension: "wav") }).first,
        let player = try? AVAudioPlayer(contentsOf: url)
      else { continue }
      player.volume = Self.soundVolumes[name] ?? 1
      player.prepareToPlay()
      players[name] = player
    }
  }

  private func playSoundNamed(_ name: String) {
    if name == "print" {
      printGeneration += 1
      let generation = printGeneration
      for step in 0..<18 {
        queue.asyncAfter(deadline: .now() + Double(step) * 0.1) { [weak self] in
          guard let self, self.printGeneration == generation else { return }
          self.restart(self.players["print-tick"])
        }
      }
      return
    }
    restart(players[name])
  }

  private func restart(_ player: AVAudioPlayer?) {
    guard let player else { return }
    player.currentTime = 0
    player.play()
  }
}
