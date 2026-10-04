# Complete swipe-to-archive motion

Priority: Medium
Baseline: `6eae70a`

## Problem

The plan card follows a leftward drag, but once the archive threshold is crossed it calls `onDelete()` immediately. The card can disappear from the list before it visually completes the path established by the gesture.

This breaks spatial consistency: the gesture says “move this card left,” while the state mutation says “vanish here.”

## Target behavior

- Track the finger 1:1 to the left.
- Resist invalid rightward dragging with subtle rubber-banding instead of a hard clamp.
- Consider both distance and predicted velocity when deciding to archive.
- On commit, continue the card left off-screen for roughly 180–220 ms, then mutate the collection.
- On cancel, settle back without bounce.
- Under Reduce Motion, skip the spatial exit and archive immediately after the gesture ends.
- Prevent duplicate archive callbacks while committing.

## Implementation

- Read the available card width with `GeometryReader` or a local size measurement.
- Add `isCommittingArchive` state.
- Use the shared rubber-band function for positive offsets.
- Commit when either translation is less than `-90` or predicted translation is less than approximately `-160`.
- Animate to `-(cardWidth + 40)` using a non-bouncy timing curve (`0.32, 0.72, 0, 1`, duration `0.20`).
- Call `onDelete()` from SwiftUI's logical animation-completion callback so the state mutation stays coupled to the visual exit without a matching-duration timer.
- Reset local state without animation if the parent keeps the view alive.
- Keep the accessibility Archive action immediate; it is not a spatial drag and should not manufacture gesture motion.

## Verification

- Slowly drag past the threshold and release: the card should continue along the same path before the list closes the gap.
- Flick left from a shorter distance: predicted velocity should commit.
- Drag right: resistance should increase instead of allowing the card to drift.
- Begin another interaction during a cancelled snapback and confirm it responds.
- Enable Reduce Motion and confirm archive is immediate and reliable.
