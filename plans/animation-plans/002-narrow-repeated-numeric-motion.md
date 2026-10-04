# Narrow repeated numeric motion

Priority: High
Baseline: `6eae70a`

## Problem

Both numeric steppers already use `.contentTransition(.numericText())`, but an additional spring is attached to the whole stepper or exercise card. During press-and-hold, every repeated value update can animate container layout and styling that did not change.

The number is the only semantic change, so it should be the only animated element.

## Current implementation

```swift
Text("\(value)")
    .contentTransition(.numericText())

HStack { ... }
    .animation(.spring(response: 0.22, dampingFraction: 0.88), value: value)
```

```swift
.animation(.spring(response: 0.2, dampingFraction: 0.88), value: currentValue)
```

## Target behavior

- Preserve immediate button press feedback and haptics.
- Preserve the native numeric content transition.
- Remove broad container springs keyed to numeric values.
- Keep the exercise draft step change animation because switching Sets to Reps is a discrete workflow transition, not a repeated numeric update.

## Implementation

- In `NumberStepper`, remove the HStack animation keyed to `value`.
- In `ExerciseDraftSurface`, remove the surface animation keyed to `currentValue`.
- Leave the `numericText` transitions in place.
- Do not introduce bounce or scale on the changing number.

## Verification

- Tap and hold plus/minus. The buttons should remain responsive and the number should update fluidly without card movement.
- Test limits (`1`, `99`, or the component-specific maximum).
- Confirm VoiceOver labels still expose the current value.
