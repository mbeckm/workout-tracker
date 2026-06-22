import UIKit

@MainActor
final class HapticManager {
	static let shared = HapticManager()

	enum Event {
		case selection
		case saved
		case success
		case warning
	}

	private let selectionGenerator = UISelectionFeedbackGenerator()
	private let lightImpact = UIImpactFeedbackGenerator(style: .light)
	private let notificationGenerator = UINotificationFeedbackGenerator()

	private init() {
		selectionGenerator.prepare()
		lightImpact.prepare()
	}

	func fire(_ event: Event) {
		switch event {
		case .selection:
			selectionGenerator.selectionChanged()
		case .saved:
			lightImpact.impactOccurred(intensity: 0.75)
		case .success:
			notificationGenerator.notificationOccurred(.success)
		case .warning:
			notificationGenerator.notificationOccurred(.warning)
		}
	}
}
