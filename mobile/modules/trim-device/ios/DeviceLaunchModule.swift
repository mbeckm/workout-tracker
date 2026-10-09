import ExpoModulesCore

/// The tour's launch in 3D (`DeviceLaunchView`). JS: `DeviceLaunch` in
/// modules/trim-device/device-launch.tsx.
public class DeviceLaunchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrimDeviceLaunch")

    View(DeviceLaunchView.self) {
      Events("onSceneReady")

      Prop("finish") { (view: DeviceLaunchView, value: String) in
        view.finish = value
      }
      Prop("playing") { (view: DeviceLaunchView, value: Bool) in
        view.playing = value
      }
      Prop("duration") { (view: DeviceLaunchView, value: Double) in
        view.duration = value
      }
      Prop("pose") { (view: DeviceLaunchView, value: [[String: Double]]) in
        view.pose = value
      }
      Prop("curves") { (view: DeviceLaunchView, value: [[Double]]) in
        view.curves = value
      }
      Prop("poseHeight") { (view: DeviceLaunchView, value: Double) in
        view.poseHeight = value
      }
      Prop("depth") { (view: DeviceLaunchView, value: Double) in
        view.depth = value
      }
      Prop("bodyRadius") { (view: DeviceLaunchView, value: Double) in
        view.bodyRadius = value
      }

      OnViewDidUpdateProps { (view: DeviceLaunchView) in
        view.propsDidUpdate()
      }
    }
  }
}
