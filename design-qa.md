# Design QA — Plan Rhythm

- Source visual truth: `/Users/marvinbeckmann/.codex/generated_images/019f681d-0e41-71b2-8997-df56e9a4e554/exec-e3a7ff31-357b-4a5c-b493-6d17c58b296a.png`
- Implementation screenshot: `/tmp/ScratchWorkout-plan-rhythm-home-final.png`
- Viewport: iPhone Air simulator, portrait
- State: signed out, one-day active plan, two completed workout dates this month

## Full-view comparison evidence

The source and implementation were opened together. The implementation preserves the source's plan-first hierarchy, ordered path, strong immediate workout action, compact monthly consistency block, monochrome palette, and single green active state. It intentionally omits the source's invented weekday/rest-day schedule and renders only persisted workout days. The app's existing Inter typography, grain, native tab bar, account entry, margins, and color tokens are preserved.

## Focused comparison evidence

No separate crop was required: the Home screen's primary type, path nodes, action, weekday labels, and month dots are readable in the full-resolution pair. The implementation uses native SF Symbols only for standard navigation controls and no missing raster assets are present.

## Findings

- No P0, P1, or P2 fidelity issues remain in the verified Home state.
- P3: The implementation makes the workout CTA full-width instead of the source's compact inline button. This is intentional to preserve the existing 44-point-plus primary-action pattern and keep the next action immediate.
- P3: Large plans show a four-day window with earlier/more labels. This intentionally limits vertical path complexity while keeping the true next workout visible.

## Required fidelity surfaces

- Fonts and typography: Existing Inter hierarchy retained; no clipping in the verified state.
- Spacing and layout rhythm: 24-point screen margins retained; primary sections remain clearly separated without adding containers.
- Colors and visual tokens: Existing base, surface, border, text, and accent tokens only; contrast is unchanged or improved.
- Image quality and assets: The selected direction contains no required photographic or illustrated assets. Standard system icons remain native.
- Copy and content: Uses real plan names, real exercise counts, real plan ordering, and real logged month dates. No fake rest days, goals, or schedule mapping.

## Comparison history

- Initial capture: weekday labels truncated because three-letter labels were forced into compact columns.
- Fix: changed labels to one-letter weekday symbols.
- Post-fix evidence: `/tmp/ScratchWorkout-plan-rhythm-home-final.png`; compact month header and weekday row fit the viewport.

## Interaction and runtime checks

- App installed and launched successfully in the iPhone Air simulator.
- Home primary controls remain wired to active-plan detail and next-workout preview.
- Compiler and linker verification completed with `xcodebuild`.

final result: passed
