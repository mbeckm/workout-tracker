import SwiftUI

enum AppColor {
    static let base = Color(hex: 0x0D0D0D)
    static let surface1 = Color(hex: 0x1A1A1A)
    static let surface2 = Color(hex: 0x242424)
    static let border = Color(hex: 0x2E2E2E)
    static let primaryText = Color.white
    static let secondaryText = Color(hex: 0x8A8A8A)
    static let tertiaryText = Color(hex: 0x4A4A4A)
    static let accent = Color(hex: 0xA8FF3E)
    static let destructive = Color(hex: 0xFF6B6B)
}

enum AppFont {
    static let display = Font.inter(size: 32, weight: .bold, relativeTo: .largeTitle)
    static let h1 = Font.inter(size: 24, weight: .semibold, relativeTo: .title2)
    static let h2 = Font.inter(size: 20, weight: .semibold, relativeTo: .title3)
    static let subheading = Font.inter(size: 16, weight: .medium, relativeTo: .headline)
    static let body = Font.inter(size: 15, weight: .regular, relativeTo: .body)
    static let label = Font.inter(size: 13, weight: .medium, relativeTo: .caption)
    static let caption = Font.inter(size: 12, weight: .regular, relativeTo: .caption2)
}

extension Font {
    static func inter(size: CGFloat, weight: Font.Weight, relativeTo textStyle: Font.TextStyle) -> Font {
        .custom("Inter", size: size, relativeTo: textStyle).weight(weight)
    }
}

extension Color {
    init(hex: UInt, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

enum Haptics {
    static func tap(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}
