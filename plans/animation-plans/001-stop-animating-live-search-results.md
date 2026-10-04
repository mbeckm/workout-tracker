# Stop animating live search results

Priority: High
Baseline: `6eae70a`

## Problem

`StatsView` and `PlanEntrySurface` attach springs to result counts, while `StatsView` also animates the whole screen when the query becomes empty/non-empty. Search results can change for every keystroke and again when async provider state changes. Because implicit animation is attached above the result content, unrelated layout, height, and chrome can interpolate.

This violates the frequency rule: typing is common, and live result replacement is functional rather than celebratory.

## Current implementation

```swift
.animation(.spring(response: 0.24, dampingFraction: 0.88), value: searchQuery.isEmpty)
.animation(.spring(response: 0.22, dampingFraction: 0.88), value: searchResults.count)
```

```swift
.animation(.spring(response: 0.22, dampingFraction: 0.88), value: isExpanded)
.animation(.spring(response: 0.22, dampingFraction: 0.88), value: results.count)
```

## Target behavior

1. Animate only the deliberate collapsed-to-expanded surface change.
2. Replace result rows immediately as the query/provider response changes.
3. Under Reduce Motion, use an opacity-only transition for expansion.
4. Do not auto-scroll or animate the result viewport when the result count changes.

Use the existing transition direction:

- Plan builder results enter upward from `y = -12`.
- Stats results enter downward from `y = 12`.
- Expansion timing: `spring(response: 0.22, dampingFraction: 0.92)`.
- Reduce Motion timing: `easeOut(duration: 0.16)` with opacity only.

## Implementation

- Add `@Environment(\.accessibilityReduceMotion)` to both search-surface views.
- Make each result-list transition conditional on Reduce Motion.
- Keep one implicit animation keyed only to `isExpanded`.
- Remove both root-level animations from `StatsView`.
- Remove every animation keyed to `results.count`.

## Verification

- Type a query one character at a time and observe that rows update without the entire surface breathing.
- Clear the query and confirm the surface closes once, smoothly.
- Repeat with Reduce Motion enabled; only opacity should change.
- Confirm scrolling, keyboard dismissal, provider attribution, and empty/loading states still work.
