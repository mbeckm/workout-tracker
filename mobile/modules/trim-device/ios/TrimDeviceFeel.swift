import AVFoundation
import CoreHaptics

/// Trim's device feel: named Core Haptics patterns (SPEC §8) and short sounds (SPEC §9).
/// Shared by the `TrimDevice` module (JS calls) and native views (the cartridge insert plays its
/// click exactly at the seat). Every call hops onto one serial queue, so the engine and players
/// are never touched concurrently; that confinement is why this is `@unchecked Sendable`.
final class TrimDeviceFeel: @unchecked Sendable {
  static let shared = TrimDeviceFeel()

  private let queue = DispatchQueue(label: "trim.device", qos: .userInteractive)
  private let supportsHaptics = CHHapticEngine.capabilitiesForHardware().supportsHaptics

  private var engine: CHHapticEngine?
  private var engineNeedsStart = true
  private var patterns: [String: CHHapticPattern] = [:]
  private var continuousPlayer: CHHapticAdvancedPatternPlayer?

  private var players: [String: AVAudioPlayer] = [:]
  /// Bumped to cancel a running `print` sequence.
  private var printGeneration = 0

  /// Set once the players and patterns are loaded; `tearDown` clears it.
  private var prepared = false

  private init() {}

  var hapticsSupported: Bool { supportsHaptics }

  /// Loads sounds and patterns. Safe to call more than once (the module and the insert view both do).
  func prepare() {
    queue.async {
      guard !self.prepared else { return }
      self.prepared = true
      self.prepareAudio()
      self.prepareHaptics()
    }
  }

  func tearDown() {
    queue.async {
      try? self.continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
      self.continuousPlayer = nil
      self.engine?.stop()
      self.engine = nil
      self.players.values.forEach { $0.stop() }
      self.prepared = false
    }
  }

  func play(_ name: String) {
    queue.async { self.playPattern(name) }
  }

  func startContinuous(_ name: String) {
    queue.async { self.startContinuousPattern(name) }
  }

  func stopContinuous() {
    queue.async {
      try? self.continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
      self.continuousPlayer = nil
    }
  }

  func playSound(_ name: String) {
    queue.async { self.playSoundNamed(name) }
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
    guard let engine = ensureEngine() else { return }
    let build: () throws -> CHHapticPattern
    switch name {
    case "holdFinish": build = Self.holdFinishPattern
    case "assemblyCharge": build = Self.assemblyChargePattern
    case "assemblyApproach": build = Self.assemblyApproachPattern
    default: return
    }
    try? continuousPlayer?.stop(atTime: CHHapticTimeImmediate)
    do {
      let player = try engine.makeAdvancedPlayer(with: build())
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
      "wheelNotch": [transient(0, 0.7, 0.9)],
      "wheelNotchMajor": [transient(0, 1.0, 0.9)],
      "key": [transient(0, 0.85, 0.6)],
      "bigKeyPress": [transient(0, 1.0, 0.45), transient(0.03, 0.5, 0.2)],
      "logSet": [transient(0, 1.0, 0.6), transient(0.04, 0.4, 0.3)],
      "rockerMove": [transient(0, 0.9, 0.8)],
      "restGo": [transient(0, 0.8, 0.5), transient(0.12, 0.8, 0.5), transient(0.24, 0.8, 0.5)],
      "finishComplete": [transient(0, 1.0, 0.3)],
      "receiptPrint": (0..<18).map { transient(Double($0) * 0.1, 0.25, 0.9) },
      "stamp": [transient(0, 0.9, 0.2)],
      "cartridgeClick": [
        transient(0, 1.0, 1.0),
        transient(0.065, 1.0, 0.2),
        continuous(0.065, 0.3, 0.1, duration: 0.08),
      ],
      "dayTick": [transient(0, 0.6, 0.7)],
      "swatch": [transient(0, 0.8, 0.6), transient(0.025, 0.35, 0.3)],
      // The wheel hits 2 or 6 days in onboarding: a dull, heavy end stop.
      "wheelStop": [transient(0, 0.9, 0.1), transient(0.05, 0.35, 0.1)],
      // First open: a part snaps onto the body (latch, then a softer seat).
      "assemblySnap": [transient(0, 1.0, 0.9), transient(0.018, 0.6, 0.4)],
      // First open: the body settles after floating in.
      "assemblyArrive": [transient(0, 1.0, 0.25), transient(0.04, 0.5, 0.2)],
      // First open: the Start key slams home. A hard hit, a short body of rumble, two aftershocks.
      "assemblyBang": [
        transient(0, 1.0, 0.2),
        transient(0.01, 1.0, 1.0),
        continuous(0, 1.0, 0.1, duration: 0.45),
        transient(0.12, 0.7, 0.3),
        transient(0.22, 0.5, 0.3),
        transient(0.34, 0.35, 0.3),
        transient(0.48, 0.2, 0.3),
      ],
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

  /// First open: the rumble while the Start key charges, .2 → 1.0 over 1.2 s, getting sharper,
  /// with ticks that come faster and harder. It runs out right as the key slams (`assemblyBang`).
  private static func assemblyChargePattern() throws -> CHHapticPattern {
    let duration: TimeInterval = 1.2
    var events = [continuous(0, 1.0, 0.2, duration: duration)]
    var t: TimeInterval = 0
    var step: TimeInterval = 0.14
    while t < duration - 0.05 {
      events.append(transient(t, Float(0.3 + 0.7 * t / duration), 0.7))
      t += step
      step = max(0.045, step * 0.86)
    }
    let intensity = CHHapticParameterCurve(
      parameterID: .hapticIntensityControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.2),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration, value: 1.0),
      ],
      relativeTime: 0
    )
    let sharpness = CHHapticParameterCurve(
      parameterID: .hapticSharpnessControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: -0.2),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration, value: 0.5),
      ],
      relativeTime: 0
    )
    return try CHHapticPattern(events: events, parameterCurves: [intensity, sharpness])
  }

  /// First open: the body approaching out of the dark, a deep swell .05 → .7 over 1.5 s that
  /// hands over to `assemblyArrive`.
  private static func assemblyApproachPattern() throws -> CHHapticPattern {
    let duration: TimeInterval = 1.5
    let intensity = CHHapticParameterCurve(
      parameterID: .hapticIntensityControl,
      controlPoints: [
        CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 0.05),
        CHHapticParameterCurve.ControlPoint(relativeTime: duration, value: 0.7),
      ],
      relativeTime: 0
    )
    return try CHHapticPattern(
      events: [continuous(0, 1.0, 0.05, duration: duration)],
      parameterCurves: [intensity]
    )
  }

  // MARK: - Sounds

  /// `print` is 18 stepper ticks 100 ms apart (one `print-tick` file), in step with the feed.
  private static let soundFiles = [
    "cartridge", "print-tick", "stamp", "key",
    // First open (D74).
    "arrive", "charge", "bang", "boot",
    // Keys, wheel, rocker, swatches (feel pass).
    "press", "rocker", "notch", "swatch",
    "snap-1", "snap-2", "snap-3", "snap-4", "snap-5", "snap-6", "snap-7",
  ]
  /// The key click is meant to be barely there (SPEC §9); every WAV itself peaks at −3 dBFS.
  /// First open: the bang is the loudest thing in the scene, everything before it builds to it.
  private static let soundVolumes: [String: Float] = [
    "key": 0.55, "press": 0.7, "rocker": 0.5, "notch": 0.35, "swatch": 0.6,
    "arrive": 0.6, "charge": 0.65, "boot": 0.45,
    "snap-1": 0.5, "snap-2": 0.5, "snap-3": 0.5, "snap-4": 0.5, "snap-5": 0.5, "snap-6": 0.5, "snap-7": 0.5,
  ]

  private func prepareAudio() {
    // Ambient: mixes with the user's music and is silenced by the silent switch (D14).
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.ambient, options: [.mixWithOthers])
    try? session.setActive(true)
    let bundles = [Bundle(for: TrimDeviceFeel.self), Bundle.main]
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
