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
8. **Native and timeless.** System font, SF Symbols, iOS semantic colors, native navigation, sheets, menus and alerts. Trim owns Liquid Glass fully: all system chrome is the system's glass (§5). No trends of our own (gradients, glass imitations in content, neumorphism, custom transitions). Nothing that will look dated in five years.
9. **The user is in control.** The UI never implies intent the user didn't express (see `PRODUCT.md` → Principles → Control). Slips are forgiven with Undo, not prevented with dialogs.
10. **Built for the gym.** Every rule is checked against the setting below.

### The setting

Trim is used by people who train seriously, in a gym, between sets. Design for that moment, not for a desk:

| Fact | So |
| --- | --- |
| **Artificial light, arm's length.** Indoor gym light, not sunlight. The phone is held out, on a bench, or in a hand that's shaking. | Contrast stays AA or better (§5). On the Log stage nothing is smaller than 15, and the numbers you act on are 22 or larger. No hairline-thin strokes or low-contrast greys for anything you need to read. |
| **Short, frequent visits.** Open, log, leave for music or messages, come back 90 seconds later, dozens of times a workout. | Resume exactly where they left off, on the first frame: no launch or foreground animation, no splash, no re-entrance of content. The answer to "what now?" (current set, rest left) reads in one glance. The Live Activity carries the workout while they're away. |
| **Music and headphones.** Something is always playing. | Trim never makes a sound or takes the audio session. Confirmation is visual plus haptic. Anything that must reach them outside the app (rest over) goes through the Live Activity. |
| **One hand.** The other hand holds a bar, a bottle, or a towel. | Everything done during a workout is in the bottom half and reachable by thumb. Sheets over pushes for detail. Actions that end or discard a workout (Finish, Cancel) sit out of thumb reach on purpose. |
| **Audience.** Serious lifters, mostly young. Not a senior or accessibility-first product. | It must still work for people who don't see well: Dynamic Type up to the caps (§3), AA contrast, VoiceOver labels on everything. No special layouts for accessibility text sizes. |

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
| Workout (Home) | What's next, and start it. How much of the week is done. | Day name (native large title) | Start (ink) |
| Log | What this set needs right now. | Exercise name (`displayCompact`) | Log set (green) |
| Done | What I just finished. | `Done` (`hero`) | Done (green) |
| Plans | Which plan is active, which others exist. | Native large title | `+` (toolbar) |
| Plan detail | What's in this plan. | Plan name (native large title) | Use this plan (ink, only if not active) |
| Day editor | What's in this day, and how much of each. | Day name (native large title) | none |
| Progress | Is each lift going up. | Native large title | none |
| Lift detail | How strong I am on this lift, and the trend. | Estimated 1RM (`hero`) | none |
| History | What I finished. | Native large title | none |
| Session detail | The record of one workout. | Workout title (native large title) | none |
| Settings | Change units, appearance, Pro, data. | Native large title | none |
| Paywall | What Pro adds and what it costs. | Headline (`displayCompact`) | Start free trial / Subscribe (ink) |
| Onboarding step | One question. | Question (`displayCompact`) | Continue (ink) |

A screen with "none" has no pill. Rows are the actions.

---

## 3. Typography

System font (SF Pro) only.

**Words are native, numbers are big.** Every page title is the native large title (34 Bold, drawn by the navigation bar, collapsing into the glass bar on scroll): the tab roots, Home's day name, a plan, a day in the day editor, a session. A title is never a text field: it's renamed with Rename (§10). Trim's own big type is spent where Trade Republic spends it, on numbers and moments: `hero` for Done and the 1RM, well numbers, the rest clock, the week count. A bigger title doesn't read faster, but a bigger number does feel like progress.

**Eight sizes, three weights, twelve roles.** Use a role from `useTheme().type` as-is. Never override size, weight, line height or tracking. Only override `color`, and only with another label tier or a semantic color from §5.

| Role | Size / line | Weight | Tracking | Default color | Use for | Never for |
| --- | --- | --- | --- | --- | --- | --- |
| `hero` | 64 / 68 | Bold | −4% | label | The one result on a moment screen: `Done`, a lift's 1RM, the onboarding number choice, the welcome wordmark | Set counts, names that can wrap |
| `display` | 40 / 46 | Bold | −3% | label | Deprecated for names: page titles are the native large title. Kept only until screens migrate. | New work |
| `displayCompact` | 34 / 41 | Bold | −3% | label | A subject that can run long on a fixed stage: log exercise name; onboarding question; paywall headline | Tab titles |
| `tabTitle` | 28 / 34 | Bold | −3% | label | Deprecated: tab roots use the native large title. Kept only until screens migrate. | New work |
| `value` | 28 / 34 | Medium | −2% | label | Quiet large numbers: logged set lines, onboarding counts, Done facts | Names |
| `title` | 22 / 28 | Bold | −2% | label | Status and sheet titles: `Set 2 of 4`, `3 of 5`, a sheet's day name, the active plan name | Section headers on a stage |
| `lede` | 22 / 28 | Medium | −2% | label | The one line under the welcome hero | Anywhere else |
| `row` | 17 / 22 | Medium | 0 | label | A list item's name | Running text |
| `body` | 17 / 22 | Regular | 0 | label | Text buttons (Cancel, Not now, back label), form values, rare running text | List names |
| `button` | 17 / 22 | Bold | 0 | per variant | Pill labels, Finish | Anything not tappable |
| `caption` | 15 / 20 | Regular | 0 | tertiary | Meta under a name, fact captions, section captions, stepper ± glyph labels | Anything the user must act on |
| `footnote` | 13 / 18 | Regular | 0 | tertiary | Legal lines, chart axes, the paywall price note | Meta under a row (that's `caption`) |

> **Direction under review (Sep 2026):** meta under a name moves to the airy treatment: 17 Regular tertiary, 4 under the name, rows padded 20, so meta is the same size as the name and quieter by weight and color only. Section captions and fact labels need a separate treatment so they don't read as rows. This lands together with the Home top layout (design system page → Home top). Until then the table above is the rule.

### Rules

1. **Weights mean something.** Bold = it names or commands (titles, CTAs). Medium = it's the thing in a list, or a quiet number. Regular = it supports something else. No semibold, no light, no italics.
2. **One stage size per screen.** A screen uses at most one of `hero` / `display` / `displayCompact`. The tab title plus one stage size is the normal page. Two display sizes competing is always wrong. Other numbers on a stage (rest clock, logged sets) use `value`: large enough to read at arm's length, never louder than the winner. Well numbers are the exception, because they're input, not hierarchy.
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
| `space.gutter` | 24 | Page edge | Left/right margin on screens without a native large title (Log, Done, onboarding, paywall, sheets). Top: safe area + 24 to the first text. |
| `space.margin` | 16 / 20 | Title edge | Left/right margin under a native large title (tab roots, plan detail, the day editor, session detail): iOS's own layout margin, 16 on 6.1–6.3" iPhones, 20 from 414pt wide. Set once in `theme.ts` from the window width. |
| `space.section` | 32 | Next section | Home list → week. Settings groups. Recap exercise → next exercise. |
| `space.pause` | 48 | After the winner | The air after the subject block. Above the thumb CTA when content is short. |

Raw scale (`spacing`): 2, 4, 8, 12, 16, 24, 32, 48, 64. Use `space` first. Any other number needs a comment that says why (optical alignment only, e.g. `paddingBottom: 1` to line up NumberFlow with a caption baseline). 3, 5, 6, 7, 10, 11, 14, 18, 20 and 28 are migration debt.

### Layout rules

1. **One edge per screen.** Everything on a screen aligns to one leading edge. Under a native large title that edge is the title's own (`space.margin`, iOS's layout margin, where the back button and toolbar items also sit), so the title, its fact line, section captions, row text and surface edges share one x, and trailing lanes end under the toolbar's edge. Screens without a native title (Log, Done, onboarding, paywall, sheets) use the 24 gutter. An object surface insets 16 from whichever edge, so its text sits 16 in: that's the object's padding, not a second grid. Never draw a custom title to meet the gutter.
2. **Two lanes per row.** Leading lane (text, left-aligned at the page edge or inset) and trailing lane (value, mark or chevron, right-aligned to the same edge). An optional leading tile adds a third lane. All rows in a list use the same lanes.
3. **Single column.** No grids of cards. The only side-by-side controls are the two wells, chips, and paired header actions.
4. **Thumb zone.** On tool screens (Log, Done, onboarding, paywall), the primary action sits at the bottom: full width inside the gutter, 16 above the safe area. On read screens (Home), the action sits directly under its object (Start under the exercise list).
5. **Rows.** Vertical padding 16, minimum 44 tall. Hairline separators start at the text lane, never full-bleed inside an object. Between groups, use air (`section`), not a thicker line.
6. **Touch targets** are at least 44×44 (`TOUCH_TARGET`). Small glyphs get `hitSlop`, not a bigger glyph.
7. **Pinned frames don't jump.** Content that appears (rest, logged sets, errors) takes air from below. It never pushes the subject.

### Under a large title

One rule on every screen with a native large title (Home, Plans, Progress, History, Settings, plan detail, the day editor, session detail), so the title never floats and no list starts closer to it than its own sections are to each other.

1. **The title block** is the native large title plus at most one fact line under it (Home's `~55 min`, plan detail's `6 days`, session detail's two fact lines). The fact line is `caption`, tertiary, starts right under the bar (no extra padding: the bar's own air under the title is the gap) and sits on the title's edge (`space.margin`), so it reads as the title's subtitle, not as content.
2. **Title block → first content: `section` (32)**, measured to what you see: a surface's edge, a caption's text, or a row's text. A row's own 16 padding counts toward it (a list of rows starts with `space.inset` of padding, a surface or caption with `section`). With no fact line it's counted from the bar, which already sits ~13 under the title's baseline, so the title is always the loosest gap at the top of the page.
3. **Sections below keep `section` air, also measured text to text.** Never more air between two sections than between the title and the first one (History: title → first month `section` from the bar, month → month `section`, month caption → its rows `related`).
4. **Empty states** follow the same rule: the fact (`PaperEmpty`) or the one action sits `section` under the title.

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
| `systemGreen` (#34C759 / #30D158) | **Done, or go.** | Marks for finished work (set checks, strip checks, completed week dots, `Active` on Plans, PR-up delta on Progress), and `Go` where the rest clock was when rest is over. Fill of the one gym CTA (`Log set`, `Finish workout`, `Done`). | Titles, icons that encode nothing, a second green control on a stage, "success" banners |
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

### Liquid Glass

Trim owns Liquid Glass fully, and only where the system draws it.

- **System chrome is glass:** tab bar, navigation and toolbar items, native sheets, context menus, alerts, the keyboard. Use the native components (`NativeTabs`, `Stack.Toolbar`, `formSheet`) with their default materials. Never force them opaque, never recolor them, never draw a custom background behind them.
- **Content scrolls under chrome.** The system's scroll-edge effect separates them. No hairlines, opaque strips or custom blur under bars.
- **Content is never glass.** Surfaces, wells, cards and pills in content stay solid (`secondarySystemBackground`, ink, green). No `BlurView` in content, no translucent panels.
- **Prefer native sheets** (`formSheet` with detents) over the custom `AnimatedSheet`, so sheets get the system glass and gestures for free.
- **Primary actions on glass** use the toolbar's prominent style, never a custom pill in a header.

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

SF Symbols via `expo-symbols`, with a text-glyph fallback only for non-iOS. **An icon must encode something the text doesn't:** a state (done, PR, locked), where a tap goes (chevron, ↗), or which command or setting a row is. One icon language: monochrome outline symbols in label ink (red only on the destructive row, green only for done, yellow only for the PR crown), never colored tiles.

**Commands and settings get a glyph; content never does.** A row that does something or sets something (Settings, the plan and day editors, Delete workout) leads with its glyph in the row-glyph lane, like the iOS Settings idiom without its colored tiles. A row that *is* something (a plan, a day, a session, an exercise, a lift, a body metric) leads with its name: the name is its identity, and a glyph per row would repeat the same dumbbell on every line. No icon beside a title, on a section caption, on a CTA pill, or on an empty state.

### Where icons are allowed

| Kind | Symbols | Color |
| --- | --- | --- |
| Tab bar | `dumbbell`, `list.bullet`, `chart.line.uptrend.xyaxis`, `clock`, `gearshape` (system-rendered) | tint `label`, inactive `tertiaryLabel` |
| Status marks | `checkmark` (done), `crown.fill` (PR) | green / yellow |
| Affordances | `chevron.right` (opens in-app detail), `chevron.down`/`.up` (expand in place), `arrow.up.right` (leaves the app), `line.3.horizontal` (drag handle) | tertiary |
| Controls | `chevron.left` (back), `plus` (add), `xmark.circle.fill` (clear field), `magnifyingglass` (search field) | `label`; the clear control is tertiary |
| Command and setting rows (row-glyph lane) | Editors: `plus` (Add day, Add exercise), `pencil` (Rename plan, Rename day), `checkmark` (Use this plan), `trash` (Delete / Remove). Settings: `scalemass` (Weight), `circle.lefthalf.filled` (Appearance), `lock` / `lock.open` (Trim Pro, off / on: the same lock the Pro-locked chips wear), `arrow.clockwise` (Restore purchases), `envelope` (Contact support), `hand.raised` (Privacy Policy), `doc.text` (Terms of Use), `trash` (Clear history). One symbol per meaning: `trash` always deletes, `plus` always adds. | `label`; destructive row `systemRed`; a quiet row (`Add day`) tertiary |
| Paywall benefits | One `*.fill` symbol per benefit tile, `lock.open.fill` / `creditcard.fill` timeline nodes | `label` |
| Context menus | System symbols per action | system |

### Sizing and weight

| Token (`iconSize`) | pt | When | Weight |
| --- | --- | --- | --- |
| `caption` | 13 | Beside 15 text; row chevrons and ↗ | semibold |
| `row` | 17 | Beside 17 text: checks, crowns, `+` in a list | semibold |
| `control` | 22 | Standalone tap targets: back, clear, drag handle, header glyphs | medium |

A symbol next to text takes that text's size, and grows with Dynamic Type like it: the row-glyph lane is `ROW_GLYPH_SLOT` (22) wide with a `row` (17) glyph at medium weight, both scaled by the font scale up to the `text` cap (`useRowGlyph` in `components/paper.tsx`, used by `PaperRow symbol` and `EditorActionRow`), so every row's text starts on one edge. Plain glyphs, not circled (`checkmark`, not `checkmark.circle.fill`). The only exception is the system's clear-field control. Chevrons appear only where tapping opens something. A row that performs an action has no chevron.

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
| `DURATION.change` | 280 | A change you don't wait on: number roll, theme crossfade. Never between a tap and what it opens. |
| `DURATION.celebrate` | ≤ 760 | Earned moments only, after the action has landed |
| `SPRING.settle` | 300, damping 1 | Default for anything that settles without a flick: rows, snap-back with no velocity, repositioning. No overshoot. |
| `SPRING.fling` | 300, damping 0.8 | Only after a gesture that carried momentum (a flick, a swipe release, a thrown sheet). Pass the finger's velocity. |
| `SPRING.pop` | 520, damping 0.42 | The one bouncy spring: a reward mark filling (rare tier only) |

Easing: `EASE_OUT` for enter, exit and press. `EASE_IN_OUT` for on-screen moves. Springs for anything a finger drives. Linear only for time itself (the rest clock).

### How often decides how much

The more often a moment happens, the less it may animate. Delight is spent where it's rare (Benji Taylor's delight curve; Emil Kowalski's frequency gate).

| Tier | Examples | Motion budget |
| --- | --- | --- |
| **Every set** (hundreds a week) | Log set, well −/+, switching exercises, rest ticking, tab switches | ≤ 150ms, or none. No timers, no waits, no delight. Tabs never animate. |
| **Every workout** (a few a week) | Start, sheets, Finish, Done, toasts, expand/collapse | Standard: `enter` / `exit`, springs for gestures. |
| **Rare** (a few a month) | Week complete, first workout, a new PR, onboarding | The delight budget. `SPRING.pop`, `celebrate`. Still never blocks input. |

### Rules

1. **Respond within 100ms.** The first visible reaction to a touch lands within 100ms, in practice on the next frame. Press feedback starts on touch-down, never on release. Around 150ms people start to feel the delay, so no artificial timers, debounces or waits sit between a tap and its visible effect.
2. **Tap transitions finish within 200ms.** 280ms (`DURATION.change`) is only for changes you don't wait on: a number rolling, the theme crossfading. Input is never blocked by an animation, and every animation is interruptible.
3. **Animate changes, not arrivals.** No entrance animations when a screen or tab appears, no staggered list reveals, no skeletons or spinners for local data (it's instant). Only what *changed* moves.
4. **Small distances.** Enter from 8pt (`ENTER_OFFSET`) with a fade. Never from off-screen, never from `scale(0)`. Press scale is 0.97.
5. **No bounce unless a finger threw it.** Springs are critically damped (`SPRING.settle`) by default. A little overshoot (`SPRING.fling`, 0.8) only when the gesture carried momentum, with the finger's velocity handed to the spring. Real overshoot (`SPRING.pop`) only in the rare tier.
6. **Nothing teleports.** Things arrive from where they came from and leave the way they came.
   - A logged set rises from the wells (+8 → 0), because that's where the value came from.
   - Moving to the next exercise comes in from the right, going back from the left, matching the swipe and the strip order. A swipe follows the finger 1:1 and settles with its velocity.
   - A control that changes meaning morphs in place (`Log set` → `Next exercise` → `Finish workout`: the label crossfades, the pill stays).
   - Numbers that change roll (`StaggerValue`, `ProgressDelta`): `Set 2 of 4`, the week count, the 1RM and delta while scrubbing, the delta when the chart range changes, the rest clock on −15 / +15. Time passing never rolls: the countdown ticks plainly.
   - A sheet dismisses downward because it came from below. A toast leaves the way it entered.
7. **Haptic and visual on the same frame.** A haptic fires at the causal moment (the set lands, the detent catches), never when an animation finishes.
8. **Native navigation only.** Push, modal and sheet transitions are the system's. No custom page transitions, no parallax, no shared-element flourishes.
9. **No idle motion.** Nothing loops, pulses or breathes while the user isn't doing anything. The rest clock ticking is information, not decoration.
10. **Reduced motion:** movement becomes an opacity fade (`DURATION.fade`), celebrations become a color crossfade, and haptics stay.

### Approved motions

| Motion | Spec | Purpose |
| --- | --- | --- |
| Pill press | scale 0.97, `press`, ease-out, on touch-down | Faster |
| Row / text / glyph press | opacity `PRESSED_OPACITY`, immediate | Faster |
| Set logged | new line opacity 0→1 + translateY +8→0 (rises from the wells), ≤ 150ms | Fluid |
| Number changes in place | NumberFlow roll (`StaggerValue`), `change`, `EASE_OUT_FN` | Fluid |
| Set counter | `Set n of m`: n rolls (`StaggerValue` with `prefix`, `change`) when a set is logged, undone or picked to edit. A new exercise's page arrives with its own count already drawn; it doesn't roll, the page is the motion. | Fluid |
| Rest nudge | −15 / +15: the clock rolls to the new time in the nudge's direction (two NumberFlow runs `m` and `ss`, `change`; the seconds' tens wrap at 5), with a selection tick on the tap. The per-second countdown swaps plainly. Capped at 1.2× Dynamic Type like the plain clock. Reduced motion: the digits swap, the tick stays. | Fluid |
| Log stage swaps exercise | A tap (strip, `Next exercise`, auto-advance): same frame, enters from the side you moved toward (8pt, `press`). A swipe pages: the name and the stage are one position, with each neighbour's name, `Set n of m`, Last time and logged sets already drawn one page over (at 0.5 opacity one page away, brightening as it arrives; motion only, at rest neighbours are off-screen). The pan takes over after 14pt without jumping, tracks 1:1, commits on distance or a flick (projected ≥ 56pt), and hands the finger's velocity to `SPRING.fling`. The wells switch on release, while the page settles; grabbing a settling page takes it from where it is. A rightward swipe on a logged set belongs to the stage. | Fluid |
| Workout starts | Fresh Start only (not resume, not a Live Activity reopen): `Log set` rides up with the modal in the gray fill at 0.97 and lights green (fill + label crossfade `enter`, scale to 1 `press`) on the frame the modal lands, with one medium impact. Tappable throughout. Reduced motion: color only. | Loveable |
| Rest over | At 0:00 the clock gives way to `Go` in green in the same 28pt slot: the clock fades (`press`), `Go` rises 8pt with a fade (`press`) on the frame of the success haptic, −15 / +15 / Skip fade (`press`). Holds 2s, then Rest leaves (`press`). Reduced motion: crossfade. | Loveable |
| CTA changes meaning | label crossfade in place, `press` | Fluid |
| Expand / collapse in place | layout `enter` (200), ease-in-out | Fluid |
| Sheets | native (preferred), or `SPRING.fling` with gesture velocity | Fluid |
| Sheet content morphs | A row that opens detail inside a custom sheet (an Alternative in the exercise sheet) changes the sheet in place: its height glides to the new page's height as a native layout transition in the same frame the page mounts (`enter`, the iOS sheet curve `EASE_SHEET`, `AnimatedSheet morph`; never a JS-driven `height`, which starts late and steps), the old page fades out (`exit`) as a layer over the new one (never kept in the column, or the sheet would grow to both pages and shrink back), and the new fades in from 8pt on the side you moved toward (`enter`); Back reverses it. Reduced motion: height snaps, the fade stays. | Fluid |
| Toast | rise 8pt, `enter`; leave `exit` the same way | Fluid |
| Chart range change | the line morphs to the new range and the delta rolls to it, both `change`, with one selection tick on the tap (not on the selected chip, not on a locked one); never blocks scrubbing. Reduced motion: the line and digits swap, the tick stays. | Fluid |
| Appearance change | full-screen crossfade, `change` | Fluid |
| New plan lands in Plans | its row lights up edge to edge like a system list row's highlight (`systemGray5`, fade in `enter`-ish 180), holds ~700ms while the toast rises, then dissolves (520). Opacity only, so it stays under Reduce Motion. Once per created plan. | Fluid |
| Pro lock opens | the tapped chip's `lock.fill` becomes `lock.open.fill` on the frame the purchase lands, holds ~900ms, then fades (`exit`). Once per purchase. | Loveable |
| Week dot fills | On Done: `SPRING.pop` 0.5→1 + two green rings (×3.4, 0.45→0, 760ms, 140ms apart) while `n of m` rolls up. A full week adds a staggered bump across all dots. Starts on the frame the Done modal finishes sliding in (`transitionEnd`), once per workout. Home then just shows the new amount. Reduced motion: the dot's color crossfades. | Loveable |
| PR crown lands | On Done, each PR exercise's crown pops in (`SPRING.pop` 0.5→1 + fade) 160ms after Done lands, 70ms apart, the last by 440ms. Reduced motion: a fade. | Loveable |
| Milestone rolls up | On Done, `10th workout` rolls from `9th` with NumberFlow (`change`) as Done lands. | Loveable |

Anything not on this list needs a purpose, a spec, and a row here before it ships.

### Haptics

A haptic confirms something the body did. It's never decoration.

| Moment | Haptic |
| --- | --- |
| Set logged | light impact |
| Rest reaches 0:00, Finish | success |
| The log lands from Start (`Log set` lights up) | medium impact |
| A Pro purchase lands (the `Trim Pro is on` toast) | success |
| Well −/+, rest −15 / +15, swiping between exercises, picking a paywall option, picking a chart range | selection |
| A sheet snapping to a detent | light impact |
| Scrubbing a chart across a data point | selection |

Nothing else buzzes. No haptic on navigation, toggles, errors or celebrations.

---

## 9. Copy

Trim's text is **names, numbers, facts and verbs.** If a string isn't one of those, it probably shouldn't exist.

### Allowed

| Kind | Example |
| --- | --- |
| Name | `Push`, `Bench Press`, `Upper A` |
| Number with unit | `60 kg × 8`, `4 × 8 reps`, `3 × 30s`, `1:32`, `52 min` |
| Fact caption (passes the eyebrow test) | `Today`, `this week`, `Rest`, `Last time 60 kg × 8`, a month name |
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

### Separating facts (no middle dots)

` · ` between facts is a slop marker: every generated interface uses it. Trim separates facts the way a well-set page does, in this order of preference:

1. **One fact.** Cut until one is left. Home says `~55 min`, not `Push Pull Legs · 6 exercises · ~55 min`.
2. **Lanes.** The second fact goes to the trailing lane: `August` on the left and `4 sessions` right-aligned. A History row has `Push` over `Today` on the left and `52 min` trailing.
3. **Lines.** Two facts that both matter stack on two lines.
4. **Language.** Join the way a person would say it: `4 × 8 reps at 60 kg`, `Barbell, chest`, `Bench Press, Incline Press and 2 more`, `On, renews 3 Oct`.

Never `·`, `•`, `|` or ` / ` as separators.

### Slop markers

These make an interface look generated, cheap or subscription-bait. They're banned everywhere, money screens included:
- **Glyphs:** middle-dot separators, em dashes in sentences, emoji, sparkle icons (✨), arrows in button labels (`Continue →`).
- **Copy:** buzzwords (`Unlock`, `Supercharge`, `Level up`, `Elevate`, `Seamless`, `Journey`), Title Case Headlines, checkmark-bullet feature lists, `Most popular` badges (state the saving instead), 01 / 02 / 03 step numbers.
- **Visuals:** gradients (fills, text, buttons), glassmorphism in content, drop shadows on cards, everything centered, pill tags on everything, stock or AI illustrations, confetti.

### Style

- **Sentence case** everywhere, including titles (`Next workout`, `Other days`). The one exception is the product name, `Trim Pro`.
- **Buttons are verbs:** one or two words, three at most. The label says what happens, so `Delete plan`, not `OK`.
- **Numbers:** a unit on every load (`60 kg × 8`). Prescriptions name the reps (`4 × 8 reps`). `×` joins load and reps or sets and reps. `—` marks an empty value, and only there. `−` (minus sign) is used in steppers. Times are `1:32` and `52 min`. Estimates are `~45 min`.
- **Dates:** `Today`, `Yesterday`, `Wed 13`, `August`. No year unless it isn't this year.
- **Alerts** are only for actions that can't be undone (§10 → Forgiveness). The title names the action and the object (`Delete “Push”?`). Add a message only when the consequence isn't obvious (`This deletes every completed workout on this iPhone.`). The buttons are `Cancel` + the verb (`Delete`).
- **Toasts** confirm a result that isn't on screen yet (`Check-in saved`), or offer Undo for something that just happened (`Plan deleted` + `Undo`). Never errors, never things already visible.

---

## 10. Components

Use these. Don't rebuild them per screen.

| Component | File | Rules |
| --- | --- | --- |
| `Button` | `components/button.tsx` | Variants: `black` (ink CTA), `green` (gym CTA), `gray` (secondary pill), `plain` (text action, `body`), `destructive` (red text). Pill height ≥ 52, `button` label. `compact` (32) only for inline chips. `filled` (blue) is deprecated. At most one filled pill per screen. |
| `HeaderActions` | `components/button.tsx` | Header items are native toolbar buttons. Never a custom pill in a header. |
| `PaperScreen` | `components/paper.tsx` | Page scaffold for screens without a native large title: 24 gutter, safe-area top + 24, scroll. |
| `PaperRow` | `components/paper.tsx` | `row` + optional `caption` meta, and an optional leading `symbol` for command and setting rows only (§7). The trailing lane holds a value, mark, ↗ or chevron. Pressed = `PRESSED_OPACITY`. A `link` row (leaves the app) gets link role + ↗. |
| Object surface | per screen | `secondarySystemBackground`, `radius.md`, 16 inset. Only when its contents form one unit (exercise list). Not on every row. |
| Section caption | — | `caption`, 8 above its content, 32 above from the previous section. Only if it passes the eyebrow test. |
| `PaperEmpty` | `components/paper.tsx` | Under the native large title: the fact in `title` (`No plans yet`) + one ink action if one exists. No caption. |
| Well | `screens/log-workout.tsx` | `secondarySystemBackground`, `radius.md`. Tap number → system keypad. −/+ for small steps. Focused: page fill + 2px `label` ring. |
| Sheets | native `formSheet`, `components/animated-sheet.tsx` | Grabber, title (`title`), content. Dismiss by drag. No Close link unless there's no drag (forms get Cancel/Save in the header). |
| Context menu | native | Secondary object actions. The destructive item is last and red. |
| Alert | native | Only for irreversible actions (see Forgiveness), plus the rename prompt below. |
| Rename | `navigation/rename-prompt.ts` | One pattern for every name Trim lets you change (a plan, a day): `Rename` in the row's context menu (Plans, plan detail) or the editor's own `Rename plan` / `Rename day` row (`pencil`) opens the system text prompt, prefilled. The name stays the page's native large title; it is never an inline field. `Cancel` + `Save`, both gray (a preferred `Save` would be the system blue), Return saves, in Trim's own light/dark. An empty or unchanged name keeps the old one: nothing is ever blank. A new plan asks `Name this plan` once, after it slides in. A new day is named `Day n` and renamed like any other. |
| `Toast` | `components/toast.tsx` | Inverted ink pill above the tab bar, one at a time. Confirm: green check + result, ~2s. Undo: result + `Undo` (bold), ~5s, swipe down to dismiss. |
| Chips | `components/window-chips.tsx` | Segmented choice of a range (3M, 6M, YTD, All). Selected: ink fill. |

### Forgiveness: Undo over "Are you sure?"

A confirmation dialog slows down everyone to protect the few who slipped, and people learn to tap through it. So:

| The action | Treatment |
| --- | --- |
| **Recoverable** (the data can come back): delete a plan (it's archived), delete a day, remove an exercise from a day, delete a logged set, discard an edit | Happens immediately. An Undo toast offers it back for ~5s. |
| **Irreversible**: delete a completed workout, Clear history, discard a workout that has logged sets | Native alert that names the thing, `Cancel` + the red verb. |

### Standard gestures, always paired

"No gesture hints" only works because every hidden action has the standard iOS path people already know. Every action reachable by a gesture has at least two ways in:

| Action | Paths |
| --- | --- |
| Delete a row | Swipe left (full swipe commits) + context menu |
| Secondary actions on an object | Long-press context menu + a visible row or button on the object's own detail screen |
| Reorder | A visible drag handle (`line.3.horizontal`) in the list where reordering happens |
| Go back | Edge swipe + back button |
| Close a sheet | Drag down + a header action on forms |
| Move between exercises | Swipe the stage + tap a strip chip |

No custom gestures (double-tap, two-finger, shake) for anything.

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

## 11. Charts

The Trade Republic part of Trim. A chart answers one question: is this going up?

1. **One line, no chrome.** One line in `label` ink, 2.75pt, round caps and joins. No gridlines, no y-axis labels, no legend, no fill, no markers on every point. Straight segments between sessions. No smoothing that invents values between them.
2. **The number is the axis.** The `hero` above the chart states the value. The delta beside it is green if up and ink if flat or down (never red). Body measurements have no good direction, so their delta is always ink. The x-axis shows only the first and last date (`footnote`).
3. **Scrub to read.** Touching the chart shows a vertical hairline and a dot on the line. The hero rolls to that point's value, the delta becomes change since the start of the range, and the date appears where the range label was. A selection haptic ticks at each data point. Releasing rolls everything back to now.
4. **Endpoints.** The latest value gets a small dot. With fewer than 6 points, every point gets a dot, because a line through three sessions implies data that isn't there.
5. **Y-range fits the data** in the selected window with ~10% padding, and never starts at zero. A line is about change, and zero flattens it.
6. **Range first.** Range chips (`3M 6M YTD All`) sit under the title, above the hero, like Health, Fitness and Stocks: the range scopes everything under it (the delta, the line, the sessions), so it's read first, and the hero stays directly on top of its line. Pro ranges show a 13pt lock and open the paywall. The chart itself is never blurred or hidden.
7. **Changing range** morphs the line (`change`, 280). Scrubbing stays possible during the morph.
8. **Sparklines** in Progress rows follow the same rules without dots, hero or dates: 1.5pt ink line in the trailing lane.
9. **One session** shows the value as the hero and a single dot. No sentence explaining that more data is needed.
10. **VoiceOver** gets a summary label (`Estimated 1-rep max, 95 kg on 3 Jun to 102.5 kg on 14 Sep`).

---

## 12. Selling: moments, onboarding, paywall, Pro gates

### Everything is a sale

Making money isn't evil, and helping someone decide isn't either. But the sale doesn't start at the paywall. It starts the second someone taps the icon for the first time, and every interaction after that is the store clerk. One careless moment (a stutter, a confusing label, a nag) costs more than any paywall tweak can win back. So the product is the salesperson: every detail in the free app is treated with the same care as the paywall. That doesn't mean CTAs everywhere. It means nothing anywhere is careless.

We study the highest-converting apps and use their principles, never their dark patterns, and always in Trim's own look. Our onboarding and paywall never look like a subscription-slop app. We're here for the long term: the goal is someone who's glad they paid a year from now.

### Moments

Some moments deserve a feeling, not just a result. They're the rare tier (§8), so they get the delight budget.

| Moment | What happens |
| --- | --- |
| **First open (unpacking)** | The Trim mark builds itself: three bars trim down into place, the shortest one turns green with a light haptic, and the wordmark settles in beside them. Then the welcome line. |
| **First plan ready** | The plan's week lays out: one dot per training day, filling left to right, then Start appears. The plan the user built is the reward. |
| **First workout logged** | Done carries the fact `First workout` under the hero, and the first week dot fills with the pop as Done lands. |
| **First Pro purchase** | The lock on whatever they tapped opens (`lock.fill` → `lock.open.fill`, then it fades), the thing they wanted happens, and a toast confirms `Trim Pro is on`, with a success haptic. Settings shows Trim Pro with its renewal date. |
| **A new personal record** | The crown lands on the PR exercise's line with the pop on Done, and that line reads in `label` ink. |
| **Week complete** | The week-dot celebration on Done (§8), with the bump across every dot. From two full weeks in a row, `4 weeks in a row` rolls up from 3 beside the dots (it appears when it reaches 2). |
| **Milestones** (10th, 50th, 100th workout) | Done states the fact (`100th workout`), with the number rolling up. No badges, no trophy screen. |

Rules for every moment:
- **Once.** Each "first" happens once in a lifetime (a persisted flag). Milestones happen once each.
- **After the action lands, never in its way.** Input is live throughout, and a tap anywhere continues.
- **Short.** 1.2s at most from start to rest.
- **Built from Trim's own parts:** the bars, dots, check, crown, lock, green, and the NumberFlow roll. No confetti, emoji, stickers, mascots, fireworks or sound.
- **One haptic**, success or light, on the frame the moment lands.
- **Words stay facts** (`First workout`, `100th workout`). No `Congrats!`, no `You crushed it`.
- **Reduced motion:** the moment becomes a crossfade, and the fact and the haptic stay.

### Onboarding

1. **Every question changes the product.** Units, days a week, pick a plan: each answer shapes the plan they leave with. Asking is also investment, because the plan they helped build is theirs. No questions for marketing or vanity (no "What's your goal?" unless the answer changes the plan). No "How did you hear about us?".
2. **Value before asks.** It ends with a real, active plan the user picked, and Start is one tap away. No account, and no notification or Health permission prompts during onboarding. Ask for a permission at the moment it's needed (Live Activity at the first rest timer), with the system prompt only.
3. **Short.** Five screens or fewer, under a minute. One question per screen (`displayCompact`), choices as rows, ink Continue at the thumb. Back always works and keeps the answers.
4. **Descriptions describe options, not the UI.** A plan choice may carry one `caption` line saying what it is (`Upper and lower body, twice each`), because the name alone can't. Nothing explains how to use the screen.
5. **Unpacking, then plain and fast.** The first open is a moment (see Moments). Every step after it is plain and fast.

### Paywall

What we take from the best converters, done Trim's way:

6. **Right after value.** The paywall appears only at the four moments (`PRODUCT.md` → Trim Pro): the end of onboarding on the template path (their plan is ready), once after the first completed workout, a Pro-locked tap, and Settings. Never during a workout, never on launch, never twice for the same moment. The post-workout paywall counts only once prices have rendered.
7. **Their context, not ours.** The headline speaks to why they're here: their plan after onboarding, the feature they tapped at a gate. One headline, no subheading, no superlatives, no exclamation marks.
8. **Outcomes, not features.** One row per Pro feature: symbol tile, `row` title, one `caption` line of 45 characters or fewer, written as what they get (`Weight and reps for every set`). At most four rows. No checkmark-bullet lists.
9. **Two choices, one clear default.** Annual and monthly, annual preselected. Its saving is stated as a real fact computed from the two StoreKit prices (`Save 52%`), never an invented reference price.
10. **Prices are the truth.** Every price comes from StoreKit through RevenueCat, shown in full with its period (`$39.99 a year`). A monthly equivalent may sit beside the annual price, never instead of it. No per-week or per-day framing, and no strikethrough prices that were never charged.
11. **The trial is a timeline, not a promise.** Today (`lock.open.fill`, ink) → the charge day with its date and amount (`creditcard.fill`, grey). The CTA says what happens: `Start free trial` or `Subscribe`.
12. **Real proof only.** Social proof appears only when it's true and strong: the live App Store rating once it's 4.5 or above with at least 100 ratings, shown as a fact (`4.8 on the App Store`). No invented testimonials, no user counts we can't back.
13. **Leaving is always easy.** `Not now` is visible from the first frame, on glass, top right. No delayed close button, no second "are you sure" paywall, no guilt copy. Restore, Terms and Privacy sit under the CTA.
14. **Never:** countdowns, "only today" offers, fake scarcity, pre-selected add-ons, a pulsing or animated CTA, a close button that fades in late, or a paywall that re-opens itself.
15. **Trim's look.** The same type ramp, an ink CTA (never green: green means done or go in the gym), no gradients, no illustrations, no hero images. One visual device, the trial timeline, because it explains something.
16. **One screen.** Everything, CTA and legal line included, fits above the fold on a 6.1" iPhone at default text size.

### Buying

17. **The purchase is a moment** (see Moments). Within 100ms of Apple's confirmation, the lock opens and the gated action completes: the second plan starts being created, the range switches. The paywall closes back to where they were. No "Welcome to Pro" screen.
18. **Cancel and failure are quiet.** If they back out of Apple's sheet, the paywall stays as it was, with no message. A failure says what happened in one line and offers `Try again`.
19. **Restore is instant and certain.** It finishes in place with a toast (`Trim Pro restored`, or `No purchases to restore`).

### Pro gates

20. **Locked, not hidden.** A Pro feature stays visible where it lives (a chip, a row, `+`) with a 13pt `lock.fill` where there's room. Tapping it opens the paywall for that reason. Never blur or grey out the user's own data.
21. **Free stays whole.** Logging, history and the current plan are never gated, interrupted or nagged.

### Changing a money screen

22. **One change at a time, with a number.** Every change to onboarding or the paywall names the metric it should move (onboarding completion, `paywall_viewed` → `purchase_finished`, trial starts) and ships alone, so its effect can be read in PostHog. Keep events free of workout contents.

---

## 13. Per screen

Same system, different winner. Don't invent a type size for a screen.

| Screen | Structure | Green |
| --- | --- | --- |
| **Home** | The day name is the screen's native large title (`Push`), collapsing into the glass bar on scroll. Under it, one fact: the estimated duration (`~55 min`, the median of the last three sessions of this day, else the prescription estimate). No `Next workout` heading, no plan name (Plans owns it), no exercise count (the list shows it). Exercise list as one object surface: `row` name + `caption` prescription (`4 × 8 reps at 60 kg`), no thumbnails. After ~4 rows, a peer row `n more exercises` + chevron.down that expands in place and ends with `Show less`. Ink Start sits 16 under the list. Week (`title` `n of m` + `caption` `this week` + dots, then `4 weeks in a row` once the streak is 2+) one `section` below. Then `Other days` caption + rows (title `row` + first exercise names `caption`; trailing green check if done this week). Tap another day → its preview sheet. The exercise list is read-only (its fold is the only way to see more). | Completed dots + checks |
| **Day preview** (sheet) | Day `title` + its duration `caption` (`tight`), rows `row` + `caption` (`inset` apart), read-only. Ink Start at the thumb. One inset, `gutter` (24), on every edge and between title, list and Start; under Start only the sheet's own bottom safe area (never add the window's inset again: on iOS 26's floating sheet that doubles it). | None |
| **Log** | Header: Cancel (`body`, tertiary) left, Finish (`button`) right. Strip: chips, checks on finished exercises. Exercise name `displayCompact` (tap → exercise sheet), `Set n of m` `title`, `Last time …` `caption`. Logged sets grow below as `value` lines in `secondaryLabel` with a green check. Footer (flex-end): Rest (`caption` `Rest` + the clock in `value` 28, with −15 / +15 / Skip as `caption` on the baseline; above the wells, eats air; at 0:00 the clock becomes a green `Go`), wells (labels `footnote`, numbers `displayCompact`), green `Log set` (on a fresh Start it lights up as the log lands, §8). Exercise sheet: facts, then Alternatives rows with a chevron that open that exercise's facts in place, with Back and an ink `Use this exercise`; only that swaps. The upper stage never moves (§14). | `Log set`, checks, `Go` |
| **Done** | A moment, not a report. `Done` `hero`, then the day and duration on one `caption` line joined in words (`Push, 52 min`), plus a first-time or milestone fact in `label` ink when there is one (`First workout`, `10th workout` rolling up). `pause` below, the week this workout moved (`WeekProgress`: `title` `n of m` + `caption` `this week` + dots; the new dot fills with the pop as Done lands), only when the workout is a day of the active plan and the plan has 2+ days. `section` below, per exercise `row` name + **one** `caption` line in `secondaryLabel` (`DoneExercise`): `4 × 8 reps at 60 kg` when every set matched, else `4 sets, best 85 kg × 8`; a PR line reads in `label` with its crown landing. Every set lives in session detail. Green Done at thumb, live from the first frame. Scrolls, uncapped. No haptic of its own: Finish already gave the success. | Done |
| **Plans** | Native large title + toolbar `+`. Active plan first, as a `title` row with `6 days` on the left and a green `Active` trailing. Other plans as `row` + `caption`. Long-press: Use this plan (`(Pro)` when locked) / Rename (§10) / Delete (immediate, with Undo). Swipe left to delete. No icons, no permanent edit chrome. | `Active` |
| **Plan detail** | Plan name as the native large title, `6 days` under it (+ green `Active` trailing). Days as `row` title + `caption` exercise names in words (`Bench Press, Incline Press and 2 more`, 2 lines max). `Add day` as a quiet row. Long-press a day: Rename (the prompt, in place, no push), Duplicate, Move up / down, Remove. `Rename plan` (§10 Rename; a new plan asks `Name this plan` once). `Use this plan` ink if not active. `Delete plan` red, last. | `Active` |
| **Day editor** | Day name as the native large title, `4 exercises` under it. Exercise rows: `row` name + `caption` prescription; tap one to open its Sets / Reps wells in place. `Add exercise` as a quiet row. Then `Rename day` (§10 Rename) and `Remove day` red, last (only when the plan has more than one day). | None |
| **Progress** | Native large title. Lift rows: `row` name + `caption` latest, sparkline and chevron in the trailing lane. Body row the same. | Up-delta only |
| **Lift / body detail** | Lift name `title`, range chips (3M free, rest Pro-locked), 1RM `hero` with unit, delta (lifts: green if up, ink otherwise; body: always ink), chart, sessions list right under the line. Charts follow §11. | Up-delta only |
| **History** | Native large title. Month as a section caption with its amount in the trailing lane (`August` … `4 sessions`). Session row: `row` title over `caption` when (`Wed 13`), duration trailing (`52 min`), and the PR pill (gray fill, yellow crown, count) beside the duration when there is one. Hairlines within a month, `section` air between months. Swipe left or long-press → Delete (confirms: a workout can't come back). | None (yellow crown) |
| **Session detail** | Back, workout title as the native large title, facts on two lines in `caption` (`Wed 13 September, 18:02` / `52 min, 14 sets`), every set of each exercise on its own line (`RecapExercise`: narrow tertiary set-number lane + `60 kg × 8`, crown on the PR set). A record, not a ceremony: no green, no Done button. | None |
| **Settings** | Native large title. `PaperRow` groups separated by `section` air, each row led by its glyph (§7 command and setting rows): (Weight, Appearance), (Trim Pro, Restore purchases), (Contact support ↗, Privacy Policy ↗, Terms of Use ↗), (Clear history, red). Values trail in `caption` (`On, renews Oct 3`, or `On until Oct 3` once renewal is off; dates as elsewhere in Trim). | None |
| **Paywall** | Follows §12. `Not now` top right as a native toolbar item on glass, content scrolling under it with the system scroll-edge effect. Headline `displayCompact`, no subheading. Benefit rows: 36pt tile (`radius.sm`, symbol) + `row` title + one `caption` line (≤ 45 chars), all titles on one text edge. Plan options, then the trial timeline (ink `lock.open.fill` today, grey `creditcard.fill` on the charge day). Footer: ink CTA, price note `footnote`, then Restore, Terms and Privacy as three quiet `footnote` links separated by air (no dots). All above the fold on a 6.3" phone. | None |
| **Body check-in** | Native `formSheet`: Cancel, title and Save in one header row (Save disabled until a value). Fields scroll with the keyboard inset. Save closes and toasts `Check-in saved`. | Dot on fields that will save |
| **Onboarding** | Follows §12. One question per screen: `displayCompact` question, choices as rows or a `hero` number, ink Continue at the thumb. Welcome: `hero` wordmark + `lede` `A plan. Then the gym.` Always ends with a real plan the user picked. | None |

### Home week details

- The week celebrates on Done, where the workout lands (§8 Week dot fills). Home shows the amount without ceremony; a lower count (a deleted workout, a new week) crossfades its dots back to grey.
- Week progress is an **amount**, not a sequence. Every finished workout counts, a repeated day too; Other days' checks say which days. `n of m` + dots, never a day-name checklist, and one progress language per section.
- **Streak:** full weeks in a row trail the dots as a `caption` fact (`4 weeks in a row`, `inline` after the last dot), from two weeks up, on Home and Done. A week in progress doesn't break it. No flame, badge or streak screen (PRODUCT-DECISIONS 51).

---

## 14. Log stage

The hardest screen and the reference for all the others. Don't copy its layout onto other screens. Copy its rules.

1. **The frame never jumps.** The exercise name, `Set n of m` and Last time are pinned from the top. Logged sets grow downward into air. Rest inserts above the wells and eats leftover air, never the title. Glyphs may crossfade, but the frame doesn't move.
2. **Type to jump, tap ± to nudge.** Tap a well's number → system `decimal-pad` (weight) or `number-pad` (reps). −/+ are for small gym steps (+2.5). Never make steppers the only path from 0 to 100.
3. **The keyboard docks the cluster.** Wells + `Log set` (+ Rest) ride above the keyboard via `react-native-keyboard-controller` (`translateY` from `useReanimatedKeyboardAnimation`) on the footer only. The upper stage stays put. Don't build a custom keypad.
4. **Prefill proposes, Log set commits.** Wells show last time's values. Nothing is logged until the user taps.
5. **Swipes page, taps jump.** Name and stage move as one page with the neighbours already drawn, so a swipe never reveals an empty or popping page. The strip stays put; it's the index.
6. **Don't** use set-number circles, a `Previous sets` card, 10RM as chrome, or `80 × 8` at calculator size as the hero.

---

## 15. Do not

Tables, status pills and badges (the History PR pill is the one exception), set-number circles, overlapping pills, heatmaps, achievement chrome, plan or exercise icons and thumbnails, decorative icons, hierarchy-only eyebrows, uppercase labels, motivational copy, helper text, gesture hints, gradients, shadows, bordered cards, chevrons on action rows, blue links, custom transitions, entrance animations, spinners for local data, middle-dot separators and the other slop markers (§9), sounds, confirmation dialogs for recoverable actions, gesture-only actions, custom gestures, opaque or recolored system bars, glass in content, chart gridlines and axis labels, lime green, Inter or any non-system font, off-ramp sizes and spacings, hex literals outside `theme.ts`.

---

## 16. QA

Before a screen ships, check it in light **and** dark, at default and at the largest capped Dynamic Type size, one-handed at arm's length, against this file and the Paper artboard. `npm run check` must pass.

1. **Job.** Say the screen's job in one sentence. Point to the one winner and the one primary action.
2. **Type.** Every text uses a role from §3 without size or weight overrides. There's one stage size. Numbers use tabular figures.
3. **Space.** Every gap is a `space` token and reads as the right relationship. Under a native large title everything shares the title's edge (`space.margin`) and follows §4 Under a large title; elsewhere the margins line up on the 24 gutter.
4. **Color.** Captions are tertiary. There's at most one filled control, and green only means done or go. No blue in content, and no opacity used as color.
5. **Copy.** No helper text, instructions or summaries. Every caption passes the eyebrow test. Sentence case.
6. **Icons.** Each one encodes something. It has the right size for its neighbor and the right color for its meaning.
7. **Motion.** Every animation is on the approved list. A tap shows a reaction within 100ms, its transition finishes within 200ms, and it degrades under reduced motion. Nothing animates on arrival.
8. **Control.** Nothing happened that the user didn't ask for (`PRODUCT.md` → Control). Recoverable deletes offer Undo, irreversible ones confirm. Every gesture has a visible second path.
9. **Selling.** Onboarding, paywall and gates pass §12: honest price, visible exit, no pressure. Moments fire once, after the action, in Trim's own parts. No slop markers.
10. **Gym.** Everything used mid-workout is in thumb reach. Leaving for another app and coming back lands on the same state with no animation. Nothing makes a sound.
11. **Log only.** The upper stage doesn't move between set 1, rest, later sets and keyboard open. The keyboard never covers the wells or `Log set`.
12. **Taste.** It reads as Trim, not as Hevy, Strong or Alpha Progression.

---

## 17. Enforcement and migration debt

**Enforced automatically.** `mobile/scripts/check-design-tokens.mjs` scans `mobile/src` for raw font sizes and weights, hex colors, off-scale and raw spacing, raw radii, durations, pressed opacities and icon sizes, and gesture-hint copy. It compares the counts with `mobile/design-tokens-baseline.json`, and it fails if any file gains a violation. Run `npm run check` (tsc + tokens) before every push. The GitHub Action `.github/workflows/checks.yml` runs it on every PR. When you clean a file up, run `node scripts/check-design-tokens.mjs --update` so the baseline ratchets down. Never raise the baseline to make a check pass.

**Status (28 Sep 2026, after PR #46 and `v2-migration-2`).** Already on v2: Home, day preview, Weeks, History, session detail, Done, Progress and lift/body detail, the paywall's purchase moment, restore toasts, native large titles on Plans, plan detail and Settings (`navigation/large-title.ts`), the system glass tab bar, native bars on Progress detail and the paywall, and the day preview as a native `formSheet`. No ` · ` separators or gesture hints are left in `src`. Plan, day and exercise deletes are immediate with an Undo toast (`useUndoableDeletes`, `Toast` with `onUndo`). The progress chart draws straight segments with ~10% y-padding, and its dots ride the line through a range change. Don't redo them; fix only what's listed below. The per-file counts of what the script can see are in `mobile/design-tokens-baseline.json` (8 violations in 7 files).

Still to do. Fix it when touching a screen, or in a dedicated pass with simulator QA:

- **Tokens (script-checked):** 8 left: the check-in sheet header's 600 weight (no 17 Bold non-button role fits a sheet header yet), `button.tsx`'s compact label, and optical offsets to check on device (`PaperGrabber` top 6, the log's chevron fallback, the rest controls' baseline, the strike-through and lock-fallback radii).
- **Liquid Glass:** the log's day and exercise sheets still use `AnimatedSheet`; making them native `formSheet` routes means moving their state (reorder, jump, swap) out of `log-workout.tsx`. Tab bar, Progress detail bars, the paywall's Not now and the day preview are native.
- **Charts (check on device):** the delta's alignment beside the `hero`, and the label under the hero wrapping at large text (the chart must not move when scrubbing starts).
- **Words native:** every tab root, plan detail, the day editor and session detail use the native large title (the day editor since sprint 2026-09-29, when its title stopped being a field). Native titles sit at iOS's margin, and the content under them moved to that margin (`space.margin`, §4 rule 1) instead of the 24 gutter (Sep 29, 2026). Progress still needs the switch (`progress-tab.tsx`). The exercise picker has the system bar with an inline title (its search field sits under it); `PaperBack` (`components/paper.tsx`) has no callers left; remove it.
- **Moments:** unpacking and first plan aren't built. The week streak is (PRODUCT-DECISIONS 51). The paywall's savings fact is built (`Save 52%` from the two StoreKit prices); real-rating proof waits for 100+ ratings at 4.5 or above (§12.12).
- **Paper:** update the artboards to this ramp (caption 15 Regular tertiary, footnote 13) and to the v2 Home, so Paper and code agree again. Paper page "Home round 3 (2026-09-28)" is pre-v2 and superseded.
