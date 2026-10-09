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
      Prop("phase") { (view: DeviceLaunchView, value: String) in
        view.phase = value
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

      Prop("perchTilt") { (view: DeviceLaunchView, value: [Double]) in
        view.perchTilt = value
      }
      Prop("perchTiltDuration") { (view: DeviceLaunchView, value: Double) in
        view.perchTiltDuration = value
      }
      Prop("wiggle") { (view: DeviceLaunchView, value: Double) in
        view.wiggle = value
      }
      Prop("wiggleTilts") { (view: DeviceLaunchView, value: [Double]) in
        view.wiggleTilts = value
      }
      Prop("wiggleDuration") { (view: DeviceLaunchView, value: Double) in
        view.wiggleDuration = value
      }
      Prop("settleDuration") { (view: DeviceLaunchView, value: Double) in
        view.settleDuration = value
      }
      Prop("displayCurve") { (view: DeviceLaunchView, value: [Double]) in
        view.displayCurve = value
      }

      OnViewDidUpdateProps { (view: DeviceLaunchView) in
        view.propsDidUpdate()
      }
    }
  }
}
