import SceneKit
import UIKit

/// Extruded slabs for the insert: a convex rounded outline with a front face, a small chamfer,
/// the sides and a back. Units are points; the front face sits at z = 0 and the slab extends
/// back to z = −depth, so a node's origin is the centre of its front face (CSS
/// `transform-origin: 50% 50%` on the face).
enum InsertGeometry {
  /// Points around a rounded rect with per-corner radii, in CSS coordinates (y down).
  static func outline(
    _ r: CGRect, tl: CGFloat, tr: CGFloat, br: CGFloat, bl: CGFloat, segments: Int = 14
  ) -> [CGPoint] {
    var points: [CGPoint] = []
    func corner(_ center: CGPoint, _ radius: CGFloat, from a0: CGFloat) {
      for i in 0...segments {
        let a = (a0 + CGFloat(i) / CGFloat(segments) * 90) * .pi / 180
        points.append(CGPoint(x: center.x + cos(a) * radius, y: center.y + sin(a) * radius))
      }
    }
    corner(CGPoint(x: r.minX + tl, y: r.minY + tl), tl, from: 180)
    corner(CGPoint(x: r.maxX - tr, y: r.minY + tr), tr, from: 270)
    corner(CGPoint(x: r.maxX - br, y: r.maxY - br), br, from: 0)
    corner(CGPoint(x: r.minX + bl, y: r.maxY - bl), bl, from: 90)
    return points
  }

  /// Builds the slab. `rect` is the outline's box in CSS coordinates; UVs on the face map that
  /// box to the whole texture. Sides map u = depth (front → back), v = height (top → bottom).
  /// Materials, in order: face, chamfer, sides, back.
  static func slab(
    rect: CGRect, radii: (tl: CGFloat, tr: CGFloat, br: CGFloat, bl: CGFloat), depth: CGFloat,
    chamfer: CGFloat
  ) -> SCNGeometry {
    let outer = outline(rect, tl: radii.tl, tr: radii.tr, br: radii.br, bl: radii.bl)
    let inset = rect.insetBy(dx: chamfer, dy: chamfer)
    let inner = outline(
      inset, tl: max(radii.tl - chamfer, 0.5), tr: max(radii.tr - chamfer, 0.5),
      br: max(radii.br - chamfer, 0.5), bl: max(radii.bl - chamfer, 0.5))
    let cx = rect.midX
    let cy = rect.midY

    func local(_ p: CGPoint, _ z: CGFloat) -> SCNVector3 {
      SCNVector3(Float(p.x - cx), Float(cy - p.y), Float(z))
    }
    func faceUV(_ p: CGPoint) -> CGPoint {
      CGPoint(x: (p.x - rect.minX) / rect.width, y: (p.y - rect.minY) / rect.height)
    }
    func sideUV(_ p: CGPoint, _ z: CGFloat) -> CGPoint {
      CGPoint(x: min(max(-z / depth, 0), 1), y: (p.y - rect.minY) / rect.height)
    }

    // Visual counter-clockwise from the front (SceneKit's front-face winding).
    var o = outer
    var i = inner
    var area: CGFloat = 0
    for k in 0..<o.count {
      let a = local(o[k], 0)
      let b = local(o[(k + 1) % o.count], 0)
      area += CGFloat(a.x * b.y - b.x * a.y)
    }
    if area < 0 {
      o.reverse()
      i.reverse()
    }
    let n = o.count

    var vertices: [SCNVector3] = []
    var uvs: [CGPoint] = []
    var face: [UInt32] = []
    var bevel: [UInt32] = []
    var sides: [UInt32] = []
    var back: [UInt32] = []

    func add(_ v: SCNVector3, _ uv: CGPoint) -> UInt32 {
      vertices.append(v)
      uvs.append(uv)
      return UInt32(vertices.count - 1)
    }

    // Face: a fan around the centre (the outlines are convex).
    let centre = CGPoint(x: cx, y: cy)
    let c0 = add(local(centre, 0), faceUV(centre))
    let ring = i.map { add(local($0, 0), faceUV($0)) }
    for k in 0..<n {
      face += [c0, ring[k], ring[(k + 1) % n]]
    }

    // Chamfer: the inner outline at the face down to the outer outline at −chamfer.
    let bevelFront = i.map { add(local($0, 0), sideUV($0, 0)) }
    let bevelBack = o.map { add(local($0, -chamfer), sideUV($0, 0)) }
    for k in 0..<n {
      let a = bevelFront[k], b = bevelFront[(k + 1) % n]
      let c = bevelBack[(k + 1) % n], e = bevelBack[k]
      bevel += [a, e, b, b, e, c]
    }

    // Sides.
    let sideFront = o.map { add(local($0, -chamfer), sideUV($0, -chamfer)) }
    let sideBack = o.map { add(local($0, -depth), sideUV($0, -depth)) }
    for k in 0..<n {
      let a = sideFront[k], b = sideFront[(k + 1) % n]
      let c = sideBack[(k + 1) % n], e = sideBack[k]
      sides += [a, e, b, b, e, c]
    }

    // Back.
    let cBack = add(local(centre, -depth), CGPoint(x: 0.5, y: 0.5))
    let backRing = o.map { add(local($0, -depth), faceUV($0)) }
    for k in 0..<n {
      back += [cBack, backRing[(k + 1) % n], backRing[k]]
    }

    let geometry = SCNGeometry(
      sources: [SCNGeometrySource(vertices: vertices), SCNGeometrySource(textureCoordinates: uvs)],
      elements: [face, bevel, sides, back].map { SCNGeometryElement(indices: $0, primitiveType: .triangles) }
    )
    return geometry
  }

  /// An unlit material (the art carries its own light, as the CSS does).
  static func flat(_ contents: Any?) -> SCNMaterial {
    let m = SCNMaterial()
    m.lightingModel = .constant
    m.diffuse.contents = contents
    m.diffuse.mipFilter = .linear
    m.diffuse.minificationFilter = .linear
    m.diffuse.magnificationFilter = .linear
    m.isDoubleSided = false
    return m
  }

  /// A textured overlay plane drawn on top of the face, without writing depth.
  static func overlay(size: CGSize, image: UIImage?, order: Int) -> SCNNode {
    let plane = SCNPlane(width: size.width, height: size.height)
    let m = flat(image)
    m.writesToDepthBuffer = false
    m.blendMode = .alpha
    plane.materials = [m]
    let node = SCNNode(geometry: plane)
    node.renderingOrder = order
    return node
  }
}
