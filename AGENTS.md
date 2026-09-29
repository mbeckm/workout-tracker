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

1. Read `PRODUCT.md` → Principles, then `.cursor/skills/trim-ui/SKILL.md` (the design system), then `.cursor/skills/implement-screen/SKILL.md`.
2. Use tokens only: `type`, `space`, `radius`, `colors`, `iconSize` (`mobile/src/constants/theme.ts`) and `DURATION` / `SPRING` (`mobile/src/motion.ts`). No raw font sizes, hex colors or off-scale spacing.
3. Match the Paper artboard for the screen; where it disagrees with `trim-ui`, `trim-ui` wins.
4. No helper text, no action on the user's behalf, and motion only when it makes Trim faster, more fluid or more loveable.
5. When a change alters a product or design rule, update `PRODUCT-DECISIONS.md` and `trim-ui` in the same change.

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
- Emil Kowalski's motion skills live in `.claude/skills/` (`find-animation-opportunities`, `animate-expo`, `review-animations`, `improve-animations`, `emil-design-eng`, `apple-design`, `animation-vocabulary`). Where they disagree with `trim-ui` §8, `trim-ui` wins.
- Checks: `npm run check` in `mobile/` (tsc + the design-token ratchet, also run by `.github/workflows/checks.yml` on every PR) and `npx eas-cli metadata:lint`. There is no unit test target yet. If you remove raw values, run `node scripts/check-design-tokens.mjs --update` to lower the baseline; never raise it.

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

## Cloud sessions (Linux)

Cloud sessions (claude.ai/code) can't run the iOS Simulator. Marvin tests on his iPhone instead, with JS changes delivered over the air by EAS Update.

- **Setup:** `npm ci` in `mobile/`. The environment needs `EXPO_TOKEN` and network access to `expo.dev` / `api.expo.dev` / `u.expo.dev`.
- **Self-check:** `npm run check`, then a web smoke test: `npx expo export --platform web --output-dir /tmp/trim-web && node scripts/web-smoke.mjs /tmp/trim-web / /settings`. It catches crashes and broken flows; iOS-native UI (SwiftUI, glass, SF Symbols, sheets) doesn't render faithfully on web, so it says nothing about look and feel.
- **Ship to Marvin's phone:** `npx eas-cli update --channel preview --platform ios --environment production --message "<what changed>"`. Marvin closes and reopens Trim (the update downloads on launch and applies on the next launch, so sometimes twice).
- **Native changes** (new native module, `app.json` plugins, icon, splash, Expo SDK) change the runtime fingerprint, and old builds ignore the update. Build a new preview binary: `npx eas-cli build --platform ios --profile testflight-preview --auto-submit`.
- **Agent QA on a real iOS Simulator** (optional, paid, limited access): EAS Simulator runs one on Expo's servers; see `.agents/skills/eas-simulator/SKILL.md`. Check `simulator:availability` first, and always stop the session.
- **Channels:** `testflight-preview` builds listen on `preview`; `production` builds (App Store) listen on `production`. Never publish to `production` unless Marvin asks for a hotfix.
- **Env vars:** `EXPO_PUBLIC_REVENUECAT_API_KEY` and `EXPO_PUBLIC_POSTHOG_KEY` live in the EAS `production` environment (also `development`; `preview` is empty). Both build profiles pin `"environment": "production"`, and every `eas update` passes `--environment production`, or the update ships without purchases and analytics.

## Exercise catalog

Production is **local-only**: Trim's own first-party catalog (`mobile/src/catalog/bundled.ts`, ~200 exercises, no third-party data) plus user-created custom exercises. Search, browse and Alternatives never touch the network, and no exercise media ships. Rows lead with the name; the picker meta line (`Barbell, chest`) tells variants apart.

- **One switch:** `mobile/src/catalog/config.ts` (`CATALOG.media`, `CATALOG.remote`). Both default off; `eas.json` pins them off for `production`. See `mobile/.env.example`.
- **ExerciseDB is dev-only behind flags.** `EXPO_PUBLIC_EXERCISE_REMOTE_SEARCH=oss` enables the non-commercial OSS host in `__DEV__` builds only. `rapidapi` needs a key plus a base URL (a proxy for store builds). Never hardcode an ExerciseDB host or media URL, and never ship ExerciseDB data or media in a paid build.
- **Stable identity:** bundled ids are `bundled-<slug of name>`; shipped names and ids never change (the name is the "last time" key). Starter templates reference rows via `bundledExerciseById(id)`.
- **Media** resolves from catalog identity only (`catalog/media.ts`), never from URLs saved on plans or history.
- New exercises: add rows to `bundled.ts` (big lifts first: file order is search priority and Alternatives order). Search aliases are catalog-only and never persisted. Distance-based moves stay out until the log screen can record distance.

## Working notes (learned the hard way)

Read this before your first command. Each item cost real time once.

### Git and parallel sessions
- Several Claude sessions work in this repo at once and merge into `main` often. Before merging a PR, `git fetch` and merge `origin/main` into your branch; expect conflicts in `AGENTS.md` and `.claude/`.
- Stage explicit paths. `.cursor/mcp.json` usually has local, uncommitted MCP entries with machine paths, so never `git add -A .cursor` or `git add .` blindly. `.claude/settings.local.json` is gitignored; keep it that way.
- To compare against `main`, use a throwaway worktree (`git worktree add <tmp> main`), never `git stash`, which silently takes your whole change set with it.
- Deleting old material is fine when asked; tag first (`archive/…`) so it's one command to restore. `archive/scratch-era` holds the Swift prototype.

### Shell (zsh)
- `grep -r --include=*.ts` fails with "no matches found" because zsh expands the glob. Quote it (`--include='*.ts'`) or drop `--include`.
- If `git` or `python3` fail with an Xcode license message, the license was reset by an Xcode update: `sudo xcodebuild -license accept` (Marvin runs it). `DEVELOPER_DIR=/Library/Developer/CommandLineTools` works as a stopgap for `git`.

### Expo and React Native
- "Unimplemented component <RNSVG…>" or a crash on import means the installed dev build predates a native dependency. Rebuild (`npx expo prebuild --platform ios && npx expo run:ios`), don't debug the JS.
- `expo run:ios` reuses `mobile/ios/`; it doesn't pick up `app.json` changes (icon, splash, plugins, name) until `npx expo prebuild` runs.
- NumberFlow (`StaggerValue`, `ProgressDelta`) animates on the UI thread: its easing must be a Reanimated worklet (`EASE_OUT_FN` = `Easing.bezierFn`). A plain RN `Easing.bezier` throws "easing function is not a worklet" the first time a number changes.
- RNScreens `formSheet` with a ScrollView accepts exactly one header (`collapsable={false}`) plus the ScrollView as children. Anything else lays out wrong (see `src/screens/check-in.tsx`).
- Don't set `lineHeight` on a `TextInput`: iOS applies it to typed text but not the placeholder, so the first keystroke jumps. Use a fixed `height`.
- Typed routes (`.expo/types/router.d.ts`) regenerate only while Metro runs; stale types show up as tsc errors on new routes.
- Reload a dev build from the floating gear → Reload. Metro has no reload HTTP endpoint.
- `npx expo lint` has 8 known errors on `main` (React Compiler "refs during render"). Don't count them as yours; don't add new ones.

### iOS Simulator
- If the Simulator panel's screenshots fail after an Xcode update, use `xcrun simctl io booted screenshot <file>` and read the PNG.
- The Simulator tool can't send backspace, so it can't empty a text field; say what couldn't be checked.
- iOS caches the launch screen per install. A new splash only shows after a fresh install (TestFlight, or deleting the app, which deletes its data). Verify the compiled images in `ios/Trim/Images.xcassets/SplashScreenLogo.imageset` instead.
- Home-screen icon dark mode follows the Simulator's icon appearance setting, not the system appearance.
- Test data you log to check a flow (e.g. the week celebration) must be deleted again in History.
- `EXPO_PUBLIC_ANALYTICS_IN_DEV=1 npx expo start` sends dev events to PostHog for a check; restart Metro without it afterwards.

### Dashboards (Marvin's Chrome is logged in; UI language is German)
- **App Store Connect** (app 6805436799): the UI is German (Weiter = Next, Sichern = Save, Veröffentlichen = Publish, Abo = subscription). App Privacy edits publish immediately from the dialog. The age-rating dialog's Sichern also needs the page-level Sichern. New subscription prices take up to an hour to reach sandbox and TestFlight.
- **RevenueCat:** project "Scratch" (`5a59d39e`), app `app80da402380`.
- **PostHog:** EU cloud, project `285218`. Product analytics only; session replay and web analytics off; client IP discarded.
- **Vercel:** `legal/` deploys to team `mbeckms-projects`, project `scratch-legal`. The Vercel MCP connector has no access to that team; use the CLI (`cd legal && vercel deploy --prod --yes`, needs `vercel login`).
- **Paper:** app design in "Scratch workout new"; icon artwork in "Trim Logo". Paper can generate images (`paper-gen://`), so no separate image connector is needed for moodboards.

### Steps only Marvin can do
- Apple ID sign-in and two-factor codes, `sudo` commands, creating accounts (sandbox testers), and `vercel login`.
- Claude can read the terminal panel but can't type into it. When a command will prompt interactively (e.g. `eas build` credentials), give Marvin the exact answers up front. For EAS: log in with Apple, reuse the distribution certificate, generate a provisioning profile for **both** targets (Trim, ExpoWidgetsTarget), no push key, yes to the App Store Connect API key.

## Feedback sprints (Claude Code agents)

Paste a list of dogfooding feedback into a new Claude Code session running **Opus 5.5 at medium effort** and run `/feedback-sprint`. The main session acts as orchestrator/PM (`.claude/skills/feedback-sprint/SKILL.md`): it triages every item, routes it to a worker, reviews the diff, sends it back with feedback, runs simulator QA, commits per item and opens a PR.

Workers live in `.claude/agents/`. Model and effort are set per agent, so the orchestrator picks them by picking the agent: `quick-fixer` (Opus, low), `builder` (Opus, medium, default), `designer` (Opus, high, taste-heavy items), `product-thinker` (Opus, high, read-only product calls), `qa-tester` (Opus, low, simulator, one per sprint). The orchestrator does one-line fixes itself, gives one worker all items in an area, and reuses agents with SendMessage; see the skill's *Token budget*. New design patterns start with Mobbin + Appllama research; polish cites the trim-ui rule it matches. Simulator QA only checks that each change is there and works; the sprint report ends with a look-and-feel list for Marvin to check on device. The run's ledger is written to `.claude/feedback-runs/` (gitignored).
