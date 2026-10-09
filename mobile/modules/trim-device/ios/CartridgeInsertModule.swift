import ExpoModulesCore

/// The native plan activation moment (`CartridgeInsertView`). JS: `CartridgeInsert` in
/// modules/trim-device/cartridge-insert.tsx.
public class CartridgeInsertModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrimCartridgeInsert")

    View(CartridgeInsertView.self) {
      Events("onSceneReady", "onSeated", "onFinished")

      Prop("finish") { (view: CartridgeInsertView, value: String) in
        view.finish = value
      }
      Prop("screen") { (view: CartridgeInsertView, value: [String: String]?) in
        view.screen = InsertScreen(value)
      }
      Prop("planName") { (view: CartridgeInsertView, value: String) in
        view.planName = value
      }
      Prop("days") { (view: CartridgeInsertView, value: [String]) in
        view.days = value
      }
      Prop("playing") { (view: CartridgeInsertView, value: Bool) in
        view.playing = value
      }
      Prop("reduceMotion") { (view: CartridgeInsertView, value: Bool) in
        view.reduceMotion = value
      }
      Prop("soundsOn") { (view: CartridgeInsertView, value: Bool?) in
        view.soundsOn = value ?? true
      }
      Prop("safeTop") { (view: CartridgeInsertView, value: Double?) in
        view.safeTop = CGFloat(value ?? 47)
      }
      Prop("safeBottom") { (view: CartridgeInsertView, value: Double?) in
        view.safeBottom = CGFloat(value ?? 34)
      }
      Prop("deviceLayout") { (view: CartridgeInsertView, value: [String: Double]?) in
        view.layoutOverride = InsertLayoutOverride(
          topRowY: value?["topRowY"].map { CGFloat($0) },
          displayY: value?["displayY"].map { CGFloat($0) },
          displayHeight: value?["displayHeight"].map { CGFloat($0) },
          wellY: value?["wellY"].map { CGFloat($0) })
      }
      Prop("pauseAt") { (view: CartridgeInsertView, value: Double?) in
        view.pauseAt = value
      }
      Prop("speed") { (view: CartridgeInsertView, value: Double?) in
        view.speed = value ?? 1
      }

      OnViewDidUpdateProps { (view: CartridgeInsertView) in
        view.propsDidUpdate()
      }
    }
  }
}
