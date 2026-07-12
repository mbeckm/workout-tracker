import SwiftUI

enum AppNavigationDirection: Equatable {
    case forward
    case backward
    case none
}

enum AppNavigationAnimation {
    /// Snappy iOS-style push timing — faster than the previous spring defaults.
    static let push = Animation.timingCurve(0.22, 0.61, 0.36, 1, duration: 0.28)
    static let reduced = Animation.easeOut(duration: 0.16)

    static func push(reduceMotion: Bool) -> Animation {
        reduceMotion ? reduced : push
    }
}

enum AppScreenTransition {
    static func slide(_ direction: AppNavigationDirection, reduceMotion: Bool = false) -> AnyTransition {
        if reduceMotion {
            return .opacity
        }

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

private func rubberBanded(_ offset: CGFloat, dimension: CGFloat) -> CGFloat {
    guard dimension > 0 else { return offset }
    let magnitude = abs(offset)
    let resisted = (magnitude * dimension * 0.55) / (dimension + 0.55 * magnitude)
    return offset < 0 ? -resisted : resisted
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let pageWidth = max(proxy.size.width, 1)

            content()
                .frame(width: pageWidth, alignment: .topLeading)
                .offset(x: dragOffset)
                .id(selection)
                .transition(AppScreenTransition.slide(direction, reduceMotion: reduceMotion))
                .animation(AppNavigationAnimation.push(reduceMotion: reduceMotion), value: selection)
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
                    offset = rubberBanded(offset, dimension: pageWidth)
                }
                if selection >= pageCount - 1, offset < 0 {
                    offset = rubberBanded(offset, dimension: pageWidth)
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
                let projectedHorizontal = value.predictedEndTranslation.width

                if horizontal < 0,
                   (horizontal < -threshold || projectedHorizontal < -pageWidth * 0.42),
                   selection < pageCount - 1 {
                    direction = .forward
                    Haptics.tap()
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
                        selection += 1
                        dragOffset = 0
                    }
                    onPageChange?()
                } else if horizontal > 0,
                          (horizontal > threshold || projectedHorizontal > pageWidth * 0.42),
                          selection > 0 {
                    direction = .backward
                    Haptics.tap()
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
                        selection -= 1
                        dragOffset = 0
                    }
                    onPageChange?()
                } else {
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
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

private struct SwipeBackModifier: ViewModifier {
    var isEnabled: Bool
    var onBack: () -> Void

    @State private var dragOffset: CGFloat = 0
    @State private var isDraggingBack = false
    @State private var containerWidth: CGFloat = 390
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .offset(x: max(0, dragOffset))
            .background {
                GeometryReader { proxy in
                    Color.clear
                        .onAppear { containerWidth = max(proxy.size.width, 1) }
                        .onChange(of: proxy.size.width) { _, width in
                            containerWidth = max(width, 1)
                        }
                }
            }
            .simultaneousGesture(backGesture)
    }

    private var backGesture: some Gesture {
        DragGesture(minimumDistance: 12, coordinateSpace: .local)
            .onChanged { value in
                guard isEnabled else {
                    return
                }

                let horizontal = value.translation.width
                let vertical = value.translation.height

                if !isDraggingBack {
                    guard value.startLocation.x <= 44,
                          horizontal > 0,
                          abs(horizontal) > abs(vertical) * 1.15 else {
                        return
                    }
                    isDraggingBack = true
                }

                if horizontal > containerWidth {
                    dragOffset = containerWidth + rubberBanded(horizontal - containerWidth, dimension: containerWidth)
                } else {
                    dragOffset = horizontal
                }
            }
            .onEnded { value in
                defer {
                    isDraggingBack = false
                }

                guard isEnabled, isDraggingBack else {
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
                        dragOffset = 0
                    }
                    return
                }

                let threshold: CGFloat = 88
                let projectedThreshold = max(containerWidth * 0.42, threshold)
                if value.translation.width > threshold || value.predictedEndTranslation.width > projectedThreshold {
                    Haptics.tap()
                    dragOffset = 0
                    onBack()
                } else {
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
                        dragOffset = 0
                    }
                }
            }
    }
}

extension View {
    func swipeToGoBack(isEnabled: Bool = true, onBack: @escaping () -> Void) -> some View {
        modifier(SwipeBackModifier(isEnabled: isEnabled, onBack: onBack))
    }
}
