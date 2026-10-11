---
name: verify
description: Drive Trim (the Expo iPhone workout app in mobile/) in its own iOS Simulator and Metro to prove a change works the way a user meets it, with screenshots and the persisted app state as evidence. Use after any change in mobile/ (UI, device modes, sheets, onboarding, logging, persistence), for "verify this", "check it in the simulator", "does it work", or before calling a feedback item done.
---

# Verify Trim in the Simulator

Trim is one iPhone app (`mobile/`, Expo dev build). The surface is the device screen plus dark sheets; there is no web surface worth verifying (the web export only catches crashes; see AGENTS.md *Cloud sessions*). Everything here runs on macOS with Xcode. Cloud/Linux sessions can't use this skill.

Everything goes through one helper, run from the repo root:

```sh
.claude/skills/verify/trim-verify.sh <command>
```

| Command | What it does |
|---|---|
| `up` | Creates/boots the simulator **Trim Verify** (iPhone 17 Pro), installs the newest `Trim.app` dev build from DerivedData if missing, starts Metro for this checkout on **:8095**, opens the app on it, waits for the bundle. |
| `doctor` | Read-only readiness check (below). |
| `open '<query>'` | Deep link into the device: `scratchworkout:///<query>`. |
| `shot <name>` | Screenshot into the evidence dir, prints the path. |
| `state <name>` | Saves the persisted app state (`scratchWorkout.appState.v1`) as JSON evidence and prints a summary (plans, active plan, workouts, active session, skin, Pro, tour). |
| `reload` | Relaunches the app against Metro (picks up JS changes; Fast Refresh usually does this already). |
| `fresh` | Uninstall + reinstall: wipes app data, lands on onboarding. |
| `logs [n]` | Tail of this Metro's log: bundling, red-box errors, `console.log`, and `[analytics] <event>` lines. |
| `down` | Stops our Metro and shuts down our simulator. Evidence stays. |

## Isolation

Other Claude sessions run their own Metro (8081, 8082, …) from other worktrees and their own booted simulators ("Trim Fresh …", "Trim Launch 3D", …). Never drive those, and never reuse their Metro: it serves another checkout's code. This skill only touches the **Trim Verify** simulator and the Metro whose pid it stored. Override with `TRIM_VERIFY_SIM` / `TRIM_VERIFY_PORT` if you need a second verify instance (for example from a worktree; the helper serves the checkout it lives in).

## Launch

```sh
.claude/skills/verify/trim-verify.sh up      # ~60 s on first run, prints "ready: ..."
```

Then open the live panel so Marvin can watch: iOS Simulator tool `attach` with `device: "Trim Verify"`. Ready means `up` printed `app loaded` and a screenshot shows Trim (onboarding welcome on a fresh install, Home otherwise), not the dev-client launcher.

`up` presets the dev menu's user defaults (no intro, no menu at launch, no floating gear), so screenshots show only the app. To reload, use `reload`, not the gear.

**Native changes** (new native module, `app.json` plugins, icon, splash, `mobile/modules/`): `up` installs whatever dev build is newest. Rebuild first (`cd mobile && npx expo run:ios`, see AGENTS.md *Build / run*), then `fresh` or reinstall via `down` + deleting the app.

## Doctor

```sh
.claude/skills/verify/trim-verify.sh doctor
```

Checks: the Trim Verify simulator exists and is booted, Trim is installed, our Metro is alive and **port 8095 is served from this checkout's `mobile/`**, and the newest dev build is newer than the last commit touching native inputs (`mobile/package.json`, `app.json`, `modules/`, `plugins/`). Prints the branch and HEAD. Run it first whenever anything looks off: a stale UI, a red box, a launcher screen instead of the app.

## Drive

Driving uses the **iOS Simulator tool** (`mcp__Claude_Code_iOS_Simulator__control`) with `device: "Trim Verify"`: `screenshot`, `tap`, `swipe`, `text`, `tap` with `duration` for holds. It has no accessibility tree, so:

1. **Reach a screen by deep link when one exists**, not by tapping through. `open` takes the device's own command params (`commandFromParams` in `mobile/src/device/device-state.ts`):
   - `?sheet=<kind>`: any sheet. Kinds (`SHEET_KINDS`): `menu`, `finishes` (Skin Library), `settings`, `plans`, `editor`, `add`, `progress`, `lift`, `body`, `history`, `receipt`, `today`, `exercise`, `keypad`, `goal`, `checkin`, `import`, `new-plan`. Extra params pass through as sheet params (ids, `new`).
   - `?log=1&planId=<id>&dayId=<id>[&exerciseId=<id>][&start=1]`: log mode on a day. Get ids from `state` JSON (`plans[].id`, `plans[].days[].id`).
   - `?tour=1`: replay the guided tour (dev builds only).
   - Routes: `paywall` (`paywall?reason=…`), `onboarding`, `dev-gallery`, `dev-insert`.
   - The **first** `scratchworkout://` link after an install shows iOS's "Open in Trim?" alert. Tap **Open** at (275, 474) once; later links open directly.
2. **Then tap by coordinates from a fresh screenshot.** Screenshots are 1206×2622 px; the tap space is 402×874 points (divide pixels by 3). Coordinates that held on iPhone 17 Pro:

| Control | Point |
|---|---|
| Menu key (top left, sliders icon) | (49, 99) |
| Rocker (top centre; ‹ › between lifts in log mode) | (201, 99); ‹ (124, 101), › (277, 101) |
| Right key: History on Home, Undo last set in log mode, Skip during the tour | (353, 99) |
| Display (tap to advance tour lines) | (201, 400) |
| Big key: Start / Log / Skip rest / hold to Finish | (201, 705) |
| `+` / `−` keys (reps, or ±15 s during rest) | (55, 660) / (55, 748) |
| Wheel (weight): swipe up = heavier, 2.5 kg steps | swipe (347, 760) → (347, 640) adds ~15 kg |
| Sheet close ✕ | (364, 145) |
| Onboarding primary button (Continue / Load … ) | (201, 810) |

3. **Wait out motion before tapping.** Onboarding slides, the cartridge insert, the tour's typed lines and sheet springs all take ~0.5–3 s; a tap mid-transition is swallowed or hits the old screen. Take a screenshot, confirm the screen settled, then tap.
4. **Holds**: hold to Finish is `tap` with `duration: 1.5` on the big key (the ring fills over 1.1 s).
5. **Text**: `text` types into the focused field. The tool can't send backspace, so it can't clear a field; say so instead of guessing.

## Evidence

Evidence goes to `.claude/verify-runs/<YYYY-MM-DD>/` (gitignored), named `HHMMSS-<name>.png` / `HHMMSS-state-<name>.json`. Override with `TRIM_VERIFY_EVIDENCE`.

Proof standards:
- **Real user path.** Tap the keys and rows a user would. Deep links are fine for *reaching* a surface (they're a shipped entry point); the behaviour under test must still be driven by real input. Never edit AsyncStorage or call store setters to fake a state.
- **Action and result.** `shot` before the action and after it, not only the final screen.
- **Side effects.** Anything that saves (onboarding, logging a set, finishing, editing a plan, goals, check-ins, skins, settings) gets a `state` before and after; quote the changed fields. Analytics events show in `logs` as `[analytics] <name> {…}` (dev builds log them, never send them).
- **No mocks** beyond what the dev build already isolates: purchases hit RevenueCat sandbox (don't complete a purchase), analytics only log, plan import's server call is real (`trim-api` on Vercel).
- Name what couldn't be checked: haptics, sounds, the Live Activity, real-device performance, and anything the Simulator renders differently.
- Look-and-feel judgements in light of `trim-ui` are separate from functional proof; say which you're giving.

## Cleanup

```sh
.claude/skills/verify/trim-verify.sh down
```

Stops only the Metro whose pid we stored (plus its child on :8095 if it serves this checkout), shuts down only Trim Verify. It never kills by process name. Evidence in `.claude/verify-runs/` stays. Test data lives only in Trim Verify's app container; `fresh` wipes it, so there's nothing to delete in History afterwards (unlike Marvin's other simulators, see AGENTS.md). Leave the simulator itself in place for the next run; `xcrun simctl delete "Trim Verify"` removes it if asked.

## Feature map

`features/README.md` indexes one file per user-facing feature: what it is, how to reach it, how to drive it, what proves it. A proof that touches one entry point is incomplete when the map lists others. Update the map in the same change when a feature's path, controls or end state change.
