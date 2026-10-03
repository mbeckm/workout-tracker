# Trim Gadget: implementation plan (for the orchestrator)

You are the orchestrator session. You will rebuild Trim's interface as a "device" app, matching the prototype in this folder, by planning, delegating to sub-agents, reviewing, verifying and merging. Run until everything in **§14 Definition of done** is true. This plan is self-contained: it says what to build, what to keep, what to delete, how to verify each step, and which decisions are already made. Where it gives a **DEFAULT**, use it without asking, and list it in the final PR under "Defaults to confirm".

---

## 0. Read first (in this order, before any code)

1. `AGENTS.md`: repo rules, names that must not change, cloud vs local workflow, checks.
2. `design/gadget/README.md`: the assets index and the board decisions.
3. `design/gadget/SPEC.md`: exact tokens, geometry, motion, haptics, sounds.
4. `design/gadget/prototype/trim-gadget-prototype.html`: open it and click through everything. It is the source of truth for look, motion and behaviour. Read its JS for state logic (modes, rocker, sheets, editing, activation).
5. `design/gadget/screens/*.jpg` and `frames/*.jpg`: the visual targets.
6. `PRODUCT.md` (Principles, Control, Data model, Trim Pro), and `PRODUCT-DECISIONS.md` 61–72 for context on what is being replaced.
7. `.cursor/skills/trim-ui/SKILL.md`: the current design system. It will be rewritten in Phase 0; keep its copy rules, selling rules, QA ideas and accessibility rules.
8. `.agents/skills/` (Expo skills): `expo-module` (native module), `expo-animation`, `expo-router`, `eas-simulator`, `expo-ui`.

Precedence when sources disagree: **this plan > SPEC.md > prototype > chosen boards > old trim-ui**. PRODUCT.md's Control rules still apply. Where the prototype breaks them, this plan says how to fix it (for example, the rest timer, §6.4).

---

## 1. Goal and scope

Ship the redesigned Trim to Marvin's phone through EAS Update and preview builds. The target, built on the existing data and domain layers:

- **The device:** one persistent screen in metal (four finishes), with a dot-matrix display, keys, a rocker, a wheel and a big round key. It runs Home, logging, rest, finish and plan-number editing.
- **Sheets:** dark, flat sheets for the menu, today's lifts, exercise info, plans (rack, editor, add lifts), progress (overview, lift detail, body), history (receipt wall, receipt), settings, finishes and the paywall.
- **Moments:** the receipt printing, the Game Boy-style 3D plan insert, stamps, and the finished-week report on a spike.
- **Native polish:** Core Haptics patterns and short mechanical sounds through a local Swift Expo module, and the 3D insert as a SceneKit view.
- **Onboarding:** restyled to the new language, including "pick your finish" and plan packs as cartridges.

**In scope:**
- everything above
- updated docs: PRODUCT.md, PRODUCT-DECISIONS (a new decision 73), a trim-ui rewrite, AGENTS.md
- Live Activity recoloured
- dead UI code removed, after an archive tag

**Out of scope (do not build):**
- rank data ("stronger than X% of lifters your weight"; see D4)
- app icon and splash
- Android
- accounts or cloud
- new analytics beyond §9
- ExerciseDB media
- the other boards marked Rejected or Exploration in README.md

---

## 2. Decisions already made (do not reopen)

| # | Decision | Source |
|---|---|---|
| 1 | The device is the screen. Sheets carry lists and numbers. Moments carry the physical style. | Marvin, after the Not Boring Camera study |
| 2 | Orange #FF6A1A (big key #F2550F) replaces indigo as the one brand hue. Green means done, yellow means record. | Prototype |
| 3 | One wheel. Logging: wheel = weight, left keys = reps (`+` top, `−` bottom). | V2 |
| 4 | Home: stamped day rows on the display (W1). The week is shown as lamps in the rocker body (no arrows on Home). Tap a row to pick a day. **The wheel is not used on Home** (it is stowed). | Marvin |
| 5 | Moving between lifts: the rocker (`‹ ›`). Its **middle** opens Today (M3). Tapping the **exercise name** opens the exercise sheet (M4). The top-right key is Undo last set during a workout. | Marvin |
| 6 | Finish: hold the big key until the ring closes (also used to end early). Then the receipt prints. | Prototype |
| 7 | History: a wall of receipts grouped by week (HR1). The receipt spike (HR2) is for moments (the finished-week report). | Marvin |
| 8 | Plans: the rack (PB3), a clean list editor (PA1), sets × reps set on the device (PA2), the add lifts sheet (PA3). Saving = cartridges file onto the shelf. Activating = the 3D Game Boy-style insert on a dark grid with a chunky device and a satisfying click. | Marvin |
| 9 | Progress: QA1 and QA2 as clean, readable sheets. | Marvin |
| 10 | Finishes: 212 Aluminium, 101 Graphite, 305 Signal, 408 Bone, picked from the menu. The device changes live. | Prototype |
| 11 | Expo stays. No Swift rewrite. A local Swift Expo module adds Core Haptics, sounds and the SceneKit insert. | Claude's answer, agreed |
| 12 | The tab bar goes away. The menu key opens the menu sheet. | Prototype |

## 3. Open decisions with defaults (use these and list them in the final PR)

| # | Question | DEFAULT |
|---|---|---|
| D1 | Settings location | A "Settings" row at the bottom of the menu sheet opens a Settings sheet. Contents: Name, Weight units, Sounds (on/off), Trim Pro, Restore purchases, Contact support, Privacy Policy, Terms of Use, Clear history. |
| D2 | Light/dark appearance | Remove the Appearance setting. Sheets and moments are always dark; the device look is the finish. On first launch after the update, if the stored `appearance` was `dark`, or `system` with a dark system scheme, set the finish to 101 Graphite once. Keep the `appearance` field in the snapshot (unused) so nothing breaks. The status bar is dark text on Aluminium and Bone, light text on Graphite and Signal. |
| D3 | Are finishes Pro? | 212 and 101 are free; 305 and 408 are Pro. Add the Pro reason `finishes` and the feature row "Every finish". Tapping a locked swatch previews it on the device for as long as the sheet is open, then reverts and opens the paywall when the sheet closes. Ask Marvin in the PR. |
| D4 | Rank gauge and "stronger than X%" | Needs strength-standards data we don't have. Do not ship the gauge or the rank line. Progress opens with GOALS. Leave a `// rank:` TODO and a note in PRODUCT-DECISIONS. |
| D5 | Exercise illustrations and how-to | No third-party media (AGENTS.md). Draw our own SVG figures for movement patterns: press, squat, hinge, pull, row, fly, curl, extension, raise, carry/hold. Map catalog rows to a pattern with a new optional `figure` field in `bundled.ts`, with fallback by target muscle; with no match, show no figure panel. Add a `howTo: [string, string, string]` field for the 40 most common bundled lifts, written in plain English and marked for Marvin's review; others show no HOW TO section. Search aliases stay catalog-only. |
| D6 | Rest timer reaching zero | PRODUCT Control: "Timers inform, they don't act." At 0:00 the display shows a blinking `GO` with the rest haptic for `REST_GO_MS` (2 s), then the display returns to the log view for the *same* upcoming set. Nothing is logged or advanced. The prototype's auto-return is fine because it only changes the view. |
| D7 | Workout-complete screen | Replaced by the receipt sheet over Home. The post-workout paywall (first workout, `shouldOfferPostWorkoutPaywall`) opens when the receipt's Done is tapped, as today. Milestones and the week moment move to §8.4. |
| D8 | Day preview, Weeks and Edit-name routes | Day preview is replaced by Home's expanded row. Weeks is replaced by the History wall. Renaming a plan or day happens in the editor sheet: tap the plan or day title to edit it inline (iOS text field in the sheet). Day actions (rename, duplicate, delete with Undo, reorder) live behind a `…` on the day header. |
| D9 | Deleting a workout | Long-press a mini receipt on the History wall. An action sheet offers "Delete Push 1 from Thu 2 Oct?" and asks first, as PRODUCT says for completed workouts. |
| D10 | Tracking modes on the device | See §6.6 for every mode. |
| D11 | Body check-in | Keep the existing check-in sheet logic and restyle it as a dark sheet. Reach it from Progress, from the "Body weight" row's detail (`+` in the header) or a "Check in" row at the end of LIFTS when there's no body data. |
| D12 | Onboarding order | Welcome (dark grid, the device fades in), Name, Units, Days, Pick a plan (packs as cartridges, PB1, or Build my own), Pick your finish (N10, free finishes plus locked ones), then the insert animation as "Plan ready", then the paywall (template path only, unchanged rules). Build my own: after the finish, insert an empty plan and open the editor sheet. |
| D13 | Paywall | Keep `paywall` as a full-screen modal with all current RevenueCat and selling logic. Restyle it as a dark ground with the knob hero (N9): the knob turns from FREE to PRO once on appear; plans are pill cards; real prices only (trim-ui Selling). |
| D14 | Sounds | On by default and silenced by the silent switch (ambient session). A toggle in Settings. |
| D15 | Week-complete moment | When the last planned day of the week is finished, after the receipt's Done, play the HR2 spike moment with a week report (QC2 content: lifts up, records, volume, best). One Share action (system share sheet with a rendered image is optional; text is fine). It replaces the flame celebration. |
| D16 | Live Activity | Keep the behaviour; recolour to orange on dark, Doto for the rest timer if `@expo/ui` allows custom fonts (otherwise the system monospaced digits). |

---

## 4. Architecture

### 4.1 Navigation

The root route becomes the device. The `(tabs)` group and `NativeTabs` are removed.

| Route | Keep? | New role |
|---|---|---|
| `src/app/_layout.tsx` | keep, edit | providers, onboarding gate, entitlement sync, Live Activity deep links, theme to finish. Remove the tab-specific bits. |
| `src/app/index.tsx` (new) | new | `DeviceScreen` (the device plus `SheetHost`) |
| `(tabs)/**` | delete | (after archive) |
| `onboarding/*` | keep, restyle | D12 |
| `paywall` | keep, restyle | D13 |
| `log` | **keep as a deep-link alias** | redirects to `/` with params, which put the device in log mode (Live Activity URLs `scratchworkout:///log?planId&dayId&exerciseId` must keep working; the scheme can't change) |
| `workout-complete` | delete | the receipt sheet (D7) |
| `history-session`, `progress-lift`, `progress-body`, `plan/[id]`, `exercises`, `goal`, `check-in`, `day-workout` | delete the routes | their logic moves into sheets (§4.3); keep any domain code they own |
| `day-preview`, `edit`, `weeks`, `exercise-sheet` | delete | D8 |

The `SheetHost` is one controller for a single visible sheet with in-place content swaps (the prototype's `openSheet` / `swapSheet` / `closeSheet`). Build it on `react-native-reanimated` and `react-native-gesture-handler`, starting from `components/animated-sheet.tsx`. Requirements:
- top-edge presets from SPEC §6, with swipe-down dismissal and scrim tap
- `back` swaps the content
- a keyboard-aware variant for search and the name fields (reuse `src/keyboard.tsx`)
- VoiceOver: `accessibilityViewIsModal`, focus on the header, and the escape gesture closes it

Don't use the RNScreens `formSheet` for these: the device must stay mounted and visible underneath, and content swaps in place.

### 4.2 Device state machine

`DeviceMode = 'home' | 'log' | 'rest' | 'finish' | 'edit' | 'loading'`, plus a `sheet: SheetKind | null`.
- Derived from the store's `logSession`: a session with `rest` set means `rest`, otherwise `log`; no session means `home`. `edit` and `loading` are UI states.
- Keep it in a small UI store (`src/device/device-state.ts`, React context with a reducer). Logging data stays in the existing `LogSession` and store actions.
- Port the prototype's transitions exactly: `setMode`, `logSet`, `undoSet`, `moveLift`, `startEdit` / `leaveEdit`, `activate`, `finishDay`.

### 4.3 Where the old screens' logic goes

| Old file | Keep | New home |
|---|---|---|
| `screens/log-workout.tsx` (2,560 lines) | **all session logic**: open / restore / conflict, `completeSet`, `carryForward`, targets, `alternativesFor`, rest, Live Activity sync, focus, finish, discard | Split into `src/device/log/` hooks (`useLogSession`, `useRest`, `useLiveActivitySync`) and device views. Delete the old JSX (DayStrip, pager, wells, LogExerciseSheet) after the port. |
| `screens/home.tsx`, `components/week-slots.tsx`, `domain/home-numbers.ts`, `domain/plan-loop.ts`, `domain/weeks.ts` | domain logic | Home display rows (W1) and week lamps |
| `screens/plans-tab.tsx`, `screens/plan-editor.tsx`, `components/prescription-row.tsx`, `editor-chrome.tsx`, `navigation/plan-created.ts` | plan CRUD, undo, Pro gates, auto-naming, Use this plan | the rack, editor and add sheets, plus device edit |
| `screens/exercise-picker.tsx`, `catalog/*` | search, sections, recents, custom exercise creation | the add lifts sheet (and the Swap flow in Today) |
| `screens/progress-tab.tsx`, `progress-lift`, `progress-body`, `goal-sheet`, `body-goal-sheet`, `check-in`, `components/progress-*`, `goal-block`, `window-chips` | all domain and series code, goal actions, window locks | the progress, lift detail, body detail and goal sheets (and check-in) |
| `screens/history-tab.tsx`, `history-session`, `components/recap-exercise.tsx`, `pr-crown.tsx`, `domain/set-lines.ts` | session data and PR detection | the History wall and receipt |
| `screens/workout-complete.tsx`, `done-exercise.tsx` | milestone and paywall timing | receipt, week moment |
| `screens/settings-tab.tsx` | all actions | the Settings sheet |
| `components/button.tsx`, `paper.tsx` | — | replace with the new sheet primitives; delete when unused |
| `components/toast.tsx` | keep | restyle (dark pill, SPEC `toast`) |

**Never touch** (except imports):
- `src/store/**` (except the new fields in §4.5)
- `src/domain/**` (except additions)
- `src/purchases/**`
- `src/analytics/**` (except the events in §9)
- `src/catalog/**` (except the D5 fields)
- `src/live-activity/**` (logic)
- the persistence keys

### 4.4 Native module `TrimDevice` (local Expo module, Swift)

Create it with the `expo-module` skill at `mobile/modules/trim-device/`. It is iOS only, with a JS fallback that uses `expo-haptics` and plays no sound on web or when unavailable.

| API | Implementation |
|---|---|
| `play(pattern: HapticPattern)` | Core Haptics `CHHapticEngine`; patterns from SPEC §8, as AHAP JSON or built in Swift. Restart the engine on reset or stop; respect `CHHapticEngine.capabilitiesForHardware().supportsHaptics`. |
| `startContinuous(pattern)`, `stopContinuous()` | for hold to finish (ramp) |
| `playSound(name)` | `AVAudioPlayer` with the session category `.ambient`, mixing with others. Files come from `mobile/assets/sounds/*.wav` (render them with `mobile/scripts/render-sounds.mjs` using the synthesis in SPEC §9). |
| `CartridgeInsertView` (native view) | SceneKit: a device box with rounded edges and depth ~44 pt equivalent, in the current finish's colours, with the display as a material texture (or a flat dark plane plus an overlay). Then a cartridge with a label texture rendered from props `{planName, days[]}`, the camera move, insertion, overshoot, the click, the swing back. Emits `onSeated` (JS plays the boot and display update) and `onFinished`. Timings from SPEC §7. |

**Fallback.** Ship a pure-JS 2.5D version of the insert first: Reanimated with a perspective transform on stacked views, as in the prototype. RN has no `translateZ`, so fake the depth by stacking 22 offset copies of the body outline, offset by 1 pt diagonally and darkening. Use it on web and as a fallback if the native view fails to load. The prototype's frames are the visual target for both.

Native changes alter the runtime fingerprint, so they need a new build. Group them so there are at most **3 native builds** in the whole project:
1. fonts, the module (haptics and sounds) and the `expo-font` plugin
2. the SceneKit view
3. any final fix

Locally use `npx expo prebuild --platform ios && npx expo run:ios`. For Marvin's phone, run `npx eas-cli build --platform ios --profile testflight-preview --auto-submit`, which needs Marvin only if credentials prompt; give him the answers listed in AGENTS.md.

### 4.5 Data additions (backward compatible)

- Snapshot additions:
  - `finish: '212' | '101' | '305' | '408'`, default `'212'`
  - `soundsOn: boolean`, default `true`
  - `appearanceMigratedToFinish: boolean`, for D2
  - `weekMomentsShown: string[]` (ISO week keys), to show the week report once
- `normalizeSnapshot` must default them, so old snapshots load unchanged.
- Catalog: the optional `figure` and `howTo` fields (D5). They are never persisted into plans (AGENTS.md: catalog metadata stays in the catalog).
- No changes to `WorkoutPlan`, `LoggedWorkout`, `LogSession`, `Goal` or `BodyCheckIn`.

### 4.6 Tokens and theme

- Rewrite `src/constants/theme.ts`:
  - add `device` (per finish), `lcd`, `sheet` and `signal` palettes, and the new type roles (SPEC §2–3)
  - remove indigo and the light/dark `ThemeColors` once nothing uses them
  - keep `space`, `radius`, `spacing` and `iconSize`, extended where SPEC needs (radius 22, 24, 28, 38)
- Add to `src/motion.ts`: `DEVICE` durations and easings from SPEC §7 (`KEY_PRESS: 80`, `SHEET: 380` with `EASE_SHEET_GADGET: bezier(.2,.9,.3,1)`, `DRUM: 160`, `HOLD: 1100`, `FEED: 1800`, and so on).
- Fonts: copy `design/gadget/fonts/*.ttf` to `mobile/assets/fonts/`, register them with the `expo-font` config plugin in `app.json` (Doto-Black and IBMPlexMono Medium/Bold), and use `fontFamily: 'Doto-Black'`, `'IBMPlexMono-Medium'` and `'IBMPlexMono-Bold'`. For SF Rounded use `fontFamily: 'ui-rounded'`, which React Native supports on iOS; verify in the gallery. The fallback is `System` with `fontVariant`.
- The design-token ratchet: new code uses tokens only. When old files are deleted, run `node scripts/check-design-tokens.mjs --update` to lower the baseline. **Never raise it.** Add rules for the new palettes if useful (for example, forbid raw `#FF6A1A`).

---

## 5. Working method for the orchestrator

- **Branching:**
  - Create the integration branch `gadget/main` from `origin/main`. Tag `archive/pre-gadget` on the current `main` before any deletion.
  - Each phase, or each independent task, goes on its own branch `gadget/<phase>-<slug>` with a PR into `gadget/main`.
  - Merge `origin/main` into `gadget/main` at least daily; expect conflicts in `AGENTS.md`, `.claude/` and the docs.
  - The final PR is `gadget/main` into `main`, only when §14 is green and Marvin approves.
- **Agents (from `.claude/agents/`):**

  | Agent | Use for |
  |---|---|
  | `designer` (high effort) | device components, sheets' visual fidelity, motion, moments |
  | `builder` (medium) | ports of logic, state machine, sheets wiring, native module, data migrations |
  | `quick-fixer` (low) | token or copy fixes |
  | `qa-tester` (low) | simulator checks against the acceptance criteria |
  | `product-thinker` | only if a question isn't covered by §2–3 |

  Give one agent a whole area. Reuse agents with SendMessage instead of spawning new ones.
- **Parallelism:**
  - Phase 0, then Phase 1 must land first.
  - After that, Phases 3, 4 and 5 are sequential (they share the device).
  - Phases 6 and 7 can run in parallel with each other once Phase 2's SheetHost exists.
  - Phase 9's native SceneKit work can run in parallel from Phase 2 onward, on its own branch.
- **Review:** the orchestrator reviews every diff against SPEC and the screenshots before merging, and sends it back with concrete deltas ("display padding is 18, SPEC says 22").
- **Ledger:** keep a run log at `.claude/gadget-runs/<date>.md` (add `.claude/gadget-runs/` to `.gitignore`), recording each task, its agent, its status, its verification evidence and any open issues.
- **Never:**
  - publish to the `production` EAS channel
  - rename load-bearing identifiers (AGENTS.md)
  - `git add -A .cursor`
  - raise the token baseline
  - skip `npm run check`
  - leave the main branch red

---

## 6. Phases

Each phase lists tasks, files and **acceptance checks**. A task is done only when its checks pass and the evidence is in the ledger.

### Phase 0: Docs and setup (orchestrator plus designer)

1. In `mobile/`: `npm ci`, `npm run check` (record the baseline), `npx expo lint` (record the known errors).
2. Tag `archive/pre-gadget`. Create `gadget/main`.
3. Write **decision 73 "The device"** in `PRODUCT-DECISIONS.md`. Summarise §2, D1–D16, what it replaces (decisions 59–72 for Home, 67 for the brand hue, 70/71 for the editor surface, the tab model), and link `design/gadget/`.
4. Update `PRODUCT.md`: Tabs becomes "Device and menu"; update the Workout/Home, Plans, Progress and History sections, Principle 12's colour roles, and onboarding. Keep the Control rules verbatim.
5. Rewrite `.cursor/skills/trim-ui/SKILL.md` on the same skeleton (Principles, Structure, Typography, Spacing, Color, Shape, Icons, Motion with Haptics, Copy, Components, Charts, Selling, Per screen, Do not, QA, Enforcement). Content comes from SPEC plus this plan. Keep the Copy, Selling and accessibility rules. Remove Liquid Glass, indigo and native tabs. Update `.cursor/skills/implement-screen/SKILL.md` to point at the device and sheet primitives.
6. Add an AGENTS.md section "Gadget redesign" pointing to `design/gadget/` and stating that Paper and old screenshots are obsolete for UI.

**Accept when:**
- The docs are merged into `gadget/main`.
- trim-ui has no mention of indigo or tabs except as history.
- `npm run check` is green.

### Phase 1: Foundation (designer for visuals, builder for the module)

1. Fonts in `assets/fonts` and the `expo-font` plugin. Tokens in `theme.ts` and `motion.ts` (§4.6). `FinishProvider` (reads the store's `finish`, supplies the device palette; D2 migration).
2. **Device primitives** in `src/device/parts/`, each matching SPEC §4 and the screenshots:
   - `DeviceBody` (gradient, sheen, brushing; finish-aware)
   - `RoundKey` (56)
   - `TallKey` (64 × 76)
   - `Rocker`: `variant: 'week' | 'lifts'`, lamps, ends, middle press, tilt on press
   - `Lamp`: `off | on | done | part | lit` animation
   - `Display` (lcd panel and content transition)
   - `Drum` (3-row roll)
   - `BigKey`: `primary | metal | disabled`, press depth, Signal variant
   - `Well`
   - `HoldRing`
   - `Wheel`: pan gesture on the UI thread, a notch every 16 pt, ridge texture offset following the finger, and an `onNotch(±1)` callback through `runOnJS`; it also accepts accessibility increment and decrement
   - `EngravedLabel`
3. **`TrimDevice` module** (haptics and sounds) with the JS fallback, and a `useHaptics()` hook exposing the named patterns from SPEC §8. Sounds rendered into `assets/sounds/`.
4. **A dev-only gallery route** `src/app/__gallery.tsx`, visible only when `__DEV__`. It shows every primitive in every state and finish next to each other at 390 × 844 for screenshot comparison.
5. **Native build 1** (local `expo run:ios`, and a `testflight-preview` build for Marvin once Phases 2–4 are in).

**Accept when:**
- The gallery renders on the iOS Simulator.
- Each part is screenshotted next to the matching crop of `screens/04-log-set.jpg`, `01-home.jpg` and `08-rest.jpg`, and differences are listed as zero or justified.
- Wheel notches fire haptics on a device; Marvin confirms on the TestFlight build.
- `npm run check` and the web smoke test are green (the web build must not crash: native module guarded).

### Phase 2: The shell (builder)

1. `src/app/index.tsx` is `DeviceScreen`: lays out the parts (SPEC §4 with safe-area and small-screen rules) and hosts `SheetHost`.
2. `SheetHost` (§4.1) with the sheet primitives:
   - `SheetHeader` (title, round controls)
   - `SheetCard`
   - `SheetRow`
   - `SectionLabel`
   - `PillButton` (light, dark)
   - `StickyActionBar`
   - `Chip`
   - `Segmented`
   - `ObjectIcon` (knob, gauge, receipt, toggles, cartridge)
3. The menu sheet (N4 plus D1): End workout during a session, the finish card, Plans, Progress, History, Settings.
4. Remove `(tabs)` and NativeTabs. Point the onboarding gate and the paywall at the new root. Keep the `log` route as a deep-link alias (§4.1). Update `scripts/web-smoke.mjs` default routes.
5. The toast restyled.

**Accept when:**
- The app boots to the device. The menu opens and closes (swipe, scrim, ✕).
- VoiceOver reads the menu items.
- The Live Activity URL `scratchworkout:///log?...` opens the device in log mode on the right exercise (manual test with `xcrun simctl openurl`).
- The web smoke test passes for `/`.

### Phase 3: Home (designer)

Build W1 exactly as `screens/01-home.jpg` and `14-home-day-stamped.jpg`.
- **Rows** come from the active plan's days and this week's completions: `planLoopProgress`, `weekSlots`, `startOfLocalWeek` (Monday). Done meta comes from the `LoggedWorkout` (weekday, `durationMinutes`, `setCount`). The PR stamp text comes from `workoutPersonalBests` (first lift name plus `PR`; if several, `2 PRS`).
- **Selected day:** suggested by `nextDayIndex`; tap a row to pick another. The expanded row shows up to 4 lifts with the prescription. If there are more than 4, the 4th line is `+N MORE`.
- **Rocker body (week variant):** one lamp per planned day (green for done, orange for selected, off otherwise). WEEK n engraved under it (the ISO week number of the training week, or `WEEK` plus the count since the plan started; DEFAULT: weeks since the plan's `createdAt`, starting at 1).
- **Keys:**
  - The big key Start starts the selected day (same logic as `useStartDay`, including the conflict with another day's open session: confirm first).
  - Top right opens the History sheet. The wheel is stowed and there are no left keys.
- **States:**
  - Mid-workout: Home isn't shown; the device is in log mode. If the user is in the menu during a session, the menu shows End workout.
  - Week complete: all rows stamped, the big key disabled with the label "Start", the rocker lamps all green, the display footer shows `WEEK DONE` (D15's moment plays once).
  - No active plan: the display shows `SLOT EMPTY` and `INSERT PLAN` (blinking), and the big key is "Plans" (metal), opening the rack.
  - A day with 0 lifts: the row shows `0 LIFTS`, and Start toasts "Add lifts to this day first" and opens the editor on that day.
  - Rest days and calendar gaps: none (the week is a count, not a calendar; decision 72 stays).
- **Animations:** a day just finished stamps in and its lamp flickers green when Home reappears after the receipt (SPEC §7).

**Accept when:**
- Simulator screenshots match `01` and `14` (layout, colours, type sizes within 2 pt), and every state above is screenshotted.
- The VoiceOver order reads: menu, week ("2 of 4 days done"), the rows ("Push 1, next, 6 lifts, about 45 minutes"), Start, History.

### Phase 4: Logging and rest (builder for logic, designer for views)

Port all of `log-workout.tsx`'s behaviour into device mode, matching `04`, `05`, `08`, `09` and `06`/`07`.
- **The display:**
  - The header shows the exercise name ▾ (tap opens the exercise sheet) and the set label `SET n/m`, or `EXTRA SET` when all prescribed sets are done.
  - The drum shows the weight (step per §6.6) and `×reps`. The footer shows `LAST 80×8`, or for Pro with a target `TARGET 87.5×8`. Free users with targets locked see a dim `TARGET ›`, which opens the paywall `targets`.
- **Wheel:** changes the weight by one step per notch. Weight below 0 is clamped.
- **Reps keys:** `+` and `−`, clamped to 1–99. A long press repeats.
- **The big key "Log":** `completeSet` with every existing rule:
  - the first weighted set with no weight: the drum is focused (flash the frame) instead of logging
  - carry-forward
  - the set haptic (SPEC)
  - `track('set_logged')`
  - rest starts with `restSecondsForExercise`
  - auto-advance to the next incomplete lift when the current one is done (PRODUCT Control: the obvious next step only)
- **Rocker:** `‹ ›` move between lifts (`goToExercise`); lamps show done / part / on. The middle opens Today (M3): jump, reorder (drag), Swap (alternatives via `alternativesFor`, plus the picker), Add lift (picker, `from=log` semantics), Remove (Undo), "i" opens the exercise sheet.
- **Top right:** Undo last set (disabled when there's nothing to undo).
- **Rest mode:**
  - The ring shows the time left; ±15 with the keys and with the wheel (2 notches = 15 s); the big key is "Skip" (metal).
  - At 0, show GO, play the haptic and return the view after 2 s (D6).
  - Undo stays available.
- **Persistence:**
  - debounce saving as today, flush in the background, restore on launch
  - the conflict dialog when starting another day
  - the Live Activity syncs on every exercise and rest change (as today)
  - the deep link focus works
- **Finish (`11`, `12`):** the menu's End workout, or completing the last set, enters finish mode. Hold the big key 1.1 s (continuous haptic ramp, ring). Releasing early cancels. The left key "Back" returns to the next incomplete lift (only when not all sets are done). Completion runs `finish()` (`completeWorkout`, `clearLogSession`, track, Live Activity end), then the receipt sheet (Phase 5). Discarding a workout with no logged sets: hold to finish with 0 sets shows `NOTHING LOGGED` and the key label "Discard"; it asks first, as the existing discard does.

**Accept when** these scenarios pass on the simulator (qa-tester) and screenshots match the targets:
1. A full Push day: 9 sets logged with the wheel and keys.
2. Moving back with the rocker to add an extra set.
3. Undo during rest.
4. Killing the app during rest and relaunching: the session restores with the remaining rest.
5. Opening from the Live Activity URL.
6. lbs units.
7. A bodyweight lift.
8. A timed hold.
9. Swapping a lift via Today.
10. Ending early and holding to finish.
11. Two days in conflict.

### Phase 5: Receipt, History, moments (designer)

1. The receipt sheet (`13`, `03`): the slot, the stepped feed, the thermal paper and the zigzag (SPEC §6). Content from the `LoggedWorkout`: `compressSetLines` for the `w × r, r, r` lines, `workoutPersonalBests` for the PR line, and the estimated max of the first lift via `estimatedOneRM`. The print haptic and sound.
   - Copy shares the receipt text.
   - Done closes and triggers, in order: the Home stamp, the week moment (D15) if it applies, then the post-workout paywall (D7) if it applies. Never two modal moments at once; queue them.
2. The History wall (`02`): `workoutHistory` grouped by training week (Monday start), with the week header showing that week's lamps (done of planned). Mini receipts as in SPEC. Tapping prints the full receipt (with ‹ back to the wall). Long-press deletes (D9) with the existing `deleteWorkout`. Empty state: one blank, torn receipt reading `NO WORKOUTS YET`.
3. The week moment (D15, HR2 + QC2) as a full-screen moment on the dark grid ground, with a Share action and Done.

**Accept when:**
- Screenshots match `02`, `03` and `13`.
- Deleting asks first and removes the workout.
- 100+ workouts scroll at 60 fps (FlashList or a virtualized list for the wall).
- The PR line matches the old app's PR detection for the same data (compare against the old app on a fixture).

### Phase 6: Plans (builder for logic, designer for moments)

1. The rack (`20`), from `plans`, the active plan and `archivedPlans` (archived plans stay hidden as today).
   - The active shelf is outlined; cartridge labels are each day's title in uppercase, at most 6 characters (prototype `cartLabel`), green when done this week.
   - `+` creates a plan. Free users with one plan: the paywall `second_plan`, as today.
2. The editor sheet (`21`, `25`), porting plan editor v3 / 3.1 behaviour:
   - rename the plan and days inline (D8); the day `…` menu (rename, duplicate, delete with Undo, move up or down)
   - rows with the sets × reps chip; swipe a row to remove it, with Undo
   - Add lift goes to the add sheet; Add day
   - auto-naming new plans from day names (decision 71); no name prompt on entry
   - "Use plan" for an inactive plan (Pro gate `switch_plan` as today)
   - an empty plan's first state: one day, "Add lift" emphasised in orange
3. Device edit (`22`): tap a chip and the sheet hides. The device shows `DAY EDIT` with `SETS × REPS`; left keys set sets (1–10), the wheel sets reps (1–50). Duration-mode lifts: the wheel sets seconds in 5 s steps, `SETS × 0:45`. The rocker moves between the day's lifts, and its middle, ‹ or Done return to the editor. Top right removes the lift (Undo toast). Changes save immediately to the plan (store `updatePlan`), matching today's editor.
4. The add lifts sheet (`23`): search (`searchExercises` with aliases), muscle sections (catalog `sections.ts`), recents, multi-select ticks, "Add N lifts" (sets and reps defaults from the catalog row or 3 × 10), creating a custom exercise (port from `exercise-picker.tsx`).
5. **Saving (filing):** when the editor closes back to the rack after any change, that plan's cartridges file in (SPEC §7). Creating a plan files it too.
6. **Activation:** Use plan runs `activatePlan` (store), then plays the insert (Phase 9's native view when available, otherwise the JS 2.5D fallback built here), then Home. Blocked while a session is open, with the toast "Finish your workout first". The week lamps reset to the new plan's days; history is untouched.

**Accept when:**
- Screenshots match `20`–`25` and the `frames/` sequence (the JS fallback, frame by frame within reason).
- All editor actions work with Undo.
- A free user hits the paywall on a second plan and on switching.
- Plans persist across relaunches.
- An edited active plan updates Home immediately.

### Phase 7: Progress (designer)

1. The progress sheet (`18`, without the gauge per D4):
   - GOALS (pinned goals, up to 3, as `goal-block`, rings in green; reached goals marked)
   - LIFTS (tracked lifts via `collectTrackedLifts`; sparkline over 30 days, or 90 as a setting kept from today; value is the estimated max; change versus the window start; record colouring when the last point is a PR)
   - BODY rows
   - long-press a lift to set a goal (as today)
   - empty state: `No lifts yet` plus the next day's lifts dim
2. Lift detail (`19`): the big number, the change, the lcd chart (port the `progress-line-chart` scrubbing; the haptic per point stays), the goal line, ranges (`FREE_PROGRESS_WINDOWS` 1M and 3M, the Pro lock on the rest with the paywall `progress_history`), sessions.
3. Body detail and check-in (D11), and the goal sheets restyled.

**Accept when:**
- Screenshots match `18` and `19` (minus the gauge).
- Numbers equal the old app's for the same fixture (use `store/progress-demo.ts`).
- The locked ranges open the paywall.

### Phase 8: Settings, Finishes, Onboarding, Paywall (designer and builder)

1. Settings sheet (D1). Clear history asks first.
2. The finishes sheet (`16`, `17-*`): swatches, the device changes live, Pro locks per D3, saved to the store.
3. Onboarding (D12): dark grid ground and new type. Keep the step logic in `screens/onboarding/*` and `finish.ts`; locale units; `track('onboarding_completed')`. Plan packs show the starter templates (`templates.ts`, filtered by days) as cartridge packs; Build my own is the empty pack. Then pick a finish, then the insert, then the paywall (template path).
4. The paywall restyle (D13), keeping `use-paywall-controller.ts`, offers, trial timeline, restore, legal links, and every rule in trim-ui Selling.

**Accept when:**
- A fresh install walks through onboarding on both paths and ends on a working Home.
- The paywall shows real prices from RevenueCat (sandbox) and purchase / restore work in the TestFlight build (Marvin).

### Phase 9: Native moments (designer with builder)

1. `CartridgeInsertView` in SceneKit (§4.4), with props and events. Device and cartridge geometry with chamfered edges and depth, materials for the finishes, the cartridge label texture drawn with Core Graphics using Doto.
   - Camera and object animation per SPEC §7: pull back, cartridge in, overshoot, click, swing back.
   - The haptic `cartridgeClick` and sound `cartridge` exactly at seat time; the grid ground and the pulse ring.
   - Use it on activation and in onboarding. Keep the JS fallback for web and for errors.
2. Core Haptics patterns tuned on a device with Marvin (two short iterations, through the TestFlight build).
3. Native build 2.

**Accept when:**
- Marvin approves the feel on his phone.
- Reduced motion shows the fallback (instant load).
- There are no frame drops: Instruments, or the eye, at 60 fps on an iPhone 12-class device.

### Phase 10: Cleanup and release prep (builder)

1. Delete the unused routes, screens and components (old Home variants, tabs, paper primitives, the old log JSX, `day-preview`, `weeks`, `edit`, `workout-complete`, `exercise-sheet`) after confirming no imports (`tsc` and grep).
2. Lower the token baseline (`--update`). Lint: no new errors versus Phase 0's baseline.
3. The Live Activity recolour (D16).
4. Docs: PRODUCT.md and trim-ui are final; AGENTS.md "Gadget redesign" now points to the shipped code and keeps `design/gadget/` as history.
5. The final QA pass (§11) and the PR into `main` with screenshots, ledger summary and "Defaults to confirm".

---

## 6.6 Tracking modes on the device (D10)

| `trackingMode` | Drum (wheel) | Keys | Footer | Notes |
|---|---|---|---|---|
| `weightAndReps` | weight; step by equipment: kg barbell 2.5, dumbbell 2 (pairs; the display shows per-hand weight), machine/cable 2.5 (isolation 1); lbs: 5, isolation 2.5 (from `targets.ts INCREMENTS`) | reps ± | LAST / TARGET | first-set weight rule |
| `reps` (bodyweight) | **reps** (`×12` big, 104) | ± reps as well (both work) | LAST 12 | no KG label; the wheel label is REPS |
| `counterweightAndReps` (assisted) | assistance in kg, shown `−20.0` with an `ASSIST` header | reps ± | LAST | less assistance is progress |
| `duration` (holds, timers, mobility) | seconds, 5 s per notch, shown `0:45` | ±5 s | LAST 0:40 | the big key can be "Start" (runs a countdown on the display) then "Log". DEFAULT: just Log, no countdown. |
| `repsAndDuration` | duration on the wheel | reps ± | | |
| `distanceAndDuration`, `weightAndDistance` | Not used by bundled exercises (AGENTS.md). If met (custom), show two values on the display; the wheel edits the first, the keys edit the second. | | | |

Units: kg or lb from the store. All conversions use the existing helpers; never store converted values except as today.

---

## 7. Edge cases (each needs a test or a manual check in the ledger)

**Logging**
- Starting a day while another day's session has logged sets: confirm the dialog (keep the existing text).
- Starting the same day again: resume.
- Removing the current lift via Today: move to the next one; if it was the last, go to finish.
- Swapping a lift with logged sets: ask first (as today).
- Plan edited while a session is open: the open session keeps its drafts (orphans as today, `normalizeLogSession`).
- The active plan deleted while the app is closed: the session is dropped on launch (existing).
- Rest running when the app is killed: on launch, if `endsAtMs` has passed, show the log view with no GO.
- Rest adjusted below 0: it ends.
- Undo after auto-advance: returns to the previous lift and set.
- Extra sets beyond the prescription: allowed, labelled `EXTRA SET`, saved like today (`extra: true`).
- Weight 0 on a weighted lift: allowed after the first nudge (bar-only and empty implements). Display `0.0`.
- Very heavy weights (≥ 1000): drum text shrinks to fit (Doto 88).
- Long exercise names on the display header: truncate with … at 1 line (the name is still in full on the exercise sheet and in VoiceOver).
- Many lifts in a day (> 12): rocker lamps compress (gap 4, size 8); beyond 16, show `n/m` text in the strip instead of lamps.
- Live Activity tapped for an exercise that was removed: fall back to the first incomplete lift.

**Home and week**
- Week boundary on Monday while the app is open: refresh on foreground (`AppState`) and at midnight.
- More days trained than planned (extra sessions): rows stay per planned day; extra workouts appear in History only (as today's slots).
- A plan with 1 day, or 7 days: lamps and rows adapt; the expanded row still fits (scroll the display rows if their total height exceeds the display: `ScrollView` inside the display with a fade).
- Home after onboarding with no history: no stamps, the first day selected.

**Plans**
- Free user: 1 plan. A second one hits the paywall. Switching hits the paywall. Deleting the active plan leaves no active plan (Home shows `INSERT PLAN`).
- An empty plan or day: Use plan is allowed only if at least one day has a lift (otherwise toast "Add a lift first").
- Duplicate day names: allowed; cartridge labels may repeat.
- Names longer than the cartridge label: truncated to 6 characters for the label only.
- Activation tapped twice quickly: ignore re-entry during `loading`.

**Progress**
- No history: empty state.
- One session: no sparkline, a dot only.
- Goal reached: the green ring is full and the goal is marked reached (existing `reachedAt`).
- Locked windows: paywall.
- lbs: everything is displayed in the user's unit.

**History**
- Workouts from deleted plans still show (title from `LoggedWorkout.title`).
- Very old weeks: virtualised list.
- Deleting the most recent workout of the current week: Home's stamps update.

**System**
- Dynamic Type up to accessibility sizes: sheets scale, the device display doesn't (it's hardware); key glyphs are capped at 1.2. Check XXXL on the menu and the editor.
- VoiceOver:
  - every key has a label and hint-free actions
  - the wheel is an adjustable element (`accessibilityActions` increment/decrement with the value spoken: "85 kilograms")
  - the rocker's ends are buttons ("Previous lift", "Next lift"); its middle is "Today's lifts"
  - the display content is one summary label per mode ("Bench press, set 2 of 3, 85 kilograms, 8 reps, last time 80 by 8")
- Reduce Motion: fades only; the insert is skipped; the receipt is shown without the feed.
- Silent switch: no sounds; haptics still play. Sounds off in Settings: no sounds.
- Low Power Mode: no change.
- Small screens (iPhone SE 2/3, mini): the display shrinks, keys don't; nothing clips (screenshot both).
- Large screens (Pro Max): the device scales its margins (`space.margin` rule), keys stay the same size, and the display grows.
- Rotation: portrait only (as today).
- App backgrounded during the insert or receipt moments: finish the state change instantly on return (never stuck in `loading`).
- Haptics engine reset (audio interruption, a call): restart the engine on the next play.

---

## 8. What stays exactly as is

- The data model, persistence and keys; the store API; the domain logic (targets, 1RM/10RM, PRs, weeks, rest, set lines).
- Purchases (RevenueCat), entitlements, Pro reasons (plus `finishes` per D3), paywall timing rules.
- Catalog contents, ids, search, aliases, alternatives, custom exercises, the media switch (stays off).
- Live Activity behaviour, the URL scheme, focus logic, widgets target ids.
- Analytics events and their properties (plus §9).
- Names that must not change (AGENTS.md).
- Units handling, locale defaults, the en-US formats.

## 9. Analytics (additions only, anonymous, no workout contents)

- `plan_activated` `{source: 'rack' | 'onboarding'}`
- `finish_selected` `{finish}`
- `sheet_opened` `{sheet}`: menu, today, exercise, plans, progress, history, settings (to learn the navigation; no contents)
- `week_completed` (when the week moment shows)

Update `legal/privacy.html` only if the collected categories change; these don't (usage events).

## 10. Verification toolkit

- **Every PR:**
  - `cd mobile && npm run check` (tsc and the token ratchet)
  - `npx expo lint`, with no new errors
  - `npx expo export --platform web --output-dir /tmp/trim-web && node scripts/web-smoke.mjs /tmp/trim-web /`
  - The web export must not crash: guard native modules with `Platform.OS === 'ios'` and fall back.
- **Visual (local Mac sessions):**
  1. `npx expo run:ios`, then take screenshots with `xcrun simctl io booted screenshot <file>`.
  2. Build a side-by-side montage with the matching `design/gadget/screens/*.jpg` (ImageMagick: `magick target.jpg actual.png +append compare.png`).
  3. The orchestrator (or `designer`) lists every visible difference: position, size, colour, type, radius, shadow.
  4. Fix, or justify each difference in the ledger. Tolerance: 2 pt layout, exact colours (token values), the same font roles.
- **Visual (cloud sessions):** the web export gives layout only (no native fonts, no shadows parity). Use EAS Simulator (`.agents/skills/eas-simulator/SKILL.md`; check `simulator:availability`, always stop the session) for iOS screenshots.
- **Behaviour:**
  - `qa-tester` runs the Phase 4 scenarios and §7 edge cases on the simulator, one screenshot per criterion.
  - Add plain TS unit checks for the device state machine and the week rows with `tsx` (there's no test runner): `mobile/scripts/check-device-logic.ts` run in `npm run check`, asserting transitions (log, rest, auto-advance, undo, extra set, finish) on fixtures.
- **Feel (only Marvin):** after Phases 4, 6 and 9, ship to his phone:
  - JS-only changes: `npx eas-cli update --channel preview --platform ios --environment production --message "<what changed>"`
  - native changes: a `testflight-preview` build
  - Send him a short look-and-feel checklist: wheel detents, key press depth, the click, the receipt, readability in the gym, one-handed reach.

## 11. Final QA checklist (all must be ticked in the final PR)

- [ ] Every screen in `design/gadget/screens/` has a matching simulator screenshot in the PR, side by side, with no unjustified differences.
- [ ] The cartridge insert matches `frames/a–g`, haptic and sound fire at the seat, and reduced motion is respected.
- [ ] Four finishes on Home, log and rest (12 screenshots); text contrast is readable on every finish.
- [ ] Every Phase 4 scenario, and every §7 edge case, is checked off in the ledger.
- [ ] VoiceOver walkthrough: start a workout, log a set, rest, finish, open History.
- [ ] Dynamic Type at the largest accessibility size: the sheets are usable.
- [ ] iPhone SE and Pro Max screenshots: nothing clipped.
- [ ] A fresh install and onboarding work on both paths; an upgrade from a snapshot of the current `main` keeps all plans, history, goals and an open session.
- [ ] The paywall at each trigger (onboarding, post workout, second plan, switch plan, progress window, targets, finishes, settings), with purchase and restore in sandbox.
- [ ] The Live Activity: start a workout, lock the phone, rest countdown, tap to open on the right lift.
- [ ] `npm run check` green, lint has no new errors, web smoke green, the token baseline lowered (never raised).
- [ ] PRODUCT.md, PRODUCT-DECISIONS (73), trim-ui and AGENTS.md updated.
- [ ] Nothing published to the `production` channel.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| The wheel's gesture feel or haptic latency | Run the pan on the UI thread. Call the haptic directly from the native module through a JSI-friendly sync call if `runOnJS` latency is noticeable. Tune the notch distance (16 pt) with Marvin. |
| SceneKit effort larger than expected | The JS 2.5D fallback ships first (Phase 6). The native view is an upgrade (Phase 9). |
| Font rendering differences (Doto metrics) | Gallery comparison in Phase 1. Adjust `lineHeight` per role in tokens, not per screen. |
| Losing logic while splitting `log-workout.tsx` | Port the hooks first, unchanged, behind the old UI; verify; then swap the views. Keep the Phase 4 scenarios as the regression list. |
| Merge conflicts with other sessions on `main` | Merge `main` into `gadget/main` daily. Keep the docs changes in Phase 0 to settle early. |
| The web smoke test breaking on native-only code | Every native import is behind a platform file (`.ios.ts` / `.ts`) like `live-activity/controller`. |
| Too many native builds | At most 3, grouped as in §4.4. |

## 13. Reporting

- After each phase: update the ledger, then post a short summary to Marvin covering:
  - what shipped
  - the preview update or build id
  - what to check on the phone
  - any defaults used
- Stop and ask Marvin only for:
  - Apple, EAS or RevenueCat credentials or prompts
  - App Store Connect changes
  - decisions not covered by §2–3 that would change the product, not just the implementation

## 14. Definition of done

1. All phases 0–10 are merged into `gadget/main`, and the final PR into `main` is open with the §11 checklist fully ticked and evidence attached.
2. Marvin has used a `testflight-preview` build with the native module and the SceneKit insert, and the preview channel carries the latest JS.
3. No old UI remains reachable. Old code is deleted, with the `archive/pre-gadget` tag present.
4. Docs are updated (decision 73, PRODUCT.md, trim-ui, AGENTS.md).
5. "Defaults to confirm" (D1–D16 plus anything new) are listed in the final PR description.
