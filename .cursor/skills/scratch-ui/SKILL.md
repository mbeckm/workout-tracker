---
name: scratch-ui
description: Visual grammar for Scratch screens. Use when designing or implementing Home, Plans, History, Settings, log, drawers, Done, onboarding, or paywall — or when visually QA'ing mobile/ against Paper.
---

# Scratch UI

Do not copy the log layout onto other screens. Copy these rules. The log is the oracle because it is the hardest screen, not because every tab should look like a gym loop.

**Paper:** Exploration SoT for Home / Plans / Log / History lives on the **Deliberate empty** page in [Scratch workout new](https://app.paper.design/file/01M0FJ7CD2XE6GM8BGDAPR9QP5). Family loop (`5-0`) remains the reference for sheets and older boards until those artboards are replaced. Do not ship `mobile/` from critique screenshots alone — Paper first, then code.

**Product** stays `PRODUCT.md`. **Logic** stays `ScratchWorkout/`. Not `references/1.0/`, not Hevy/Strong/Alpha Progression screenshots, not Swift Inter/lime.

---

## Philosophy: deliberate empty

North star: **strong hierarchy + strong alignment + meaningful information + lots of nothing.**

The app does not need more UI. Emptiness is fine when the few things on screen form one composition. Emptiness feels like a prototype when chunks compete or float without a clear subject.

### Screen jobs (one sentence each)

| Screen | Job |
| --- | --- |
| Home | What is next, and start it — plus how much of the week is done. |
| Plans | Which plan is active, and what other plans exist. |
| Log | What this set needs right now. |
| History | What I finished. |
| Settings | Change units / Pro / data. |

If a control or label does not serve that job, cut it.

### Composition rules (concrete)

1. **One winner.** Tab title (28) names the room. The subject underneath owns the stage (day ~40, plan name, exercise ~34). Tab + subject at different scales is correct — do not pit two display-size titles against each other.
2. **One grid.** Same left and right margin (~24). Almost everything aligns to it. Do not mix a left-aligned header with a centered mid-screen island unless the break is deliberate (thumb CTA is allowed to be full-width in the margin).
3. **Objects, not floaters.** Related items share one surface or one tight rhythm so they read as a unit (exercise list, active plan row, logged sets). Do not scatter stills/names in a cavernous field. A grouped surface may use **16px inner padding** so text sits at 40 — that inset is the object’s padding, not a second grid.
4. **Layout speaks first.** Prominence and position carry status. Do not add a section eyebrow that only names hierarchy already shown by layout (`ACTIVE PLAN`, `YOUR PLANS`, `SET PROGRESS`, `PREVIOUS SETS`).
5. **Eyebrow test.** Keep a caption only if it carries a **fact** (`Today`, month name, `Rest`, personal best, `this week` next to `2 of 4`). Drop it if it only explains the layout.
6. **Progress is amount, not sequence.** Week progress answers “how much this week?” (`n of m` + dots). Do not imply Day 1 → Day 2 → Day 3 order. No day-name checklist as the default week UI.
7. **Scan with marks.** Prefer a small number of scannable marks (dots, a check) over long status sentences. One progress language per section — not ring + bar + dots + copy saying the same thing. **Completed week dots are green** (`#34C759`); waiting dots stay grey (`#E5E5EA`).
8. **Fill by use.** Sparse at the start of a workout is correct. Completed work grows into the air (checked set lines). Do not invent chrome to make set 1 look “designed.”
9. **Facts over decoration.** Prefer last time, exercise count, duration, `Active` — over icons that encode nothing, motivational copy, or plan thumbnails.
10. **Strip once.** After the first pass, remove leftover eyebrows, cards, and helper copy. If hierarchy collapses, restore it with type and spacing — not a new label.
11. **Truncation is a peer row.** When a list is truncated, the overflow control is a **full list row** on the same lanes (`n more exercise(s)` 17 on the text lane, chevron down trailing; no leading tile) — not a floating `+n more` caption. Tap expands **in place**; expanded state ends with Show less (chevron up). Do not open a sheet just to reveal the rest of the Home list.
12. **Type to jump, tap ± to nudge.** On log wells, **tap the number → system keyboard → type** is the path for large jumps and first entry. −/+ are only for small gym adjustments (e.g. +2.5). Never rely on steppers alone for 0→100 or 100→66.
13. **Keyboard docks the cluster.** Opening the keyboard must not push the whole screen or hide `Log set`. Only footer air shrinks; wells + `Log set` stay docked above the keyboard; the upper stage (exercise / set / last time / residue) stays pinned.

### Allowed vs banned chrome

| Allowed | Banned |
| --- | --- |
| One progress mark language (dots on Home week) | Triple progress widgets + motivational line |
| Check next to a completed name / set; green `Active` on Plans | Status pills, badges, tables of status |
| Black primary CTA on Home; green only for gym complete actions | Green titles; second green control on the same stage |
| Light list surface (`#F2F2F7`) with 16px inset when it makes a **unit** | Card + border + shadow + chevron on every Plans row |
| Expand/collapse chevron on the truncation / Show less row only | Chevron on every list row “because lists have chevrons” |
| Full-lane `n more exercise(s)` row | Floating `+n more` that doesn’t match row rhythm |
| Context menu / swipe for rename-delete | Permanent edit chrome on every Plans row |

### Iteration checklist (before shipping a screen)

1. Say the screen job in one sentence.
2. Circle the one visual winner.
3. Confirm every label passes the eyebrow test.
4. Squint: do related pieces read as one object? Is empty space a pause after a group, or a hole between chunks?
5. Strip once.
6. Fail if it matches Hevy/Strong/AP chrome more than Scratch Paper.

---

## Voices

One of each on a screen. Never two heroes.

| Role | Size / weight | Color | Job |
| --- | --- | --- | --- |
| Hero | 64px bold | black | The one thing on a **stage** screen (log exercise can share this role; set count must not) |
| Display | 34–40px bold | black | Subject under a tab title (Home day ~40; log exercise ~34) |
| Tab title | 28px bold | black | Room name: `Next Workout`, `Plans`, `History`, `Settings` |
| Title | 22px bold | black | Quiet status (`Set n of m`), active plan name, week `n of m` |
| Residue / second | 28px medium | black → `#3C3C43` → `#8E8E93` | Logged weights×reps, quiet numbers |
| Row | 17px | black or `#8E8E93` | List items |
| Caption | 15px | `#8E8E93` | Fact labels, meta under a name |
| Meta | 13px | `#8E8E93` | `4 × 8 reps`, duration |

Air belongs to the subject. Thumb actions stay at the bottom on tool screens. Density lives in sheets, not on the stage.

## Ink

- **Black** (light) / **white** (dark) = here, primary type, Home Start (Start is black-on-white in light, white-on-black in dark — inverted ink CTA).
- **Grey** = not yet, captions, waiting rows.
- **Green `#34C759` light / `#30D158` dark** = completed work and the one gym CTA (`Log set`, `Finish`, `Done`, checks). Never green titles. Never a second green control on the same stage.
- **Active plan** uses type + check / `Active` — not a vague `On` alone if the word is ambiguous.
- **Appearance** (Settings): System / Light / Dark. Paper dark drafts live on the **Dark mode** page. Default preference is System.

## Units

Every load carries its unit where it is shown: `60 kg × 8`, `Last time 72.5 kg × 8`, `Target 87.5 kg × 8`. Prescriptions say what the number is: `4 × 8 reps`, `3 × 30s`. (Replaces the old unit-once rule, G-9.)

## Toast

`showToast({ title })` (`components/toast.tsx`) confirms an action whose result isn't on screen yet — a sheet that just closed. Inverted ink pill with a green check, above the tab bar, ~2s, tap to dismiss; enter 240ms ease-out rise, reduced motion = fade. One at a time. Never for errors, never for something the screen already shows.

## Do not

Tables, set-number circles, overlapping pills, 10RM as chrome, heatmap, achievement chrome, calculator-sized `80 × 8` as the hero, custom page transitions, lime/Inter from the Swift prototype, hierarchy-only eyebrows, motivational progress copy, decorative plan icons.

---

## Per screen

Same voices. Different winner. Do not invent a new type scale.

| Screen | Winner | Structure | The one green |
| --- | --- | --- | --- |
| Home | Day name (under `Next Workout` 28) | Identity: day title + meta only (`n exercises · ~Xm`) — no focus/region subtitle. Exercise list as **one object** on its 16 inset: name 17 + prescription meta 15, no thumbnail column (1.0 ships no exercise media; an initials tile never wins). Truncate after ~4 rows with a **full list row**: `n more exercise(s)` 17 on the text lane + chevron down trailing — same lanes as exercise rows. Tap expands in place (show all + Show less, chevron up). Black Start sits with the list (tighter than the week). Week = **amount** (`n of m` + dots; **completed dots are green**), with clear air above the tab bar. Tap list/day → preview, not log. | Completed week dots + checks only. |
| Log | Exercise name | Strip; quiet `Set n of m`; **Last time** as the target; checked set lines grow below (no Previous Sets card). Wells: **tap the number → system keyboard → type** (primary path for big jumps / first set of a new exercise). −/+ only for small gym adjustments (e.g. +2.5). Focused well: white fill + 2px black ring. Green `Log set` at thumb. Frame must not jump as sets appear. | `Log set` (+ checks) |
| Done | `Done` 64 + check | Day 15; air; duration / sets 28; recap = exercise name 17, then **one 15 row per set** (set number in a narrow tertiary lane + `60 kg × 8`; crown on the PR set), shared with Session detail (`RecapExercise`); green Done at thumb | Check + Done |
| Plans | Tab title 28 | Active plan as **one prominent row/card** (name + day count + ✓ Active). Other plans quieter name + count. Tap → detail. No plan icons. No permanent rename/delete on rows. | `Active` check/label only |
| Plan detail | Plan name (40) | `n days` (+ green Active); days as title + 2-line `·` exercise names; empty = Add exercises; Add day quiet; Use/Delete later | Active only |
| History | Tab title 28 | Month caption is amount (`August · 4 sessions`). Session row = title 17 + meta 15 (`{when} · {n} exercises · {duration}`) on the left — `when` is `Today` / `Yesterday` / `Wed 13` under the month (no repeated month name). Quiet hairline between sessions in a month; air between months. When the session has PRs, a quiet grey pill on the right (vertically centered): yellow crown · count · `PR`/`PRs`. Empty = `No completed workouts yet.` Long-press deletes. Tap → session detail. | Yellow crown for PRs only |
| Session detail | Workout title (40) | A **record**, not a Done ceremony. Back; one facts line (`{when} · {duration} · {n} exercises · {n} sets`); exercises as name 17 + one 15 line per set (tabular). Yellow crown next to the set that beat a prior session’s 10RM. No green, no Done button — `workout-complete` keeps that job. | Yellow crown on PR set |
| Home preview | Sheet | Name 17 + `n × reps` 15 per row, no thumbnail; rows are read-only (no exercise sheet); Start black starts that day | None |
| Home empty | `Plan` 56 | Caption; black Create plan | None |
| Settings | Tab title 28 | 17 rows in groups separated by air: preferences (Weight, Appearance) · Pro (Trim Pro, Restore) · **links out** (Contact support, Privacy Policy, Terms of Use: link role + trailing `arrow.up.right`, never a value) · Clear history red | None |
| Paywall | Headline (34) | One headline, **no subheading**. Benefit rows = 36pt SF Symbol tile + title 17 semibold + one detail line 15 (≤ ~45 chars). Plan options, then the trial timeline (glyph nodes: ink `lock.open.fill` today, grey `creditcard.fill` on the charge day) — all above the fold on a 6.3" phone. `Not now` top right on a solid band (hairline once content scrolls under). Black CTA + price note in the footer; Restore · Terms · Privacy under it. | None |
| Body check-in | Sheet title 17 | Native `formSheet` route: Cancel · Check in · Save in one header row (Save disabled until a value), fields scroll with the keyboard inset, Next / Done in a native input accessory. Save closes the sheet and shows the toast `Check-in saved`. | Green dot on fields that will save |
| Exercises / Prescribe / Onboarding / Units | Unchanged intent from product | Keep sparse; black Continue / Add; green only where already specified | As before |

---

## Log stage (do not let the frame jump)

The exercise (or quiet set status) must not recenter when residue appears.

1. Pin the upper stage from the top. Tabular numbers. Glyphs may crossfade; the frame does not move.
2. Completed sets are simple checked lines that grow downward into air — not a labeled card. Prefer newest-relevant order consistent with Paper.
3. Footer is `flex-end`: wells + `Log set` stay on the thumb. Rest inserts above the wells and eats leftover air — never the exercise title.

## Log keyboard

Do not push the whole screen up. Do not build a custom gym keypad.

Tap a well → system `decimal-pad` (kg) or `number-pad` (reps). Optional −/+ adjust by small steps; large jumps are typed. The **control cluster** (wells + `Log set`, and Rest if showing) docks to the keyboard — Paper: **Log keyboard** on Deliberate empty. Focused well: white fill, 2px black ring; the other well may go tertiary. Air between residue and footer shrinks first; the exercise / set / last time block does not move.

Drive docking with `react-native-keyboard-controller` on the footer only (`translateY` from `useReanimatedKeyboardAnimation`).

**Motion** (log set only): new row opacity 0→1 + `translateY` −8→0, 200ms, ease-out `0.23, 1, 0.32, 1`. Do not animate set-status position. Do not `scale(0)`. Reduced motion: opacity only. One haptic (`impactLight`) with the row.

### Paper artboards (Deliberate empty `A-0`)

Ship against these, not Family loop Home / old clipboard:

| Artboard | Use |
| --- | --- |
| Home | Collapsed list + week dots |
| Home expanded | Full list + Show less |
| Plans | Active object + quiet rows (`n days`) |
| Plan detail | Name 40 + `n days` · Active; day title + exercise names |
| Log / Log start | Mid-workout vs empty residue |
| Log type | Focused well, typed value |
| Log keyboard | Cluster docked above keyboard; `Log set` visible |
| History | Month · count; session rows; newest may show exercise names |
| History detail | Day 40 + facts + set lines; no green Done |

## QA

Screenshot the target next to the current Paper artboard for that screen. Fail if:

1. More than one competing hero on a stage.
2. Green used for chrome, titles, or a second CTA.
3. Status is a pill / badge / table instead of type + optional mark/check.
4. Hierarchy-only eyebrows or motivational filler.
5. Primary action not in the thumb cluster on a tool screen.
6. Matches Hevy, Strong, or Alpha Progression more than Scratch Paper.
7. On log: the upper stage jumps between set 1, rest, later sets, or keyboard open.
8. Keyboard covers the wells or `Log set`.
