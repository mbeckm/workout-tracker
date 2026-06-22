import SwiftUI

enum KineticTheme {
	static let ink = Color(hex: 0x101316)
	static let graphite = Color(hex: 0x1C2228)
	static let slate = Color(hex: 0x68717A)
	static let mist = Color(hex: 0xEEF2F3)
	static let paper = Color(hex: 0xF8FAF7)
	static let volt = Color(hex: 0xC7F464)
	static let ember = Color(hex: 0xFF7A45)
	static let steel = Color(hex: 0x7AA7B7)
	static let line = Color(hex: 0xDCE2E3)

	static let cardRadius: CGFloat = 14
	static let controlRadius: CGFloat = 8
}

extension Color {
	init(hex: UInt, alpha: Double = 1) {
		self.init(
			.sRGB,
			red: Double((hex >> 16) & 0xFF) / 255,
			green: Double((hex >> 8) & 0xFF) / 255,
			blue: Double(hex & 0xFF) / 255,
			opacity: alpha
		)
	}
}

extension View {
	func kineticScreenBackground() -> some View {
		background(KineticTheme.paper.ignoresSafeArea())
	}

	func kineticCard(cornerRadius: CGFloat = KineticTheme.cardRadius) -> some View {
		background(.white, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
			.overlay {
				RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
					.stroke(KineticTheme.line, lineWidth: 1)
			}
	}
}

struct MetricChip: View {
	let title: String
	let value: String
	var tint: Color = KineticTheme.mist

	var body: some View {
		VStack(alignment: .leading, spacing: 3) {
			Text(title.uppercased())
				.font(.caption2.weight(.semibold))
				.foregroundStyle(KineticTheme.slate)
			Text(value)
				.font(.subheadline.weight(.semibold))
				.foregroundStyle(KineticTheme.ink)
				.monospacedDigit()
		}
		.frame(maxWidth: .infinity, alignment: .leading)
		.padding(.horizontal, 12)
		.padding(.vertical, 10)
		.background(tint, in: RoundedRectangle(cornerRadius: KineticTheme.controlRadius, style: .continuous))
	}
}

struct BottomActionBar<Content: View>: View {
	@ViewBuilder var content: Content

	var body: some View {
		content
			.padding(.horizontal, 16)
			.padding(.top, 12)
			.padding(.bottom, 10)
			.background(.regularMaterial)
	}
}
