import ExpoModulesCore
import QuartzCore
import SceneKit
import UIKit

/// The tour's launch (decision 85) in 3D: the same extruded body as the cartridge insert
/// (`InsertGeometry.slab`, 44 pt deep, the chamfer and the finish's sides), thrown up, spun and
/// landed on the pose keyframes from `TOUR_POSE` in src/motion.ts.
///
/// The view wraps the JS device. Idle it draws nothing of its own. On `playing` it photographs
/// its children face-on (the device as it is right now) for the slab's face, then plays the pose
/// on its own clock. A new `finish` re-photographs the children for the face and redraws the
/// sides and back: the tour swaps the finish while the device is edge-on. The JS device hides
/// itself on `onSceneReady` and takes over again, face-on, once `playing` goes false.
final class DeviceLaunchView: ExpoView {
  let onSceneReady = EventDispatcher()

  // MARK: Props

  var finish = "212"
  var playing = false
  var duration: Double = 4800
  /// `[{ at, y, sx, sy, turn }]`, `at` 0–1 of `duration`, `y` on a `poseHeight`-tall screen.
  var pose: [[String: Double]] = []
  /// One `[x1, y1, x2, y2]` cubic-bezier per segment of `pose`.
  var curves: [[Double]] = []
  var poseHeight: Double = 844
  var depth: Double = 44
  var bodyRadius: Double = 52

  // MARK: State

  private var phase = Phase.idle
  private enum Phase { case idle, running, finished }
  private var startTime: CFTimeInterval = 0
  private var link: CADisplayLink?
  private var shownFinish = ""
  private var readySent = false

  private var scnView: SCNView?
  private let scene = SCNScene()
  private let camera = SCNCamera()
  private let cameraNode = SCNNode()
  private let deviceNode = SCNNode()
  private var bodyNode = SCNNode()
  private var builtSize = CGSize.zero

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    camera.zNear = 10
    camera.zFar = 8000
    camera.projectionDirection = .vertical
    cameraNode.camera = camera
    scene.rootNode.addChildNode(cameraNode)
    scene.rootNode.addChildNode(deviceNode)
    scene.background.contents = UIColor.clear
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    guard let scnView else { return }
    scnView.frame = bounds
    bringSubviewToFront(scnView)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil { stopLink() } else if phase == .running { startLink() }
  }

  func propsDidUpdate() {
    if playing {
      if phase == .idle {
        start()
      } else if finish != shownFinish {
        // After this mount transaction: the children wear the new finish by then.
        DispatchQueue.main.async { [weak self] in self?.redress() }
      }
    } else if phase != .idle {
      stop()
    }
  }

  // MARK: Control

  private func start() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    phase = .running
    readySent = false
    let view = ensureSceneView()
    build(face: photographChildren())
    shownFinish = finish
    startTime = CACurrentMediaTime()
    apply(0)
    view.isHidden = false
    view.rendersContinuously = true
    startLink()
    // The first frame is in on the next display refresh: then the JS device can hide.
    DispatchQueue.main.async { [weak self] in
      guard let self, self.phase != .idle, !self.readySent else { return }
      self.readySent = true
      self.onSceneReady([:])
    }
  }

  private func stop() {
    stopLink()
    phase = .idle
    scnView?.rendersContinuously = false
    scnView?.isHidden = true
    bodyNode.removeFromParentNode()
  }

  private func redress() {
    guard phase != .idle, finish != shownFinish else { return }
    shownFinish = finish
    applyMaterials(face: photographChildren())
  }

  private func ensureSceneView() -> SCNView {
    if let scnView { return scnView }
    let view = SCNView(frame: bounds)
    view.backgroundColor = .clear
    view.isOpaque = false
    view.antialiasingMode = .multisampling4X
    view.preferredFramesPerSecond = 120
    view.isUserInteractionEnabled = false
    view.scene = scene
    view.isHidden = true
    addSubview(view)
    scnView = view
    return view
  }

  // MARK: Clock

  private func startLink() {
    guard link == nil else { return }
    let l = CADisplayLink(target: LaunchLinkProxy(self), selector: #selector(LaunchLinkProxy.tick))
    l.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
    l.add(to: .main, forMode: .common)
    link = l
  }

  private func stopLink() {
    link?.invalidate()
    link = nil
  }

  fileprivate func tick() {
    guard phase == .running else { return stopLink() }
    let t = (CACurrentMediaTime() - startTime) * 1000
    apply(min(t, duration))
    if t >= duration {
      // Hold the landing frame until JS takes over (`playing` → false).
      phase = .finished
      stopLink()
      scnView?.rendersContinuously = false
    }
  }

  // MARK: Building

  /// The children face-on and untransformed, at screen scale. Each child layer is drawn on its
  /// own, so the wrapper's opacity and transform (the JS device hides and moves itself) don't
  /// count, and a child that is transparent right now (the 2D launch's back) is left out.
  private func photographChildren() -> UIImage {
    let size = bounds.size
    let format = UIGraphicsImageRendererFormat()
    format.scale = max(traitCollection.displayScale, 2)
    format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { context in
      let ctx = context.cgContext
      for child in subviews where child !== scnView {
        // Not `frame`: mid-flight the child is scaled, and its frame is the scaled box.
        let origin = Self.untransformedOrigin(child.layer)
        for sub in child.layer.sublayers ?? [] {
          guard !sub.isHidden, sub.opacity > 0.01 else { continue }
          let subOrigin = Self.untransformedOrigin(sub)
          ctx.saveGState()
          ctx.translateBy(x: origin.x + subOrigin.x, y: origin.y + subOrigin.y)
          ctx.setAlpha(CGFloat(sub.opacity))
          sub.render(in: ctx)
          ctx.restoreGState()
        }
      }
    }
  }

  /// Where a layer's bounds start in its parent, ignoring its own transform.
  private static func untransformedOrigin(_ layer: CALayer) -> CGPoint {
    CGPoint(
      x: layer.position.x - layer.bounds.width * layer.anchorPoint.x,
      y: layer.position.y - layer.bounds.height * layer.anchorPoint.y)
  }

  private func build(face: UIImage) {
    let size = bounds.size
    builtSize = size
    // Camera: the insert's, so the face plane maps 1:1 onto the screen.
    cameraNode.position = SCNVector3(0, 0, 1400)
    camera.fieldOfView = 2 * atan(size.height / 2 / 1400) * 180 / .pi

    bodyNode.removeFromParentNode()
    let r = CGFloat(bodyRadius)
    let body = InsertGeometry.slab(
      rect: CGRect(origin: .zero, size: size), radii: (r, r, r, r), depth: CGFloat(depth), chamfer: 1.5)
    bodyNode = SCNNode(geometry: body)
    deviceNode.addChildNode(bodyNode)
    applyMaterials(face: face)
  }

  private func applyMaterials(face: UIImage) {
    guard let body = bodyNode.geometry else { return }
    let colors = InsertFinish.named(finish)
    body.materials = [
      InsertGeometry.flat(face),
      InsertGeometry.flat(UIColor.mix(colors.body1, .white, 0.35)),
      InsertGeometry.flat(DeviceFaceArt.side(finish: colors)),
      InsertGeometry.flat(LaunchArt.back(size: bounds.size, radius: CGFloat(bodyRadius), finish: colors, scale: 2)),
    ]
  }

  // MARK: Apply t

  private func apply(_ t: Double) {
    guard builtSize.width > 0, pose.count >= 2 else { return }
    let p = poseAt(duration > 0 ? t / duration : 1)
    let k = Double(builtSize.height) / poseHeight
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0
    // CSS `translateY(y) scale(sx, sy) rotateY(turn)` in SceneKit (y up: translateY flips sign).
    var m = matrix_identity_float4x4
    m.columns.3 = SIMD4(0, Float(-p.y * k), 0, 1)
    m *= simd_float4x4(diagonal: SIMD4(Float(p.sx), Float(p.sy), Float((p.sx + p.sy) / 2), 1))
    m *= simd_float4x4(simd_quatf(angle: Float(p.turn * .pi / 180), axis: SIMD3(0, 1, 0)))
    deviceNode.simdTransform = m
    SCNTransaction.commit()
  }

  private func poseAt(_ t: Double) -> (y: Double, sx: Double, sy: Double, turn: Double) {
    func frame(_ i: Int) -> (at: Double, y: Double, sx: Double, sy: Double, turn: Double) {
      let f = pose[i]
      return (f["at"] ?? 0, f["y"] ?? 0, f["sx"] ?? 1, f["sy"] ?? 1, f["turn"] ?? 0)
    }
    let last = pose.count - 1
    if t <= 0 { let f = frame(0); return (f.y, f.sx, f.sy, f.turn) }
    if t >= 1 { let f = frame(last); return (f.y, f.sx, f.sy, f.turn) }
    var i = 0
    while i < last - 1, t > frame(i + 1).at { i += 1 }
    let a = frame(i)
    let b = frame(i + 1)
    let c = i < curves.count && curves[i].count == 4 ? curves[i] : [0, 0, 1, 1]
    let local = CubicBezier(c[0], c[1], c[2], c[3])((t - a.at) / max(b.at - a.at, 1e-6))
    return (
      a.y + (b.y - a.y) * local, a.sx + (b.sx - a.sx) * local, a.sy + (b.sy - a.sy) * local,
      a.turn + (b.turn - a.turn) * local
    )
  }
}

/// The body's back: the finish's gradient and the engraved TRIM, drawn mirrored so it reads
/// the right way round from behind (the back face shows its texture flipped).
enum LaunchArt {
  static func back(size: CGSize, radius: CGFloat, finish: InsertFinish, scale: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = true
    return UIGraphicsImageRenderer(size: size, format: format).image { context in
      let ctx = context.cgContext
      let colors = [finish.body1.cgColor, finish.body2.cgColor] as CFArray
      if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
        ctx.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
      }
      ctx.translateBy(x: size.width, y: 0)
      ctx.scaleBy(x: -1, y: 1)
      let font = UIFont.systemFont(ofSize: 13, weight: .bold)
      let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .kern: 4,
        .foregroundColor: finish.keyEdge.withAlphaComponent(0.55),
      ]
      let text = NSAttributedString(string: "TRIM", attributes: attributes)
      let box = text.size()
      text.draw(at: CGPoint(x: (size.width - box.width) / 2, y: (size.height - box.height) / 2))
    }
  }
}

/// Breaks the display link's retain on the view.
private final class LaunchLinkProxy: NSObject {
  weak var view: DeviceLaunchView?
  init(_ view: DeviceLaunchView) { self.view = view }
  @MainActor @objc func tick() { view?.tick() }
}
