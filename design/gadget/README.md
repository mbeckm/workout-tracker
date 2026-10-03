# Trim "Gadget" redesign: design assets

Everything a Claude session needs to rebuild Trim as the "device" app lives in this folder. Start with `PLAN.md` (what to build and in which order), then `SPEC.md` (exact values). The prototype is the source of truth for look, motion and behaviour; the boards explain why.

## Read in this order

1. `PLAN.md`: the implementation plan for the orchestrator session. Covers phases, what to keep, change and delete, edge cases, verification and the definition of done.
2. `SPEC.md`: tokens, component geometry, motion, haptics and sounds, measured from the prototype.
3. `prototype/trim-gadget-prototype.html`: the clickable prototype. Open it in Chromium or Safari (it works offline and loads the fonts from `fonts/`). It is one HTML file with all CSS and JS inline; read its source for any value `SPEC.md` doesn't list.
4. `screens/`: screenshots of every prototype state, at 2×. Use them as visual targets.
5. `frames/`: the cartridge insert animation, frame by frame.
6. `boards/png/` (chosen boards, rendered) and `boards/html/` (all 62 exploration boards as standalone HTML).

## Prototype: how to drive it

- **Home:** tap a day row to pick it. The big orange key starts the workout.
- **Logging:**
  - Drag the ridged wheel, or drag the weight display, to change the weight. Mouse wheel and the arrow keys on the focused wheel work too.
  - The `+` and `−` keys change reps.
  - The big key logs the set.
- **Rocker** (the top plate during a workout): `‹` and `›` move between lifts. Its middle opens today's lifts.
- **Exercise name** on the display: opens the exercise sheet.
- **Top right key:** History on Home, Undo during a workout, Remove lift while editing a plan.
- **Menu key** (top left) opens the menu sheet, which leads to Plans, Progress, History and Finishes, plus End workout during a workout.
- **Finish:** hold the big key until the ring closes. The receipt prints, and Done returns to Home with the day stamped.
- **Plans:**
  - Tap a plan on the rack to edit it.
  - Tap a `3 × 8` chip and the device sets the numbers: the keys change sets, the wheel changes reps, Done goes back to the list.
  - Back to the rack files the cartridges.
  - Use plan on another plan plays the 3D cartridge insert.
- **Reset prototype** (next to the phone) restores the example data. The chosen finish is kept in localStorage.

## Screens (`screens/`, prototype states)

| File | State |
|---|---|
| 01-home | Home: week lamps in the rocker body, stamped done days, next day open, Start |
| 02-history-wall | History as a wall of receipts by week (HR1) |
| 03-history-receipt | One past receipt opened from the wall |
| 04-log-set | Logging: weight drum, reps, rocker, wheel, big Log key |
| 05-log-adjusted | After turning the wheel and pressing reps + |
| 06-exercise-sheet | Exercise sheet (M4), opened by tapping the name |
| 07-today-sheet | Today's lifts (M3), opened from the rocker's middle |
| 08-rest | Rest ring on the display, ±15 keys, Skip |
| 09-rocker-next-lift | Moved to the next lift with the rocker |
| 10-menu-during-workout | Menu sheet with End workout |
| 11-finish-hold | Finish state (end early) |
| 12-finish-holding | Holding the big key, ring filling |
| 13-receipt-prints | Receipt printing out of the slot |
| 14-home-day-stamped | Back on Home, the new day stamped |
| 15-menu | Menu sheet |
| 16-finishes, 17-finish-101/305/408 | Finish picker and the device in Graphite, Signal, Bone |
| 18-progress | Progress (QA1): gauge, goals, lifts with sparklines |
| 19-lift-detail | Lift detail (QA2): big number, chart with goal line, ranges, sessions |
| 20-plans-rack | Plans rack: shelves of cartridges |
| 21-plan-editor | Plan editor as a list with sets × reps chips |
| 22-device-edit-sets-reps | The device setting sets × reps for one lift |
| 23-add-lifts | Add lifts sheet |
| 24-plans-saved-filing | Back on the rack, the edited plan's cartridges filing in |
| 25-other-plan-use | Another plan's editor with Use plan |

`frames/cartridge-a…g`: zoom out on a dark grid, cartridge appears, insert, click (slot glow, pulse ring), display boots, swing back, Home with the new plan.

## Boards: what was chosen (`boards/`)

Every board is kept for history. Only the ones marked **Chosen** are the target; the prototype supersedes boards wherever they differ.

| Board | Status | Notes |
|---|---|---|
| N1, N2, N3 | Chosen (evolved) | The device: top row (menu key, plate, right key), display, bottom row (left keys, big round key in a well, wheel). The roller in N2 and N3 was rejected; see V2. |
| N4 | Chosen | Menu sheet over the device, with a finish card and items that carry 3D object icons |
| N5 | Superseded by QA1 | |
| N6 | Superseded by PA1 | |
| N7 | Chosen | Finishes picker (in the prototype it's a short sheet with swatches, and the device behind changes live) |
| N8 | Reference | Rank moment (needs rank data; see PLAN open decisions) |
| N9 | Reference | Paywall: a knob turning to PRO |
| N10 | Chosen | Onboarding: pick your finish on a dark grid |
| V2 | Chosen | One wheel for weight, `+` / `−` keys for reps (symmetrical). V1, V3 and V4 were rejected. |
| W1 | Chosen | Home: stamped day rows on the display. The `2 of 4` flip counter was replaced by week lamps in the rocker body. W2–W4 rejected. |
| M1 | Chosen | Rocker switch between lifts |
| M3 | Chosen | Today's lifts sheet (opened from the rocker's middle) |
| M4 | Chosen | Exercise sheet: illustration, muscles, how-to, your numbers (opened from the name) |
| HR1 | Chosen | History: receipt wall by week |
| HR2 | Chosen for moments | Receipt spike, for distinct moments (week complete) |
| HR3 | Rejected | |
| PA1, PA2, PA3 | Chosen | Plan editor list, numbers set on the device, add lifts sheet |
| PB1 | Chosen for onboarding | Plan packs as cartridges |
| PB2 | Superseded | By the 3D insert in the prototype |
| PB3 | Chosen | Plans rack |
| PC1, PC2 | Rejected | Nobody arranges 20 lifts with a wheel |
| QA1, QA2 | Chosen | Progress: rank gauge, goal rings, lifts with sparklines; lift detail |
| QB1, QB2, QC1 | Rejected | |
| QC2 | Optional moment | A finished week prints a report onto the spike |
| G*, H*, AN*, P1–P5, X* | Exploration only | Earlier rounds |

## How the design was reached (short)

Marvin felt Trim looked like Duolingo, not a training tool. Rounds of exploration led to an "instrument" look:
- brushed aluminium
- a black display with orange dot-matrix numbers (Doto)
- aluminium keys, a ridged wheel and an orange round key

The breakthrough came from studying (Not Boring) Camera, which mixes a physical object with ordinary app screens:
- **The device is the screen.** It carries no labels beyond what the display shows.
- **Everything numbers-heavy is a dark, flat sheet** that slides up over the device, with the device still visible at the top.
- **Information appears on the display only while a control is in use.**
- **The physical style returns only at moments:** the cartridge insert, the receipt printer, finishes and the paywall knob.

Marvin's own decisions along the way:
- one wheel only (reps on keys)
- stamped day rows on Home, with week lamps in the same part as the rocker
- moving between lifts with the rocker
- History as a receipt wall
- plans edited as a clean list, with the device only for numbers
- Progress as clean sheets
- activation as a chunky 3D device on a dark grid with a satisfying click

## Fonts (`fonts/`)

| File | Use | Licence |
|---|---|---|
| `Doto-Black.ttf` | All display text. A static instance of Doto at wght 900, ROND 0, made with fontTools from Google Fonts' variable Doto. | SIL OFL, see `OFL-Doto.txt` |
| `IBMPlexMono-Medium.ttf`, `IBMPlexMono-Bold.ttf` | Receipts | SIL OFL, see `OFL-IBMPlexMono.txt` |

UI text on the device body and in sheets is the iOS system rounded font (SF Pro Rounded, through `fontFamily: 'ui-rounded'`), so it needs no file.
