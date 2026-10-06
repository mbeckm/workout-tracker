---
name: trim-ui
description: Trim's design system for the device (Gadget) redesign - principles, the three layers (device, sheets, moments), finishes, type, geometry, color, motion, haptics, sounds, copy, components and per-screen specs. Use when designing, implementing or QA'ing anything in mobile/ (the device modes, every sheet, the receipt and other moments, onboarding, the paywall).
---

# Trim design system

Trim is a tool you use between sets, in a gym, for years. It is one object: a metal device with a dot-matrix display, keys, a rocker, one wheel and a big round key. Lists and numbers live on dark, flat sheets that slide up over it. The physical style comes back only for a few earned moments. Very little on screen, big confident numbers, one brand hue, and the essential action always one press away.

This file is the rulebook, and the device is built: this file, then the shipped code in `mobile/src/device/`, are the source of truth. `design/gadget/` (PLAN with decisions §2 and defaults D1–D22, SPEC, the prototype, the boards, `screens/*.jpg` and `frames/`) is how it was specified, kept as history and as visual targets; where the code deliberately differs (noted in the sections below), the code wins. Product rules are in `PRODUCT.md` (Principles, Control) and `PRODUCT-DECISIONS.md` (decision 73, "The device"). Paper and screenshots of the old app are obsolete for UI.

Tokens live in `mobile/src/constants/theme.ts`: the device palette per finish (`finishColors`, `deviceColors`), the `lcd`, `sheetColors` and `signal` palettes, the type roles (`gadgetType` plus per-surface roles such as `logType`, `plansType`, `progressType`, `onboardingType`), the geometry blocks (`device`, `sheetGeometry`, `gadgetRadius` and per surface), and `space`, `spacing`, `radius`, `iconSize`, `PRESSED_OPACITY`, `TOUCH_TARGET`, `fontScaleCap`. Motion lives in `mobile/src/motion.ts`: the `DEVICE` durations and easings and `REST_GO_MS`. This file describes tokens by role; the code names them.

History: the indigo brand hue, the native tab bar, Liquid Glass, light and dark appearance and the system-font-only rule were replaced by decision 73. The old app is at git tag `archive/pre-gadget`.

Every rule has a reason. When a case isn't covered, apply the reason, then add the rule here.

---

## 1. Principles

1. **One surface, one job, one primary action.** Each device mode has one job and one big key. Each sheet answers one question. Anything else moves a layer down (§2) or goes away.
2. **Fast is the feature.** Launch to the first logged set is two presses (Start, Log). A prefilled set is one. Nothing we add may cost the loop a press or make it wait (`PRODUCT.md` → Principles).
3. **The interface explains itself.** No helper text, gesture hints or summaries, on the display or in sheets. If something needs a sentence, the layout is wrong.
4. **The display shows only what the control in use needs.** The device is the screen, and it carries no labels beyond the display and the small engraved labels. Information appears while a control is in use (the wheel's KG label, the rest ring), and the wheel stows when it has no job.
5. **Layout carries hierarchy.** Size, brightness (amber, dim, off) and position say what matters. Labels that only restate hierarchy are banned.
6. **Three layers, never mixed.** Device: physical metal, raised keys, a recessed display. Sheets: flat and dark. Moments: physical 3D objects on a dark grid. A sheet never gets a bevel, and the device never gets a flat list.
7. **Color is a signal.** Orange marks action, current and selected. Green means done, yellow means record, and ordinary change is ink with ↑ or ↓ (§5). Each signal has exactly one meaning.
8. **Motion and sound earn their place.** Every animation, haptic and sound makes Trim feel faster, more fluid or more loveable, and names which. Nothing waits on an animation (`PRODUCT.md` Principle 7).
9. **The user is in control.** The device never acts on the user's behalf (`PRODUCT.md` → Control). Timers inform, they don't act. Slips are forgiven with Undo, not prevented with dialogs.
10. **Built for the gym.** Every rule is checked against the setting below.
11. **The moment decides the surface.** Ask why someone opens it right now and cut what doesn't serve that moment. Rare tasks live where they're rare (plan editing in the editor sheet, not on Home).
12. **Surfaces reflect what just happened.** Home's rows are stamped when a day is done, the lamps fill, the receipt prints. One layout, many states.
13. **Your numbers first, and show the change.** The user's own values lead; the plan's prescription is dim. Where there's a previous value, show the difference.
14. **Say each fact once.** If a mark already says it (a lamp, a stamp, a ✓), the words go.
15. **Visible over hidden.** Every key shows what it does now (a glyph or a word), and the same position means the same family of action in every mode (§2 Key map).
16. **Size for the real maximum.** Lay out for the realistic worst case (8 lifts, 7 days, a 1000 kg drum, a long exercise name), not the demo (PLAN §7).

### The setting

| Fact | So |
| --- | --- |
| **Artificial light, arm's length.** The phone is held out, on a bench, or in a shaking hand. | What you act on is amber on the display or ink in a sheet, both well above AA (§5 Contrast). The numbers you act on are 56 or larger on the display. Dim text carries only secondary facts. |
| **Short, frequent visits.** Open, log, leave for music, come back 90 seconds later. | Resume exactly where they left off, on the first frame: the device is already in log or rest mode. No launch animation, no re-entrance of content. A moment interrupted by backgrounding finishes instantly on return. The Live Activity carries the workout while they're away. |
| **Music and headphones.** Something is always playing. | Sounds are short, dry and mechanical, play through the ambient audio session (mixed with music, silenced by the silent switch) and can be turned off in Settings. Trim never takes the audio session. Confirmation is visual plus haptic first. |
| **One hand.** The other hand holds a bar, a bottle or a towel. | Everything used during a set is in the bottom row: the reps keys, the big key, the wheel. Ending a workout is a 1.1 s hold on the big key, so it can't happen by a slip. Sheets come up from the bottom. |
| **Audience.** Serious lifters, mostly young. Not an accessibility-first product. | It must still work for people who don't see well: sheet text follows Dynamic Type up to the caps (§3), VoiceOver labels everything, and every key and the wheel are real accessibility elements (§10). |

---

## 2. Structure and progressive disclosure

### Three layers (SPEC §1)

| Layer | What | Style |
| --- | --- | --- |
| **Device** | The persistent home of the app: body, keys, display, rocker, wheel, big key. It runs Home, logging, rest, finish, plan-number editing and the loading state. | Brushed metal in the user's finish, raised keys, a recessed display with orange dot-matrix text (Doto). The only body text is the small engraved labels (`WEEK 12`, `KG`, `REPS`, `TIME`, `SETS`). |
| **Sheets** | Everything list- or number-heavy: menu, Today, exercise, plans rack, editor, add lifts, progress, lift detail, body, history, receipt, finishes, settings, keypad. | Flat and dark, SF Rounded, rounded cards, orange for action and selection. One sheet at a time slides up over the device; the device stays visible above it except under the tall sheets. |
| **Moments** | Cartridge insert, receipt printing, cartridge filing, stamps, the finished-week spike, onboarding, the paywall knob, the finish picker in onboarding. | Physical 3D objects on a dark grid ground. Rare, earned, under 4 s, skippable, replaced by fades under Reduce Motion. |

Information lives on the lowest layer that serves the job:

| Level | Holds | Reached by |
| --- | --- | --- |
| **Display** | The one subject and the one action: the next day + Start, the current set + Log | The device mode |
| **Sheet** | Detail about the thing you pressed: today's lifts, the exercise, a plan | The rocker's middle, the exercise name, the menu key, the History key |
| **Object actions** | Rename, duplicate, delete, reorder, use plan | A `…` in a sheet header, a long-press, a swipe |
| **Settings sheet** | Preferences set once | Menu → Settings (D1) |

- The display shows at most three levels of text per object (name, meta, value).
- Lists on the display truncate as a peer line (`+N MORE`), never a sheet just to show the rest.
- Density lives in sheets, never on the display.

### Key map (device modes)

`DeviceMode` is `home`, `log`, `rest`, `finish`, `edit` or `loading` (PLAN §4.2). The parts never move; only their content changes.

| Mode | Top left | Rocker | Top right | Left keys | Wheel | Big key |
| --- | --- | --- | --- | --- | --- | --- |
| **home** | Menu | Week lamps, no ends; `WEEK n` engraved under it | History | none | stowed | `Start` (primary); `Plans` (metal) with no plans |
| **log** | Menu | `‹` `›` move between lifts; lamps per lift; the middle opens Today | Undo last set (cancels the edit while editing a logged set) | `+` / `−` reps | weight (or the mode's value, §13 Log) | `Log` (primary); `Save` when editing a logged set |
| **rest** | Menu | as in log | Undo last set | `+15` / `−15` | time, 2 notches = 15 s | `Skip` (metal) |
| **finish** | Menu | lamps per lift on the recessed plate (green when done) | Undo last set | `Back` | stowed | `Finish`, held 1.1 s (primary); `Discard` with nothing logged |
| **edit** | `‹` back to the editor | `‹` `›` move between the day's lifts; the middle returns to the editor | Remove lift (`✕`) | `+` / `−` sets | reps (or seconds, minutes) | `Done` (metal) |
| **loading** | inert | lamps off, then flicking on | hidden | none | stowed | inert |

### Sheets and their top edges (SPEC §6)

| Top edge | Sheets |
| --- | --- |
| 96 (the device's top row stays visible) | menu, plans rack, history wall, settings, and other short sheets |
| 60 (tall) | progress, lift detail, exercise, editor, add lifts, receipt |
| 200 | Today |
| 430 | finishes (short, so the device behind is visible while you pick) |

### Jobs

| Surface | Job | Winner | Primary action |
| --- | --- | --- | --- |
| Home | Start the next workout; where the week stands | The selected day's row | `Start` |
| Log | What this set needs right now | The weight on the drum | `Log` |
| Rest | How long until the next set | The time in the ring | `Skip` (metal) |
| Finish | End the workout on purpose | `ALL DONE` / `END EARLY?` | `Finish`, held |
| Edit | This lift's sets × reps | The framed number the wheel controls | `Done` (metal) |
| Receipt | What I just did | The paper | `Done` (light pill) |
| Menu | Go somewhere | The rows | none |
| Today | Jump, reorder or change today's lifts | The current row | none |
| Plans rack | Which plan is in, which others exist | The active shelf | `+` |
| Editor | What's in this plan | The plan name | `Use plan` when inactive |
| Progress | Is each lift going up | GOALS, then LIFTS | none |
| Lift detail | How strong I am on this lift | The big number | none |
| History wall | What I finished | The receipts | none |
| Settings | Change units, sounds, Pro, data | The rows | none |
| Paywall | What Pro adds and what it costs | The knob and the headline | Start free trial / Subscribe |
| Onboarding step | One question | The question | Continue |

A surface with "none" has no pill. Rows are the actions.

---

## 3. Typography

Three families, each with one job, plus SF Mono for one number:

| Family | `fontFamily` | Job |
| --- | --- | --- |
| **Doto Black** (dot matrix) | `'Doto-Black'` | Everything on the display, sheet section labels, cartridge labels, the editor's sets × reps chips, chart labels on lcd panels, finish numbers |
| **SF Rounded** (system) | `'ui-rounded'` (or the `roundedFontName()` PostScript names from `TrimDevice` if RN doesn't resolve it; PLAN §4.6) | Key labels, engraved labels, all sheet text |
| **IBM Plex Mono** Medium / Bold | `'IBMPlexMono-Medium'`, `'IBMPlexMono-Bold'` | Receipts only |
| **SF Mono** heavy (system) | `'ui-monospace'` (`fontFamily.mono`) | The days drum in onboarding only (`onboardingType.wheelNumber`, D74): a machined number that never shifts as the drum turns |

Never bundle SF font files. Doto and Plex Mono are registered through the `expo-font` plugin (and `useFonts` on web).

### Roles (SPEC §3)

Use a role from `theme.ts` as-is. Override only `color`, and only with another token of the same layer.

| Role | Font | Size / line height | Use |
| --- | --- | --- | --- |
| `lcdHero` | Doto Black | 104 / 104 | The weight on the drum; sets and reps in edit; bodyweight reps |
| `lcdBig` | Doto Black | 54–64 / same | Rest time (56) |
| `lcdTitle` | Doto Black | 40–46 | `ALL DONE`, `END EARLY?` (44), the plan name while loading (40) |
| `lcdReps` | Doto Black | 56 | `×8` |
| `lcdRow` | Doto Black | 18–20 | Rows and lists on the display |
| `lcdSmall` | Doto Black | 13–15 | Display headers (`hd`), meta |
| `sectionLabel` | Doto Black | 13, letter spacing 1 | Sheet section labels |
| `keyLabel` | SF Rounded 800 | 22–26 glyphs, 17–22 words | Key glyphs and words; the big key's word is 22–24 (SPEC §4) |
| `engraved` | SF Rounded 800 | 10, letter spacing 1.5, uppercase | Engraved body labels (`.lab`) |
| `sheetTitle` | SF Rounded 800 | 18 | Sheet header title |
| `sheetHero` | SF Rounded 800 | 26–30 / 30–34, letter spacing −0.5 | Plan names (28), the exercise name (30) |
| `bigNumber` | SF Rounded 800 | 54 / 58, letter spacing −1.5 | Lift detail's estimated max |
| `rowTitle` | SF Rounded 700–800 | 16–17 | A row's name |
| `rowSub` | SF Rounded 600 | 13–15, muted | Meta under a name |
| `receipt` | IBM Plex Mono 500 / 700 | 13 / 20; mini receipts 9 / 13 | Receipt text |

### Rules

1. **Weights.** SF Rounded uses 600 (supporting text), 700 (rows) and 800 (titles, keys, numbers that matter), from tokens. Doto has one weight. No light, no italics.
2. **Uppercase belongs to the device.** Display text, engraved labels, sheet section labels, cartridge labels and receipts are uppercase. SF Rounded text in sheets is sentence case.
3. **One loud size per surface.** The display has one hero per mode (the drum, the rest time, `ALL DONE`). A sheet uses at most one of `sheetHero` / `bigNumber`. Everything else steps down.
4. **Tabular numbers** on every SF Rounded number that changes in place or lines up in a column (`fontVariant: ['tabular-nums']`). Doto and Plex Mono are monospaced already.
5. **Wrapping.** On the display a name truncates with … at one line (the full name is in the exercise sheet and in VoiceOver). A drum value of 1000 or more shrinks to fit (Doto 88). In sheets, names wrap (`numberOfLines={2}` on rows), titles wrap, and ellipsis is only for rows.
6. **Dynamic Type** (SPEC §3). Display text is a hardware display: fixed size, capped at fontScale 1.0. Key glyphs cap at 1.2. Sheet text follows Dynamic Type up to `fontScaleCap.text`; rows grow, they don't clip. VoiceOver labels carry the real meaning.
7. **Line heights are tokens.** If Doto's metrics drift on device, adjust `lineHeight` per role in `theme.ts`, never per screen.

---

## 4. Spacing and layout

### Device geometry (SPEC §4, 390 × 844 reference)

| Part | Frame | Detail |
| --- | --- | --- |
| Top-left key (menu, or ‹ while editing) | x20 y56, 56 × 56, r28 | |
| Rocker | x96 y56, 198 × 56, r28, a raised key | Ends 46 wide each, glyph 24. Middle strip: height 30, r15, plate colour, inset shadow. Lamps 10, gap 7. On Home it's the same body without ends. |
| Label under the rocker | y118 | engraved (`WEEK 12`) |
| Top-right key | right 20, y56, 56 × 56 | History / Undo / Remove lift |
| Display | x20 y140, 350 × 420, r28 | inner padding 22 |
| Left keys (tall) | x22 y592 and y680, 64 × 76, r22 | reps ±, rest ±15, sets ± |
| Well | x110 y590, 170 × 170, round | |
| Big key | x122 y600, 146 × 146, round | |
| Hold ring | stroke 6 around the well (r80) | amber, soft glow |
| Wheel | right 22, y588, 64 × 180, r24 | ridges 5 light + 2 dark; inner shadows 16 top and bottom |
| Wheel label | under the wheel, y774 | `KG`, `LB`, `REPS`, `TIME` |

These live in the `device` geometry block in `theme.ts` (`displayPad: 22`, `edge: 20`, `lampGap: 7`, key sizes, radii), never as raw numbers in a part.

**Layout rule.** Lay out with flex and safe areas, not absolute positions. The top row sits under the safe area; the bottom row sits above the home indicator with 34 clearance at the reference size. The display takes the remaining height: at least 360 on screens 812 tall or more. On iPhone SE (667) it may go down to about 296 with a bottom clearance of 16, and Home's rows scroll inside the display (with a fade). Display modes lay out from the display's measured height (`useDisplayHeight()`): from 360 up they match their screens exactly; on shorter displays the log drum drops its dim steps (below first, then above) and centres the framed 104 weight between the header and `×8`, the rest ring and its clock scale down together to fit between header and footer, Edit keeps the lift name to one shrunk line, and Finish's set grid compresses past 4 rows (8-pt lamps 4 apart, then more columns) so it never reaches the stats. Nothing on the display ever overlaps. Key sizes never change. On Pro Max the margins scale and the display grows; keys stay the same size.

### Display layout

- Content insets 22 from the display's edges. The header (`hd`, `lcdSmall`) sits 20 from the top: left the subject, right the position (`SET 1/3`, `NEXT 85×8`, `2 OF 4`).
- The footer sits 22 from the bottom: the value you adjust with the keys on the left, the reference fact (`LAST 80×8`) dim on the right.
- Home's rows inset 14 from the display's sides, stacked from the top 8 apart.

### Sheet layout

- Header: sticky, 68 tall, title centred; round 40 controls 16 from the edges.
- Content: cards (`card`, r24) with rows split by a 1 px `rule`. Section labels (`sectionLabel`) sit above their card.
- The main action is a pill, 56 tall, r28, sticky at the bottom over a fade (the `usebar`).
- Spacing in sheets uses the `space` scale. A value SPEC fixes off the scale is a named geometry token in `theme.ts`, not a raw number.

### Rules

1. **Two lanes per row.** Leading lane (name and meta, left-aligned) and trailing lane (value, chip, tick or chevron, right-aligned). All rows in a card use the same lanes.
2. **Single column in sheets,** except the grids SPEC names: GOALS (3 cards), the History wall (3 columns, gap 10), finish swatches (a sideways row).
3. **Touch targets** are at least 44 × 44 (`TOUCH_TARGET`); every device key is larger. Small glyphs get `hitSlop`, not a bigger glyph.
4. **Pinned frames don't jump.** The display's header and footer are pinned; the drum and rows change between them. Content that appears in a sheet takes air from below.

---

## 5. Color

Color is by layer. Tokens only: no hex literals outside `theme.ts`.

### Device: per finish (`finish` is a user setting; SPEC §2)

| Token | 212 Aluminium (default) | 101 Graphite | 305 Signal | 408 Bone |
| --- | --- | --- | --- | --- |
| body1 (top of gradient) | #E4E2DC | #3A3936 | #FF7A35 | #EFE6D3 |
| body2 (bottom) | #D2CFC8 | #232220 | #DE470A | #D9CBB0 |
| label (engraved text) | #7C7A73 | #C0BEB8 | #562209 | #7A6F5C |
| labelShadow | rgba(255,255,255,.7) | rgba(0,0,0,.6) | rgba(255,226,207,.5) | rgba(255,255,255,.7) |
| keyEdge | #A9A69E | #A9A69E | #9E3A0A | #A9A69E |

**Engraved labels must read on every finish** (PLAN §11): at least 3:1 against the body right behind them, measured with the sheen and brushing (the top of the body is lighter than `body1`). SPEC's 101 `#8C8A84` (1.8:1 under `WEEK n`) and 305 `#FFE2CF` (1.9:1) failed, so they were raised (PRODUCT-DECISIONS 73). The rule for picking one: a light label with a dark shadow under it on a dark body (101), a dark label with a light highlight under it on a light or bright body (212, 408, 305). No light colour reaches 3:1 on the Signal sheen, which is why 305's engraving is a dark burnt brown. Check both the top (`WEEK n`) and the bottom (`KG`) of the body, which differ by up to 2× in luminance.

**Shared by every finish:** key1 #F4F3EF, key2 #DEDBD4, keyInk #2A2925; wheel ridges #F2F1ED / #C4C1B9; well rgba(0,0,0,.14); plate (the rocker's recessed strip) #C9C6BE.

**Body overlays:** a top sheen, linear white .35 to 0 over the top 40%; brushing, a vertical 1 px line of white .06 then 2 px of black .02, repeating every 3 px.

**Big key:**
- Primary: radial at 50% 22%, from #FF8A45 to #F2550F at 70%, with a bottom lip of #B83A05.
- On the Signal finish, primary is graphite instead: #4A4843 to #22211F, lip #0E0E0D.
- Metal (secondary: Skip, Done, Plans): #FAF9F6 to #D6D2CA, lip = keyEdge.

The status bar is dark text on Aluminium and Bone, light text on Graphite and Signal (D2).

### Display (`lcd`)

| Token | Value | Use |
| --- | --- | --- |
| lcd | #121211 | Display ground (inset shadow 0 3 10 rgba(0,0,0,.8)); also chart panels and the editor's chips |
| amber | #FF6A1A | Live text, focus frames, lamps on |
| amberDim | #7A3E1C | Secondary display text |
| amberOff | #3A2214 | Unlit segments, empty rings |
| doneRowBg | #FF6A1A, ink #121211 | Stamped done day rows |
| todoRowBg | #1C1610 | Future day rows |

The display is a one-colour instrument. On it, meaning comes from brightness (amber, dim, off), from frames (a 2 px amber outline marks what the control in use changes, or the selected row) and from fills (a done row is filled amber with dark ink and a ✓). Green lives on the lamps and in sheets, not on the display.

### Sheets (`sheet`)

| Token | Value |
| --- | --- |
| sheet | #151514 |
| card | #232321 |
| rule | #2E2E2B |
| ink | #F3F2EE |
| muted | #8C8A84 |
| sectionLabel | #6E6C66 |
| control (round sheet buttons) | #262624 background, #C9C6BF glyph |
| scrim | rgba(20,18,15,.40) |

Light pill: #FBFAF7 with dark ink. Secondary pill: #2E2D2A.

### Signals (`signal`; PRODUCT principle on colour roles, adapted)

| Signal | Colour | Where | Never |
| --- | --- | --- | --- |
| **Action / current / selected** | orange #FF6A1A (the one brand hue) | The big key, focus frames, the current lamp, selected chips and ticks, `Add lift`, the active shelf's outline, the Active badge, the current row's inset in Today, the selected range | A result, a title, decoration |
| **Done** | lamp green #5DAA68, glow 0 0 4 rgba(93,170,104,.45) | Lamps for done days and done lifts, goal rings, "done" cartridge labels | Change, improvement, a control |
| **Record** | yellow #F5C542 | PR sparklines, record values, the last chart dot when it's a record, ★ | Anything else |
| **Streak / secured week** | orange | `▲n` after `WEEK n` when the streak counts (D20). No flame, no emoji. | |
| **Ordinary change** | ink with ↑ / ↓ | Deltas in sheets | Green or red |

- **One brand hue.** If it's the thing you act on next or the thing that's chosen, it's orange; otherwise it's ink (or amber on the display, which is the display's own light).
- **Change is ink. Down is not red.** Lifting less, missing a day, or a lower body weight stays in ink. Trim doesn't scold.
- **Red only where the system draws it:** alerts, action sheets and destructive menu items.
- **Opacity is never a color** in sheets: pick a token. Opacity is for pressed feedback (`PRESSED_OPACITY`), the scrim and the disabled device keys (§10 States).

**Receipt paper:** #FCFAF4 to #EFEADF, ink #34322D, muted #8E8B83, PR line #C2410C.

### Appearance

There is no light or dark mode (D2). Sheets and moments are always dark; the device's look is the finish. Never call `Appearance.setColorScheme`. Every sheet `TextInput` sets `keyboardAppearance="dark"`. Alerts and action sheets stay system-styled.

### Contrast

Measured: amber on lcd 6.5:1, ink on the sheet 16:1, muted on the sheet 5.3:1 and on a card 4.6:1. These carry everything you act on or must read mid-set. amberDim on lcd (2.3:1), `sectionLabel` on the sheet (3.5:1) and engraved labels (3.1:1 to 7.0:1, measured on device) are below AA, so they only carry facts that are said again elsewhere (the VoiceOver summary, the sheet). Never use them for something the user must read to act. Check every finish (PLAN §11).

---

## 6. Shape

| Radius | Use |
| --- | --- |
| 38 | Sheet top corners |
| 28 | The display, round keys (56), the rocker, pills (56), the exercise figure panel |
| 24 | Sheet cards, the wheel, plan shelves, lcd chart panels |
| 22 | Tall keys |
| 15 | The rocker's middle strip |
| full | Well, big key, lamps, ticks, chips, round sheet controls |

The new radii (22, 24, 28, 38) join `radius` in `theme.ts`. Always `borderCurve: 'continuous'` on rounded rectangles. Nested shapes are concentric: inner radius = outer radius − inset.

**Depth is physical, and only physical.** Keys have a lip (a solid `keyEdge` shadow under them) and an inner top highlight; the display and the well are recessed with inset shadows; the body carries the sheen and brushing. Sheets are flat: no gradients, bevels or shadows on cards (the sheet's own edge shadow is the one exception). Moments use full 3D.

---

## 7. Icons

A glyph earns its place when the eye finds it faster than the word, it carries a state, or it names a command. It never decorates.

**On the device.** Key glyphs are drawn to match the prototype (SVG strokes, or SF Rounded 800 characters), in `keyInk`:

| Key | Glyph |
| --- | --- |
| Menu | two slider lines |
| History | a clock |
| Undo last set | ↶ |
| Remove lift (edit) | ✕ |
| Rocker ends | ‹ › (24) |
| Reps and sets | + − |
| Rest | `+15` `−15` (17) |
| Big key and `Back` | a word: `Start`, `Log`, `Save`, `Skip`, `Finish`, `Discard`, `Done`, `Plans`, `Back` |

On the display, glyphs are Doto characters: ▾ after a tappable name, ✓ on a done row, × between numbers. No SF Symbols on the device body or display.

**In sheets.**
- Round controls hold ‹ (back), ✕ (close), + (add), or a word (`Done`, `Edit`).
- **Object icons** (`ObjectIcon`, 56, small 3D objects) lead the menu's destinations: knob (Plans), gauge (Progress), receipt (History), toggles (Settings), plus the cartridge. They're the menu's identity. They don't repeat down other lists.
- State marks: ✓ done, ★ record, the round tick (orange when picked) in Add lifts, `PRO` on locked ranges, the "i" in Today.
- Change: ↑ ↓ in ink before a number.
- Chevrons only where tapping opens something. A row that performs an action has no chevron.
- System menus and action sheets use system symbols.

---

## 8. Motion, haptics and sound

Motion exists to make Trim feel **faster** (instant acknowledgement), **more fluid** (you see where things came from) or **more loveable** (an earned moment). Every animation names its purpose. If it can't, delete it.

### How often decides how much

| Tier | Examples | Budget |
| --- | --- | --- |
| **Every set** | Key presses, wheel notches, the drum, the rocker, Log, rest ticking | 80–220 ms, or none. No waits, no flourish. |
| **Every workout** | Sheets, hold to finish, the receipt, a stamp, filing | Standard: the SPEC timings below. Skippable where longer than a tap. |
| **Rare** | Plan activation (the insert), the finished week, onboarding, the paywall knob, a purchase | The delight budget: up to 4 s, sound allowed, always skippable. |
| **Once** | First open (D74) | Shown once per install, so it takes its time: about 6.5 s, an epic, immersive scene with the strongest haptics in the app. Always skippable with a tap. |

### Motion table (SPEC §7; durations in `DEVICE`, `motion.ts`)

| Motion | Duration / curve | Notes |
| --- | --- | --- |
| Key press | translateY 3 (round keys), 6 (big key); 80 ms; the lip shadow collapses | On press-in, not release |
| Display content change | fade and rise 8, 220 ms, bezier(.2,.8,.3,1) | Every mode change |
| Weight drum step | translateY ±24, then back, 160 ms, bezier(.2,.8,.3,1) | Per wheel notch |
| Wheel | Ridges follow the finger 1:1. One notch = 16 pt of travel | Weight: one step per notch. Rest: ±15 s per 2 notches. Reps while editing: 1 per notch. |
| Sheet in / out | 380 ms, bezier(.2,.9,.3,1); scrim 300 ms | |
| Rocker press | 2D stand-in for rotateY ±10° (scaleX 0.985, rotate ±1.5°), 160 ms | Tilts toward the end pressed (3D layers composite badly on iOS) |
| Hold to finish | 1100 ms linear ring fill; snaps back on release | |
| Receipt feed | translateY 100% to 0 in 18 steps over 1.8 s, jump-start (each step lands with its print tick at 0, 100 … 1700 ms) | Tapping the paper completes it. Plays from the wall too. Reduce Motion: the paper fades in where it ends |
| Week moment (D15) | the grid ground fades in over 600 ms; 250 ms in, the report drops onto the spike from 120 above, −4° → 1.5°, 700 ms, bezier(.3,1.3,.5,1); Done fades it out over 300 ms | The thud at 315 ms into the drop (where the curve first meets the spike). A tap on the scene skips to the end |
| Stamp (new PR or done day) | scale 2.4 → 1, rotate −12° → 7°, opacity 0 → 1, 500 ms, delay 450, bezier(.2,1.6,.4,1); the row fills from todo to done over 500 ms | When Home reappears after the receipt |
| Lamp turns green (day finished) | flicker off, on, off, on over 900 ms (steps) | |
| Wheel stow on Home | translateX 40, scale .9, opacity 0, 350 ms | |
| Cartridge filing (plan saved) | each cartridge drops from translateY −120, rotate −8°, 550 ms, bezier(.3,1.4,.5,1), staggered 120 ms; the shelf flashes | When the editor closes back to the rack after a change |
| Goal ring | fills from 0 over 1 s | |
| Chart line | draws in over 1 s | |
| Needle (progress gauge) | −70° to its value over 1.4 s, bezier(.2,.8,.3,1) | Not shipped while there's no rank data (D4) |
| First open (D74) | One clock, 0 → 6500 ms (`ASSEMBLY`, `motion.ts`). 0–1600 the body approaches out of space (scale .06 → 1, tilted 48°, turned −28°, bezier(.2,.9,.25,1.04)) under a deep haptic swell; it lands with a thump and its outline flashes amber. Parts land at 2000 (display, from above), 2420 (menu, left), 2760 (history, right), 3040 (rocker, above), 3260 (+), 3440 (−), 3590 (wheel, right), each flying 200 ms, bezier(.55,0,1,.6), with a spark, a click a step higher, and a 4.5 % recoil of the stage. 3660–4900 the Start key hovers at 2.7× and trembles harder and harder (±1.5° → ±5.5°) while a glow and a stuttering rumble build and the camera pushes in to 1.08×; it slams in the last 20 % (bezier(.8,0,1,.5)). **At 4900, the bang:** the push snaps back, a double shockwave, a long shake, an amber burst, and the grid floor lights over space. 5000 a scan line, 5060 the display boots, 5600 the words, 6300 Continue | A tap anywhere skips to the end. Reduce Motion: the device fades in whole; the bang's haptic and sound stay |
| Days wheel (onboarding, D74) | A tall wheel and a drum of numbers ride the finger 1:1, one day per 46 pt; a flick carries on (velocity × 0.09 s) and settles with `SPRING.fling`; past 2 or 6 it gives like a rubber band (30 % of the finger at first, never more than half a day) | Each day passed clicks, while dragging and while settling |

### Plan activation (the insert, SPEC §7)

The sheet closes; the scene fades in over 600 ms (dark radial backdrop, a perspective grid floor of 44 pt cells, a vignette); the display shows `SLOT EMPTY` and a blinking `INSERT PLAN`. 0–1000 ms the device pulls back and turns (about 44 pt thick). 1000–1500 ms the cartridge appears above the top edge. After a 300 ms hold, 1800–2400 ms it slides in. **At 2400 ms, the click:** overshoot and settle, the device dips and rebounds, an orange glow along the slot, a pulse ring, the lamps flick across, the display powers on to `LOADED` and the plan name, haptic `cartridgeClick` and sound `cartridge` on that frame. 3200–4100 ms the device swings back and the scene fades. From 4100 ms the days tick onto the display 240 ms apart (a tick haptic each), the lamps light, Home renders with the `ready` chime and haptic and the toast "<Plan> is your plan". From onboarding the device fades in under a dark curtain that holds until the native scene is fully in, so Home never flashes. The feel pass stretched it (more anticipation, a longer glow and swing); SPEC §7 has the original table; `frames/a–g` is the visual target.

Who plays it (`device/insert/use-insert.ts`): the SceneKit view (`CartridgeInsert`) when the build has it; the JS 2.5D version (`device/insert/insert-scene.tsx`, one clock in `timeline.ts`) on web, in older builds, or when the native view hasn't drawn within 1.5 s; nobody under Reduce Motion (straight to `LOADED`, haptic and sound kept). Either way the JS device takes over face-on for the ticks. In the JS version depth is faked in the face's plane (22 layers shifted where a point that deep would land), and anything flat that shares the screen with the turned device sits far behind it (a `matrix` z of −2000): Core Animation depth-sorts 3D layers against flat siblings, so a backdrop at z 0 cuts away the half of the device that leans back. A tap in the first 380 ms (the second tap of a double tap on Use plan) doesn't skip. Dev: `/?insert=js|native|auto&pause=<ms>&speed=<x>`, `/dev-insert?fallback=1`.

### Rules

1. **Respond within 100 ms.** Press feedback starts on press-in. Nothing sits between a press and its visible effect.
2. **Nothing waits on an animation** (`PRODUCT.md` Principle 7, D22). The receipt's Done is live from the first frame; tapping the paper completes the feed; tapping the scene skips the insert to its end state. Every animation is interruptible.
3. **Haptic, sound and visual on the same frame,** at the causal moment (the notch catches, the set lands, the cartridge seats), never when an animation finishes.
4. **The device never navigates.** Modes change in place (the display's fade and rise). One sheet at a time; ‹ swaps the sheet's content in place and doesn't stack. No page transitions.
5. **No idle motion.** Nothing loops while the user isn't doing anything, with two exceptions that are information: blinking text for a state waiting on the user (`INSERT PLAN`, `GO` for `REST_GO_MS`), and the exercise figure, which demonstrates the movement while its sheet is open.
6. **Coming back is instant.** No launch or foreground animation (first open is onboarding, not a launch: it plays once, D74). A moment interrupted by backgrounding jumps to its end state on return; the device is never stuck in `loading`.
7. **Reduced motion** (SPEC §7): movement becomes fades. The receipt shows without the feed, the insert is skipped (straight to the loaded state), the figure stands still. Haptics and sounds stay.
8. **React holds every resting state.** Reanimated 4 hands a worklet style's values to React only once they've held still for 1 s, and drops them if the JS thread is busy in the next second. A dropped hand-over comes back on the next commit: the wheel on Home, no wheel in the log, the whole device invisible after a plan activation (all seen with a 2.6 s stall). So a part with more than one resting state (stowed, hidden) gets it from React: a Reanimated CSS transition or a plain style, never a worklet style. A worklet style may only hold still at its one resting value; a hold anywhere else keeps moving (a held key drifts imperceptibly, `press.ts`), or the part unmounts when it ends (the insert scene, the week moment).

### Haptics (SPEC §8)

Core Haptics patterns in the `TrimDevice` module through `useHaptics()`; `expo-haptics` is the fallback. Restart the engine after a reset (a call, an audio interruption).

| Event | Pattern | Fallback |
| --- | --- | --- |
| Wheel notch (weight, time, reps) | transient, intensity .7, sharpness .9; every 5th notch or whole 10 kg: intensity 1.0; with the `notch` click | `selectionAsync` |
| Key press (any key) | transient .85 / .6, with the `key` click | `impactAsync(Light)` |
| A tap on the display (a day row, the drum) | transient .45 / .95, with the `blip`: lighter and digital, never a key's click | `selectionAsync` |
| A plan has loaded (the days have ticked in, Home takes over) | transients .55, .7 and 1.0, 90 ms apart, then .5 / .2 for 120 ms; with the `ready` chime | `notificationAsync(Success)` |
| Each repeat of a held tall key (reps, ±15) | the wheel notch | `selectionAsync` |
| Big key press-in | transient 1.0 / .45, then 30 ms later .5 / .2; with the `press` clunk | `impactAsync(Medium)` |
| Log set | transient 1.0 / .6, then 40 ms later .4 / .3 | `impactAsync(Rigid)` |
| Rocker move | transient .9 / .8, with the `rocker` tick | `impactAsync(Light)` |
| Rest reaches 0:00 | an alarm, beep-beep … beep-beep: four beeps at 0, 140, 500 and 640 ms, each a transient 1.0 / .85 over continuous .75 / .7 for 80 ms; with the `alarm` sound | four heavy impacts at the same times |
| Hold to finish | continuous, intensity .2 → .9 over 1.1 s, sharpness .3; release cancels | `impactAsync(Soft)` at the start, a heavy impact at the end |
| Finish complete | transient 1.0 / .3 | `notificationAsync(Success)` |
| Receipt printing | 18 transients .25 / .9, 100 ms apart (the feed's steps) | none |
| Stamp lands; the week report lands on the spike | transient .9 / .2 | `impactAsync(Heavy)` |
| Cartridge click | t0 transient 1.0 / 1.0 (latch), t65 transient 1.0 / .2 (seat), then continuous .3 / .1 for 80 ms | `impactAsync(Rigid)`, then `impactAsync(Heavy)` 65 ms later |
| Day ticks in (loading) | transient .6 / .7, with the `notch` click | `selectionAsync` |
| Finish swatch picked | transient .8 / .6, then 25 ms later .35 / .3; with the `swatch` clack | `selectionAsync` |
| A cartridge files onto its shelf (one per cartridge, where its drop lands) | `key` | `impactAsync(Light)` |
| Onboarding days wheel: each day passed; 6 days | the wheel notch; at 6 the major notch | `selectionAsync` |
| Onboarding days wheel: past 2 or 6 (`wheelStop`) | transient .9 / .1, then 50 ms later .35 / .1 | `impactAsync(Heavy)` |
| First open: the body approaches (`assemblyApproach`), then lands (`assemblyArrive`) | continuous .05 → .7 over 1.5 s; then transients 1.0 / .25 and .5 / .2 at 40 ms | `impactAsync(Soft)` on landing |
| First open: a part snaps on (`assemblySnap`) | transient 1.0 / .9, then 18 ms later .6 / .4 | `impactAsync(Rigid)` |
| First open: the Start key charges (`assemblyCharge`) | continuous .2 → 1.0 over 1.2 s, sharpness rising, with ticks that come faster and harder; runs out at the bang | none |
| First open: the bang (`assemblyBang`) | transients 1.0 / .2 and 1.0 / 1.0, continuous 1.0 / .1 for 450 ms, aftershocks .7, .5, .35, .2 at 120, 220, 340, 480 ms | `impactAsync(Heavy)`, then `impactAsync(Medium)` 110 ms later |
| Sheet open / close | none | |

A haptic confirms something the body did. Nothing else buzzes: no haptic on navigation, errors or sheets.

### Sounds (SPEC §9)

Short, dry, mechanical, never musical (first open is the exception: its build climbs and swells). Each under 1 s (first open's approach and charge run longer), 44.1 kHz mono, peak −3 dBFS, rendered by `mobile/scripts/render-sounds.mjs`. Played through `TrimDevice.playSound` on the ambient session: mixed with music, off when the silent switch is on, and off when Settings → Sounds is off (on by default, D14).

| Sound | Character | When |
| --- | --- | --- |
| `cartridge` | a latch "clack" plus a thump, then at 65 ms a "thunk" plus a lower thump | The cartridge seats |
| `print` | stepper chatter, 18 short ticks | The receipt prints |
| `stamp` | a soft low thud | A PR or done stamp lands; the week report lands on the spike |
| `key` | a short click | Every key press (round keys, tall keys) |
| `press` | a heavy mechanical clunk | The big key pressed |
| `rocker` | a short tick with a little body | The rocker tilts |
| `notch` | a tiny dry click | Each wheel detent; a day ticking in while a plan loads |
| `swatch` | a metal tile set down | A finish picked |
| `blip` | a soft electronic blip | A tap on the display (a day row, the drum) |
| `ready` | three rising display tones, a latch under the last, a short metal shimmer | A plan has loaded: the days have ticked in and Home takes over |
| `alarm` | a digital watch alarm, beep-beep … beep-beep (2.7 kHz) | Rest reaches 0:00, with `GO` |
| `arrive` | a long airy swell over a low hum, landing in a thump | First open: the body approaches |
| `snap-1` … `snap-7` | a metal latch, each a whole step higher than the last | First open: each part snaps on. The one place a sound climbs in pitch: the build gathers energy (D74) |
| `charge` | rising air over a rising hum, ticks coming faster | First open: the Start key charges |
| `bang` | a heavy low thud, a sharp metal hit and a short ring | First open: the Start key slams home |
| `boot` | two tiny electronic blips | First open: the display boots |

No other sounds.

---

## 9. Copy

Trim's text is **names, numbers, facts and verbs.** If a string isn't one of those, it probably shouldn't exist.

### On the device (SPEC §10)

- Display text is UPPERCASE Doto.
- Numbers carry real units: `85.0`, `KG`, `×8`, `1:24`, `~45 MIN`, `0:45`, `20 MIN`.
- On the display, `×` joins without spaces (`LAST 80×8`, `NEXT 85×8`, `BENCH PRESS 3×8`). On cartridge chips, the edit display and receipts it takes spaces (`3 × 8`, `SETS 4 × REPS 15`, `90 × 9`).
- No helper text, gesture hints, middle dots or emoji. There's no `HOLD TO FINISH`: the big key's VoiceOver label says it.
- The vocabulary: `SET 2/3`, `EXTRA SET`, `EDIT SET 2`, `LAST 80×8`, `TARGET 87.5×8`, `TARGET ›`, `REST`, `GO`, `ALL DONE`, `END EARLY?`, `NOTHING LOGGED`, `9 OF 9 SETS`, `WEEK 12`, `WEEK 12  ▲3`, `WEEK DONE`, `0 LIFTS`, `+2 MORE`, `SLOT EMPTY`, `INSERT PLAN`, `LOADED`, `ASSIST`. An empty weight is `--.-`.

### In sheets

| Kind | Example |
| --- | --- |
| Name | `Push 1`, `Bench Press`, `Push Pull Legs` |
| Number with unit | `60 kg × 8`, `3 × 8`, `1:32`, `52 min`, `~45 min` |
| Fact | `4 days, 18 lifts`, `Now, set 2/3`, `Best today`, `Last time` |
| Section label (Doto, uppercase) | `GOALS`, `LIFTS, 30 DAYS`, `BODY`, `HOW TO`, `YOU`, `SESSIONS` |
| Action | `Start`, `Use plan`, `Add lift`, `Add 3 lifts`, `Change finish`, `Share` |
| Empty-state fact | `No lifts yet`, `NO WORKOUTS YET` (on the blank receipt) |
| Error: what happened, and what to do, in one line | `Couldn't load prices. Try again.` |
| Legal | Auto-renewal terms on the paywall |
| What Trim is, under the wordmark on Welcome only (D74) | `A workout machine.` |

### Banned

- Instructions and gesture hints: `Tap to swap`, `Drag to reorder`, `Hold to finish`. VoiceOver labels are exempt; hints stay off (PLAN §7: hint-free actions).
- Explainer subheadings and captions under titles or empty states.
- Summaries of what's already on screen.
- Motivational or celebratory copy (`Great job!`), exclamation marks, emoji.
- Possessives that add nothing: `Your plans`, `My workouts`.
- Coach marks, tooltips, tours.

### Say each fact once

Before adding a label, check whether a mark already says it: a ✓ on a stamped row, a green lamp, the Active badge. Delete the words, keep the mark.

### The eyebrow test

Keep a section label only if it carries a fact or a grouping the layout doesn't already show: `LIFTS, 30 DAYS` names the window, `HOW TO` names what the numbered steps are. Drop it if it only names the layout or repeats the sheet title.

### Separating facts (no middle dots)

1. **One fact.** Cut until one is left.
2. **Lanes.** The second fact goes to the trailing lane.
3. **Lines.** Two facts that both matter stack on two lines.
4. **Language.** Join the way a person would say it: `3 × 8 at 85`, `Barbell, chest`, `Push Pull Legs, 4 days`.

On the display, two facts on one line are parted by two spaces (`MON  48 MIN`, `WEEK 12  ▲3`). Never `·`, `•`, `|` or ` / ` as separators anywhere.

### Slop markers

Banned everywhere, money screens included:
- **Glyphs:** middle-dot separators, em dashes in sentences, emoji, sparkle icons, arrows in button labels (`Continue →`).
- **Copy:** buzzwords (`Unlock`, `Supercharge`, `Level up`, `Elevate`, `Seamless`, `Journey`), Title Case Headlines, checkmark-bullet feature lists, `Most popular` badges (state the saving instead), 01 / 02 / 03 step numbers.
- **Visuals:** gradients, bevels or shadows in sheets, glassmorphism, everything centred, pill tags on everything, stock or AI illustrations, confetti.

### Style

- **Sentence case** in sheets, including titles. The product name is `Trim Pro`.
- **Buttons are verbs:** one or two words, three at most (`Use plan`, `Add 3 lifts`, `Delete plan`, never `OK`).
- **Numbers:** a unit on every load in sheets (`60 kg × 8`). `×` joins load and reps or sets and reps. `−` (minus sign) in steppers and keys. Times are `1:32` and `52 min`; estimates `~45 min`.
- **Dates:** `Today`, `Yesterday`, `Thu 2 Oct`. No year unless it isn't this year.
- **Alerts and action sheets** are system-styled and only for actions that can't be undone (§10 Forgiveness). The title names the action and the object (`Delete Push 1 from Thu 2 Oct?`, `Discard workout?` with `N sets logged will not be saved.`). Buttons are `Cancel` + the verb.
- **Toasts** confirm a result that isn't on screen yet, or offer Undo: `Bench Press set 2 undone` + `Undo`, `Plan deleted` + `Undo`, `Push Pull Legs is your plan`, `Add a lift first`, `Finish your workout first`, `Add lifts to this day first`. Never errors, never things already visible.

---

## 10. Components

Use these. Don't rebuild them per screen.

### Device parts (`mobile/src/device/parts/`)

| Part | Rules |
| --- | --- |
| `DeviceBody` | The finish's gradient, sheen and brushing (§5). Finish-aware through `FinishProvider`; changes live when the finish changes. |
| `RoundKey` | 56, r28, key1 → key2 gradient, lip in `keyEdge`, glyph in `keyInk`. Press: down 3, lip collapses, 80 ms, key-press haptic on press-in. |
| `TallKey` | 64 × 76, r22. Same press as `RoundKey`. Long press repeats (reps, sets, rest). |
| `Rocker` | `variant: 'week' \| 'lifts'`. Ends `‹ ›` (46 wide), a middle strip with lamps. Tilts toward the pressed end in 2D (scaleX 0.985, rotate 1.5°): a rotateY with perspective left stale rectangles on iOS. Disabled ends at the first and last lift. Week variant: no ends, not pressable. |
| `Lamp` | `off`, `on` (amber), `done` (green with glow), `part` (a lift with some sets), `lit` (the 900 ms flicker). 10, gap 7 while they fit the rocker's 106pt strip (up to 6); then 8 with gap 4 (up to 8); beyond that the strip shows `n/m` text. |
| `Display` | The lcd panel, r28, inset shadow, 22 padding. Owns the 220 ms content change and the one summary VoiceOver label per mode. |
| `Drum` | Three rows: previous step (40, dim), current (104), next step (40, dim), framed by a 2 px amber r20 frame 124 tall. Steps ±24 per notch. Tap cycles the lift's wheel step (`±2` → `±1` → `±0.5`; lbs `±5` → `±2.5` → `±1`), shown in `lcdSmall` right-aligned under the frame, `amberDim` on the default step and amber once chosen (80). Long press opens the keypad sheet (D19). Flashes its frame when the first weighted set has no weight. |
| `BigKey` | `primary`, `metal`, `disabled`; the Signal finish's graphite primary. Press: down 6, 80 ms, big-key haptic on press-in. |
| `Well` | 170 round recess around the big key. |
| `HoldRing` | Stroke 6 at r80 around the well, amber with a soft glow. Fills linearly over 1100 ms while held, snaps back on release. |
| `Wheel` | Pan on the UI thread; a notch every 16 pt; ridge texture and drum offset driven by shared values; per notch `scheduleOnRN(onNotch, ±1)` and the notch haptic. Commits to React state at most once per frame. An adjustable accessibility element. Stows on Home, finish and loading with a Reanimated CSS transition, so React's own props always hold the resting state (a worklet stow's settled props are lost after a 1–2 s JS stall, and the next commit brings the wheel back on Home or drops it from the log); a stowed wheel is hidden from VoiceOver. |
| `EngravedLabel` | `engraved` type in the finish's `label` with its `labelShadow` (0 1 0). |

### Sheet primitives

| Primitive | Rules |
| --- | --- |
| `SheetHost` | One controller, one visible sheet, content swaps in place (`open`, `swap`, `close`). An absolutely positioned Reanimated layer in the root view, above the device. Never RN `Modal` and never RNScreens `formSheet` (the device must stay mounted and visible, toasts and the paywall must sit above). Top-edge presets (§2), swipe-down and scrim tap to dismiss, a keyboard-aware variant. VoiceOver: `accessibilityViewIsModal`, focus on the header, the escape gesture closes; the device behind hides itself (`accessibilityElementsHidden`) while a sheet is up, since the modal flag only covers the sheet's own siblings. |
| `SheetHeader` | Sticky, 68, `sheetTitle` centred, round 40 `control`s 16 from the edges: ‹ back, ✕ close, `Done`, +, `Edit`, `…`. |
| `SheetCard` | `card`, r24, rows split by a 1 px `rule`. |
| `SheetRow` | Two lanes: `rowTitle` over `rowSub`, trailing value, chip, tick or chevron. Pressed: `PRESSED_OPACITY`. |
| `SectionLabel` | `sectionLabel` type and colour, uppercase, above its card. |
| `PillButton` | 56, r28. `light` (#FBFAF7, dark ink) for the main action; `dark` (#2E2D2A) for secondary. At most one light pill per sheet. |
| `StickyActionBar` | The pill pinned to the bottom over a fade from transparent to `sheet`. |
| `Chip` | A small rounded value: muscle chips (primary muscle orange), the editor's sets × reps chip (Doto 15 orange on `lcd`, opens device edit), `Active` (orange, dark ink). |
| `Segmented` | On `card`, the selected segment orange with dark ink; a locked segment carries `PRO`. |
| `ObjectIcon` | 56 3D objects: knob, gauge, receipt, toggles, cartridge (§7). |
| `Toast` | A dark pill above sheets (mounted above `SheetHost`), one at a time. Confirm ~2 s; Undo ~5 s with a bold `Undo`. |

### Forgiveness: Undo over "Are you sure?"

| The action | Treatment |
| --- | --- |
| **Recoverable:** undo last set, remove a lift from today's session, remove a lift or a day from a plan, delete a plan (it's archived), remove a goal | Happens immediately, with an Undo toast for ~5 s. |
| **Irreversible:** delete a completed workout, Clear history, discard a workout that has logged sets | A system alert or action sheet that names the thing, `Cancel` + the verb. |

### Gestures, always paired

Every action reachable by a gesture has a second way in, and every gesture-only control is also an accessibility action.

| Action | Paths |
| --- | --- |
| Change the weight | Wheel + long-press the drum for the keypad; VoiceOver increment / decrement on the wheel |
| Change the wheel's step | Tap the drum + the display's `Change step` VoiceOver action |
| Move between lifts | Rocker ends + tap a row in Today |
| Swap or remove a lift today | Swipe a Today row left + its VoiceOver actions |
| Close a sheet | Swipe down + scrim tap + ✕ / `Done` |
| Reorder lifts | Drag in Today or the editor + Move up / Move down accessibility actions |
| Remove a lift in the editor | Swipe the row + the device's Remove key in edit |
| Delete a workout | Long-press a mini receipt → action sheet (D9) |
| Day actions | The `…` on the day header |

No other custom gestures (double-tap, two-finger, shake).

Row gestures act only on what the finger landed on, and only once it has stopped moving: a gesture belongs to the row under the finger at touch-down; while a dropped row settles into its slot (≤ ~250 ms), the list's rows ignore new swipes and holds; a touch on a list that is still gliding only stops it (as on iOS). A destructive swipe (remove in the editor) needs real travel: past the `Remove` width, or a flick that is already halfway there. A hold picks a row up only if the finger stayed still (no pick-up mid-swipe or mid-scroll).

### States

| State | Device | Sheets |
| --- | --- | --- |
| Pressed | Keys move down, the lip collapses (80 ms) | Rows `PRESSED_OPACITY`; pills scale 0.97 |
| Disabled | Round keys .45 opacity; rocker ends .3; the big key greys out (prototype values) | Pills dim to the secondary pill |
| Focused | The drum's amber frame flashes | Inputs: dark keyboard, orange cursor and selection |
| Selected | A 2 px amber outline (Home's row), the current lamp | Orange fill with dark ink (chips, segments, ticks) |
| Loading | `SLOT EMPTY` / `LOADED` during activation only | Prices only: the CTA says `Loading prices…`. No spinners for local work. |
| Empty | `SLOT EMPTY` + blinking `INSERT PLAN`, big key `Plans` (no plans) | The fact (`No lifts yet`), or the blank torn receipt (History) |
| Pro-locked | `TARGET ›` dim, opens the paywall (`targets`) | The item stays visible and opens the paywall: `PRO` on ranges, a locked finish previews (D3). Never blur or hide the user's data. |

---

## 11. Charts

A chart answers one question: is this going up?

1. **On an lcd panel.** The lift chart sits on an `lcd` panel (r24, inset shadow, 230 tall): an orange line with a dot per session (only the last one beyond 24 sessions), straight segments between sessions, no smoothing. Three faint `amberPress` rules at 60, 120 and 180 (screen 19) and nothing else: no y-axis labels, no dates, no legend, no fill.
2. **The last point** is a dot; yellow if it's a record.
3. **Goal line:** a dashed green line labelled `GOAL 100` in Doto. The y-range stretches to include it.
4. **The number is the axis.** `bigNumber` above the chart states the value; the change line under it is ink with ↑ / ↓.
5. **Scrub to read.** Touching the chart moves a marker along the line; the big number shows that point's value; a selection haptic ticks at each data point; releasing returns to now (ported from the current `progress-line-chart`).
6. **Y-range fits the data** in the window (and the goal) ±1 unit (prototype `chart()`), never from zero.
7. **Ranges** in a `Segmented` under the readout: `1M` and `3M` free; `6M`, `1Y` and `All` marked `PRO`, opening the paywall (`progress_history`). The chart is never blurred or hidden.
8. **The line draws in** over 1 s on open; under Reduce Motion it's simply there.
9. **Sparklines** in Progress rows: 70 × 24, no dots; yellow if the last point is a record, muted if flat, otherwise ink. A fixed 30-day window (`PROGRESS_SPARKLINE_DAYS`).
10. **One session** shows a dot, not a line, and no sentence explaining why.
11. **VoiceOver** gets a summary label (`Estimated max, 95 kg on 3 Jun to 102.5 kg on 14 Sep`).

---

## 12. Selling: moments, onboarding, paywall, Pro gates

### Everything is a sale

Making money isn't evil, and helping someone decide isn't either. But the sale doesn't start at the paywall. It starts the second someone taps the icon, and every interaction after that is the store clerk. One careless moment (a stutter, a confusing label, a nag) costs more than any paywall tweak can win back. So the product is the salesperson: every detail in the free app gets the same care as the paywall. That doesn't mean CTAs everywhere. It means nothing anywhere is careless (`PRODUCT.md` → Principles, Everything is a sale).

We study the highest-converting apps and use their principles, never their dark patterns, and always in Trim's own look.

### Moments

| Moment | What happens |
| --- | --- |
| **First open** (D74) | The machine is born: it floats in out of space, its parts snap on on a quickening beat, the Start key hovers and trembles while it charges, then slams home with a bang, and the grid floor lights. From that moment it's yours. About 6.5 s to Continue (shown once, so it takes its time); a tap skips it. |
| **Plan ready** (onboarding and every activation) | The cartridge insert (§8): the click, the display boots, the days tick in, the lamps light. The plan the user picked is the reward. |
| **A workout finished** | Hold to finish, then the receipt prints out of the slot with the print haptic and sound. On Home the day stamps in and its lamp flickers green. |
| **A new personal record** | The PR line on the receipt (`BENCH PR ★`), and the PR stamp on Home's row. |
| **Goals and milestones** | Printed on the receipt: the milestone line under `TRIM`, one `GOAL <LIFT> <target> ✓` line per goal reached (D7). No badges, no trophy screen. |
| **Week complete** | After the receipt's Done, the finished-week report prints onto the spike (D15): lifts up, records, volume, best. Once per week. |
| **A plan saved** | The cartridges file onto the shelf. |
| **First Pro purchase** | The thing they wanted happens within 100 ms of Apple's confirmation (the finish applies, the range switches), a toast confirms `Trim Pro is on`, with a success haptic. |

Rules for every moment:
- **Once** where it's a first or a milestone (a persisted flag; `weekMomentsShown` for the week).
- **After the action lands, never in its way.** Input is live throughout; a tap skips to the end.
- **Short.** Under 4 s, the insert included.
- **One at a time.** Queue them: the Home stamp, then the week moment, then the post-workout paywall. Never two modal moments at once.
- **Built from Trim's own parts:** the device, cartridges, receipts, stamps, lamps, the spike, the knob. No confetti, emoji, stickers, mascots or fireworks. Sounds only from §8.
- **Words stay facts.** No `Congrats!`, no `You crushed it`.
- **Reduced motion:** the moment becomes a fade to its end state; the fact, the haptic and the sound stay.

### Onboarding (D12)

1. **Every question changes the product.** Units, days a week, a plan, a finish: each answer shapes what they leave with. Name is the one optional question; it pays off on the receipt header. No vanity or marketing questions.
2. **Value before asks.** It ends with a real, active plan on a working Home, Start one press away. No account, no permission prompts (Live Activity asks at the first rest, with the system prompt only).
3. **Short.** Welcome, Name, Units, Days, Pick a plan (packs as cartridges, or Build my own), Pick your finish, then the insert as "Plan ready", then the paywall on the template path. One question per screen, choices as rows or objects, a light Continue pill at the thumb. Back always works and keeps the answers.
4. **Descriptions describe options, not the UI.** A plan pack may carry one line saying what it is (`Upper and lower body, twice each`).
5. **Build my own** inserts an empty plan with n days and opens the editor sheet.

### Paywall (D13)

6. **Right after value.** Only at the moments in `PRODUCT.md` → Trim Pro: the end of onboarding on the template path, once after the first completed workout (on the receipt's Done), a Pro-locked tap, and Settings → Trim Pro. Never during a workout (locked finishes there preview only), never on launch, never twice for the same moment. The post-workout paywall counts only once prices have rendered.
7. **Their context, not ours.** The headline speaks to why they're here: their plan after onboarding, the feature they tapped at a gate. One headline, no subheading, no superlatives, no exclamation marks.
8. **Outcomes, not features.** One row per Pro feature (including "Every finish", D3), a short title and one line of 45 characters or fewer written as what they get. At most four rows. No checkmark-bullet lists.
9. **Two choices, one clear default.** Annual and monthly as pill cards, annual preselected. Its saving is a real fact computed from the two StoreKit prices (`Save 52%`), never an invented reference price.
10. **Prices are the truth.** Every price comes from StoreKit through RevenueCat, in full with its period (`$39.99 a year`). A monthly equivalent may sit beside the annual price, never instead of it. No per-week or per-day framing, no strikethrough prices that were never charged.
11. **The trial is a timeline, not a promise.** Today → the charge day with its date and amount. The CTA says what happens: `Start free trial` or `Subscribe`.
12. **Real proof only.** The live App Store rating once it's 4.5 or above with at least 100 ratings, as a fact. No invented testimonials or counts.
13. **Leaving is always easy.** `Not now` is visible from the first frame, top right. No delayed close, no second paywall, no guilt copy. Restore, Terms and Privacy sit under the CTA.
14. **Never:** countdowns, "only today" offers, fake scarcity, pre-selected add-ons, a pulsing CTA, a close button that fades in late, a paywall that re-opens itself.
15. **Trim's look.** A full-screen modal on the dark ground with the knob hero (N9): the knob turns from FREE to PRO once on appear, then rests. Plans are pill cards, the CTA is the light pill (never green: green means done). The knob is the one visual device.
16. **One screen.** Everything, CTA and legal line included, fits above the fold on a 6.1" iPhone at default text size.

### Buying

17. **The purchase is a moment.** Within 100 ms of Apple's confirmation the gated action completes (the second plan starts, the range switches, the finish applies). The paywall closes back to where they were. No "Welcome to Pro" screen.
18. **Cancel and failure are quiet.** Backing out of Apple's sheet leaves the paywall as it was. A failure says what happened in one line and offers `Try again`.
19. **Restore is instant and certain.** It finishes in place with a toast (`Trim Pro restored`, or `No purchases to restore`).

### Pro gates

20. **Locked, not hidden.** A Pro feature stays visible where it lives (`PRO` on a range, a locked swatch, `TARGET ›`, `+` on the rack) and opens the paywall for that reason. Locked finishes (305 Signal, 408 Bone) preview live on the device; the finishes sheet then shows a light `Get Trim Pro` pill, the only way to the paywall from there; closing the sheet reverts the preview silently (D3).
21. **Free stays whole.** Logging, history and the current plan are never gated, interrupted or nagged.

### Changing a money screen

22. **One change at a time, with a number.** Every change to onboarding or the paywall names the metric it should move (onboarding completion, `paywall_viewed` → `purchase_finished`, trial starts) and ships alone, so its effect can be read in PostHog. Keep events free of workout contents.

---

## 13. Per screen

Same system, different winner. Don't invent a size or a colour for a screen. Targets are `design/gadget/screens/`; numbers in brackets are files there.

### Home (W1) [01, 14]

- **Rows** are the active plan's trainable days, stacked from the top of the display, 8 apart.
  - **Done** (a `LoggedWorkout` for that day since the start of this week): 62 tall, `doneRowBg`, ink #121211. Title `PULL 1  ✓`; meta `MON  48 MIN` left, `9 SETS` right. A PR stamp (`SQUAT PR`, or `2 PRS`) sits rotated 7° on the row's top edge and stamps in on first show.
  - **Selected, not done:** a 2 px amber outline, height 70 + 27 × min(4, lifts). Title and `~45 MIN`, then up to 4 lifts as `BENCH PRESS 3×8` with the prescription dim; with more than 4, the 4th line is `+N MORE`.
  - **Other days:** 62 tall, `todoRowBg`, dim; `N LIFTS` and `~N MIN` (`estimateDayMinutes`).
  - **PR stamp text:** the first word of the PR lift's name that isn't a how/where word (`Flat Barbell Bench Press` → `BENCH PR`, `Romanian Deadlift` → `DEADLIFT PR`); `n PRS` when several lifts set one. Meta says `1 SET`, not `1 SETS`.
  - Long names cut short with … on one line; a lift line keeps its prescription and cuts the name.
- **Selection:** the plan loop's next day; if it's stamped this week, the first unstamped day. Tap any row to pick it (key haptic); stamped rows stay tappable and Start repeats that day. A pick holds until the week moves (a workout lands, the plan or the week changes). Rows resize in place over 220 ms (`EASE_DISPLAY`), the lift lines fade in.
  - **A selected stamped row** stays 62 tall and orange, with a 2 pt amber ring outside it, clear of the orange by a 2 pt gap of lcd ground (a focus ring; the row doesn't expand, its lifts are done). The ring is drawn behind the row so the PR stamp stays on top.
- **Overflow:** rows scroll inside the display (small phones, 6–7 day plans) under a 24 pt fade at whichever edge has more; the selected row scrolls into view.
- **Rocker (week):** one lamp per trainable day, filled green in the order trained (a repeated day lights a lamp); the selected day orange if not filled; off otherwise. `WEEK n` engraved under it (weeks since the plan's `createdAt`, from 1), plus `  ▲n` in orange when the streak counts.
- **Keys:** big key `Start`; top right History; no left keys; the wheel stowed.
- **States:** week complete (all rows stamped, all lamps green, the display footer `WEEK DONE` centred in `lcdSmall` 22 from the bottom, Start still repeats the selected day); no plans (`SLOT` / `EMPTY` dim header, `INSERT PLAN` 40/44 at y150 blinking 1 s steps to .25, big key `Plans` in metal, opening the rack); a day with 0 lifts (`0 LIFTS`; Start toasts "Add lifts to this day first" and opens the editor on that day). Rows are trainable days only, so a 0-lift row shows only when the plan has no lifts anywhere (Build my own): then every day is a `0 LIFTS` row and the rocker has no lamps. No rest days or calendar gaps: the week is a count.
- **Week clock:** recomputed when the app comes to the foreground and at local midnight.
- **After a workout:** when Home reappears after the receipt (`markJustFinished(dayId)` in device state, set by the receipt), the row fills todo → done, its PR stamp stamps in and its lamp flickers green; the stamp haptic and sound play as the stamp lands (`STAMP_DELAY + STAMP_LAND`). Opening a sheet mid-way ends it; it never replays. Reduce Motion: the fill and a plain fade of the stamp, no flicker.
- **VoiceOver order:** menu, the week ("Week 12, 2 of 4 days done"), the rows ("Push 1, next, 6 lifts, about 45 minutes"; "Pull 1, done Monday, 9 sets, squat record"), Start ("Start Push 1"), History. RN groups each view's children and reads siblings top-left first, so the History key is rendered outside the device column (over its top-right slot) to come last.

### Log (V2) [04, 05, 09]

- **Header:** the exercise name ▾ (tap opens the exercise sheet) left; `SET n/m` or `EXTRA SET` right.
- **Drum:** the weight (§10 `Drum`); `--.-` with no history, the first notch going to the first load step.
- **Footer:** `×8` (56) left; `LAST 80×8` dim right, or `TARGET 87.5×8` for Pro with a target; free users with targets locked see a dim `TARGET ›` that opens the paywall.
- **Keys:** `+` / `−` reps (1–50, long press repeats); top right Undo last set (immediate, toast with Undo, disabled when there's nothing to undo); the rocker moves between lifts, its middle opens Today; wheel label `KG` or `LB`.
- **Log:** logs the set with the log-set haptic, starts rest, and moves to the next incomplete lift when this one is done (the obvious next step only). The first weighted set with no weight flashes the drum's frame instead of logging.
- **Tracking modes** (PLAN §6.6): bodyweight puts reps on the drum (`×12` at 104, wheel label `REPS`, no `KG`); assisted shows `−20.0` under an `ASSIST` header; holds put seconds on the drum (5 s per notch, `0:45`); minute-based cardio 1 min per notch (`20 MIN`); reps and duration put the duration on the wheel and reps on the keys.
- **VoiceOver:** one summary ("Bench press, set 2 of 3, 85 kilograms, 8 reps, last time 80 by 8"); the wheel is adjustable ("85 kilograms"); rocker ends are "Previous lift" and "Next lift", the middle "Today's lifts".

### Rest [08]

- Header `REST` / `NEXT 85×8`. A ring of radius 95, stroke 12, centred between the header and the footer at every display height: a dashed `amberOff` track and amber progress (no glow), the time (56) in the centre, ticking plainly. Footer: the lift name ▾ and the set label.
- Keys `+15` / `−15`; the wheel changes time (2 notches = 15 s, label `TIME`); big key `Skip` (metal); Undo stays.
- At 0:00: a blinking `GO` with the rest haptic for 2 s (`REST_GO_MS`), then the log view for the same upcoming set. Nothing is logged or advanced. Adjusting below 0 ends rest. After a relaunch past the end time, the log view shows with no `GO`.

### Finish [11, 12]

- Header: the day name / `N MIN`. `ALL DONE` or `END EARLY?` (44). A grid of set lamps (9 columns, 10 tall), then `n OF m SETS` and the volume.
- Entered when every set is logged, or from the menu's End workout. Top right stays Undo; the left key `Back` returns to the next incomplete lift (or, with everything done, to the last lift, where Log adds an extra set).
- Hold the big key 1.1 s: the ring fills with the continuous haptic ramp; releasing early cancels. Completion plays the finish haptic, then the receipt sheet.
- With nothing logged: `NOTHING LOGGED`, big key `Discard`, which asks first. The big key's VoiceOver label is "Finish workout, hold".

### Edit (plan numbers, PA2) [22]

- Header `PUSH 1  EDIT` / `2 OF 4`. The lift name (28), then `SETS 4 × REPS 15` (104 each); reps is framed because the wheel controls it. Footer: plan name / `N REPS`.
- Left keys set sets (1–10, engraved `SETS`); the wheel sets reps (1–50, `REPS`); durations in 5 s steps (`SETS × 0:45`) or 1 min (`SETS × 20 MIN`).
- The rocker moves between the day's lifts; its middle, the top-left ‹ or `Done` return to the editor. Top right removes the lift (Undo toast). Changes save immediately.

### Loading (plan insert)

`SLOT EMPTY` and a blinking `INSERT PLAN`, then `LOADED`, the plan name (40), the days ticking in with ✓, and a 10-segment bar. Re-entry is ignored while loading. Timeline in §8.

### Menu (N4) [10, 15]

Title `Trim`, ✕ close. `End workout` (only during a workout), with `Discard workout` under it. The finish card: a mini device in the current finish, `Finish 212, Aluminium`, `Change finish`. Then Plans, Progress, History and Settings rows, each with a 56 object icon and one fact line (`Push Pull Legs, 4 days`, the top lift's estimated max, `9 workouts`). No rank line (D4).

### Today (M3) [07]

Top edge 200. Rows: name, sub (`Now, set 2/3`, the logged sets, or `3 × 8 at 85`), set bars (16 × 6, amber when logged), an "i". The current row has a 3 px orange inset on the left. Tap a row to jump (the sheet closes); "i" opens the exercise sheet (‹ comes back); hold a row, then drag to reorder (writes the plan, with today's swaps written back as the plan's own lifts). Swipe a row left for its two actions, `Swap` (dark) and `Remove` (orange); both are also VoiceOver actions, with Move up / Move down and Exercise info. Swap swaps the sheet in place to the lift's alternatives plus `Choose another` (the picker in replace mode). A swap is today only (D81): sets already logged stay with the lift they were done on (an orphan row just before the slot), the new lift takes the sets still to do, no dialog; the receipt asks whether the plan keeps it. `Add lift` (orange text under the card) swaps the sheet in place to the picker (`Add to Push 1`, replace mode: one tap appends to the day and the session, then back to the list). `Choose another` swaps to the same picker titled `Swap <lift>`; ‹ returns to the alternatives. Lifts already in today's session read `In this day`. Remove takes the lift out of today only, with an Undo toast. Tap a logged set bar to edit it on the device (`EDIT SET n`, big key `Save`, no rest; ↶ cancels the edit). An edit started during rest shows the log view; rest keeps running and returns after Save.

### Exercise (M4) [06]

A 230 illustration panel (our own figure for the movement pattern, D5; no panel without a figure), the name (30/800), the kit and muscle line, muscle chips (primary orange), `HOW TO` with 3 numbered steps (only where written), then, for a lift in the open workout, `SWAP FOR`: up to 3 alternatives (`Cable, side delts`; lifts already in today's session left out) and `Choose another` in its own card (the picker in place, ‹ back). One tap swaps for today (D81) and closes the sheet (‹ to Today when opened from it). Then `YOU` with the estimated max and best today or last time. No rank. The display's lift name ▾ opens this sheet, so swapping mid-set is two taps.

### History wall (HR1) [02]

Training weeks (Monday start), newest first: a Doto week header with that week's lamps, then a 3-column grid, gap 10, of mini receipts tilted 0 / 1.5 / −1 / 1 / −1.5°, each with a torn zigzag bottom: day, date, sets, kg, PR or minutes (Plex Mono 9 / 13). Tap prints the full receipt with ‹ back to the wall (the wall keeps its scroll). Long-press deletes after an action sheet (`Delete Push 1 from Thu 2 Oct?`; VoiceOver: a Delete action). Empty: one blank torn receipt reading `NO WORKOUTS YET`. Virtualized for 100+ workouts (`SheetList`, FlashList: a week header or one row of three per item); minis are drawn without measuring (`SlipPaper`), so recycled cells never show stale paper.

- The week header reads `WEEK n` in the active plan's weeks (Home's numbering); weeks before the plan existed read `WEEK OF 22 SEP`. Lamps are the plan's trainable days, lit by the week's workouts (capped).
- The header has ✕; ‹ back to the menu only when it was opened from the menu (Home's History key opens it directly).
- Workouts from deleted plans keep their own title. The PR line uses `workoutPersonalBests`, as the old History detail did.

### Receipt [13, 03]

A black slot (12 tall), paper feeding out in 18 steps over 1.8 s, with a shadow where it leaves the slot, faint thermal lines, a vignette and a zigzag bottom (teeth 14 wide, 9 deep). Content: `TRIM` (and the name on the next line when set), the milestone (bold) when there is one, the day, `date N MIN`; per lift the name and set count with an indented `w × r, r, r` line (`compressSetLines`; `w×r` per set when weights differ); `SETS`, `VOLUME`, the estimated max of the first lift that has one (`BENCH E1RM`, the stamp word), one PR line per record lift (`BENCH PR ★`) in #C2410C, one `GOAL BENCH 100 ✓` line per goal reached (D7). On a fresh receipt, one card per lift swapped today that got a set (D81), between the paper and the actions: `Cable Lateral Raise in Push 1?` (row title), `Instead of Lateral Raises` (row sub), and two pills, `Keep in plan` (light; writes the plan's slot with its own sets and reps, toast `Push 1 updated`) and `Just today` (dark). Answered cards go; unanswered ones leave the plan as it was. Actions: `Share` (dark pill, the receipt as 32-column text) and `Done` (light pill) on a fresh receipt. The fresh receipt's header states the week (`Week 12, 3 of 4 done`) and has no ✕ (Done is the way out); from the wall the header is the day's name with ‹. The fresh receipt claims its milestone (`claimMilestone`).

Whenever a fresh receipt closes (Done, a swipe, the scrim), the moments queue runs (`device/moments.ts`, `moment/moment-host.tsx`), one at a time: the Home stamp (`justFinished`; it waits until Home is in front and the stamp has played), the week moment if this workout filled the week and its ISO week isn't in `weekMomentsShown`, then the post-workout paywall. Phase 4's finish calls `openReceiptAfterFinish(workoutId)`.

### Plans rack (PB3) [20, 24]

Shelves 150 tall, r24, #1C1C1A; the active shelf outlined 3 px orange and listed first. Name, `Active` badge, `N days, M lifts`. Cartridges 48 × 64 along the bottom, label windows in Doto 9 (orange; green for days done this week, active plan only), the day title uppercase, no spaces, at most 6 characters. `+` makes a plan (free users with one plan get the paywall). Going back from the editor to the rack after a change (or a new plan) files that plan's cartridges; Reduce Motion fades them in. ‹ to the menu when opened from it, else ✕. No plans: the fact `No plans yet`.

### Editor (PA1) [21, 25]

The plan name (28) with an `Active` badge, tappable to rename inline. Per day a header (20/800, `N lifts`, a `…` for rename, duplicate, delete with Undo, move up or down) over a card of rows: the name and a dark sets × reps chip (Doto 15 orange) that opens device edit. `Add lift` (orange) under each day; `Add day` (an outlined button) at the end; an empty plan's first state emphasises `Add lift`. The header `…` holds Rename, Use plan and Delete plan. A sticky `Use plan` when the plan isn't active (needs at least one lift; blocked during a workout). Swipe a row left to remove it, with Undo (an orange `Remove` shows behind it); a long press picks a row up to drag it within its day. The day header reads name, `N lifts`, `…`; tapping the name renames it in place, with the usual split names as chips under the field. An empty plan's first day has `Add lift` filled orange. The header title is hidden (the page title repeats it) and its right control is `…`. New plans name themselves from their days; leaving an empty, unnamed new plan discards it silently.

### Add lifts (PA3) [23]

Search field (r23, 46 tall, on `card`), muscle chips scrolling sideways (catalog sections; `Recent` first when there are recents; a chip shows that section, its lifts A to Z by name, `Recent` newest first; search results stay ranked by match), rows with name, `kit, muscle` and a round tick (orange when picked; lifts already in the day read `In this day`), creating a custom exercise from a search with no exact match. A sticky `Add N lifts` (`Pick lifts`, dimmed, with none). The list is the shared `ExercisePicker` (`multi`, or `replace` for Choose another).

### Progress (QA1, without the gauge) [18]

No rank gauge and no rank line (D4); Progress opens with GOALS. GOALS: the pinned goals (up to 3, fixed thirds), each a 64 green ring filling over 1 s with the percentage in it, the lift's name and target, `at 92`; a reached goal shows a full ring with ✓ and a green `Reached 2 Oct`. `LIFTS, 30 DAYS`: every tracked lift, a pinned goal's lift included (screen 18), as name, a 70 × 24 sparkline, the value (estimated max, whole like the old app) and the change since the window's first point (`↑ 6`, `↓ 2`, `±0`; a record is `★ +6`, value and change in yellow). Body measurements with a check-in get their own `BODY` card, same rows, one decimal. Tap a row for its detail; long-press a lift or body row for its goal sheet; long-press a goal for the system action sheet (Edit goal, Unpin from Progress, Remove goal with Undo). Empty: `No lifts yet` over the next day's lifts, dim. A `Check in` row (orange, `+`) ends LIFTS when there's no body data (D11). From the menu the header has ‹; opened directly, ✕.

### Lift detail (QA2) [19]

`Estimated max` (the scrubbed session's date while scrubbing), the big number (`bigNumber` with a 22 unit) and the change line (`↑ 6 in 3 months`, `No change in a month`, `since 1 Mar` for All and while scrubbing), then the lcd chart (§11) with the goal line, the range `Segmented` (default 1M, carried between lifts), and `SESSIONS` rows: `Thu 2 Oct` over `87.5 × 8, 8, 7`, the session's estimated max trailing, `★` and yellow on a record. `Goal` in the header opens the goal sheet (set, replace on Progress, unpin, remove with Undo; a reached goal opens on the next round number). Body detail is the same without lift-only parts: its caption is the latest check-in's date, `+` in the header opens the check-in, a `Goal` row under the range opens the body goal, and the list is `CHECK-INS`. The goal sheet: a `Now 96 kg` fact, the target as a 54 field over − / +, `Pin to Progress` (or `Replace on Progress` and which), `Remove goal`, the light `Set goal` pill. The check-in: every measurement as a row with the last value as placeholder, `Save` in the header, Next / Done on the keyboard. Every ‹ goes back where it came from (goal and check-in to their lift, body or Progress).

### Finishes (N7) [16, 17]

Top edge 430. A sticky title `Finish 305, Signal`, then swatches 92 tall in a sideways row (number in Doto 22, name 13), up to 112 wide but narrowed so three and a half always show: the fourth peeks, so the row reads as scrolling. A swatch picked at either end scrolls fully into view. The selected swatch is rotated −4°, lifted and ringed in white (200 ms; Reduce Motion fades the ring only). The device behind changes live; the finish-swatch haptic on pick. 212 and 101 are free and save on tap; for free users 305 and 408 carry a small `PRO` display chip (lcd ground, amber Doto), preview on tap and show the light `Get Trim Pro` pill above `Done` (D3). After a purchase the previewed finish saves at once. During a workout they preview only, no pill. Closing the sheet reverts a preview silently.

### Settings (D1)

A dark sheet reached from the menu's last row, built like the menu and editor: cards of rows. Name, Weight units, Sounds (on/off), Trim Pro (with its state, e.g. `On, renews 3 Oct`), Restore purchases, Contact support ↗, Privacy Policy ↗, Terms of Use ↗, Clear history (asks first). No Appearance row (D2). Trim Pro opens the paywall above the sheet.

### Onboarding (D12)

Dark grid ground, the new type (`onboardingType`: titles 30/34 centred, one fact line under), a round ‹ top left, one question per screen (see §12 Onboarding), the light full-width Continue pill (60) at the thumb, riding the keyboard on Name. Welcome (D74): first open in space (the `ASSEMBLY` scene, §8 motion table): the device as an object (`DeviceObject`: the real parts scaled, rim and cast shadow) assembles itself and comes alive with a bang, the grid floor lights, the display boots to `SLOT EMPTY` and a blinking `INSERT PLAN`, then `Trim` and `A workout machine.`, then Continue. No unit under the wheel. Days (D74): no fact line; a tall wheel in a metal bezel on the right and a drum of numbers (SF Mono heavy, `onboardingType.wheelNumber`) on the left, an amber notch between them; the wheel is the control (VoiceOver: adjustable). Plan packs are cartridges (PB1: 40 × 64, the day title in the label window, or its initials past 5 characters); a pack's fact line is `~40 min a day`; a picked pack's cartridges hop once in turn. Build my own is the empty pack (`+` slots). Pick your finish (N10): the device large on the grid in the finish being picked, over the four swatches in a 2 × 2 grid; free finishes save on tap, locked ones preview only. Its pill is `Load <plan>` (template) or `Continue` (Build my own). Then the insert as "Plan ready", then the paywall on the template path; if they aren't Pro after it, a locked finish falls back to the free finish saved last (212 unless they picked 101). Build my own has no paywall, so a previewed locked finish falls back there too.

### Paywall (D13)

A full-screen modal above any sheet, on the dark grid with a warm glow at the top, and the knob hero (N9): a ridged metal knob (128) with a light cap and an orange pointer on a dial from `FREE` to `PRO`. Once the modal has landed (550 ms) it turns from FREE to PRO over 1 s, gathering speed then settling, with a detent tick per ridge step and a firmer one on PRO; the arc lights behind it. Then the feature rows' lamps (amber display lamps, not tiles or checkmarks) light one after another, 90 ms apart. Reduce Motion: knob at PRO, lamps lit. Under it the reason's headline (26, centred), one row per Pro feature (title 16, line 14), the plans as pill cards (64, r20; selected 3 pt orange ring, the other a 2 pt quiet ring; the price with its period, then `Free for 7 days, $3.33 a month, save 52%`), the trial timeline one line per step, then the auto-renewal terms (scrolls). The footer: the light CTA pill (56), what happens to money under it, then Restore, Terms and Privacy. `Not now` top right. Everything in §12 Paywall applies; it fits above the fold on a 6.1" iPhone.

### Week moment (D15)

After the receipt's Done, once per full week (`weekMomentsShown` keeps the ISO week key; `week_completed` is tracked): a full-screen moment above the device and sheets on the dark grid ground (#0E0E0D, 1 pt lines of white .04 every 28). The headline `Week 12 done` (30/34, 800) and `8 weeks in a row` under it once the streak counts; the spike with two blank slips, and the report (Plex Mono 12/18, 230 wide, a punched hole) dropping onto it: `WEEK 12` with the week's lamps, `29 SEP TO 5 OCT`, `LIFTS UP`, `RECORDS ★ n` (#A8780A), `VOLUME` (`38.9 T` from 10 t; pounds in full), `BEST SQUAT 127.5` (the week's best estimated max). `Share week` (dark) and `Done` (light). It replaces the flame celebration. Development: `/?moment=week`.

### Keypad (D19)

A short sheet (top edge 430, so the drum stays in view) from a long-press on the drum: the value (`bigNumber`, muted until the first key replaces it) with its unit, and a 3 × 4 pad (`card` keys, r16, 50 tall) with a decimal point for loads only and ⌫. ✕ leaves the drum as it was; `Done` sets it (weight, assistance, reps, seconds or minutes, whatever the drum shows). Log still commits.

---

## 14. Do not

Light or dark appearance modes, navigation bars or other chrome around the device (the menu key is the navigation), glass or blur, SF Symbols on the device, flat UI on the device, bevels, gradients or shadows in sheets, more than one brand hue, green for anything but done, red for going down, a flame or emoji for the streak, a rank gauge or rank line without data, helper text, gesture hints (`HOLD TO FINISH`), middle-dot separators and the other slop markers (§9), motivational copy, sentence case on the display or uppercase SF Rounded in sheets, custom page transitions, a stacked sheet, RN `Modal` for sheets, entrance animations on launch or foreground, idle loops (§8 rule 5), spinners for local data, sounds beyond §8, sounds that take the audio session, haptics on navigation, confirmation dialogs for recoverable actions, gesture-only actions, custom gestures, timers that act, hex literals outside `theme.ts`, raw font sizes, weights, radii or spacing in components, bundling SF fonts.

---

## 15. QA

Before a surface ships, compare it with its target in `design/gadget/screens/` side by side (PLAN §10, `implement-screen`), on all four finishes where the device shows, at default and the largest accessibility text size, one-handed at arm's length. `npm run check` must pass.

1. **Job.** Say the surface's job in one sentence. Point to the one winner and the one primary action.
2. **Geometry.** Within 2 pt of the target at 390 × 844. On iPhone SE and Pro Max nothing clips, keys keep their size, the display flexes.
3. **Type.** Every text uses a role from §3. Display text doesn't scale; sheet text does, up to the cap.
4. **Color.** Exact token values. Orange only marks action, current and selected; green only done; yellow only record; change in ink. Every finish keeps engraved labels and keys readable.
5. **Copy.** Display text uppercase, real units, no hints. Sheet text sentence case. Every section label passes the eyebrow test. No slop markers.
6. **Motion.** Every animation is in §8 with its SPEC timing. A press reacts within 100 ms on press-in. Long moments skip on tap. Reduce Motion gives fades and skips the feed and the insert.
7. **Haptics and sound.** Each fires on the causal frame per §8. Silent switch on: no sound, haptics still play. Sounds off in Settings: no sound.
8. **Control.** Nothing happened that the user didn't ask for (`PRODUCT.md` → Control). Recoverable actions offer Undo; irreversible ones ask. Rest at 0:00 logs nothing.
9. **Accessibility.** Every key has a label and hint-free actions; the wheel is adjustable with its value spoken; the display has one summary label per mode; sheets are modal to VoiceOver with focus on the header; Move up / Move down on reorderable rows.
10. **Gym.** Everything used mid-set is in the bottom row. Leaving and coming back lands on the same state with no animation.
11. **Selling.** Onboarding, paywall and gates pass §12: honest price, visible exit, no pressure. Moments fire once, after the action, one at a time.
12. **Taste.** It reads as the device in the prototype: Trim, not Hevy, Strong or a generic dark app.

---

## 16. Enforcement and migration

**Enforced automatically.** `mobile/scripts/check-design-tokens.mjs` scans `mobile/src` for raw font sizes and weights, hex colors, off-scale and raw spacing, raw radii, durations, pressed opacities and icon sizes, and gesture-hint copy, and compares the counts with `mobile/design-tokens-baseline.json`. It fails if any file gains a violation. `theme.ts` and `motion.ts` are the only exempt files. Run `npm run check` (tsc, tokens and the pure-logic checks in `mobile/scripts/check-*.ts`) before every push; `.github/workflows/checks.yml` runs it on every PR. When old files are deleted or cleaned, run `node scripts/check-design-tokens.mjs --update` so the baseline ratchets down (it reached 0 when the old screens went). **Never raise the baseline** to make a check pass. Rules for the new palettes are welcome (for example, forbid a raw `#FF6A1A`).

**Built.** The redesign landed in phases on `gadget/main` (PLAN §6) and the old screens, components and routes were deleted in Phase 10 (tag `archive/pre-gadget`). New surfaces are built from the device parts and sheet primitives (§10); when a change alters a rule or a value, update this file in the same change.
