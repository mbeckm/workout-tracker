# Logging a workout

From Home, Start begins the selected day and the device logs one set at a time: the wheel sets the weight, the + / − keys set reps, Log saves the set and starts rest on the display, the rocker moves between lifts, Undo removes the last set, and holding the big key finishes the workout into the finish screen and History.

## Sub-features

- `log-start` Start on Home opens the first lift: name ▾, set lamps, `SET n/m`, weight box, `±2.5` step, reps.
- `log-weight` the wheel sets the weight (swipe up = heavier).
- `log-reps` + / − keys set reps.
- `log-set` Log saves the set; rest shows "SET 2 IN m:ss", NEXT w×r, ±15 keys and Skip.
- `log-rocker` ‹ › on the rocker switch lifts; lamps show progress.
- `log-undo` the right key undoes the last set.
- `log-today` the lift name ▾ opens the Today sheet (jump, reorder, swap, add lifts).
- `log-finish` hold the big key to finish; the finish screen compares against last time; the workout lands in History.
- `log-end` menu → End workout / Discard workout during a session.

## How to get to it (user POV)

- Home → Start (201, 705) on the selected day.
- A Live Activity tap: `tv open 'log?planId=<id>&dayId=<id>'` (the `/log` alias) or `tv open '?log=1&planId=<id>&dayId=<id>'`.
- Menu key → End workout while a session runs.

## Driving it with the Simulator tool

Preconditions: baseline from onboarding (Home, Full Body, no workouts). `tv state before-log` shows `workouts=0 activeSession=no`.

- **Start.** Tap Start (201, 705). Display: BARBELL BACK SQUAT ▾, SET 1/4, empty weight, 6 REPS; big key reads Log; rocker shows ‹ ●●●●● ›.
- **Weight.** Swipe the wheel (347, 760) → (347, 640), 0.5 s. Weight reads 15.0 (previous 12.5 shown under it).
- **Log.** Tap Log (201, 705). Rest: "SET 2 IN 2:27", NEXT 15×6, keys +15 / −15, big key Skip. `tv state logged-set` → `activeSession=yes`; JSON `activeSession.drafts[0].sets[0]` has `weight: 15, reps: 6`.
- **Undo.** *(not yet driven)* Tap the right key (353, 99). The set disappears and SET 1/4 returns; `state` shows no sets in `drafts[0]`.
- **Next lift.** *(not yet driven)* Tap › (277, 101). FLAT BARBELL BENCH PRESS, SET 1/4.
- **Finish.** *(not yet driven)* With sets logged, hold the big key: `tap` (201, 705) with `duration: 1.5`. The finish screen shows stats against last time. `state` → `workouts=1 activeSession=no`; History sheet shows the day's slip.

## Gotchas

- Rest counts down in real time; screenshots seconds apart show different numbers.
- Ending, finishing or discarding is the only way out of a session; `fresh` also clears it.
- The wheel is momentum-driven: assert the value on screen, not a computed step count.
- Finishing creates History data in Trim Verify only; no cleanup needed elsewhere.
