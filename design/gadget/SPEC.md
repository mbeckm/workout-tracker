# Trim Gadget: visual, motion and haptic spec

Measured from `prototype/trim-gadget-prototype.html`, which is authoritative when this file and the prototype disagree. Units are iOS points at a 390 × 844 reference screen (iPhone 13/14/15/16 base). Positions are given in that frame; the implementation must lay out with flex and safe areas, not absolute pixels (see Layout).

## 1. Layers

The app has three visual layers. Never mix their styles inside one surface.

| Layer | What | Style |
|---|---|---|
| **Device** | The persistent home of the app: body, keys, display, wheel, big key | Brushed metal (the finish), raised keys, recessed display with orange dot-matrix text (Doto). Shows only what the display needs. No body labels except the small engraved `.lab` labels (WEEK 12, KG, REPS, TIME, SETS). |
| **Sheets** | Everything numbers- or list-heavy: menu, Today, exercise, plans, editor, add lifts, progress, lift detail, history, receipt, finishes, settings | Flat and dark, SF Rounded, rounded cards, orange for action and selection. Always slides up over the device, with the device visible above it except for the tall sheets. |
| **Moments** | Cartridge insert, receipt printer, finish picker, onboarding, paywall knob, week spike | Physical 3D objects on a dark grid ground (`frames/`). Rare, earned, under 4 s, skippable by reduced motion. |

## 2. Colour tokens

### Device: per finish (`finish` is a user setting)

| Token | 212 Aluminium (default) | 101 Graphite | 305 Signal | 408 Bone |
|---|---|---|---|---|
| body1 (top of gradient) | #E4E2DC | #3A3936 | #FF7A35 | #EFE6D3 |
| body2 (bottom) | #D2CFC8 | #232220 | #DE470A | #D9CBB0 |
| label (engraved text) | #7C7A73 | #8C8A84 | #FFE2CF | #7A6F5C |
| labelShadow | rgba(255,255,255,.7) | rgba(0,0,0,.6) | rgba(120,30,0,.35) | rgba(255,255,255,.7) |
| keyEdge | #A9A69E | #A9A69E | #9E3A0A | #A9A69E |

**Shared by every finish**
- key1 #F4F3EF, key2 #DEDBD4, keyInk #2A2925
- wheel ridges #F2F1ED / #C4C1B9
- well rgba(0,0,0,.14)
- plate (the rocker's recessed strip) #C9C6BE

**Body overlays**
- a top sheen: linear white .35 to 0 over the top 40%
- brushing: a vertical 1px line of white .06, then 2px of black .02, repeating every 3px

**Big key**
- Primary: radial at 50% 22%, from #FF8A45 to #F2550F at 70%, with a bottom lip of #B83A05.
- On the Signal finish, primary is graphite instead: #4A4843 to #22211F, lip #0E0E0D.
- Metal (secondary: Skip, Done): #FAF9F6 to #D6D2CA, lip = keyEdge.

### Display

| Token | Value | Use |
|---|---|---|
| lcd | #121211 | display ground (inset shadow 0 3 10 rgba(0,0,0,.8)) |
| amber | #FF6A1A | live text, focus frames, lamps on |
| amberDim | #7A3E1C | secondary display text |
| amberOff | #3A2214 | unlit segments, empty rings |
| doneRowBg | #FF6A1A with ink #121211 | stamped done day rows |
| todoRowBg | #1C1610 | future day rows |

### Sheets

| Token | Value |
|---|---|
| sheet | #151514 |
| card | #232321 |
| rule | #2E2E2B |
| ink | #F3F2EE |
| muted | #8C8A84 |
| sectionLabel | #6E6C66 (Doto 13, letter spacing 1) |
| control (round sheet buttons) | #262624 bg, #C9C6BF glyph |
| scrim | rgba(20,18,15,.40) |

### Signals (PRODUCT principle 12, adapted)

| Signal | Colour | Where |
|---|---|---|
| Action / current / selected | orange #FF6A1A (the brand; it replaces indigo) | big key, focus frames, current lamp, selected chips, Next |
| Done | lamp green #5DAA68, glow 0 0 4 rgba(93,170,104,.45) | lamps for done days and done lifts, goal rings, "done" labels on cartridges |
| Record | yellow #F5C542 | PR sparklines, record values, ★ |
| Streak / secured week | orange (no flame emoji on the device) | |
| Ordinary change | ink with ↑ / ↓ | |

Receipt paper: #FCFAF4 to #EFEADF, ink #34322D, muted #8E8B83, PR line #C2410C.

## 3. Type

| Role | Font | Size / line height | Notes |
|---|---|---|---|
| lcdHero | Doto Black | 104 / 104 | weight on the drum, sets × reps in edit |
| lcdBig | Doto Black | 54–64 / same | rest time, day name on Home's next row (20 in row) |
| lcdTitle | Doto Black | 40–46 | ALL DONE, plan name while loading |
| lcdReps | Doto Black | 56 | ×8 |
| lcdRow | Doto Black | 18–20 | lists on the display |
| lcdSmall | Doto Black | 13–15 | headers (`hd`), meta |
| keyLabel | SF Rounded 800 | 22–26 (glyphs), 17–22 (words) | |
| engraved | SF Rounded 800 | 10, letter spacing 1.5, uppercase | `.lab` |
| sheetTitle | SF Rounded 800 | 18 | sheet header (`sh-top`) |
| sheetHero | SF Rounded 800 | 26–30 / 30–34, letter spacing −0.5 | plan names, exercise name |
| bigNumber | SF Rounded 800 | 54 / 58, letter spacing −1.5 | lift detail |
| rowTitle | SF Rounded 700–800 | 16–17 | |
| rowSub | SF Rounded 600 | 13–15, muted | |
| receipt | IBM Plex Mono 500/700 | 13 / 20 (mini receipts 9 / 13) | |

Dynamic Type: display (lcd) text is fixed size (it's a hardware display) and capped at fontScale 1.0. Sheet text follows `fontScaleCap.text`. Key glyphs are capped at 1.2. VoiceOver labels carry the real meaning (see PLAN edge cases).

## 4. Device geometry (390 × 844 reference)

| Part | Frame | Detail |
|---|---|---|
| Top-left key (menu, or ‹ while editing) | x20 y56, 56 × 56, r28 | |
| Rocker / plate | x96 y56, 198 × 56, r28 (raised key) | Ends: 46 wide each, glyph 24. Middle strip: height 30, r15, plate colour, inset shadow. Lamps 10 px, gap 7. On Home it is the same body without arrows (the week). |
| Label under the rocker | y118 | engraved, e.g. WEEK 12 |
| Top-right key | x(right 20) y56, 56 × 56 | History / Undo / Remove lift |
| Display | x20 y140, 350 × 420, r28 | inner padding 22 |
| Left keys (tall) | x22 y592 and y680, 64 × 76, r22 | +/− reps, ±15 rest, +/− sets while editing |
| Well | x110 y590, 170 × 170, round | |
| Big key | x122 y600, 146 × 146, round | label SF Rounded 800, 22–24 |
| Hold ring | stroke 6 around the well (r80) | amber, with a soft glow |
| Wheel | x(right 22) y588, 64 × 180, r24 | ridges 5 px light + 2 px dark; inner shadows top and bottom 16 px |
| Wheel label | under the wheel, y774 | KG, TIME, REPS |

Layout rule: the top row sits under the safe area, and the bottom row sits above the home indicator with 34 pt clearance at the reference size. The display takes the remaining height, at least 360 pt. On smaller phones (SE, mini), shrink the display first and keep the key sizes.

## 5. Display states (content layout)

- **Home (W1):**
  - Day rows stack from the top with gaps of 8.
  - Done rows: 62 tall, orange ground, ink #121211. Title row is name ✓; meta row is `MON 48 MIN` / `9 SETS`. A PR stamp sits rotated 7°, `SQUAT PR` style, stamped in on first show.
  - The selected undone row: outline 2 px amber, height 70 + 27 × min(4, lifts), listing up to 4 lifts as `NAME 3×8` (prescription dim).
  - Other undone rows: 62 tall, todo ground, dim; meta `~N MIN`.
  - The wheel is stowed (it slides out to the right, opacity 0).
  - No left content.
- **Log (V2):**
  - Header: the exercise name with ▾ (tappable, opens the exercise sheet), and `SET n/m` or `EXTRA SET`.
  - The weight drum: previous step (40 dim), current (104), next step (40 dim), framed by a 2 px amber rounded rectangle 124 tall.
  - Bottom: `×reps` (56) on the left, `LAST 80×8` dim on the right.
- **Rest:**
  - Header: `REST` / `NEXT 85×8`.
  - A ring of radius 95, stroke 12, dashed amberOff track, amber progress (no glow).
  - Time 56 in the centre.
  - Footer: the lift name ▾ and the set label.
- **Finish:**
  - `ALL DONE` or `END EARLY?` (44).
  - A grid of set lamps (9 columns, 10 tall), `n OF m SETS`, volume, and `HOLD TO FINISH` (dim).
- **Edit (plan numbers):**
  - Header: `DAY  EDIT` / `2 OF 4`.
  - Lift name (28), then `SETS 4 × REPS 15` (104 each); reps is framed because the wheel controls it.
  - Footer: plan name / `N REPS`.
- **Loading (plan insert):**
  - `SLOT EMPTY` and a blinking `INSERT PLAN`.
  - Then `LOADED`, the plan name (40), days ticking in with ✓, and a 10-segment bar.

## 6. Sheets

- **Frame:** radius 38 at the top, background `sheet`. It slides from the bottom over 380 ms with bezier(.2,.9,.3,1). Behind it is the scrim, rgba(20,18,15,.4), fading over 300 ms.
- **Top edge:**
  - 96 for most sheets, so the device's top row stays visible.
  - 60 for tall sheets (progress, exercise, editor, add, receipt, lift).
  - 200 for Today. 430 for finishes, a short sheet so the device behind is visible while you pick.
- **Header:** sticky, 68 tall, title centred (18/800). Round 40 controls 16 from the edges: ‹ back, ✕ close, Done, +, Edit.
- **Content:** cards (`card`, radius 24, rows split by 1 px `rule`). Section labels in Doto 13 `sectionLabel`.
- **Main action:** a pill button, 56 tall, radius 28: light (#FBFAF7 with dark ink) for the main action, #2E2D2A for secondary. Sticky at the bottom with a fade (`usebar`).
- **Dismissal:** swipe down, tapping the scrim, ✕ or Done. Back (‹) swaps the sheet's content in place; it does not stack visually.
- **Menu (N4):**
  - "End workout" (only during a workout)
  - the finish card: a mini device in the current finish, "Finish 212, Aluminium", "Change finish"
  - Plans, Progress, History and Settings rows, each with a 56 pt 3D object icon (knob, gauge, receipt, toggles)
- **Today (M3):**
  - Rows: name, sub (`Now, set 2/3`, the logged sets, or `3 × 8 at 85`), set bars (16 × 6), an info "i".
  - The current row is highlighted with a 3 px orange inset on the left.
  - Tapping a row jumps to it; "i" opens the exercise sheet.
  - The production build adds reordering (drag), Swap (alternatives), Add lift and Remove.
- **Exercise (M4):**
  - A 230 pt illustration panel (the animated figure if we have artwork, otherwise no panel)
  - name (30/800), kit and muscle line, muscle chips (primary orange)
  - HOW TO: 3 numbered steps
  - YOU: estimated max, best today or last time, rank if available
- **History wall (HR1):**
  - A week header (Doto, with that week's lamps), then a grid of 3 columns, gap 10.
  - Each mini receipt is tilted (0 / 1.5 / −1 / 1 / −1.5°), with a torn zigzag bottom: day name, date, sets, kg, PR or minutes.
  - Tapping one prints the full receipt.
- **Receipt:**
  - A black slot (12 tall), and paper feeding out of it with an 18-step stepped animation over 1.8 s.
  - Paper: a shadow where it leaves the slot, faint thermal lines, a vignette, and a zigzag bottom (teeth 14 wide, 9 deep).
  - Content:
    - TRIM, then the day, then `date  N MIN`
    - per lift: NAME and set count, with an indented `w × r, r, r` line (or `w×r` per set if the weights differ)
    - SETS, VOLUME, the first lift's estimated max, and the PR line
  - Actions: Copy, and Done when it's the fresh receipt.
- **Plans rack (PB3):**
  - Shelves 150 tall, radius 24, #1C1C1A; the active shelf is outlined in orange.
  - Name, Active badge, `N days, M lifts`.
  - Cartridges 48 × 64, label window Doto 9 (orange; green for done days).
  - "+" makes a new plan.
- **Editor (PA1):**
  - The plan name (28) with an Active badge, then per day a header (20/800, `N lifts`) over a card of rows.
  - Each row: name, and a dark sets × reps chip in Doto 15 orange that opens the device edit.
  - "Add lift" (orange) under each day, "Add day" (an outlined button) at the end.
  - A sticky "Use plan" if the plan isn't active.
- **Add lifts (PA3):**
  - The search field, muscle chips (scrolling sideways), and rows with name, `kit, muscle` and a round tick (orange when picked).
  - A sticky "Add N lifts".
- **Progress (QA1):**
  - The rank gauge (a 160 × 92 metal object, a dark face, an amber needle that swings in from −70°), with the rank line under it. Only if rank data exists; see PLAN.
  - GOALS: 3 cards, each a 64 ring (green), `Bench 100`, `at 92.5`.
  - LIFTS, 30 DAYS: rows of name, a 70 × 24 sparkline (yellow if a record, muted if flat, otherwise ink), value, and the change.
- **Lift detail (QA2):**
  - "Estimated max", the big number, and the change line.
  - The chart on an lcd panel: an orange line, dots, the last dot yellow if it's a record, and a dashed green goal line labelled `GOAL 100` in Doto.
  - Range control: 1M and 3M are free; 6M, 1Y and All are Pro (marked `PRO`).
  - SESSIONS rows.
- **Finishes:** a sticky title "Finish 305, Signal", then swatches 112 × 92 (number in Doto 22, name 13). The selected swatch is rotated −4°, lifted and ringed in white. The device behind changes live.

## 7. Motion

| Motion | Duration / curve | Notes |
|---|---|---|
| Key press | translateY 3 (round keys), 6 (big key); 80 ms; the lip shadow collapses | on press-in, not release |
| Display content change | fade and rise 8, 220 ms, bezier(.2,.8,.3,1) | every mode change |
| Weight drum step | translateY ±24, then back, over 160 ms, bezier(.2,.8,.3,1) | per wheel notch |
| Wheel | the ridge texture follows the finger 1:1. One notch = 16 pt of travel (weight: one step per notch; rest: ±15 s per 2 notches; reps while editing: 1 per notch) | |
| Sheet in / out | 380 ms, bezier(.2,.9,.3,1); scrim 300 ms | |
| Rocker press | tilts rotateY ±10° for 160 ms | |
| Hold to finish | 1100 ms linear fill of the ring; on release, it snaps back | |
| Receipt feed | translateY 100% to 0 in 18 steps over 1.8 s | |
| Stamp (new PR or done day) | scale 2.4 → 1, rotate −12° → 7°, opacity 0 → 1, 500 ms, delay 450, bezier(.2,1.6,.4,1); the row fills from todo to done over 500 ms | |
| Lamp turns green (day finished) | flicker: off, on, off, on over 900 ms (steps) | |
| Wheel stow on Home | translateX 40, scale .9, opacity 0, 350 ms | |
| Cartridge filing (plan saved) | each cartridge drops from translateY −120 rotate −8°, 550 ms, bezier(.3,1.4,.5,1), staggered 120 ms; the shelf flashes | |
| Plan activation (3D) | see below | |
| Needle (progress gauge) | swings from −70° to its value over 1.4 s, bezier(.2,.8,.3,1) | |
| Goal ring | fills from 0 over 1 s | |
| Chart line | draws in over 1 s | |

Reduced motion: replace movement with fades. Skip the receipt feed (show the paper), skip the 3D activation (go straight to the loaded state), and keep haptics and sounds.

### Plan activation (Game Boy-style insert)

| t (ms) | What happens |
|---|---|
| 0 | The sheet closes. The scene fades in over 600 ms: backdrop radial #1D1C1A to #0B0B0A, a perspective grid floor (44 pt cells, white .14, rotateX 72°, fading out at the far and near ends), a vignette, and a soft shadow under the device. The display shows `SLOT EMPTY` and a blinking `INSERT PLAN`; the rocker lamps are off and the wheel is stowed. |
| 0–750 | The device pulls back: translateY 70, scale .68, rotateX −16°, rotateY −30°, rotateZ 2°, with bezier(.6,0,.25,1). The body is about 44 pt thick: 22 layers, each darker towards the back. |
| 750–1170 | The cartridge appears above the top edge and settles in over 420 ms (translateY −60 → 0, fade in). It is light grey plastic, 160 × 190, with grip ridges, a dark label carrying the plan name (Doto 17) and its days (Doto 10), a "TRIM" emboss and an arrow. Its thickness is in 5 layers. It sits halfway into the body's depth. |
| 1350–1780 | Insertion: slides down 180 over 430 ms, bezier(.55,0,.8,.35), and ends with part of the cartridge still sticking out of the top. |
| 1780 | **The click:** <br>• the cartridge overshoots by 12, then settles back by 8 and 2 (300 ms) <br>• the device dips 10 and tilts rotateX 4°, then rebounds (420 ms) <br>• an orange glow flashes along the slot (600 ms) <br>• an orange ring pulses out from behind the device (scale .35 → 1.25, 700 ms) <br>• the lamps flick across one after another <br>• the display powers on (flicker, scaleY .02 → 1.04 → 1, 450 ms) and shows `LOADED`, the plan name and an empty bar <br>• haptic `cartridgeClick` and sound `cartridge` |
| 2300–3000 | The device swings back to face you (700 ms) and the scene fades out. |
| 3000+ | The days tick onto the display (190 ms apart, haptic tick each) and the week lamps light. Then Home renders, with a toast "<Plan> is your plan". |

## 8. Haptics map

Implementation: Core Haptics patterns in `TrimHaptics` (see PLAN), falling back to `expo-haptics` where Core Haptics isn't available.

| Event | Pattern | Fallback |
|---|---|---|
| Wheel notch (weight, time, reps) | transient, intensity .5, sharpness .9. Every 5th notch, or whole 10 kg: intensity .8 | `selectionAsync` |
| Key press (any key) | transient .6 / .5 | `impactAsync(Light)` |
| Big key press-in | transient .9 / .4 | `impactAsync(Medium)` |
| Log set | transient 1.0 / .6, then 40 ms later .4 / .3 | `impactAsync(Rigid)` |
| Rocker move | transient .7 / .8 | `impactAsync(Light)` |
| Rest reaches 0:00 | 3 transients .8 / .5, 120 ms apart | `notificationAsync(Success)` |
| Hold to finish | continuous, intensity ramping .2 → .9 over 1.1 s, sharpness .3; release cancels | `impactAsync(Soft)` at the start and a heavy impact at the end |
| Finish complete | transient 1.0 / .3 | `notificationAsync(Success)` |
| Receipt printing | 18 transients .25 / .9, 100 ms apart (matching the feed steps) | none |
| Stamp lands | transient .9 / .2 | `impactAsync(Heavy)` |
| Cartridge click | t0 transient 1.0 / 1.0 (latch), t65 transient 1.0 / .2 (seat), then continuous .3 / .1 for 80 ms | `impactAsync(Rigid)`, then `impactAsync(Heavy)` 65 ms later |
| Day ticks in (loading) | transient .4 / .7 | `selectionAsync` |
| Sheet open / close | none (the system sheet feel) | |
| Finish swatch picked | transient .5 / .6 | `selectionAsync` |

## 9. Sounds

Off when the silent switch is on (AVAudioSession category `.ambient`). A Settings toggle "Sounds", on by default. Short, dry, mechanical, never musical.

| Sound | Character | When |
|---|---|---|
| `cartridge` | latch "clack" (noise burst, bandpass 3.2 kHz, Q 1.6, 30 ms) plus a thump 220 → 90 Hz over 60 ms; then at 65 ms a "thunk" (noise bandpass 900 Hz, 60 ms) plus a thump 120 → 48 Hz over 160 ms | the cartridge seats |
| `print` | stepper chatter: 18 short ticks | the receipt prints |
| `stamp` | a soft low thud | a PR or done stamp lands |
| `key` (optional) | a very quiet click | key presses (off by default, decide in QA) |

Render these as WAV files (44.1 kHz mono, peak −3 dBFS, each under 1 s) with a script (the prototype's `clickSound()` shows the synthesis) and commit them under `mobile/assets/sounds/`.

## 10. Copy rules on the device

- Display text is UPPERCASE Doto.
- Use numbers with real units (`85.0`, `KG`, `×8`, `1:24`).
- No helper text, gesture hints, middle dots or emoji (AGENTS.md and trim-ui).
- Sheet copy follows the existing trim-ui copy rules (sentence case, says each fact once).
