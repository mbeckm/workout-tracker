import ExpoModulesCore
import QuartzCore
import SceneKit
import UIKit

/// The tour's launch (decision 85) in 3D: the same extruded body as the cartridge insert
/// (`InsertGeometry.slab`, 44 pt deep, the chamfer and the finish's sides), thrown up, spun and
/// landed on the pose keyframes from `TOUR_POSE` in src/motion.ts.
///
/// The view wraps the JS device. Idle it draws nothing of its own. On `launch` it photographs
/// its children face-on (the device as it is right now) for the slab's face, then plays the pose
/// on its own clock and stays on screen through the perch: it leans into `perchTilt` once landed
/// so the body reads as an object, wiggles on each `wiggle`, and on `landing` settles to full
/// size, face-on. A new `finish` re-photographs the children for the face and redraws the sides
/// and back. The JS device hides itself on `onSceneReady` and takes over again at `idle`, when
/// the slab's last frame is exactly the JS device.
final class DeviceLaunchView: ExpoView {
  let onSceneReady = EventDispatcher()

  // MARK: Props

  var finish = "212"
  /// `idle`, `launch`, `perched` or `landing` (the tour's `TourLaunchPhase`).
  var phase = "idle"
  var duration: Double = 4800
  /// `[{ at, y, sx, sy, turn }]`, `at` 0–1 of `duration`, `y` on a `poseHeight`-tall screen.
  var pose: [[String: Double]] = []
  /// One `[x1, y1, x2, y2]` cubic-bezier per segment of `pose`.
  var curves: [[Double]] = []
  var poseHeight: Double = 844
  var depth: Double = 44
  var bodyRadius: Double = 52
  /// The lean at the perch, CSS degrees `[rotateX, rotateY]`, eased in over `perchTiltDuration`.
  var perchTilt: [Double] = [0, 0]
  var perchTiltDuration: Double = 700
  /// Bumped on each pick: the wiggle (CSS `rotate` degrees, then back to 0).
  var wiggle: Double = 0
  var wiggleTilts: [Double] = []
  var wiggleDuration: Double = 700
  var settleDuration: Double = 1000
  /// The wiggle's, the lean's and the landing's curve.
  var displayCurve: [Double] = [0.2, 0.8, 0.3, 1]

  // MARK: State

  private var running = false
  private var launchStart: CFTimeInterval = 0
  private var settleStart: CFTimeInterval?
  private var wiggleStart: CFTimeInterval?
  private var wiggleDirection: Double = 1
  private var shownWiggle: Double = 0
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
    if window == nil { stopLink() } else if running { startLink() }
  }

  func propsDidUpdate() {
    guard phase != "idle" else {
      if running { stop() }
      return
    }
    if !running {
      start()
      return
    }
    if finish != shownFinish {
      // After this mount transaction: the children wear the new finish by then.
      DispatchQueue.main.async { [weak self] in self?.redress() }
    }
    if wiggle != shownWiggle {
      shownWiggle = wiggle
      wiggleStart = CACurrentMediaTime()
      wiggleDirection = Int(wiggle) % 2 == 0 ? -1 : 1
      startLink()
    }
    if phase == "landing", settleStart == nil {
      settleStart = CACurrentMediaTime()
      startLink()
    }
  }

  // MARK: Control

  private func start() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    running = true
    readySent = false
    settleStart = nil
    wiggleStart = nil
    shownWiggle = wiggle
    let view = ensureSceneView()
    build(face: photographChildren())
    shownFinish = finish
    launchStart = CACurrentMediaTime()
    apply(launchStart)
    view.isHidden = false
    view.rendersContinuously = true
    startLink()
    // The first frame is in on the next display refresh: then the JS device can hide.
    DispatchQueue.main.async { [weak self] in
      guard let self, self.running, !self.readySent else { return }
      self.readySent = true
      self.onSceneReady([:])
    }
  }

  private func stop() {
    stopLink()
    running = false
    scnView?.rendersContinuously = false
    scnView?.isHidden = true
    bodyNode.removeFromParentNode()
  }

  private func redress() {
    guard running, finish != shownFinish else { return }
    shownFinish = finish
    applyMaterials(face: photographChildren())
    // A still frame doesn't redraw by itself.
    if link == nil { apply(CACurrentMediaTime()) }
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
    guard link == nil, running, window != nil else { return }
    let l = CADisplayLink(target: LaunchLinkProxy(self), selector: #selector(LaunchLinkProxy.tick))
    l.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
    l.add(to: .main, forMode: .common)
    link = l
    scnView?.rendersContinuously = true
  }

  private func stopLink() {
    link?.invalidate()
    link = nil
    scnView?.rendersContinuously = false
  }

  fileprivate func tick() {
    guard running else { return stopLink() }
    let now = CACurrentMediaTime()
    apply(now)
    // Nothing moves while perched between picks: no idle loop, no frames.
    if !moving(at: now) { stopLink() }
  }

  private func moving(at now: CFTimeInterval) -> Bool {
    let ms = { (from: CFTimeInterval) in (now - from) * 1000 }
    if ms(launchStart) < duration + perchTiltDuration { return true }
    if let w = wiggleStart, ms(w) < wiggleDuration { return true }
    if let s = settleStart, ms(s) < settleDuration { return true }
    return false
  }

  // MARK: Building

  /// The children face-on and untransformed, at screen scale. Each child's parts are drawn on
  /// their own, so the wrapper's opacity and transform (the JS device hides and moves itself)
  /// don't count, and a part that is transparent right now is left out. `drawHierarchy` after
  /// screen updates draws what the screen would, even while the device is hidden (SVG glyphs,
  /// text, a new finish); a layer without a view falls back to `render(in:)`.
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
        let views = Dictionary(child.subviews.map { (ObjectIdentifier($0.layer), $0) }, uniquingKeysWith: { a, _ in a })
        for sub in child.layer.sublayers ?? [] {
          guard !sub.isHidden, sub.opacity > 0.01 else { continue }
          let subOrigin = Self.untransformedOrigin(sub)
          let rect = CGRect(
            x: origin.x + subOrigin.x, y: origin.y + subOrigin.y, width: sub.bounds.width, height: sub.bounds.height)
          let view = views[ObjectIdentifier(sub)]
          let drawn = view?.drawHierarchy(in: rect, afterScreenUpdates: true) ?? false
          if drawn { continue }
          ctx.saveGState()
          ctx.translateBy(x: rect.minX, y: rect.minY)
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

  private func apply(_ now: CFTimeInterval) {
    guard builtSize.width > 0, pose.count >= 2 else { return }
    let curve = displayCurve.count == 4
      ? CubicBezier(displayCurve[0], displayCurve[1], displayCurve[2], displayCurve[3])
      : CubicBezier(0.2, 0.8, 0.3, 1)
    let t = (now - launchStart) * 1000
    var p = poseAt(duration > 0 ? t / duration : 1)
    var lean = curve(min(max((t - duration) / max(perchTiltDuration, 1), 0), 1))
    if let s = settleStart {
      // The landing: from the perch to full size, face-on (the JS device's own frame).
      let left = 1 - curve(min((now - s) * 1000 / max(settleDuration, 1), 1))
      p = (p.y * left, 1 + (p.sx - 1) * left, 1 + (p.sy - 1) * left, p.turn)
      lean *= left
    }
    var tilt = 0.0
    if let w = wiggleStart, !wiggleTilts.isEmpty {
      // The tilts in turn, then back to 0, each step eased (`withSequence` in tour-launch.tsx).
      let stops = [0] + wiggleTilts.map { $0 * wiggleDirection } + [0]
      let steps = Double(stops.count - 1)
      let k = min((now - w) * 1000 / max(wiggleDuration, 1), 1) * steps
      let i = min(Int(k), stops.count - 2)
      tilt = stops[i] + (stops[i + 1] - stops[i]) * curve(k - Double(i))
    }
    let k = Double(builtSize.height) / poseHeight
    let tiltX = perchTilt.count > 0 ? perchTilt[0] : 0
    let tiltY = perchTilt.count > 1 ? perchTilt[1] : 0
    func rad(_ d: Double) -> Float { Float(d * .pi / 180) }
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0
    // CSS `translateY(y) rotate(tilt) scale(sx, sy) rotateX rotateY rotateY(turn)` in SceneKit
    // (y up: translateY, rotate and rotateX flip sign; rotateY doesn't).
    var m = matrix_identity_float4x4
    m.columns.3 = SIMD4(0, Float(-p.y * k), 0, 1)
    m *= simd_float4x4(simd_quatf(angle: rad(-tilt), axis: SIMD3(0, 0, 1)))
    m *= simd_float4x4(diagonal: SIMD4(Float(p.sx), Float(p.sy), Float((p.sx + p.sy) / 2), 1))
    m *= simd_float4x4(simd_quatf(angle: rad(-tiltX * lean), axis: SIMD3(1, 0, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(tiltY * lean), axis: SIMD3(0, 1, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(p.turn), axis: SIMD3(0, 1, 0)))
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
