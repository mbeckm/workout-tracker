# Trim verification map

The maintained source for verifying Trim's user-facing behaviour in the iOS Simulator. Read this index, then use the matching feature file as the recipe. All commands run from the repo root through `.claude/skills/verify/trim-verify.sh` (`tv` below) and the iOS Simulator tool with `device: "Trim Verify"`.

## Baseline preconditions

- `tv up` has printed `ready` and `tv doctor` prints `doctor: OK` (our Metro on :8095 serves this checkout).
- For a clean baseline: `tv fresh`, then the onboarding recipe ([onboarding.md](./onboarding.md)) with the **Full Body** starter plan and the tour skipped. That leaves Home on Graphite with plan *Full Body* (days A, B, C), no workouts.
- Never drive another session's simulator or Metro.

## Driving conventions

- Reach surfaces with `tv open '?sheet=<kind>'` or `tv open '?log=1&planId=…&dayId=…'` when the recipe allows; drive the behaviour itself with taps, swipes, holds and typing.
- Tap points are in the 402×874 point space (iPhone 17 Pro); take a screenshot first and re-derive from it if the layout moved. The control table is in `SKILL.md` → *Drive*.
- Wait for motion to settle (screenshot) before each tap.
- IDs for links come from `tv state` JSON (`activePlanId`, `plans[].days[].id`).

## Proof and skip reporting

- `tv shot` before and after each action under test; `tv state` before and after anything that saves. Quote the changed fields.
- `tv logs` for red boxes and `[analytics]` events.
- Record which entry point each artifact covers. A path you couldn't reach is reported as unreached with the command tried, never as verified through another path.
- Haptics, sounds and the Live Activity can't be observed here; list them as unchecked.

## Feature entry contract

Each feature file: an H1 and one paragraph on the behaviour, then exactly four H2s: `Sub-features`, `How to get to it (user POV)`, `Driving it with the Simulator tool`, `Gotchas`. Steps marked *(not yet driven)* came from the code and need a first run to confirm their coordinates.

## Features

- [Onboarding](./onboarding.md): welcome → name → units → plan source → days → starter plan → skin → load, then the guided tour and its Graphite reward. **Driven 2026-10-11.**
- [Logging a workout](./logging.md): Start, the wheel and keys, Log, rest, rocker between lifts, Undo, hold to finish. **Start → wheel → Log → rest driven 2026-10-11.**
- [Menu and sheets](./sheets.md): the menu key and every sheet (Plans, Progress, History, Settings, Skin Library) by key and by `?sheet=`. **History and Settings by link driven 2026-10-11.**
- [Plan import](./plan-import.md): pasted text or screenshots into a plan, from onboarding or New plan. *(not yet driven)*
- [Skins and Trim Pro](./skins-and-pro.md): Skin Library, Use / Try Trim Pro, the paywall, restore. *(not yet driven)*
