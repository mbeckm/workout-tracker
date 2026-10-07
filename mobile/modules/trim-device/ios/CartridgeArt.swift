import UIKit

// The cartridge insert's 2D art, drawn with Core Graphics: the device face, display contents,
// the cartridge label, glows and the scene's backdrop. Values follow SPEC §2/§7 and the
// prototype CSS (`.rk`, `.plate.rocker`, `.disp`, `.well`, `.big`, `.c3`, `.scene`). Units are
// points in the device's CSS frame (origin top-left, y down).

// MARK: - Colours

extension UIColor {
  convenience init(hex: UInt32, alpha: CGFloat = 1) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255,
      green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255,
      alpha: alpha
    )
  }

  /// CSS `filter: brightness(k)` on an opaque colour.
  func brightened(_ k: CGFloat) -> UIColor {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    getRed(&r, green: &g, blue: &b, alpha: &a)
    return UIColor(red: min(r * k, 1), green: min(g * k, 1), blue: min(b * k, 1), alpha: a)
  }

  static func mix(_ a: UIColor, _ b: UIColor, _ t: CGFloat) -> UIColor {
    var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
    var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
    a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
    b.getRed(&br, green: &bg, blue: &bb, alpha: &ba)
    return UIColor(
      red: ar + (br - ar) * t, green: ag + (bg - ag) * t, blue: ab + (bb - ab) * t,
      alpha: aa + (ba - aa) * t)
  }
}

/// One finish's body colours (SPEC §2 Device, `finishColors` in theme.ts).
struct InsertFinish {
  let body1: UIColor
  let body2: UIColor
  let keyEdge: UIColor

  static func named(_ id: String) -> InsertFinish {
    switch id {
    case "101": return InsertFinish(body1: UIColor(hex: 0x3D3C39), body2: UIColor(hex: 0x1D1C1A), keyEdge: UIColor(hex: 0x0E0E0D))
    case "707": return InsertFinish(body1: UIColor(hex: 0x727254), body2: UIColor(hex: 0x4A4933), keyEdge: UIColor(hex: 0x2A291C))
    case "089": return InsertFinish(body1: UIColor(hex: 0xDBD9D1), body2: UIColor(hex: 0xC3C0B6), keyEdge: UIColor(hex: 0x222328))
    case "077": return InsertFinish(body1: UIColor(hex: 0x6E6948), body2: UIColor(hex: 0x47432D), keyEdge: UIColor(hex: 0x5E4518))
    case "777": return InsertFinish(body1: UIColor(hex: 0xF7D6EA), body2: UIColor(hex: 0xEBD5F8), keyEdge: UIColor(hex: 0xB7B0CC))
    default: return InsertFinish(body1: UIColor(hex: 0xE6E4DE), body2: UIColor(hex: 0xCFCCC4), keyEdge: UIColor(hex: 0xA9A69E))
    }
  }
}

/// Colours shared by every finish (`deviceColors`, `lcd` in theme.ts).
enum InsertInk {
  static let key1 = UIColor(hex: 0xF4F3EF)
  static let key2 = UIColor(hex: 0xDEDBD4)
  static let keyInk = UIColor(hex: 0x2A2925)
  static let plate = UIColor(hex: 0xC9C6BE)
  static let lampOff = UIColor(hex: 0x8E8A80)
  static let lcd = UIColor(hex: 0x121211)
  static let amber = UIColor(hex: 0xFF6A1A)
  static let amberDim = UIColor(hex: 0x7A3E1C)
  static let amberOff = UIColor(hex: 0x3A2214)
  /// The boot flicker's two lit grounds (prototype `@keyframes boot`).
  static let bootFlash1 = UIColor(hex: 0x3A2214)
  static let bootFlash2 = UIColor(hex: 0x2A1A10)
  static let disabledHi = UIColor(hex: 0x9E9E9E)
  static let disabledLo = UIColor(hex: 0x717171)
  static let disabledLip = UIColor(hex: 0x515151)
  static let cartTop = UIColor(hex: 0xDAD7D0)
  static let cartBottom = UIColor(hex: 0xB7B3AA)
  static let cartInk = UIColor(hex: 0x8E8A80)
  static let backdropIn = UIColor(hex: 0x1D1C1A)
  static let backdropOut = UIColor(hex: 0x0B0B0A)
  static let benchIn = UIColor(hex: 0x3A3733)
  static let benchOut = UIColor(hex: 0x121110)
}

// MARK: - Layout

/// Where the device's parts sit, in the device's CSS frame. Mirrors SPEC §4's layout rule so the
/// last frame (the device face-on, full size) lines up with the JS device that replaces it.
struct InsertLayout: Equatable, Sendable {
  var size: CGSize
  var menuKey: CGRect
  var rocker: CGRect
  var display: CGRect
  var well: CGRect
  var bigKey: CGRect

  static let bodyRadius: CGFloat = 52

  /// `topRowY`, `displayY`, `displayHeight` and `wellY` override SPEC §4's defaults when the JS
  /// device measured something else.
  static func make(
    size: CGSize, safeTop: CGFloat, safeBottom: CGFloat,
    topRowY: CGFloat? = nil, displayY: CGFloat? = nil, displayHeight: CGFloat? = nil, wellY: CGFloat? = nil
  ) -> InsertLayout {
    let w = size.width
    let h = size.height
    // Reference 390 × 844: status bar 47 → top row 56; home indicator 34 → well 590.
    let top = topRowY ?? (safeTop + 9)
    let wellTop = wellY ?? (h - safeBottom - 220)
    let dispY = displayY ?? (top + 84)
    let dispH = displayHeight ?? max(120, wellTop - 30 - dispY)
    return InsertLayout(
      size: size,
      menuKey: CGRect(x: 20, y: top, width: 56, height: 56),
      rocker: CGRect(x: w / 2 - 99, y: top, width: 198, height: 56),
      display: CGRect(x: 20, y: dispY, width: w - 40, height: dispH),
      well: CGRect(x: w / 2 - 85, y: wellTop, width: 170, height: 170),
      bigKey: CGRect(x: w / 2 - 73, y: wellTop + 10, width: 146, height: 146)
    )
  }

  /// The rocker's recessed middle strip (`.plate.rocker .mid`).
  var rockerStrip: CGRect {
    CGRect(x: rocker.minX + 46, y: rocker.midY - 15, width: rocker.width - 92, height: 30)
  }

  /// Lamp centres in the strip: 10 pt lamps 7 apart, closer when the week doesn't fit.
  func lampCenters(count: Int) -> [CGPoint] {
    guard count > 0 else { return [] }
    let strip = rockerStrip
    let lamp: CGFloat = 10
    var gap: CGFloat = 7
    if count > 1 {
      gap = min(7, max(2, (strip.width - 8 - CGFloat(count) * lamp) / CGFloat(count - 1)))
    }
    let total = CGFloat(count) * lamp + CGFloat(count - 1) * gap
    let x0 = strip.midX - total / 2 + lamp / 2
    return (0..<count).map { CGPoint(x: x0 + CGFloat($0) * (lamp + gap), y: strip.midY) }
  }
}

// MARK: - Drawing helpers

enum Art {
  static func image(
    _ size: CGSize, scale: CGFloat, opaque: Bool = false, _ draw: (CGContext) -> Void
  ) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = opaque
    return UIGraphicsImageRenderer(size: size, format: format).image { draw($0.cgContext) }
  }

  /// A rounded rect with per-corner radii (CSS `border-radius: tl tr br bl`).
  static func roundedPath(_ r: CGRect, tl: CGFloat, tr: CGFloat, br: CGFloat, bl: CGFloat) -> CGPath {
    let p = CGMutablePath()
    p.move(to: CGPoint(x: r.minX + tl, y: r.minY))
    p.addLine(to: CGPoint(x: r.maxX - tr, y: r.minY))
    p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.minY), tangent2End: CGPoint(x: r.maxX, y: r.minY + tr), radius: tr)
    p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - br))
    p.addArc(tangent1End: CGPoint(x: r.maxX, y: r.maxY), tangent2End: CGPoint(x: r.maxX - br, y: r.maxY), radius: br)
    p.addLine(to: CGPoint(x: r.minX + bl, y: r.maxY))
    p.addArc(tangent1End: CGPoint(x: r.minX, y: r.maxY), tangent2End: CGPoint(x: r.minX, y: r.maxY - bl), radius: bl)
    p.addLine(to: CGPoint(x: r.minX, y: r.minY + tl))
    p.addArc(tangent1End: CGPoint(x: r.minX, y: r.minY), tangent2End: CGPoint(x: r.minX + tl, y: r.minY), radius: tl)
    p.closeSubpath()
    return p
  }

  static func roundedPath(_ r: CGRect, radius: CGFloat) -> CGPath {
    let k = min(radius, r.width / 2, r.height / 2)
    return roundedPath(r, tl: k, tr: k, br: k, bl: k)
  }

  static func linearGradient(_ ctx: CGContext, _ colors: [UIColor], _ locations: [CGFloat], from: CGPoint, to: CGPoint) {
    guard let g = CGGradient(
      colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: colors.map(\.cgColor) as CFArray, locations: locations)
    else { return }
    ctx.drawLinearGradient(g, start: from, end: to, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
  }

  /// CSS `radial-gradient(ellipse rx ry at center, …)`: stops at fractions of the ellipse.
  static func ellipseGradient(
    _ ctx: CGContext, center: CGPoint, rx: CGFloat, ry: CGFloat, _ colors: [UIColor], _ locations: [CGFloat]
  ) {
    guard rx > 0, ry > 0, let g = CGGradient(
      colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: colors.map(\.cgColor) as CFArray, locations: locations)
    else { return }
    ctx.saveGState()
    ctx.translateBy(x: center.x, y: center.y)
    ctx.scaleBy(x: rx / ry, y: 1)
    ctx.drawRadialGradient(g, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: ry, options: [.drawsAfterEndLocation])
    ctx.restoreGState()
  }

  /// CSS `box-shadow: inset 0 dy blur color` inside `path`.
  static func innerShadow(_ ctx: CGContext, _ path: CGPath, dy: CGFloat, blur: CGFloat, color: UIColor) {
    let box = path.boundingBox.insetBy(dx: -blur * 3 - abs(dy) - 20, dy: -blur * 3 - abs(dy) - 20)
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    let ring = CGMutablePath()
    ring.addRect(box)
    ring.addPath(path)
    ctx.setShadow(offset: CGSize(width: 0, height: dy), blur: blur, color: color.cgColor)
    ctx.addPath(ring)
    ctx.setFillColor(UIColor.black.cgColor)
    ctx.fillPath(using: .evenOdd)
    ctx.restoreGState()
  }

  /// CSS `box-shadow: inset 0 dy 0 color` (a hard crescent along one edge).
  static func innerEdge(_ ctx: CGContext, _ path: CGPath, dy: CGFloat, color: UIColor) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    var shift = CGAffineTransform(translationX: 0, y: dy)
    let ring = CGMutablePath()
    ring.addRect(path.boundingBox.insetBy(dx: -4, dy: -abs(dy) - 4))
    if let moved = path.copy(using: &shift) { ring.addPath(moved) }
    ctx.addPath(ring)
    ctx.setFillColor(color.cgColor)
    ctx.fillPath(using: .evenOdd)
    ctx.restoreGState()
  }

  /// CSS `box-shadow: inset 0 0 0 width color`.
  static func innerOutline(_ ctx: CGContext, _ path: CGPath, width: CGFloat, color: UIColor) {
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    ctx.addPath(path)
    ctx.setStrokeColor(color.cgColor)
    ctx.setLineWidth(width * 2)
    ctx.strokePath()
    ctx.restoreGState()
  }

  static func fill(_ ctx: CGContext, _ path: CGPath, _ color: UIColor) {
    ctx.addPath(path)
    ctx.setFillColor(color.cgColor)
    ctx.fillPath()
  }

  // MARK: Text

  static func lcdFont(_ size: CGFloat) -> UIFont {
    UIFont(name: "Doto-Black", size: size) ?? UIFont.monospacedSystemFont(ofSize: size, weight: .black)
  }

  static func roundedFont(_ size: CGFloat, _ weight: UIFont.Weight) -> UIFont {
    let base = UIFont.systemFont(ofSize: size, weight: weight)
    guard let rounded = base.fontDescriptor.withDesign(.rounded) else { return base }
    return UIFont(descriptor: rounded, size: size)
  }

  enum Align { case left, right, center }

  /// Draws one line in a CSS line box (`top`, `lineHeight`): glyphs centred in the box (half-leading).
  static func drawLine(
    _ text: String, font: UIFont, color: UIColor, x: CGFloat, width: CGFloat, top: CGFloat,
    lineHeight: CGFloat, align: Align = .left, kern: CGFloat = 0
  ) {
    var attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
    if kern != 0 { attrs[.kern] = kern }
    let s = NSAttributedString(string: text, attributes: attrs)
    let w = s.size().width
    let glyphBox = font.ascender - font.descender
    let y = top + (lineHeight - glyphBox) / 2
    let left: CGFloat
    switch align {
    case .left: left = x
    case .right: left = x + width - w
    case .center: left = x + (width - w) / 2
    }
    s.draw(at: CGPoint(x: left, y: y))
  }

  static func textWidth(_ text: String, _ font: UIFont) -> CGFloat {
    (text as NSString).size(withAttributes: [.font: font]).width
  }

  /// Greedy word wrap (CSS `white-space: normal`); words longer than a line break by character.
  /// Past `maxLines` the last line ends in an ellipsis.
  static func wrap(_ text: String, font: UIFont, width: CGFloat, maxLines: Int) -> [String] {
    var lines: [String] = []
    var current = ""
    func push(_ line: String) { lines.append(line) }
    for word in text.split(separator: " ").map(String.init) {
      let candidate = current.isEmpty ? word : current + " " + word
      if textWidth(candidate, font) <= width {
        current = candidate
        continue
      }
      if !current.isEmpty { push(current) }
      current = ""
      var chunk = ""
      for ch in word {
        if textWidth(chunk + String(ch), font) > width, !chunk.isEmpty {
          push(chunk)
          chunk = ""
        }
        chunk.append(ch)
      }
      current = chunk
    }
    if !current.isEmpty { push(current) }
    guard lines.count > maxLines else { return lines }
    var kept = Array(lines.prefix(maxLines))
    var last = kept[maxLines - 1]
    while !last.isEmpty, textWidth(last + "…", font) > width { last.removeLast() }
    kept[maxLines - 1] = last + "…"
    return kept
  }
}

// MARK: - The device face

enum DeviceFaceArt {
  /// The body face with its keys, the display panel, the well and the disabled Start key, as
  /// the device looks while loading (prototype `activate()`: menu key, week rocker with unlit
  /// lamps, no right key, wheel stowed, Start greyed).
  static func face(layout: InsertLayout, finish: InsertFinish, lampCount: Int, scale: CGFloat) -> UIImage {
    let size = layout.size
    return Art.image(size, scale: scale, opaque: true) { ctx in
      let bounds = CGRect(origin: .zero, size: size)
      // Body: gradient, brushing, sheen.
      Art.linearGradient(ctx, [finish.body1, finish.body2], [0, 1], from: .zero, to: CGPoint(x: 0, y: size.height))
      ctx.setFillColor(UIColor(white: 1, alpha: 0.06).cgColor)
      var x: CGFloat = 0
      while x < size.width {
        ctx.fill(CGRect(x: x, y: 0, width: 1, height: size.height))
        x += 3
      }
      ctx.setFillColor(UIColor(white: 0, alpha: 0.02).cgColor)
      x = 1
      while x < size.width {
        ctx.fill(CGRect(x: x, y: 0, width: 2, height: size.height))
        x += 3
      }
      Art.linearGradient(
        ctx, [UIColor(white: 1, alpha: 0.35), UIColor(white: 1, alpha: 0)], [0, 1],
        from: .zero, to: CGPoint(x: 0, y: size.height * 0.4))
      // The body's rim (`#dev .body` box-shadow).
      let outline = Art.roundedPath(bounds, radius: InsertLayout.bodyRadius)
      Art.innerEdge(ctx, outline, dy: 2, color: UIColor(white: 1, alpha: 0.65))
      Art.innerOutline(ctx, outline, width: 1.5, color: UIColor(white: 1, alpha: 0.35))

      raisedKey(ctx, rect: layout.menuKey, radius: 28, finish: finish)
      menuGlyph(ctx, center: CGPoint(x: layout.menuKey.midX, y: layout.menuKey.midY))

      raisedKey(ctx, rect: layout.rocker, radius: 28, finish: finish)
      let strip = Art.roundedPath(layout.rockerStrip, radius: 15)
      Art.fill(ctx, strip, InsertInk.plate)
      Art.innerShadow(ctx, strip, dy: 2, blur: 4, color: UIColor(white: 0, alpha: 0.25))
      ctx.setFillColor(InsertInk.lampOff.cgColor)
      for c in layout.lampCenters(count: lampCount) {
        ctx.fillEllipse(in: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10))
      }

      // Display panel (`.disp`): light catch below, lcd ground, deep inset shadow.
      let panel = Art.roundedPath(layout.display, radius: 28)
      var down = CGAffineTransform(translationX: 0, y: 1)
      if let catchPath = panel.copy(using: &down) { Art.fill(ctx, catchPath, UIColor(white: 1, alpha: 0.5)) }
      Art.fill(ctx, panel, InsertInk.lcd)
      Art.innerShadow(ctx, panel, dy: 3, blur: 10, color: UIColor(white: 0, alpha: 0.8))

      // Well (`.well`).
      let well = CGPath(ellipseIn: layout.well, transform: nil)
      // The light catch is an outer shadow: it only shows outside the well.
      var wellDown = CGAffineTransform(translationX: 0, y: 1)
      if let catchPath = well.copy(using: &wellDown) {
        ctx.saveGState()
        ctx.addRect(bounds)
        ctx.addPath(well)
        ctx.clip(using: .evenOdd)
        Art.fill(ctx, catchPath, UIColor(white: 1, alpha: 0.6))
        ctx.restoreGState()
      }
      Art.fill(ctx, well, UIColor(white: 0, alpha: 0.14))
      Art.innerShadow(ctx, well, dy: 4, blur: 10, color: UIColor(white: 0, alpha: 0.28))

      disabledBigKey(ctx, rect: layout.bigKey)
    }
  }

  /// `.rk`: drop shadow, lip, gradient body and a 1 pt top highlight.
  static func raisedKey(_ ctx: CGContext, rect: CGRect, radius: CGFloat, finish: InsertFinish) {
    let path = Art.roundedPath(rect, radius: radius)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: 6), blur: 10, color: UIColor(white: 0, alpha: 0.1).cgColor)
    var lipShift = CGAffineTransform(translationX: 0, y: 3)
    if let lip = path.copy(using: &lipShift) { Art.fill(ctx, lip, finish.keyEdge) }
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(path)
    ctx.clip()
    Art.linearGradient(ctx, [InsertInk.key1, InsertInk.key2], [0, 1], from: CGPoint(x: 0, y: rect.minY), to: CGPoint(x: 0, y: rect.maxY))
    ctx.restoreGState()
    Art.innerEdge(ctx, path, dy: 1, color: .white)
  }

  /// The prototype's menu glyph (two sliders), 22 × 22 centred.
  static func menuGlyph(_ ctx: CGContext, center: CGPoint) {
    ctx.saveGState()
    ctx.translateBy(x: center.x - 11, y: center.y - 11)
    ctx.setStrokeColor(InsertInk.keyInk.cgColor)
    ctx.setLineCap(.round)
    ctx.setLineWidth(2.6)
    ctx.strokeLineSegments(between: [CGPoint(x: 3, y: 6), CGPoint(x: 19, y: 6), CGPoint(x: 3, y: 16), CGPoint(x: 19, y: 16)])
    ctx.setLineWidth(2.4)
    for c in [CGPoint(x: 8, y: 6), CGPoint(x: 14, y: 16)] {
      let r = CGRect(x: c.x - 3, y: c.y - 3, width: 6, height: 6)
      ctx.setFillColor(InsertInk.key1.cgColor)
      ctx.fillEllipse(in: r)
      ctx.strokeEllipse(in: r)
    }
    ctx.restoreGState()
  }

  /// `.big[disabled]`: the primary key through grayscale at 50% opacity, labelled Start.
  static func disabledBigKey(_ ctx: CGContext, rect: CGRect) {
    let circle = CGPath(ellipseIn: rect, transform: nil)
    ctx.saveGState()
    ctx.setAlpha(0.5)
    ctx.beginTransparencyLayer(auxiliaryInfo: nil)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: 16), blur: 26, color: UIColor(white: 0, alpha: 0.14).cgColor)
    var lipShift = CGAffineTransform(translationX: 0, y: 6)
    if let lip = circle.copy(using: &lipShift) { Art.fill(ctx, lip, InsertInk.disabledLip) }
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(circle)
    ctx.clip()
    // radial-gradient(ellipse at 50% 22%, hi, lo 70%): farthest-corner sizing.
    let k = sqrt(1 + pow(0.78 / 0.22, 2))
    Art.ellipseGradient(
      ctx, center: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.22),
      rx: rect.width * 0.5 * k, ry: rect.height * 0.22 * k,
      [InsertInk.disabledHi, InsertInk.disabledLo], [0, 0.7])
    ctx.restoreGState()
    Art.innerEdge(ctx, circle, dy: 2, color: UIColor(white: 1, alpha: 0.45))
    Art.drawLine(
      "Start", font: Art.roundedFont(24, .heavy), color: .white, x: rect.minX, width: rect.width,
      top: rect.midY - 14, lineHeight: 28, align: .center)
    ctx.endTransparencyLayer()
    ctx.restoreGState()
  }

  /// The body's sides: the finish gradient top to bottom (v), darker towards the back (u), as
  /// the prototype's 22 edge layers (brightness .70 at the front to .38 at the back).
  static func side(finish: InsertFinish) -> UIImage {
    let size = CGSize(width: 32, height: 256)
    return Art.image(size, scale: 1, opaque: true) { ctx in
      Art.linearGradient(ctx, [finish.body1, finish.body2], [0, 1], from: .zero, to: CGPoint(x: 0, y: size.height))
      // brightness(k) = black at 1 − k over it.
      Art.linearGradient(
        ctx, [UIColor(white: 0, alpha: 0.30), UIColor(white: 0, alpha: 0.62)], [0, 1],
        from: .zero, to: CGPoint(x: size.width, y: 0))
    }
  }
}

// MARK: - Display contents (transparent, display-sized)

enum DisplayArt {
  private static let pad: CGFloat = 22

  /// `SLOT  EMPTY` header (`.hd.dim`).
  static func slotHeader(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { _ in
      header(left: "SLOT", right: "EMPTY", width: size.width)
    }
  }

  /// `INSERT PLAN` at top 150, Doto 40/44 (it blinks).
  static func insertPlan(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { _ in
      let font = Art.lcdFont(40)
      Art.drawLine("INSERT", font: font, color: InsertInk.amber, x: pad, width: size.width - 2 * pad, top: 150, lineHeight: 44)
      Art.drawLine("PLAN", font: font, color: InsertInk.amber, x: pad, width: size.width - 2 * pad, top: 194, lineHeight: 44)
    }
  }

  /// `LOADED 0/n`, the plan name and the empty load bar (prototype, at the click).
  static func loaded(size: CGSize, planName: String, dayCount: Int, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { ctx in
      header(left: "LOADED", right: "0/\(dayCount)", width: size.width)
      let font = Art.lcdFont(40)
      let lines = Art.wrap(planName.uppercased(), font: font, width: size.width - 2 * pad, maxLines: 2)
      for (i, line) in lines.enumerated() {
        Art.drawLine(line, font: font, color: InsertInk.amber, x: pad, width: size.width - 2 * pad, top: 54 + CGFloat(i) * 44, lineHeight: 44)
      }
      // `.ldbar`: 10 cells, gap 4, 16 tall, 22 from the bottom.
      let barW = size.width - 2 * pad
      let cell = (barW - 9 * 4) / 10
      ctx.setFillColor(InsertInk.amberOff.cgColor)
      for i in 0..<10 {
        ctx.fill(CGRect(x: pad + CGFloat(i) * (cell + 4), y: size.height - 22 - 16, width: cell, height: 16))
      }
    }
  }

  /// A white rounded panel the boot flicker tints (`multiply`).
  static func panelMask(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { ctx in
      Art.fill(ctx, Art.roundedPath(CGRect(origin: .zero, size: size), radius: 28), .white)
    }
  }

  private static func header(left: String, right: String, width: CGFloat) {
    let font = Art.lcdFont(15)
    Art.drawLine(left, font: font, color: InsertInk.amberDim, x: pad, width: width - 2 * pad, top: 20, lineHeight: 18)
    Art.drawLine(right, font: font, color: InsertInk.amberDim, x: pad, width: width - 2 * pad, top: 20, lineHeight: 18, align: .right)
  }
}

// MARK: - The cartridge

enum CartridgeArt {
  static let size = CGSize(width: 160, height: 190)
  /// `.c3 .f` border-radius: 9 22 6 6.
  static let radii = (tl: CGFloat(9), tr: CGFloat(22), br: CGFloat(6), bl: CGFloat(6))

  static func outline() -> CGPath {
    Art.roundedPath(CGRect(origin: .zero, size: size), tl: radii.tl, tr: radii.tr, br: radii.br, bl: radii.bl)
  }

  /// The front: grey plastic, grip ridges, the dark label (plan name, days), TRIM and the arrow.
  static func front(planName: String, days: [String], scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { ctx in
      let shape = outline()
      ctx.saveGState()
      ctx.addPath(shape)
      ctx.clip()
      Art.linearGradient(ctx, [InsertInk.cartTop, InsertInk.cartBottom], [0, 1], from: .zero, to: CGPoint(x: 0, y: size.height))
      ctx.restoreGState()
      Art.innerEdge(ctx, shape, dy: 2, color: UIColor(white: 1, alpha: 0.65))
      Art.innerEdge(ctx, shape, dy: -3, color: UIColor(white: 0, alpha: 0.08))

      // Grip ridges (`.rid`): 2 pt dark lines every 6 pt.
      let ridges = CGRect(x: 18, y: 10, width: size.width - 18 - 30, height: 14)
      ctx.saveGState()
      ctx.addPath(Art.roundedPath(ridges, radius: 3))
      ctx.clip()
      ctx.setFillColor(UIColor(white: 0, alpha: 0.18).cgColor)
      var x = ridges.minX
      while x < ridges.maxX {
        ctx.fill(CGRect(x: x, y: ridges.minY, width: 2, height: ridges.height))
        x += 6
      }
      ctx.restoreGState()

      // Label (`.lbl`).
      let label = CGRect(x: 14, y: 34, width: size.width - 28, height: 118)
      let labelPath = Art.roundedPath(label, radius: 7)
      Art.fill(ctx, labelPath, InsertInk.lcd)
      Art.innerShadow(ctx, labelPath, dy: 2, blur: 5, color: UIColor(white: 0, alpha: 0.8))
      ctx.saveGState()
      ctx.addPath(labelPath)
      ctx.clip()
      let textX = label.minX + 12
      let textW = label.width - 24
      let nameFont = Art.lcdFont(17)
      let nameLines = Art.wrap(planName.uppercased(), font: nameFont, width: textW, maxLines: 3)
      var y = label.minY + 10
      for line in nameLines {
        Art.drawLine(line, font: nameFont, color: InsertInk.amber, x: textX, width: textW, top: y, lineHeight: 19)
        y += 19
      }
      y += 8
      let dayFont = Art.lcdFont(10)
      for day in days {
        let line = Art.wrap(day.uppercased(), font: dayFont, width: textW, maxLines: 1).first ?? ""
        Art.drawLine(line, font: dayFont, color: InsertInk.amberDim, x: textX, width: textW, top: y, lineHeight: 15)
        y += 15
        if y > label.maxY { break }
      }
      ctx.restoreGState()

      // TRIM, embossed (a light catch under dark ink), and the arrow (`.brand`, `.arrow`).
      let brandFont = Art.roundedFont(11, .black)
      Art.drawLine("TRIM", font: brandFont, color: UIColor(white: 1, alpha: 0.55), x: 14, width: 60, top: size.height - 10 - 14 + 1, lineHeight: 14, kern: 2)
      Art.drawLine("TRIM", font: brandFont, color: InsertInk.cartInk, x: 14, width: 60, top: size.height - 10 - 14, lineHeight: 14, kern: 2)
      let ax = size.width - 16 - 12
      let ay = size.height - 9 - 9
      let arrow = CGMutablePath()
      arrow.move(to: CGPoint(x: ax, y: ay))
      arrow.addLine(to: CGPoint(x: ax + 12, y: ay))
      arrow.addLine(to: CGPoint(x: ax + 6, y: ay + 9))
      arrow.closeSubpath()
      Art.fill(ctx, arrow, InsertInk.cartInk)
    }
  }

  /// The cartridge's edge: `.c3 .t` (#8E8A80) at brightness .7.
  static let sideColor = InsertInk.cartInk.brightened(0.7)
}

// MARK: - Glows and the scene

enum GlowArt {
  /// The slot glow (`.slotglow`): a 180 × 10 orange pill with an 18 pt glow spread 6. Returns
  /// the image and the padding around the pill.
  static func slot(scale: CGFloat) -> (UIImage, CGFloat) {
    let pad: CGFloat = 44
    let pill = CGRect(x: pad, y: pad, width: 180, height: 10)
    let image = Art.image(CGSize(width: 180 + pad * 2, height: 10 + pad * 2), scale: scale) { ctx in
      ctx.saveGState()
      ctx.setShadow(offset: .zero, blur: 18, color: InsertInk.amber.withAlphaComponent(0.7).cgColor)
      Art.fill(ctx, Art.roundedPath(pill.insetBy(dx: -6, dy: -6), radius: 11), InsertInk.amber.withAlphaComponent(0.7))
      ctx.restoreGState()
      Art.fill(ctx, Art.roundedPath(pill, radius: 5), InsertInk.amber)
    }
    return (image, pad)
  }

  /// A lit lamp: amber with a 6 pt glow (`.plate.rocker .lamp.on`). 26 × 26, lamp centred.
  static func lamp(scale: CGFloat) -> UIImage {
    Art.image(CGSize(width: 26, height: 26), scale: scale) { ctx in
      ctx.setShadow(offset: .zero, blur: 6, color: InsertInk.amber.cgColor)
      ctx.setFillColor(InsertInk.amber.cgColor)
      ctx.fillEllipse(in: CGRect(x: 8, y: 8, width: 10, height: 10))
    }
  }

  /// The pulse ring (`.pulse`): a 340 circle's 2 pt orange ring (.5) and a 40 pt glow spread 6
  /// outside it. Returns the image and its side length.
  static func pulse(scale: CGFloat) -> UIImage {
    let side: CGFloat = 340 + 2 * 100
    let c = CGPoint(x: side / 2, y: side / 2)
    return Art.image(CGSize(width: side, height: side), scale: scale) { ctx in
      // Glow: the spread circle's shadow only, then cut the inside (an outer box-shadow).
      let spread = CGRect(x: c.x - 176, y: c.y - 176, width: 352, height: 352)
      ctx.saveGState()
      ctx.setShadow(offset: CGSize(width: 0, height: 2000), blur: 40, color: InsertInk.amber.withAlphaComponent(0.25).cgColor)
      ctx.fillEllipse(in: spread.offsetBy(dx: 0, dy: -2000))
      ctx.restoreGState()
      ctx.saveGState()
      ctx.setBlendMode(.clear)
      ctx.fillEllipse(in: CGRect(x: c.x - 170, y: c.y - 170, width: 340, height: 340))
      ctx.restoreGState()
      ctx.setStrokeColor(InsertInk.amber.withAlphaComponent(0.5).cgColor)
      ctx.setLineWidth(2)
      ctx.strokeEllipse(in: CGRect(x: c.x - 171, y: c.y - 171, width: 342, height: 342))
    }
  }

  /// The soft shadow under the device (`.devshadow`): 270 × 46, black .6 → 0 at 70%.
  static func deviceShadow(scale: CGFloat) -> UIImage {
    Art.image(CGSize(width: 270, height: 46), scale: scale) { ctx in
      // `radial-gradient(ellipse, …)` = farthest-corner from the centre.
      let k = sqrt(2.0)
      Art.ellipseGradient(
        ctx, center: CGPoint(x: 135, y: 23), rx: 135 * k, ry: 23 * k,
        [UIColor(white: 0, alpha: 0.6), UIColor(white: 0, alpha: 0)], [0, 0.7])
    }
  }

  /// `.phone`'s own ground, seen around the device before the scene is in.
  static func bench(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale, opaque: true) { ctx in
      let k = sqrt(1 + pow(0.55 / 0.45, 2))
      Art.ellipseGradient(
        ctx, center: CGPoint(x: size.width * 0.5, y: size.height * 0.45),
        rx: size.width * 0.5 * k, ry: size.height * 0.45 * k,
        [InsertInk.benchIn, InsertInk.benchOut], [0, 0.75])
    }
  }

  /// `.backdrop`: radial ellipse 80% 55% at 50% 42%, #1D1C1A → #0B0B0A at 75%.
  static func backdrop(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale, opaque: true) { ctx in
      ctx.setFillColor(InsertInk.backdropOut.cgColor)
      ctx.fill(CGRect(origin: .zero, size: size))
      Art.ellipseGradient(
        ctx, center: CGPoint(x: size.width * 0.5, y: size.height * 0.42),
        rx: size.width * 0.8, ry: size.height * 0.55,
        [InsertInk.backdropIn, InsertInk.backdropOut], [0, 0.75])
    }
  }

  /// `.vig`: radial ellipse 75% 65% at 50% 48%, clear at 55% → black .7.
  static func vignette(size: CGSize, scale: CGFloat) -> UIImage {
    Art.image(size, scale: scale) { ctx in
      ctx.setFillColor(UIColor(white: 0, alpha: 0.7).cgColor)
      ctx.fill(CGRect(origin: .zero, size: size))
      ctx.setBlendMode(.copy)
      Art.ellipseGradient(
        ctx, center: CGPoint(x: size.width * 0.5, y: size.height * 0.48),
        rx: size.width * 0.75, ry: size.height * 0.65,
        [UIColor(white: 0, alpha: 0), UIColor(white: 0, alpha: 0), UIColor(white: 0, alpha: 0.7)], [0, 0.55, 1])
    }
  }

  /// One tile row of the grid floor: 1.5 pt white .14 lines every 44 pt, `width` wide and
  /// `height` tall (a multiple of 44), lines at the top and left of each cell.
  static func grid(width: CGFloat, height: CGFloat, originX: CGFloat, scale: CGFloat) -> UIImage {
    Art.image(CGSize(width: width, height: height), scale: scale) { ctx in
      ctx.setFillColor(UIColor(white: 1, alpha: 0.14).cgColor)
      var y: CGFloat = 0
      while y < height {
        ctx.fill(CGRect(x: 0, y: y, width: width, height: 1.5))
        y += 44
      }
      var x = originX
      while x < width {
        // Where a vertical line crosses a horizontal one CSS paints both layers (alpha adds).
        ctx.fill(CGRect(x: x, y: 0, width: 1.5, height: height))
        x += 44
      }
    }
  }
}

// MARK: - Everything the view needs, drawn in one go (off the main thread)

struct InsertArtSet: @unchecked Sendable {
  struct Inputs: Sendable {
    let layout: InsertLayout
    let finish: String
    let planName: String
    let days: [String]
    let scale: CGFloat
  }

  static let floorWidthFactor: CGFloat = 2.2
  static let floorHeight: CGFloat = 420

  let inputs: Inputs
  let bench, backdrop, vignette, grid, pulse, deviceShadow: UIImage
  let face, side, panelMask, slotHeader, insertPlan, loaded, lamp, slotGlow, cartridge: UIImage
  let slotGlowPad: CGFloat

  static func render(_ inputs: Inputs) -> InsertArtSet {
    let lay = inputs.layout
    let size = lay.size
    let scale = inputs.scale
    let finish = InsertFinish.named(inputs.finish)
    let dispSize = lay.display.size
    let (slotGlow, pad) = GlowArt.slot(scale: scale)
    let floorW = size.width * floorWidthFactor
    return InsertArtSet(
      inputs: inputs,
      bench: GlowArt.bench(size: size, scale: 1),
      backdrop: GlowArt.backdrop(size: size, scale: 1),
      vignette: GlowArt.vignette(size: size, scale: 1),
      grid: GlowArt.grid(width: floorW, height: floorHeight + 44, originX: 0, scale: 2),
      pulse: GlowArt.pulse(scale: 2),
      deviceShadow: GlowArt.deviceShadow(scale: 2),
      face: DeviceFaceArt.face(layout: lay, finish: finish, lampCount: inputs.days.count, scale: scale),
      side: DeviceFaceArt.side(finish: finish),
      panelMask: DisplayArt.panelMask(size: dispSize, scale: 1),
      slotHeader: DisplayArt.slotHeader(size: dispSize, scale: scale),
      insertPlan: DisplayArt.insertPlan(size: dispSize, scale: scale),
      loaded: DisplayArt.loaded(size: dispSize, planName: inputs.planName, dayCount: inputs.days.count, scale: scale),
      lamp: GlowArt.lamp(scale: scale),
      slotGlow: slotGlow,
      cartridge: CartridgeArt.front(planName: inputs.planName, days: inputs.days, scale: scale),
      slotGlowPad: pad
    )
  }
}
