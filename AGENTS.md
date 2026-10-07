# AGENTS.md

## What this repo is

**Trim** ("Trim Workout" on the App Store) is a plan-first iPhone workout logger. The project started as "Scratch", which is why some identifiers still carry that name (see *Names that must not change*).

- **App:** `mobile/`, Expo + Expo Router, iPhone only. Trim is one persistent device: its look is the user's finish, and sheets and moments are always dark (decision 73). There is no light or dark appearance.
- **Legal pages:** `legal/`, deployed to https://scratch-legal.vercel.app (support, privacy policy).
- **Docs:** `PRODUCT.md` is the product model. `PRODUCT-DECISIONS.md` records decisions that changed it. `APP_STORE_RELEASE_GUIDE.md` covers store setup and shipping builds.
- **UI source of truth:** `.cursor/skills/trim-ui/SKILL.md`, then the shipped code. New design work happens in Claude Design; Paper is a frozen, optional reference (see *Where design lives*).

EAS project: `@mbeckms-team/workout-app` (ID `88024391-8ffd-4a6d-923d-18c766972365`). App Store Connect app ID: `6805436799`.

## 1.0 product

Device and menu: one persistent device screen (Home, logging, rest, finish, setting a plan's numbers), and the menu key opens a menu sheet with Plans, Progress, History, Settings and the finishes, plus End workout during a session. No tab bar (see *The device*).

Ships: Home on the device (the plan's days as stamped rows, the week as lamps in the rocker, Start), one-set-at-a-time logging on the device (the wheel sets the weight, the keys set reps, `SET n/m`, last time or target, Undo last set, the rocker between lifts, Today for jumping, reordering, swapping and adding lifts), rest on the display, hold to finish, the printed receipt, the History wall of receipts, the plans rack with the list editor, sets × reps set on the device and the cartridge insert on Use plan, six finishes, each a whole machine with its own screen (Aluminium and Graphite free, four Pro), Progress (goals, estimated 1RM per lift, lift and body detail, body check-ins), the finished-week report, bundled and custom exercises, onboarding that ends with a real plan (free starter templates in `mobile/src/catalog/templates.ts`, or Build my own), Trim Pro (paywall at the end of onboarding on the template path, once after the first completed workout, and at feature gates), restore purchases, Core Haptics and sounds, local persistence.

Does not ship: ad-hoc / empty workouts, custom transitions, achievements, heatmap, ExerciseDB data or media in production, accounts or cloud sync.

## The device (gadget redesign, decision 73)

Trim is one persistent metal device with a dot-matrix display, keys, a rocker and one wheel, plus dark sheets for everything list- or number-heavy, and a few physical moments. It's built; the code and `trim-ui` are the reference now:
- `mobile/src/app/index.tsx` is the device (`src/device/device-screen.tsx`); the only other routes are onboarding, `paywall`, the `/log` deep-link alias and the `__DEV__` gallery and insert pages.
- `src/device/`: the device state (`device-state.ts`, pure), the parts (`parts/`), the modes (`home/`, `log/`, `edit/`, `insert/`), the moments (`moment/`, `moments.ts`), every sheet (`sheets/`, opened with `useDevice().open(...)`, never a route) and the pure models (`*-model.ts`, checked by `npm run check`).
- `mobile/modules/trim-device/`: the local Swift module (Core Haptics, sounds, the SceneKit cartridge insert).
- Tokens: `src/constants/theme.ts` (finishes, `lcd`, `sheetColors`, `signal`, the type roles and geometry blocks) and `src/motion.ts` (`DEVICE`).

`design/gadget/` (PLAN, SPEC, the prototype, screens, frames and boards) is history: how the device was specified. When it disagrees with the code or `trim-ui`, they win. The pre-gadget app is at git tag `archive/pre-gadget`.

- **Obsolete for UI:** Paper and the old screenshots of the tabbed app describe the old interface.
- **Branches:** the gadget is the only app now. `main` is the trunk: one branch per task with a PR into `main`. Unmerged pre-gadget branches and worktrees are preserved in tag `archive/pre-cleanup-2026-10-04` (one commit whose parents are every archived tip; its message lists name → sha, restore with `git branch <name> <sha>`).
- **Shipping to Marvin's phone:** his phone runs a `testflight-gadget` build, which listens on the EAS channel `gadget`: `npx eas-cli update --channel gadget --platform ios --environment production --message "<what changed>"`, and `npx eas-cli build --platform ios --profile testflight-gadget --auto-submit` for native changes. `preview` serves only old pre-gadget binaries; never publish to it or to `production`.
- **Self-check:** `npm run check`, then the web smoke test: `node scripts/web-smoke.mjs /tmp/trim-web / "/?sheet=plans" "/?sheet=progress" "/?sheet=history" "/?sheet=settings" /paywall` (Settings and the rest are sheets, opened by `?sheet=`).

## Design first, in Claude Design

New features, new screens and any real change to how something looks or works start in **Claude Design**, not in `mobile/`. Sketching is cheaper in tokens, faster to iterate, and keeps the app untouched until we know what we're building.

1. **Sketch before code.** Work the idea out as designs first. Touch `mobile/` only once Marvin has picked a direction.
2. **Always show several variations** side by side (at least three), never a single proposal.
3. **Go broad.** Cover a wide conceptual range: the obvious solution, plus ones that solve the problem a different way (another flow, another place in the app, removing the need altogether). Spend time thinking before drawing; at least one variation should be a bold, out-of-the-box take.
4. Each variation gets a name and one line on the idea and its trade-off, plus a recommendation.

Skip this only for bugs, copy fixes and polish inside an existing `trim-ui` pattern.

### Where design lives

- **New work:** always Claude Design, in every session, local or cloud.
- **How an existing surface should look**, in this order: `trim-ui` (always available, always wins), then the current code in `mobile/`. Paper describes the old app.
- **Paper is frozen and optional.** It only works in a local session with the Paper desktop app open, and parts of it are out of date. Use it as a reference when it's there; if it disagrees with `trim-ui` or the code, they win. Nobody updates it anymore. Paper pages named in `PRODUCT-DECISIONS.md` stay valid as history.
- **Cloud sessions** don't try to reach Paper, don't block on it, and don't mention its absence.

## How to implement UI

1. Design it first (see above). Then read `PRODUCT.md` → Principles, then `.cursor/skills/trim-ui/SKILL.md` (the design system), then `.cursor/skills/implement-screen/SKILL.md`.
2. Use tokens only: the finish, `lcd`, `sheetColors` and `signal` palettes, the type roles (`gadgetType` and the per-surface roles), the geometry blocks, `space` and `fontScaleCap` (`mobile/src/constants/theme.ts`), and `DEVICE` / `DURATION` / `SPRING` (`mobile/src/motion.ts`). No raw font sizes, weights, hex colors, radii or off-scale spacing; the token ratchet's baseline is 0.
3. Match the agreed Claude Design variation, `trim-ui` and the existing device parts and sheet primitives (`mobile/src/device/`).
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
- CocoaPods: this Mac uses a user-level install (`~/.gem/ruby/2.6.0/bin`). Put it on `PATH` before prebuild, and export `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (without it `pod install` crashes with "Unicode Normalization not appropriate for ASCII-8BIT").
- Official Expo skills live in `.agents/skills/`.
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
- **Self-check:** `npm run check`, then a web smoke test: `npx expo export --platform web --output-dir /tmp/trim-web && node scripts/web-smoke.mjs /tmp/trim-web /` (add `"/?sheet=settings"` and the other sheets, see *The device*). It catches crashes and broken flows; native fonts, shadows, haptics and the SceneKit insert don't render faithfully on web, so it says nothing about look and feel.
- **Ship to Marvin's phone:** `npx eas-cli update --channel gadget --platform ios --environment production --message "<what changed>"` (see *The device*). Marvin closes and reopens Trim (the update downloads on launch and applies on the next launch, so sometimes twice).
- **Native changes** (new native module, `app.json` plugins, icon, splash, Expo SDK) change the runtime fingerprint, and old builds ignore the update. Build a new binary: `npx eas-cli build --platform ios --profile testflight-gadget --auto-submit`.
- **Agent QA on a real iOS Simulator** (optional, paid, limited access): EAS Simulator runs one on Expo's servers; see `.agents/skills/eas-simulator/SKILL.md`. Check `simulator:availability` first, and always stop the session.
- **Channels:** `testflight-gadget` builds listen on `gadget`; old `testflight-preview` builds listen on `preview`; `production` builds (App Store) listen on `production`. Never publish to `production` unless Marvin asks for a hotfix.
- **Env vars:** `EXPO_PUBLIC_REVENUECAT_API_KEY` and `EXPO_PUBLIC_POSTHOG_KEY` live in the EAS `production` environment (also `development`; `preview` is empty). The store build profiles (`production` and the `testflight-*` ones that extend it) pin `"environment": "production"`, and every `eas update` passes `--environment production`, or the update ships without purchases and analytics.

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
- The runtime fingerprint hashes `mobile/package.json` **scripts**, so editing a script (even `check`) makes every installed build ignore new EAS updates. Between native builds, add new checks as their own step in `.github/workflows/checks.yml` instead of chaining them into `npm run check`. A `fingerprint.config.js` that skips package.json scripts lands with the next native build.
- `expo run:ios` reuses `mobile/ios/`; it doesn't pick up `app.json` changes (icon, splash, plugins, name) until `npx expo prebuild` runs.
- Anything that animates on the UI thread with a custom easing (NumberFlow, Reanimated `withTiming` in a worklet) needs a worklet easing (`EASE_OUT_FN` = `Easing.bezierFn`). A plain RN `Easing.bezier` throws "easing function is not a worklet" the first time it runs.
- Sheets are `SheetHost` content (`src/device/sheets/`), never RN `Modal` or RNScreens `formSheet`: the device must stay mounted under them, and toasts and the paywall must sit above.
- Don't set `lineHeight` on a `TextInput`: iOS applies it to typed text but not the placeholder, so the first keystroke jumps. Use a fixed `height`.
- Typed routes (`.expo/types/router.d.ts`) regenerate only while Metro runs; stale types show up as tsc errors on new routes.
- Reload a dev build from the floating gear → Reload. Metro has no reload HTTP endpoint.
- `npx expo lint` has 0 errors on the device code (the old "refs during render" errors went with the old screens). Don't add new ones.

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
- **Paper (frozen, local only):** app design in "Scratch workout new"; icon artwork in "Trim Logo" (the Start key icon and the other directions are on its *Gadget identity* page, decision 75). Paper can generate images (`paper-gen://`), so no separate image connector is needed for moodboards.

### Steps only Marvin can do
- Apple ID sign-in and two-factor codes, `sudo` commands, creating accounts (sandbox testers), and `vercel login`.
- Claude can read the terminal panel but can't type into it. When a command will prompt interactively (e.g. `eas build` credentials), give Marvin the exact answers up front. For EAS: log in with Apple, reuse the distribution certificate, generate a provisioning profile for **both** targets (Trim, ExpoWidgetsTarget), no push key, yes to the App Store Connect API key.

## Feedback sprints (Claude Code agents)

Paste a list of dogfooding feedback into a new Claude Code session running **Opus 5.5 at medium effort** and run `/feedback-sprint`. The main session acts as orchestrator/PM (`.claude/skills/feedback-sprint/SKILL.md`): it triages every item, routes it to a worker, reviews the diff, sends it back with feedback, runs simulator QA, commits per item and opens a PR.

Workers live in `.claude/agents/`. Model and effort are set per agent, so the orchestrator picks them by picking the agent: `quick-fixer` (Opus, low), `builder` (Opus, medium, default), `designer` (Opus, high, taste-heavy items), `product-thinker` (Opus, high, read-only product calls), `qa-tester` (Opus, low, simulator, one per sprint). The orchestrator does one-line fixes itself, gives one worker all items in an area, and reuses agents with SendMessage; see the skill's *Token budget*. New design patterns start with Mobbin + Appllama research; polish cites the trim-ui rule it matches. Simulator QA only checks that each change is there and works; the sprint report ends with a look-and-feel list for Marvin to check on device. The run's ledger is written to `.claude/feedback-runs/` (gitignored).
