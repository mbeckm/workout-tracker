# Scratch Product Context

Trim is a plan-first iPhone workout logger. (Project was Scratch; App Store name is Trim Workout.) The active app is `mobile/` (Expo). `ScratchWorkout/` is a logic oracle only.

## Job

Help someone follow a training plan and log a workout without losing focus between sets.

There is no ad-hoc / empty workout. You create a plan, then start a day from that plan.

## Data model

```
Plan
  └── Day[]          (Lower A, Upper, …)
        └── Exercise[]
```

**Plan** — named program the user is following (`id`, `name`, `daysPerWeek`, `days`). One plan is active at a time.

**Day** — one session in the plan (`id`, `title`, `exercises`).

**Exercise (prescription)** — what to do that day:

- Name and catalog metadata (equipment, muscles, type). No exercise media in 1.0: rows lead with the name.
- Tracking mode: strength is sets + reps; cardio is usually minutes; holds/stretches are duration
- Plan building does **not** include weight. Weight is entered while logging.

**Logged workout** — a completed day: timestamp, duration, and for each exercise the sets actually done (weight, reps, and/or duration). Strength sets store estimated 10RM using Epley (`1RM = weight × (1 + reps/30)`, then `10RM = 1RM / (1 + 10/30)`). Each logged exercise keeps `bestTenRM` — the session KPI for progression.

The catalog is local-only: about 200 exercises written by Trim, bundled in the app, plus the user's custom exercises. Browse, search (with gym shorthand like "RDL" or "OHP") and Alternatives all work offline, and the app contacts no exercise database or image server. ExerciseDB is available only in development builds behind flags; licensed media or search can return in an update behind the same switch (`mobile/src/catalog/config.ts`).

## Navigation

Tabs: **Workout**, **Plans**, **History**, **Settings**.

- **Workout (home):** Active plan. Plan name, next-workout cluster (day name, exercise list, Start), then the full day list. Start in the cluster begins that day. Tapping a list day opens a preview sheet. Empty state prompts creating a plan.
- **Plans:** create and edit plans. Search/select exercises, then set **sets** and **reps per set** (one reps value for every set). Duration work uses minutes or seconds instead of reps. No per-set rows, no GIFs, and no weights on this screen.
- **History:** completed sessions.
- **Settings:** units, restore purchases.

## Logging

Alpha Progression-style, one exercise at a time:

- Strip at the top of remaining / finished exercises for that day
- Exercise name + set table (`#`, weight, reps, 10RM)
- Active set is obvious; completed sets are checked; later sets stay dim
- Previous session for that exercise under the table, including 10RM
- Logging the last set advances to the next exercise
- Finished exercises are marked in the strip
- Haptic when a set is logged; rest timer after a set

**Next-session targets (Trim Pro).** For each set, Trim suggests what to lift today from last time, by double progression on the plan's reps: if last session hit the prescribed reps on every set, the load goes up one step (kg: +2.5 on a bar, +2 on dumbbells, +2.5 machine/cable compounds, +1 isolation; lbs: +5, or +2.5 for machine/cable isolation); otherwise the load holds and the set aims for last time's reps + 1, up to the plan. Bodyweight moves add a rep, assisted moves remove assistance, holds add 5 s; cardio, stretches, mobility and timers get none. No history means no target, and after a clearly worse session (a bad day or deload) the load holds. Pro sees `Target 87.5 × 8 · Last time 85 × 8` under `Set n of m` with the target in the wells; free keeps `Last time` with a quiet `Target ›` that opens the paywall. Logic lives in `mobile/src/domain/targets.ts`.

## Visual system

Light iOS, system font, system blue. 1.0 UI source of truth is `references/1.0/`, not Figma and not the Swift visual system.
