# ScratchWorkout Plan Creation Linear Specs

Date: 2026-07-07

Source research: `/Users/marvinbeckmann/Documents/workout tracker app/UX_PLAN_CREATION_RESEARCH.md`

## Linear Target

- Team: `Workout App`
- New project: `Workout Catalog Expansion (Problem 4)`
- Project purpose: make ScratchWorkout's add-exercise flow support real training plans, not only strength-list search. This project owns the catalog strategy, first-class exercise/item types, full-screen add-exercise library, custom missing-exercise recovery, and calmer plan-creation visual direction.

## Generated Problem 5 Concepts

These are the concrete imagegen concepts for the new visual direction:

- Warm Charcoal Library: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/04-problem5-warm-charcoal-library.png`
- Training Notebook Composer: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/05-problem5-training-notebook-composer.png`
- Quiet Pro Custom Recovery: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/06-problem5-quiet-pro-custom-recovery.png`

## Project Spec

### Project: Workout Catalog Expansion (Problem 4)

#### Goal

Make ScratchWorkout plan creation forgiving and complete enough for real mixed training plans. Users should be able to find, recognize, add, create, and later log strength, cardio, mobility, stability, stretch, and timer-based work without workarounds.

#### Why This Exists

The current plan creation flow fails when the user searches for a movement that is not in the catalog, when an exercise name is ambiguous, or when the workout item is not classic strength training. Problem 4 is the deepest product-model gap: the catalog boundary is too strength-biased. Solving it likely requires either a stronger provider/API strategy, a better bundled/personal catalog, or both.

#### Product Direction

Pivot to a full-screen `Add Exercise` library launched from the plan composer. The composer remains the stable day-building and review surface. The library owns search, filters, thumbnails, mixed training types, and custom creation. Concept 3 is embedded inside Concept 1 as the no-exact-match recovery path.

#### In Scope

- Full-screen add-exercise library design and interaction spec.
- Exact Concept 1 + Concept 3 integration flow.
- Catalog/API/provider strategy investigation for mixed exercise types.
- First-class workout item types: Strength, Cardio, Mobility, Stability, Stretch, Timer.
- Custom exercise creation and reuse.
- Media-backed exercise rows and fallbacks.
- Calmer plan-creation visual direction from Problem 5.
- QA matrix for search, missing results, offline fallback, mixed item types, and saved-plan compatibility.

#### Out of Scope

- Social features, sharing, or community exercise publishing.
- Cloud sync beyond compatibility with the existing local-first model.
- Full exercise instruction/video playback unless selected as part of catalog strategy.
- Rewriting the entire plan creation wizard outside the add-exercise/composer boundary.

#### Suggested Milestones

1. `Product & Design Spec`
2. `Catalog Strategy`
3. `Library UX Implementation`
4. `Custom & Mixed Workout Items`
5. `QA & Release Readiness`

#### Success Criteria

- A user can add a day containing Bench Press, Zone 2 Bike, Copenhagen Plank, Tibialis Raises, and Couch Stretch without leaving the plan creation flow.
- Search does not resize or move the plan composer while typing.
- No-match search offers `Create "<query>"` immediately.
- Created custom exercises persist locally and can be reused.
- Exercise rows use thumbnails or stable fallback media.
- Rows use stable identity from provider ID or normalized custom ID.
- The visual system feels calmer than the current high-contrast search panel: more charcoal/gray hierarchy, less neon green, no jumpy expansion.

## Issue Specs

### 1. Design full-screen Add Exercise library

#### Linear Fields

- Title: `Design full-screen Add Exercise library`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Product & Design Spec`
- Priority: High
- Estimate: 3
- Labels: `Needs Design`, `Feature`

#### Description

##### Goal

Create the final design spec for Concept 1: a full-screen `Add Exercise` library launched from the plan composer.

##### User Problem

Inline exercise search is too cramped and unstable to support search, thumbnails, filters, no-match recovery, and mixed exercise types. The user needs a dedicated surface where exercise discovery feels calm and confident.

##### UX Direction

When the user taps `Add first exercise` or `Add exercise` inside a day, open a full-screen `Add Exercise` library.

Required screen structure:

- Top navigation with dismiss/back affordance and optional `Create New`.
- Pinned search field.
- Horizontal type filters: All, Strength, Mobility, Stability, Cardio, Stretch, Timer.
- Optional muscle/equipment filters behind a filter control.
- Stable grouped results list.
- Visual rows with thumbnail, exercise name, type, equipment, target, and add/selected state.
- Optional multi-select mode so the user can add several exercises before returning to the day.
- Clear empty, loading, offline, and no-exact-match states.

##### Visual Direction

Use the Problem 5 visual language:

- Matte charcoal background.
- Off-white primary text, muted gray metadata.
- Green only for selected filters, selected rows, and primary actions.
- Subtle separators instead of heavy nested cards.
- Fixed-height rows.
- No neon glow, no decorative gradients, no animated search-panel expansion.

Reference concept:

`/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/04-problem5-warm-charcoal-library.png`

##### Acceptance Criteria

- Design spec defines the full-screen layout for empty, searching, results, selected, loading, offline, and no-match states.
- Search field remains pinned while results scroll.
- Rows have stable dimensions and cannot shift while thumbnails load.
- Result rows include at minimum name, type, equipment, target, thumbnail/fallback, and add/selected control.
- Type filters include Strength, Mobility, Stability, Cardio, Stretch, and Timer.
- Spec states how multi-select works and how selected exercises return to the composer.
- Spec includes accessibility expectations for row labels, button labels, Dynamic Type, and reduced motion.
- Spec explicitly says the composer should not auto-scroll or resize while the user types in the library.

##### Dependencies

- Exercise item taxonomy issue.
- Concept 1 + Concept 3 integration issue.
- Media-backed row strategy issue.

##### Out of Scope

- Implementing provider/API changes.
- Building instruction/video playback.
- Reworking unrelated Overview, Plans, or workout logging screens.

---

### 2. Specify Concept 1 + Concept 3 integration flow

#### Linear Fields

- Title: `Specify Concept 1 + Concept 3 integration flow`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Product & Design Spec`
- Priority: High
- Estimate: 2
- Labels: `Needs Design`, `Feature`

#### Description

##### Goal

Define the exact combined concept: Concept 1 is the primary add-exercise library, and Concept 3 is the embedded no-match/custom-exercise recovery path.

##### Decision

Concept 3 should not be a separate destination that competes with the library. It should appear inside the full-screen `Add Exercise` flow when search has no exact match or when the user taps `Create New`.

##### Required Flow

1. User is editing Monday in the plan composer.
2. User taps `Add Exercise`.
3. App presents full-screen `Add Exercise` library.
4. User searches `Tibialis Raise`.
5. If catalog has exact/near matches, show them first.
6. Always provide a create affordance when the query is specific enough: `Create "Tibialis Raises"`.
7. If no exact match exists, show the create row as the primary next action, not a dead end.
8. User taps create row.
9. Show compact custom exercise creation inside the library context.
10. User chooses type preset: Strength, Mobility, Stability, Cardio, Stretch, or Timer.
11. Form adapts default fields to the selected type.
12. User saves.
13. Created exercise is added to the current selection and stored in the personal library.
14. User taps `Add to Monday` or equivalent confirmation.
15. App returns to composer with the new exercise inserted into Monday.

##### Type-Specific Form Rules

- Strength: name, equipment, target, default sets, default reps, optional weight.
- Cardio: name, equipment/activity, default duration, optional distance, optional zone.
- Mobility: name, target area, default duration or reps.
- Stability: name, target area, default duration or reps.
- Stretch: name, target area, side/bilateral option, default hold duration.
- Timer: label, duration, optional rounds.

##### Return-State Rules

The composer should receive selected or created exercises as structured plan items. It should not receive raw text only. The return state should show stable rows with thumbnails or fallback icons and editable prescriptions.

Reference concepts:

- Library: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/01-full-screen-exercise-library.png`
- Recovery: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/03-custom-exercise-recovery.png`
- New recovery direction: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/06-problem5-quiet-pro-custom-recovery.png`
- Composer return direction: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/05-problem5-training-notebook-composer.png`

##### Acceptance Criteria

- Spec includes a step-by-step flow from composer to library to custom recovery to composer return.
- Spec defines when `Create "<query>"` appears.
- Spec defines how exact match, partial match, and no-match states differ.
- Spec defines what data is created for each exercise type.
- Spec defines how cancel/back behaves at each layer without losing typed search or selected items unexpectedly.
- Spec defines how newly created exercises are reused in future searches.
- Spec includes error states for failed save and duplicate custom exercise names.

##### Dependencies

- Exercise item taxonomy issue.
- Personal exercise library issue.
- Full-screen Add Exercise library issue.

##### Out of Scope

- Choosing the external exercise provider.
- Building a full exercise editor for every metadata field.

---

### 3. Design calmer Problem 5 visual direction for plan creation

#### Linear Fields

- Title: `Design calmer plan creation visual direction`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Product & Design Spec`
- Priority: High
- Estimate: 3
- Labels: `Needs Design`, `Improvement`

#### Description

##### Goal

Create the visual design spec for Problem 5: plan creation should keep ScratchWorkout's dark athletic identity while becoming calmer, more scannable, and less tiring during long setup flows.

##### Problem

The current black/white/neon contrast is strong, but plan creation is a prolonged task. Long forms and search surfaces need more gray hierarchy, softer row separation, stable dimensions, and less green decoration.

##### New Visual Direction

Use a restrained dark productivity/training language:

- Background: charcoal/graphite, not pure black.
- Primary text: off-white, not hard white everywhere.
- Metadata: warm or cool muted gray.
- Accent: green only for selected filters, selected rows, primary action, or successful saved state.
- Surfaces: grouped rows and separators, not nested floating cards.
- Media: thumbnails add recognition and warmth.
- Headings: compact and practical.
- Motion: quiet crossfades and selection feedback, not expanding panels while typing.

##### Generated Concepts

Use these imagegen concepts as the concrete comparison set:

- Warm Charcoal Library: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/04-problem5-warm-charcoal-library.png`
- Training Notebook Composer: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/05-problem5-training-notebook-composer.png`
- Quiet Pro Custom Recovery: `/Users/marvinbeckmann/Documents/workout tracker app/screenshots/ux-concepts/06-problem5-quiet-pro-custom-recovery.png`

##### Required Design Outputs

- Token recommendations for plan creation surfaces: background, row surface, separator, primary text, secondary text, accent, warning/error.
- Row anatomy for exercise library rows and composer rows.
- Filter chip states: default, selected, disabled, overflow.
- Search field states: idle, focused, typing, loading, error.
- Add/selected button states.
- Custom exercise form layout.
- Bottom confirmation/action bar treatment.
- Motion and haptic rules.

##### Acceptance Criteria

- Design spec picks a final direction or combines the generated concepts deliberately.
- Spec explains which parts of the current visual language remain and which are softened.
- Spec includes concrete color/typography/spacing guidance that can be implemented in SwiftUI.
- Spec covers library, composer return state, and custom recovery state.
- Spec avoids decorative gradients, nested cards, green overuse, and hero-scale headings inside planning surfaces.
- Spec includes a visual QA checklist for small iPhone screens and Dynamic Type.

##### Dependencies

- Full-screen Add Exercise library issue.
- Concept 1 + Concept 3 integration issue.

##### Out of Scope

- Rebranding the whole app.
- Changing unrelated app tabs unless needed for consistency after the plan creation work lands.

---

### 4. Investigate catalog/API strategy for mixed workout items

#### Linear Fields

- Title: `Investigate catalog/API strategy for mixed workout items`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Catalog Strategy`
- Priority: Urgent
- Estimate: 3
- Labels: `Feature`, `Improvement`

#### Description

##### Goal

Solve Problem 4 at the source: determine whether ScratchWorkout can rely on the current ExerciseDB path, needs a different API/provider, needs an expanded bundled catalog, or needs a hybrid strategy.

##### Problem

The current provider-backed direction is useful for common strength exercises, but a real user plan includes cardio, mobility, stability, stretch, warm-up, rehab-like work, timers, and specialty movements. The catalog must support these without making the user fight the app.

##### Options To Evaluate

- Continue with OSS ExerciseDB for strength movements and supplement with local seed data.
- Switch to or add another exercise API with broader modality coverage.
- Build a curated first-party catalog for common mixed training items.
- Make custom/personal exercises the primary fallback for missing items.
- Hybrid: provider catalog + bundled mixed training catalog + personal library.

##### Evaluation Criteria

- Coverage of strength, cardio, mobility, stability, stretch, warm-up, and timers.
- Licensing/commercial use safety.
- API stability, rate limits, availability, and documentation quality.
- Metadata quality: equipment, target area, type, images/videos, instructions.
- Stable IDs and migration story.
- Offline fallback feasibility.
- App Store/privacy implications.
- Cost and operational complexity.
- Ability to support non-English/localized naming later.

##### Deliverable

Produce a short decision document with:

- Provider comparison.
- Recommended catalog strategy for first public release.
- Recommended long-term strategy.
- Risks and fallbacks.
- Data model implications.
- Migration implications for already-saved plans.

##### Acceptance Criteria

- At least three realistic catalog strategies are compared.
- Decision explicitly covers the examples: Bike Riding, Zone 2 Bike, Tibialis Raises, Copenhagen Plank, Couch Stretch, Warm-up Walk, Shoulder CARs.
- Decision states whether current OSS ExerciseDB remains in use.
- Decision states what belongs in bundled seed data versus personal custom data.
- Decision states how missing media is handled.
- Decision links back to existing Linear catalog work where relevant, especially Exercise Database Integration issues.

##### Dependencies

- Existing `Exercise Database Integration` project context.
- Exercise item taxonomy issue.

##### Out of Scope

- Full implementation of the chosen provider.
- Building a backend proxy unless the decision requires one as follow-up work.

---

### 5. Define first-class workout item taxonomy and data model

#### Linear Fields

- Title: `Define first-class workout item taxonomy and data model`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Catalog Strategy`
- Priority: High
- Estimate: 3
- Labels: `Feature`

#### Description

##### Goal

Define the app-facing model that lets ScratchWorkout plan and log Strength, Cardio, Mobility, Stability, Stretch, and Timer items without forcing everything into sets and reps.

##### Required Types

- Strength
- Cardio
- Mobility
- Stability
- Stretch
- Timer

##### Required Prescription Shapes

- Strength: sets, reps, optional weight, optional rest.
- Cardio: duration, optional distance, optional zone/intensity, optional equipment.
- Mobility: duration or reps, optional side, target area.
- Stability: duration or reps, optional side, target area.
- Stretch: hold duration, optional side, target area.
- Timer: duration, optional rounds, optional rest.

##### Model Requirements

- Saved plans remain Codable-compatible.
- Existing strength plans continue to decode.
- Provider exercise metadata and custom exercise metadata can both map into the same app-facing item.
- Stable identity is available for rows and saved plan references.
- Items support thumbnails/media when available but do not require media.
- Type-specific default prescriptions can be created from catalog metadata or custom form input.

##### Acceptance Criteria

- Spec defines data structures or enum shapes for item type and prescription type.
- Spec defines migration behavior for existing `ExercisePrescription` saved data.
- Spec defines how existing strength-only UI maps into the new type system.
- Spec defines which fields are required versus optional for each type.
- Spec defines display formatting for each prescription in composer rows.
- Spec defines validation rules for empty/invalid duration, distance, reps, and name.

##### Dependencies

- Catalog/API strategy issue.
- Concept integration issue.

##### Out of Scope

- Full logging UI redesign.
- Cloud schema changes unless required for compatibility notes.

---

### 6. Build personal exercise library and custom exercise persistence

#### Linear Fields

- Title: `Build personal exercise library and custom exercise persistence`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Custom & Mixed Workout Items`
- Priority: High
- Estimate: 5
- Labels: `Feature`

#### Description

##### Goal

Let users create missing exercises once and reuse them in future plan creation.

##### User Problem

When search does not find a movement like `Tibialis Raises`, the user should not be blocked and should not need to type it again in every plan.

##### Scope

- Add local personal exercise storage.
- Support create, edit, and archive/delete for custom exercises.
- Include fields needed by the Concept 3 recovery flow.
- Make custom exercises searchable alongside provider/bundled catalog items.
- Prevent obvious duplicates while allowing user override.
- Support optional photo or fallback thumbnail.

##### Required Fields

- Stable custom ID.
- Name.
- Type.
- Equipment/activity.
- Target area or primary target.
- Default prescription.
- Optional notes.
- Optional photo/image URL/fallback icon.
- Created/updated timestamps.
- Archived flag or equivalent soft-delete behavior.

##### Acceptance Criteria

- A custom exercise created from no-match recovery appears immediately in the current selection.
- The same custom exercise appears in future Add Exercise searches.
- Custom exercises persist across app relaunches.
- Duplicate names are handled gracefully.
- User can edit metadata before adding or later from a management surface.
- Deleted/archived custom exercises do not break saved plans that already reference them.
- Offline behavior works because custom exercises are local.

##### Dependencies

- Exercise item taxonomy issue.
- Concept integration issue.
- Catalog/API strategy issue.

##### Out of Scope

- Cross-device sync.
- Sharing custom exercises publicly.

---

### 7. Implement full-screen Add Exercise library and composer return

#### Linear Fields

- Title: `Implement full-screen Add Exercise library and composer return`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Library UX Implementation`
- Priority: High
- Estimate: 8
- Labels: `Feature`

#### Description

##### Goal

Replace the cramped inline search interaction with a full-screen Add Exercise library that returns selected items to the active day composer.

##### Scope

- Launch library from `Add first exercise` and `Add exercise`.
- Preserve current plan creation progression: frequency -> day building -> review -> activation.
- Keep day composer stable while the library is active.
- Support single-select first, with implementation shape that can support multi-select.
- Return selected/created items to the correct day.
- Keep existing plan save behavior working.

##### Implementation Notes

Current code observations:

- `CreatePlanView` owns the progressive plan creation flow.
- `PlanEntrySurface` currently handles inline search/results.
- `PlanDetailView` has similar search behavior for editing.
- Search rows need stable identity from provider ID or normalized custom ID, not fresh UUIDs.

##### Acceptance Criteria

- Tapping `Add Exercise` opens a full-screen library.
- Selecting an exercise returns it to the active day or adds it to a pending selection that can be confirmed.
- The composer row displays the selected item with thumbnail/fallback, name, and default prescription.
- Existing create-plan review and activation still work.
- Existing plan edit flow either uses the same library or has a documented follow-up if not included.
- The app remains usable offline with bundled/custom fallback results.
- Keyboard/search result updates do not auto-scroll the composer.
- Accessibility labels identify exercise name, type, metadata, and add/selected state.

##### Dependencies

- Full-screen Add Exercise design spec.
- Exercise item taxonomy issue.
- Media-backed rows issue.
- Personal exercise library issue for custom flow.

##### Out of Scope

- Rewriting the whole plan builder navigation.
- Building advanced exercise detail pages.

---

### 8. Implement media-backed exercise rows and fallback thumbnails

#### Linear Fields

- Title: `Implement media-backed exercise rows and fallback thumbnails`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Library UX Implementation`
- Priority: Medium
- Estimate: 3
- Labels: `Improvement`

#### Description

##### Goal

Make exercise selection more recognizable by showing thumbnails or stable fallback visuals in library and composer rows.

##### Problem

Text-only search forces users to already know exact movement names. Thumbnails answer "is this the thing I mean?" faster than metadata alone.

##### Scope

- Use existing `thumbnailURL`, `imageURL`, `imageURLs`, and `videoURL` fields where available.
- Define thumbnail loading size and caching behavior.
- Add fallback icons/placeholders by exercise type.
- Prevent row layout shift while thumbnails load.
- Avoid blocking plan save or row selection on image loading.

##### Acceptance Criteria

- Library rows reserve fixed thumbnail space.
- Composer rows show thumbnail or fallback icon consistently.
- Slow/missing image URLs do not resize rows or block selection.
- Fallbacks differ enough by type to help scanning.
- Media loading respects offline state and cache behavior.
- Accessibility labels do not rely on thumbnail content.

##### Dependencies

- Full-screen Add Exercise design spec.
- Catalog/API strategy issue.

##### Out of Scope

- Full video playback.
- Muscle activation diagrams.

---

### 9. Support mixed prescription editing in composer rows

#### Linear Fields

- Title: `Support mixed prescription editing in composer rows`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `Custom & Mixed Workout Items`
- Priority: High
- Estimate: 5
- Labels: `Feature`

#### Description

##### Goal

Let the plan composer configure non-strength items naturally after they are added from the library.

##### Problem

If every item is forced into sets and reps, cardio, mobility, stretches, warm-ups, and timers feel like hacks. The composer needs type-aware prescriptions.

##### Required Editing Patterns

- Strength row: sets, reps, optional weight/rest.
- Cardio row: duration, optional distance, optional zone.
- Mobility row: duration or reps, target area, optional side.
- Stability row: duration or reps, target area, optional side.
- Stretch row: hold duration, optional side.
- Timer row: duration and optional rounds.

##### Acceptance Criteria

- Composer displays each item with a concise prescription summary.
- Editing an item opens type-appropriate controls.
- Existing strength item editing remains at least as fast as before.
- Invalid values are prevented or clearly corrected.
- Review screen displays mixed item prescriptions correctly.
- Saved plans persist and reload mixed prescriptions.
- Workout logging follow-up needs are documented if logging support is incomplete.

##### Dependencies

- Exercise item taxonomy issue.
- Implement full-screen library issue.

##### Out of Scope

- Complete workout logging redesign for every type, unless required to prevent broken saved plans.

---

### 10. QA expanded plan creation and catalog recovery

#### Linear Fields

- Title: `QA expanded plan creation and catalog recovery`
- Project: `Workout Catalog Expansion (Problem 4)`
- Milestone: `QA & Release Readiness`
- Priority: High
- Estimate: 3
- Labels: `Improvement`

#### Description

##### Goal

Verify that the new add-exercise and mixed catalog model solves the real failure cases without regressions in existing plan creation.

##### Test Matrix

- Create plan with one strength exercise.
- Create plan with mixed day: Bench Press, Zone 2 Bike, Copenhagen Plank, Tibialis Raises, Couch Stretch.
- Search exact match.
- Search partial match.
- Search no exact match and create custom exercise.
- Search offline with fallback data.
- Provider unavailable.
- Slow thumbnail loading.
- Missing thumbnail.
- Duplicate custom exercise name.
- Add, cancel, and return from library.
- Edit an existing plan and add a mixed item.
- Relaunch app and confirm saved mixed plan persists.
- Dynamic Type.
- VoiceOver labels.
- Reduced motion.
- Small iPhone screen.

##### Acceptance Criteria

- QA checklist is documented and run on an iOS simulator.
- Bugs are filed for any blocking issue found.
- Existing strength-only plan creation still works.
- Mixed item saved-plan decode/reload works.
- No-match recovery creates and reuses a custom exercise.
- Library search does not cause composer scroll jumps.
- Visual QA confirms the calmer Problem 5 direction was applied consistently.

##### Dependencies

- Implementation issues for library, personal exercises, media rows, and mixed prescriptions.

##### Out of Scope

- App Store release submission.
- Performance profiling beyond obvious interaction regressions.

