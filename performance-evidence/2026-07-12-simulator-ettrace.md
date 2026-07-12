# Simulator ETTrace Evidence - 2026-07-12

## Setup

- Baseline commit: `8c3cb72` (`Polish motion and accessibility`)
- Current code: performance branch working tree after persistence, search, sync, and instrumentation changes
- Build: Release, arm64 simulator, dSYMs UUID-matched for the app and ETTrace
- Simulator: iPhone Air, iOS 26.5 (`25D2125`), UDID `594779A4-1E84-4313-9111-66B80985356E`
- Profiler: ETTrace 1.1.0, main thread, one focused capture per result
- Dataset: existing local profile with multiple plans, custom exercises, and cached catalog data

Raw processed flamegraph JSON and analyzer output are retained locally under `.performance/ettrace-baseline` and `.performance/ettrace-run`. ETTrace was linked only into disposable profiling builds via command-line build settings and is not part of the Xcode project or shipping app.

## Results

| Flow | Baseline active CPU | Current active CPU | Interpretation |
| --- | ---: | ---: | --- |
| Four tab switches | 484.0 ms | 440.1 ms | 9.1% lower in the current single run; directional only because capture windows differ and ETTrace overhead is material |
| Current cold launch | n/a | 780.3 ms | Dominated by dyld, Swift conformance lookup, accessibility initialization, and SwiftUI graph/layout |
| Current Create Plan search (`bench`) | n/a | 316.4 ms | Includes keyboard, text services, result layout, and provider completion; no first-party self frame exceeded one ~5.1 ms sample |
| Active plan / next workout / plan-detail routes | n/a | 348.0 ms | Seven push/pop/tab actions; no first-party self frame exceeded one ~5.8 ms sample |
| Workout logging and completion | n/a | 914.5 ms | Three set logs, completion rendering, persistence scheduling, and finish; rendering/display-list work dominated |
| Current idle Overview | n/a | 0 ms active over 6.21 s | No unexpected steady-state CPU work |

The pre-fix cold-launch capture reported 456.8 ms active CPU, but ETTrace itself accounted for the largest self bucket and the current launch capture sampled different dyld/accessibility work. A one-run launch delta would be misleading, so no before/after percentage is claimed.

## Attribution

Current launch first-party frames were each sampled at approximately 5.2 ms or less, including:

- `WorkoutStore.init(defaults:)` and snapshot decode
- `RootView.tabContent(for:)`
- `WorkoutStore.workoutDaysThisMonth`
- `MonthlyWorkoutCalendar.dayRows`
- `ExerciseCatalogServiceFactory.live()`

The dominant launch work was system runtime and SwiftUI layout. This evidence does not justify splitting `RootView` or replacing the calendar implementation.

The search capture sampled `CreatePlanView.exerciseSearchView` once at approximately 5.1 ms. The prior code audit found a separate scale risk: `displayedSearchExercises` filtered every custom exercise during each body evaluation. The current implementation filters in a cancellable detached task and caps the merged local/remote list at 20 rows.

## Visual Proof

Simulator screenshots verified:

- Overview renders after a Release launch.
- Home -> Plans -> Workout -> Stats -> Home remains interactive.
- Create Plan opens from Plans and reaches exercise search.
- Typing `bench` produces bounded results.
- Selecting the first result expands that card in place instead of moving it to the top.
- The Plans header add action has visible contrast after the final icon correction.
- A temporary 5,000-custom-exercise profile rendered only the capped first page and found `Stress Exercise 4999` after rapid typing; the original simulator preferences were restored byte-for-byte afterward.
- A newly saved plan survived an immediate background transition, termination, and relaunch, exercising the ordered writer and background flush.
- The full one-exercise workout flow logged three sets, reached completion, and returned to Overview.
- An unreachable catalog endpoint still returned usable built-in `squat` results without blocking typing.

All temporary plans, workout history, stress exercises, profiler preferences, and instrumented app builds were removed from the active simulator profile after QA. The final installed build has no ETTrace linkage.

## Caveats and Release Gate

- Simulator timing is not physical-device timing.
- ETTrace contributes measurable launch and runtime overhead.
- The results above are one run per flow, not median/p95 statistics.
- Network-backed search varies with cache and service latency.

Before release, execute the physical-device checklist in `PERFORMANCE.md`: five cold launches, three runs per interaction flow, Core Animation hitch review, a 5,000-item stress catalog, slow/offline dependency injection, and reduced-motion/accessibility checks.
