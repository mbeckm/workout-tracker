import SwiftUI

@main
struct ScratchWorkoutApp: App {
    init() {
        PerformanceTrace.event(PerformanceTrace.Name.appLaunch)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }
}
