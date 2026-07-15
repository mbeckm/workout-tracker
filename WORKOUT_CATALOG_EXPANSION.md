# Workout Catalog Expansion

Implementation and product decision record for Linear project `Workout Catalog Expansion (Problem 4)`, issues MAR-57 through MAR-66.

## Product Boundary

The plan composer remains the stable day-building surface. `Add Exercise` is a dedicated full-screen library stage that owns discovery, search, filtering, selection, media, and custom recovery. It returns structured `ExercisePrescription` values to the originating day only after confirmation.

The first-class workout item types are:

| Type | Required prescription | Optional prescription |
| --- | --- | --- |
| Strength | sets and reps | weight, assistance, rest |
| Cardio | duration | distance, training zone, equipment |
| Mobility | duration or reps | side, target area |
| Stability | duration or reps | side, target area |
| Stretch | hold duration | side, target area |
| Timer | duration | rounds, rest |

Existing saved exercises decode as Strength unless their legacy provider type or tracking mode clearly identifies another type. Legacy custom values migrate as follows: `endurance` to Cardio, `health` to Mobility, and unknown/`other` to Strength. All newly encoded data uses the six current values.

## Library Interaction

- The search field and type filters are pinned above the scrolling results.
- Filters are All, Strength, Cardio, Mobility, Stability, Stretch, and Timer.
- Rows reserve fixed media and control space. Remote images never gate selection; local muscle artwork or a type-specific SF Symbol is used as fallback.
- Green is limited to selected filters, selected rows, create recovery, and the primary confirmation action.
- Result identity is stable: custom UUID, provider ID, or normalized bundled name.
- Selection is multi-select. The bottom action reads `Add <count> Exercises to <day>`.
- Closing with a non-empty selection requires discard confirmation. Closing without a selection returns immediately.
- The composer does not render or scroll behind library search updates.

## Exact, Partial, and Missing Search

- Exact match: the existing result is shown and no duplicate create row is promoted.
- Partial match: `Create "<query>"` appears first when the normalized query has at least three non-space characters, followed by close matches.
- No match: the same create row is the primary next action; provider/offline status remains secondary.
- Empty query: bundled mixed items and saved custom exercises are shown.

Custom creation stays inside the library. Back preserves the query. Saving creates or updates the personal item, selects it, and returns to the library rather than dismissing to the composer. An existing normalized custom name is selected instead of duplicated. Custom rows expose edit and archive actions; archiving removes them from future discovery but does not alter prescriptions already embedded in saved plans.

## Catalog Strategy Decision

### Compared strategies

1. **ExerciseDB only.** Good strength coverage and GIF media, but the free endpoint is explicitly non-commercial, attribution-required, rate-limited, and not broad enough for the mixed examples. This is unsuitable as the only public-release catalog. Official terms: <https://oss.exercisedb.dev/docs>.
2. **Replace ExerciseDB with wger.** wger offers an open API, localization, and configurable sets/reps/duration/distance. Its data and media have per-entry/ShareAlike obligations and its catalog remains community-shaped, so replacement would add migration and attribution work without eliminating the need for first-party mixed items. Official documentation: <https://wger.readthedocs.io/en/latest/> and <https://wger.de/en-gb/>.
3. **Hybrid catalog.** Keep the current provider adapter for strength during prototype development, add a curated bundled mixed catalog for guaranteed/offline coverage, and make the personal library the immediate recovery path. Provider IDs, bundled normalized IDs, and custom UUIDs share one app-facing model.

### Decision

Use the hybrid strategy for the first public release boundary.

- ExerciseDB remains behind `ExerciseCatalogService`; it is not a release-safe commercial dependency until a paid/commercial license is secured or it is replaced.
- Bundled data owns common mixed items and offline guarantees, including Zone 2 Bike, Copenhagen Plank, Tibialis Raises, Couch Stretch, Warm-up Walk, Shoulder CARs, and a generic Interval Timer.
- Personal custom data owns user-, gym-, rehab-, and specialty-specific movements.
- Missing media always falls back locally by workout type or target area.
- A future provider change maps into `ExerciseCatalogItem` and must preserve provider IDs. Saved plans remain self-contained `ExercisePrescription` snapshots, so provider removal cannot break them.

Longer term, evaluate a commercially cleared downloadable first-party dataset or a licensed provider behind the same adapter. wger is a useful reference/fallback source only after entry-level licensing and attribution requirements are audited.

## Provider Prescription Inference

The live ExerciseDB V1 payload does not provide sets, reps, duration, distance, a workout category, or a tracking mode. Its useful classification inputs are `name`, `bodyParts`, `targetMuscles`, and `equipments`. For example, the provider describes `stationary bike run` with the Cardio body part and Cardiovascular System target, while the abdominal movement named `air bike` has the Waist body part and Abs target. Name-only classification would therefore produce avoidable false positives.

The catalog adapter now resolves a suggested prescription in this order:

1. Preserve a bundled, cached, or user-selected item type and tracking mode when present.
2. Treat structured Cardio body-part, Cardiovascular target, and known cardio-equipment values as Cardio.
3. Apply narrow name rules for stretches, timers, mobility/CARs, and static holds/planks.
4. Default all remaining provider results to Strength, using equipment to choose weighted, assisted, or reps-only tracking.

Suggested starting prescriptions are intentionally conservative:

| Inferred type | Suggested input | Default |
| --- | --- | --- |
| Strength | sets + reps | 3 × 12 |
| Cardio | duration | 20 minutes |
| Mobility | sets + reps | 2 × 8 |
| Stability hold | sets + duration | 3 × 30 seconds |
| Stretch | duration | 30 seconds |
| Timer | duration | 60 seconds |

Continuous Cardio, Stretch, and Timer items no longer ask for a redundant set count. Cardio duration is edited in minutes; holds remain in seconds. Every expanded configuration card also exposes `Track by`, scoped to sensible modes for that item type, so users can correct an imperfect provider inference without creating a duplicate custom exercise.

## Visual Specification

- Library background: the existing base with a restrained charcoal overlay.
- Rows: `surface1`, fixed 112pt height, subtle bottom separator, 80pt media area.
- Search: fixed 56pt field; no expanding result panel.
- Filter chips: 36pt; `surface2` default, accent selected.
- Text: Inter product tokens; primary row content in off-white, metadata in secondary gray.
- Add state: gray plus button; selected state: green checkmark.
- Custom form: compact grouped property rows and type presets; validation remains inline.
- Motion: route transition for composer/library, quiet row selection spring, no auto-scroll on result replacement. Reduce Motion uses the existing reduced transition family.
- Haptics: light selection, medium save/confirmation.

### Accessibility QA

- Every result announces name, workout type, equipment, target, and selected state without relying on its thumbnail.
- Filter chips expose selected state.
- Controls maintain at least 44pt targets.
- Fixed media/control columns protect row stability under image loading.
- Text truncates before controls are displaced; Dynamic Type and small-screen results require simulator/device verification before release.
