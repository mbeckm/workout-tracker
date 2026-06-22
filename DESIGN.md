# Kinetic Design Direction

Design system posture: iOS-native product UI with a disciplined, athletic feel. Light-first, clean, and delightful without becoming childish. Mobbin references suggest combining Hevy's compact strength-tracking utility, Fitbod's guided set-entry clarity, and Ladder's approachable plan cards. Dense enough for repeated use, but never cramped.

Visual principles:
- Keep plan creation and set logging close to the thumb.
- Use contrast for hierarchy, not decoration.
- Make progress feel physical: bars, rings, plates, and stacked histories.
- Add delight through satisfying logged-set states, subtle progress moments, and crisp microcopy.
- Prefer compact modules over large marketing sections.
- Use restraint in color so personal records and progress moments have real emphasis.
- Avoid cloning dense strength trackers: use table logic where it helps, then soften it with light cards, generous row height, and clear current-set focus.
- Keep plan setup block-based. Each exercise group owns its targets, notes, history, and reorder affordance instead of scattering controls across the screen.
- Celebrate improvement inline. PRs, matched bests, and consistency streaks should appear beside the set or exercise that earned them, then roll up into summaries.
- Use history as input, not decoration. Previous load, recent best, last-session context, and trend direction should help the next set feel easier to decide.
- Use Apple-native tactility as part of the brand: Liquid Glass, haptics, spring motion, and system controls should make Kinetic feel like a luxury tool.
- Let premium feel come from smooth response and material depth, not ornamental chrome.

Apple-native material and feedback:
- Use Liquid Glass selectively for surfaces that should feel close to the hand: bottom action bars, live set controls, timer chips, history sheets, focused reorder sheets, and PR/confirmation moments.
- Group multiple glass elements with a shared container in implementation so glass surfaces feel coherent and performant.
- Interactive glass belongs on tappable or focusable controls. Static content should stay mostly paper/white for readability.
- Use glass prominence sparingly: Volt-tinted or prominent glass is reserved for primary actions, saved-set confirmation, active timers, and personal records.
- Haptics should map to meaning: light ticks for steppers, crisp confirmation for save, subtle warning for invalid input, stronger success for PRs, and a soft completion cue for rest timers.
- Motion should feel tactile and continuous: controls compress, rows settle, sheets glide, and focused elements morph instead of popping.
- Provide non-glass fallbacks for earlier iOS versions while preserving hierarchy, contrast, and touch target size.

Mobbin-informed UX references:
- Hevy: practical routine creation, exercise-owned plan blocks, and compact set tables with previous values.
- Fitbod: exercise-specific guided logging and progress framed around concrete milestones.
- Ladder: approachable plan hierarchy and friendly completion states.
- Nike Training Club: strong workout identity without overwhelming the task.
- Strava: concise completion summaries that feel rewarding without becoming social-first.

Palette:
- Ink: #101316
- Graphite: #1C2228
- Slate: #68717A
- Mist: #EEF2F3
- Paper: #F8FAF7
- Volt: #C7F464
- Ember: #FF7A45
- Steel: #7AA7B7

Typography:
- Use SF Pro or Inter as a Figma-safe proxy.
- Screen title: 30/36, semibold.
- Section title: 17/22, semibold.
- Body: 15/21, regular.
- Supporting label: 12/16, medium, uppercase only when it helps scanning.
- Numeric workout data: semibold, tabular feel where possible.

Shape and spacing:
- Main screen frames use iPhone 15 Pro dimensions: 393 x 852.
- Cards: 8px radius for utility surfaces, 14px only for major logging or progress panels.
- Primary bottom actions: 56px high.
- Minimum touch target: 44px.
- Base spacing: 8px, with 16px and 24px for section rhythm.

Core components:
- Plan header
- Workout plan card
- Plan builder exercise group
- Exercise row
- Set logger row
- Reps and weight input controls
- Logged-set confirmation state
- Personal record badge
- Matched-best badge
- Previous-set hint
- Recent-best chip
- Exercise history drawer trigger
- Reorder handle
- Sticky save action
- Bottom action bar
- Liquid Glass bottom action surface
- Interactive glass timer chip
- Glass confirmation badge
- Haptic stepper control
- Tactile keypad sheet
- Progress ring
- Weekly volume chart
- Strength trend card

Screen set:
- Plans: reusable workout plans as light cards with day label, exercise count, recent best, and a clear create-plan entry point.
- Plan Builder: list-first editor with plan name, exercise blocks, target sets, notes, add/duplicate/reorder, and a sticky save action.
- Set Logger: selected exercise from a plan, compact set table, last-set hints, large reps and weight controls near the thumb, and a clear save-set action.
- Progress: strength trend, recent bests, workout history, estimated strength or volume trend, and clear signs of getting stronger.

Interaction notes:
- Default design artifact is static high-fidelity Figma, prepared for later SwiftUI implementation.
- Controls should clearly imply tap targets and state changes.
- The set logging experience should work one-handed.
- Logging a set should have a quick, delightful confirmation without slowing the user down.
- Tap-to-edit reps and weight can open a compact keypad sheet; plus/minus controls support fast adjustment.
- Saving a set auto-advances to the next set and briefly shows what improved: "Saved - +2.5 kg vs last time" or "New best".
- Default to remembered inputs from the previous set or last session; make editing a small correction, not a full entry task.
- Keep the primary set-save action in the lower thumb zone and keep close/back available but visually secondary.
- Reordering should become a focused mode with large handles and a sticky save action.
- Progress screens should answer one question first: "what changed since last time?"

SwiftUI implementation notes:
- Prefer native Liquid Glass APIs over custom blur effects.
- Use grouped glass containers where multiple glass controls coexist, especially bottom bars and live logging sheets.
- Apply interactive glass only to controls that respond to touch.
- Use glass button styles for primary actions where supported, with non-glass material fallbacks for earlier iOS versions.
- Pair visual feedback with haptics so saved sets, PRs, rest timer completion, invalid inputs, and stepper changes all feel physically distinct.

Accessibility:
- Text contrast should meet WCAG AA on light and dark surfaces.
- State must not rely on color alone; use labels, icons, and shape.
- Avoid tiny data labels in charts.
