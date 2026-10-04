import SwiftUI

enum AppMotion {
    static let stateChange = Animation.spring(response: 0.22, dampingFraction: 0.94)
    static let searchExpansion = Animation.spring(response: 0.22, dampingFraction: 0.92)
    static let settle = Animation.spring(response: 0.22, dampingFraction: 0.96)
    static let archiveExit = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.2)
    static let reduced = Animation.easeOut(duration: 0.16)

    static func stateChange(reduceMotion: Bool) -> Animation {
        reduceMotion ? reduced : stateChange
    }

    static func searchExpansion(reduceMotion: Bool) -> Animation {
        reduceMotion ? reduced : searchExpansion
    }
}

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

func appRubberBanded(_ offset: CGFloat, dimension: CGFloat) -> CGFloat {
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
    @State private var isSettlingPage = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let pageWidth = max(proxy.size.width, 1)

            content()
                .frame(width: pageWidth, alignment: .topLeading)
                .offset(x: dragOffset)
                .clipped()
                .contentShape(Rectangle())
                .simultaneousGesture(swipeGesture(pageWidth: pageWidth))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func swipeGesture(pageWidth: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 18, coordinateSpace: .local)
            .onChanged { value in
                guard isEnabled, pageCount > 1, !isSettlingPage else {
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
                    offset = appRubberBanded(offset, dimension: pageWidth)
                }
                if selection >= pageCount - 1, offset < 0 {
                    offset = appRubberBanded(offset, dimension: pageWidth)
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
                    settlePage(
                        to: selection + 1,
                        exitOffset: -pageWidth,
                        entryOffset: pageWidth
                    )
                } else if horizontal > 0,
                          (horizontal > threshold || projectedHorizontal > pageWidth * 0.42),
                          selection > 0 {
                    direction = .backward
                    Haptics.tap()
                    settlePage(
                        to: selection - 1,
                        exitOffset: pageWidth,
                        entryOffset: -pageWidth
                    )
                } else {
                    withAnimation(AppNavigationAnimation.push(reduceMotion: reduceMotion)) {
                        dragOffset = 0
                    }
                }
            }
    }

    private func settlePage(to newSelection: Int, exitOffset: CGFloat, entryOffset: CGFloat) {
        if reduceMotion {
            selection = newSelection
            dragOffset = 0
            onPageChange?()
            return
        }

        isSettlingPage = true
        let settleAnimation = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.18)

        withAnimation(settleAnimation) {
            dragOffset = exitOffset
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                selection = newSelection
                dragOffset = entryOffset
            }
            onPageChange?()

            withAnimation(settleAnimation) {
                dragOffset = 0
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
                isSettlingPage = false
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
                    dragOffset = containerWidth + appRubberBanded(horizontal - containerWidth, dimension: containerWidth)
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
