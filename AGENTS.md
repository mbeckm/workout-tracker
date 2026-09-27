# AGENTS.md

## What this repo is

**Trim** ("Trim Workout" on the App Store) is a plan-first iPhone workout logger. The project started as "Scratch", which is why some identifiers still carry that name (see *Names that must not change*).

- **App:** `mobile/`, Expo + Expo Router, iPhone only, light and dark iOS-native UI.
- **Legal pages:** `legal/`, deployed to https://scratch-legal.vercel.app (support, privacy policy).
- **Docs:** `PRODUCT.md` is the product model. `PRODUCT-DECISIONS.md` records decisions that changed it. `APP_STORE_RELEASE_GUIDE.md` covers store setup and shipping builds.
- **UI source of truth:** `.cursor/skills/trim-ui/SKILL.md` plus the Paper design file.

EAS project: `@mbeckms-team/workout-app` (ID `88024391-8ffd-4a6d-923d-18c766972365`). App Store Connect app ID: `6805436799`.

## 1.0 product

Tabs: Workout, Plans, Progress, History, Settings.

Ships: plan-first Home (next day, week progress, other days), plan creation (pick exercises, then sets and reps per set; no per-set rows, no weights), one-set-at-a-time logging (exercise strip, `Set n of m`, last time, rest timer, auto-advance), bundled and custom exercises, Progress (estimated 1RM per lift, body check-ins), five-screen onboarding that ends with a real plan (free starter templates in `mobile/src/catalog/templates.ts`, or Build my own), Trim Pro (paywall at the end of onboarding on the template path, once after the first completed workout, and at feature gates), restore purchases, local persistence.

Does not ship: ad-hoc / empty workouts, custom transitions, achievements, heatmap, ExerciseDB data or media in production, accounts or cloud sync.

## How to implement UI

1. Read `.cursor/skills/trim-ui/SKILL.md`, then `.cursor/skills/implement-screen/SKILL.md`.
2. Match the Paper artboard for the screen.
3. System font and iOS semantic colors. Green is for completed work and the one gym CTA, never titles.
4. When a change alters a product or design rule, update `PRODUCT-DECISIONS.md` and `trim-ui` in the same change.

## Build / run (macOS + Xcode)

```sh
cd mobile
npm install
npx expo run:ios          # builds the dev client into the Simulator
npx expo start --dev-client
```

- Native dependency changes (a new Expo module, `app.json` plugins, icon or splash) need a new dev build: `npx expo prebuild --platform ios` then `npx expo run:ios`. `mobile/ios/` is generated and gitignored.
- The repo path contains spaces; `mobile/plugins/with-quoted-bundle-script.js` keeps the iOS bundle phase working. Keep it in `app.json`.
- CocoaPods: this Mac uses a user-level install (`~/.gem/ruby/2.6.0/bin`). Put it on `PATH` before prebuild.
- Official Expo skills live in `.agents/skills/`.
- Checks: `npx tsc --noEmit` (0 errors) and `npx eas-cli metadata:lint`. There is no unit test target yet.

Store builds: see `APP_STORE_RELEASE_GUIDE.md` (`npx eas-cli build --platform ios --profile production --auto-submit`).

## Services

- **Purchases:** RevenueCat project "Scratch", entitlement `Scratch Pro`, current offering `default` (`$rc_annual`, `$rc_monthly`). Key: `EXPO_PUBLIC_REVENUECAT_API_KEY` (`appl_…`) in `mobile/.env` and EAS.
- **Analytics:** PostHog EU, anonymous (`mobile/src/analytics/analytics.ts`). Key: `EXPO_PUBLIC_POSTHOG_KEY`. Development builds only log events unless `EXPO_PUBLIC_ANALYTICS_IN_DEV=1`. Keep events free of workout contents; if what's collected changes, update `legal/privacy.html` and App Privacy.
- **Persistence:** local only (`mobile/src/store/persistence*.ts`). No backend.

## Names that must not change

These still say "Scratch" and are load-bearing. Renaming them loses user data or breaks purchases:

- Storage keys `scratchWorkout.*` (app state, catalog cache, Live Activity focus).
- Bundle IDs `com.marvinbeckmann.ScratchWorkout` (+ `.ExpoWidgetsTarget`) and app group `group.com.marvinbeckmann.ScratchWorkout`.
- URL scheme `scratchworkout` (Live Activity deep links).
- RevenueCat entitlement `Scratch Pro` and product IDs `com.marvinbeckmann.ScratchWorkout.pro.yearly` / `.monthly`.
- EAS slug `workout-app`.

The Scratch-era SwiftUI prototype and its docs were removed; they are preserved at git tag `archive/scratch-era`.

## Cloud Agent (Linux) limits

The Cloud Agent VM cannot run the iOS Simulator. It can still edit `mobile/` TypeScript and run `tsc`. Visual QA happens on macOS.

## Exercise catalog

Production is **local-only**: Trim's own first-party catalog (`mobile/src/catalog/bundled.ts`, ~200 exercises, no third-party data) plus user-created custom exercises. Search, browse and Alternatives never touch the network, and no exercise media ships. Rows lead with the name; the picker meta line (`Equipment · Section`) tells variants apart.

- **One switch:** `mobile/src/catalog/config.ts` (`CATALOG.media`, `CATALOG.remote`). Both default off; `eas.json` pins them off for `production`. See `mobile/.env.example`.
- **ExerciseDB is dev-only behind flags.** `EXPO_PUBLIC_EXERCISE_REMOTE_SEARCH=oss` enables the non-commercial OSS host in `__DEV__` builds only. `rapidapi` needs a key plus a base URL (a proxy for store builds). Never hardcode an ExerciseDB host or media URL, and never ship ExerciseDB data or media in a paid build.
- **Stable identity:** bundled ids are `bundled-<slug of name>`; shipped names and ids never change (the name is the "last time" key). Starter templates reference rows via `bundledExerciseById(id)`.
- **Media** resolves from catalog identity only (`catalog/media.ts`), never from URLs saved on plans or history.
- New exercises: add rows to `bundled.ts` (big lifts first: file order is search priority and Alternatives order). Search aliases are catalog-only and never persisted. Distance-based moves stay out until the log screen can record distance.
