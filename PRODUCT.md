# Trim product model

Trim is a plan-first iPhone workout logger ("Trim Workout" on the App Store). The app lives in `mobile/`. Decisions that changed this model are in `PRODUCT-DECISIONS.md`; visual rules are in `.cursor/skills/trim-ui/SKILL.md`.

## Job

Help someone follow a training plan and log a workout without losing focus between sets.

There is no ad-hoc or empty workout. You make a plan, then start a day from it.

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

- **Workout (Home):** `Next Workout` and the next day (name, plan · exercise count · time estimate), its exercises with prescription and last working weight (`4 × 8 reps · 60 kg`), a black Start (Resume while a session is open), the week amount (`3 of 5 this week` + dots, which celebrate a newly finished day), then Other days with a check for days done this week. Tapping a day opens a preview sheet.
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

## Privacy

Workout data never leaves the iPhone. RevenueCat handles purchases; PostHog (EU) receives anonymous usage events with counts only. See `legal/privacy.html`.
