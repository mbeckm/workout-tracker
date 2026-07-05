# Scratch Figma → SwiftUI token map

Quick reference for translating Figma values into code. Full rules are in `DESIGN.md`.

## Colors

```swift
// Theme.swift — use these, do not duplicate
AppColor.base          // #0D0D0D — full-screen background, CTA text on green
AppColor.surface1      // #1A1A1A — cards, tab bar, search fields
AppColor.surface2      // #2E2E2E — secondary controls, inactive adjacent day
AppColor.border        // #2E2E2E — strokes, dividers, empty progress cells
AppColor.primaryText   // #FFFFFF — titles, exercise names, numbers
AppColor.secondaryText // #8A8A8A — labels, metadata, inactive icons
AppColor.tertiaryText  // #4A4A4A — missing table values, low emphasis
AppColor.accent        // #A8FF3E — CTAs, active tabs, progress, success
```

## Typography

```swift
AppFont.display     // 32pt bold   — screen titles, large summary numbers
AppFont.h1          // 24pt semibold — section titles, CTA labels
AppFont.h2          // 20pt semibold — card titles, exercise names
AppFont.subheading  // 16pt medium — modal titles, account labels
AppFont.body        // 15pt regular — helper copy, table cells
AppFont.label       // 13pt medium — sets/reps metadata, dates
AppFont.caption     // 12pt regular — tab labels, axis labels
```

## Spacing scale

| Token | Value |
|-------|-------|
| 1 | 4pt |
| 2 | 8pt |
| 3 | 12pt |
|  panel/card gap | 12pt |
| 4 | 16pt |
| card padding | 16pt |
| panel padding | 24pt |
| horizontal screen padding | 24pt |
| section gap | 24pt |
| major section gap | 36pt |
| 6 | 24pt |
| 9 | 36pt |
| 12 | 48pt |
| 20 | 80pt |
| 24 | 96pt |

## Corner radii

| Token | Value | Use |
|-------|-------|-----|
| progress | 6pt | Progress cells |
| control | 12pt | Cards, CTAs |
| panel | 20pt | Modals, draft surfaces |
| full | 999pt | Pills |

## Key layout dimensions

| Element | Size / position |
|---------|-----------------|
| Reference frame | 402×874pt |
| Content rail | x=24, width=354 |
| CTA rail | x=45, width=312, height=56, y=712 |
| Tab bar | height=82, y=792 |
| Tab icon | 36×36 |
| Circular control | 45×45 |
| Progress cell | 24×24 |
| Overview plan card | 354×80 |
| Plan inventory card | 354×102 |
| Exercise row | 354×84 |

## Component mapping

| Figma pattern | Swift component |
|---------------|-----------------|
| Screen background + content | `AppScreen` |
| Card with stroke | `CardShell` |
| Plan row with chevron | `PlanCard` |
| Exercise row with metadata | `ExerciseCard` |
| Green bottom button | `CTAButton` |
| Workout exercise progress | `StepProgress` |
| Plan day progress | `DayStepProgress` |
| +/- numeric control | `NumberStepper` / `RoundStepButton` |
| Exercise search | `PlanEntrySurface` / `StatsSearchSurface` |
| Sets/reps configuration | `ExerciseDraftSurface` |
| Bottom navigation | `AppTabBar` |
