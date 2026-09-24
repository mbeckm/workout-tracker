# AGENTS.md

## What this repo is

**Scratch** is a plan-first iPhone workout logger.

- **Active app:** `mobile/` — Expo + Expo Router, iPhone-only, light iOS-native UI.
- **Logic oracle:** `ScratchWorkout/` — SwiftUI prototype. Port domain types and store behavior from here. Do not copy its visual system (Inter, lime, charcoal, custom motion).
- Root `*.md` files: **`PRODUCT.md` is the 1.0 product model** (plans → days → exercises, no ad-hoc workouts). `DESIGN.md` and other root docs are historical. **UI source of truth is `.cursor/skills/scratch-ui/SKILL.md` + Paper Family loop.** `references/1.0/` is historical.

EAS project ID: `88024391-8ffd-4a6d-923d-18c766972365`.

## 1.0 product

Tabs: Workout, Plans, History, Settings.

Ship: plan-first home (active plan + days), plan creation (pick exercises, then sets and reps per set — no per-set rows, no weights), Alpha Progression logging (exercise strip, active set, previous session, auto-advance), bundled + custom exercises, 2–3 screen onboarding, paywall after first completed workout, restore purchases, local persistence.

Do not ship: ad-hoc / empty workouts, custom transitions, achievements, heatmap, ExerciseDB data or media in production, cloud auth.

## How to implement UI

1. Read `.cursor/skills/scratch-ui/SKILL.md`, then `.cursor/skills/implement-screen/SKILL.md`.
2. Match Paper Family loop. Logging oracle is artboards 09, 11, 16, 17, 18.
3. System font and iOS semantic colors. Green is for completed work and the one gym CTA — not titles.

## Build / run / test (macOS + Xcode)

```sh
cd mobile
npx expo start
```

iOS Simulator required. Official Expo Skills live in `.agents/skills/` (`npx skills add expo/skills`). For Expo MCP screenshots:

```sh
cd mobile
npx expo install expo-mcp --dev
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

Then reconnect Expo MCP in Cursor.

Command-line iOS build (after `npx expo prebuild` or EAS):

```sh
cd mobile
npx eas-cli build --platform ios --profile development
```

There is no test target yet. Persistence is local (MMKV/SQLite). No backend.

## Cloud Agent (Linux) limits

The Cloud Agent VM cannot run the iOS Simulator or Expo MCP local screenshot tools. It can still edit `mobile/` TypeScript. Visual QA happens on macOS.

Swift sources depend on Apple frameworks; do not attempt a Linux Swift build.

## Exercise catalog

Production is **local-only**: Trim's own first-party catalog (`mobile/src/catalog/bundled.ts`, ~200 exercises, no third-party data) + user-created custom exercises. Search, browse and Alternatives never touch the network, and no exercise media (GIFs, thumbnails) ships. Rows lead with the name; the picker meta line (`Equipment · Section`) tells variants apart.

- **One switch:** `mobile/src/catalog/config.ts` (`CATALOG.media`, `CATALOG.remote`). Both default off; `eas.json` pins them off for `production`. See `mobile/.env.example`.
- **ExerciseDB is dev-only behind flags.** `EXPO_PUBLIC_EXERCISE_REMOTE_SEARCH=oss` enables the non-commercial OSS host in `__DEV__` builds only (the literal is stripped from release bundles). `rapidapi` needs a key plus a base URL (a proxy for store builds). Never hardcode an ExerciseDB host or media URL, and never ship OSS ExerciseDB data or media in a paid build.
- **Stable identity:** bundled ids are `bundled-<slug of name>`; shipped names and ids never change (name is the "last time" key, `catalogKey` uses `providerExerciseId` first on the original rows). Starter templates reference rows via `bundledExerciseById(id)`.
- **Media** resolves from catalog identity only (`catalog/media.ts`), never from URLs saved on plans or history. `ExerciseThumb` renders nothing while media is off.
- New exercises: add rows to `bundled.ts` (big lifts first: file order is search priority and Alternatives order); search aliases are catalog-only and never persisted. Distance-based moves stay out until the log screen can record distance.
