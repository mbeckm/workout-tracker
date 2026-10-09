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
final class DeviceLaunchView: ExpoView, SCNSceneRendererDelegate {
  let onSceneReady = EventDispatcher()

  // MARK: Props

  var finish = "212"
  /// The Sounds setting (D14): `spin` plays with the launch's first frame.
  var soundsOn = true
  /// Warm up ahead of the launch (the tour is on): build the body, compile its shaders and draw
  /// a few invisible frames, so the first frame after Start is immediate instead of a lost throw.
  var prepare = false
  /// `idle`, `launch`, `perched` or `landing` (the tour's `TourLaunchPhase`).
  var phase = "idle"
  var duration: Double = 4800
  /// A finish that arrives before this (ms into the launch) is photographed at once but worn
  /// only from here: the body re-dresses edge-on, mid-spin.
  var swapAt: Double = 0
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

  // MARK: State (main thread)

  private var running = false
  private var prepared = false
  private var shownWiggle: Double = 0
  private var shownFinish = ""
  /// A pick's wiggle waits for its photo, so the photo's hitch comes before the motion.
  private var wiggleAfterRedress = false
  private var finishArt: [String: (side: UIImage, back: UIImage)] = [:]

  private var scnView: SCNView?
  private let scene = SCNScene()
  private let camera = SCNCamera()
  private let cameraNode = SCNNode()
  private var builtSize = CGSize.zero

  /// What SceneKit's render thread reads every frame. The pose is set there, in
  /// `renderer(_:updateAtTime:)`, so the main thread never waits on the scene's lock mid-flight.
  nonisolated private let timeline = LaunchTimeline()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    camera.zNear = 10
    camera.zFar = 8000
    camera.projectionDirection = .vertical
    cameraNode.camera = camera
    scene.rootNode.addChildNode(cameraNode)
    scene.rootNode.addChildNode(timeline.deviceNode)
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
    if prepare, phase == "idle" { warmUp() }
  }

  func propsDidUpdate() {
    timeline.configure(
      LaunchTimeline.Params(
        duration: duration, swapAt: swapAt, pose: pose, curves: curves, poseHeight: poseHeight,
        perchTilt: perchTilt, perchTiltDuration: perchTiltDuration, wiggleTilts: wiggleTilts,
        wiggleDuration: wiggleDuration, settleDuration: settleDuration, displayCurve: displayCurve))
    guard phase != "idle" else {
      if running { stop() }
      if prepare { warmUp() }
      return
    }
    if !running {
      start()
      return
    }
    let redressing = finish != shownFinish
    if redressing {
      // After this mount transaction: the children wear the new finish by then.
      DispatchQueue.main.async { [weak self] in self?.redress() }
    }
    if wiggle != shownWiggle {
      shownWiggle = wiggle
      if redressing {
        wiggleAfterRedress = true
      } else {
        startWiggle()
      }
    }
    if phase == "landing", timeline.beginSettle() {
      render()
    }
  }

  // MARK: Control

  private func start() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    running = true
    wiggleAfterRedress = false
    shownWiggle = wiggle
    let view = ensureSceneView()
    if builtSize != bounds.size { build() }
    let materials = makeMaterials(face: photographChildren())
    shownFinish = finish
    // The scene isn't drawing yet: safe to touch from here.
    timeline.bodyNode?.geometry?.materials = materials
    timeline.begin(height: Double(builtSize.height))
    timeline.deviceNode.opacity = 1
    view.isHidden = false
    render()
  }

  /// The body, its shaders and a few drawn (invisible) frames, before Start: Metal's first
  /// frames are slow, and the launch must not lose its throw to them.
  private func warmUp() {
    guard !prepared, !running, window != nil, bounds.width > 0, bounds.height > 0 else { return }
    prepared = true
    let view = ensureSceneView()
    build()
    timeline.bodyNode?.geometry?.materials = makeMaterials(face: UIImage())
    timeline.deviceNode.opacity = 0
    view.prepare([scene]) { [weak self] _ in
      DispatchQueue.main.async {
        guard let self, !self.running else { return }
        view.isHidden = false
        view.rendersContinuously = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
          guard let self, !self.running else { return }
          view.rendersContinuously = false
        }
      }
    }
  }

  private func stop() {
    running = false
    timeline.end()
    scnView?.rendersContinuously = false
    scnView?.isHidden = true
  }

  private func redress() {
    guard running, finish != shownFinish else { return }
    shownFinish = finish
    timeline.dress(makeMaterials(face: photographChildren()))
    if wiggleAfterRedress {
      wiggleAfterRedress = false
      startWiggle()
    }
    render()
  }

  private func startWiggle() {
    timeline.beginWiggle(direction: Int(wiggle) % 2 == 0 ? -1 : 1)
    render()
  }

  /// Draw until the timeline says nothing moves (no idle loop while perched between picks).
  private func render() {
    scnView?.rendersContinuously = true
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
    view.delegate = self
    view.isHidden = true
    addSubview(view)
    scnView = view
    return view
  }

  // MARK: Render thread

  nonisolated func renderer(_ renderer: SCNSceneRenderer, updateAtTime time: TimeInterval) {
    let stillMoving = timeline.step(now: CACurrentMediaTime())
    if !stillMoving {
      DispatchQueue.main.async { [weak self] in
        guard let self, self.running, !self.timeline.isMoving(now: CACurrentMediaTime()) else { return }
        self.scnView?.rendersContinuously = false
      }
    }
  }

  nonisolated func renderer(_ renderer: SCNSceneRenderer, didRenderScene scene: SCNScene, atTime time: TimeInterval) {
    // The first frame is on screen: the clock has started, and the JS device can hide.
    guard timeline.didRender(now: CACurrentMediaTime()) else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self, self.running else { return }
      if self.soundsOn { TrimDeviceFeel.shared.playSound("spin") }
      self.onSceneReady([:])
    }
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
    // 2x: sharp at the perch's half size, and under half the pixels of a 3x screen.
    format.scale = 2
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

  private func build() {
    let size = bounds.size
    builtSize = size
    // Camera: the insert's, so the face plane maps 1:1 onto the screen.
    cameraNode.position = SCNVector3(0, 0, 1400)
    camera.fieldOfView = 2 * atan(size.height / 2 / 1400) * 180 / .pi
    let r = CGFloat(bodyRadius)
    let body = InsertGeometry.slab(
      rect: CGRect(origin: .zero, size: size), radii: (r, r, r, r), depth: CGFloat(depth), chamfer: 1.5)
    timeline.replaceBody(SCNNode(geometry: body))
  }

  private func makeMaterials(face: UIImage) -> [SCNMaterial] {
    let colors = InsertFinish.named(finish)
    let art: (side: UIImage, back: UIImage)
    if let cached = finishArt[finish] {
      art = cached
    } else {
      art = (DeviceFaceArt.side(finish: colors), LaunchArt.back(size: bounds.size, radius: CGFloat(bodyRadius), finish: colors, scale: 1))
      finishArt[finish] = art
    }
    return [
      InsertGeometry.flat(face),
      InsertGeometry.flat(UIColor.mix(colors.body1, .white, 0.35)),
      InsertGeometry.flat(art.side),
      InsertGeometry.flat(art.back),
    ]
  }
}

/// The launch's clock and pose, shared by the main thread (which starts things) and SceneKit's
/// render thread (which poses the body every frame). Everything goes through one lock.
final class LaunchTimeline: @unchecked Sendable {
  struct Params {
    var duration: Double = 4800
    var swapAt: Double = 0
    var pose: [[String: Double]] = []
    var curves: [[Double]] = []
    var poseHeight: Double = 844
    var perchTilt: [Double] = [0, 0]
    var perchTiltDuration: Double = 700
    var wiggleTilts: [Double] = []
    var wiggleDuration: Double = 700
    var settleDuration: Double = 1000
    var displayCurve: [Double] = [0.2, 0.8, 0.3, 1]
  }

  let deviceNode = SCNNode()
  private(set) var bodyNode: SCNNode?

  private let lock = NSLock()
  private var params = Params()
  private var height: Double = 844
  private var active = false
  /// 0 until the first frame is drawn: the clock starts there.
  private var launchStart: CFTimeInterval = 0
  private var waitingFirstFrame = false
  private var settleStart: CFTimeInterval?
  private var wiggleStart: CFTimeInterval?
  private var wiggleDirection: Double = 1
  /// The next finish's materials, and when they go on (ms into the launch; 0 = the next frame).
  private var pending: (materials: [SCNMaterial], at: Double)?

  private func locked<T>(_ body: () -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body()
  }

  func configure(_ p: Params) { locked { params = p } }

  func replaceBody(_ node: SCNNode) {
    bodyNode?.removeFromParentNode()
    bodyNode = node
    deviceNode.addChildNode(node)
  }

  func begin(height h: Double) {
    locked {
      height = h
      active = true
      launchStart = 0
      waitingFirstFrame = true
      settleStart = nil
      wiggleStart = nil
      pending = nil
    }
  }

  func end() {
    locked {
      active = false
      waitingFirstFrame = false
      pending = nil
    }
  }

  /// Starts the landing once; true when it did.
  func beginSettle() -> Bool {
    locked {
      guard active, settleStart == nil else { return false }
      settleStart = CACurrentMediaTime()
      return true
    }
  }

  func beginWiggle(direction: Double) {
    locked {
      wiggleStart = CACurrentMediaTime()
      wiggleDirection = direction
    }
  }

  /// A new finish: worn from `swapAt` during the throw, at once otherwise.
  func dress(_ materials: [SCNMaterial]) {
    locked {
      let t = launchStart > 0 ? (CACurrentMediaTime() - launchStart) * 1000 : 0
      let early = settleStart == nil && t < params.swapAt
      pending = (materials, early ? params.swapAt : 0)
    }
  }

  func isMoving(now: CFTimeInterval) -> Bool { locked { movingLocked(now) } }

  private func movingLocked(_ now: CFTimeInterval) -> Bool {
    guard active else { return false }
    let ms = { (from: CFTimeInterval) in (now - from) * 1000 }
    if pending != nil { return true }
    if launchStart == 0 || ms(launchStart) < params.duration + params.perchTiltDuration { return true }
    if let w = wiggleStart, ms(w) < params.wiggleDuration { return true }
    if let s = settleStart, ms(s) < params.settleDuration { return true }
    return false
  }

  /// Render thread: pose the body for `now`. False once nothing moves.
  func step(now: CFTimeInterval) -> Bool {
    lock.lock()
    guard active else {
      lock.unlock()
      return false
    }
    let p = params
    let t = launchStart > 0 ? (now - launchStart) * 1000 : 0
    var materials: [SCNMaterial]?
    if let next = pending, t >= next.at {
      materials = next.materials
      pending = nil
    }
    let settle = settleStart
    let wiggle = wiggleStart
    let direction = wiggleDirection
    let k = height / p.poseHeight
    let moving = movingLocked(now)
    lock.unlock()

    if let materials { bodyNode?.geometry?.materials = materials }
    deviceNode.simdTransform = Self.transform(
      p, t: t, now: now, settleStart: settle, wiggleStart: wiggle, direction: direction, k: k)
    return moving
  }

  /// Render thread, after a frame: true exactly once, for the first frame of a launch.
  func didRender(now: CFTimeInterval) -> Bool {
    locked {
      guard active, waitingFirstFrame else { return false }
      waitingFirstFrame = false
      launchStart = now
      return true
    }
  }

  // MARK: The pose

  private static func transform(
    _ p: Params, t: Double, now: CFTimeInterval, settleStart: CFTimeInterval?, wiggleStart: CFTimeInterval?,
    direction: Double, k: Double
  ) -> simd_float4x4 {
    let curve = p.displayCurve.count == 4
      ? CubicBezier(p.displayCurve[0], p.displayCurve[1], p.displayCurve[2], p.displayCurve[3])
      : CubicBezier(0.2, 0.8, 0.3, 1)
    var pose = poseAt(p, p.duration > 0 ? t / p.duration : 1)
    var lean = curve(min(max((t - p.duration) / max(p.perchTiltDuration, 1), 0), 1))
    if let s = settleStart {
      // The landing: from the perch to full size, face-on (the JS device's own frame).
      let left = 1 - curve(min((now - s) * 1000 / max(p.settleDuration, 1), 1))
      pose = (pose.y * left, 1 + (pose.sx - 1) * left, 1 + (pose.sy - 1) * left, pose.turn)
      lean *= left
    }
    var tilt = 0.0
    if let w = wiggleStart, !p.wiggleTilts.isEmpty {
      // The tilts in turn, then back to 0, each step eased (`withSequence` in tour-launch.tsx).
      let stops = [0] + p.wiggleTilts.map { $0 * direction } + [0]
      let steps = Double(stops.count - 1)
      let x = min((now - w) * 1000 / max(p.wiggleDuration, 1), 1) * steps
      let i = min(Int(x), stops.count - 2)
      tilt = stops[i] + (stops[i + 1] - stops[i]) * curve(x - Double(i))
    }
    let tiltX = p.perchTilt.count > 0 ? p.perchTilt[0] : 0
    let tiltY = p.perchTilt.count > 1 ? p.perchTilt[1] : 0
    func rad(_ d: Double) -> Float { Float(d * .pi / 180) }
    // CSS `translateY(y) rotate(tilt) scale(sx, sy) rotateX rotateY rotateY(turn)` in SceneKit
    // (y up: translateY, rotate and rotateX flip sign; rotateY doesn't).
    var m = matrix_identity_float4x4
    m.columns.3 = SIMD4(0, Float(-pose.y * k), 0, 1)
    m *= simd_float4x4(simd_quatf(angle: rad(-tilt), axis: SIMD3(0, 0, 1)))
    m *= simd_float4x4(diagonal: SIMD4(Float(pose.sx), Float(pose.sy), Float((pose.sx + pose.sy) / 2), 1))
    m *= simd_float4x4(simd_quatf(angle: rad(-tiltX * lean), axis: SIMD3(1, 0, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(tiltY * lean), axis: SIMD3(0, 1, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(pose.turn), axis: SIMD3(0, 1, 0)))
    return m
  }

  private static func poseAt(_ p: Params, _ t: Double) -> (y: Double, sx: Double, sy: Double, turn: Double) {
    guard p.pose.count >= 2 else { return (0, 1, 1, 0) }
    func frame(_ i: Int) -> (at: Double, y: Double, sx: Double, sy: Double, turn: Double) {
      let f = p.pose[i]
      return (f["at"] ?? 0, f["y"] ?? 0, f["sx"] ?? 1, f["sy"] ?? 1, f["turn"] ?? 0)
    }
    let last = p.pose.count - 1
    if t <= 0 { let f = frame(0); return (f.y, f.sx, f.sy, f.turn) }
    if t >= 1 { let f = frame(last); return (f.y, f.sx, f.sy, f.turn) }
    var i = 0
    while i < last - 1, t > frame(i + 1).at { i += 1 }
    let a = frame(i)
    let b = frame(i + 1)
    let c = i < p.curves.count && p.curves[i].count == 4 ? p.curves[i] : [0, 0, 1, 1]
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
