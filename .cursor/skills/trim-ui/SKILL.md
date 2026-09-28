---
name: trim-ui
description: Visual grammar for Trim screens. Use when designing or implementing Home, Plans, History, Settings, log, drawers, Done, onboarding, or paywall — or when visually QA'ing mobile/ against Paper.
---

# Trim UI

Do not copy the log layout onto other screens. Copy these rules. The log is the oracle because it is the hardest screen, not because every tab should look like a gym loop.

**Paper:** Exploration SoT for Home / Plans / Log / History lives on the **Deliberate empty** page in the Paper file [Scratch workout new](https://app.paper.design/file/01M0FJ7CD2XE6GM8BGDAPR9QP5) (Trim’s design file; the name predates the rename). App icon artwork: Paper file “Trim Logo”. Family loop (`5-0`) remains the reference for sheets and older boards until those artboards are replaced. Do not ship `mobile/` from critique screenshots alone — Paper first, then code.

**Product** stays `PRODUCT.md`; decisions that changed the model live in `PRODUCT-DECISIONS.md`. Not Hevy/Strong/Alpha Progression screenshots.

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

1. **One winner.** Tab title (28) names the room. The subject underneath owns the stage (day ~40, plan name, exercise ~34). Tab + subject at different scales is correct — do not pit two display-size titles against each other. **Home is the exception:** it has no room name at all. The day name sits where the other tabs' titles sit and is the only hero; no label above it either (two stacked bold titles read as competition, and a small eyebrow over the app's biggest type read as a stray heading). VoiceOver still hears `Next workout, Push`.
2. **One grid.** Same left and right margin (~24). Almost everything aligns to it. Do not mix a left-aligned header with a centered mid-screen island unless the break is deliberate (thumb CTA is allowed to be full-width in the margin).
3. **Objects, not floaters.** Related items share one surface or one tight rhythm so they read as a unit (exercise list, active plan row, logged sets). Do not scatter stills/names in a cavernous field. A grouped surface may use **16px inner padding** so text sits at 40 — that inset is the object’s padding, not a second grid.
4. **Layout speaks first.** Prominence and position carry status. Do not add a section eyebrow that only names hierarchy already shown by layout (`ACTIVE PLAN`, `YOUR PLANS`, `SET PROGRESS`, `PREVIOUS SETS`).
5. **Eyebrow test.** Keep a caption only if it carries a **fact** (`Today`, month name, `Rest`, personal best, `this week` next to `2 of 4`). Drop it if it only explains the layout.
6. **Progress is amount, not sequence.** Week progress answers “how much this week?” (`n of m` + dots). Do not imply Day 1 → Day 2 → Day 3 order. No day-name checklist as the default week UI.
7. **Scan with marks.** Prefer a small number of scannable marks (dots, a check) over long status sentences. One progress language per section — not ring + bar + dots + copy saying the same thing. **Completed week dots are green** (`#34C759`); waiting dots stay grey (`#E5E5EA`).
8. **Fill by use.** Sparse at the start of a workout is correct. Completed work grows into the air (checked set lines). Do not invent chrome to make set 1 look “designed.”
9. **Facts over decoration.** Prefer last time, exercise count, duration, `Active` — over icons that encode nothing, motivational copy, or plan thumbnails. A fact's own noun already says what it is (`6 exercises`, `~45 min`), so meta rows carry no icons; the one exception is the yellow PR crown, which marks a result (see **Meta row**). Never reuse a tab bar glyph (`dumbbell`, `list.bullet`, `clock`, …) for something else on screen.
10. **Strip once.** After the first pass, remove leftover eyebrows, cards, and helper copy. If hierarchy collapses, restore it with type and spacing — not a new label.
11. **Truncation is a peer row.** When a list is truncated, the overflow control is a **full list row** on the same lanes (`n more exercise(s)` 17 on the text lane, chevron down trailing; no leading tile) — not a floating `+n more` caption. Tap expands **in place**; expanded state ends with Show less (chevron up). **Never truncate a plan:** Home's next workout always lists every exercise (a cut list read as an incomplete plan, G1); truncation is for long browse lists (Progress lifts).
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
| Meta row: one grey 15 line, semibold numbers, `·` between facts | Ink numbers in one meta row and grey in the next; icons in meta (they doubled the tab bar); filled icon chips / stat pills for meta |
| Full-lane `n more …` row on long browse lists | Floating `+n more` that doesn’t match row rhythm; truncating a plan's exercises |
| List header 17 semibold ink over 17 regular rows (`Other days`) | Small grey eyebrow over a title, or a section header styled like a fact caption |
| Context menu / swipe for rename-delete | Permanent edit chrome on every Plans row |

### Iteration checklist (before shipping a screen)

1. Say the screen job in one sentence.
2. Circle the one visual winner.
3. Confirm every label passes the eyebrow test.
4. Squint: do related pieces read as one object? Is empty space a pause after a group, or a hole between chunks?
5. Strip once.
6. Fail if it matches Hevy/Strong/AP chrome more than the Trim Paper file.

---

## Voices

One of each on a screen. Never two heroes.

| Role | Size / weight | Color | Job |
| --- | --- | --- | --- |
| Hero | 64px bold | black | The one thing on a **stage** screen (log exercise can share this role; set count must not) |
| Display | 34–40px bold | black | Subject under a tab title (Home day ~40; log exercise ~34) |
| Tab title | 28px bold | black | Room name: `Plans`, `History`, `Settings` (Home has none: the day name takes its place) |
| Title | 22px bold | black | Quiet status (`Set n of m`), active plan name, week `n of m` |
| Residue / second | 28px medium | black → `#3C3C43` → `#8E8E93` | Logged weights×reps, quiet numbers |
| Row | 17px | black or `#8E8E93` | List items |
| Caption | 15px | `#8E8E93` | Fact labels, content lines under a name (exercise names) |
| Meta row | 15px | all grey (`tertiaryLabel`): numbers 600, words 400; no icons | Facts under a title: `MetaRow` (see **Meta row**) |
| Meta | 13px | `#8E8E93` | Rare small print only |

Air belongs to the subject. Thumb actions stay at the bottom on tool screens. Density lives in sheets, not on the stage.

## Ink

- **Black** (light) / **white** (dark) = here, primary type, Home Start (Start is black-on-white in light, white-on-black in dark — inverted ink CTA).
- **Grey** = not yet, captions, waiting rows.
- **Green `#34C759` light / `#30D158` dark** = completed work and the one gym CTA (`Log set`, `Finish`, `Done`, checks). Never green titles. Never a second green control on the same stage.
- **Active plan** uses type + check / `Active` — not a vague `On` alone if the word is ambiguous.
- **Appearance** (Settings): System / Light / Dark. Paper dark drafts live on the **Dark mode** page. Default preference is System.

## Units

Every load carries its unit where it is shown: `60 kg × 8`, `Last time 72.5 kg × 8`, `Target 87.5 kg × 8`. Prescriptions say what the number is: `4 × 8 reps`, `3 × 30s`; on Home and the day preview they add the last working weight from history: `4 × 8 reps · 15 kg` (plans store no weights). A finished exercise on the log stage reads one fact: `Last time 4 sets · best 15 kg × 10`. (Replaces the old unit-once rule, G-9.)

## Meta row

Facts about a workout (how many, how long, when) are a **meta row**: `components/meta-row.tsx` (`MetaRow` + the `meta.*` item builders). Use the builders so one kind of fact is always worded the same way. Round 3 (G3/G4, 2026-09-28): one grey, no icons, the same everywhere.

- **One color, everywhere.** The whole row is `tertiaryLabel` grey, 15, tabular, in every place it appears (Home hero, Other days, preview, History, Session detail, Done, Weeks). The **number** is semibold 600 so the eye still picks it up; the rest is regular 400: `6 exercises · ~45 min`. **Words** (a day, a plan name, the Done day title) have no number and stay regular. No ink numbers: ink in one row and grey in the next read as incoherent, and the title above is what carries ink.
- **No icons.** The noun already names the fact, and the old glyphs (`dumbbell`, `clock`, `list.bullet`) were the tab bar's own icons with other meanings (Workout, History, Plans), repeated down every History row. The one symbol left is the yellow `crown.fill` before `3 PRs`: it marks a result, not a kind of fact.
- **Row**: facts joined by ` · ` in the same grey. Wraps as whole items (the dot hangs at the end of a line, never starts one; 2 between lines); a fact never truncates mid-fact. No fills, no pills.
- **Vocabulary**: `6 exercises` · duration (plan estimate `~45 min`, logged `45 min`) · sets (`12 sets`, `4 of 18 sets` while open) · a day (`Wed 13`, `Done Thu 17`, `Done today`) · `Started 18:02` · plan name (Home's next workout) · yellow crown `3 PRs` · a leading name (Done: the day title) · Weeks: `Goal 5 a week`, `Average 3.1` (one decimal, point separator).
- **Type size**: grows with Dynamic Type up to 1.8× (lower tiers pass a smaller cap, e.g. Other days 1.35×); beyond that it stops so meta never outweighs its title.
- **Accessibility**: one element reading the facts in order (`6 exercises, About 45 minutes, Plan Push Pull Legs`); a row that already reads them passes its own label.
- **Where**: Home day, Home Other days, Home preview, Weeks summary, History rows, Session detail, Done. Not for content lines (exercise names on Plan detail), per-row prescriptions (`4 × 8 reps · 60 kg`, same grey, regular), or single-fact captions (Plans `n days`, Progress rows).

## Home: week and other days

- **Week celebration.** While Home is covered (log, Done, paywall) the week amount keeps its old value. When Home is visible again (~320ms, after the modal leaves) the new dot fills with a springy pop (0.5 → 1, dampingRatio 0.42) and two soft green rings (scale ×3.4, opacity 0.45 → 0, 760ms, 140ms apart), and the count rolls up with NumberFlow. A completed week adds a staggered bump across all dots. Reduced motion: color crossfade only. No extra haptic (Finish already has the success tap).
- **Week amount (secondary).** `n of m` 20 semibold (not the 22 bold Title voice) + `this week` 15 grey, dots below, trailing grey `chevron.right`. The whole row is one button (pressed: opacity 0.6) that opens **Weeks**; VoiceOver: `3 of 5 this week`, hint `Shows past weeks`.
- **Next workout (G1/G2/G6).** No label above the day title: the title sits at the tab-title position (`insets.top + 28`) and is the page's name. Its meta row ends with the **plan name** (always, when the plan has one): `6 exercises · ~45 min · Push Pull Legs`, or `Started 18:02 · 4 of 18 sets · Push Pull Legs` while open. That's the quiet, always-there answer to "which plan am I on?"; it's grey words at the end, so it never competes with the counts. The list shows **every** exercise; there is no `n more` row on Home.
- **Other days.** A real list header: `Other days` 17 semibold ink (capped 1.35× like the rows), not a grey caption, so it names the section instead of looking like a fact. Row = day title 17 regular (not the list's medium: this is the third tier) + the meta row: `5 exercises · ~45 min`, or `3 exercises · Done Fri 25` for a day done this week. Not the exercise names: those were the noisiest line on Home (long, grey, cut off); the preview lists them one tap away. A day done this week steps back: grey title + trailing green check.
- **Rhythm (F2).** Day title → meta row 6 → list 20 → Start 12: the next workout is one object. Then an unmistakable pause (64) before the week, then 40 before Other days. Proximity groups; no eyebrows added.

## Weeks (F6)

Home's week amount, back in time. A native `formSheet` (`/weeks`, detents 0.7 / 1, grouped background like Check in): one header row (`Weeks` 17 semibold centered, `Done` right; header text capped at 1.3× like a nav bar) + one ScrollView.

- **Summary**: meta row `Goal 5 a week · Average 3.1` (average of the finished weeks shown; hidden when there are none).
- **Rows**, newest first, last 8 Monday-based weeks: label 17 (`This week`, `Last week`, `Sep 7 – 13`, `Aug 31 – Sep 6`) + Home's dots on the right: a green dot per workout up to the goal, grey (`systemGray4` on the grouped sheet) for the rest. A week that met the goal is a full green row; nothing else marks it. Hairlines between rows.
- **Counting**: this week is exactly Home's number (distinct days of the active plan). Past weeks count every finished workout from any plan, capped at the current goal. Weeks before the first workout ever are hidden.
- No streaks, badges, heatmap, bars or drill-down. Free.

## Toast

`showToast({ title })` (`components/toast.tsx`) confirms an action whose result isn't on screen yet — a sheet or editor that just closed. Inverted ink pill with a green check, above the tab bar inside the 24 margin (wraps at large type), ~2s, tap to dismiss; enter 240ms ease-out rise, reduced motion = fade. One at a time. Never for errors, never for something the screen already shows. Copy is `<Thing> <past participle>`: `Check-in saved`, `Plan created`.

## Plan created

A new plan is confirmed where it lands, not with a finish screen (the editor already shows the whole plan; a ceremony would repeat it). `navigation/plan-created.ts` does it once for every way out of a new plan that has exercises (Done, Back, edge swipe; not Delete):

- **Done** fires one success haptic with the press, then closes the editor: the active plan lands on Home (next day + Start is the next step), any other plan back on Plans.
- **Toast** `Plan created` rises ~320ms later (same beat as Home's week celebration), so it lands on the destination, not on the editor sliding away. Back/swipe get the toast without a haptic.
- **Plans row reveal** (plan not active): the new row wears a `systemGray5` surface on the 16 inset (radius 12, 2pt clear of separators) for a moment — fade in 180ms ease-out after 240ms, hold 700ms, fade out 520ms ease-in-out. Opacity only, so it plays under Reduce Motion. No reveal on Home.
- Onboarding's template path keeps `Plan ready` as its finish screen (no toast); Build my own uses the editor and gets this confirmation.

## Paywall success

The one celebration a purchase gets. Pro turning on from the paywall (purchase or its Restore) keeps the modal open and turns it into a success state; only the CTA settles the gate. Rare moment, so it earns the flourish; everything else about it is the paywall's own grammar.

- **Same modal, same footer.** The offer (headline, plans, timeline, terms, `Not now`, footer links) fades out (150ms ease-out); the black CTA does not move, only its label changes to the resumed action (`Start training`, `Add plan`, `Use this plan`, `Show progress`, `Use targets`, else `Continue`). The links fade but keep their row so the pill stays under the thumb.
- **Stage:** green check disc 56 on the text edge (the stage's only green: completed work), `You're in.` 34 (`Welcome back.` after a restore), then the same feature rows (36 tile + title 17 + one 15 line), gated feature first, whose line now says **where the feature lives** as an on-screen path: `Plans › + to add. Hold a plan to switch.` One line on a 6.3" phone. No subheading, no confetti, no tour.
- **Money fact:** under the CTA, in the price note's place: `Free until Oct 4. Cancel anytime in Settings.` only when a free trial started; otherwise the line stays empty.
- **Motion** (starts once the App Store's sheet/alert is gone, ~140ms after the swap, ~260ms after returning to the app): disc opacity 0 → 1 (140ms) + scale 0.6 → 1 spring (480ms, dampingRatio 0.55); check stroke draws 320ms ease-out after 110ms; two soft green rings (scale ×1.8, opacity 0.3 → 0, 720ms, at 80ms and 220ms), Home's week-dot language at moment size. Headline rises 8pt + fades (220ms) at +90ms, rows at +160ms, 60ms apart. One success haptic with the pop. Reduced motion: disc and finished check fade in (200ms), text fades without rising, no rings.

## Do not

Tables, set-number circles, overlapping pills, 10RM as chrome, heatmap, achievement chrome, calculator-sized `80 × 8` as the hero, custom page transitions, lime green or Inter, hierarchy-only eyebrows, motivational progress copy, decorative plan icons.

---

## Per screen

Same voices. Different winner. Do not invent a new type scale.

| Screen | Winner | Structure | The one green |
| --- | --- | --- | --- |
| Home | Day name (no label above it; it sits where tab titles sit) | Identity: day title (shrinks to fit one line, min 0.7) + **meta row** (`6 exercises · ~45 min · Push Pull Legs`; `Started 18:02 · 4 of 18 sets · Push Pull Legs` while open; the plan name always closes it) — no focus/region subtitle. Title and list are **read-only**: the list already is the preview, so tapping it opens nothing; only Start is interactive. Exercise list as **one object** on its 16 inset: name 17 (wraps to 2 lines) + prescription 15 grey regular, no thumbnail column (1.0 ships no exercise media; an initials tile never wins). **Every exercise, never truncated** (G1): the count in the meta row always matches the rows. Black Start sits with the list (tighter than the week). Week = **amount** (`n of m` 20 semibold + dots; **completed dots are green**) + chevron, opens **Weeks**. Other days → preview, not log. | Completed week dots + checks only. |
| Log | Exercise name | Strip; quiet `Set n of m`; **Last time** as the target; checked set lines grow below (no Previous Sets card). Wells: **tap the number → system keyboard → type** (primary path for big jumps / first set of a new exercise). −/+ only for small gym adjustments (e.g. +2.5). Focused well: white fill + 2px black ring. Green `Log set` at thumb. Frame must not jump as sets appear. | `Log set` (+ checks) |
| Done | `Done` 64 + check | Meta row (`Push · 58 min · 19 sets · [crown] 3 PRs`, the crown yellow); air; recap = exercise name 17, then **one 15 row per set** (set number in a narrow tertiary lane + `60 kg × 8`; crown on the PR set), shared with Session detail (`RecapExercise`); green Done at thumb | Check + Done |
| Plans | Tab title 28 | Active plan as **one prominent row/card** (name + day count + ✓ Active). Other plans quieter name + count. Tap → detail. No plan icons. No permanent rename/delete on rows. | `Active` check/label only |
| Plan detail | Plan name (40) | `n days` (+ green Active); days as title + 2-line `·` exercise names; empty = Add exercises; Add day quiet; Use/Delete later | Active only |
| History | Tab title 28 | Month caption is amount (`August · 4 sessions`). Session row = title 17 + meta row (`{when} · {n} exercises · {duration}`, no icons) on the left — `when` is `Today` / `Yesterday` / `Wed 13` under the month (no repeated month name). Quiet hairline between sessions in a month; air between months. When the session has PRs, a quiet grey pill on the right (vertically centered): yellow crown · count · `PR`/`PRs`. Empty = `No completed workouts yet.` Long-press deletes. Tap → session detail. | Yellow crown for PRs only |
| Session detail | Workout title (40) | A **record**, not a Done ceremony. Back; one meta row (`{when} · {duration} · {n} sets`; the exercises are listed right below, so no count); exercises as name 17 + one 15 line per set (tabular). Yellow crown next to the set that beat a prior session’s 10RM. No green, no Done button — `workout-complete` keeps that job. | Yellow crown on PR set |
| Home preview | Sheet | Opens from **Other days** only. Title 22 + meta row (`n exercises · ~X min · Done Thu 17`, same grey as Home); name 17 (wraps to 2 lines) + `n × reps` 15 grey regular per row, exactly like Home's list, no thumbnail; rows are read-only (no exercise sheet); Start black starts that day | None |
| Home empty | `No plan yet` 40 (no label above) | Caption; black Create plan | None |
| Progress | Tab title 28 | `Log check-in` top right; **Lifts** then **Body** sections. Lift and body rows share **one anatomy**: name 17 + one grey caption `Last Sep 25` (latest session / check-in; `Sep 25, 2025` outside this year) · latest value (grey, tabular: best set `85 kg × 8` for lifts, `80.5 kg` for body) · sparkline · chevron → detail. The caption is a single fact, not a meta row. Dates here and on lift/body detail are built in English order (`monthShort`), never the region's format (`25. Sep`). Lifts truncate after 5 with a `n more lifts` peer row. **Accessibility sizes (fontScale ≥ 1.35) stack each row** instead of truncating: name and caption wrap on the full width, then value + sparkline on their own line, chevron trailing; the tab title never truncates (`Log check-in` wraps under it). Lift and body detail: the hero keeps one caption line at rest (`Estimated 1-rep max`; body holds an empty line) so scrubbing never moves the chart. The delta is grey on both (`▲ 4%`, `▼ 2%`, flat `0%` with no arrow), never ink or green. Chart axis: months at the ends, days when both fall in one month (`Sep 1 … Sep 28`); labels cap at 1.5× and the chart grows below the axis to fit them. | None |
| Settings | Tab title 28 | 17 rows in groups separated by air: preferences (Weight, Appearance) · Pro (Trim Pro, Restore) · **links out** (Contact support, Privacy Policy, Terms of Use: link role + trailing `arrow.up.right`, never a value) · Clear history red | None |
| Paywall | Headline (34) | One headline, **no subheading**. **One text edge:** feature tiles, the plan radios and the timeline nodes all sit in a 36pt lane so every title/detail starts at the same x; every row is title + one line. Benefit rows = 36pt SF Symbol tile + title 17 semibold + one detail line 15 (≤ ~45 chars). Plan options, then the trial timeline (glyph nodes: ink `lock.open.fill` today, grey `creditcard.fill` on the charge day) — all above the fold on a 6.3" phone. `Not now` top right on a solid band (hairline once content scrolls under). Black CTA + price note in the footer; Restore · Terms · Privacy under it. The fixed chrome (`Not now`, CTA label, notes, links) caps Dynamic Type at 1.4× so the scroll area stays usable at AX sizes; everything in the scroll view scales fully, and feature tiles top-align with the title when rows wrap. After Pro turns on: success state in the same modal (see **Paywall success**). | Success check only |
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

Ship against these:

| Artboard | Use |
| --- | --- |
| Home | Collapsed list + week dots (superseded: Home now shows the whole list, no label; see **Home round 3 (2026-09-28)** page, B2) |
| Home expanded | Full list + Show less (superseded by round 3: no truncation) |
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
6. Matches Hevy, Strong, or Alpha Progression more than the Trim Paper file.
7. On log: the upper stage jumps between set 1, rest, later sets, or keyboard open.
8. Keyboard covers the wells or `Log set`.
