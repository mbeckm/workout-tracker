# Performance and Instant Interaction Standard

This document is the performance contract for ScratchWorkout. A feature is not complete when it merely looks fast on one simulator run; it must meet the budgets below on a supported device, preserve immediate feedback under slow dependencies, and leave comparable evidence.

## Budgets

| Signal | Pass budget | Measurement |
| --- | ---: | --- |
| Tap to first visual response | <100 ms; same frame preferred | Points of Interest signpost to first changed frame |
| Animation frame rate | >=60 fps; 120 fps where supported | Core Animation instrument, hitch count, visual pass |
| Main-thread hitch | No user-visible hitch; no interval >=100 ms | Time Profiler / Hangs instrument |
| Search keystroke response | Local field update in same frame | `SearchQueryChanged`; network and filtering excluded from input handling |
| Search result render | <100 ms after provider response for <=20 rows | provider completion to `SearchResultsUpdated` and next frame |
| Local mutation | UI state changes before persistence or sync | action signpost precedes `PersistenceWrite` / `CloudSync` |
| Cold launch | First useful frame <=1.0 s on reference device | `AppLaunch` to `FirstRender`, 5-run median and p95 |

The reference physical device is an iPhone 13 or the oldest iPhone supported by the release, on the current production iOS version, in a Release build. Simulator measurements are directional only. Repeat launch measurements five times after one untimed warm-up. Runtime flows require three comparable runs.

## Instrumentation

The `Performance` Points of Interest category contains these stable markers:

- Lifecycle: `AppLaunch`, `FirstRender`, `AccountRestore`
- Navigation: `TabSwitch`, `RoutePush`, `RoutePop`
- Plan creation: `CreatePlanSearchOpen`, `SearchQueryChanged`, `SearchResultsUpdated`, `ExerciseConfigure`, `SaveDay`, `SavePlan`
- Workout: `WorkoutStart`, `LogSet`, `ExerciseComplete`, `WorkoutFinish`
- Deferred work: `PersistenceWrite`, `CloudSync`

Capture with Instruments using **App Launch**, **Time Profiler**, **Core Animation**, and **Points of Interest**. Use a Release build with debug information. Start and stop each trace around one named flow. Record app commit, device, OS, build configuration, dataset, network condition, and run count with every artifact.

`PersistenceWrite`, `AccountRestore`, and `CloudSync` are intervals. The remaining names are events. A local action passes only if its visual event is not gated by either deferred interval.

## Scorecard

| Surface | Baseline evidence | Current status | Required evidence |
| --- | --- | --- | --- |
| Overview / cold launch | Symbolicated simulator ETTrace captured; first-party startup samples <=5.2 ms | Pass, directional | Physical-device 5-run median/p95 remains a release gate |
| Tab switching | 4-switch ETTrace: 484 ms baseline, 440 ms current active CPU | Pass, directional | 3 physical-device Core Animation runs |
| Create Plan full flow | Search trace found no first-party active leaf above one 5.1 ms sample; a 5,000-item synthetic profile found an end-of-list match while rendering <=20 rows | Pass in simulator | Physical-device stress-catalog run |
| Plan Detail editing | Route/edit surfaces included in a 348 ms active route trace with no first-party self frame above one sample | Pass in simulator | Physical-device add/configure/save trace |
| Workout logging | Full three-set completion trace: 914.5 ms active CPU, dominated by display-list rendering | Pass in simulator | Physical-device Core Animation trace |
| Persistence | Full JSON encoding and `UserDefaults` write were synchronous on mutation path | Fixed; save/background/terminate/relaunch passed | Physical-device `PersistenceWrite` trace |
| Catalog / network | Unreachable endpoint preserved typing and returned built-in results; stale tasks cancel local scans and provider assignment | Offline pass | Slow-network physical-device QA |
| Auth / cloud | Local UI does not await sync; preview repository serialization had ambiguous executor ownership | Fixed in code | Slow/error repository QA; `CloudSync` off critical path |

Automated `xctrace` recording on the iOS 26.5 simulator did not finalize a valid trace bundle, so the simulator evidence uses ETTrace 1.1.0. ETTrace adds its own startup work and each flow currently has one measured run. These results support hotspot attribution and reject speculative rewrites; they do not replace the physical-device release gate. See `performance-evidence/2026-07-12-simulator-ettrace.md`.

## Required Flows

1. Cold launch: terminate the app, launch, stop after Overview is useful.
2. Navigation: switch Home -> Plans -> Workout -> Stats -> Home, then push and pop Plan Detail.
3. Create Plan: enter frequency, open exercise search, type rapidly, configure an exercise, save every day, save and activate the plan.
4. Plan Detail: edit, add and configure an exercise, save.
5. Workout: start, edit a set, complete each exercise, finish.
6. Persistence: repeat save/update/activate/complete using a history-heavy dataset.
7. Dependencies: repeat search and account flows offline, at 400 ms latency, and with an injected error.

## Dataset

Use three local profiles:

- Empty: no custom plans, custom exercises, or logged workouts.
- Typical: 4 plans, 20 custom exercises, and 90 logged workouts.
- Stress: 50 plans, 5,000 catalog/custom exercises, and 2,000 logged workouts.

Search results must stay capped at 20 visible provider rows. Typing must remain responsive while old queries are cancelled. Remote images are never a prerequisite for selecting or configuring a result.

## Architecture Guardrails

- Mutate local UI state synchronously. Queue persistence and cloud synchronization afterward.
- Keep snapshot writes ordered. A later snapshot must never be overwritten by an earlier write.
- Flush queued local snapshots when the scene enters the background; preserve the previous snapshot and log any encoding failure.
- Never decode catalog payloads, filter a large catalog, encode workout history, or decode images in a tap/keystroke handler on the main actor.
- Search tasks must debounce, honor cancellation before and after provider work, and cap rendered results.
- Session restoration may enrich the UI after first render; it must not gate the tab shell or local data.
- Cloud failure can change sync status and expose recovery, but it cannot roll back a successful local action or freeze navigation.
- Add broad observation, eager list rendering, synchronous persistence, or unbounded image work only with trace evidence and an explicit budget review.

## QA Checklist

Record pass/fail and attach trace or video evidence for every release candidate:

- [ ] Reference device, iOS version, commit, Release configuration, and dataset documented.
- [ ] Cold launch meets the budget across five measured runs.
- [ ] Every tab acknowledges immediately and remains >=60 fps.
- [ ] Create Plan completes end to end with rapid typing and repeated exercise configuration.
- [ ] Plan Detail add/edit/save remains responsive.
- [ ] Workout start, set editing, exercise completion, and finish remain responsive.
- [ ] Stress catalog typing has no stale result replacement or keyboard hitch.
- [ ] Offline and slow catalog responses never block typing or configuration of cached/local results.
- [ ] Persistence intervals do not occupy the main-thread critical path.
- [ ] Signed-out startup renders local content without waiting for auth.
- [ ] Slow and failed sync leave local actions usable and show recoverable status.
- [ ] Reduce Motion removes spatial motion without removing state feedback.
- [ ] VoiceOver labels, Dynamic Type, hit targets, and focus remain correct.
- [ ] Before/after scorecard links comparable artifacts for every changed hotspot.

## Deferred Decisions

Replacing `UserDefaults` with a file or database store is deferred until a stress-profile trace shows the ordered background writer misses durability or throughput budgets. Splitting `RootView` state into narrower observable models is also deferred until SwiftUI update profiling attributes a measurable hitch to broad invalidation. Both are architectural costs and should not be justified by code shape alone.
