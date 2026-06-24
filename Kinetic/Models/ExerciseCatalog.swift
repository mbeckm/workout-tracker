import Foundation

struct ExerciseCatalogSource: Decodable {
	let name: String
	let url: String
	let licenses: [String]
	let generatedAt: String
}

struct ExerciseCatalogItem: Decodable, Hashable, Identifiable {
	let id: String
	let source: String
	let sourceExerciseID: String
	let name: String
	let category: String
	let primaryMuscles: [String]
	let secondaryMuscles: [String]
	let equipment: [String]
	let aliases: [String]

	var primaryMuscleSummary: String {
		primaryMuscles.kineticSummary(fallback: category)
	}

	var secondaryMuscleSummary: String {
		secondaryMuscles.kineticSummary()
	}

	var equipmentSummary: String {
		equipment.kineticSummary(fallback: "Bodyweight")
	}

	var detailSummary: String {
		let muscleText = primaryMuscles.isEmpty ? category : primaryMuscles.kineticSummary()
		return "\(muscleText) - \(equipmentSummary)"
	}
}

enum ExerciseCatalog {
	static let source: ExerciseCatalogSource = payload.source
	static let all: [ExerciseCatalogItem] = payload.exercises

	static var featured: [ExerciseCatalogItem] {
		featuredNames.compactMap { name in
			all.first { $0.name.localizedCaseInsensitiveCompare(name) == .orderedSame }
		}
	}

	static func search(_ query: String, limit: Int = 80) -> [ExerciseCatalogItem] {
		let normalizedQuery = query.kineticSearchNormalized
		guard !normalizedQuery.isEmpty else {
			return Array(featured.prefix(limit))
		}

		let terms = normalizedQuery
			.split(separator: " ")
			.map(String.init)

		return indexed.compactMap { indexedExercise -> (score: Int, exercise: ExerciseCatalogItem)? in
			guard terms.allSatisfy({ indexedExercise.searchText.contains($0) }) else {
				return nil
			}

			var score = 0
			if indexedExercise.name == normalizedQuery {
				score += 1_000
			}
			if indexedExercise.name.hasPrefix(normalizedQuery) {
				score += 700
			}

			for term in terms {
				if indexedExercise.nameWords.contains(where: { $0.hasPrefix(term) }) {
					score += 180
				}
				if indexedExercise.name.contains(term) {
					score += 120
				}
				if indexedExercise.primaryMuscles.contains(term) {
					score += 70
				}
				if indexedExercise.category.contains(term) {
					score += 50
				}
				if indexedExercise.equipment.contains(term) {
					score += 35
				}
				if indexedExercise.aliases.contains(term) {
					score += 20
				}
			}

			score -= min(indexedExercise.exercise.name.count, 80) / 8
			return (score, indexedExercise.exercise)
		}
		.sorted {
			if $0.score == $1.score {
				return $0.exercise.name < $1.exercise.name
			}
			return $0.score > $1.score
		}
		.prefix(limit)
		.map(\.exercise)
	}

	private static let payload: ExerciseCatalogPayload = {
		guard let url = Bundle.main.url(forResource: "ExerciseCatalog", withExtension: "json") else {
			return ExerciseCatalogPayload.empty
		}

		do {
			let data = try Data(contentsOf: url)
			return try JSONDecoder().decode(ExerciseCatalogPayload.self, from: data)
		} catch {
			return ExerciseCatalogPayload.empty
		}
	}()

	private static let indexed: [IndexedExercise] = payload.exercises.map(IndexedExercise.init)

	private static let featuredNames = [
		"Bench Press",
		"Squats",
		"Deadlifts",
		"Pull-ups",
		"Shoulder Press (Dumbbell)",
		"Lat Pulldown (Wide Grip)",
		"Barbell Row (Overhand)",
		"Leg Press",
		"Dumbbell Lunges Walking",
		"Plank",
		"Biceps Curls With Dumbbell",
		"Triceps Extensions on Cable"
	]
}

private struct ExerciseCatalogPayload: Decodable {
	let source: ExerciseCatalogSource
	let exercises: [ExerciseCatalogItem]

	static let empty = ExerciseCatalogPayload(
		source: ExerciseCatalogSource(
			name: "Exercise Catalog",
			url: "",
			licenses: [],
			generatedAt: ""
		),
		exercises: []
	)
}

private struct IndexedExercise {
	let exercise: ExerciseCatalogItem
	let name: String
	let nameWords: [String]
	let primaryMuscles: String
	let category: String
	let equipment: String
	let aliases: String
	let searchText: String

	init(exercise: ExerciseCatalogItem) {
		self.exercise = exercise
		name = exercise.name.kineticSearchNormalized
		nameWords = name.split(separator: " ").map(String.init)
		primaryMuscles = exercise.primaryMuscles.joined(separator: " ").kineticSearchNormalized
		category = exercise.category.kineticSearchNormalized
		equipment = exercise.equipment.joined(separator: " ").kineticSearchNormalized
		aliases = exercise.aliases.joined(separator: " ").kineticSearchNormalized
		searchText = [
			name,
			primaryMuscles,
			exercise.secondaryMuscles.joined(separator: " ").kineticSearchNormalized,
			category,
			equipment,
			aliases
		].joined(separator: " ")
	}
}

extension [String] {
	func kineticSummary(limit: Int = 3, fallback: String = "") -> String {
		guard !isEmpty else { return fallback }

		let visibleItems = prefix(limit)
		let summary = visibleItems.joined(separator: ", ")
		let remainingCount = count - visibleItems.count
		if remainingCount > 0 {
			return "\(summary) +\(remainingCount)"
		}
		return summary
	}
}

private extension String {
	var kineticSearchNormalized: String {
		folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
			.lowercased()
			.components(separatedBy: CharacterSet.alphanumerics.inverted)
			.filter { !$0.isEmpty }
			.joined(separator: " ")
	}
}
