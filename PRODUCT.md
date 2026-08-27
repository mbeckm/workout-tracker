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

- Name and catalog metadata (equipment, muscles, type, thumbnail when available)
- Tracking mode: strength is sets + reps; cardio is usually minutes; holds/stretches are duration
- Plan building does **not** include weight. Weight is entered while logging.

**Logged workout** — a completed day: timestamp, duration, and for each exercise the sets actually done (weight, reps, and/or duration). Strength sets store estimated 10RM using Epley (`1RM = weight × (1 + reps/30)`, then `10RM = 1RM / (1 + 10/30)`). Each logged exercise keeps `bestTenRM` — the session KPI for progression.

The catalog is hybrid: bundled seed + custom exercises for empty/offline search, and ExerciseDB only when the user types a query (results are ranked and cached with the local matches). Expo Go may use the non-commercial OSS host (`oss.exercisedb.dev`). A store build must set `EXPO_PUBLIC_EXERCISEDB_RAPIDAPI_KEY` before submit so production never depends on OSS. ExerciseDB is never the only catalog — seed + custom still work offline.

## Navigation

Tabs: **Workout**, **Plans**, **History**, **Settings**.

- **Workout (home):** Active plan. Plan name, next-workout cluster (day name, stills, Start), then the full day list. Start in the cluster begins that day. Tapping a list day opens a preview sheet. Empty state prompts creating a plan.
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

## Visual system

Light iOS, system font, system blue. 1.0 UI source of truth is `references/1.0/`, not Figma and not the Swift visual system.
