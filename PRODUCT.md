# Trim product model

Trim is a plan-first iPhone workout logger ("Trim Workout" on the App Store). The app lives in `mobile/`. Decisions that changed this model are in `PRODUCT-DECISIONS.md`; visual rules are in `.cursor/skills/trim-ui/SKILL.md`.

## Job

Help someone follow a training plan and log a workout without losing focus between sets.

There is no ad-hoc or empty workout. You make a plan, then start a day from it.

## Who and where

Serious lifters, mostly young, training in a gym. They use Trim between sets, under artificial light, at arm's length, often one-handed, with music in their headphones. They open and close it dozens of times a workout and switch to music or messages in between. Trim is built for that moment: instant resume, big numbers, thumb-reach controls, and only short mechanical sounds that mix with their music and stay silent on the silent switch. It must work for people who don't see well (Dynamic Type, contrast, VoiceOver), but it isn't an accessibility-first product.

## Principles

These decide product calls. When a feature, screen or behavior conflicts with one, the principle wins or the principle gets changed here on purpose. Visual rules that follow from them are in `trim-ui`.

1. **Trade Republic for workouts.** Simple, reduced and powerful. The essential things are remarkably easy and fast, and everything else is out of the way. We add by removing.
2. **Fast is the feature.** From launch to the first logged set is two presses (Start, Log), and a prefilled set is one. A change that adds a tap or a wait to that loop needs an exceptional reason.
3. **One screen, one job, one primary action.** Each screen answers one question. Detail is disclosed progressively: the device → a sheet → a `…`, long-press or swipe → Settings. We never overload a screen to save a tap somewhere rare.
4. **The user is in control.** Trim does what the user tells it, and nothing on their behalf. Nobody should ever think "why did it do that?" (see Control below).
5. **The interface explains itself.** No info text, explainer subheadings, summaries, tips or coach marks. If something needs explaining, we fix the design. The one exception is the guided tour after onboarding (decision 85): the essentials (the wheel, the keys, Log, Undo, the rocker, swapping a lift, the menu) are never left to be discovered, so Trim teaches them once, in its own voice on its own display, by having the owner use each control.
6. **Whitespace is confident.** We don't fill space for the sake of filling it. An empty-looking start is correct, and screens fill with the user's own work.
7. **Motion serves speed, fluidity or joy.** An animation must make Trim feel faster, more fluid or more loveable. If it can't, it doesn't ship. Every touch gets a visible reaction within 100ms, and nothing waits on an animation.
8. **Everything is a sale.** Making money isn't evil, and helping someone decide isn't either. The sale starts at the first tap, not at the paywall, and every interaction is the store clerk. So the product is the salesperson: every detail gets the same care as the paywall, without plastering CTAs anywhere. We borrow the principles of the best-converting apps and never their dark patterns: real prices, a clear trial timeline, an exit that's always visible, no pressure tricks, and always Trim's own look. Buying Pro is itself a rewarding moment. See `trim-ui` → Selling.
9. **A joyful tool for years.** Robust, native and timeless. Joy comes from things working remarkably well, plus a few earned moments that feel special: the first open, the first plan, the first workout, the first purchase, a new record, a full week. Never from confetti or copy.
10. **The moment decides the screen.** Every screen answers why someone opens it right now, and anything that doesn't serve that moment leaves it. Home is opened to start a workout, so it holds the week and the next workout, and plan editing stays in the plans sheets.
11. **Screens reflect what just happened.** A screen changes with the user's recent history (before a workout, just trained, week complete) instead of showing one static layout. That, not decoration, is what makes Trim feel like a companion.
12. **Your numbers first, and show the change.** The user's own values lead and the plan's prescription supports them. Wherever there's a previous value, Trim shows the difference. Color is for the rare peaks only: green for done, yellow for a record; ordinary progress is an ink ↑. The one brand hue, orange (#FF6A1A), marks what you act on next and what's selected (the big key, focus frames, the current lamp, selected chips), and also a secured week and the streak; it never marks any other result.

### Control

The test: **could the user have predicted this before they tapped?** If not, Trim doesn't do it.

- **Explicit state changes.** Which plan is active changes only when the user picks it (Use plan, or choosing a plan in onboarding). Creating, editing, duplicating or deleting a plan never changes which plan is active. Deleting the active plan leaves no active plan until the user picks one.
- **No data changes on the user's behalf.** Nothing is deleted, archived, overwritten or merged without an explicit action. The only silent discard allowed is a draft that holds no input (an untitled plan with no exercises).
- **Prefill proposes, the user commits.** Last time's weight and reps prefill the drum and the reps, and targets are suggestions. Nothing is logged, finished or skipped until the user taps.
- **Carry-forward is limited to the obvious next step.** After Log, Trim may move to the next set, or to the next unfinished exercise when this one is complete, because that's the visible, expected result of the tap and one tap undoes it. It never leaves the screen, finishes a workout or changes stored data by itself.
- **Timers inform, they don't act.** Rest reaching 0:00 signals (haptic, `GO`). It doesn't log, advance or start anything.
- **Forgive, don't interrogate.** Anything that can come back (a plan, a day, an exercise in a plan, a logged set) is removed immediately with Undo. Only what can't come back (a completed workout, Clear history, a workout with logged sets) asks first, naming the thing.
- **No surprise interruptions.** The paywall appears only at the moments listed under Trim Pro and never during a workout. No notifications or prompts the user didn't opt into.

## Data model

```
Plan
  └── Day[]          (Push, Legs, Upper A, …)
        └── Exercise[]
```

- **Plan:** a named program (`id`, `name`, `days`). One plan is active at a time. Free users keep one plan; more is Trim Pro.
- **Day:** one session in the plan (`id`, `title`, `exercises`).
- **Exercise (prescription):** catalog name and metadata (equipment, muscles, type), tracking mode (strength = sets × reps; cardio = minutes; holds and stretches = seconds), sets and one reps value for every set. Plans store **no weight**; weight is entered while logging.
- **Logged workout:** a completed day with timestamp, duration, and per exercise the sets actually done (weight, reps and/or duration). Strength sets store an estimated 10RM (Epley: `1RM = weight × (1 + reps/30)`, `10RM = 1RM / (1 + 10/30)`); each logged exercise keeps `bestTenRM` for PRs and progression.
- **Goal:** a target estimated 1RM for one lift (`exerciseName`, `target`, `pinned`, `createdAt`, `reachedAt`). Any number of lifts can have one; up to 3 are pinned to Progress.
- **Body check-in:** bodyweight (stored in kg, shown in the user's unit) plus optional circumferences in cm.
- **Body goal:** a target for one body measurement (`metric`, `target`, `start`, `createdAt`, `reachedAt`), stored like check-ins. The direction follows from `start`: a target under it aims down. One per measurement.

The exercise catalog is local-only: about 200 exercises written for Trim, plus the user's custom exercises. Search (with gym shorthand like "RDL" or "OHP") and Alternatives work offline.

## Onboarding

Welcome (the device fades in on a dark grid) → Name (optional, printed on receipts) → Units → Days a week → Pick a plan (the free starter templates as cartridge packs, or Build my own) → Pick your skin (free skins, plus Pro ones that preview) → the plan inserts into the device as Plan ready → the guided tour → paywall (template path only, soft). It always ends with a real, active plan. Build my own inserts an empty plan with the chosen number of days, plays the tour, then opens the editor.

**The guided tour (decision 85).** Trim introduces itself on its display (`Hi, I'm Trim.`) and talks the owner through one practice set on the first lifts of their plan: the wheel, the reps keys, Log, the rest timer, Undo, the rocker, swapping a lift in the exercise sheet, and the menu. Each line waits for a tap on the screen or for the control it names, which wears a focus ring; only taught controls respond. Nothing is logged or saved. Skip on the first screen goes straight to the end. Start then launches the device into a spin over Trim's dot-matrix room; it lands with a ripple, `UNLOCKED` stamps on and a skin picker offers 101 Graphite (`NEW`) next to the current skin, with the Pro machines locked. The skin they keep is saved. A tour cut short by quitting the app starts again on the next launch.

## Device and menu

The device is the one persistent screen: a machine in the chosen skin (212 Aluminium, 101 Graphite, 707 Field, 089 Pocket, 077 Bunker, 777 Holo: each a body with its own screen), with a dot-matrix display, a menu key and a top-right key, a rocker, left keys, one wheel and a big round key. It runs Home, logging, rest, finish and setting a plan's numbers. Everything list- or number-heavy is a dark sheet that slides up over it, with the device still visible above. The menu key opens the menu sheet: Plans, Progress, History, Settings, and the Skin Library card (change the device's skin, live). During a workout the menu starts with End workout, and Discard workout under it. There is no tab bar.

- **Home (on the device):** one job, start the next workout. The display lists the plan's days as rows; a day done this week is stamped (orange row, its weekday, minutes and sets, a PR stamp when it set one). The selected day (the next in the plan, or the first unstamped one) is expanded with up to four lifts and their prescription. Tap any row to pick it; a stamped day can be repeated. The week is lamps in the rocker body, one per trainable day, lit green in the order trained (any days, a repeated day counts), with `WEEK n` engraved under it and an orange `▲n` streak from two full weeks. The big key is Start; the top-right key opens History. A full week shows `WEEK DONE` and plays the week report once. With no plans left, the display reads `INSERT PLAN` and the big key opens Plans.
- **Plans:** a rack of shelves, one per plan, each day a cartridge; the active plan is outlined. `+` makes a plan. The editor is a clean list: each day a header over its lifts, each lift with a `sets × reps` chip, `Add lift` under each day and `Add day` at the end. Tapping a chip hides the sheet and the device sets the numbers (keys for sets, the wheel for reps, the rocker between the day's lifts). Lifts are added from the add lifts sheet (search, muscle sections, recents, multi-select, custom exercises). Plans and days are renamed inline; a day's actions sit behind its `…`, the plan's behind the header `…`. Closing the editor files the plan's cartridges onto its shelf. `Use plan` on another plan inserts its cartridge into the device with a click, then shows Home.
- **Progress:** pinned goals first (up to 3, green rings), then each lift as one row with a 30-day sparkline, its estimated 1RM and the change, then body measurements. Long-press a lift to set a goal. Lift detail: the estimated 1RM and its change, the chart on a display panel with the goal as a dashed line, ranges (1M and 3M free; 6M, 1Y and All Pro) and sessions. Body detail and the check-in work the same way, as dark sheets. There is no rank: it needs strength-standards data Trim doesn't have.
- **History:** a wall of receipts grouped by week, each week's header with its lamps. Tap a receipt to print it in full (every lift, sets, volume, estimated max, the PR line; Share). Long-press a receipt to delete it; it asks first, naming the workout.
- **Settings (a sheet from the menu):** Name, Weight (kg/lbs), Sounds, Trim Pro, Restore purchases; links out to Contact support, Privacy Policy, Terms of Use; Clear history. There's no Appearance setting: sheets are always dark and the device's look is its skin.

## Logging

One lift, one set at a time, on the device:

- The display shows the lift's name (tap it for the exercise sheet: figure, muscles, how-to, swap for an alternative, your numbers), `SET n/m` (or `EXTRA SET`), the weight on the drum and `×reps`, and `LAST 80×8` (Pro: `TARGET 87.5×8`).
- The wheel sets the weight in the lift's load steps; a tap on the drum makes the step finer (`±2` → `±1` → `±0.5`), saved per lift, and a long press types a weight; the `+` and `−` keys set reps. The big key is Log.
- The rocker's `‹ ›` move between lifts, and its lamps show each lift done, part-done or current. Its middle opens Today: jump to a lift, reorder, swap, add or remove a lift, or edit a logged set.
- The top-right key is Undo last set: immediate, with an Undo toast.
- After a set, rest runs as a ring on the display: the keys and the wheel add or take 15 s, the big key is Skip. At 0:00 the display blinks `GO` with a haptic and returns to the same next set; nothing else happens.
- A swap is for today only. If the new lift got a set, the receipt asks whether the plan keeps it (Keep in plan / Just today).
- After the last set, or End workout from the menu, the device is in finish mode: hold the big key until the ring closes. The receipt prints out of the device; Done returns to Home with the day stamped.
- A session in progress survives leaving or killing the app, and shows as a Live Activity.

**Next-session targets (Trim Pro).** Double progression on the plan's reps: if last session hit the prescribed reps on every set, the load goes up one step (kg: +2.5 bar, +2 dumbbells, +2.5 machine/cable compounds, +1 isolation; lbs: +5, or +2.5 machine/cable isolation); otherwise the load holds and the set aims for last time's reps + 1, up to the plan. Bodyweight adds a rep, assisted moves remove assistance, holds add 5 s; cardio, stretches, mobility and timers get none. No history means no target, and after a clearly worse session the load holds. Logic: `mobile/src/domain/targets.ts`.

## Trim Pro

Auto-renewable subscription: yearly $39.99 with a 7-day free trial, or monthly $6.99. Adds unlimited plans and switching, Progress beyond 3 months plus body trends, next-session targets, and every skin (212 Aluminium and 101 Graphite are free, Graphite once the guided tour has given it; 707 Field, 089 Pocket, 077 Bunker and 777 Holo are Pro). Logging and history are free. Prices always come from the App Store through RevenueCat.

The paywall appears only at these moments: the end of onboarding (template path), once after the first completed workout (from the receipt's Done), when the user taps a Pro-locked feature, and from Settings → Trim Pro. A locked skin only previews on the device; the paywall opens from the Skin Library sheet's `Get Trim Pro` pill, never from the swatch itself and never during a workout.

## Privacy

Workout data never leaves the iPhone. RevenueCat handles purchases; PostHog (EU) receives anonymous usage events with counts only. See `legal/privacy.html`.
