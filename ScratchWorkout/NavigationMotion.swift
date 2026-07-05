import SwiftUI

enum AppNavigationDirection: Equatable {
    case forward
    case backward
    case none
}

enum AppNavigationAnimation {
    /// Snappy iOS-style push timing — faster than the previous spring defaults.
    static let push = Animation.timingCurve(0.22, 0.61, 0.36, 1, duration: 0.28)
}

enum AppScreenTransition {
    static func slide(_ direction: AppNavigationDirection) -> AnyTransition {
        switch direction {
        case .forward:
            return .asymmetric(
                insertion: .move(edge: .trailing),
                removal: .move(edge: .leading)
            )
        case .backward:
            return .asymmetric(
                insertion: .move(edge: .leading),
                removal: .move(edge: .trailing)
            )
        case .none:
            return .identity
        }
    }
}

struct HorizontalSwipePager<Content: View>: View {
    @Binding var selection: Int
    let pageCount: Int
    var isEnabled: Bool = true
    @Binding var direction: AppNavigationDirection
    var onPageChange: (() -> Void)? = nil
    @ViewBuilder var content: () -> Content

    @State private var dragOffset: CGFloat = 0
    @State private var isDraggingHorizontally = false

    var body: some View {
        GeometryReader { proxy in
            let pageWidth = max(proxy.size.width, 1)

            content()
                .frame(width: pageWidth, alignment: .topLeading)
                .offset(x: dragOffset)
                .id(selection)
                .transition(AppScreenTransition.slide(direction))
                .animation(AppNavigationAnimation.push, value: selection)
                .clipped()
                .contentShape(Rectangle())
                .simultaneousGesture(swipeGesture(pageWidth: pageWidth))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func swipeGesture(pageWidth: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 18, coordinateSpace: .local)
            .onChanged { value in
                guard isEnabled, pageCount > 1 else {
                    return
                }

                let horizontal = value.translation.width
                let vertical = value.translation.height

                if !isDraggingHorizontally {
                    guard abs(horizontal) > abs(vertical) * 1.15 else {
                        return
                    }
                    isDraggingHorizontally = true
                }

                var offset = horizontal
                if selection == 0, offset > 0 {
                    offset *= 0.28
                }
                if selection >= pageCount - 1, offset < 0 {
                    offset *= 0.28
                }
                dragOffset = offset
            }
            .onEnded { value in
                defer {
                    isDraggingHorizontally = false
                }

                guard isEnabled, pageCount > 1, isDraggingHorizontally else {
                    dragOffset = 0
                    return
                }

                let threshold = pageWidth * 0.2
                let horizontal = value.translation.width

                if horizontal < -threshold, selection < pageCount - 1 {
                    direction = .forward
                    Haptics.tap()
                    withAnimation(AppNavigationAnimation.push) {
                        selection += 1
                        dragOffset = 0
                    }
                    onPageChange?()
                } else if horizontal > threshold, selection > 0 {
                    direction = .backward
                    Haptics.tap()
                    withAnimation(AppNavigationAnimation.push) {
                        selection -= 1
                        dragOffset = 0
                    }
                    onPageChange?()
                } else {
                    withAnimation(AppNavigationAnimation.push) {
                        dragOffset = 0
                    }
                }
            }
    }
}

extension AppNavigationDirection {
    static func forIndexChange(from oldIndex: Int, to newIndex: Int) -> AppNavigationDirection {
        if newIndex > oldIndex {
            return .forward
        }
        if newIndex < oldIndex {
            return .backward
        }
        return .none
    }
}
