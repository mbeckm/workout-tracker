# Existing Program Import — User Flow

## Product principle

This is not a training assessment or a plan generator. Scratch assumes the user already owns or understands the program. Its job is to turn an external representation into editable Scratch data with as little transcription as possible.

The user stays in control:

- Scratch never silently changes exercise names, sets, reps, day order, or notes.
- Uncertain matches are surfaced only where necessary.
- The original source remains visible during review.
- The user can leave and resume the import draft.
- No schedule, cadence, account, or notification setup is required.

## Grounding in the shipped Scratch UI

This flow must reuse the visual and interaction anatomy captured from the running app, not a generic import UI:

- Plan creation and detail remain inside the Plans tab context.
- Screen titles use Scratch's existing large, left-aligned treatment and established safe-area spacing.
- Workout days use the thick segmented progress bars already used by Create Plan and Plan Detail.
- Imported exercises render as the existing large exercise cards: muscle thumbnail on the left, exercise/equipment/muscle metadata in the middle, and sets/reps aligned on the right.
- Exercise matching reuses the existing catalog search result and inline set/rep configuration patterns.
- Primary actions use the existing centered floating neon CTA above the tab bar.
- The final imported plan should look indistinguishable from an existing manually created plan.

Actual reference captures live in `design-research/actual-app/`.

## Revised eight-screen onboarding

The flow is intentionally more elaborate than a two-screen utility, but each step performs real work:

1. **Bring in your program** — concise value entry with an authentic Scratch plan preview; no questionnaire.
2. **Choose source** — screenshots/photos, document, paste text, or manual entry.
3. **Prepare pages** — verify count and order, add/remove/rotate, then read the source.
4. **Reading state** — honest staged status: reading pages, finding workout days, matching exercises.
5. **Import summary** — detected plan title, day count, exercise count, and exceptions before deep review.
6. **Review days** — the actual Scratch day bars and exercise cards; swipe/select days and edit only where needed.
7. **Resolve issues** — catalog match using the same exercise imagery and metadata as current search/configuration.
8. **Save plan** — final name, counts, source-note disclosure, and `Save & Activate` / `Save to Plans`.

The post-onboarding handoff is the existing Home screen with the imported plan shown under Active Plan and its first day under Next in plan.

## Primary flow

### 0. Entry

On a fresh install, Home shows one product-level empty state:

- Primary: `Add your program`
- Secondary: `Start without a plan`

Existing users can reach the same flow from Plans → `+` → `Import program`.

### 1. Choose the source

Title: `Import Program`

Source actions:

- `Photos & Screenshots` — multi-select, because programs often span several screenshots.
- `Take Photos` — capture one or more pages.
- `Choose Document` — PDF, image, or plain-text document.
- `Paste Text` — ideal for a program copied from ChatGPT, email, Notes, or a coach portal.
- `Enter Manually` — always available as the predictable fallback.

The screen explains only one thing: `Use whatever you already have.`

### 2. Confirm the input

For photos/screenshots/documents, show the selected pages before processing:

- Page thumbnails in order.
- Drag to reorder.
- Remove or add pages.
- Rotate/crop only when recognition requires it.
- Primary: `Read Program`.

For pasted text, this step is the editable text field with `Review Import`.

### 3. Read the program

Use a short, honest processing state:

- `Reading 3 screenshots…`
- Then `Matching exercises…`

Do not show fake percentage progress. The user can cancel without losing the selected source.

If recognition fails, preserve the input and offer `Try Again`, `Paste Text`, or `Enter Manually`.

### 4. Review the parsed structure

This is the core trust screen.

Summary:

- `4 days`
- `22 exercises`
- `2 need review`

The user reviews one day at a time using Scratch's existing day-progress control. Each row shows:

- Detected exercise name.
- Sets × reps or rep range.
- Optional notes, tempo, RIR/RPE, rest, or superset label preserved as text when Scratch cannot model it structurally.
- A warning only when the match is uncertain or required data is missing.

Actions:

- Tap any row to edit.
- Drag to reorder.
- Add, remove, or move exercises between days.
- `Review 2 Issues` as the primary action while unresolved issues remain.
- `Save Program` when everything required is resolved.

### 5. Resolve only uncertain items

One issue per screen or sheet:

- Original source snippet at the top.
- Scratch's proposed catalog match.
- Two or three likely alternatives.
- `Keep as Custom Exercise` escape hatch.

Examples:

- `Incline DB Row` → `Incline Dumbbell Row`.
- `Cable Y Raise` has no confident match → keep the original name as a custom exercise.
- `3 x 8–12, last set AMRAP` → preserve `3 × 8–12`; keep `Last set AMRAP` as a note.
- `A1 / A2` supersets → preserve the label and sequence even if full superset behavior is not yet implemented.

Low-risk omissions, such as a missing rep target, should not block import. Save them blank and let the user complete them later.

### 6. Final review and save

Final fields:

- Plan name, prefilled from the document title when available.
- All imported days and exercise counts.
- Any preserved notes called out plainly.

Actions:

- Primary: `Save & Activate`.
- Secondary: `Save to Plans`.

There is no weekday assignment. `Day 1`, `Push`, or the imported heading remains the workout-day identity.

### 7. Handoff

Return to Home with the imported plan visibly active and the first workout ready to open. The import is successful only when the user recognizes their program—not merely when parsing finishes.

## Important edge cases

- Multiple screenshots in the wrong order: reorder before or during review.
- Repeated headers and footers from PDFs: ignore visually but never remove exercise-like lines without review.
- Tables with weeks or phases: ask whether to import one phase or create separate plans.
- Exercise aliases: match against the catalog but preserve the original label in the review UI.
- Rep ranges, AMRAP, tempo, RIR/RPE, rest, and coaching notes: preserve source text even when the current model cannot structure it.
- One exercise spanning a page break: join only when confidence is high; otherwise flag it.
- Unsupported or low-quality file: keep the source and route to paste/manual entry.
- Large programs: import as a draft and let the user review day-by-day rather than showing one enormous editor.

## Success metrics

- Import started → program saved.
- Median time from source selection to saved plan.
- Percentage of exercises accepted without editing.
- Number of uncertain matches per import.
- Draft abandonment and resume rate.
- Imported plan opened for the first workout.

Do not optimize only for parser acceptance. A quick but incorrectly imported program is worse than a slightly slower, trustworthy review.

## Rendered design set

The grounded eight-screen concept is in `design-research/generated/import-flow-grounded/`:

1. `01-bring-your-program.png` — value proposition and import entry.
2. `02-choose-source.png` — photos, camera, document, paste, or manual entry.
3. `03-prepare-pages.png` — page ordering and source cleanup.
4. `04-reading-program.png` — honest staged processing state.
5. `05-program-found-v2.png` — parsed summary using ScratchWorkout's shipped day-bar pattern.
6. `06-review-program.png` — day-by-day review using the shipped exercise-card anatomy.
7. `07-check-exercise.png` — uncertain catalog match resolution using the shipped search/configuration pattern.
8. `08-save-plan.png` — final save and activation using the shipped activation prompt.

The visual source of truth is `design-research/actual-app/`, captured from the running iOS Simulator. The generated screens deliberately reuse the real black base, neon accent, title rails, day bars, exercise imagery, sets/reps treatment, floating CTA, and Plans-tab context. Image generation adds a slight soft sheen in places; implementation should retain the app's fully flat black background and native symbols rather than reproducing that artifact.
