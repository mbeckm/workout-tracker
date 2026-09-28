# Trim product model

Trim is a plan-first iPhone workout logger ("Trim Workout" on the App Store). The app lives in `mobile/`. Decisions that changed this model are in `PRODUCT-DECISIONS.md`; visual rules are in `.cursor/skills/trim-ui/SKILL.md`.

## Job

Help someone follow a training plan and log a workout without losing focus between sets.

There is no ad-hoc or empty workout. You make a plan, then start a day from it.

## Who and where

Serious lifters, mostly young, training in a gym. They use Trim between sets, under artificial light, at arm's length, often one-handed, with music in their headphones. They open and close it dozens of times a workout and switch to music or messages in between. Trim is built for that moment: instant resume, big numbers, thumb-reach controls, no sound. It must work for people who don't see well (Dynamic Type, contrast, VoiceOver), but it isn't an accessibility-first product.

## Principles

These decide product calls. When a feature, screen or behavior conflicts with one, the principle wins or the principle gets changed here on purpose. Visual rules that follow from them are in `trim-ui`.

1. **Trade Republic for workouts.** Simple, reduced and powerful. The essential things are remarkably easy and fast, and everything else is out of the way. We add by removing.
2. **Fast is the feature.** From launch to the first logged set is two taps (Start, Log set), and a prefilled set is one. A change that adds a tap or a wait to that loop needs an exceptional reason.
3. **One screen, one job, one primary action.** Each screen answers one question. Detail is disclosed progressively: stage → sheet → context menu → Settings. We never overload a screen to save a tap somewhere rare.
4. **The user is in control.** Trim does what the user tells it, and nothing on their behalf. Nobody should ever think "why did it do that?" (see Control below).
5. **The interface explains itself.** No info text, explainer subheadings, summaries, tips or tours. If something needs explaining, we fix the design.
6. **Whitespace is confident.** We don't fill space for the sake of filling it. An empty-looking start is correct, and screens fill with the user's own work.
7. **Motion serves speed, fluidity or joy.** An animation must make Trim feel faster, more fluid or more loveable. If it can't, it doesn't ship. Every touch gets a visible reaction within 100ms, and nothing waits on an animation.
8. **Everything is a sale.** Making money isn't evil, and helping someone decide isn't either. The sale starts at the first tap, not at the paywall, and every interaction is the store clerk. So the product is the salesperson: every detail gets the same care as the paywall, without plastering CTAs anywhere. We borrow the principles of the best-converting apps and never their dark patterns: real prices, a clear trial timeline, an exit that's always visible, no pressure tricks, and always Trim's own look. Buying Pro is itself a rewarding moment. See `trim-ui` → Selling.
9. **A joyful tool for years.** Robust, native and timeless. Joy comes from things working remarkably well, plus a few earned moments that feel special: the first open, the first plan, the first workout, the first purchase, a new record, a full week. Never from confetti or copy.

### Control

The test: **could the user have predicted this before they tapped?** If not, Trim doesn't do it.

- **Explicit state changes.** Which plan is active changes only when the user picks it (Use this plan, or choosing a plan in onboarding). Creating, editing, duplicating or deleting a plan never changes which plan is active. Deleting the active plan leaves no active plan until the user picks one.
- **No data changes on the user's behalf.** Nothing is deleted, archived, overwritten or merged without an explicit action. The only silent discard allowed is a draft that holds no input (an untitled plan with no exercises).
- **Prefill proposes, the user commits.** Last time's weights and reps prefill the wells, and targets are suggestions. Nothing is logged, finished or skipped until the user taps.
- **Carry-forward is limited to the obvious next step.** After Log set, Trim may move to the next set, or to the next unfinished exercise when this one is complete, because that's the visible, expected result of the tap and one tap undoes it. It never leaves the screen, finishes a workout or changes stored data by itself.
- **Timers inform, they don't act.** Rest reaching 0:00 signals (haptic, `Go`). It doesn't log, advance or start anything.
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
- **Body check-in:** bodyweight (stored in kg, shown in the user's unit) plus optional circumferences in cm.

The exercise catalog is local-only: about 200 exercises written for Trim, plus the user's custom exercises. Search (with gym shorthand like "RDL" or "OHP") and Alternatives work offline.

## Onboarding

Welcome → Units → Days a week → Pick a plan (free starter templates, or Build my own) → Plan ready → paywall (template path only, soft). It always ends with a real, active plan.

## Tabs

**Workout, Plans, Progress, History, Settings.**

- **Workout (Home):** the next day as the title with its estimated time, its exercises with prescription and last working weight (`4 × 8 reps at 60 kg`), a black Start (Resume while a session is open), the week amount (`3 of 5 this week` + dots, which celebrate a newly finished day), then Other days with a check for days done this week. Tapping a day opens a preview sheet.
- **Plans:** the active plan and other plans. Plan editor: name, days, add day. Day editor: pick exercises, then sets and reps (or duration).
- **Progress:** each tracked lift with a sparkline; lift detail shows the estimated 1RM chart and sessions. Free sees the last 3 months; 6M, YTD and All are Pro. Body check-ins (native sheet); trends over time are Pro.
- **History:** sessions by month, PR badge per session. Session detail lists every set on its own row, with a crown on the PR set. Long-press or detail to delete.
- **Settings:** Weight (kg/lbs), Appearance (System/Light/Dark), Trim Pro, Restore purchases; links out to Contact support, Privacy Policy, Terms of Use; Clear history.

## Logging

One exercise, one set at a time:

- Exercise strip across the top; finished exercises get a green check.
- Exercise name, then `Set n of m` and `Last time 60 kg × 8` (Pro: `Target 62.5 kg × 8 · Last time 60 kg × 8`).
- Two wells (weight, reps): tap the number to type, −/+ for small steps. Green `Log set` at the thumb.
- Logged sets grow below as checked lines; a rest timer starts after each set.
- Logging the last set of an exercise shows `Done` with `Last time 4 sets · best 60 kg × 10` and moves on with `Next exercise`.
- Finish (or finish with sets left) leads to Done: facts line and every set as its own row, then Home.
- A session in progress survives leaving or killing the app, and shows as a Live Activity.

**Next-session targets (Trim Pro).** Double progression on the plan's reps: if last session hit the prescribed reps on every set, the load goes up one step (kg: +2.5 bar, +2 dumbbells, +2.5 machine/cable compounds, +1 isolation; lbs: +5, or +2.5 machine/cable isolation); otherwise the load holds and the set aims for last time's reps + 1, up to the plan. Bodyweight adds a rep, assisted moves remove assistance, holds add 5 s; cardio, stretches, mobility and timers get none. No history means no target, and after a clearly worse session the load holds. Logic: `mobile/src/domain/targets.ts`.

## Trim Pro

Auto-renewable subscription: yearly $39.99 with a 7-day free trial, or monthly $6.99. Adds unlimited plans and switching, Progress beyond 3 months plus body trends, and next-session targets. Logging and history are free. Prices always come from the App Store through RevenueCat.

The paywall appears only at these moments: the end of onboarding (template path), once after the first completed workout, when the user taps a Pro-locked feature, and from Settings → Trim Pro.

## Privacy

Workout data never leaves the iPhone. RevenueCat handles purchases; PostHog (EU) receives anonymous usage events with counts only. See `legal/privacy.html`.
