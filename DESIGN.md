---
version: alpha
name: Scratch
description: ScratchWorkout design system for a dark, plan-first iOS workout tracker.
platform: iOS / SwiftUI
last-updated: "2026-07-20"
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
  surface-outline: "white at 8% opacity"
  image-outline: "white at 10% opacity"
  text-primary: "#FFFFFF"
  text-secondary: "#969696"
  text-tertiary: "#707070"
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
    fontSize: 16pt
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
  metric:
    fontFamily: Inter
    fontSize: 24pt
    fontWeight: semibold
    swiftToken: AppFont.metric
  hero-metric:
    fontFamily: Inter
    fontSize: 96pt
    fontWeight: bold
    swiftToken: AppFont.heroMetric
  frequency-metric:
    fontFamily: Inter
    fontSize: 128pt
    fontWeight: bold
    swiftToken: AppFont.frequencyMetric
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
  screen-title-height: 38pt visual minimum; 44pt when paired with controls
  section-title-height: 30pt visual minimum; 44pt when paired with controls
  interaction-min-target: 44pt
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
  concentric-panel: 28pt
  full: 999pt
components:
  app-screen:
    backgroundColor: "{colors.base}"
    foregroundColor: "{colors.text-primary}"
    horizontalPadding: "{layout.horizontal-padding}"
  card:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.surface-outline}"
    rounded: "{rounded.control}"
    padding: 16pt
  panel:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.surface-outline}"
    rounded: "{rounded.panel}"
    padding: 24pt
  cta-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.base}"
    typography: "{typography.h1}"
    rounded: "{rounded.control}"
    width: "{layout.bottom-cta-width}"
    minHeight: "{layout.bottom-cta-height}"
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
    borderColor: "{colors.surface-outline}"
    activeColor: "{colors.accent}"
    inactiveColor: "{colors.text-secondary}"
    height: "{layout.bottom-tab-height}"
---

# Scratch

## Overview

Scratch is a focused strength-training tracker. The UI should feel fast in the gym, dark by default, and tactile without becoming loud. It is not a wellness magazine, analytics dashboard, or social fitness feed.

The product centers on a repeated loop: see the active plan, start the next workout, log sets with minimal attention, finish with a compact confirmation, and return to the plan. Every screen should make the next action obvious.

Use the Figma file as the default-size visual reference and `Theme.swift` / `Components.swift` as the implementation source of truth. Figma dimensions establish rhythm, not hard ceilings: content, localization, and Dynamic Type are allowed to expand them. New UI should extend existing tokens and components before introducing local styling.

## Principles

- Plan-first: plans are reusable training objects, not disposable workout notes.
- Gym-speed: logging should be thumb-friendly, readable at a glance, and tolerant of distraction.
- Dense, not cramped: show useful workout data in compact cards, but preserve 24pt outer padding and 12pt card gaps.
- One main action: most screens get one bright green CTA near the bottom.
- State is structural: show active, completed, empty, loading, and destructive states with copy, iconography, shape, and placement, not color alone.
- Dark athletic posture: black base, charcoal surfaces, crisp white type, muted gray metadata, and neon green emphasis.
- Hierarchy before decoration: improve contrast, spacing, copy, and grouping before adding effects or new visual vocabulary.
- Frequency sets the energy: repeated gym actions should be immediate and quiet; rare achievements may spend more of the motion and visual delight budget.
- Accessibility is a design constraint: large text, Reduce Motion, contrast, and 44pt targets shape the component from the start rather than being patched in later.

## Decision Framework

Before adding or changing a pattern, answer these questions in order:

1. What task is the person trying to complete, and how distracted or physically occupied are they likely to be?
2. How often does this interaction happen? Frequent actions should be faster, calmer, and more predictable than rare milestones.
3. What is the semantic hierarchy? Establish the primary action, primary content, metadata, and state before choosing color or motion.
4. Does an existing `AppColor`, `AppFont`, layout token, component, or screen pattern already express this role? Extend shared primitives before adding a local exception.
5. What happens with a long exercise name, localized copy, empty data, loading, errors, accessibility-sized text, and Reduce Motion?
6. Does motion explain cause and effect, maintain spatial continuity, confirm input, or reward a rare result? If it does none of these, leave the interface still.

Prefer the smallest change that resolves the hierarchy or usability problem. A polished Scratch screen should feel inevitable, not decorated.

## Color

Use `AppColor` names directly in SwiftUI. Do not create parallel color constants.

- `base` is the full-screen background and the text color on green CTAs.
- `surface1` is the default card, tab bar, search field, account card, table, and chart surface.
- `surface2` is for secondary circular controls, inactive adjacent day state, and lower-emphasis filled buttons.
- `border` is for dividers, empty progress cells, inactive heatmap cells, and subtle internal structure.
- `surfaceOutline` is the standard 1pt ring around dark cards, panels, fields, and controls. Its translucent white reads consistently across dark surfaces without producing a heavy gray box.
- `imageOutline` is the slightly stronger 1pt ring around exercise media, where separation from the card surface must survive both dark and light image content.
- `primaryText` is for titles, exercise names, numbers, and committed logged values.
- `secondaryText` is for labels, metadata, tab labels, dates, helper copy, and inactive icons.
- `tertiaryText` is for non-essential missing values and low-emphasis placeholders. Do not use it for small text that someone must read to complete a task.
- `accent` is reserved for primary CTAs, active tabs, progress completion, heatmap activity, chart lines, signed-in sync success, and major success icons.
- `destructive` is reserved for destructive account actions. Swipe delete can use a red overlay, but keep it subdued on the dark surface.

Do not reduce semantic text colors with additional opacity. `secondaryText` is already calibrated to remain readable on `base`, `surface1`, and `surface2`; stacking opacity recreates the contrast problem the token is meant to solve. Chart axes and other small labels use the full token.

Use 4.5:1 as the minimum contrast target for normal readable text and 3:1 for large text, essential icons, and control boundaries. The current `secondaryText` maintains at least 5.25:1 across the dark surface stack. `tertiaryText` maintains at least 3.13:1 and therefore remains unsuitable for small essential copy.

Avoid decorative gradients, color washes, generic fitness imagery, and extra accent colors. The green works because it is rare. When evaluating a new color, test it on every surface where it will appear rather than against `base` alone.

## Typography

Inter is the only product typeface. Use `AppFont` tokens rather than raw font modifiers, including numeric display moments.

- `display` is for screen titles and large summary numbers.
- `h1` is for section titles and primary CTA labels.
- `h2` is for card titles, exercise names, search results, and chart headings.
- `subheading` is for compact modal titles and account/action labels.
- `body` is for helper copy, table cells, and short explanatory text.
- `label` is for metadata such as sets, reps, dates, provider attribution, and card secondary lines.
- `caption` is for tab labels, tiny axis labels, and compact status text.
- `metric` is for changing workout values inside tables and controls.
- `heroMetric` is for rare result and achievement numbers.
- `frequencyMetric` is reserved for the workouts-per-week choice in plan creation.

Numbers are product content. Keep workout counts, weight, reps, sets, duration, and chart values stable in width so controls do not jump when values change. Use `contentTransition(.numericText())` where values animate.

Use `monospacedDigit()` for changing numeric values. Keep type roles semantic with `relativeTo:` so custom Inter fonts participate in Dynamic Type.

Text-bearing components use minimum heights, not exact or maximum height ceilings. Preserve the default Figma height with `minHeight`, then allow titles, metadata, fields, cards, and buttons to grow. Fixed frames remain appropriate for non-text geometry such as progress cells, icons, media thumbnails, and decorative lines.

Allow two lines when the name is identity-critical, including plan cards and exercise identity surfaces. Reserve one-line truncation or a targeted `minimumScaleFactor` for genuinely dense tables and controls where wrapping would obscure the task.

## Layout

The Figma reference frame is 402x874pt. Preserve its mobile-first rhythm, but treat its text-bearing heights as default-size measurements rather than immutable geometry.

- Reserve the top 46pt for the status area. Screen titles start at y=66pt and have a 38pt visual minimum; title rows containing controls provide at least a 44pt interaction height.
- Use 24pt horizontal screen padding. This creates the standard 354pt content rail.
- The custom bottom tab bar is 82pt tall at y=792pt. Its inner nav rail is 310pt wide, starts at x=46pt, and has 12pt top padding.
- Bottom CTAs are 312x56pt at x=45pt and y=712pt. They leave 24pt before the tab bar and 106pt from the bottom of the frame.
- Bottom CTAs and anchored search surfaces float above scrollable content. They use `FloatingBottomChrome`: a 48pt fade from transparent to 88% base opacity, then the control row on an 88% base scrim. Content scrolls underneath and stays visible through the fade.
- Scrollable lists must leave `floatingBottomChromeClearance` bottom padding when a floating CTA or bottom search is present so the last card can scroll behind the chrome instead of being clipped by an opaque footer.
- Avoid solid opaque footers behind bottom actions. The tab bar is the only persistent opaque bottom surface.
- Card lists use 12pt gaps. Sections usually step by 24pt; the Overview heatmap to Active Plan break uses roughly 36pt.
- Cards and controls should span the available content width unless the Figma intentionally centers a fixed control, such as the frequency stepper.
- Avoid floating card stacks inside cards. Cards are for repeated objects, panels, tables, modals, and contained tools.

Use stable dimensions for repeated non-text geometry: 24pt progress cells, 36pt tab icons, 45pt circular steppers, and the 354pt content rail inside 24pt margins. Treat 56pt CTA and 80/84/102pt card heights as minimums so text can grow without clipping.

## Figma Sizing & Spacing

These values come from the Scratch Figma frames and are the default-size system for new SwiftUI work. A listed height is a minimum whenever the component contains text.

- Screen frame: 402x874pt.
- Main rail: x=24pt, width=354pt.
- Primary action rail: x=45pt, width=312pt.
- Status reservation: y=0pt, height=46pt.
- Screen title: x=24pt, y=66pt, 38pt visual minimum and 44pt minimum with controls.
- Section title: 30pt visual minimum and 44pt minimum with controls.
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

- Overview compact plan cards are 354pt wide with an 80pt minimum height.
- Plan inventory cards are 354pt wide with a 102pt minimum height.
- Exercise rows are 354pt wide with an 84pt minimum height.
- Empty-day panels are 354pt wide with a 142pt default height; their content may expand them.
- Search fields are 354pt wide with a 56pt minimum height before expansion.
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

- Frequency selection is a centered 221x105pt default-size group at x=93pt, y=361pt.
- Frequency stepper buttons are 45x45pt, vertically centered at y=30pt inside that group.
- The frequency number has an 83x105pt minimum frame with 24pt gaps to each circular button.
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

Use `CardShell` for plan cards, exercise cards, frequent exercise cards, empty cards, history rows, chart cards, set tables, and summary cards. Default radius is 12pt, padding is 16pt, stroke is 1pt `surfaceOutline`, and the supplied height is a minimum.

Use `CTAButton` for the single primary action at the bottom of task screens. Keep labels direct: `New Plan`, `Next`, `Save Day`, `Save Plan`, `Start Workout`, `Log`, `Finish`, `Sync Now`.

Use `FloatingBottomChrome` for every bottom CTA and anchored search surface. Place it with `.floatingBottomChrome { ... }` so content scrolls behind a translucent fade instead of an opaque footer. Pair scrollable content with `.floatingBottomChromeScrollPadding()`.

Use `PlanCard` for plan-like rows with a title, one or two metadata lines, optional date, and trailing chevron. Use `ExerciseCard` for exercise prescriptions with name, sets/reps metadata, and trailing chevron.

Use `StepProgress` for active workout exercise progress. Use `DayStepProgress` for plan days. Green means completed or current depending on the flow; inactive cells are border gray; selected-only mode may show the next adjacent day in `surface2`.

Use `NumberStepper`, `RoundStepButton`, and `DraftRoundButton` for numeric changes. Circular controls are 45pt and should trigger haptics.

Use `PlanEntrySurface` and `StatsSearchSurface` for exercise search. Search expands inside the card, shows at most five visible result rows, includes loading/empty messages, and preserves provider attribution.

Use `ExerciseDraftSurface` when configuring sets and reps. It is a 20pt-radius panel, 24pt padding, with a two-step sets-to-reps flow and an accent confirmation control.

Nested rounded surfaces should be concentric. When a 12pt-radius control sits 16pt inside a panel, use a 28pt outer radius. Do not pick parent and child radii independently; outer radius should generally equal inner radius plus the inset between them.

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

Motion should clarify cause and effect, preserve spatial continuity, confirm input, or reward a rare result. Use the named `AppMotion` and `AppNavigationAnimation` tokens; do not introduce local spring values for routine state changes.

- `stateChange`: 0.22 response, 0.94 damping for small, contextual state feedback.
- `searchExpansion`: 0.22 response, 0.92 damping for opening and closing search surfaces.
- `settle`: 0.22 response, 0.96 damping for quiet gesture completion.
- `archiveExit`: 0.20-second directional timing curve for completing a committed swipe along its gesture path.
- `AppNavigationAnimation.push`: 0.28-second push curve for directional routes.
- Reduced Motion uses a short 0.16-second ease-out or opacity replacement rather than spatial movement.

Calibrate motion by frequency:

- Search filtering, steppers, set logging, tab changes, and other repeated actions should feel immediate. Do not animate their containing layout on every update.
- Use `.numericText()` and `monospacedDigit()` for changing values instead of scaling or moving the whole row.
- Use contextual SF Symbol replacement for state changes such as upcoming, active, and completed. The icon should feel like one object changing state, not two unrelated icons cross-fading.
- Press feedback may scale a tappable surface to 0.96. Disable that spatial scale under Reduce Motion and avoid scaling static or already gesture-driven surfaces.
- Swipe completion should continue in the direction and velocity implied by the gesture. A committed action should not snap backward before disappearing.
- Screen-load entrance animation is usually inappropriate for Home, Plans, Workout, and Stats because these surfaces are visited frequently.
- Reserve more expressive motion for workout completion, achievements, and similarly rare milestones. This is the product's delight budget, not a default transition style.

Matched geometry is appropriate only when the user can understand the source and destination as the same object. Disable decorative loops, ambient pulsing, and animation added solely because an opportunity exists. Workout logging should never wait on animation.

Use light haptics for tab and step taps, medium haptics for primary actions, saves, starts, and confirmations, and success feedback for completed outcomes. Haptics reinforce a visible state change; they do not replace it.

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

Maintain strong contrast on every dark surface, not only the full-screen base. White and neon green are high emphasis. `secondaryText` is the default readable gray for metadata and small chart labels; `tertiaryText` is limited to non-essential low-emphasis state.

Interactive targets should be at least 44pt. Existing circular controls are 45pt, tab icons are 36pt within larger tab targets, and CTAs are 56pt high.

Every icon-only control needs an accessibility label. Every selected tab should expose selected state. Cards that combine title and metadata should be accessible as a combined element when that reads better.

Do not rely on accent color alone. Pair state with text, iconography, structure, or position. Examples: selected tab uses icon plus label color; complete screen uses checkmark plus summary; empty states use text plus action.

All `AppFont` roles use relative text styles and should participate in Dynamic Type. Text containers use minimum heights and content-driven vertical growth. Use truncation and `minimumScaleFactor` only after wrapping or expansion has been shown to damage a genuinely dense task.

At accessibility text sizes, compact data visualizations may use a shorter equivalent label rather than shrinking below legibility. The monthly calendar uses one-letter weekday symbols instead of allowing three-letter symbols to become ellipses.

Validate new and materially changed screens at the default content size and at least `accessibility-medium`. Check the largest supported size before release for primary workout, plan creation, and account flows. Confirm that the final row remains reachable above floating bottom chrome.

Respect Reduce Motion in every custom spatial transition, press scale, gesture completion, and celebration. The reduced variant should preserve state clarity through opacity, symbol replacement, or immediate updates.

## Do's And Don'ts

- Do build from `AppColor`, `AppFont`, `AppScreen`, `CardShell`, and existing route patterns.
- Do keep one bright primary CTA per active task screen.
- Do preserve the custom tab bar and bottom thumb-zone actions.
- Do keep active workout logging stripped down to the current exercise and set entry.
- Do use cards for repeated plans, exercises, stats rows, tables, summaries, and contained entry surfaces.
- Do keep search, draft configuration, and activation prompts compact and contextual.
- Do use semantic text and color tokens at full strength; change the token when the hierarchy is wrong instead of patching individual call sites with opacity.
- Do treat Figma text-bearing heights as minimums and test long content plus Dynamic Type.
- Do use named motion tokens and decide animation energy from interaction frequency.
- Do keep nested corner radii concentric.
- Do use `FloatingBottomChrome` so bottom actions float above content with a translucent fade; never block scrollable cards with a solid base footer.
- Don't introduce a light theme, marketing hero, image-heavy wellness surface, or separate design system.
- Don't use green as decoration or general body text.
- Don't add large shadows, blurred glass, ornamental texture, or decorative gradients beyond the subtle dark base and the bottom-chrome fade scrim.
- Don't use hard height ceilings on text-bearing cards, fields, buttons, or title rows.
- Don't make dense workout rows move unpredictably when numbers or search results change; grow only when the content itself requires it.
- Don't animate collection layout on every search keystroke, stepper tap, or set update.
- Don't hide primary actions behind menus during workout or plan creation flows.
- Don't add new root product names, duplicate app targets, or legacy project language.

## Documenting Design Decisions

`DESIGN.md` is a living decision system, not a screenshot inventory or changelog. Update it in the same pull request whenever a change introduces or materially revises a reusable token, component rule, screen pattern, motion behavior, accessibility requirement, or product-wide exception.

For a meaningful design decision, record:

- Problem: what user or consistency problem required a decision?
- Context and frequency: where does it occur, and how often does the interaction repeat?
- Decision: what rule or shared primitive will we use going forward?
- Alternatives rejected: which plausible options were considered, and why were they worse for Scratch?
- Accessibility: what happens with Dynamic Type, contrast, Reduce Motion, localization, and 44pt targets?
- Validation: which screens, states, devices, and content sizes were inspected?

Keep the durable rule here and the implementation narrative in the pull request. If code and this document disagree, verify the intended behavior, then update both rather than treating either as silently authoritative.
