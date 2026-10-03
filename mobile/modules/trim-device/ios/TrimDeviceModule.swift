import ExpoModulesCore

/// JS access to the device feel (`TrimDeviceFeel`): named haptics and sounds.
public class TrimDeviceModule: Module {
  private let feel = TrimDeviceFeel.shared

  public func definition() -> ModuleDefinition {
    Name("TrimDevice")

    Constant("supportsHaptics") { self.feel.hapticsSupported }

    OnCreate {
      self.feel.prepare()
    }

    OnDestroy {
      self.feel.tearDown()
    }

    Function("play") { (name: String) in
      self.feel.play(name)
    }

    Function("startContinuous") { (name: String) in
      self.feel.startContinuous(name)
    }

    Function("stopContinuous") {
      self.feel.stopContinuous()
    }

    Function("playSound") { (name: String) in
      self.feel.playSound(name)
    }
  }
}
