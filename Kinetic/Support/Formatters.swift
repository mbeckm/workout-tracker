import Foundation

extension Date {
	var kineticHistoryDate: String {
		formatted(.dateTime.month(.abbreviated).day().hour().minute())
	}
}

extension Double {
	var kineticWeightText: String {
		if rounded() == self {
			return "\(Int(self))"
		}
		return formatted(.number.precision(.fractionLength(1)))
	}

	var kineticVolumeText: String {
		if self >= 1_000 {
			return formatted(.number.precision(.fractionLength(0)))
		}
		return kineticWeightText
	}
}
