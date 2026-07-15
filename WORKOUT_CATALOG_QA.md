# Workout Catalog Expansion QA

QA record for Linear issue MAR-66, last rechecked on July 13, 2026. Simulator automation is limited because this project currently has no test target and the XcodeBuildMCP UI driver is not installed; build, launch, rendered-state, offline, and compatibility checks are recorded separately from interactions reserved for the device release checklist.

## Automated and Simulator Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Debug build, iOS Simulator | Pass | Xcode 26.6, iOS 26.5, iPhone 17e |
| Release build and static analysis | Pass | `xcodebuild build analyze`; only expected no-AppIntents metadata warning |
| App launch | Pass | `simctl install/launch`; normal root and catalog QA route remain running |
| Existing Codable strength plan | Pass | executable DEBUG assertion decodes an old minimal prescription as Strength + Weight/Reps |
| Legacy custom type migration | Pass | executable DEBUG assertions map Endurance to Cardio and Health to Mobility |
| Mixed Codable round trip | Pass | executable DEBUG assertion covers all six types and stable catalog IDs |
| Mixed bundled coverage | Pass in code | required mixed examples are in `SampleData.exerciseDatabase` |
| Stable result identity | Pass in code | provider ID, custom UUID, or normalized bundled ID |
| Offline fallback | Pass in code | cache then bundled catalog; custom library is local |
| Missing/slow thumbnail | Pass in code | fixed frame and local/type fallback in `ExerciseArtwork` |
| No-match create rule | Pass in code | three-character normalized query with exact-match suppression |
| Exact-match suppression | Pass in simulator | Tibialis Raises returns the Stability item without a Create row |
| No-match recovery | Pass in simulator | Nordic Flow renders Create "Nordic Flow" as the first result |
| Empty-query type filters | Pass in simulator | Cardio shows Zone 2 Bike and Warm-up Walk without requiring a search query |
| Dynamic Type XXXL, smallest simulator | Pass in simulator | library remains searchable, filterable, and the Create row remains actionable on iPhone 17e |
| Duplicate custom name | Pass in code | existing personal item is selected instead of duplicated |
| Custom relaunch persistence | Pass in code | custom definitions remain in `WorkoutSnapshot` |
| Archived custom compatibility | Pass in code | archive hides the definition; saved prescriptions are embedded |
| Archive/cloud conflict | Pass in executable DEBUG assertion | the newest timestamp wins, preventing stale remote state from restoring an archived item |
| Mixed prescription persistence | Pass in code | all new fields are optional Codable additions |
| Metric-aware workout logging | Pass in code | active logger derives controls and completion from tracking mode |
| Live API prescription inference | Pass in live simulator route + assertions | ExerciseDB returned Stationary Bike Run with remote media; it becomes Cardio + 20-minute Duration, while Incline Press remains Strength + Reps |
| Ambiguous API name protection | Pass in simulator assertions | abdominal Air Bike remains reps-based because structured Waist/Abs metadata outranks its name |
| Bundled prescription preservation | Pass in simulator assertions | Zone 2 Bike retains its authored duration, distance, zone, and tracking mode through catalog mapping |
| Suggested metric correction | Pass in code and simulator build | expanded plan configuration exposes type-scoped `Track by` choices |

## Device Release Checklist

- Create a one-exercise strength plan.
- Create and reload a mixed day with Bench Press, Zone 2 Bike, Copenhagen Plank, Tibialis Raises, and Couch Stretch.
- Confirm exact, partial, and no-match ordering while typing rapidly.
- Create, edit, archive, and reuse a custom exercise.
- Close the library with and without selections; verify discard behavior.
- Repeat provider search offline and under slow network conditions.
- Exercise every type filter and selected state with VoiceOver.
- Reconfirm accessibility sizes above standard XXXL on the smallest supported physical iPhone.
- Verify Reduce Motion while opening library, selecting rows, saving custom work, and returning to composer.
- Complete a mixed workout and verify duration/distance/reps values survive relaunch.

Any failure in plan save/reload, no-match recovery, library return state, or mixed logging is release-blocking.
