---
version: alpha
name: Scratch
description: ScratchWorkout design system for a dark, plan-first iOS workout tracker.
platform: iOS / SwiftUI
source:
  figma: https://www.figma.com/design/NRr5uUZX4oAK3enRLXZi7j/Scratch
  product: PRODUCT.md
  tokens: ScratchWorkout/Theme.swift
  components: ScratchWorkout/Components.swift
colors:
  base: "#0D0D0D"
  surface-1: "#1A1A1A"
  surface-2: "#242424"
  border: "#2E2E2E"
  text-primary: "#FFFFFF"
  text-secondary: "#8A8A8A"
  text-tertiary: "#4A4A4A"
  accent: "#A8FF3E"
  destructive: "#FF6B6B"
typography:
  display:
    fontFamily: Inter
    fontSize: 32pt
    fontWeight: bold
    swiftToken: AppFont.display
  h1:
    fontFamily: Inter
    fontSize: 24pt
    fontWeight: semibold
    swiftToken: AppFont.h1
  h2:
    fontFamily: Inter
    fontSize: 20pt
    fontWeight: semibold
    swiftToken: AppFont.h2
  subheading:
    fontFamily: Inter
    fontSize: 16pt
    fontWeight: medium
    swiftToken: AppFont.subheading
  body:
    fontFamily: Inter
    fontSize: 15pt
    fontWeight: regular
    swiftToken: AppFont.body
  label:
    fontFamily: Inter
    fontSize: 13pt
    fontWeight: medium
    swiftToken: AppFont.label
  caption:
    fontFamily: Inter
    fontSize: 12pt
    fontWeight: regular
    swiftToken: AppFont.caption
spacing:
  1: 4pt
  2: 8pt
  3: 12pt
  4: 16pt
  6: 24pt
  9: 36pt
  12: 48pt
  20: 80pt
  24: 96pt
layout:
  reference-frame: 402x874pt
  status-reservation-height: 46pt
  horizontal-padding: 24pt
  content-width: 354pt
  screen-title-top: 66pt
  screen-title-height: 38pt
  section-title-height: 30pt
  card-gap: 12pt
  section-gap: 24pt
  large-section-gap: 36pt
  bottom-tab-height: 82pt
  bottom-tab-y: 792pt
  bottom-tab-inner-x: 46pt
  bottom-tab-inner-width: 310pt
  bottom-tab-inner-top: 12pt
  bottom-cta-width: 312pt
  bottom-cta-height: 56pt
  bottom-cta-x: 45pt
  bottom-cta-y: 712pt
  bottom-cta-clearance: 106pt
  floating-chrome-fade: 48pt
  cta-to-tab-gap: 24pt
  card-padding: 16pt
  card-trailing-icon: 36pt
  card-trailing-icon-x: 302pt
  heatmap-cell: 24pt
  heatmap-gap: 24pt
  day-chip-height: 24pt
  day-chip-gap: 45pt
  circular-control: 45pt
  search-row-height: 26pt
rounded:
  progress: 6pt
  control: 12pt
  panel: 20pt
  full: 999pt
components:
  app-screen:
    backgroundColor: "{colors.base}"
    foregroundColor: "{colors.text-primary}"
    horizontalPadding: "{layout.horizontal-padding}"
  card:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.border}"
    rounded: "{rounded.control}"
    padding: 16pt
  panel:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.border}"
    rounded: "{rounded.panel}"
    padding: 24pt
  cta-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.base}"
    typography: "{typography.h1}"
    rounded: "{rounded.control}"
    width: "{layout.bottom-cta-width}"
    height: "{layout.bottom-cta-height}"
  floating-bottom-chrome:
    fadeHeight: "{layout.floating-chrome-fade}"
    fadeGradient: "base transparent to base 88% opacity"
    buttonRowBackground: "base 88% opacity"
    scrollClearance: "CTA height + fade height + bottom chrome padding"
  progress-cell:
    activeColor: "{colors.accent}"
    inactiveColor: "{colors.border}"
    rounded: "{rounded.progress}"
    height: 24pt
  tab-bar:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.border}"
    activeColor: "{colors.accent}"
    inactiveColor: "{colors.text-secondary}"
    height: "{layout.bottom-tab-height}"
---

# Scratch

## Overview

Scratch is a focused strength-training tracker. The UI should feel fast in the gym, dark by default, and tactile without becoming loud. It is not a wellness magazine, analytics dashboard, or social fitness feed.

The product centers on a repeated loop: see the active plan, start the next workout, log sets with minimal attention, finish with a compact confirmation, and return to the plan. Every screen should make the next action obvious.

Use the Figma file as the visual source of truth and `Theme.swift` / `Components.swift` as the implementation source of truth. New UI should extend those tokens and components before introducing local styling.

## Principles

- Plan-first: plans are reusable training objects, not disposable workout notes.
- Gym-speed: logging should be thumb-friendly, readable at a glance, and tolerant of distraction.
- Dense, not cramped: show useful workout data in compact cards, but preserve 24pt outer padding and 12pt card gaps.
- One main action: most screens get one bright green CTA near the bottom.
- State is structural: show active, completed, empty, loading, and destructive states with copy, iconography, shape, and placement, not color alone.
- Dark athletic posture: black base, charcoal surfaces, crisp white type, muted gray metadata, and neon green emphasis.

## Color

Use `AppColor` names directly in SwiftUI. Do not create parallel color constants.

- `base` is the full-screen background and the text color on green CTAs.
- `surface1` is the default card, tab bar, search field, account card, table, and chart surface.
- `surface2` is for secondary circular controls, inactive adjacent day state, and lower-emphasis filled buttons.
- `border` is for card strokes, dividers, empty progress cells, inactive heatmap cells, and subtle structure.
- `primaryText` is for titles, exercise names, numbers, and committed logged values.
- `secondaryText` is for labels, metadata, tab labels, dates, helper copy, and inactive icons.
- `tertiaryText` is for missing workout table values and very low emphasis placeholders.
- `accent` is reserved for primary CTAs, active tabs, progress completion, heatmap activity, chart lines, signed-in sync success, and major success icons.
- `destructive` is reserved for destructive account actions. Swipe delete can use a red overlay, but keep it subdued on the dark surface.

Avoid decorative gradients, color washes, generic fitness imagery, and extra accent colors. The green works because it is rare.

## Typography

Inter is the only product typeface. Use `AppFont` tokens rather than raw font modifiers, except for intentional numeric display moments already established in the code.

- `display` is for screen titles and large summary numbers.
- `h1` is for section titles and primary CTA labels.
- `h2` is for card titles, exercise names, search results, and chart headings.
- `subheading` is for compact modal titles and account/action labels.
- `body` is for helper copy, table cells, and short explanatory text.
- `label` is for metadata such as sets, reps, dates, provider attribution, and card secondary lines.
- `caption` is for tab labels, tiny axis labels, and compact status text.

Numbers are product content. Keep workout counts, weight, reps, sets, duration, and chart values stable in width so controls do not jump when values change. Use `contentTransition(.numericText())` where values animate.

Long exercise names should stay on one line in compact lists. Use truncation or a targeted `minimumScaleFactor` where the screen cannot afford wrapping.

## Layout

The Figma reference frame is 402x874pt. Preserve the mobile-first geometry unless there is a concrete device reason to adapt.

- Reserve the top 46pt for the status area. Screen titles start at y=66pt and are 38pt tall.
- Use 24pt horizontal screen padding. This creates the standard 354pt content rail.
- The custom bottom tab bar is 82pt tall at y=792pt. Its inner nav rail is 310pt wide, starts at x=46pt, and has 12pt top padding.
- Bottom CTAs are 312x56pt at x=45pt and y=712pt. They leave 24pt before the tab bar and 106pt from the bottom of the frame.
- Bottom CTAs and anchored search surfaces float above scrollable content. They use `FloatingBottomChrome`: a 48pt fade from transparent to 88% base opacity, then the control row on an 88% base scrim. Content scrolls underneath and stays visible through the fade.
- Scrollable lists must leave `floatingBottomChromeClearance` bottom padding when a floating CTA or bottom search is present so the last card can scroll behind the chrome instead of being clipped by an opaque footer.
- Avoid solid opaque footers behind bottom actions. The tab bar is the only persistent opaque bottom surface.
- Card lists use 12pt gaps. Sections usually step by 24pt; the Overview heatmap to Active Plan break uses roughly 36pt.
- Cards and controls should span the available content width unless the Figma intentionally centers a fixed control, such as the frequency stepper.
- Avoid floating card stacks inside cards. Cards are for repeated objects, panels, tables, modals, and contained tools.

Use stable dimensions for repeated controls: 24pt progress cells, 36pt tab icons, 45pt circular steppers, 56pt CTA height, 80/84/102pt list cards, and 354pt content width inside the 24pt margins.

## Figma Sizing & Spacing

These values come from the Scratch Figma frames and should be treated as the default sizing system for new SwiftUI work.

- Screen frame: 402x874pt.
- Main rail: x=24pt, width=354pt.
- Primary action rail: x=45pt, width=312pt.
- Status reservation: y=0pt, height=46pt.
- Screen title: x=24pt, y=66pt, height=38pt.
- Section title: height=30pt.
- Section-to-card gap: 12pt.
- Major section gap: 24pt after a card or compact group.
- Overview heatmap-to-next-section gap: 36-38pt.
- Bottom CTA: y=712pt, height=56pt.
- Bottom tab: y=792pt, height=82pt.
- CTA-to-tab gap: 24pt.
- Tab icon: 36x36pt.
- Tab label: 16pt high, placed 4pt below the icon.
- Tab item visual height: 56-58pt.

Card rules:

- Overview compact plan cards are 354x80pt.
- Plan inventory cards are 354x102pt.
- Exercise rows are 354x84pt.
- Empty-day panels are 354x142pt.
- Search fields are 354x56pt before expansion.
- Expanded search/result panels keep 16pt side padding, 16pt row gaps, 26pt result rows, and a 322pt divider.
- Card interior padding is 16pt for list cards and 24pt for larger panels/draft surfaces.
- Trailing card icons use a 36x36pt box at x=302pt, leaving 16pt right padding.
- List titles sit at x=16pt, y=16pt. Metadata starts about 30-34pt below the title.
- Metadata pairs in exercise rows use a 25pt horizontal gap.
- Multi-line metadata stacks use 18pt line height and 4pt internal spacing, or a 22pt y offset between metadata lines when matching Figma rows.

Progress and selection rules:

- Heatmap cells are 24x24pt with 24pt gaps, arranged on a 48pt pitch.
- Workout progress and day progress bars are 24pt high with 6pt radius.
- Three-day progress uses 90pt bars with 45pt gaps.
- Four-day progress uses 55pt bars with 45pt gaps.
- Five or more day/exercise progress bars should compress within the 354pt rail rather than overflow.
- Day progress sits at y=128pt. Day titles sit at y=176-177pt, about 24-25pt below the progress bar.

Form and control rules:

- Frequency selection is a centered 221x105pt group at x=93pt, y=361pt.
- Frequency stepper buttons are 45x45pt, vertically centered at y=30pt inside that group.
- The frequency number is 83x105pt with 24pt gaps to each circular button.
- The `Workouts per week` label sits 16pt below the stepper.
- Circular buttons are 45x45pt.
- Search rows use a 22pt icon, 16pt icon-to-text gap, and 26pt row height.
- Draft configuration surfaces use 24pt padding, 45pt circular controls, and a fixed 164pt numeric stepper group.

## Navigation

Primary navigation is tab-led: Home, Plans, Workout, Stats. The tab bar remains visually consistent across focused routes.

Routes can temporarily map to a tab context:

- Plan creation and plan detail belong to Plans.
- Workout logging and completion belong to Workout.
- Starting the next workout from Overview can keep Home context until the workout begins.
- Exercise stats detail belongs to Stats and uses an explicit back control.

Full-screen flows are appropriate for active tasks: create plan, edit plan, start workout, log workout, workout complete, and exercise stats. Use sheets for account management and other secondary surfaces that should not disturb the main training flow.

## Components

Use `AppScreen` for every product screen. It applies the dark base and primary text color.

Use `CardShell` for plan cards, exercise cards, frequent exercise cards, empty cards, history rows, chart cards, set tables, and summary cards. Default radius is 12pt, padding is 16pt, stroke is 1pt `border`.

Use `CTAButton` for the single primary action at the bottom of task screens. Keep labels direct: `New Plan`, `Next`, `Save Day`, `Save Plan`, `Start Workout`, `Log`, `Finish`, `Sync Now`.

Use `FloatingBottomChrome` for every bottom CTA and anchored search surface. Place it with `.floatingBottomChrome { ... }` so content scrolls behind a translucent fade instead of an opaque footer. Pair scrollable content with `.floatingBottomChromeScrollPadding()`.

Use `PlanCard` for plan-like rows with a title, one or two metadata lines, optional date, and trailing chevron. Use `ExerciseCard` for exercise prescriptions with name, sets/reps metadata, and trailing chevron.

Use `StepProgress` for active workout exercise progress. Use `DayStepProgress` for plan days. Green means completed or current depending on the flow; inactive cells are border gray; selected-only mode may show the next adjacent day in `surface2`.

Use `NumberStepper`, `RoundStepButton`, and `DraftRoundButton` for numeric changes. Circular controls are 45pt and should trigger haptics.

Use `PlanEntrySurface` and `StatsSearchSurface` for exercise search. Search expands inside the card, shows at most five visible result rows, includes loading/empty messages, and preserves provider attribution.

Use `ExerciseDraftSurface` when configuring sets and reps. It is a 20pt-radius panel, 24pt padding, with a two-step sets-to-reps flow and an accent confirmation control.

Use `EditableExerciseCard` for edit mode only. Swipe left reveals a subdued destructive affordance; tap edits; drag/drop reorders.

## Screen Patterns

Home is an immediate status screen. It shows the monthly workout count, activity heatmap, active plan, next workout, and account entry. Do not turn it into a dashboard full of secondary metrics.

Plans is an inventory screen. Active Plan appears first, Saved Plans second, and New Plan is the dominant action. The plus in the header is a shortcut, not the primary visual anchor.

Plan Detail is a day-selection and start-workout screen. In read mode, the main action is `Start this Workout`. In edit mode, the same surface becomes editable with plan/day names, search, reordering, and `Save`.

Create Plan is progressive. Start with workouts per week, then build one day at a time, then review, then optionally activate. Do not expose all decisions at once.

Add Exercise is a dedicated full-screen library launched from the composer. Keep its 56pt search field and 36pt type filters pinned while fixed-height media rows scroll. Selection is multi-select and returns to the originating day only through the bottom confirmation action. No-match custom creation remains inside the library and returns the saved item to its selected state.

Start Workout is a confirmation screen. Show the day title, exercise count, exercise list, and one `Start Workout` CTA.

Log Workout is the highest-focus surface. Show progress, current exercise, set table, weight/reps steppers, and `Log`. Do not add secondary navigation, timers, charts, or plan-editing controls here.

Workout Complete is a compact success moment. The checkmark and summary card can be celebratory, but the screen should stay calm and finish quickly.

Stats is for history and discovery. Lead with most logged exercises, keep search anchored near the bottom, and use exercise detail for the chart and history list. Charts should be simple, high contrast, and sparse.

Account is a secondary sheet. It should reuse the app shell, dark cards, concise provider buttons, and restrained status messages.

## Motion & Haptics

Motion should clarify transitions and state changes. Use the existing spring family unless a platform component supplies its own motion.

- Small UI state: spring response around 0.22-0.28, damping 0.86-0.88.
- Route changes and major flow transitions: response around 0.42-0.50, damping 0.80-0.86.
- Matched geometry is appropriate for search/draft surfaces and activation prompts.
- Numeric values can animate with `.numericText()`.
- Disable decorative looping motion. Workout logging should never wait on animation.
- Use light haptics for tab/step taps and medium haptics for primary actions, saves, starts, and confirmations.

## Voice & Content

Copy is short, direct, and training-native.

- Use Title Case for screen titles, section titles, tab labels, and CTA labels.
- Use sentence case for helper copy, empty states, account explanations, and error text.
- Prefer concrete nouns: plan, workout, day, exercise, sets, reps, weight, history, stats.
- Empty states should point to the first useful action: `No exercises yet` plus `Add first exercise`.
- Loading states should name the task: `Searching exercises`, `Checking account`, `Syncing`.
- Avoid hype, coaching slogans, exclamation-heavy copy, and generic wellness language.
- Use numerals for counts and training data: `4 Sets`, `10 Reps`, `3 days per week`.

## Accessibility

Maintain strong contrast on the dark theme. White and neon green are high emphasis; gray metadata is acceptable only for secondary information.

Interactive targets should be at least 44pt. Existing circular controls are 45pt, tab icons are 36pt within larger tab targets, and CTAs are 56pt high.

Every icon-only control needs an accessibility label. Every selected tab should expose selected state. Cards that combine title and metadata should be accessible as a combined element when that reads better.

Do not rely on accent color alone. Pair state with text, iconography, structure, or position. Examples: selected tab uses icon plus label color; complete screen uses checkmark plus summary; empty states use text plus action.

Respect Dynamic Type where possible through `AppFont` relative styles, but protect fixed-format controls from breaking by using stable frames, truncation, and minimum scale only where necessary.

## Do's And Don'ts

- Do build from `AppColor`, `AppFont`, `AppScreen`, `CardShell`, and existing route patterns.
- Do keep one bright primary CTA per active task screen.
- Do preserve the custom tab bar and bottom thumb-zone actions.
- Do keep active workout logging stripped down to the current exercise and set entry.
- Do use cards for repeated plans, exercises, stats rows, tables, summaries, and contained entry surfaces.
- Do keep search, draft configuration, and activation prompts compact and contextual.
- Do use `FloatingBottomChrome` so bottom actions float above content with a translucent fade; never block scrollable cards with a solid base footer.
- Don't introduce a light theme, marketing hero, image-heavy wellness surface, or separate design system.
- Don't use green as decoration or general body text.
- Don't add large shadows, blurred glass, ornamental texture, or decorative gradients beyond the subtle dark base and the bottom-chrome fade scrim.
- Don't make dense workout rows expand unpredictably when labels, numbers, or search results change.
- Don't hide primary actions behind menus during workout or plan creation flows.
- Don't add new root product names, duplicate app targets, or legacy project language.
