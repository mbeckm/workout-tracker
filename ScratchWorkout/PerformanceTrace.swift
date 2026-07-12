import Foundation
import os.signpost

enum PerformanceTrace {
    enum Name {
        static let appLaunch: StaticString = "AppLaunch"
        static let firstRender: StaticString = "FirstRender"
        static let tabSwitch: StaticString = "TabSwitch"
        static let routePush: StaticString = "RoutePush"
        static let routePop: StaticString = "RoutePop"
        static let createPlanSearchOpen: StaticString = "CreatePlanSearchOpen"
        static let searchQueryChanged: StaticString = "SearchQueryChanged"
        static let searchResultsUpdated: StaticString = "SearchResultsUpdated"
        static let exerciseConfigure: StaticString = "ExerciseConfigure"
        static let saveDay: StaticString = "SaveDay"
        static let savePlan: StaticString = "SavePlan"
        static let workoutStart: StaticString = "WorkoutStart"
        static let logSet: StaticString = "LogSet"
        static let exerciseComplete: StaticString = "ExerciseComplete"
        static let workoutFinish: StaticString = "WorkoutFinish"
        static let persistenceWrite: StaticString = "PersistenceWrite"
        static let accountRestore: StaticString = "AccountRestore"
        static let cloudSync: StaticString = "CloudSync"
    }

    private static let log = OSLog(
        subsystem: Bundle.main.bundleIdentifier ?? "com.marvinbeckmann.ScratchWorkout",
        category: "Performance"
    )

    static func event(_ name: StaticString) {
        os_signpost(.event, log: log, name: name)
    }

    static func begin(_ name: StaticString) -> OSSignpostID {
        let id = OSSignpostID(log: log)
        os_signpost(.begin, log: log, name: name, signpostID: id)
        return id
    }

    static func end(_ name: StaticString, id: OSSignpostID) {
        os_signpost(.end, log: log, name: name, signpostID: id)
    }
}
