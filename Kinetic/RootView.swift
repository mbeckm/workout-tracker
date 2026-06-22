import SwiftUI

private enum AppTab: Hashable {
	case plans
	case history
}

struct RootView: View {
	@State private var selectedTab: AppTab = .plans

	var body: some View {
		TabView(selection: $selectedTab) {
			NavigationStack {
				PlansView()
			}
			.tabItem {
				Label("Plans", systemImage: "calendar")
			}
			.tag(AppTab.plans)

			NavigationStack {
				HistoryView()
			}
			.tabItem {
				Label("History", systemImage: "clock")
			}
			.tag(AppTab.history)
		}
		.tint(KineticTheme.ink)
		.onChange(of: selectedTab) { _, _ in
			HapticManager.shared.fire(.selection)
		}
	}
}

#Preview {
	RootView()
		.modelContainer(PreviewData.container())
}
