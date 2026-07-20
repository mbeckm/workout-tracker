# Refine workout set feedback

Priority: Medium-high
Baseline: `6eae70a`

## Problem

Logging a set is the app's most repeated core action. The row currently applies two broad springs—one for phase and one for a short-lived highlight—while its status symbol changes abruptly. The result is more bounce than continuity: the container animates, but the meaningful state indicator pops.

## Current implementation

```swift
Image(systemName: phase.symbol)

.animation(.spring(response: 0.3, dampingFraction: 0.82), value: phase)
.animation(.spring(response: 0.18, dampingFraction: 0.86), value: isRecentlyLogged)
```

## Target behavior

- The phase icon replaces in place so upcoming → active → completed reads as one persistent status location.
- Fill, border, and text colors settle quickly without visible bounce.
- The recently-logged confirmation remains subtle and short.
- Reduce Motion keeps the state readable with a short crossfade and no scale/translation.

Timing:

- Functional state: `spring(response: 0.22, dampingFraction: 0.94)`.
- Reduce Motion: `easeOut(duration: 0.16)`.
- Do not exceed 220 ms for this repeated interaction.

## Implementation

- Add `@Environment(\.accessibilityReduceMotion)` to `SetTableRow`.
- Apply a contextual symbol replacement transition keyed by `phase` to the status icon. Prefer SwiftUI's native symbol replace transition when available on the iOS 17 deployment target; otherwise use the existing crossfade/scale vocabulary with scale disabled under Reduce Motion.
- Replace the two bouncy springs with one quiet phase animation and one short ease-out highlight animation.
- Keep the log button's immediate press feedback and haptic.
- Do not add a row entrance animation or stagger.

## Verification

- Log several consecutive sets quickly. Each completed icon should replace the active icon in place, and the next active row should remain easy to locate.
- Verify no row changes height or shifts horizontally.
- Turn on Reduce Motion and confirm icon/state changes remain visible without spatial motion.
- Confirm high-contrast borders and accessibility labels retain the correct phase.
