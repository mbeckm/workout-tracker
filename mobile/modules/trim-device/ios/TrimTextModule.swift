import ExpoModulesCore
import UIKit
import Vision

/// On-device text recognition (Apple Vision) for importing plans from screenshots.
/// JS: `recognizeTextInImage` in modules/trim-device/text.ts.
public class TrimTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrimText")

    AsyncFunction("recognizeText") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try TextRecognizer.lines(in: uri))
        } catch let error as Exception {
          promise.reject(error)
        } catch {
          promise.reject(RecognitionFailedException(error.localizedDescription))
        }
      }
    }
  }
}

final class ImageLoadException: GenericException<String>, @unchecked Sendable {
  override var code: String { "ERR_IMAGE_LOAD" }
  override var reason: String { "Couldn't load the image at \(param)" }
}

final class RecognitionFailedException: GenericException<String>, @unchecked Sendable {
  override var code: String { "ERR_TEXT_RECOGNITION" }
  override var reason: String { "Text recognition failed: \(param)" }
}

private enum TextRecognizer {
  private static let wantedLanguages = ["en-US", "de-DE"]

  /// The image's text as visual lines, top to bottom; cells in a row are joined with two spaces.
  static func lines(in uri: String) throws -> [String] {
    guard let image = loadImage(uri), let cgImage = image.cgImage else {
      throw ImageLoadException(uri.hasPrefix("data:") ? "data URI" : uri)
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    if let supported = try? request.supportedRecognitionLanguages() {
      let languages = wantedLanguages.filter { supported.contains($0) }
      if !languages.isEmpty {
        request.recognitionLanguages = languages
      }
    }
    if #available(iOS 16.0, *) {
      request.automaticallyDetectsLanguage = true
    }

    let handler = VNImageRequestHandler(
      cgImage: cgImage, orientation: CGImagePropertyOrientation(image.imageOrientation))
    try handler.perform([request])

    let cells: [(box: CGRect, text: String)] = (request.results ?? []).compactMap { observation in
      guard let text = observation.topCandidates(1).first?.string else { return nil }
      return (observation.boundingBox, text)
    }
    return group(cells)
  }

  /// A `file://` URI, a plain path, or a base64 `data:image/…` URI (expo-clipboard's pasted image).
  private static func loadImage(_ uri: String) -> UIImage? {
    if uri.hasPrefix("data:") {
      guard let comma = uri.firstIndex(of: ","),
        uri[..<comma].hasSuffix(";base64"),
        let data = Data(base64Encoded: String(uri[uri.index(after: comma)...]), options: .ignoreUnknownCharacters)
      else { return nil }
      return UIImage(data: data)
    }
    let url = uri.hasPrefix("file://") ? (URL(string: uri) ?? URL(fileURLWithPath: uri)) : URL(fileURLWithPath: uri)
    return UIImage(contentsOfFile: url.path)
  }

  /// Vision boxes are normalized with the origin bottom-left, so top-to-bottom is descending midY.
  private static func group(_ cells: [(box: CGRect, text: String)]) -> [String] {
    guard !cells.isEmpty else { return [] }
    let heights = cells.map(\.box.height).sorted()
    let tolerance = heights[heights.count / 2] * 0.5

    var rows: [[(box: CGRect, text: String)]] = []
    var rowCenter: CGFloat = 0
    for cell in cells.sorted(by: { $0.box.midY > $1.box.midY }) {
      if let last = rows.indices.last, abs(cell.box.midY - rowCenter) <= tolerance {
        rows[last].append(cell)
        rowCenter = rows[last].map(\.box.midY).reduce(0, +) / CGFloat(rows[last].count)
      } else {
        rows.append([cell])
        rowCenter = cell.box.midY
      }
    }

    return rows.compactMap { row in
      let line = row.sorted { $0.box.minX < $1.box.minX }
        .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: "  ")
      return line.isEmpty ? nil : line
    }
  }
}

private extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
