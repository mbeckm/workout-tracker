import Foundation

struct Achievement: Identifiable, Equatable {
    let id = UUID()
    var exerciseName: String
    var weight: Int
    var reps: Int
    var date: Date
    var username: String?
    var previousBest: Int?

    var deltaLabel: String? {
        guard let previousBest, weight > previousBest else {
            return nil
        }
        return "+\(weight - previousBest)KG"
    }

    var previousBestLabel: String? {
        guard let previousBest, previousBest > 0 else {
            return nil
        }
        return "Previous best \(previousBest)KG"
    }

    var formattedDate: String {
        Achievement.dateFormatter.string(from: date)
    }

    var weightLabel: String {
        "\(weight)KG"
    }

    var repsLabel: String {
        "Lifted for \(reps) Reps"
    }

    var usernameCaption: String? {
        guard let username, !username.isEmpty else {
            return nil
        }
        let handle = username.hasPrefix("@") ? username : "@\(username)"
        return "by \(handle)"
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "dd.MM.yyyy"
        return formatter
    }()
}

enum AchievementDetector {
    static func shouldUnlock(
        weight: Int,
        reps: Int,
        previousBestWeight: Int?,
        sessionLoggedMaxWeight: Int,
        hasAlreadyFiredThisExercise: Bool
    ) -> Bool {
        guard weight > 0, reps > 0 else {
            return false
        }

        guard let previousBestWeight else {
            return false
        }

        guard !hasAlreadyFiredThisExercise else {
            return false
        }

        let effectivePrevious = max(previousBestWeight, sessionLoggedMaxWeight)
        return weight > effectivePrevious
    }

    static func sessionLoggedMaxWeight(in sets: [LoggedSet]) -> Int {
        sets.compactMap { set -> Int? in
            guard let weight = set.weight,
                  let reps = set.reps,
                  weight > 0,
                  reps > 0 else {
                return nil
            }

            return weight
        }.max() ?? 0
    }
}
