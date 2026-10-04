import ExpoModulesCore
import QuartzCore
import SceneKit
import UIKit

/// The plan activation moment (SPEC §7 "Plan activation", PLAN §4.4): the device pulls back
/// onto a dark grid, a cartridge with the plan's label clicks into its top, and the device
/// swings back to face you.
///
/// One clock drives everything: `apply(t)` maps a time in ms to every node and layer, so
/// skipping, pausing for screenshots, reduced motion and returning from the background are all
/// "jump to t". The 3D objects (device, cartridge, slot glow, display) are SceneKit in a
/// transparent `SCNView`; the scene behind them (backdrop, grid floor, vignette, pulse ring,
/// the device's shadow) is Core Animation, as in the prototype where `.scene` sits behind `#dev`.
final class CartridgeInsertView: ExpoView {
  let onSeated = EventDispatcher()
  let onFinished = EventDispatcher()
  /// The art is drawn and the first frame is on screen: the JS device can hide under it.
  let onSceneReady = EventDispatcher()

  // MARK: Props

  var finish = "212" { didSet { if finish != oldValue { artDirty = true } } }
  var planName = "" { didSet { if planName != oldValue { artDirty = true } } }
  var days: [String] = [] { didSet { if days != oldValue { artDirty = true } } }
  var playing = false
  var reduceMotion = false
  var soundsOn = true
  /// Dev only: freeze the timeline at this many ms (no events).
  var pauseAt: Double?
  /// Dev only: timeline speed (0.25 = four times slower).
  var speed: Double = 1
  var safeTop: CGFloat = 47 { didSet { if safeTop != oldValue { artDirty = true } } }
  var safeBottom: CGFloat = 34 { didSet { if safeBottom != oldValue { artDirty = true } } }
  var layoutOverride = InsertLayoutOverride() { didSet { artDirty = true } }

  // MARK: Timeline (SPEC §7, ms)

  enum T {
    static let pullEnd = 1000.0
    static let appearStart = 1000.0
    static let appearEnd = 1500.0
    static let insertStart = 1800.0
    static let seat = 2400.0
    static let settle = 300.0
    static let dip = 520.0
    static let glow = 900.0
    static let pulse = 1000.0
    static let boot = 600.0
    static let swingStart = 3200.0
    static let swing = 900.0
    static let end = 4100.0
    static let sceneFade = 600.0
    static let gridScroll = 1400.0
    static let shadowFade = 800.0
  }

  private enum Phase { case idle, running, finished }

  private var phase = Phase.idle
  private var startTime: CFTimeInterval = 0
  private var elapsedAtStart: Double = 0
  private var seatedSent = false
  private var finishedSent = false
  private var link: CADisplayLink?
  private var artDirty = true
  private var builtSize = CGSize.zero
  /// Bumped per rebuild; a stale background render is dropped.
  private var artGeneration = 0
  /// Until the art is in, the view draws nothing (the JS device shows through).
  private var artReady = false

  // MARK: Layers and nodes

  private let benchLayer = CALayer()
  private let sceneLayer = CALayer()
  private let backdropLayer = CALayer()
  private let floorLayer = CALayer()
  private let floorMask = CAGradientLayer()
  private let gridLayer = CALayer()
  private let vignetteLayer = CALayer()
  private let pulseLayer = CALayer()
  private let shadowLayer = CALayer()

  private let scnView = SCNView(frame: .zero)
  private let scene = SCNScene()
  private let camera = SCNCamera()
  private let cameraNode = SCNNode()
  private let deviceNode = SCNNode()
  private let cartNode = SCNNode()
  private var slotGlowNode = SCNNode()
  private let emptyGroup = SCNNode()
  private var insertPlanNode = SCNNode()
  private var loadedNode = SCNNode()
  private var flickerNode = SCNNode()
  private var lampNodes: [SCNNode] = []

  private var layoutSpec = InsertLayout.make(size: CGSize(width: 390, height: 844), safeTop: 47, safeBottom: 34)

  // MARK: Life

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    clipsToBounds = true
    isAccessibilityElement = true
    accessibilityTraits = [.button]

    layer.addSublayer(benchLayer)
    layer.addSublayer(sceneLayer)
    sceneLayer.addSublayer(backdropLayer)
    sceneLayer.addSublayer(floorLayer)
    floorLayer.addSublayer(gridLayer)
    floorLayer.mask = floorMask
    floorLayer.masksToBounds = true
    sceneLayer.addSublayer(vignetteLayer)
    sceneLayer.addSublayer(pulseLayer)
    sceneLayer.addSublayer(shadowLayer)
    for l in [benchLayer, sceneLayer, backdropLayer, floorLayer, gridLayer, vignetteLayer, pulseLayer, shadowLayer] {
      l.actions = ["position": NSNull(), "bounds": NSNull(), "transform": NSNull(), "opacity": NSNull(), "contents": NSNull()]
    }

    scnView.backgroundColor = .clear
    scnView.isOpaque = false
    scnView.antialiasingMode = .multisampling4X
    // Match the display link (120 on ProMotion, 60 elsewhere).
    scnView.preferredFramesPerSecond = 120
    scnView.isUserInteractionEnabled = false
    scnView.scene = scene
    scene.background.contents = UIColor.clear
    camera.zNear = 10
    camera.zFar = 8000
    camera.projectionDirection = .vertical
    cameraNode.camera = camera
    scene.rootNode.addChildNode(cameraNode)
    scene.rootNode.addChildNode(deviceNode)
    addSubview(scnView)

    let tap = UITapGestureRecognizer(target: self, action: #selector(skip))
    addGestureRecognizer(tap)

    NotificationCenter.default.addObserver(
      self, selector: #selector(willEnterForeground),
      name: UIApplication.willEnterForegroundNotification, object: nil)
    TrimDeviceFeel.shared.prepare()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    scnView.frame = bounds
    if bounds.size != builtSize { artDirty = true }
    rebuildIfNeeded()
    apply(currentTime())
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      stopLink()
    } else if phase == .running, pauseAt == nil {
      startLink()
    }
  }

  /// After a batch of props: rebuild the art if needed, then start, stop, or freeze.
  func propsDidUpdate() {
    rebuildIfNeeded()
    if let frozen = pauseAt {
      stopLink()
      apply(frozen)
      return
    }
    if playing {
      if phase == .idle { start() }
    } else if phase != .idle {
      reset()
    } else {
      apply(0)
    }
  }

  // MARK: Control

  private func start() {
    seatedSent = false
    finishedSent = false
    if reduceMotion || UIAccessibility.isReduceMotionEnabled {
      // SPEC §7: skip the 3D activation, keep the haptic and the sound.
      phase = .running
      complete(feedback: true)
      return
    }
    phase = .running
    // 0 = not yet: `install` starts the clock when the first frame can be seen.
    startTime = artReady ? CACurrentMediaTime() : 0
    elapsedAtStart = 0
    scnView.rendersContinuously = true
    startLink()
    apply(0)
  }

  private func reset() {
    stopLink()
    phase = .idle
    seatedSent = false
    finishedSent = false
    scnView.rendersContinuously = false
    apply(0)
  }

  /// Tapping the scene skips to the end state (D22); both events fire, in order.
  @objc private func skip() {
    guard phase == .running, pauseAt == nil else { return }
    complete(feedback: !seatedSent)
  }

  /// Back from the background mid-animation: land on the end state, quietly (PLAN §7 System).
  @objc private func willEnterForeground() {
    guard phase == .running, pauseAt == nil else { return }
    complete(feedback: false)
  }

  private func complete(feedback: Bool) {
    stopLink()
    apply(T.end)
    if !seatedSent {
      seatedSent = true
      if feedback { playClick() }
      emitAsync(onSeated)
    }
    markFinished()
  }

  private func markFinished() {
    phase = .finished
    scnView.rendersContinuously = false
    if !finishedSent {
      finishedSent = true
      emitAsync(onFinished)
    }
  }

  private func emitAsync(_ dispatcher: EventDispatcher) {
    // Next run loop: JS has its listeners even when this fires straight from a prop update.
    DispatchQueue.main.async { dispatcher([:]) }
  }

  private func playClick() {
    TrimDeviceFeel.shared.play("cartridgeClick")
    if soundsOn { TrimDeviceFeel.shared.playSound("cartridge") }
  }

  // MARK: Clock

  private func currentTime() -> Double {
    if let frozen = pauseAt { return frozen }
    switch phase {
    case .idle: return 0
    case .finished: return T.end
    case .running:
      guard startTime > 0 else { return 0 }
      return elapsedAtStart + (CACurrentMediaTime() - startTime) * 1000 * max(speed, 0.01)
    }
  }

  private func startLink() {
    guard link == nil else { return }
    let proxy = LinkProxy(self)
    let l = CADisplayLink(target: proxy, selector: #selector(LinkProxy.tick))
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
    let t = currentTime()
    apply(min(t, T.end))
    if !seatedSent, t >= T.seat {
      seatedSent = true
      // Feedback only when we're on time (a late frame after a stall stays quiet).
      if t - T.seat < 150 * max(speed, 0.01) { playClick() }
      emitAsync(onSeated)
    }
    if t >= T.end {
      stopLink()
      markFinished()
    }
  }

  // MARK: Building

  private func rebuildIfNeeded() {
    guard artDirty, bounds.width > 0, bounds.height > 0 else { return }
    artDirty = false
    builtSize = bounds.size
    artGeneration += 1
    let generation = artGeneration
    let layout = InsertLayout.make(
      size: bounds.size, safeTop: safeTop, safeBottom: safeBottom,
      topRowY: layoutOverride.topRowY, displayY: layoutOverride.displayY,
      displayHeight: layoutOverride.displayHeight, wellY: layoutOverride.wellY)
    let inputs = InsertArtSet.Inputs(
      layout: layout, finish: finish, planName: planName, days: days,
      scale: max(traitCollection.displayScale, 2))
    // Core Graphics off the main thread (~100–200 ms of drawing); nodes go in on main.
    DispatchQueue.global(qos: .userInteractive).async { [weak self] in
      #if DEBUG
      let began = CACurrentMediaTime()
      #endif
      let art = InsertArtSet.render(inputs)
      #if DEBUG
      NSLog("[CartridgeInsert] art drawn in %.1f ms", (CACurrentMediaTime() - began) * 1000)
      #endif
      DispatchQueue.main.async {
        guard let self, generation == self.artGeneration else { return }
        self.install(art)
      }
    }
  }

  private func install(_ art: InsertArtSet) {
    let lay = art.inputs.layout
    let size = lay.size
    layoutSpec = lay

    // Scene layers.
    benchLayer.frame = CGRect(origin: .zero, size: size)
    benchLayer.contents = art.bench.cgImage
    sceneLayer.frame = CGRect(origin: .zero, size: size)
    var perspective = CATransform3DIdentity
    perspective.m34 = -1 / 500
    sceneLayer.sublayerTransform = perspective
    backdropLayer.frame = CGRect(origin: .zero, size: size)
    backdropLayer.contents = art.backdrop.cgImage
    vignetteLayer.frame = CGRect(origin: .zero, size: size)
    vignetteLayer.contents = art.vignette.cgImage

    // `.gridfloor`: 220% wide, from 52% down, hinged at its top edge and laid back 72°. Only
    // the first ~420 pt of its 120% height reach the screen.
    let floorW = size.width * InsertArtSet.floorWidthFactor
    let floorH = InsertArtSet.floorHeight
    floorLayer.anchorPoint = CGPoint(x: 0.5, y: 0)
    floorLayer.bounds = CGRect(x: 0, y: 0, width: floorW, height: floorH)
    floorLayer.position = CGPoint(x: size.width / 2, y: size.height * 0.52)
    floorLayer.transform = CATransform3DMakeRotation(72 * .pi / 180, 1, 0, 0)
    floorMask.frame = CGRect(x: 0, y: 0, width: floorW, height: size.height * 1.2)
    floorMask.colors = [
      UIColor(white: 0, alpha: 0.2).cgColor, UIColor.black.cgColor, UIColor.black.cgColor, UIColor(white: 0, alpha: 0).cgColor,
    ]
    floorMask.locations = [0, 0.3, 0.6, 1]
    floorMask.actions = ["position": NSNull(), "bounds": NSNull()]
    gridLayer.bounds = CGRect(x: 0, y: 0, width: floorW, height: floorH + 44)
    gridLayer.anchorPoint = .zero
    gridLayer.contents = art.grid.cgImage

    pulseLayer.bounds = CGRect(x: 0, y: 0, width: art.pulse.size.width, height: art.pulse.size.height)
    pulseLayer.position = CGPoint(x: size.width / 2, y: size.height * 0.4)
    pulseLayer.contents = art.pulse.cgImage
    shadowLayer.bounds = CGRect(x: 0, y: 0, width: 270, height: 46)
    shadowLayer.position = CGPoint(x: size.width / 2 + 10, y: size.height - 101)
    shadowLayer.contents = art.deviceShadow.cgImage

    // Camera: CSS `perspective: 1400px` from the centre of the screen.
    cameraNode.position = SCNVector3(0, 0, 1400)
    camera.fieldOfView = 2 * atan(size.height / 2 / 1400) * 180 / .pi

    // Device.
    deviceNode.childNodes.forEach { $0.removeFromParentNode() }
    let finishColors = InsertFinish.named(art.inputs.finish)
    let body = InsertGeometry.slab(
      rect: CGRect(origin: .zero, size: size),
      radii: (InsertLayout.bodyRadius, InsertLayout.bodyRadius, InsertLayout.bodyRadius, InsertLayout.bodyRadius),
      depth: 44, chamfer: 1.5)
    body.materials = [
      InsertGeometry.flat(art.face),
      InsertGeometry.flat(UIColor.mix(finishColors.body1, .white, 0.35)),
      InsertGeometry.flat(art.side),
      InsertGeometry.flat(finishColors.body2.brightened(0.38)),
    ]
    deviceNode.addChildNode(SCNNode(geometry: body))

    func local(_ p: CGPoint, z: CGFloat) -> SCNVector3 {
      SCNVector3(Float(p.x - size.width / 2), Float(size.height / 2 - p.y), Float(z))
    }
    let dispCentre = CGPoint(x: lay.display.midX, y: lay.display.midY)
    let dispSize = lay.display.size

    flickerNode = InsertGeometry.overlay(size: dispSize, image: nil, order: 10)
    if let m = flickerNode.geometry?.firstMaterial {
      m.transparent.contents = art.panelMask
      m.diffuse.contents = InsertInk.bootFlash1
    }
    flickerNode.position = local(dispCentre, z: 0.3)
    deviceNode.addChildNode(flickerNode)

    emptyGroup.childNodes.forEach { $0.removeFromParentNode() }
    emptyGroup.addChildNode(InsertGeometry.overlay(size: dispSize, image: art.slotHeader, order: 11))
    insertPlanNode = InsertGeometry.overlay(size: dispSize, image: art.insertPlan, order: 12)
    emptyGroup.addChildNode(insertPlanNode)
    emptyGroup.position = local(dispCentre, z: 0.5)
    deviceNode.addChildNode(emptyGroup)

    loadedNode = InsertGeometry.overlay(size: dispSize, image: art.loaded, order: 13)
    loadedNode.geometry?.firstMaterial?.emission.contents = art.loaded
    loadedNode.position = local(dispCentre, z: 0.5)
    deviceNode.addChildNode(loadedNode)

    lampNodes = lay.lampCenters(count: art.inputs.days.count).map { c in
      let node = InsertGeometry.overlay(size: CGSize(width: 26, height: 26), image: art.lamp, order: 14)
      node.position = local(c, z: 0.6)
      deviceNode.addChildNode(node)
      return node
    }

    // Slot glow (`.slotglow`): centred on the top edge, 1 pt in front of the face.
    slotGlowNode = InsertGeometry.overlay(
      size: CGSize(width: 180 + art.slotGlowPad * 2, height: 10 + art.slotGlowPad * 2), image: art.slotGlow, order: 20)
    slotGlowNode.position = local(CGPoint(x: size.width / 2, y: 1), z: 1)
    deviceNode.addChildNode(slotGlowNode)

    // Cartridge: behind the face, halfway into the body's depth (`translateZ(-22px)`).
    cartNode.childNodes.forEach { $0.removeFromParentNode() }
    let cart = InsertGeometry.slab(
      rect: CGRect(origin: .zero, size: CartridgeArt.size), radii: CartridgeArt.radii, depth: 10, chamfer: 1)
    cart.materials = [
      InsertGeometry.flat(art.cartridge),
      InsertGeometry.flat(InsertInk.cartTop),
      InsertGeometry.flat(CartridgeArt.sideColor),
      InsertGeometry.flat(CartridgeArt.sideColor),
    ]
    cartNode.addChildNode(SCNNode(geometry: cart))
    deviceNode.addChildNode(cartNode)

    accessibilityLabel = "Loading \(art.inputs.planName)"
    let firstInstall = !artReady
    artReady = true
    // The clock starts with the first frame that can be seen.
    if phase == .running, startTime == 0 { startTime = CACurrentMediaTime() }
    // Fresh nodes start in their default state: put them where the clock is.
    apply(currentTime())
    if firstInstall { emitAsync(onSceneReady) }
  }

  // MARK: Apply t

  private static let pull = CubicBezier(0.6, 0, 0.25, 1)
  private static let settle = CubicBezier(0.2, 0.8, 0.3, 1)
  private static let insert = CubicBezier(0.55, 0, 0.8, 0.35)
  private static let easeOut = CubicBezier(0, 0, 0.58, 1)
  private static let ease = CubicBezier(0.25, 0.1, 0.25, 1)

  /// Every visual at `t` ms (0 … 3000), straight from SPEC §7 and the prototype's `activate()`.
  private func apply(_ rawT: Double) {
    let t = max(0, min(rawT, T.end))
    let size = bounds.size
    guard size.width > 0 else { return }

    CATransaction.begin()
    CATransaction.setDisableActions(true)
    SCNTransaction.begin()
    SCNTransaction.animationDuration = 0

    // Scene in over 600 ms, out from the swing back.
    let sceneOpacity: Double
    if t < T.swingStart {
      sceneOpacity = Self.ease(t / T.sceneFade)
    } else {
      sceneOpacity = 1 - Self.ease((t - T.swingStart) / T.sceneFade)
    }
    sceneLayer.opacity = Float(sceneOpacity)

    // The grid scrolls one cell towards you, and back as the scene leaves.
    let scroll: Double
    if t < T.swingStart {
      scroll = 44 * Self.settle(t / T.gridScroll)
    } else {
      scroll = 44 * (1 - Self.settle((t - T.swingStart) / T.gridScroll))
    }
    gridLayer.position = CGPoint(x: 0, y: -44 + scroll)

    let shadowIn: Double = t < T.swingStart
      ? Self.ease(t / T.shadowFade)
      : 1 - Self.ease((t - T.swingStart) / T.shadowFade)
    shadowLayer.opacity = Float(shadowIn)
    let shadowScale = 0.6 + 0.4 * shadowIn
    shadowLayer.transform = CATransform3DMakeScale(shadowScale, shadowScale, 1)

    // Pulse ring from behind the device at the click.
    if t >= T.seat, t < T.seat + T.pulse {
      let e = Self.settle((t - T.seat) / T.pulse)
      let s = 0.35 + 0.9 * e
      pulseLayer.transform = CATransform3DMakeScale(s, s, 1)
      pulseLayer.opacity = Float(0.9 * (1 - e))
    } else {
      pulseLayer.opacity = 0
    }

    // Device: pull back, the click's dip, swing back.
    let p: Double
    if t < T.pullEnd {
      p = Self.pull(t / T.pullEnd)
    } else if t < T.swingStart {
      p = 1
    } else {
      p = 1 - Self.pull((t - T.swingStart) / T.swing)
    }
    var dip = (ty: 0.0, rx: 0.0, s: 1.0)
    if t >= T.seat, t < T.seat + T.dip {
      let k = (t - T.seat) / T.dip
      let frames: [(Double, Double, Double)] = [(0, 0, 1), (10, 4, 0.985), (-4, -1, 1.006), (1, 0, 1), (0, 0, 1)]
      let seg = min(Int(k * 4), 3)
      let local = Self.settle(k * 4 - Double(seg))
      let a = frames[seg]
      let b = frames[seg + 1]
      dip = (a.0 + (b.0 - a.0) * local, a.1 + (b.1 - a.1) * local, a.2 + (b.2 - a.2) * local)
    }
    deviceNode.simdTransform = Self.deviceTransform(p: p, dip: dip)

    // Cartridge: appear, wait, insert, overshoot and settle.
    var cartY = -60.0
    var cartOpacity = 0.0
    if t >= T.appearStart, t < T.appearEnd {
      let e = Self.settle((t - T.appearStart) / (T.appearEnd - T.appearStart))
      cartY = -60 + 60 * e
      cartOpacity = e
    } else if t >= T.appearEnd, t < T.insertStart {
      cartY = 0
      cartOpacity = 1
    } else if t >= T.insertStart, t < T.seat {
      cartY = 180 * Self.insert((t - T.insertStart) / (T.seat - T.insertStart))
      cartOpacity = 1
    } else if t >= T.seat {
      let k = min((t - T.seat) / T.settle, 1)
      let ys = [180.0, 192, 184, 186]
      let seg = min(Int(k * 3), 2)
      let local = Self.easeOut(k * 3 - Double(seg))
      cartY = ys[seg] + (ys[seg + 1] - ys[seg]) * local
      cartOpacity = 1
    }
    let cartTop = -240 + cartY
    cartNode.position = SCNVector3(
      0, Float(size.height / 2 - (cartTop + CartridgeArt.size.height / 2)), -22)
    cartNode.opacity = cartOpacity
    cartNode.isHidden = t >= T.end || cartOpacity <= 0

    // Slot glow.
    if t >= T.seat, t < T.seat + T.glow {
      slotGlowNode.opacity = 1 - Self.easeOut((t - T.seat) / T.glow)
      slotGlowNode.isHidden = false
    } else {
      slotGlowNode.isHidden = true
    }

    // Display: SLOT EMPTY with a blinking INSERT PLAN, then the boot into LOADED.
    if t < T.seat {
      let e = Self.settle(t / 220)
      emptyGroup.isHidden = false
      emptyGroup.opacity = e
      let base = SCNVector3(
        Float(layoutSpec.display.midX - size.width / 2), Float(size.height / 2 - layoutSpec.display.midY), 0.5)
      emptyGroup.position = SCNVector3(base.x, base.y - Float(8 * (1 - e)), base.z)
      insertPlanNode.opacity = t.truncatingRemainder(dividingBy: 1000) < 500 ? 1 : 0.25
      loadedNode.isHidden = true
      flickerNode.isHidden = true
    } else {
      emptyGroup.isHidden = true
      loadedNode.isHidden = false
      let k = min((t - T.seat) / T.boot, 1)
      // scaleY .02 → 1.04 (35%) → 1; brightness 3 → 1.6 → 1.
      let sy: Double
      let bright: Double
      if k < 0.35 {
        let e = Self.settle(k / 0.35)
        sy = 0.02 + (1.04 - 0.02) * e
        bright = 3 + (1.6 - 3) * e
      } else {
        let e = Self.settle((k - 0.35) / 0.65)
        sy = 1.04 + (1 - 1.04) * e
        bright = 1.6 + (1 - 1.6) * e
      }
      loadedNode.scale = SCNVector3(1, Float(sy), 1)
      loadedNode.geometry?.firstMaterial?.emission.intensity = Self.emission(forBrightness: bright)
      // The ground flickers in 45 ms steps: lcd, lit, lcd, dimmer lit, lcd.
      let step = Int((t - T.seat) / (T.boot / 10))
      switch step {
      case 1:
        flickerNode.isHidden = false
        flickerNode.geometry?.firstMaterial?.diffuse.contents = InsertInk.bootFlash1
      case 3:
        flickerNode.isHidden = false
        flickerNode.geometry?.firstMaterial?.diffuse.contents = InsertInk.bootFlash2
      default:
        flickerNode.isHidden = true
      }
    }

    // Lamps flick across one after another (60 + 55 i ms after the click, lit 140 ms).
    for (i, node) in lampNodes.enumerated() {
      let on = T.seat + 60 + 55 * Double(i)
      var level = 0.0
      if t >= on, t < on + 140 {
        level = Self.ease((t - on) / 250)
      } else if t >= on + 140 {
        let peak = Self.ease(140.0 / 250)
        level = peak * (1 - Self.ease((t - on - 140) / 140))
      }
      node.opacity = level
      node.isHidden = level <= 0.001
    }

    SCNTransaction.commit()
    CATransaction.commit()
  }

  /// CSS `filter: brightness(b)` scales sRGB values; SceneKit adds emission in linear light.
  /// The emission (a copy of the texture) that makes amber's green channel land where CSS puts it.
  private static func emission(forBrightness b: Double) -> CGFloat {
    func linear(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
    let g = 106.0 / 255 // amber #FF6A1A
    return CGFloat(max(0, linear(min(1, g * b)) / linear(g) - 1))
  }

  /// CSS `translateY(70px) scale(.68) rotateX(-16deg) rotateY(-30deg) rotateZ(2deg)` at `p`,
  /// then the click's `translateY rotateX scale`, converted to SceneKit (y up: translateY,
  /// rotateX and rotateZ flip sign; rotateY doesn't).
  private static func deviceTransform(p: Double, dip: (ty: Double, rx: Double, s: Double)) -> simd_float4x4 {
    func rad(_ d: Double) -> Float { Float(d * .pi / 180) }
    var m = translation(0, Float(-70 * p), 0)
    let s = Float(1 - 0.32 * p)
    m *= simd_float4x4(diagonal: SIMD4(s, s, s, 1))
    m *= simd_float4x4(simd_quatf(angle: rad(16 * p), axis: SIMD3(1, 0, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(-30 * p), axis: SIMD3(0, 1, 0)))
    m *= simd_float4x4(simd_quatf(angle: rad(-2 * p), axis: SIMD3(0, 0, 1)))
    m *= translation(0, Float(-dip.ty), 0)
    m *= simd_float4x4(simd_quatf(angle: rad(-dip.rx), axis: SIMD3(1, 0, 0)))
    let ds = Float(dip.s)
    m *= simd_float4x4(diagonal: SIMD4(ds, ds, ds, 1))
    return m
  }

  private static func translation(_ x: Float, _ y: Float, _ z: Float) -> simd_float4x4 {
    var m = matrix_identity_float4x4
    m.columns.3 = SIMD4(x, y, z, 1)
    return m
  }
}

/// Optional measured positions from the JS device (SPEC §4 defaults otherwise).
struct InsertLayoutOverride: Equatable {
  var topRowY: CGFloat?
  var displayY: CGFloat?
  var displayHeight: CGFloat?
  var wellY: CGFloat?
}

/// Breaks the display link's retain on the view.
private final class LinkProxy: NSObject {
  weak var view: CartridgeInsertView?
  init(_ view: CartridgeInsertView) { self.view = view }
  @MainActor @objc func tick() { view?.tick() }
}

/// CSS `cubic-bezier()` (WebKit's UnitBezier).
struct CubicBezier {
  private let ax, bx, cx, ay, by, cy: Double

  init(_ p1x: Double, _ p1y: Double, _ p2x: Double, _ p2y: Double) {
    cx = 3 * p1x
    bx = 3 * (p2x - p1x) - cx
    ax = 1 - cx - bx
    cy = 3 * p1y
    by = 3 * (p2y - p1y) - cy
    ay = 1 - cy - by
  }

  private func x(_ t: Double) -> Double { ((ax * t + bx) * t + cx) * t }
  private func y(_ t: Double) -> Double { ((ay * t + by) * t + cy) * t }
  private func dx(_ t: Double) -> Double { (3 * ax * t + 2 * bx) * t + cx }

  private func solve(_ target: Double) -> Double {
    var t = target
    for _ in 0..<8 {
      let err = x(t) - target
      if abs(err) < 1e-6 { return t }
      let d = dx(t)
      if abs(d) < 1e-6 { break }
      t -= err / d
    }
    var lo = 0.0, hi = 1.0
    t = target
    while lo < hi {
      let v = x(t)
      if abs(v - target) < 1e-6 { return t }
      if target > v { lo = t } else { hi = t }
      t = (lo + hi) / 2
      if hi - lo < 1e-7 { break }
    }
    return t
  }

  func callAsFunction(_ progress: Double) -> Double {
    if progress <= 0 { return 0 }
    if progress >= 1 { return 1 }
    return y(solve(progress))
  }
}
