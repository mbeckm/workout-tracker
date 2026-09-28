---
name: trim-ui
description: Trim's design system - principles, typography, spacing, color, shape, icons, motion, haptics, copy, components and per-screen specs. Use when designing, implementing or QA'ing any screen in mobile/ (Home, Plans, Progress, History, Settings, log, sheets, Done, onboarding, paywall).
---

# Trim design system

Trim is a tool you use between sets, in a gym, for years. Think Trade Republic for workouts: very little on screen, big confident numbers, black and white with one signal color, and the essential action always one tap away.

This file is the rulebook. Product rules are in `PRODUCT.md` (principles first) and `PRODUCT-DECISIONS.md`. Tokens live in `mobile/src/constants/theme.ts` (type, spacing, radius, color, icons) and `mobile/src/motion.ts` (durations, springs, easings). **If Paper and this file disagree, this file wins** and the artboard gets updated. Paper is [Scratch workout new](https://app.paper.design/file/01M0FJ7CD2XE6GM8BGDAPR9QP5), page **Deliberate empty** (the file name predates the rename).

Every rule has a reason. When a case isn't covered, apply the reason, then add the rule here.

---

## 1. Principles

1. **One screen, one job, one primary action.** Say the job in one sentence. Anything that doesn't serve it moves a layer down (see §2) or goes away.
2. **Fast is the feature.** Launch → first logged set is 2 taps (Start, Log set). A prefilled set is 1 tap. Nothing we add may cost the loop a tap or make it wait.
3. **The interface explains itself.** No helper text, no explainer subheadings, no summaries of what's already visible. If a screen needs a sentence to be understood, the layout is wrong.
4. **Whitespace is confident.** Empty space is a pause after a group, not a hole to fill. Never add UI to make a sparse state look "designed". Screens fill by use.
5. **Layout carries hierarchy.** Size, weight, position and space say what matters. Labels that only restate hierarchy (`YOUR PLANS`, `ACTIVE PLAN`) are banned.
6. **Color is a signal, not decoration.** The screen is ink on paper. Each signal color has exactly one meaning (§5).
7. **Motion earns its place.** An animation must make Trim feel faster, more fluid or more loveable. If it can't name which, cut it (§8).
8. **Native and timeless.** System font, SF Symbols, iOS semantic colors, native navigation, sheets, menus and alerts. No trends (gradients, glass cards, neumorphism, custom transitions). Nothing that will look dated in five years.
9. **The user is in control.** The UI never implies intent the user didn't express (see `PRODUCT.md` → Principles → Control).

---

## 2. Structure and progressive disclosure

Information lives on exactly one of four layers. Put it on the lowest layer that serves the screen's job, never higher.

| Layer | Holds | Reached by |
| --- | --- | --- |
| **Stage** | The one subject and the one action: the next day + Start, the current set + Log set | Tab, or the primary action |
| **Sheet** | Detail about the thing you tapped: day preview, exercise sheet, check-in | Tap on the object |
| **Menu** | Secondary actions on an object: Rename, Duplicate, Move, Delete, Use this plan | Long-press (native context menu), or an editor's quiet row |
| **Settings** | Preferences you set once | Settings tab |

- A stage shows at most **three levels of text** per object (name, meta, value).
- Needed less than once per session → it goes a layer down.
- Lists truncate as a peer row (`n more exercises`, chevron down) that expands in place. Never a floating `+n more`, never a sheet just to show the rest.
- Density lives in sheets, not on the stage.

### Screen jobs

| Screen | Job | Winner | Primary action |
| --- | --- | --- | --- |
| Workout (Home) | What's next, and start it. How much of the week is done. | Day name (`display`) | Start (ink) |
| Log | What this set needs right now. | Exercise name (`displayCompact`) | Log set (green) |
| Done | What I just finished. | `Done` (`hero`) | Done (green) |
| Plans | Which plan is active, which others exist. | Tab title | `+` (header) |
| Plan detail | What's in this plan. | Plan name (`display`) | Use this plan (ink, only if not active) |
| Progress | Is each lift going up. | Tab title | none |
| Lift detail | How strong I am on this lift, and the trend. | Estimated 1RM (`hero`) | none |
| History | What I finished. | Tab title | none |
| Session detail | The record of one workout. | Workout title (`display`) | none |
| Settings | Change units, appearance, Pro, data. | Tab title | none |
| Paywall | What Pro adds and what it costs. | Headline (`displayCompact`) | Start free trial / Subscribe (ink) |
| Onboarding step | One question. | Question (`displayCompact`) | Continue (ink) |

A screen with "none" has no pill. Rows are the actions.

---

## 3. Typography

System font (SF Pro) only. **Eight sizes, three weights, twelve roles.** Use a role from `useTheme().type` as-is. Never override size, weight, line height or tracking. Only override `color`, and only with another label tier or a semantic color from §5.

| Role | Size / line | Weight | Tracking | Default color | Use for | Never for |
| --- | --- | --- | --- | --- | --- | --- |
| `hero` | 64 / 68 | Bold | −4% | label | The one result on a moment screen: `Done`, a lift's 1RM, the onboarding number choice, the welcome wordmark | Set counts, names that can wrap |
| `display` | 40 / 46 | Bold | −3% | label | The subject of a page: Home day, plan name, session title, empty-state fact | Anything under a `hero` |
| `displayCompact` | 34 / 41 | Bold | −3% | label | A subject that can run long on a fixed stage: log exercise name; onboarding question; paywall headline | Tab titles |
| `tabTitle` | 28 / 34 | Bold | −3% | label | Room name at the top of a tab (`Plans`, `History`) | In-page headings |
| `value` | 28 / 34 | Medium | −2% | label | Quiet large numbers: logged set lines, onboarding counts, Done facts | Names |
| `title` | 22 / 28 | Bold | −2% | label | Status and sheet titles: `Set 2 of 4`, `3 of 5`, a sheet's day name, the active plan name | Section headers on a stage |
| `lede` | 22 / 28 | Medium | −2% | label | The one line under the welcome hero | Anywhere else |
| `row` | 17 / 22 | Medium | 0 | label | A list item's name | Running text |
| `body` | 17 / 22 | Regular | 0 | label | Text buttons (Cancel, Not now, back label), form values, rare running text | List names |
| `button` | 17 / 22 | Bold | 0 | per variant | Pill labels, Finish | Anything not tappable |
| `caption` | 15 / 20 | Regular | 0 | tertiary | Meta under a name, fact captions, section captions, stepper ± glyph labels | Anything the user must act on |
| `footnote` | 13 / 18 | Regular | 0 | tertiary | Legal lines, chart axes, the paywall price note | Meta under a row (that's `caption`) |

### Rules

1. **Weights mean something.** Bold = it names or commands (titles, CTAs). Medium = it's the thing in a list, or a quiet number. Regular = it supports something else. No semibold, no light, no italics.
2. **One stage size per screen.** A screen uses at most one of `hero` / `display` / `displayCompact`. The tab title plus one stage size is the normal page. Two display sizes competing is always wrong.
3. **Step, don't nudge.** Adjacent levels differ by at least one step on the ramp. Never 16 next to 17, or 20 next to 22. Off-ramp sizes (16, 20, 52, 56) are migration debt.
4. **Name → meta pairs.** `row` over `caption` (gap 2). `display` over `caption` (gap 8). `title` over `caption` (gap 4). Never `row` over `footnote`.
5. **Tabular numbers** (`fontVariant: ['tabular-nums']`) on every number that changes in place, lines up in a column, or is typed: wells, timers, set lines, week count, charts, prices.
6. **No uppercase, no letter-spaced labels.** Eyebrows in caps read as web dashboards.
7. **Left-aligned.** Center only text that sits under a centered full-width control (price note, terms, the empty log sheet) and the onboarding hero number.
8. **Wrapping.** Winners wrap. They never truncate. On a fixed stage, a long name wraps to two lines, then scales down (`adjustsFontSizeToFit`, `minimumFontScale 0.75`). Row names get `numberOfLines={2}`, meta gets 1–2. Ellipsis only in rows.
9. **Dynamic Type.** Everything scales. Cap with `fontScaleCap` from `theme.ts`: `display` (1.2) for `hero`/`display`/`displayCompact`/`tabTitle`, `title` (1.4) for `title`/`value`/`lede`, and `text` (2) for 17 and below, only where a fixed stage needs it. Layouts must survive the cap. Rows grow, they don't clip.
10. **Emphasis inside a line** is a label-tier change (`tertiary` → `label`), not a weight change. Example: `Last time` in tertiary, `60 kg × 8` in label.

---

## 4. Spacing and layout

A 4-point system with semantic steps from `space` in `theme.ts`. **Space encodes relationship: the closer two things are, the more they belong together.** Each step up the ladder means "one level less related".

| Token | pt | Means | Examples |
| --- | --- | --- | --- |
| `space.pair` | 2 | Same item | Row name → its meta line |
| `space.tight` | 4 | Same fact | Name → inline check or crown. `title` → its caption. |
| `space.related` | 8 | Same group | `display` → its meta. A section caption → its content. Chip → chip. Tab title → subject. |
| `space.inline` | 12 | Side by side | Leading tile/icon → text. Well → well. |
| `space.inset` | 16 | Inside an object | Object surface padding. Row vertical padding. Sheet grabber → title. |
| `space.gutter` | 24 | Page edge | Left/right margin on every screen. Top: safe area + 24 to the first text. |
| `space.section` | 32 | Next section | Home list → week. Settings groups. Recap exercise → next exercise. |
| `space.pause` | 48 | After the winner | The air after the subject block. Above the thumb CTA when content is short. |

Raw scale (`spacing`): 2 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Use `space` first. Any other number needs a comment that says why (optical alignment only, e.g. `paddingBottom: 1` to line up NumberFlow with a caption baseline). 3, 5, 6, 7, 10, 11, 14, 18, 20 and 28 are migration debt.

### Layout rules

1. **One grid.** Every screen has the same 24 gutter, and everything aligns to it. An object surface insets 16, so its text sits at 40. That's the object's padding, not a second grid.
2. **Two lanes per row.** Leading lane (text, left-aligned at the gutter or inset) and trailing lane (value, mark or chevron, right-aligned to the same edge). An optional leading tile adds a third lane. All rows in a list use the same lanes.
3. **Single column.** No grids of cards. The only side-by-side controls are the two wells, chips, and paired header actions.
4. **Thumb zone.** On tool screens (Log, Done, onboarding, paywall), the primary action sits at the bottom: full width inside the gutter, 16 above the safe area. On read screens (Home), the action sits directly under its object (Start under the exercise list).
5. **Rows.** Vertical padding 16, minimum 44 tall. Hairline separators start at the text lane, never full-bleed inside an object. Between groups, use air (`section`), not a thicker line.
6. **Touch targets** are at least 44×44 (`TOUCH_TARGET`). Small glyphs get `hitSlop`, not a bigger glyph.
7. **Pinned frames don't jump.** Content that appears (rest, logged sets, errors) takes air from below. It never pushes the subject.

---

## 5. Color

The screen is ink on paper. Four signal colors, each with exactly one meaning. Tokens come from `useTheme().colors`, in light and dark. No hex literals outside `theme.ts`.

### Ink

| Token | Light / Dark | Means | Use for |
| --- | --- | --- | --- |
| `label` | #000 / #FFF | **This.** The subject, what you read or act on | Titles, names, values, entered numbers, ink CTA fill, standalone controls (back, `+`) |
| `secondaryLabel` | #3C3C43 / #98989F | **Settled.** Content that's done but still read | Logged set lines (residue), recap set rows, text buttons that dismiss (Not now) |
| `tertiaryLabel` | #6C6C70 / #8E8E93 | **About this.** Metadata and affordances | Captions, meta, section captions, placeholders, chevrons, ↗, inactive tab, well ± |
| `separator` | #C6C6C8 / #38383A | Boundary | Hairlines only |

Captions are always tertiary. Secondary is never a caption color. It's for settled content.

### Signals

| Token | Means | Allowed | Never |
| --- | --- | --- | --- |
| `systemGreen` (#34C759 / #30D158) | **Done, or go.** | Marks for finished work (set checks, strip checks, completed week dots, `Active` on Plans, PR-up delta on Progress). Fill of the one gym CTA (`Log set`, `Finish workout`, `Done`). | Titles, icons that encode nothing, a second green control on a stage, "success" banners |
| `systemRed` | **Destroys.** | Delete, Remove, Clear history, destructive menu items, an inline error line | Missed workouts, going down on a chart, warnings |
| `systemYellow` | **Record.** | The PR crown | Anything else |
| Ink CTA (`label` fill, `onLabel` text) | **Primary, not gym.** | Start, Resume, Continue, Create plan, Use this plan, paywall CTA | Two on one screen |

- **Budget:** a screen has at most one filled control. Green marks may repeat (checks), but only one green *control* exists on a stage.
- **No blue in content.** Trim has no link color. Links are `label` with a trailing ↗ (external) or a chevron (in-app). System blue appears only where iOS draws it: alerts, context menus, header toolbar items. The `filled` button variant is deprecated.
- **Down is not red.** Lifting less, missing a day, or a lower bodyweight stays in ink. Trim doesn't scold.
- **Opacity is never a color.** Don't dim text with opacity. Pick a label tier. Opacity is only for pressed feedback (`PRESSED_OPACITY` 0.6) and the scrim.
- **Disabled** pills become the quiet gray pill (`secondarySystemBackground` + `tertiaryLabel`). Disabled text buttons go `tertiaryLabel`. Never 40% of a color, which reads as broken.
- **Contrast.** Tertiary is tuned to ≥ 4.5:1 on both backgrounds (AA at 15pt). Don't introduce a lighter grey for text.

### Surfaces

| Token | Use |
| --- | --- |
| `systemBackground` | Every page and sheet |
| `secondarySystemBackground` | Object surfaces (Home exercise list), wells, gray pill, quiet chip fill |
| `tertiarySystemBackground` | Something on top of a surface in dark mode (a focused well inside a sheet) |
| `systemGray5` | Empty tracks: waiting week dots, chart grid |
| `systemGray4` | Sheet grabber |
| `scrim` | Behind custom sheets (native sheets draw their own) |

No gradients, no shadows, no borders on surfaces. The only outline is the focused well's 2px `label` ring. Dark mode is black ground (#000) with elevated grays. Check every screen in both.

---

## 6. Shape

| Token | pt | Use |
| --- | --- | --- |
| `radius.sm` | 8 | Small tiles ≤ 40pt (paywall benefit tile), chart callouts |
| `radius.md` | 12 | Object surfaces, wells |
| `radius.lg` | 16 | Custom sheet top corners |
| `radius.full` | pill | Buttons, chips, toasts, dots, PR pill |

Always `borderCurve: 'continuous'`. Nested shapes are concentric: inner radius = outer radius − inset. Off-scale radii (4, 10, 11, 22) are migration debt.

---

## 7. Icons

SF Symbols via `expo-symbols`, with a text-glyph fallback only for non-iOS. **An icon must encode something the text doesn't.** No decorative icons, no plan or exercise icons, no icon beside a title.

### Where icons are allowed

| Kind | Symbols | Color |
| --- | --- | --- |
| Tab bar | `dumbbell`, `list.bullet`, `chart.line.uptrend.xyaxis`, `clock`, `gearshape` (system-rendered) | tint `label`, inactive `tertiaryLabel` |
| Status marks | `checkmark` (done), `crown.fill` (PR) | green / yellow |
| Affordances | `chevron.right` (opens in-app detail), `chevron.down`/`.up` (expand in place), `arrow.up.right` (leaves the app), `line.3.horizontal` (drag handle) | tertiary |
| Controls | `chevron.left` (back), `plus` (add), `xmark.circle.fill` (clear field), `magnifyingglass` (search field) | `label`; the clear control is tertiary |
| Paywall benefits | One `*.fill` symbol per benefit tile, `lock.open.fill` / `creditcard.fill` timeline nodes | `label` |
| Context menus | System symbols per action | system |

### Sizing and weight

| Token (`iconSize`) | pt | When | Weight |
| --- | --- | --- | --- |
| `caption` | 13 | Beside 15 text; row chevrons and ↗ | semibold |
| `row` | 17 | Beside 17 text: checks, crowns, `+` in a list | semibold |
| `control` | 22 | Standalone tap targets: back, clear, drag handle, header glyphs | medium |

A symbol next to text takes that text's size. Plain glyphs, not circled (`checkmark`, not `checkmark.circle.fill`). The only exception is the system's clear-field control. Chevrons appear only where tapping opens something. A row that performs an action has no chevron.

---

## 8. Motion

Motion exists to make Trim feel **faster** (instant acknowledgement, no waiting), **more fluid** (you see where things came from and went), or **more loveable** (an earned moment of joy). Every animation names its purpose. If it can't, delete it.

### Tokens (`motion.ts`)

| Token | ms | Use |
| --- | --- | --- |
| `DURATION.press` | 120 | Press feedback. Starts on touch-down. |
| `DURATION.exit` | 150 | Anything leaving. Exits are faster than enters. |
| `DURATION.fade` | 160 | Reduced-motion replacements |
| `DURATION.enter` | 200 | Something arriving: a set line, a toast, swapped content |
| `DURATION.change` | 280 | A value or layout changing in place: number roll, expand/collapse, theme crossfade |
| `DURATION.celebrate` | ≤ 760 | Earned moments only, after the action has landed |
| `SPRING.settle` | 300, damping 0.85 | Sheets, drags, swipes, rows settling. Carry the gesture's velocity. |
| `SPRING.pop` | 520, damping 0.42 | The one bouncy spring: a reward mark filling |

Easing: `EASE_OUT` for enter, exit and press. `EASE_IN_OUT` for on-screen moves. Springs for anything a finger drives. Linear only for time itself (the rest clock).

### Rules

1. **Never make the user wait.** Anything a tap triggers finishes within 280ms. Input is never blocked by an animation, and every animation is interruptible.
2. **Animate changes, not arrivals.** No entrance animations when a screen or tab appears, no staggered list reveals, no skeletons or spinners for local data (it's instant). Only what *changed* moves.
3. **Small distances.** Enter from 8pt (`ENTER_OFFSET`) with a fade. Never from off-screen, never from `scale(0)`. Press scale is 0.97.
4. **No bounce on tools.** Functional springs are critically damped (≥ 0.8). Overshoot is reserved for `SPRING.pop`.
5. **Native navigation only.** Push, modal and sheet transitions are the system's. No custom page transitions, no parallax, no shared-element flourishes.
6. **No idle motion.** Nothing loops, pulses or breathes while the user isn't doing anything. The rest clock ticking is information, not decoration.
7. **Reduced motion:** movement becomes an opacity fade (`DURATION.fade`), celebrations become a color crossfade, and haptics stay.

### Approved motions

| Motion | Spec | Purpose |
| --- | --- | --- |
| Pill press | scale 0.97, `press`, ease-out, on touch-down | Faster |
| Row / text / glyph press | opacity `PRESSED_OPACITY`, immediate | Faster |
| Set logged | new line opacity 0→1 + translateY −8→0, `enter` | Fluid |
| Number changes in place | NumberFlow roll (`StaggerValue`), `change`, `EASE_OUT_FN` | Fluid |
| Log stage swaps exercise | crossfade, exit 150 / enter 200. The frame doesn't move. | Fluid |
| Expand / collapse in place | layout `change`, ease-in-out | Fluid |
| Sheets | native, or `SPRING.settle` with gesture velocity | Fluid |
| Toast | rise 8pt, `enter`; leave `exit` | Fluid |
| Appearance change | full-screen crossfade, `change` | Fluid |
| Week dot fills | `SPRING.pop` 0.5→1 + two green rings (×3.4, 0.45→0, 760ms, 140ms apart). A full week adds a staggered bump across all dots. Starts ~320ms after Home is visible again. | Loveable |

Anything not on this list needs a purpose, a spec, and a row here before it ships.

### Haptics

A haptic confirms something the body did. It's never decoration.

| Moment | Haptic |
| --- | --- |
| Set logged | light impact |
| Rest reaches 0:00, Finish | success |
| Well −/+, swiping between exercises, picking a paywall option | selection |
| A sheet snapping to a detent | light impact |

Nothing else buzzes. No haptic on navigation, toggles, errors or celebrations.

---

## 9. Copy

Trim's text is **names, numbers, facts and verbs.** If a string isn't one of those, it probably shouldn't exist.

### Allowed

| Kind | Example |
| --- | --- |
| Name | `Push`, `Bench Press`, `Upper A` |
| Number with unit | `60 kg × 8`, `4 × 8 reps`, `3 × 30s`, `1:32`, `52 min` |
| Fact caption (passes the eyebrow test) | `Today`, `this week`, `Rest`, `Last time 60 kg × 8`, `August · 4 sessions` |
| Action | `Start`, `Log set`, `Create plan`, `Use this plan` |
| Empty-state fact | `No plans yet`, `No workouts yet` |
| Error: what happened, and what to do, in one line | `Couldn't load prices. Try again.` |
| Legal | Auto-renewal terms on the paywall |
| Headline, onboarding and paywall only | `A plan. Then the gym.` |

### Banned

- Instructions and gesture hints: `Tap to swap`, `Drag to reorder`, `Swipe to…`. Use platform conventions (drag handles, context menus, chevrons) instead. VoiceOver hints are exempt.
- Explainer subheadings and captions under titles or empty states: `Finished workouts land here.`, `Log a workout to track lifts here.`
- Summaries of what's already on screen.
- Motivational or celebratory copy (`Great job!`, `Keep it up`), exclamation marks, emoji.
- Possessives that add nothing: `Your plans`, `My workouts`.
- Coach marks, tooltips, tours.

### The eyebrow test

Keep a caption only if it carries a **fact** the layout doesn't already show: `Today`, `Rest`, `this week` next to `2 of 4`, a month name. Drop it if it only names the layout.

### Style

- **Sentence case** everywhere, including titles (`Next workout`, `Other days`). The one exception is the product name, `Trim Pro`.
- **Buttons are verbs:** one or two words, three at most. The label says what happens, so `Delete plan`, not `OK`.
- **Numbers:** a unit on every load (`60 kg × 8`). Prescriptions name the reps (`4 × 8 reps`). `×` joins load and reps or sets and reps. ` · ` (spaced middle dot) separates facts. `—` marks an empty value. `−` (minus sign) is used in steppers. Times are `1:32` and `52 min`. Estimates are `~45 min`.
- **Dates:** `Today`, `Yesterday`, `Wed 13`, `August`. No year unless it isn't this year.
- **Alerts:** the title names the action and the object (`Delete “Push”?`). Add a message only when the consequence isn't obvious (`This deletes every completed workout on this iPhone.`). The buttons are `Cancel` + the verb (`Delete`).
- **Toasts** confirm a result that isn't on screen yet (`Check-in saved`). Never errors, never things already visible.

---

## 10. Components

Use these. Don't rebuild them per screen.

| Component | File | Rules |
| --- | --- | --- |
| `Button` | `components/button.tsx` | Variants: `black` (ink CTA), `green` (gym CTA), `gray` (secondary pill), `plain` (text action, `body`), `destructive` (red text). Pill height ≥ 52, `button` label. `compact` (32) only for inline chips. `filled` (blue) is deprecated. At most one filled pill per screen. |
| `HeaderActions` | `components/button.tsx` | Header items are native toolbar buttons. Never a custom pill in a header. |
| `PaperScreen` | `components/paper.tsx` | Page scaffold: 24 gutter, safe-area top + 24, scroll. |
| `PaperRow` | `components/paper.tsx` | `row` + optional `caption` meta. The trailing lane holds a value, mark, ↗ or chevron. Pressed = `PRESSED_OPACITY`. A `link` row (leaves the app) gets link role + ↗. |
| Object surface | per screen | `secondarySystemBackground`, `radius.md`, 16 inset. Only when its contents form one unit (exercise list). Not on every row. |
| Section caption | — | `caption`, 8 above its content, 32 above from the previous section. Only if it passes the eyebrow test. |
| `PaperEmpty` | `components/paper.tsx` | Tab title + fact (`display`) + one ink action if one exists. No caption. |
| Well | `screens/log-workout.tsx` | `secondarySystemBackground`, `radius.md`. Tap number → system keypad. −/+ for small steps. Focused: page fill + 2px `label` ring. |
| Sheets | native `formSheet`, `components/animated-sheet.tsx` | Grabber, title (`title`), content. Dismiss by drag. No Close link unless there's no drag (forms get Cancel/Save in the header). |
| Context menu | native | Secondary object actions. The destructive item is last and red. |
| Alert | native | Destructive confirms only (§9). |
| `Toast` | `components/toast.tsx` | Inverted ink pill + green check, above the tab bar, ~2s, one at a time. |
| Chips | `components/window-chips.tsx` | Segmented choice of a range (3M, 6M, YTD, All). Selected: ink fill. |

### States

| State | Treatment |
| --- | --- |
| Pressed | Pills scale 0.97. Everything else uses opacity 0.6. |
| Disabled | Gray pill, tertiary text. Never low opacity. |
| Focused (input) | 2px `label` ring |
| Selected (chip, option) | Ink fill, `onLabel` text |
| Loading (network: prices only) | The CTA label says it (`Loading prices…`). No spinners for local work. |
| Error | One `caption` line in `systemRed` where the action was, or the CTA becomes `Try again` |
| Empty | Fact + one action (`PaperEmpty`) |
| Pro-locked | The row or chip stays visible and opens the paywall on tap. A small `lock.fill` (13, tertiary) trails it. No blur, no greyed-out content. |

---

## 11. Per screen

Same system, different winner. Don't invent a type size for a screen.

| Screen | Structure | Green |
| --- | --- | --- |
| **Home** | `tabTitle` `Next workout` → 8 → day `display` → 8 → meta `caption` (`plan · n exercises · ~Xm`). Exercise list as one object surface: `row` name + `caption` prescription (`4 × 8 reps · 60 kg`), no thumbnails. After ~4 rows, a peer row `n more exercises` + chevron.down that expands in place and ends with `Show less`. Ink Start sits 16 under the list. Week (`title` `n of m` + `caption` `this week` + dots) one `section` below. Then `Other days` caption + rows (title `row` + first exercise names `caption`; trailing green check if done this week). Tap day or list → preview sheet. | Completed dots + checks |
| **Day preview** (sheet) | Day `title`, rows `row` + `caption`, read-only. Ink Start at the thumb. | None |
| **Log** | Header: Cancel (`body`, tertiary) · Finish (`button`). Strip: chips, checks on finished exercises. Exercise name `displayCompact` (tap → exercise sheet), `Set n of m` `title`, `Last time …` `caption`. Logged sets grow below as `value` lines in `secondaryLabel` with a green check. Footer (flex-end): Rest (above wells, eats air), wells, green `Log set`. The upper stage never moves (§12). | `Log set` + checks |
| **Done** | `Done` `hero`, facts `caption`, then per exercise `row` name + one `caption` line per set (narrow tertiary set-number lane + `60 kg × 8`, crown on the PR set; `RecapExercise`). Green Done at thumb. Scrolls, uncapped. | Done |
| **Plans** | `tabTitle` + header `+`. Active plan first, as a `title` row with a green `Active` caption and `n days`. Other plans as `row` + `caption`. Long-press: Use this plan (`(Pro)` when locked) / Delete. No icons, no permanent edit chrome. | `Active` |
| **Plan detail** | Plan name `display`, `n days` (+ green `Active`). Days as `row` title + `caption` exercise names (2 lines max). `Add day` as a quiet row. `Use this plan` ink if not active. `Delete plan` red, last. | `Active` |
| **Progress** | `tabTitle`. Lift rows: `row` name + `caption` latest, sparkline and chevron in the trailing lane. Body row the same. | Up-delta only |
| **Lift / body detail** | Lift name `title`, 1RM `hero` with unit, delta (green if up, ink otherwise), chips (3M free, rest Pro-locked), chart, sessions list. | Up-delta only |
| **History** | `tabTitle`. Month caption as an amount (`August · 4 sessions`). Session row: `row` title + `caption` (`Wed 13 · 5 exercises · 52 min`). Trailing PR pill (gray fill, yellow crown, count). Hairlines within a month, `section` air between months. Long-press → Delete. | None (yellow crown) |
| **Session detail** | Back, title `display`, facts `caption` (`when · duration · n exercises · n sets`), exercises as in Done. A record, not a ceremony: no green, no Done button. | None |
| **Settings** | `tabTitle`. `PaperRow` groups separated by `section` air: Weight, Appearance · Trim Pro, Restore purchases · Contact support ↗, Privacy Policy ↗, Terms of Use ↗ · Clear history (red). Values trail in `caption`. | None |
| **Paywall** | `Not now` top right (`body`, secondary) on a solid band, with a hairline once content scrolls under. Headline `displayCompact`, no subheading. Benefit rows: 36pt tile (`radius.sm`, symbol) + `row` title + one `caption` line (≤ 45 chars), all titles on one text edge. Plan options, then the trial timeline (ink `lock.open.fill` today, grey `creditcard.fill` on the charge day). Footer: ink CTA, price note `footnote`, Restore · Terms · Privacy. All above the fold on a 6.3" phone. | None |
| **Body check-in** | Native `formSheet`: Cancel · Check in · Save in one header row (Save disabled until a value). Fields scroll with the keyboard inset. Save closes and toasts `Check-in saved`. | Dot on fields that will save |
| **Onboarding** | One question per screen: `displayCompact` question, choices as rows or a `hero` number, ink Continue at the thumb. Welcome: `hero` wordmark + `lede` `A plan. Then the gym.` Always ends with a real plan the user picked. | None |

### Home week details

- While Home is covered (log, Done, paywall), the week amount keeps its old value. The celebration runs once Home is visible again (§8).
- Week progress is an **amount**, not a sequence. `n of m` + dots, never a day-name checklist, and one progress language per section.

---

## 12. Log stage

The hardest screen and the reference for all the others. Don't copy its layout onto other screens. Copy its rules.

1. **The frame never jumps.** The exercise name, `Set n of m` and Last time are pinned from the top. Logged sets grow downward into air. Rest inserts above the wells and eats leftover air, never the title. Glyphs may crossfade, but the frame doesn't move.
2. **Type to jump, tap ± to nudge.** Tap a well's number → system `decimal-pad` (weight) or `number-pad` (reps). −/+ are for small gym steps (+2.5). Never make steppers the only path from 0 to 100.
3. **The keyboard docks the cluster.** Wells + `Log set` (+ Rest) ride above the keyboard via `react-native-keyboard-controller` (`translateY` from `useReanimatedKeyboardAnimation`) on the footer only. The upper stage stays put. Don't build a custom keypad.
4. **Prefill proposes, Log set commits.** Wells show last time's values. Nothing is logged until the user taps.
5. **Don't** use set-number circles, a `Previous sets` card, 10RM as chrome, or `80 × 8` at calculator size as the hero.

---

## 13. Do not

Tables, status pills and badges (the History PR pill is the one exception), set-number circles, overlapping pills, heatmaps, achievement chrome, plan or exercise icons and thumbnails, decorative icons, hierarchy-only eyebrows, uppercase labels, motivational copy, helper text, gesture hints, gradients, shadows, bordered cards, chevrons on action rows, blue links, custom transitions, entrance animations, spinners for local data, lime green, Inter or any non-system font, off-ramp sizes and spacings, hex literals outside `theme.ts`.

---

## 14. QA

Before a screen ships, check it in light **and** dark, at default and at the largest capped Dynamic Type size, against this file and the Paper artboard.

1. **Job.** Say the screen's job in one sentence. Point to the one winner and the one primary action.
2. **Type.** Every text uses a role from §3 without size or weight overrides. There's one stage size. Numbers use tabular figures.
3. **Space.** Every gap is a `space` token and reads as the right relationship. The margins line up on the 24 gutter.
4. **Color.** Captions are tertiary. There's at most one filled control, and green only means done or go. No blue in content, and no opacity used as color.
5. **Copy.** No helper text, instructions or summaries. Every caption passes the eyebrow test. Sentence case.
6. **Icons.** Each one encodes something. It has the right size for its neighbor and the right color for its meaning.
7. **Motion.** Every animation is on the approved list, finishes within 280ms of a tap, and degrades under reduced motion. Nothing animates on arrival.
8. **Control.** Nothing happened that the user didn't ask for (`PRODUCT.md` → Control).
9. **Log only.** The upper stage doesn't move between set 1, rest, later sets and keyboard open. The keyboard never covers the wells or `Log set`.
10. **Taste.** It reads as Trim, not as Hevy, Strong or Alpha Progression.

---

## 15. Migration debt (code vs. this file)

Tokens are in place (`theme.ts`, `motion.ts`). Screens still carry these violations. Fix them when touching a screen, or in a dedicated pass with simulator QA:

- **Off-ramp sizes:** 52 (progress lift and body hero → `hero`), 20 (log well ± → `caption`-sized glyph or `title`), 16 (fallback glyphs), and inline `fontSize` / `fontWeight` overrides (e.g. `factBase` in `workout-tab.tsx` → `caption`; paywall benefit title `600` → `row`).
- **Raw spacing:** about 250 raw padding, margin and gap numbers. Off-scale values: 3, 5, 6, 7, 10, 11, 14 (`PaperRow` padding → 16), 18, 20, 28 (`PaperScreen` top → 24), 36.
- **Pressed opacity:** 0.5, 0.55, 0.7 and 0.75 in use → `PRESSED_OPACITY`.
- **Radii:** 4, 10, 11, 22 → the `radius` scale.
- **Icon sizes:** 11–22 in all weights → `iconSize`.
- **Motion:** raw durations 140, 180, 220, 240, 360 and 400, plus springs with 400ms / 0.8 → `DURATION` / `SPRING`.
- **Copy:** `Drag to reorder` and `Tap to swap` (log sheets), `Build your week once. Then just press Start.` (Home empty), `Finished workouts land here.` (History empty), `Log a workout to track lifts here.` (Progress empty), `Log a check-in to start tracking.` (body detail), `Next Workout` → `Next workout`.
- **Paper:** update the artboards to this ramp (caption 15 Regular tertiary, footnote 13) so Paper and code agree again.
